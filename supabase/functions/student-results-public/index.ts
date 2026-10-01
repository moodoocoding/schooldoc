import { createClient } from 'npm:@supabase/supabase-js@2.110.8';
import { decryptStudentPayload, encryptStudentPayload, studentNameLookup } from '../_shared/studentResultsCrypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

const respond = (status: number, body: Record<string, unknown>) => new Response(
  JSON.stringify(body),
  { status, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } },
);

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY');
if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase service environment is not configured.');

const db = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const actionLimits: Record<string, number> = {
  metadata: 120,
  authenticate: 60,
  personal: 60,
  session: 60,
  confirm: 10,
  dispute: 10,
  logout: 10,
};

interface EventRow {
  id: string;
  public_token: string;
  title: string;
  description: string;
  status: 'open' | 'closed';
  allow_confirmation: boolean;
  allow_dispute: boolean;
  updated_at: string;
}

interface RecipientRow {
  id: string;
  event_id: string;
  identity_ciphertext: string;
  result_ciphertext: string;
  status: 'unviewed' | 'viewed' | 'confirmed' | 'disputed' | 'reconfirm' | 'replied';
  viewed_at: string | null;
  confirmed_at: string | null;
  updated_at: string;
}

interface IdentityPayload { studentKey: string; name: string; verificationCode: string }
interface ResultPayload { values: Record<string, number>; feedback: string }

const hashText = async (value: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const consumeRateLimit = async (request: Request, action: string, scope: string) => {
  const ip = request.headers.get('cf-connecting-ip')
    ?? request.headers.get('x-real-ip')
    ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? 'unknown';
  // The classroom action quotas and the IP/token totals use separate buckets.
  // Failed and successful requests count toward totals; credential guesses retain
  // their separate event/name-HMAC failure quota in the authentication transaction.
  await consumeRateLimitBucket('student-results:ip:' + ip, 1200);
  await consumeRateLimitBucket('student-results:token:' + scope, 600);
  await consumeRateLimitBucket(ip + ':' + scope + ':' + action, actionLimits[action] ?? 10);
};

const consumeRateLimitBucket = async (scope: string, maxRequests: number) => {
  const { data, error } = await db.rpc('consume_student_result_rate_limit', {
    p_request_key: await hashText(scope),
    p_window_seconds: 60,
    p_max_requests: maxRequests,
  });
  if (error) throw error;
  if (data !== true) throw new HttpError(429, '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.', 'RATE_LIMITED');
};

const getEvent = async (publicToken: string) => {
  const { data, error } = await db
    .from('student_result_events')
    .select('id, public_token, title, description, status, allow_confirmation, allow_dispute, updated_at')
    .eq('public_token', publicToken)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, '결과 안내를 찾을 수 없습니다.');
  return data as EventRow;
};

const getEventById = async (eventId: string) => {
  const { data, error } = await db
    .from('student_result_events')
    .select('id, public_token, title, description, status, allow_confirmation, allow_dispute, updated_at')
    .eq('id', eventId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, '결과 안내를 찾을 수 없습니다.');
  return data as EventRow;
};

const getRecipient = async (eventId: string, recipientId: string) => {
  const { data, error } = await db
    .from('student_result_recipients')
    .select('id, event_id, identity_ciphertext, result_ciphertext, status, viewed_at, confirmed_at, updated_at')
    .eq('event_id', eventId)
    .eq('id', recipientId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, '학생 결과를 찾을 수 없습니다.');
  return data as RecipientRow;
};

const getColumns = async (eventId: string) => {
  const { data, error } = await db
    .from('student_result_columns')
    .select('id, label, max_score, description, kind, position')
    .eq('event_id', eventId)
    .order('position');
  if (error) throw error;
  return (data ?? []).map((column) => ({
    id: column.id,
    label: column.label,
    maxScore: Number(column.max_score),
    description: column.description,
    kind: column.kind ?? undefined,
  }));
};

