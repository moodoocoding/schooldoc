import { createClient } from 'npm:@supabase/supabase-js@2.110.8';
import { consentCrypto, type ConsentRecipientIdentity } from '../_shared/consentCrypto.ts';

/**
 * 교사 전용 수신자 관리 창구.
 * 평문 이름이 브라우저와 DB 사이를 오가지 않도록, 암호화와 복호화를 여기서만 처리한다.
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

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** 인증 전 화면에 쓸 가림 이름. 김태호 → 김○○ */
const maskName = (name: string) => {
  const trimmed = name.trim();
  if (trimmed.length <= 1) return trimmed;
  return `${trimmed[0]}${'○'.repeat(Math.min(trimmed.length - 1, 3))}`;
};

const requireOwner = async (request: Request, formId: string) => {
  const authorization = request.headers.get('Authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) throw new HttpError(401, '로그인이 필요합니다.');
  if (!anonKey) throw new HttpError(500, 'Supabase anon key is not configured.');
  const caller = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data, error } = await caller.auth.getUser();
  if (error || !data.user) throw new HttpError(401, '로그인 정보를 확인하지 못했습니다.');

  const form = await db.from('consent_forms').select('id, owner_id').eq('id', formId).maybeSingle();
  if (form.error) throw form.error;
  if (!form.data || form.data.owner_id !== data.user.id) throw new HttpError(403, '이 가정통신문을 관리할 권한이 없습니다.');
  return data.user.id;
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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = typeof body.action === 'string' ? body.action : '';
    const formId = typeof body.formId === 'string' ? body.formId : '';
    if (!uuidPattern.test(formId)) throw new HttpError(400, '가정통신문을 찾을 수 없습니다.');
    if (!consentCrypto.isConfigured()) throw new HttpError(503, '수신자 명단 암호화 키가 설정되지 않아 명단 기능을 쓸 수 없습니다.');
    await requireOwner(request, formId);

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
