import { createClient } from "npm:@supabase/supabase-js@2.110.8";
import {
  dataCollectCrypto,
  type DataCollectIdentity,
} from "../_shared/dataCollectCrypto.ts";
import { normalizeDataCollectDeadline } from "../_shared/dataCollectDeadline.ts";
import { dataCollectFileError } from "../_shared/dataCollectRules.ts";
import {
  dataCollectSubmissionPrefix,
  dataCollectTemplatePrefix,
} from "../_shared/dataCollectStoragePaths.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const url = Deno.env.get("SUPABASE_URL");
const serviceKey =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SECRET_KEY");
const anonKey =
  Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
if (!url || !serviceKey || !anonKey)
  throw new Error("Supabase service environment is not configured.");
const db = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const COLLECTION_TEMPLATE_BUCKET = "data-collect-templates";
const FILE_BUCKET = "data-collect-files";
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedKinds = new Set(["worksheet", "plan", "consent", "custom"]);

const requireUser = async (request: Request) => {
  const authorization = request.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer "))
    throw new HttpError(401, "로그인이 필요합니다.");
  const caller = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const result = await caller.auth.getUser();
  if (result.error || !result.data.user)
    throw new HttpError(401, "로그인 정보를 확인하지 못했습니다.");
  return { userId: result.data.user.id, caller };
};

const normalize = (value: string) =>
  value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("ko-KR");
const prefixes = (value: string) => {
  const normalized = normalize(value).replaceAll(" ", "");
  return Array.from({ length: normalized.length }, (_, index) =>
    normalized.slice(0, index + 1),
  ).filter(Boolean);
};
const searchHashes = async (value: string) =>
  Promise.all(
    prefixes(value).map((prefix) => dataCollectCrypto.nameLookup(prefix)),
  );
const mask = (value: string) => {
  const trimmed = value.trim();
  if (trimmed.length <= 1) return trimmed;
  if (trimmed.length === 2) return trimmed[0] + "○";
  return `${trimmed[0]}${"○".repeat(Math.min(2, trimmed.length - 2))}${trimmed.at(-1)}`;
};
const readDeadline = (value: unknown) => {
  try { return normalizeDataCollectDeadline(value, "+09:00"); }
  catch (error) { throw new HttpError(422, (error as Error).message); }
};
const readString = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const ensurePath = (path: string, userId: string, collectionId?: string) => {
  const parts = path.split("/");
  if (
    parts.length < 2 ||
    parts[0] !== userId ||
    (collectionId && parts[1] !== collectionId)
  )
    throw new HttpError(422, "파일 저장 경로가 올바르지 않습니다.");
};

interface CollectionRow {
  id: string;
  owner_id: string;
  public_token: string;
  title: string;
  description: string;
  kind: string;
  mode: string;
  allow_walk_in: boolean;
  template_path: string | null;
  template_name_ciphertext: string | null;
  template_size: number | null;
  template_mime: string | null;
  status: "open" | "closed";
  due_at: string | null;
  password_digest: string | null;
  allow_resubmit: boolean;
  retention_months: number;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}
interface TargetRow {
  id: string;
  collection_id: string;
  row_number: number;
  label_ciphertext: string;
  owner_ciphertext: string;
  display_label: string;
  display_owner: string;
  personal_token: string;
}
interface FileRow {
  id: string;
  collection_id: string;
  target_id: string | null;
  response_kind: "confirmed" | "corrected" | "submitted";
  revision: number;
  is_current: boolean;
  storage_path: string | null;
  original_name_ciphertext: string | null;
  content_hash: string | null;
  byte_size: number | null;
  mime_type: string | null;
  note_ciphertext: string | null;
  uploaded_at: string;
}

