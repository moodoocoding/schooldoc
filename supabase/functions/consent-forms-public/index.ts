import { createClient } from 'npm:@supabase/supabase-js@2.110.8';
import { consentCrypto, type ConsentRecipientIdentity } from '../_shared/consentCrypto.ts';

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
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY');
if (!url || !key) throw new Error('Supabase service environment is not configured.');
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface FormRow {
  id: string; title: string; description: string; source_path: string; fields: Array<Record<string, unknown>>;
  deadline: string | null; password_digest: string | null; allow_resubmission: boolean; status: 'open' | 'closed';
  page_count: number;
  page_sizes: Array<{ width: number; height: number }> | null;
}

const DOCUMENT_PREPARING = '가정통신문을 준비하고 있습니다. 잠시 후 자동으로 열립니다.';
const notFound = (error: { message?: string; statusCode?: string | number } | null) => {
  if (!error) return false;
  const status = String(error.statusCode ?? '');
  return status === '404' || /not[_\s]?found/i.test(error.message ?? '');
};

const hash = async (value: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};
const rateLimit = async (request: Request, token: string, action: string) => {
  const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
  const result = await db.rpc('consume_consent_rate_limit', { p_request_key: await hash(`${ip}:${token}:${action}`), p_window_seconds: 60, p_max_requests: action === 'submit' ? 8 : 40 });
  if (result.error) throw result.error;
  if (!result.data) throw new HttpError(429, '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.');
};
const getForm = async (token: string) => {
  const result = await db.from('consent_forms').select('id,title,description,source_path,fields,page_count,page_sizes,deadline,password_digest,allow_resubmission,status').eq('public_token', token).maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new HttpError(404, '가정통신문을 찾을 수 없습니다.');
  return result.data as FormRow;
};
const ensureOpen = (form: FormRow) => {
  if (form.status === 'closed' || (form.deadline && form.deadline < new Date().toISOString().slice(0, 10))) throw new HttpError(410, '응답이 종료되었습니다.');
};
const verifyPassword = async (form: FormRow, password: unknown) => {
  if (!form.password_digest) return;
  if (typeof password !== 'string' || password.length > 200) throw new HttpError(401, '비밀번호가 맞지 않습니다.');
  const result = await db.rpc('verify_consent_form_password', { p_form_id: form.id, p_password: password });
  if (result.error) throw result.error;
  if (!result.data) throw new HttpError(401, '비밀번호가 맞지 않습니다.');
};
interface RecipientRow {
  id: string; form_id: string; identity_ciphertext: string; display_hint: string;
  response_id: string | null; submitted_at: string | null;
}

/** 개인 링크로 들어온 경우에만 수신자를 찾는다. 공용 링크는 지금까지처럼 익명으로 받는다. */
const getRecipient = async (form: FormRow, value: unknown) => {
  if (typeof value !== 'string' || !uuidPattern.test(value)) return null;
  const result = await db.from('consent_recipients')
    .select('id, form_id, identity_ciphertext, display_hint, response_id, submitted_at')
    .eq('token', value).maybeSingle();
  if (result.error) throw result.error;
  const recipient = result.data as RecipientRow | null;
  if (!recipient || recipient.form_id !== form.id) throw new HttpError(404, '이 링크의 수신자를 찾을 수 없습니다.');
  return recipient;
};

const recipientName = async (recipient: RecipientRow) => {
  if (!consentCrypto.isConfigured()) return recipient.display_hint;
  const identity = await consentCrypto.decryptPayload<ConsentRecipientIdentity>(recipient.identity_ciphertext);
  return identity.name;
};

const metadata = (form: FormRow) => ({ title: form.title, description: form.description, passwordRequired: Boolean(form.password_digest), status: form.status, deadline: form.deadline ?? '' });
const validateFields = (form: FormRow) => {
  if (!Array.isArray(form.fields) || form.fields.length > 200) throw new HttpError(422, '응답 필드 설정을 확인해 주세요.');
  const ids = new Set<string>();
  for (const field of form.fields) {
    const id = typeof field.id === 'string' ? field.id : '';
    const kind = typeof field.kind === 'string' ? field.kind : '';
    const label = typeof field.label === 'string' ? field.label.trim() : '';
    const pageIndex = typeof field.pageIndex === 'number' ? field.pageIndex : -1;
    const values = [field.x, field.y, field.width, field.height];
    if (!id || ids.has(id) || !['text', 'checkbox', 'date', 'signature'].includes(kind)) throw new HttpError(422, '응답 필드 설정을 확인해 주세요.');
    if (!label || label.length > 80 || !Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= form.page_count) throw new HttpError(422, '응답 필드 설정을 확인해 주세요.');
    if (!values.every((value) => typeof value === 'number' && Number.isFinite(value))) throw new HttpError(422, '응답 필드 좌표를 확인해 주세요.');
    const [x, y, width, height] = values as number[];
    if (x < 0 || y < 0 || width < 10 || height < 4 || x + width > 100 || y + height > 100) throw new HttpError(422, '응답 필드 좌표를 확인해 주세요.');
    ids.add(id);
  }
};

