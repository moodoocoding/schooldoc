import { createClient } from 'npm:@supabase/supabase-js@2.110.8';
import { dataCollectCrypto, type DataCollectIdentity } from '../_shared/dataCollectCrypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } });
class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }

const url = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY');
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
if (!url || !serviceKey || !anonKey) throw new Error('Supabase service environment is not configured.');
const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const COLLECTION_TEMPLATE_BUCKET = 'data-collect-templates';
const FILE_BUCKET = 'data-collect-files';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedKinds = new Set(['worksheet', 'plan', 'consent', 'custom']);

const requireUser = async (request: Request) => {
  const authorization = request.headers.get('Authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) throw new HttpError(401, '로그인이 필요합니다.');
  const caller = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: authorization } } });
  const result = await caller.auth.getUser();
  if (result.error || !result.data.user) throw new HttpError(401, '로그인 정보를 확인하지 못했습니다.');
  return { userId: result.data.user.id, caller };
};

const normalize = (value: string) => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ko-KR');
const prefixes = (value: string) => {
  const normalized = normalize(value).replaceAll(' ', '');
  return Array.from({ length: normalized.length }, (_, index) => normalized.slice(0, index + 1)).filter(Boolean);
};
const searchHashes = async (value: string) => Promise.all(prefixes(value).map((prefix) => dataCollectCrypto.nameLookup(prefix)));
const mask = (value: string) => {
  const trimmed = value.trim();
  if (trimmed.length <= 1) return trimmed;
  return `${trimmed[0]}${'○'.repeat(Math.min(2, trimmed.length - 2))}${trimmed.at(-1)}`;
};
const readString = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const ensurePath = (path: string, userId: string, collectionId?: string) => {
  const parts = path.split('/');
  if (parts.length < 2 || parts[0] !== userId || (collectionId && parts[1] !== collectionId)) throw new HttpError(422, '파일 저장 경로가 올바르지 않습니다.');
};

interface CollectionRow { id: string; owner_id: string; public_token: string; title: string; description: string; kind: string; mode: string; allow_walk_in: boolean; template_path: string | null; template_name_ciphertext: string | null; template_size: number | null; template_mime: string | null; status: 'open' | 'closed'; due_at: string | null; password_digest: string | null; allow_resubmit: boolean; retention_months: number; created_at: string; updated_at: string; }
interface TargetRow { id: string; collection_id: string; row_number: number; label_ciphertext: string; owner_ciphertext: string; display_label: string; display_owner: string; personal_token: string; }
interface FileRow { id: string; collection_id: string; target_id: string | null; response_kind: 'confirmed' | 'corrected' | 'submitted'; revision: number; is_current: boolean; storage_path: string | null; original_name_ciphertext: string | null; content_hash: string | null; byte_size: number | null; mime_type: string | null; note_ciphertext: string | null; uploaded_at: string; }

const signFiles = async (rows: FileRow[]) => {
  const paths = rows.map((row) => row.storage_path).filter((path): path is string => Boolean(path));
  const signed = paths.length ? await db.storage.from(FILE_BUCKET).createSignedUrls(paths, 600) : { data: [], error: null };
  if (signed.error) throw signed.error;
  const urls = new Map<string, string>();
  (signed.data ?? []).forEach((item) => { if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl); });
  return { urls, paths };
};