const signFiles = async (rows: FileRow[]) => {
  const paths = rows
    .map((row) => row.storage_path)
    .filter((path): path is string => Boolean(path));
  const signed = paths.length
    ? await db.storage.from(FILE_BUCKET).createSignedUrls(paths, 600)
    : { data: [], error: null };
  if (signed.error) throw signed.error;
  const urls = new Map<string, string>();
  (signed.data ?? []).forEach((item) => {
    if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
  });
  return { urls, paths };
};

const serialize = async (collection: CollectionRow, userId: string) => {
  if (collection.owner_id !== userId)
    throw new HttpError(403, "이 자료 수합을 관리할 권한이 없습니다.");
  const targetsResult = await db
    .from("data_collection_targets")
    .select("*")
    .eq("collection_id", collection.id)
    .order("row_number");
  if (targetsResult.error) throw targetsResult.error;
  const filesResult = await db
    .from("data_collection_files")
    .select("*")
    .eq("collection_id", collection.id)
    .order("uploaded_at");
  if (filesResult.error) throw filesResult.error;
  const targets = targetsResult.data as TargetRow[];
  const files = filesResult.data as FileRow[];
  const signed = await signFiles(files);
  const sourceUrl = collection.template_path
    ? await db.storage
        .from(COLLECTION_TEMPLATE_BUCKET)
        .createSignedUrl(collection.template_path, 600)
    : { data: null, error: null };
  if (sourceUrl.error) throw sourceUrl.error;
  const sourceName = collection.template_name_ciphertext
    ? await dataCollectCrypto.decryptPayload<string>(
        collection.template_name_ciphertext,
      )
    : "";
  return {
    id: collection.id,
    ownerId: collection.owner_id,
    publicToken: collection.public_token,
    title: collection.title,
    description: collection.description,
    kind: collection.kind,
    mode: collection.mode === "custom" ? "custom" : "fixed",
    status: collection.status,
    allowResubmit: collection.allow_resubmit,
    dueAt: collection.due_at ?? "",
    passwordHash: collection.password_digest ? "configured" : "",
    retentionMonths: collection.retention_months,
    sourceFile: collection.template_path
      ? {
          originalName: sourceName,
          mimeType: collection.template_mime ?? "application/octet-stream",
          byteSize: collection.template_size ?? 0,
          dataUrl: sourceUrl.data?.signedUrl ?? "",
        }
      : undefined,
    targets: await Promise.all(
      targets.map(async (target) => {
        const identity =
          await dataCollectCrypto.decryptPayload<DataCollectIdentity>(
            target.label_ciphertext,
          );
        return {
          id: target.id,
          rowNumber: target.row_number,
          label: identity.label,
          owner: identity.owner,
          personalToken: target.personal_token,
        };
      }),
    ),
    submissions: await Promise.all(
      files.map(async (file) => ({
        id: file.id,
        targetId: file.target_id ?? "",
        revision: file.revision,
        decision: file.response_kind,
        note: file.note_ciphertext
          ? await dataCollectCrypto.decryptPayload<string>(file.note_ciphertext)
          : "",
        uploadedAt: file.uploaded_at,
        file: file.storage_path
          ? {
              originalName: file.original_name_ciphertext
                ? await dataCollectCrypto.decryptPayload<string>(
                    file.original_name_ciphertext,
                  )
                : "제출 파일",
              mimeType: file.mime_type ?? "application/octet-stream",
              byteSize: file.byte_size ?? 0,
              dataUrl: signed.urls.get(file.storage_path) ?? "",
            }
          : undefined,
      })),
    ),
    createdAt: collection.created_at,
    updatedAt: collection.updated_at,
    closedAt: collection.closed_at ?? undefined,
  };
};

const readCollection = async (id: string, userId: string) => {
  if (!uuidPattern.test(id))
    throw new HttpError(400, "자료 수합 식별자가 올바르지 않습니다.");
  const result = await db
    .from("data_collections")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new HttpError(404, "자료 수합을 찾을 수 없습니다.");
  return serialize(result.data as CollectionRow, userId);
};

