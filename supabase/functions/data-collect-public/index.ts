import { createClient } from "npm:@supabase/supabase-js@2.110.8";
import { dataCollectCrypto } from "../_shared/dataCollectCrypto.ts";
import {
  DATA_COLLECT_EXTENSIONS,
  dataCollectFileError,
  validDataCollectDecision,
} from "../_shared/dataCollectRules.ts";

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
const key =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SECRET_KEY");
if (!url || !key)
  throw new Error("Supabase service environment is not configured.");
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FILE_BUCKET = "data-collect-files",
  TEMPLATE_BUCKET = "data-collect-templates";
interface CollectionRow {
  id: string;
  public_token: string;
  title: string;
  description: string;
  kind: string;
  mode: "fixed" | "custom";
  template_path: string | null;
  template_name_ciphertext: string | null;
  template_size: number | null;
  template_mime: string | null;
  status: "open" | "closed";
  due_at: string | null;
  password_digest: string | null;
  allow_resubmit: boolean;
}
interface TargetRow {
  id: string;
  personal_token: string;
  display_label: string;
  display_owner: string;
}
interface UploadRow {
  id: string;
  collection_id: string;
  personal_token: string;
  claim_hash: string;
  storage_path: string;
  expires_at: string;
  consumed_at: string | null;
}
const str = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";
const hash = async (v: string | ArrayBuffer) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        typeof v === "string" ? new TextEncoder().encode(v) : v,
      ),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
const normalize = (v: string) =>
  v
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("ko-KR")
    .replaceAll(" ", "");
const closed = (c: CollectionRow) =>
  c.status === "closed" ||
  Boolean(c.due_at && new Date(c.due_at).getTime() <= Date.now());
const ipOf = (r: Request) =>
  r.headers.get("cf-connecting-ip") ??
  r.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
  "unknown";