const serialize = async (collection: CollectionRow, userId: string) => {
  if (collection.owner_id !== userId) throw new HttpError(403, '이 자료 수합을 관리할 권한이 없습니다.');
  const targetsResult = await db.from('data_collection_targets').select('*').eq('collection_id', collection.id).order('row_number');
  if (targetsResult.error) throw targetsResult.error;
  const filesResult = await db.from('data_collection_files').select('*').eq('collection_id', collection.id).order('uploaded_at');
  if (filesResult.error) throw filesResult.error;
  const targets = targetsResult.data as TargetRow[];
  const files = filesResult.data as FileRow[];
  const signed = await signFiles(files);
  const sourceUrl = collection.template_path ? await db.storage.from(COLLECTION_TEMPLATE_BUCKET).createSignedUrl(collection.template_path, 600) : { data: null, error: null };
  if (sourceUrl.error) throw sourceUrl.error;
  const sourceName = collection.template_name_ciphertext ? await dataCollectCrypto.decryptPayload<string>(collection.template_name_ciphertext) : '';
  return {
    id: collection.id, ownerId: collection.owner_id, publicToken: collection.public_token, title: collection.title,
    description: collection.description, kind: collection.kind, status: collection.status, allowResubmit: collection.allow_resubmit,
    dueAt: collection.due_at ?? '', passwordHash: collection.password_digest ? 'configured' : '', retentionMonths: collection.retention_months,
    sourceFile: collection.template_path ? { originalName: sourceName, mimeType: collection.template_mime ?? 'application/octet-stream', byteSize: collection.template_size ?? 0, dataUrl: sourceUrl.data?.signedUrl ?? '' } : undefined,
    targets: await Promise.all(targets.map(async (target) => {
      const identity = await dataCollectCrypto.decryptPayload<DataCollectIdentity>(target.label_ciphertext);
      return { id: target.id, rowNumber: target.row_number, label: identity.label, owner: identity.owner, personalToken: target.personal_token };
    })),
    submissions: await Promise.all(files.map(async (file) => ({ id: file.id, targetId: file.target_id ?? '', revision: file.revision, decision: file.response_kind, note: file.note_ciphertext ? await dataCollectCrypto.decryptPayload<string>(file.note_ciphertext) : '', uploadedAt: file.uploaded_at, file: file.storage_path ? { originalName: file.original_name_ciphertext ? await dataCollectCrypto.decryptPayload<string>(file.original_name_ciphertext) : '제출 파일', mimeType: file.mime_type ?? 'application/octet-stream', byteSize: file.byte_size ?? 0, dataUrl: signed.urls.get(file.storage_path) ?? '' } : undefined }))),
    createdAt: collection.created_at, updatedAt: collection.updated_at,
  };
};

const readCollection = async (id: string, userId: string) => {
  if (!uuidPattern.test(id)) throw new HttpError(400, '자료 수합 식별자가 올바르지 않습니다.');
  const result = await db.from('data_collections').select('*').eq('id', id).maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new HttpError(404, '자료 수합을 찾을 수 없습니다.');
  return serialize(result.data as CollectionRow, userId);
};

const readTargets = (body: Record<string, unknown>) => {
  if (!Array.isArray(body.targets) || body.targets.length < 1 || body.targets.length > 2_000) throw new HttpError(422, '제출 대상은 1명 이상 2000명 이하로 입력해 주세요.');
  const seen = new Set<string>();
  return body.targets.map((entry, index) => {
    const row = entry as Record<string, unknown>;
    const label = readString(row.label, 120);
    const owner = readString(row.owner, 120);
    if (!label) throw new HttpError(422, `${index + 1}번 제출 대상을 입력해 주세요.`);
    const key = `${normalize(label)}\u0000${normalize(owner)}`;
    if (seen.has(key)) throw new HttpError(422, '같은 제출 대상과 담당자를 중복할 수 없습니다.');
    seen.add(key);
    return { label, owner };
  });
};