const readTargets = (body: Record<string, unknown>) => {
  if (
    !Array.isArray(body.targets) ||
    body.targets.length < 1 ||
    body.targets.length > 2_000
  )
    throw new HttpError(
      422,
      "제출 대상은 1명 이상 2000명 이하로 입력해 주세요.",
    );
  const seen = new Set<string>();
  return body.targets.map((entry, index) => {
    const row = entry as Record<string, unknown>;
    const label = readString(row.label, 120);
    const owner = readString(row.owner, 120);
    if (!label)
      throw new HttpError(422, `${index + 1}번 제출 대상을 입력해 주세요.`);
    const key = `${normalize(label)}\u0000${normalize(owner)}`;
    if (seen.has(key))
      throw new HttpError(422, "같은 제출 대상과 담당자를 중복할 수 없습니다.");
    seen.add(key);
    return { label, owner };
  });
};

const listAllNames = async (
  bucket: string,
  prefix: string,
): Promise<string[]> => {
  const names: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const result = await db.storage
      .from(bucket)
      .list(prefix, { limit: 1000, offset });
    if (result.error) throw result.error;
    const entries = result.data ?? [];
    for (const entry of entries) {
      const child = `${prefix}/${entry.name}`.replace(/^\//, "");
      if (entry.id) names.push(child);
      else names.push(...(await listAllNames(bucket, child)));
    }
    if (entries.length < 1000) return names;
  }
};
const removeAll = async (bucket: string, prefix: string) => {
  const names = await listAllNames(bucket, prefix);
  for (let index = 0; index < names.length; index += 100) {
    const result = await db.storage
      .from(bucket)
      .remove(names.slice(index, index + 100));
    if (result.error) throw result.error;
  }
  const remaining = await listAllNames(bucket, prefix);
  if (remaining.length) throw new Error("파일을 실제로 지우지 못했습니다.");
};

interface TargetPageRow {
  id: string;
  row_number: number;
  label_ciphertext: string;
  display_owner: string;
  submission_id: string | null;
  response_kind: string | null;
  revision: number | null;
  uploaded_at: string | null;
  has_note: boolean;
  has_file: boolean;
  byte_size: number;
  needs_repair: boolean;
  note_ciphertext?: string | null;
  original_name_ciphertext?: string | null;
}
const ownedRow = async (id: string, userId: string) => {
  if (!uuidPattern.test(id))
    throw new HttpError(400, "자료 수합 식별자가 올바르지 않습니다.");
  const result = await db
    .from("data_collections")
    .select("*")
    .eq("id", id)
    .eq("owner_id", userId)
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new HttpError(404, "자료 수합을 찾을 수 없습니다.");
  return result.data as CollectionRow;
};
const summaryRows = async (
  userId: string,
  id: string | null = null,
  before: string | null = null,
  beforeId: string | null = null,
) => {
  const result = await db.rpc("data_collect_summary_page", {
    p_owner_id: userId,
    p_collection_id: id,
    p_before: before,
    p_before_id: beforeId,
    p_limit: id ? 1 : 21,
  });
  if (result.error) throw result.error;
  return result.data as Array<Record<string, unknown>>;
};
const targetRows = async (
  userId: string,
  id: string,
  after = 0,
  limit = 51,
  unsubmitted = false,
  detail = false,
) => {
  const result = await db.rpc("data_collect_target_page", {
    p_owner_id: userId,
    p_collection_id: id,
    p_after: after,
    p_limit: limit,
    p_unsubmitted: unsubmitted,
    p_detail: detail,
  });
  if (result.error) throw result.error;
  return result.data as TargetPageRow[];
};
const mapTarget = async (row: TargetPageRow) => {
  const identity = await dataCollectCrypto.decryptPayload<DataCollectIdentity>(
    row.label_ciphertext,
  );
  return {
    id: row.id,
    rowNumber: row.row_number,
    label: identity.label,
    owner: identity.owner,
    submission: row.submission_id
      ? {
          id: row.submission_id,
          decision: row.response_kind,
          revision: row.revision,
          uploadedAt: row.uploaded_at,
          hasNote: row.has_note,
          hasFile: row.has_file,
          byteSize: row.byte_size,
        }
      : null,
    needsRepair: row.needs_repair,
    ...(row.note_ciphertext
      ? {
          note: await dataCollectCrypto.decryptPayload<string>(
            row.note_ciphertext,
          ),
        }
      : {}),
    ...(row.original_name_ciphertext
      ? {
          fileName: await dataCollectCrypto.decryptPayload<string>(
            row.original_name_ciphertext,
          ),
        }
      : {}),
  };
};
const overview = async (
  id: string,
  userId: string,
  after = 0,
  unsubmitted = false,
) => {
  const c = await ownedRow(id, userId);
  const [counts, rows] = await Promise.all([
    summaryRows(userId, id),
    targetRows(userId, id, after, 51, unsubmitted),
  ]);
  const items = rows.slice(0, 50);
  return {
    collection: {
      ...counts[0],
      publicToken: c.public_token,
      description: c.description,
      allowResubmit: c.allow_resubmit,
      templateName: c.template_name_ciphertext
        ? await dataCollectCrypto.decryptPayload<string>(
            c.template_name_ciphertext,
          )
        : "",
      closedAt: c.closed_at ?? "",
      retentionMonths: c.retention_months,
    },
    targets: await Promise.all(items.map(mapTarget)),
    nextAfter: rows.length > 50 ? items.at(-1)?.row_number : null,
  };
};