const markViewed = async (recipient: RecipientRow) => {
  if (recipient.status !== 'unviewed') return recipient;
  const viewedAt = new Date().toISOString();
  const { data, error } = await db
    .from('student_result_recipients')
    .update({ status: 'viewed', viewed_at: viewedAt })
    .eq('id', recipient.id)
    .eq('event_id', recipient.event_id)
    .eq('status', 'unviewed')
    .select('id, event_id, identity_ciphertext, result_ciphertext, status, viewed_at, confirmed_at, updated_at')
    .maybeSingle();
  if (error) throw error;
  return (data as RecipientRow | null) ?? await getRecipient(recipient.event_id, recipient.id);
};

const getDispute = async (recipientId: string) => {
  const { data, error } = await db
    .from('student_result_disputes')
    .select('message_ciphertext, submitted_at, reply_ciphertext, replied_at')
    .eq('recipient_id', recipientId)
    .maybeSingle();
  if (error) throw error;
  return data ? {
    message: await decryptStudentPayload<string>(data.message_ciphertext),
    submittedAt: data.submitted_at,
    teacherReply: data.reply_ciphertext ? await decryptStudentPayload<string>(data.reply_ciphertext) : undefined,
    repliedAt: data.replied_at ?? undefined,
  } : undefined;
};

const buildResult = async (initialEvent: EventRow, rawRecipient: RecipientRow, sessionToken: string) => {
  // Do not combine an old title/description with a newly corrected student version.
  for (let attempt = 0; attempt < 3; attempt++) {
    const event = await getEventById(initialEvent.id);
    if (event.status !== 'open') throw new HttpError(409, '결과 안내가 종료되었습니다.', 'EVENT_CLOSED');
    const recipient = await markViewed(await getRecipient(event.id, rawRecipient.id));
    const [columns, dispute, identity, protectedResult] = await Promise.all([
      getColumns(event.id),
      getDispute(recipient.id),
      decryptStudentPayload<IdentityPayload>(recipient.identity_ciphertext),
      decryptStudentPayload<ResultPayload>(recipient.result_ciphertext),
    ]);
    const [latestEvent, latestRecipient] = await Promise.all([getEventById(event.id), getRecipient(event.id, recipient.id)]);
    if (latestEvent.updated_at !== event.updated_at || latestRecipient.updated_at !== recipient.updated_at) continue;
    const latestSession = await resolveSession(sessionToken);
    if (latestSession.eventId !== event.id || latestSession.recipientId !== recipient.id) {
      throw new HttpError(401, '학생 인증이 만료되었습니다. 다시 확인해 주세요.', 'SESSION_EXPIRED');
    }
    return {
      event: {
        id: event.id,
        publicToken: event.public_token,
        title: event.title,
        description: event.description,
        status: event.status,
        allowConfirmation: event.allow_confirmation,
        allowDispute: event.allow_dispute,
        columns,
      },
      recipient: {
        id: recipient.id,
        studentKey: identity.studentKey,
        name: identity.name,
        values: protectedResult.values ?? {},
        feedback: protectedResult.feedback,
        status: recipient.status,
        viewedAt: recipient.viewed_at ?? undefined,
        confirmedAt: recipient.confirmed_at ?? undefined,
        updatedAt: recipient.updated_at,
        dispute,
      },
    };
  }
  throw new HttpError(409, '결과가 변경되었습니다. 최신 결과를 확인한 뒤 다시 진행해 주세요.', 'RESULT_CHANGED');
};