const listAllNames = async (bucket: string, prefix: string): Promise<string[]> => {
  const names: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const result = await db.storage.from(bucket).list(prefix, { limit: 1000, offset });
    if (result.error) throw result.error;
    const entries = result.data ?? [];
    for (const entry of entries) {
      const child = `${prefix}/${entry.name}`.replace(/^\//, '');
      if (entry.id) names.push(child);
      else names.push(...await listAllNames(bucket, child));
    }
    if (entries.length < 1000) return names;
  }
};
const removeAll = async (bucket: string, prefix: string) => {
  const names = await listAllNames(bucket, prefix);
  for (let index = 0; index < names.length; index += 100) {
    const result = await db.storage.from(bucket).remove(names.slice(index, index + 100));
    if (result.error) throw result.error;
  }
  const remaining = await listAllNames(bucket, prefix);
  if (remaining.length) throw new Error('파일을 실제로 지우지 못했습니다.');
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = readString(body.action, 40);
    const { userId, caller } = await requireUser(request);
    if (action === 'create-upload-url') {
      const path = readString(body.path, 1000);
      ensurePath(path, userId);
      const result = await db.storage.from(COLLECTION_TEMPLATE_BUCKET).createSignedUploadUrl(path);
      if (result.error) throw result.error;
      return json(200, { path, token: result.data.token });
    }
    if (action === 'create') {
      if (!dataCollectCrypto.isConfigured()) throw new HttpError(503, '자료 수합 암호화 키가 설정되지 않아 만들 수 없습니다.');
      const title = readString(body.title, 200);
      const description = readString(body.description, 4000);
      const kind = readString(body.kind, 20);
      const mode = readString(body.mode, 20) || 'fixed';
      const targets = mode === 'fixed' ? readTargets(body) : [];
      if (!title || !allowedKinds.has(kind) || !['fixed', 'custom'].includes(mode)) throw new HttpError(422, '자료 수합 기본 정보를 확인해 주세요.');
      const id = typeof body.id === 'string' && uuidPattern.test(body.id) ? body.id : crypto.randomUUID();
      const templatePath = readString(body.templatePath, 1000) || null;
      if (templatePath) ensurePath(templatePath, userId, id);
      const inserted = await db.from('data_collections').insert({ id, owner_id: userId, title, description, kind, mode, allow_walk_in: Boolean(body.allowWalkIn), template_path: templatePath, template_name_ciphertext: templatePath ? await dataCollectCrypto.encryptPayload(readString(body.templateName, 500)) : null, template_size: templatePath ? Number(body.templateSize) || null : null, template_mime: templatePath ? readString(body.templateMime, 200) : null, due_at: readString(body.dueAt, 80) || null, allow_resubmit: body.allowResubmit !== false, retention_months: Math.max(1, Math.min(120, Number(body.retentionMonths) || 12)) }).select('id').single();
      if (inserted.error) throw inserted.error;
      try {
        if (targets.length) {
          const rows = await Promise.all(targets.map(async (target, index) => ({ collection_id: id, row_number: index + 1, label_ciphertext: await dataCollectCrypto.encryptPayload({ label: target.label, owner: target.owner } satisfies DataCollectIdentity), owner_ciphertext: await dataCollectCrypto.encryptPayload({ label: target.label, owner: target.owner } satisfies DataCollectIdentity), label_search: await searchHashes(target.label), owner_search: await searchHashes(target.owner), display_label: mask(target.label), display_owner: mask(target.owner) })));
          const added = await db.from('data_collection_targets').insert(rows);
          if (added.error) throw added.error;
        }
        if (typeof body.password === 'string' && body.password.trim()) {
          const password = await caller.rpc('set_data_collection_password', { p_collection_id: id, p_password: body.password.trim() });
          if (password.error) throw password.error;
        }
      } catch (error) {
        await removeAll(COLLECTION_TEMPLATE_BUCKET, `${userId}/${id}`);
        await db.from('data_collections').delete().eq('id', id);
        throw error;
      }
      return json(200, await readCollection(id, userId));
    }
    const id = readString(body.id, 80);
    if (action === 'list') {
      const result = await db.from('data_collections').select('*').eq('owner_id', userId).order('updated_at', { ascending: false });
      if (result.error) throw result.error;
      return json(200, { collections: await Promise.all((result.data as CollectionRow[]).map((row) => serialize(row, userId))) });
    }
    if (action === 'get') return json(200, { collection: await readCollection(id, userId) });
    if (action === 'status') {
      if (!['open', 'closed'].includes(readString(body.status, 20))) throw new HttpError(422, '수합 상태가 올바르지 않습니다.');
      const result = await db.from('data_collections').update({ status: body.status }).eq('id', id).eq('owner_id', userId);
      if (result.error) throw result.error;
      return json(200, { collection: await readCollection(id, userId) });
    }
    if (action === 'delete') {
      const row = await db.from('data_collections').select('id').eq('id', id).eq('owner_id', userId).maybeSingle();
      if (row.error) throw row.error;
      if (!row.data) throw new HttpError(404, '자료 수합을 찾을 수 없습니다.');
      await removeAll(COLLECTION_TEMPLATE_BUCKET, `${userId}/${id}`);
      await removeAll(FILE_BUCKET, `${userId}/${id}`);
      const deleted = await db.from('data_collections').delete().eq('id', id).eq('owner_id', userId);
      if (deleted.error) throw deleted.error;
      return json(200, { deleted: true });
    }
    throw new HttpError(400, '지원하지 않는 요청입니다.');
  } catch (error) {
    if (error instanceof HttpError) return json(error.status, { error: error.message });
    console.error(error);
    return json(500, { error: '자료 수합 관리 요청을 처리하지 못했습니다.' });
  }
});