const parseSignature = (value: string) => {
  if (value.length > 800_000) throw new HttpError(400, '서명 이미지가 너무 큽니다.');
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match) throw new HttpError(400, '서명 이미지 형식이 올바르지 않습니다.');
  const bytes = Uint8Array.from(atob(match[2]), (character) => character.charCodeAt(0));
  if (bytes.length > 512_000) throw new HttpError(400, '서명 이미지는 500KB 이하만 제출할 수 있습니다.');
  return { bytes, extension: match[1] === 'jpeg' ? 'jpg' : match[1], contentType: `image/${match[1]}` };
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json(405, { error: '허용되지 않은 요청입니다.' });
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = typeof body.action === 'string' ? body.action : '';
    const token = typeof body.token === 'string' ? body.token : '';
    if (!['metadata', 'document', 'submit'].includes(action) || !uuidPattern.test(token)) throw new HttpError(400, '요청 형식이 올바르지 않습니다.');
    await rateLimit(request, token, action);
    const form = await getForm(token);
    const recipient = await getRecipient(form, body.recipientToken);
    if (action === 'metadata') {
      return json(200, { form: { ...metadata(form), recipientHint: recipient?.display_hint ?? '', recipientSubmitted: Boolean(recipient?.submitted_at) } });
    }
    ensureOpen(form);
    validateFields(form);
    await verifyPassword(form, body.password);
    if (action === 'document') {
      const signed = await db.storage.from('consent-documents').createSignedUrl(form.source_path, 60 * 60);
      // 원본이 아직 올라오지 않은 상태는 실패가 아니라 준비 중이다.
      // 425를 받은 화면은 오류 대신 준비 안내를 띄우고 스스로 다시 시도한다.
      if (signed.error && notFound(signed.error)) throw new HttpError(425, DOCUMENT_PREPARING);
      if (signed.error || !signed.data?.signedUrl) throw new HttpError(500, '원본 PDF를 불러오지 못했습니다.');
      return json(200, { form: { ...metadata(form), fields: form.fields, sourceUrl: signed.data.signedUrl, allowResubmission: form.allow_resubmission, pageCount: form.page_count, pageSizes: form.page_sizes?.length ? form.page_sizes : Array.from({ length: form.page_count }, () => ({ width: 210, height: 297 })), recipientName: recipient ? await recipientName(recipient) : '', recipientSubmitted: Boolean(recipient?.submitted_at) } });
    }

    if (!body.values || typeof body.values !== 'object' || Array.isArray(body.values)) throw new HttpError(400, '응답 형식이 올바르지 않습니다.');
    const submitted = body.values as Record<string, unknown>;
    const cleanValues: Record<string, string> = {};
    const signatures: Array<{ fieldId: string; data: ReturnType<typeof parseSignature> }> = [];
    for (const field of form.fields) {
      const id = typeof field.id === 'string' ? field.id : '';
      const kind = typeof field.kind === 'string' ? field.kind : '';
      const label = typeof field.label === 'string' ? field.label : '필수 항목';
      const value = submitted[id];
      if (field.required && (typeof value !== 'string' || !value)) throw new HttpError(400, `${label} 항목을 입력해 주세요.`);
      if (value === undefined || value === '') continue;
      if (typeof value !== 'string') throw new HttpError(400, '응답 값 형식이 올바르지 않습니다.');
      if (kind === 'signature') signatures.push({ fieldId: id, data: parseSignature(value) });
      else {
        if (value.length > 5000) throw new HttpError(400, `${label} 항목이 너무 깁니다.`);
        cleanValues[id] = value;
      }
    }
    if (recipient?.submitted_at && !form.allow_resubmission) throw new HttpError(409, '이미 제출한 가정통신문입니다. 담당자에게 문의해 주세요.');

    const responseId = crypto.randomUUID();
    const inserted = await db.from('consent_responses').insert({ id: responseId, form_id: form.id, values: cleanValues, recipient_id: recipient?.id ?? null });
    if (inserted.error) throw inserted.error;
    const uploaded: string[] = [];
    try {
      for (const signature of signatures) {
        const path = `${form.id}/${responseId}/${signature.fieldId}.${signature.data.extension}`;
        const result = await db.storage.from('consent-signatures').upload(path, signature.data.bytes, { contentType: signature.data.contentType });
        if (result.error) throw result.error;
        uploaded.push(path);
        const row = await db.from('consent_response_signatures').insert({ response_id: responseId, field_id: signature.fieldId, storage_path: path });
        if (row.error) throw row.error;
      }
      if (recipient) {
        const linked = await db.from('consent_recipients')
          .update({ response_id: responseId, submitted_at: new Date().toISOString() }).eq('id', recipient.id);
        if (linked.error) throw linked.error;
      }
      const count = await db.rpc('increment_consent_response_count', { p_form_id: form.id });
      if (count.error) throw count.error;
    } catch (error) {
      if (uploaded.length) await db.storage.from('consent-signatures').remove(uploaded);
      await db.from('consent_responses').delete().eq('id', responseId);
      throw error;
    }
    return json(200, { submitted: true });
  } catch (error) {
    if (error instanceof HttpError) return json(error.status, { error: error.message });
    console.error(error);
    return json(500, { error: '가정통신문 요청을 처리하지 못했습니다.' });
  }
});
