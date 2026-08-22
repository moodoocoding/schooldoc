import { createClient } from 'npm:@supabase/supabase-js@2.110.8';
import { dataCollectCrypto } from '../_shared/dataCollectCrypto.ts';
import { dataCollectSubmissionTargetPrefix } from '../_shared/dataCollectStoragePaths.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } });
class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }

const url = Deno.env.get('SUPABASE_URL');
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY');
if (!url || !key) throw new Error('Supabase service environment is not configured.');
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FILE_BUCKET = 'data-collect-files';
const TEMPLATE_BUCKET = 'data-collect-templates';
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const allowedExtensions = new Set(['hwp', 'hwpx', 'docx', 'xlsx', 'pdf', 'png', 'jpg', 'jpeg']);

interface CollectionRow { id: string; public_token: string; title: string; description: string; kind: string; mode: 'fixed' | 'custom'; allow_walk_in: boolean; template_path: string | null; template_name_ciphertext: string | null; template_size: number | null; template_mime: string | null; status: 'open' | 'closed'; due_at: string | null; password_digest: string | null; allow_resubmit: boolean; }
interface TargetRow { id: string; collection_id: string; display_label: string; display_owner: string; label_search: string[]; owner_search: string[]; personal_token: string; }
const readString = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const hash = async (value: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};
const normalize = (value: string) => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ko-KR');
const searchPrefix = (value: string) => normalize(value).replaceAll(' ', '');
const rateLimit = async (request: Request, token: string, action: string) => {
  const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
  const result = await db.rpc('consume_data_collect_rate_limit', { p_request_key: await hash(`${ip}:${token}:${action}`), p_window_seconds: 60, p_max_requests: action === 'submit' ? 8 : 40 });
  if (result.error) throw result.error;
  if (!result.data) throw new HttpError(429, '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.');
};
const getCollection = async (token: string) => {
  if (!uuidPattern.test(token)) throw new HttpError(400, '요청 주소가 올바르지 않습니다.');
  const result = await db.from('data_collections').select('*').eq('public_token', token).maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new HttpError(404, '자료 수합을 찾을 수 없습니다.');
  return result.data as CollectionRow;
};
const getTarget = async (collectionId: string, targetToken: string) => {
  if (!uuidPattern.test(targetToken)) throw new HttpError(404, '제출 대상을 찾을 수 없습니다.');
  const result = await db.from('data_collection_targets').select('*').eq('collection_id', collectionId).eq('personal_token', targetToken).maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new HttpError(404, '제출 대상을 찾을 수 없습니다.');
  return result.data as TargetRow;
};
const createWalkInTarget = async (collectionId: string, name: string) => {
  const latest = await db.from('data_collection_targets').select('row_number').eq('collection_id', collectionId).order('row_number', { ascending: false }).limit(1).maybeSingle();
  if (latest.error) throw latest.error;
  const identity = { label: name, owner: '' };
  const inserted = await db.from('data_collection_targets').insert({
    collection_id: collectionId,
    row_number: Number(latest.data?.row_number ?? 0) + 1,
    label_ciphertext: await dataCollectCrypto.encryptPayload(identity),
    owner_ciphertext: await dataCollectCrypto.encryptPayload(identity),
    label_search: [await dataCollectCrypto.nameLookup(searchPrefix(name))],
    owner_search: [],
    display_label: name.length > 3 ? `${name[0]}○${name.at(-1)}` : `${name[0]}${name.length > 1 ? '○' : ''}`,
    display_owner: '',
  }).select('*').single();
  if (inserted.error) throw inserted.error;
  return inserted.data as TargetRow;
};
const isClosed = (collection: CollectionRow) => collection.status === 'closed' || Boolean(collection.due_at && new Date(collection.due_at).getTime() < Date.now());
const ensureOpen = (collection: CollectionRow) => {
  if (isClosed(collection)) throw new HttpError(410, '자료 수합이 종료되었습니다.');
};
const verifyPassword = async (collection: CollectionRow, password: unknown) => {
  if (!collection.password_digest) return;
  if (typeof password !== 'string' || password.length > 200) throw new HttpError(401, '비밀번호가 맞지 않습니다.');
  const result = await db.rpc('verify_data_collection_password', { p_collection_id: collection.id, p_password: password });
  if (result.error) throw result.error;
  if (!result.data) throw new HttpError(401, '비밀번호가 맞지 않습니다.');
};
const metadataSummary = (collection: CollectionRow) => ({
  accessGranted: false,
  title: collection.title,
  status: collection.status,
  dueAt: collection.due_at ?? '',
  passwordRequired: Boolean(collection.password_digest),
});
const authorizedMetadata = async (collection: CollectionRow) => {
  let template: Record<string, unknown> | null = null;
  if (collection.template_path) {
    const signed = await db.storage.from(TEMPLATE_BUCKET).createSignedUrl(collection.template_path, 300);
    if (signed.error) throw signed.error;
    template = { name: collection.template_name_ciphertext ? await dataCollectCrypto.decryptPayload<string>(collection.template_name_ciphertext) : '배포 파일', size: collection.template_size ?? 0, mimeType: collection.template_mime ?? 'application/octet-stream', url: signed.data?.signedUrl ?? '' };
  }
  return { accessGranted: true, title: collection.title, description: collection.description, kind: collection.kind, mode: collection.mode, status: collection.status, dueAt: collection.due_at ?? '', passwordRequired: Boolean(collection.password_digest), allowResubmit: collection.allow_resubmit, hasTemplate: Boolean(collection.template_path), template };
};

