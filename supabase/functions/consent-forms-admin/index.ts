import { createClient } from 'npm:@supabase/supabase-js@2.110.8';
import { consentCrypto, type ConsentRecipientIdentity } from '../_shared/consentCrypto.ts';

/**
 * 교사 전용 관리 창구.
 * 평문 이름이 브라우저와 DB 사이를 오가지 않도록 암복호를 여기서만 처리하고,
 * 파기는 브라우저가 중간에 닫혀도 끝나도록 서버에서 수행한다.
 * 모든 요청은 호출자가 해당 수합의 소유자인지 먼저 확인한다.
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
});
class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }

const url = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY');
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
if (!url || !serviceKey) throw new Error('Supabase service environment is not configured.');
const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const DOCUMENT_BUCKET = 'consent-documents';
const SIGNATURE_BUCKET = 'consent-signatures';
const STORAGE_PAGE = 1000;
const REMOVE_CHUNK = 100;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** 인증 전 화면에 쓸 가림 이름. 김태호 → 김○○ */
const maskName = (name: string) => {
  const trimmed = name.trim();
  if (trimmed.length <= 1) return trimmed;
  return `${trimmed[0]}${'○'.repeat(Math.min(trimmed.length - 1, 3))}`;
};

const requireUser = async (request: Request) => {
  const authorization = request.headers.get('Authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) throw new HttpError(401, '로그인이 필요합니다.');
  if (!anonKey) throw new HttpError(500, 'Supabase anon key is not configured.');
  const caller = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data, error } = await caller.auth.getUser();
  if (error || !data.user) throw new HttpError(401, '로그인 정보를 확인하지 못했습니다.');
  return data.user.id;
};

const requireOwnedForm = async (formId: string, userId: string) => {
  const form = await db.from('consent_forms')
    .select('id, owner_id, title, source_path, response_count').eq('id', formId).maybeSingle();
  if (form.error) throw form.error;
  if (!form.data || form.data.owner_id !== userId) throw new HttpError(403, '이 가정통신문을 관리할 권한이 없습니다.');
  return form.data as { id: string; title: string; source_path: string; response_count: number };
};

const readRecipients = (body: Record<string, unknown>) => {
  if (!Array.isArray(body.recipients)) throw new HttpError(400, '명단 형식이 올바르지 않습니다.');
  if (body.recipients.length > 2_000) throw new HttpError(422, '명단은 한 번에 2000명까지 저장할 수 있습니다.');
  return body.recipients.map((entry) => {
    const item = entry as Record<string, unknown>;
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    const studentKey = typeof item.studentKey === 'string' ? item.studentKey.trim() : '';
    if (!name || name.length > 60) throw new HttpError(422, '수신자 이름을 확인해 주세요.');
    if (studentKey.length > 60) throw new HttpError(422, '수신자 식별값을 확인해 주세요.');
    return { name, studentKey };
  });
};

/** Storage list는 한 번에 일부만 돌려주므로 끝까지 넘긴다. */
const listAllNames = async (bucket: string, prefix: string) => {
  const names: string[] = [];
  for (let offset = 0; ; offset += STORAGE_PAGE) {
    const page = await db.storage.from(bucket).list(prefix, { limit: STORAGE_PAGE, offset });
    if (page.error) throw page.error;
    const entries = page.data ?? [];
    entries.forEach((entry) => names.push(entry.name));
    if (entries.length < STORAGE_PAGE) return names;
  }
};

const listSignaturePaths = async (formId: string) => {
  const paths: string[] = [];
  for (const folder of await listAllNames(SIGNATURE_BUCKET, formId)) {
    for (const file of await listAllNames(SIGNATURE_BUCKET, `${formId}/${folder}`)) {
      paths.push(`${formId}/${folder}/${file}`);
    }
  }
  return paths;
};

/**
 * 파일을 먼저 지우고 실제로 지워졌는지 확인한 뒤에만 행을 지운다.
 * 삭제 정책이 consent_forms 행을 참조하므로, 행을 먼저 지우면 남은 파일을 두 번 다시 못 지운다.
 */