const cleanupUploads = async (collectionId: string) => {
  const [expired, failed] = await Promise.all([
    db
      .from("data_collection_uploads")
      .select("storage_path")
      .eq("collection_id", collectionId)
      .is("consumed_at", null)
      .lte("expires_at", new Date().toISOString())
      .limit(50),
    db
      .from("data_collection_cleanup")
      .select("storage_path,attempts")
      .eq("collection_id", collectionId)
      .order("created_at")
      .limit(50),
  ]);
  if (expired.error) throw expired.error;
  if (failed.error) throw failed.error;
  const paths = [
    ...new Set([
      ...(expired.data ?? []).map((x) => x.storage_path),
      ...(failed.data ?? []).map((x) => x.storage_path),
    ]),
  ].slice(0, 50);
  if (!paths.length) return { removed: 0, failed: 0 };
  const referenced = await db
    .from("data_collection_files")
    .select("storage_path")
    .eq("collection_id", collectionId)
    .in("storage_path", paths);
  if (referenced.error) throw referenced.error;
  const keep = new Set((referenced.data ?? []).map((x) => x.storage_path));
  const invalidated = await db
    .from("data_collection_uploads")
    .update({ expires_at: "1970-01-01T00:00:00Z" })
    .eq("collection_id", collectionId)
    .in("storage_path", paths)
    .is("consumed_at", null)
    .select("storage_path");
  if (invalidated.error) throw invalidated.error;
  const cancellable = new Set(
    (invalidated.data ?? []).map((row) => row.storage_path),
  );
  let removed = 0,
    errors = 0;
  for (const path of paths) {
    if (keep.has(path) || !cancellable.has(path)) continue;
    if (!path.startsWith(collectionId + "/")) continue;
    const result = await db.storage.from(FILE_BUCKET).remove([path]);
    if (result.error) {
      errors++;
      const queued = await db.from("data_collection_cleanup").upsert({
        storage_path: path,
        collection_id: collectionId,
        attempts:
          ((failed.data ?? []).find((x) => x.storage_path === path)?.attempts ??
            0) + 1,
        last_error_code: "storage_remove_failed",
      });
      if (queued.error) throw queued.error;
    } else {
      const reservation = await db
        .from("data_collection_uploads")
        .delete()
        .eq("collection_id", collectionId)
        .eq("storage_path", path)
        .is("consumed_at", null);
      if (reservation.error) throw reservation.error;
      const queue = await db
        .from("data_collection_cleanup")
        .delete()
        .eq("collection_id", collectionId)
        .eq("storage_path", path);
      if (queue.error) throw queue.error;
      removed++;
    }
  }
  return { removed, failed: errors };
};

