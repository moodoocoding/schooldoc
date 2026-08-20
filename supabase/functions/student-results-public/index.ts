import { createClient } from 'npm:@supabase/supabase-js@2.110.8';
import { decryptStudentPayload, encryptStudentPayload, studentNameLookup } from '../_shared/studentResultsCrypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

class HttpError extends Error {
  constructor(public status: number, message: string) {
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
  metadata: 60,
  authenticate: 10,
  personal: 20,
  session: 60,
  confirm: 10,
  dispute: 10,
};

interface EventRow {
  id: string;
  public_token: string;
  title: string;
  description: string;
  status: 'open' | 'closed';
  allow_confirmation: boolean;
  allow_dispute: boolean;
}

interface RecipientRow {
  id: string;
  event_id: string;
  identity_ciphertext: string;
  result_ciphertext: string;
  status: 'unviewed' | 'viewed' | 'confirmed' | 'disputed' | 'reconfirm';
  viewed_at: string | null;
  confirmed_at: string | null;
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
  const requestKey = await hashText(`${ip}:${scope}:${action}`);
  const { data, error } = await db.rpc('consume_student_result_rate_limit', {
    p_request_key: requestKey,
    p_window_seconds: 60,
    p_max_requests: actionLimits[action] ?? 10,
  });
  if (error) throw error;
  if (!data) throw new HttpError(429, '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.');
};

const getEvent = async (publicToken: string) => {
  const { data, error } = await db
    .from('student_result_events')
    .select('id, public_token, title, description, status, allow_confirmation, allow_dispute')
    .eq('public_token', publicToken)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, '결과 안내를 찾을 수 없습니다.');
  return data as EventRow;
};

const getEventById = async (eventId: string) => {
  const { data, error } = await db
    .from('student_result_events')
    .select('id, public_token, title, description, status, allow_confirmation, allow_dispute')
    .eq('id', eventId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, '결과 안내를 찾을 수 없습니다.');
  return data as EventRow;
};