const requireRpcSuccess = (code: unknown) => {
  if (code === 'OK') return;
  const errors: Record<string, [number, string]> = {
    SESSION_EXPIRED: [401, '학생 인증이 만료되었습니다. 다시 확인해 주세요.'],
    EVENT_CLOSED: [409, '결과 안내가 종료되었습니다.'],
    EVENT_NOT_FOUND: [404, '결과 안내를 찾을 수 없습니다.'],
    PERSONAL_LINK_INVALID: [401, '개인 조회 링크가 올바르지 않습니다.'],
    AUTH_INVALID: [401, '성명 또는 확인번호가 맞지 않습니다.'],
    AUTH_AMBIGUOUS: [409, '같은 성명과 확인번호를 가진 학생이 둘 이상입니다. 담당 선생님께 확인번호를 다시 받아 주세요.'],
    RATE_LIMITED: [429, '확인번호를 여러 번 틀렸습니다. 1분 뒤 다시 시도해 주세요.'],
    CONFIRM_DISABLED: [403, '결과 확인 기능이 열려 있지 않습니다.'],
    DISPUTE_DISABLED: [403, '이의 제기 기능이 열려 있지 않습니다.'],
    DISPUTE_PENDING: [409, '제출한 이의에 대한 답변을 기다려 주세요.'],
    RESULT_CHANGED: [409, '결과가 변경되었습니다. 최신 결과를 확인한 뒤 다시 진행해 주세요.'],
    INVALID_INPUT: [400, '입력 내용을 확인해 주세요.'],
  };
  const detail = typeof code === 'string' ? errors[code] : undefined;
  if (!detail) throw new Error('Unexpected student result transaction response.');
  throw new HttpError(detail[0], detail[1], code as string);
};

const buildAuthenticationResponse = async (event: EventRow, data: unknown) => {
  const authentication = data as { code?: unknown; recipientId?: unknown; sessionToken?: unknown } | null;
  requireRpcSuccess(authentication?.code);
  if (typeof authentication?.recipientId !== 'string' || !uuidPattern.test(authentication.recipientId)
    || typeof authentication.sessionToken !== 'string' || !uuidPattern.test(authentication.sessionToken)) {
    throw new Error('Invalid student result session response.');
  }
  return respond(200, {
    sessionToken: authentication.sessionToken,
    result: await buildResult(event, await getRecipient(event.id, authentication.recipientId), authentication.sessionToken),
  });
};