const extensionOf = (name: string) => name.toLowerCase().split('.').pop() ?? '';
const validMagic = (extension: string, bytes: Uint8Array) => {
  const starts = (values: number[]) => values.every((value, index) => bytes[index] === value);
  if (extension === 'pdf') return starts([0x25, 0x50, 0x44, 0x46]);
  if (extension === 'png') return starts([0x89, 0x50, 0x4e, 0x47]);
  if (extension === 'jpg' || extension === 'jpeg') return starts([0xff, 0xd8, 0xff]);
  if (extension === 'hwp') return starts([0xd0, 0xcf, 0x11, 0xe0]);
  return starts([0x50, 0x4b, 0x03, 0x04]);
};
const validateUploaded = async (path: string, name: string) => {
  const extension = extensionOf(name);
  if (!allowedExtensions.has(extension)) throw new HttpError(400, '허용되지 않은 파일 형식입니다.');
  const downloaded = await db.storage.from(FILE_BUCKET).download(path);
  if (downloaded.error) throw new HttpError(400, '제출 파일을 읽지 못했습니다.');
  if (downloaded.data.size === 0 || downloaded.data.size > MAX_FILE_SIZE) throw new HttpError(400, '파일은 50MB보다 작아야 합니다.');
  const bytes = new Uint8Array(await downloaded.data.slice(0, 8).arrayBuffer());
  if (!validMagic(extension, bytes)) throw new HttpError(400, '파일 확장자와 실제 파일 형식이 일치하지 않습니다.');
  const digest = await crypto.subtle.digest('SHA-256', await downloaded.data.arrayBuffer());
  return { byteSize: downloaded.data.size, mimeType: downloaded.data.type || 'application/octet-stream', contentHash: Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('') };
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json(405, { error: '허용되지 않은 요청입니다.' });
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = readString(body.action, 40);
    const token = readString(body.token, 80);
    if (!['metadata', 'search', 'prepare-upload', 'submit'].includes(action)) throw new HttpError(400, '지원하지 않는 요청입니다.');
    await rateLimit(request, token, action);
    const collection = await getCollection(token);
    if (action === 'metadata') {
      // 종료된 수합과 비밀번호 검증 전 응답에는 signed URL을 만들거나 포함하지 않는다.
      if (isClosed(collection)) return json(200, { collection: metadataSummary(collection) });
      const passwordWasSubmitted = Object.prototype.hasOwnProperty.call(body, 'password');
      if (collection.password_digest && !passwordWasSubmitted) return json(200, { collection: metadataSummary(collection) });
      await verifyPassword(collection, body.password);
      return json(200, { collection: await authorizedMetadata(collection) });
    }
    ensureOpen(collection);
    await verifyPassword(collection, body.password);
    if (!dataCollectCrypto.isConfigured()) throw new HttpError(503, '서버 준비가 끝나지 않았습니다. 잠시 후 다시 시도해 주세요.');

    const personalToken = readString(body.personalToken, 80);
    if (action === 'search') {
      if (collection.mode === 'custom') throw new HttpError(422, '이 자료 수합은 제출할 때 이름을 직접 입력합니다.');
      let rows: TargetRow[];
      if (personalToken) {
        rows = [await getTarget(collection.id, personalToken)];
      } else {
        const listed = await db.from('data_collection_targets').select('id, collection_id, display_label, display_owner, label_search, owner_search, personal_token').eq('collection_id', collection.id).limit(2000);
        if (listed.error) throw listed.error;
        rows = (listed.data ?? []) as TargetRow[];
      }
      if (personalToken) return json(200, { targets: rows.map((row) => ({ token: row.personal_token, label: row.display_label, owner: row.display_owner })) });
      const query = searchPrefix(readString(body.query, 120));
      if (query.length < 2) throw new HttpError(422, '두 글자 이상 입력해 주세요.');
      const needle = await dataCollectCrypto.nameLookup(query);
      const matches = rows.filter((row) => row.label_search.includes(needle) || row.owner_search.includes(needle)).slice(0, 10);
      return json(200, { targets: matches.map((row) => ({ token: row.personal_token, label: row.display_label, owner: row.display_owner })) });
    }

    if (action === 'prepare-upload') {
      const name = readString(body.fileName, 500);
      if (!name || !allowedExtensions.has(extensionOf(name))) throw new HttpError(400, '허용되지 않은 파일 형식입니다.');
      if (collection.mode === 'custom' && !readString(body.respondentName, 120)) throw new HttpError(422, '제출자 이름을 입력해 주세요.');
      const target = collection.mode === 'fixed' || personalToken ? await getTarget(collection.id, personalToken) : null;
      const path = `${dataCollectSubmissionTargetPrefix(collection.id, target?.id ?? 'walk-in')}/${crypto.randomUUID()}-${name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const signed = await db.storage.from(FILE_BUCKET).createSignedUploadUrl(path);
      if (signed.error) throw signed.error;
      return json(200, { path, token: signed.data.token });
    }

    const decision = readString(body.decision, 20);
    if (!['confirmed', 'corrected', 'submitted'].includes(decision)) throw new HttpError(422, '회신 방법을 선택해 주세요.');
    const respondentName = readString(body.respondentName, 120);
    let target = collection.mode === 'fixed' ? await getTarget(collection.id, personalToken) : null;
    const storagePath = readString(body.storagePath, 1000);
    const originalName = readString(body.fileName, 500);
    if (collection.mode === 'custom') {
      if (!respondentName) throw new HttpError(422, '제출자 이름을 입력해 주세요.');
      if (personalToken) {
        target = await getTarget(collection.id, personalToken);
      } else if (decision !== 'confirmed' && (!storagePath || !originalName || !storagePath.startsWith(`${dataCollectSubmissionTargetPrefix(collection.id, 'walk-in')}/`))) {
        throw new HttpError(400, '제출 파일이 없습니다.');
      }
      target ??= await createWalkInTarget(collection.id, respondentName);
    }
    if (!target) throw new HttpError(404, '제출 대상을 찾을 수 없습니다.');
    const history = await db.from('data_collection_files').select('revision').eq('collection_id', collection.id).eq('target_id', target.id).order('revision', { ascending: false }).limit(1).maybeSingle();
    if (history.error) throw history.error;
    if (history.data && !collection.allow_resubmit) throw new HttpError(409, '이미 제출한 자료입니다. 담당자에게 문의해 주세요.');
    const revision = Number(history.data?.revision ?? 0) + 1;
    if (decision !== 'confirmed') {
      const expectedPrefix = `${dataCollectSubmissionTargetPrefix(collection.id, collection.mode === 'custom' && !personalToken ? 'walk-in' : target.id)}/`;
      if (!storagePath || !originalName || !storagePath.startsWith(expectedPrefix)) throw new HttpError(400, '제출 파일이 없습니다.');
      const info = await validateUploaded(storagePath, originalName);
      await db.from('data_collection_files').update({ is_current: false }).eq('collection_id', collection.id).eq('target_id', target.id);
      const inserted = await db.from('data_collection_files').insert({ collection_id: collection.id, target_id: target.id, response_kind: decision, revision, is_current: true, storage_path: storagePath, original_name_ciphertext: await dataCollectCrypto.encryptPayload(originalName), content_hash: info.contentHash, byte_size: info.byteSize, mime_type: info.mimeType, note_ciphertext: body.note ? await dataCollectCrypto.encryptPayload(readString(body.note, 4000)) : null });
      if (inserted.error) { await db.storage.from(FILE_BUCKET).remove([storagePath]); throw inserted.error; }
    } else {
      await db.from('data_collection_files').update({ is_current: false }).eq('collection_id', collection.id).eq('target_id', target.id);
      const inserted = await db.from('data_collection_files').insert({ collection_id: collection.id, target_id: target.id, response_kind: 'confirmed', revision, is_current: true, note_ciphertext: body.note ? await dataCollectCrypto.encryptPayload(readString(body.note, 4000)) : null });
      if (inserted.error) throw inserted.error;
    }
    await db.from('data_collection_targets').update({ submitted_at: new Date().toISOString(), status: decision }).eq('id', target.id);
    return json(200, { submitted: true, revision, decision, personalToken: collection.mode === 'custom' ? target.personal_token : undefined });
  } catch (error) {
    if (error instanceof HttpError) return json(error.status, { error: error.message });
    console.error(error);
    return json(500, { error: '자료 수합 요청을 처리하지 못했습니다.' });
  }
});