const cleanupTemplates = async (userId: string) => {
  const pending = await db
    .from("data_collect_template_uploads")
    .select("storage_path,attempts")
    .eq("owner_id", userId)
    .lte("expires_at", new Date().toISOString())
    .or(
      "consumed_at.is.null,consumed_at.lt." +
        new Date(Date.now() - 3600000).toISOString(),
    )
    .limit(50);
  if (pending.error) throw pending.error;
  const paths = (pending.data ?? []).map((x) => x.storage_path);
  if (!paths.length) return { removed: 0, failed: 0 };
  const referenced = await db
    .from("data_collections")
    .select("template_path")
    .eq("owner_id", userId)
    .in("template_path", paths);
  if (referenced.error) throw referenced.error;
  const keep = new Set((referenced.data ?? []).map((x) => x.template_path));
  let removed = 0,
    failed = 0;
  for (const row of pending.data ?? []) {
    if (
      keep.has(row.storage_path) ||
      !row.storage_path.startsWith(userId + "/")
    )
      continue;
    const invalidated = await db
      .from("data_collect_template_uploads")
      .update({ expires_at: "1970-01-01T00:00:00Z" })
      .eq("owner_id", userId)
      .eq("storage_path", row.storage_path)
      .lte("expires_at", new Date().toISOString())
      .or(
        "consumed_at.is.null,consumed_at.lt." +
          new Date(Date.now() - 3600000).toISOString(),
      )
      .select("storage_path");
    if (invalidated.error) throw invalidated.error;
    if (!invalidated.data?.length) continue;
    const result = await db.storage
      .from(COLLECTION_TEMPLATE_BUCKET)
      .remove([row.storage_path]);
    if (result.error) {
      failed++;
      const saved = await db
        .from("data_collect_template_uploads")
        .update({
          attempts: row.attempts + 1,
          last_error_code: "storage_remove_failed",
        })
        .eq("owner_id", userId)
        .eq("storage_path", row.storage_path);
      if (saved.error) throw saved.error;
    } else {
      const removedRow = await db
        .from("data_collect_template_uploads")
        .delete()
        .eq("owner_id", userId)
        .eq("storage_path", row.storage_path);
      if (removedRow.error) throw removedRow.error;
      removed++;
    }
  }
  return { removed, failed };
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const action = readString(body.action, 40);
    const { userId, caller } = await requireUser(request);

    if (action === "cleanup-templates")
      return json(200, await cleanupTemplates(userId));
    if (action === "summary") {
      const rows = await summaryRows(
        userId,
        null,
        readString(body.before, 80) || null,
        readString(body.beforeId, 80) || null,
      );
      return json(200, {
        collections: rows.slice(0, 20),
        nextCursor:
          rows.length > 20
            ? { before: rows[19].createdAt, beforeId: rows[19].id }
            : null,
      });
    }
    if (action === "overview")
      return json(
        200,
        await overview(
          readString(body.id, 80),
          userId,
          Math.max(0, Number(body.after) || 0),
          body.unsubmitted === true,
        ),
      );
    if (
      [
        "history",
        "download",
        "export",
        "due",
        "status-lite",
        "cleanup-uploads",
      ].includes(action)
    ) {
      const c = await ownedRow(readString(body.id, 80), userId);
      if (action === "cleanup-uploads")
        return json(200, await cleanupUploads(c.id));
      if (action === "status-lite") {
        if (!["open", "closed"].includes(String(body.status)))
          throw new HttpError(422, "수합 상태가 올바르지 않습니다.");
        const changed = await db
          .from("data_collections")
          .update({ status: body.status })
          .eq("id", c.id)
          .eq("owner_id", userId);
        if (changed.error) throw changed.error;
        return json(200, await overview(c.id, userId));
      }
      if (action === "due") {
        const dueAt = readDeadline(body.dueAt);
        const changed = await db
          .from("data_collections")
          .update({ due_at: dueAt || null })
          .eq("id", c.id)
          .eq("owner_id", userId);
        if (changed.error) throw changed.error;
        return json(200, await overview(c.id, userId));
      }
      if (action === "export") {
        const rows = await targetRows(userId, c.id, 0, 2001, false, true);
        if (rows.length > 2000)
          throw new HttpError(
            422,
            "한 번에 출력할 수 있는 대상은 2,000명입니다.",
          );
        return json(200, {
          rows: await Promise.all(rows.map(mapTarget)),
          title: c.title,
          hasTemplate: Boolean(c.template_path),
          exportedAt: new Date().toISOString(),
        });
      }
      if (action === "history") {
        const targetId = readString(body.targetId, 80);
        if (!uuidPattern.test(targetId))
          throw new HttpError(422, "제출 대상 정보가 올바르지 않습니다.");
        const result = await db
          .from("data_collection_files")
          .select(
            "id,target_id,response_kind,revision,note_ciphertext,uploaded_at,storage_path,original_name_ciphertext,byte_size",
          )
          .eq("collection_id", c.id)
          .eq("target_id", targetId)
          .lt("revision", Number(body.beforeRevision) || 2147483647)
          .order("revision", { ascending: false })
          .limit(11);
        if (result.error) throw result.error;
        const rows = result.data.slice(0, 10);
        return json(200, {
          submissions: await Promise.all(
            rows.map(async (row) => ({
              id: row.id,
              targetId: row.target_id,
              decision: row.response_kind,
              revision: row.revision,
              note: row.note_ciphertext
                ? await dataCollectCrypto.decryptPayload<string>(
                    row.note_ciphertext,
                  )
                : "",
              uploadedAt: row.uploaded_at,
              hasFile: Boolean(row.storage_path),
              fileName: row.original_name_ciphertext
                ? await dataCollectCrypto.decryptPayload<string>(
                    row.original_name_ciphertext,
                  )
                : "",
              byteSize: row.byte_size ?? 0,
            })),
          ),
          nextRevision: result.data.length > 10 ? rows.at(-1)?.revision : null,
        });
      }
      if (body.source === true) {
        if (!c.template_path) throw new HttpError(404, "배포 파일이 없습니다.");
        const signed = await db.storage
          .from(COLLECTION_TEMPLATE_BUCKET)
          .createSignedUrl(c.template_path, 300);
        if (signed.error) throw signed.error;
        return json(200, {
          url: signed.data.signedUrl,
          name: c.template_name_ciphertext
            ? await dataCollectCrypto.decryptPayload<string>(
                c.template_name_ciphertext,
              )
            : "배포 파일",
        });
      }
      const fileId = readString(body.fileId, 80);
      if (!uuidPattern.test(fileId))
        throw new HttpError(422, "제출 파일 정보가 올바르지 않습니다.");
      const row = await db
        .from("data_collection_files")
        .select("storage_path,original_name_ciphertext")
        .eq("collection_id", c.id)
        .eq("id", fileId)
        .maybeSingle();
      if (row.error) throw row.error;
      if (!row.data?.storage_path)
        throw new HttpError(404, "제출 파일이 없습니다.");
      const signed = await db.storage
        .from(FILE_BUCKET)
        .createSignedUrl(row.data.storage_path, 300);
      if (signed.error) throw signed.error;
      return json(200, {
        url: signed.data.signedUrl,
        name: row.data.original_name_ciphertext
          ? await dataCollectCrypto.decryptPayload<string>(
              row.data.original_name_ciphertext,
            )
          : "제출 파일",
      });
    }

    if (action === "create-upload-url") {
      const path = readString(body.path, 1000);
      ensurePath(path, userId);
      const collectionId = path.split("/")[1];
      if (!uuidPattern.test(collectionId))
        throw new HttpError(422, "배포 파일 경로가 올바르지 않습니다.");
      const reserved = await db.from("data_collect_template_uploads").insert({
        storage_path: path,
        owner_id: userId,
        collection_id: collectionId,
      });
      if (reserved.error) throw reserved.error;
      const result = await db.storage
        .from(COLLECTION_TEMPLATE_BUCKET)
        .createSignedUploadUrl(path);
      if (result.error) throw result.error;
      return json(200, { path, token: result.data.token });
    }
    if (action === "create") {
      if (!dataCollectCrypto.isConfigured())
        throw new HttpError(
          503,
          "자료 수합 암호화 키가 설정되지 않아 만들 수 없습니다.",
        );
      const title = readString(body.title, 200);
      const description = readString(body.description, 4000);
      const kind = readString(body.kind, 20);
      const mode = readString(body.mode, 20) || "fixed";
      const targets = mode === "fixed" ? readTargets(body) : [];
      if (
        !title ||
        !allowedKinds.has(kind) ||
        !["fixed", "custom"].includes(mode)
      )
        throw new HttpError(422, "자료 수합 기본 정보를 확인해 주세요.");
      const dueAt = readDeadline(body.dueAt);
      const id =
        typeof body.id === "string" && uuidPattern.test(body.id)
          ? body.id
          : crypto.randomUUID();
      const templatePath = readString(body.templatePath, 1000) || null;
      if (templatePath) {
        ensurePath(templatePath, userId, id);
        if (body.responseMode === "id") {
          const claimed = await db
            .from("data_collect_template_uploads")
            .update({ consumed_at: new Date().toISOString() })
            .eq("storage_path", templatePath)
            .eq("owner_id", userId)
            .is("consumed_at", null)
            .gt("expires_at", new Date().toISOString())
            .select("storage_path")
            .maybeSingle();
          if (claimed.error) throw claimed.error;
          if (!claimed.data)
            throw new HttpError(
              422,
              "배포 파일 업로드가 만료되었습니다. 파일을 다시 선택해 주세요.",
            );
        }
        const uploaded = await db.storage
          .from(COLLECTION_TEMPLATE_BUCKET)
          .download(templatePath);
        if (uploaded.error)
          throw new HttpError(
            422,
            "배포 파일을 읽지 못했습니다. 다시 선택해 주세요.",
          );
        const invalid = await dataCollectFileError(
          uploaded.data,
          readString(body.templateName, 500),
          true,
        );
        if (invalid) throw new HttpError(422, invalid);
      }
      const inserted = await db
        .from("data_collections")
        .insert({
          id,
          owner_id: userId,
          title,
          description,
          kind,
          mode,
          allow_walk_in: Boolean(body.allowWalkIn),
          template_path: templatePath,
          template_name_ciphertext: templatePath
            ? await dataCollectCrypto.encryptPayload(
                readString(body.templateName, 500),
              )
            : null,
          template_size: templatePath
            ? Number(body.templateSize) || null
            : null,
          template_mime: templatePath
            ? readString(body.templateMime, 200)
            : null,
          due_at: dueAt || null,
          allow_resubmit: body.allowResubmit !== false,
          retention_months: Math.max(
            1,
            Math.min(120, Number(body.retentionMonths) || 12),
          ),
        })
        .select("id")
        .single();
      if (inserted.error) throw inserted.error;
      try {
        if (targets.length) {
          const rows = await Promise.all(
            targets.map(async (target, index) => ({
              collection_id: id,
              row_number: index + 1,
              label_ciphertext: await dataCollectCrypto.encryptPayload({
                label: target.label,
                owner: target.owner,
              } satisfies DataCollectIdentity),
              owner_ciphertext: await dataCollectCrypto.encryptPayload({
                label: target.label,
                owner: target.owner,
              } satisfies DataCollectIdentity),
              label_search: await searchHashes(target.label),
              owner_search: await searchHashes(target.owner),
              display_label: mask(target.label),
              display_owner: mask(target.owner),
            })),
          );
          const added = await db.from("data_collection_targets").insert(rows);
          if (added.error) throw added.error;
        }
        if (typeof body.password === "string" && body.password.trim()) {
          const password = await caller.rpc("set_data_collection_password", {
            p_collection_id: id,
            p_password: body.password.trim(),
          });
          if (password.error) throw password.error;
        }
      } catch (error) {
        await removeAll(
          COLLECTION_TEMPLATE_BUCKET,
          dataCollectTemplatePrefix(userId, id),
        );
        await db.from("data_collections").delete().eq("id", id);
        throw error;
      }
      if (templatePath) {
        const consumed = await db
          .from("data_collect_template_uploads")
          .update({ consumed_at: new Date().toISOString() })
          .eq("storage_path", templatePath)
          .eq("owner_id", userId);
        if (consumed.error) throw consumed.error;
      }
      if (body.responseMode === "id") return json(200, { id });
      return json(200, await readCollection(id, userId));
    }
    const id = readString(body.id, 80);
    if (action === "list") {
      const result = await db
        .from("data_collections")
        .select("*")
        .eq("owner_id", userId)
        .order("updated_at", { ascending: false });
      if (result.error) throw result.error;
      return json(200, {
        collections: await Promise.all(
          (result.data as CollectionRow[]).map((row) => serialize(row, userId)),
        ),
      });
    }
    if (action === "get")
      return json(200, { collection: await readCollection(id, userId) });
    if (action === "status") {
      if (!["open", "closed"].includes(readString(body.status, 20)))
        throw new HttpError(422, "수합 상태가 올바르지 않습니다.");
      const result = await db
        .from("data_collections")
        .update({ status: body.status })
        .eq("id", id)
        .eq("owner_id", userId);
      if (result.error) throw result.error;
      return json(200, { collection: await readCollection(id, userId) });
    }
    if (action === "delete") {
      const row = await db
        .from("data_collections")
        .select("id")
        .eq("id", id)
        .eq("owner_id", userId)
        .maybeSingle();
      if (row.error) throw row.error;
      if (!row.data) throw new HttpError(404, "자료 수합을 찾을 수 없습니다.");
      const targetCount = await db
        .from("data_collection_targets")
        .select("id", { count: "exact", head: true })
        .eq("collection_id", id);
      if (targetCount.error) throw targetCount.error;
      const fileCount = await db
        .from("data_collection_files")
        .select("id", { count: "exact", head: true })
        .eq("collection_id", id);
      if (fileCount.error) throw fileCount.error;
      await removeAll(
        COLLECTION_TEMPLATE_BUCKET,
        dataCollectTemplatePrefix(userId, id),
      );
      await removeAll(FILE_BUCKET, dataCollectSubmissionPrefix(id));
      const deleted = await db
        .from("data_collections")
        .delete()
        .eq("id", id)
        .eq("owner_id", userId);
      if (deleted.error) throw deleted.error;
      const logged = await db.from("privacy_purge_log").insert({
        owner_id: userId,
        resource_kind: "data-collect",
        resource_id: id,
        record_count: targetCount.count ?? 0,
        file_count: fileCount.count ?? 0,
      });
      if (logged.error) console.error("privacy purge log failed", logged.error);
      return json(200, { deleted: true });
    }
    throw new HttpError(400, "지원하지 않는 요청입니다.");
  } catch (error) {
    if (error instanceof HttpError)
      return json(error.status, { error: error.message });
    console.error("data-collect-admin request failed");
    return json(500, { error: "자료 수합 관리 요청을 처리하지 못했습니다." });
  }
});
