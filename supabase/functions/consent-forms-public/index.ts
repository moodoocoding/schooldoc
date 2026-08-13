import { createClient } from 'npm:@supabase/supabase-js@2.110.8';

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
}

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
  const result = await db.from('consent_forms').select('id,title,description,source_path,fields,page_count,deadline,password_digest,allow_resubmission,status').eq('public_token', token).maybeSingle();
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
const metadata = (form: FormRow) => ({ title: form.title, description: form.description, passwordRequired: Boolean(form.password_digest), status: form.status, deadline: form.deadline ?? '' });

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
    if (action === 'metadata') return json(200, { form: metadata(form) });
    ensureOpen(form);
    await verifyPassword(form, body.password);
    if (action === 'document') {
      const signed = await db.storage.from('consent-documents').createSignedUrl(form.source_path, 60 * 60);
      if (signed.error || !signed.data?.signedUrl) throw new HttpError(500, '원본 PDF를 불러오지 못했습니다.');
      return json(200, { form: { ...metadata(form), fields: form.fields, sourceUrl: signed.data.signedUrl, allowResubmission: form.allow_resubmission, pageCount: form.page_count } });
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
    const responseId = crypto.randomUUID();
    const inserted = await db.from('consent_responses').insert({ id: responseId, form_id: form.id, values: cleanValues });
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