const getRecipient = async (eventId: string, recipientId: string) => {
  const { data, error } = await db
    .from('student_result_recipients')
    .select('id, event_id, identity_ciphertext, result_ciphertext, status, viewed_at, confirmed_at')
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
    .select('id, label, max_score, description, position')
    .eq('event_id', eventId)
    .order('position');
  if (error) throw error;
  return (data ?? []).map((column) => ({
    id: column.id,
    label: column.label,
    maxScore: Number(column.max_score),
    description: column.description,
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
    .select('id, event_id, identity_ciphertext, result_ciphertext, status, viewed_at, confirmed_at')
    .maybeSingle();
  if (error) throw error;
  return (data as RecipientRow | null) ?? { ...recipient, status: 'viewed', viewed_at: viewedAt };
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

const buildResult = async (event: EventRow, rawRecipient: RecipientRow) => {
  const recipient = await markViewed(rawRecipient);
  const [columns, dispute, identity, protectedResult] = await Promise.all([
    getColumns(event.id),
    getDispute(recipient.id),
    decryptStudentPayload<IdentityPayload>(recipient.identity_ciphertext),
    decryptStudentPayload<ResultPayload>(recipient.result_ciphertext),
  ]);
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
      dispute,
    },
  };
};

const issueSession = async (eventId: string, recipientId: string) => {
  const { data, error } = await db
    .from('student_result_public_sessions')
    .insert({ event_id: eventId, recipient_id: recipientId })
    .select('token')
    .single();
  if (error) throw error;
  return data.token as string;
};

const resolveSession = async (sessionToken: unknown) => {
  if (typeof sessionToken !== 'string' || !uuidPattern.test(sessionToken)) {
    throw new HttpError(401, '학생 인증이 만료되었습니다. 다시 확인해 주세요.');
  }
  const { data, error } = await db
    .from('student_result_public_sessions')
    .select('event_id, recipient_id, expires_at')
    .eq('token', sessionToken)
    .maybeSingle();
  if (error) throw error;
  if (!data || new Date(data.expires_at).getTime() <= Date.now()) {
    if (data) await db.from('student_result_public_sessions').delete().eq('token', sessionToken);
    throw new HttpError(401, '학생 인증이 만료되었습니다. 다시 확인해 주세요.');
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
    if (!uuidPattern.test(scope)) throw new HttpError(400, '요청 형식이 올바르지 않습니다.');
    await consumeRateLimit(request, action, scope);

    if (action === 'metadata') {
      const event = await getEvent(publicToken);
      return respond(200, {
        event: { title: event.title, description: event.description, status: event.status },
      });
    }

    if (action === 'authenticate') {
      const event = await getEvent(publicToken);
      if (event.status !== 'open') throw new HttpError(409, '결과 안내가 종료되었습니다.');
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const verificationCode = typeof body.verificationCode === 'string' ? body.verificationCode.trim() : '';
      if (!name || name.length > 100 || !verificationCode || verificationCode.length > 100) {
        throw new HttpError(400, '성명과 확인번호를 확인해 주세요.');
      }
      const nameLookup = await studentNameLookup(name);
      const { data: candidates, error: candidateError } = await db
        .from('student_result_recipients')
        .select('id')
        .eq('event_id', event.id)
        .eq('name_lookup', nameLookup)
        .limit(20);
      if (candidateError) throw candidateError;

      // 맞는 사람을 찾자마자 멈추지 않고 끝까지 센다. 동명이인이 같은 확인번호를 쓰면
      // 먼저 걸린 사람의 성적이 열리는데, 그것은 남의 성적을 보여주는 일이다.
      const matched: string[] = [];
      for (const candidate of candidates ?? []) {
        const { data: valid, error: verifyError } = await db.rpc('verify_student_result_code', {
          p_recipient_id: candidate.id,
          p_code: verificationCode,
        });
        if (verifyError) throw verifyError;
        if (valid) matched.push(candidate.id);
      }
      if (matched.length === 0) throw new HttpError(401, '성명 또는 확인번호가 맞지 않습니다.');
      if (matched.length > 1) {
        throw new HttpError(409, '같은 성명과 확인번호를 가진 학생이 둘 이상입니다. 담당 선생님께 확인번호를 다시 받아 주세요.');
      }
      const recipientId = matched[0];
      const recipient = await getRecipient(event.id, recipientId);
      const issuedSession = await issueSession(event.id, recipient.id);
      return respond(200, { sessionToken: issuedSession, result: await buildResult(event, recipient) });
    }

    if (action === 'personal') {
      const event = await getEvent(publicToken);
      if (event.status !== 'open') throw new HttpError(409, '결과 안내가 종료되었습니다.');
      const personalToken = typeof body.personalToken === 'string' ? body.personalToken : '';
      if (!uuidPattern.test(personalToken)) throw new HttpError(401, '개인 조회 링크가 올바르지 않습니다.');
      const { data, error } = await db
        .from('student_result_recipients')
        .select('id, event_id, identity_ciphertext, result_ciphertext, status, viewed_at, confirmed_at')
        .eq('event_id', event.id)
        .eq('personal_token', personalToken)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new HttpError(401, '개인 조회 링크가 올바르지 않습니다.');
      const recipient = data as RecipientRow;
      const issuedSession = await issueSession(event.id, recipient.id);
      return respond(200, { sessionToken: issuedSession, result: await buildResult(event, recipient) });
    }

    const session = await resolveSession(sessionToken);
    const event = await getEventById(session.eventId);
    if (event.status !== 'open') throw new HttpError(409, '결과 안내가 종료되었습니다.');
    const recipient = await getRecipient(event.id, session.recipientId);

    if (action === 'session') {
      return respond(200, { sessionToken, result: await buildResult(event, recipient) });
    }

    if (action === 'confirm') {
      if (!event.allow_confirmation) throw new HttpError(403, '결과 확인 기능이 열려 있지 않습니다.');
      const confirmedAt = new Date().toISOString();
      const { error } = await db
        .from('student_result_recipients')
        .update({ status: 'confirmed', confirmed_at: confirmedAt })
        .eq('id', recipient.id)
        .eq('event_id', event.id);
      if (error) throw error;
      return respond(200, {
        sessionToken,
        result: await buildResult(event, { ...recipient, status: 'confirmed', confirmed_at: confirmedAt }),
      });
    }

    if (action === 'dispute') {
      if (!event.allow_dispute) throw new HttpError(403, '이의 제기 기능이 열려 있지 않습니다.');
      const message = typeof body.message === 'string' ? body.message.trim() : '';
      if (!message || message.length > 1000) throw new HttpError(400, '이의 내용을 1,000자 이내로 입력해 주세요.');
      const submittedAt = new Date().toISOString();
      const { error: disputeError } = await db.from('student_result_disputes').upsert({
        event_id: event.id,
        recipient_id: recipient.id,
        message: null,
        message_ciphertext: await encryptStudentPayload(message),
        submitted_at: submittedAt,
        teacher_reply: null,
        reply_ciphertext: null,
        replied_at: null,
      }, { onConflict: 'recipient_id' });
      if (disputeError) throw disputeError;
      const { error: recipientError } = await db
        .from('student_result_recipients')
        .update({ status: 'disputed', confirmed_at: null })
        .eq('id', recipient.id)
        .eq('event_id', event.id);
      if (recipientError) throw recipientError;
      return respond(200, {
        sessionToken,
        result: await buildResult(event, { ...recipient, status: 'disputed', confirmed_at: null }),
      });
    }

    throw new HttpError(400, '지원하지 않는 요청입니다.');
  } catch (error) {
    if (error instanceof HttpError) return respond(error.status, { error: error.message });
    console.error('student-results-public failed', error);
    return respond(500, { error: '결과 안내 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
  }
});