const purgeForm = async (formId: string, userId: string) => {
  const form = await requireOwnedForm(formId, userId);

  const signaturePaths = await listSignaturePaths(formId);
  for (let index = 0; index < signaturePaths.length; index += REMOVE_CHUNK) {
    const removed = await db.storage.from(SIGNATURE_BUCKET).remove(signaturePaths.slice(index, index + REMOVE_CHUNK));
    if (removed.error) throw removed.error;
  }
  if (signaturePaths.length) {
    const remaining = await listSignaturePaths(formId);
    if (remaining.length) throw new Error('서명 이미지를 지우지 못해 수합을 남겨 두었습니다.');
  }

  if (form.source_path) {
    const removed = await db.storage.from(DOCUMENT_BUCKET).remove([form.source_path]);
    if (removed.error) throw removed.error;
  }

  const deleted = await db.from('consent_forms').delete().eq('id', formId);
  if (deleted.error) throw deleted.error;

  const logged = await db.from('consent_purge_log').insert({
    owner_id: userId,
    form_title: form.title.slice(0, 200),
    response_count: form.response_count,
    signature_count: signaturePaths.length,
  });
  // 기록 실패가 파기 자체를 되돌리지는 못한다. 남기지 못했다는 사실만 알린다.
  if (logged.error) console.error('purge log failed', logged.error);

  return { id: formId, title: form.title, responseCount: form.response_count, signatureCount: signaturePaths.length };
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = typeof body.action === 'string' ? body.action : '';
    const userId = await requireUser(request);

    // 파기는 암호화 키 없이도 수행돼야 한다. 명단이 없는 수합도 지울 수 있어야 하기 때문이다.
    if (action === 'purge') {
      const ids = Array.isArray(body.formIds) ? body.formIds : [];
      if (!ids.length) throw new HttpError(400, '지울 대상을 선택해 주세요.');
      if (ids.length > 200) throw new HttpError(422, '한 번에 200개까지 지울 수 있습니다.');

      const purged = [];
      const failed = [];
      for (const value of ids) {
        const formId = typeof value === 'string' ? value : '';
        if (!uuidPattern.test(formId)) {
          failed.push({ id: String(value), error: '잘못된 대상입니다.' });
          continue;
        }
        try {
          purged.push(await purgeForm(formId, userId));
        } catch (error) {
          // 한 건이 실패해도 나머지는 계속 지운다. 실패한 건은 행이 남아 다시 시도할 수 있다.
          failed.push({ id: formId, error: error instanceof Error ? error.message : '지우지 못했습니다.' });
        }
      }
      return json(200, { purged, failed });
    }

    const formId = typeof body.formId === 'string' ? body.formId : '';
    if (!uuidPattern.test(formId)) throw new HttpError(400, '가정통신문을 찾을 수 없습니다.');
    if (!consentCrypto.isConfigured()) throw new HttpError(503, '수신자 명단 암호화 키가 설정되지 않아 명단 기능을 쓸 수 없습니다.');
    await requireOwnedForm(formId, userId);

    if (action === 'replace') {
      const recipients = readRecipients(body);
      const removed = await db.from('consent_recipients').delete().eq('form_id', formId).is('response_id', null);
      if (removed.error) throw removed.error;

      const rows = [];
      for (const recipient of recipients) {
        rows.push({
          form_id: formId,
          identity_ciphertext: await consentCrypto.encryptPayload(recipient satisfies ConsentRecipientIdentity),
          name_lookup: await consentCrypto.nameLookup(recipient.name),
          display_hint: maskName(recipient.name),
        });
      }
      if (rows.length) {
        const inserted = await db.from('consent_recipients').insert(rows);
        if (inserted.error) throw inserted.error;
      }
      const counted = await db.from('consent_forms').update({ recipient_count: rows.length }).eq('id', formId);
      if (counted.error) throw counted.error;
      return json(200, { saved: rows.length });
    }

    if (action === 'responses') {
      const result = await db.from('consent_responses')
        .select('id, values_ciphertext, submitted_at, recipient_id')
        .eq('form_id', formId).order('submitted_at', { ascending: true });
      if (result.error) throw result.error;

      const rows = result.data ?? [];
      const responses = [];
      for (const row of rows) {
        const values = await consentCrypto.decryptPayload<Record<string, string>>(row.values_ciphertext);
        responses.push({ id: row.id, submittedAt: row.submitted_at, values, recipientId: row.recipient_id });
      }

      // 서명은 비공개 버킷에 그대로 두고 짧은 열람 주소만 발급한다.
      const signatureRows = rows.length
        ? await db.from('consent_response_signatures').select('response_id, field_id, storage_path')
          .in('response_id', rows.map((row) => row.id))
        : { data: [], error: null };
      if (signatureRows.error) throw signatureRows.error;
      const signatures = signatureRows.data ?? [];
      if (signatures.length) {
        const signed = await db.storage.from(SIGNATURE_BUCKET)
          .createSignedUrls(signatures.map((signature) => signature.storage_path), 60 * 60);
        if (signed.error) throw signed.error;
        const urlByPath = new Map<string, string>();
        (signed.data ?? []).forEach((entry) => {
          if (entry.path && entry.signedUrl) urlByPath.set(entry.path, entry.signedUrl);
        });
        signatures.forEach((signature) => {
          const target = responses.find((response) => response.id === signature.response_id);
          const url = urlByPath.get(signature.storage_path);
          if (target && url) target.values[signature.field_id] = url;
        });
      }
      return json(200, { responses });
    }

    if (action === 'list') {
      const result = await db.from('consent_recipients')
        .select('id, token, identity_ciphertext, display_hint, response_id, submitted_at, created_at')
        .eq('form_id', formId).order('created_at', { ascending: true });
      if (result.error) throw result.error;
      const recipients = [];
      for (const row of result.data ?? []) {
        const identity = await consentCrypto.decryptPayload<ConsentRecipientIdentity>(row.identity_ciphertext);
        recipients.push({
          id: row.id,
          token: row.token,
          name: identity.name,
          studentKey: identity.studentKey,
          responseId: row.response_id,
          submittedAt: row.submitted_at,
        });
      }
      return json(200, { recipients });
    }

    throw new HttpError(400, '지원하지 않는 요청입니다.');
  } catch (error) {
    if (error instanceof HttpError) return json(error.status, { error: error.message });
    console.error(error);
    return json(500, { error: '수신자 명단 요청을 처리하지 못했습니다.' });
  }
});
