import { consentResponseError, type QuestionField } from '../_shared/consentQuestions.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.110.8';
import { consentCrypto, type ConsentRecipientIdentity } from '../_shared/consentCrypto.ts';
import { ConsentHttpError as HttpError, dbResult, uuidPattern, validateConsentFields, responseDetails, recordCleanup } from '../_shared/consentServer.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
});


const url = Deno.env.get('SUPABASE_URL');
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY');
if (!url || !key) throw new Error('Supabase service environment is not configured.');
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });


interface FormRow {
  id: string; owner_id: string; publication_state: string; document_revision: number; title: string; description: string; source_path: string; fields: Array<Record<string, unknown>>;
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
const getContext = async (token: string, value: unknown) => {
  if (value !== undefined && value !== null && value !== '' && (typeof value !== 'string' || !uuidPattern.test(value)))
    throw new HttpError(400, '개인 링크 형식이 올바르지 않습니다. 담당자에게 링크를 다시 요청해 주세요.');
  return dbResult(await db.rpc('consent_public_context', { p_token: token, p_recipient_token: value || null })) as { form: FormRow; recipient: RecipientRow | null };
};
const ensureOpen = (form: FormRow) => {
  if (form.publication_state === 'preparing') throw new HttpError(425, DOCUMENT_PREPARING);
  if (form.publication_state === 'purging') throw new HttpError(410, '응답이 종료되었습니다.');
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

const recipientName = async (recipient: RecipientRow) => {
  if (!consentCrypto.isConfigured()) return recipient.display_hint;
  const identity = await consentCrypto.decryptPayload<ConsentRecipientIdentity>(recipient.identity_ciphertext);
  return identity.name;
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

export const consentPublicHandler = async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json(405, { error: '허용되지 않은 요청입니다.' });
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = typeof body.action === 'string' ? body.action : '';
    const token = typeof body.token === 'string' ? body.token : '';
    if (!['open', 'metadata', 'document', 'submit'].includes(action) || !uuidPattern.test(token)) throw new HttpError(400, '요청 형식이 올바르지 않습니다.');
    await rateLimit(request, token, action);
    const { form, recipient } = await getContext(token, body.recipientToken);
    if (action === 'metadata' || (action === 'open' && Boolean(form.password_digest))) {
      return json(200, { form: { ...metadata(form), recipientHint: recipient?.display_hint ?? '', recipientSubmitted: Boolean(recipient?.submitted_at) } });
    }
    if (action !== 'submit') ensureOpen(form);
    validateConsentFields(form.fields, form.page_count);
    await verifyPassword(form, body.password);
    if (action === 'document' || action === 'open') {
      const signed = await db.storage.from('consent-documents').createSignedUrl(form.source_path, 60 * 60);
      // 원본이 아직 올라오지 않은 상태는 실패가 아니라 준비 중이다.
      // 425를 받은 화면은 오류 대신 준비 안내를 띄우고 스스로 다시 시도한다.
      if (signed.error && notFound(signed.error)) throw new HttpError(425, DOCUMENT_PREPARING);
      if (signed.error || !signed.data?.signedUrl) throw new HttpError(500, '원본 PDF를 불러오지 못했습니다.');
      const previous = recipient?.response_id ? (await responseDetails(db, dbResult(await db.from('consent_responses').select('id,values_ciphertext,submitted_at,recipient_id').eq('id', recipient.response_id).eq('form_id',form.id)) ?? []))[0] : null;
      return json(200, { form: { ...metadata(form), documentRevision: form.document_revision, previousValues: previous?.values ?? {}, previousResponseId: previous?.id ?? null, fields: form.fields, sourceUrl: signed.data.signedUrl, allowResubmission: form.allow_resubmission, pageCount: form.page_count, pageSizes: form.page_sizes?.length ? form.page_sizes : Array.from({ length: form.page_count }, () => ({ width: 210, height: 297 })), recipientName: recipient ? await recipientName(recipient) : '', recipientSubmitted: Boolean(recipient?.submitted_at) } });
    }

    if (!body.values || typeof body.values !== 'object' || Array.isArray(body.values)) throw new HttpError(400, '응답 형식이 올바르지 않습니다.');
    const submitted = body.values as Record<string, unknown>;
    const reuse = Array.isArray(body.reuseSignatureFields) ? body.reuseSignatureFields : [];
    if (reuse.some(id => typeof id !== 'string' || !form.fields.some(f => f.id === id && f.kind === 'signature'))) throw new HttpError(400, '서명 형식이 올바르지 않습니다.');
    if(body.expectedResponseId!==undefined && body.expectedResponseId!==null && (typeof body.expectedResponseId!=='string' || !uuidPattern.test(body.expectedResponseId))) throw new HttpError(400,'이전 응답을 확인해 주세요.');
    const previousSignatures = recipient?.response_id
      ? dbResult(await db.from('consent_response_signatures').select('field_id,storage_path').eq('response_id',typeof body.expectedResponseId==='string'?body.expectedResponseId:recipient.response_id)) ?? [] : [];
    const cleanValues: Record<string, string> = {};
    const signatures: Array<{ fieldId: string; data?: ReturnType<typeof parseSignature>; path?: string }> = [];
    const validated = { ...submitted };
    for (const field of form.fields) {
      const id = String(field.id); const value = submitted[id];
      if (field.kind === 'signature' && reuse.includes(id)) {
        const previous = previousSignatures.find(s => s.field_id === id);
        if (!previous) throw new HttpError(409, '이전 서명을 확인하지 못했습니다. 문서를 다시 열어 주세요.');
        signatures.push({ fieldId:id, path:previous.storage_path }); validated[id] = 'previous-signature';
      } else if (value !== undefined && value !== '') {
        if (typeof value !== 'string' || value.length > (field.kind === 'signature' ? 800000 : 5000)) throw new HttpError(400, '응답 값 형식이나 길이를 확인해 주세요.');
        if (field.kind === 'signature') signatures.push({ fieldId:id, data:parseSignature(value) });
        else cleanValues[id] = value;
      }
    }
    const issue = consentResponseError(form.fields as unknown as QuestionField[], validated);
    if (issue) throw new HttpError(400, issue);
    if (typeof body.requestId !== 'string' || !uuidPattern.test(body.requestId) || !Number.isInteger(body.documentRevision))
      throw new HttpError(400, '화면을 새로 열고 다시 제출해 주세요.');
    const requestDigest = await hash(JSON.stringify([Object.entries(cleanValues).sort(), signatures.map(s => [s.fieldId,s.path ?? submitted[s.fieldId]]).sort(),body.documentRevision,body.expectedResponseId ?? null]));
    // 재시도는 기존 커밋을 먼저 확인한다. 서명을 다시 업로드하지 않는다.
    const existing = dbResult(await db.from('consent_responses').select('id,request_digest,recipient_id,submitted_at').eq('form_id',form.id).eq('request_id',body.requestId).maybeSingle());
    if (existing) {
      if (existing.request_digest !== requestDigest || (existing.recipient_id ?? null) !== (recipient?.id ?? null)) throw new HttpError(409, '다른 응답에 사용된 요청입니다.');
      return json(200,{submitted:true,responseId:existing.id,replayed:true});
    }
    const responseId = crypto.randomUUID();
    // 응답 본문은 평문으로 남기지 않는다. 복호는 소유자를 확인한 관리 함수만 한다.
    if (!consentCrypto.isConfigured()) throw new HttpError(503, '서버 준비가 끝나지 않았습니다. 잠시 후 다시 시도해 주세요.');
    const uploaded: string[] = [];
    try {
      const signatureRows = [];
      for (const signature of signatures) {
        if (signature.data) {
          const path = `${form.id}/${responseId}/${signature.fieldId}.${signature.data.extension}`;
          dbResult(await db.storage.from('consent-signatures').upload(path, signature.data.bytes, { contentType: signature.data.contentType }));
          uploaded.push(path); signatureRows.push({field_id:signature.fieldId,storage_path:path});
        } else signatureRows.push({field_id:signature.fieldId,storage_path:signature.path});
      }
      const committed = dbResult(await db.rpc('commit_consent_response', {
        p_token:token,p_recipient_token:body.recipientToken || null,p_response_id:responseId,p_request_id:body.requestId,
        p_request_digest:requestDigest,p_values_ciphertext:await consentCrypto.encryptPayload(cleanValues),p_signatures:signatureRows,
        p_document_revision:body.documentRevision,p_expected_response_id:body.expectedResponseId ?? null,
      }));
      // 동시 요청의 다른 쪽이 먼저 커밋했다면 이번 업로드는 쓰이지 않는다.
      if (committed.replayed && uploaded.length) {
        const removed = await db.storage.from('consent-signatures').remove(uploaded);
        if (removed.error) await recordCleanup(db,form.owner_id,form.id,'submission',uploaded);
      }
      return json(200,{submitted:true,responseId:committed.responseId,replayed:committed.replayed});
    } catch (error) {
      // DB 응답 유실 시 커밋 여부부터 확인한다. 확인 실패면 파일을 보존한다.
      const check = await db.from('consent_responses').select('id').eq('id',responseId).maybeSingle();
      if (uploaded.length && !check.error && !check.data) {
        const removed = await db.storage.from('consent-signatures').remove(uploaded);
        if (removed.error) await recordCleanup(db,form.owner_id,form.id,'submission',uploaded);
      } else if (uploaded.length && check.error) await recordCleanup(db,form.owner_id,form.id,'submission',uploaded);
      throw error;
    }

  } catch (error) {
    if (error instanceof HttpError) return json(error.status, { error: error.message });
    console.error('consent public request failed');
    return json(500, { error: '가정통신문 요청을 처리하지 못했습니다.' });
  }
};
if (import.meta.main) Deno.serve(consentPublicHandler);