const limit = async (
  request: Request,
  token: string,
  person = "",
  guess = false,
) => {
  const ip = ipOf(request);
  const keys = guess
    ? [["guess:" + ip + ":" + token, 40]]
    : [
        ["ip:" + ip, 1200],
        ["collection-ip:" + ip + ":" + token, 600],
        ...(person ? [["participant:" + token + ":" + person, 12]] : []),
      ];
  const limits = await Promise.all(
    keys.map(async ([k, max]) => ({ key: await hash(String(k)), max })),
  );
  const result = await db.rpc("consume_data_collect_limits", {
    p_limits: limits,
  });
  if (result.error)
    throw new HttpError(
      503,
      "요청 제한을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
  if (!result.data)
    throw new HttpError(
      429,
      "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    );
};
const getCollection = async (token: string) => {
  if (!uuidPattern.test(token))
    throw new HttpError(400, "요청 주소가 올바르지 않습니다.");
  const result = await db
    .from("data_collections")
    .select("*")
    .eq("public_token", token)
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new HttpError(404, "자료 수합을 찾을 수 없습니다.");
  return result.data as CollectionRow;
};
const getTarget = async (c: CollectionRow, token: string, optional = false) => {
  if (!uuidPattern.test(token)) {
    if (optional && !token) return null;
    throw new HttpError(404, "제출 대상을 찾을 수 없습니다.");
  }
  const result = await db
    .from("data_collection_targets")
    .select("id,personal_token,display_label,display_owner")
    .eq("collection_id", c.id)
    .eq("personal_token", token)
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data && !optional)
    throw new HttpError(404, "제출 대상을 찾을 수 없습니다.");
  return result.data as TargetRow | null;
};
const verifyPassword = async (c: CollectionRow, password: unknown) => {
  if (!c.password_digest) return;
  if (typeof password !== "string" || password.length > 200)
    throw new HttpError(401, "비밀번호가 맞지 않습니다.");
  const result = await db.rpc("verify_data_collection_password", {
    p_collection_id: c.id,
    p_password: password,
  });
  if (result.error) throw result.error;
  if (!result.data) throw new HttpError(401, "비밀번호가 맞지 않습니다.");
};
const claimHash = (c: CollectionRow, personal: string, id: string) =>
  dataCollectCrypto.nameLookup(c.id + ":" + personal + ":" + id);
const readUpload = async (c: CollectionRow, path: string) => {
  const result = await db
    .from("data_collection_uploads")
    .select("*")
    .eq("collection_id", c.id)
    .eq("storage_path", path)
    .maybeSingle();
  if (result.error) throw result.error;
  return result.data as UploadRow | null;
};
const cleanup = async (upload: UploadRow) => {
  // 확정된 참조가 없는 예약만 정리한다. DB 확정 여부가 불명확하면 파일을 지우지 않는다.
  // 확정 RPC와 같은 예약 행을 잠그는 조건부 UPDATE로 정리 권한을 먼저 얻는다.
  const invalidated = await db
    .from("data_collection_uploads")
    .update({ expires_at: "1970-01-01T00:00:00Z" })
    .eq("id", upload.id)
    .is("consumed_at", null)
    .select("id");
  if (invalidated.error || !invalidated.data?.length) return;
  const referenced = await db
    .from("data_collection_files")
    .select("id")
    .eq("storage_path", upload.storage_path)
    .limit(1);
  if (referenced.error || referenced.data?.length) return;
  const removed = await db.storage
    .from(FILE_BUCKET)
    .remove([upload.storage_path]);
  if (removed.error) {
    await db.from("data_collection_cleanup").upsert({
      storage_path: upload.storage_path,
      collection_id: upload.collection_id,
      last_error_code: "storage_remove_failed",
    });
    return;
  }
  await db
    .from("data_collection_uploads")
    .delete()
    .eq("id", upload.id)
    .is("consumed_at", null);
};
const rpcError = (message: string) => {
  const mapping: Record<string, [number, string]> = {
    collection_full: [
      422,
      "제출 대상 2,000명 한도에 도달했습니다. 담당자에게 문의해 주세요.",
    ],
    collection_closed: [410, "자료 수합이 종료되었습니다."],
    resubmit_disabled: [
      409,
      "이미 제출한 자료입니다. 담당자에게 문의해 주세요.",
    ],
    request_conflict: [
      409,
      "같은 요청의 내용이 변경되었습니다. 입력을 확인해 다시 제출해 주세요.",
    ],
    invalid_upload_claim: [
      400,
      "업로드 정보가 만료되었거나 올바르지 않습니다. 파일을 다시 선택해 주세요.",
    ],
    invalid_decision: [422, "요청 종류에 맞는 회신 방법을 선택해 주세요."],
    invalid_file: [400, "제출할 파일을 선택해 주세요."],
    target_not_found: [404, "제출 대상을 찾을 수 없습니다."],
    collection_not_found: [404, "자료 수합을 찾을 수 없습니다."],
  };
  const item = Object.entries(mapping).find(([code]) => message.includes(code));
  return item ? new HttpError(...item[1]) : null;
};
Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST")
    return json(405, { error: "허용되지 않은 요청입니다." });
  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const action = str(body.action, 40),
      token = str(body.token, 80);
    if (
      ![
        "metadata",
        "template-download",
        "search",
        "resume",
        "prepare-upload",
        "submit",
      ].includes(action)
    )
      throw new HttpError(400, "지원하지 않는 요청입니다.");
    // 제한 장애 때 업무/명단을 읽기 전에 중단한다.
    await limit(
      request,
      token,
      ["prepare-upload", "submit"].includes(action)
        ? str(body.personalToken, 80)
        : "",
    );
    const c = await getCollection(token);
    const summary = {
      accessGranted: false,
      title: c.title,
      status: c.status,
      dueAt: c.due_at ?? "",
      passwordRequired: Boolean(c.password_digest),
    };
    if (
      action === "metadata" &&
      (closed(c) ||
        (c.password_digest &&
          !Object.prototype.hasOwnProperty.call(body, "password")))
    )
      return json(200, { collection: summary });
    if (closed(c)) throw new HttpError(410, "자료 수합이 종료되었습니다.");
    try {
      await verifyPassword(c, body.password);
    } catch (error) {
      if (error instanceof HttpError && error.status === 401)
        await limit(request, token, "", true);
      throw error;
    }
    if (action === "metadata" || action === "template-download") {
      let template: Record<string, unknown> | null = null;
      if (c.template_path) {
        let downloadUrl = "";
        if (action === "template-download" || body.lazyDownload !== true) {
          const signed = await db.storage
            .from(TEMPLATE_BUCKET)
            .createSignedUrl(c.template_path, 300);
          if (signed.error) throw signed.error;
          downloadUrl = signed.data?.signedUrl ?? "";
        }
        template = {
          name: c.template_name_ciphertext
            ? await dataCollectCrypto.decryptPayload<string>(
                c.template_name_ciphertext,
              )
            : "배포 파일",
          size: c.template_size ?? 0,
          mimeType: c.template_mime ?? "application/octet-stream",
          url: downloadUrl,
        };
      }
      if (action === "template-download") return json(200, { template });
      return json(200, {
        collection: {
          ...summary,
          accessGranted: true,
          description: c.description,
          kind: c.kind,
          mode: c.mode,
          allowResubmit: c.allow_resubmit,
          hasTemplate: Boolean(c.template_path),
          template,
        },
      });
    }
    if (!dataCollectCrypto.isConfigured())
      throw new HttpError(
        503,
        "서버 준비가 끝나지 않았습니다. 잠시 후 다시 시도해 주세요.",
      );
    let personal = str(body.personalToken, 80);
    if (action === "search") {
      if (c.mode === "custom")
        throw new HttpError(
          422,
          "이 자료 수합은 제출할 때 이름을 직접 입력합니다.",
        );
      if (personal) {
        const t = await getTarget(c, personal);
        return json(200, {
          targets: [
            {
              token: t!.personal_token,
              label: t!.display_label,
              owner: t!.display_owner,
            },
          ],
        });
      }
      const query = normalize(str(body.query, 120));
      if (query.length < 2)
        throw new HttpError(422, "두 글자 이상 입력해 주세요.");
      const needle = await dataCollectCrypto.nameLookup(query);
      const result = await db
        .from("data_collection_targets")
        .select("personal_token,display_label,display_owner")
        .eq("collection_id", c.id)
        .or(
          "label_search.cs." +
            JSON.stringify([needle]) +
            ",owner_search.cs." +
            JSON.stringify([needle]),
        )
        .order("row_number")
        .limit(10);
      if (result.error) throw result.error;
      if (!result.data?.length) await limit(request, token, "", true);
      return json(200, {
        targets: (result.data ?? []).map((row) => ({
          token: row.personal_token,
          label: row.display_label,
          owner: row.display_owner,
        })),
      });
    }
    if (action === "resume") {
      const t = await getTarget(c, personal);
      const current = await db
        .from("data_collection_files")
        .select("revision,response_kind")
        .eq("collection_id", c.id)
        .eq("target_id", t!.id)
        .eq("is_current", true)
        .maybeSingle();
      if (current.error) throw current.error;
      return json(200, {
        target: { label: t!.display_label, owner: t!.display_owner },
        submission: current.data
          ? {
              revision: current.data.revision,
              decision: current.data.response_kind,
            }
          : null,
      });
    }
    let requestId = str(body.requestId, 80);
    if (requestId && !uuidPattern.test(requestId))
      throw new HttpError(400, "제출 요청 정보가 올바르지 않습니다.");
    if (action === "prepare-upload") {
      requestId ||= crypto.randomUUID();
      if (!personal && c.mode === "custom") personal = crypto.randomUUID();
      const target = await getTarget(c, personal, c.mode === "custom");
      if (!target && !str(body.respondentName, 120))
        throw new HttpError(422, "제출자 이름을 입력해 주세요.");
      if (target && !c.allow_resubmit) {
        const done = await db
          .from("data_collection_files")
          .select("id")
          .eq("collection_id", c.id)
          .eq("target_id", target.id)
          .eq("is_current", true)
          .maybeSingle();
        if (done.error) throw done.error;
        if (done.data)
          throw new HttpError(
            409,
            "이미 제출한 자료입니다. 담당자에게 문의해 주세요.",
          );
      }
      const name = str(body.fileName, 500),
        extension = name.toLowerCase().split(".").pop() ?? "";
      if (!(DATA_COLLECT_EXTENSIONS as readonly string[]).includes(extension))
        throw new HttpError(400, "허용되지 않은 파일 형식입니다.");
      if (Number(body.fileSize) > 50 * 1024 * 1024 || body.fileSize === 0)
        throw new HttpError(400, "제출 파일은 최대 50MiB입니다.");
      const path = c.id + "/pending/" + requestId + "/file." + extension;
      const claim = await claimHash(c, personal, requestId);
      const previous = await readUpload(c, path);
      if (
        previous &&
        (previous.claim_hash !== claim ||
          new Date(previous.expires_at).getTime() <= Date.now() ||
          previous.consumed_at)
      )
        throw new HttpError(409, "업로드 정보를 다시 준비해 주세요.");
      if (!previous) {
        const reserved = await db.from("data_collection_uploads").insert({
          id: requestId,
          collection_id: c.id,
          personal_token: personal,
          claim_hash: claim,
          storage_path: path,
        });
        if (reserved.error) throw reserved.error;
      }
      const signed = await db.storage
        .from(FILE_BUCKET)
        .createSignedUploadUrl(path);
      if (signed.error) throw signed.error;
      return json(200, {
        path,
        token: signed.data.token,
        requestId,
        personalToken: personal,
      });
    }
    const decision = str(body.decision, 20);
    if (!validDataCollectDecision(Boolean(c.template_path), decision))
      throw new HttpError(422, "요청 종류에 맞는 회신 방법을 선택해 주세요.");
    const path = str(body.storagePath, 1000),
      name = str(body.fileName, 500);
    let upload: UploadRow | null = null;
    if (decision !== "confirmed") {
      if (!path || !name)
        throw new HttpError(400, "제출할 파일을 선택해 주세요.");
      upload = await readUpload(c, path);
      if (!upload)
        throw new HttpError(
          400,
          "올바른 업로드 정보가 없습니다. 파일을 다시 선택해 주세요.",
        );
      requestId ||= upload.id;
      personal ||= upload.personal_token;
      if (
        upload.id !== requestId ||
        upload.personal_token !== personal ||
        upload.claim_hash !== (await claimHash(c, personal, requestId))
      )
        throw new HttpError(403, "이 제출 파일에 접근할 권한이 없습니다.");
    } else {
      requestId ||= crypto.randomUUID();
      if (path)
        throw new HttpError(
          422,
          "이상 없음 회신에는 파일을 첨부하지 않습니다.",
        );
      if (!personal && c.mode === "custom") personal = crypto.randomUUID();
    }
    const target = await getTarget(c, personal, c.mode === "custom");
    const respondentName = str(body.respondentName, 120);
    if (!target && !respondentName)
      throw new HttpError(422, "제출자 이름을 입력해 주세요.");
    const digest = await dataCollectCrypto.nameLookup(
      JSON.stringify({
        personal,
        decision,
        path,
        name,
        note: str(body.note, 4000),
        respondentName,
      }),
    );
    const previous = await db
      .from("data_collection_files")
      .select("target_id,request_digest,revision,response_kind")
      .eq("collection_id", c.id)
      .eq("request_id", requestId)
      .maybeSingle();
    if (previous.error) throw previous.error;
    if (previous.data) {
      if (
        previous.data.request_digest !== digest ||
        previous.data.target_id !== target?.id
      )
        throw new HttpError(409, "같은 요청의 내용이 변경되었습니다.");
      return json(200, {
        submitted: true,
        revision: previous.data.revision,
        decision: previous.data.response_kind,
        personalToken: personal,
      });
    }
    let info: {
      byteSize: number;
      mimeType: string;
      contentHash: string;
    } | null = null;
    if (upload) {
      if (
        upload.consumed_at ||
        new Date(upload.expires_at).getTime() <= Date.now()
      )
        throw new HttpError(
          400,
          "업로드 정보가 만료되었습니다. 파일을 다시 선택해 주세요.",
        );
      const downloaded = await db.storage.from(FILE_BUCKET).download(path);
      if (downloaded.error)
        throw new HttpError(
          400,
          "제출 파일을 읽지 못했습니다. 다시 시도해 주세요.",
        );
      const error = await dataCollectFileError(downloaded.data, name);
      if (error) {
        await cleanup(upload);
        throw new HttpError(400, error);
      }
      info = {
        byteSize: downloaded.data.size,
        mimeType: downloaded.data.type || "application/octet-stream",
        contentHash: await hash(await downloaded.data.arrayBuffer()),
      };
    }
    const identity = !target
      ? await dataCollectCrypto.encryptPayload({
          label: respondentName,
          owner: "",
        })
      : null;
    const finalized = await db.rpc("finalize_data_collection_submission", {
      p_collection_id: c.id,
      p_personal_token: personal,
      p_request_id: requestId,
      p_request_digest: digest,
      p_decision: decision,
      p_claim_hash: upload?.claim_hash ?? "",
      p_storage_path: upload?.storage_path ?? null,
      p_name_ciphertext: upload
        ? await dataCollectCrypto.encryptPayload(name)
        : null,
      p_identity_ciphertext: identity,
      p_display_label: respondentName
        ? respondentName[0] +
          "○" +
          (respondentName.length > 2 ? respondentName.at(-1) : "")
        : "",
      p_label_search: respondentName
        ? [await dataCollectCrypto.nameLookup(normalize(respondentName))]
        : [],
      p_content_hash: info?.contentHash ?? null,
      p_byte_size: info?.byteSize ?? null,
      p_mime_type: info?.mimeType ?? null,
      p_note_ciphertext: body.note
        ? await dataCollectCrypto.encryptPayload(str(body.note, 4000))
        : null,
    });
    if (finalized.error) {
      // 네트워크 오류는 확정 성공일 수 있으므로 파일을 지우지 않는다.
      const mapped = rpcError(finalized.error.message);
      if (mapped && upload) await cleanup(upload);
      if (mapped) throw mapped;
      throw finalized.error;
    }
    return json(200, finalized.data);
  } catch (error) {
    if (error instanceof HttpError)
      return json(error.status, { error: error.message });
    console.error("data-collect-public request failed");
    return json(500, {
      error:
        "자료 수합 요청을 처리하지 못했습니다. 입력을 유지한 채 다시 시도해 주세요.",
    });
  }
});