const resolveSession = async (sessionToken: unknown) => {
  if (typeof sessionToken !== 'string' || !uuidPattern.test(sessionToken)) {
    throw new HttpError(401, '학생 인증이 만료되었습니다. 다시 확인해 주세요.', 'SESSION_EXPIRED');
  }
  const { data, error } = await db
    .from('student_result_public_sessions')
    .select('event_id, recipient_id, expires_at')
    .eq('token', sessionToken)
    .maybeSingle();
  if (error) throw error;
  if (!data || new Date(data.expires_at).getTime() <= Date.now()) {
    if (data) await db.from('student_result_public_sessions').delete().eq('token', sessionToken);
    throw new HttpError(401, '학생 인증이 만료되었습니다. 다시 확인해 주세요.', 'SESSION_EXPIRED');
  }
  return { eventId: data.event_id as string, recipientId: data.recipient_id as string };
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return respond(405, { error: '허용되지 않은 요청입니다.' });

  try {
    const body = await request.json() as Record<string, unknown>;
    const action = typeof body.action === 'string' ? body.action : '';
    if (!Object.hasOwn(actionLimits, action)) throw new HttpError(400, '요청 형식이 올바르지 않습니다.');

    const publicToken = typeof body.token === 'string' ? body.token : '';
    const sessionToken = typeof body.sessionToken === 'string' ? body.sessionToken : '';
    const scope = publicToken || sessionToken;
    if (!uuidPattern.test(scope)) {
      if (['session', 'confirm', 'dispute', 'logout'].includes(action)) {
        throw new HttpError(401, '학생 인증이 만료되었습니다. 다시 확인해 주세요.', 'SESSION_EXPIRED');
      }
      throw new HttpError(400, '요청 형식이 올바르지 않습니다.');
    }
    await consumeRateLimit(request, action, scope);

    if (action === 'metadata') {
      const event = await getEvent(publicToken);
      return respond(200, {
        event: { title: event.title, description: event.description, status: event.status },
      });
    }

    if (action === 'authenticate') {
      const event = await getEvent(publicToken);
      if (event.status !== 'open') throw new HttpError(409, '결과 안내가 종료되었습니다.', 'EVENT_CLOSED');
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const verificationCode = typeof body.verificationCode === 'string' ? body.verificationCode.trim() : '';
      if (!name || name.length > 100 || !verificationCode || verificationCode.length > 100) {
        throw new HttpError(400, '성명과 확인번호를 확인해 주세요.');
      }
      const { data, error } = await db.rpc('authenticate_student_result_session', {
        p_event_id: event.id,
        p_name_lookup: await studentNameLookup(name),
        p_code: verificationCode,
      });
      if (error) throw error;
      return await buildAuthenticationResponse(event, data);
    }

    if (action === 'personal') {
      const event = await getEvent(publicToken);
      if (event.status !== 'open') throw new HttpError(409, '결과 안내가 종료되었습니다.', 'EVENT_CLOSED');
      const personalToken = typeof body.personalToken === 'string' ? body.personalToken : '';
      if (!uuidPattern.test(personalToken)) throw new HttpError(401, '개인 조회 링크가 올바르지 않습니다.', 'PERSONAL_LINK_INVALID');
      const { data, error } = await db.rpc('open_student_result_personal_session', {
        p_event_id: event.id, p_personal_token: personalToken,
      });
      if (error) throw error;
      return await buildAuthenticationResponse(event, data);
    }

    const session = await resolveSession(sessionToken);
    if (action === 'logout') {
      const { error } = await db.from('student_result_public_sessions').delete().eq('token', sessionToken);
      if (error) throw error;
      return respond(200, { ok: true });
    }
    const event = await getEventById(session.eventId);
    if (event.status !== 'open') throw new HttpError(409, '결과 안내가 종료되었습니다.', 'EVENT_CLOSED');
    const recipient = await getRecipient(event.id, session.recipientId);

    if (action === 'session') {
      return respond(200, { sessionToken, result: await buildResult(event, recipient, sessionToken) });
    }

    if (action === 'confirm') {
      const expectedUpdatedAt = typeof body.expectedUpdatedAt === 'string' ? body.expectedUpdatedAt : '';
      if (!expectedUpdatedAt || !Number.isFinite(Date.parse(expectedUpdatedAt))) {
        throw new HttpError(409, '최신 결과를 확인한 뒤 다시 진행해 주세요.', 'RESULT_CHANGED');
      }
      const { data, error } = await db.rpc('confirm_student_result', {
        p_session_token: sessionToken, p_expected_updated_at: expectedUpdatedAt,
      });
      if (error) throw error;
      requireRpcSuccess(data);
      return respond(200, {
        sessionToken, result: await buildResult(await getEventById(event.id), await getRecipient(event.id, recipient.id), sessionToken),
      });
    }

    if (action === 'dispute') {
      if (!event.allow_dispute) throw new HttpError(403, '이의 제기 기능이 열려 있지 않습니다.', 'DISPUTE_DISABLED');
      const message = typeof body.message === 'string' ? body.message.trim() : '';
      if (!message || message.length > 1000) throw new HttpError(400, '이의 내용을 1,000자 이내로 입력해 주세요.');
      const { data, error } = await db.rpc('submit_student_result_dispute', {
        p_session_token: sessionToken, p_message_ciphertext: await encryptStudentPayload(message),
      });
      if (error) throw error;
      requireRpcSuccess(data);
      return respond(200, {
        sessionToken, result: await buildResult(await getEventById(event.id), await getRecipient(event.id, recipient.id), sessionToken),
      });
    }

    throw new HttpError(400, '지원하지 않는 요청입니다.');
  } catch (error) {
    if (error instanceof HttpError) return respond(error.status, { error: error.message, ...(error.code ? { code: error.code } : {}) });
    console.error('student-results-public failed', error);
    return respond(500, { error: '결과 안내 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
  }
});
