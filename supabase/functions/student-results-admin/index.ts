import { createClient } from 'npm:@supabase/supabase-js@2.110.8';
import { decryptStudentPayload, encryptStudentPayload, studentNameLookup } from '../_shared/studentResultsCrypto.ts';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const respond = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } });
class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }

const url = Deno.env.get('SUPABASE_URL');
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY');
if (!url || !key) throw new Error('Supabase service environment is not configured.');
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

interface IdentityPayload { studentKey: string; name: string; verificationCode: string }
interface ResultPayload { values: Record<string, number>; feedback: string }

const authenticate = async (request: Request) => {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Google 로그인이 필요합니다.');
  return data.user.id;
};

const eventSelect = 'id, owner_id, public_token, title, description, status, allow_confirmation, allow_dispute, created_at, updated_at';
const getOwnedEvent = async (ownerId: string, eventId: string) => {
  const { data, error } = await db.from('student_result_events').select(eventSelect).eq('id', eventId).eq('owner_id', ownerId).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, '결과 안내를 찾을 수 없습니다.');
  return data;
};

const loadEvents = async (rows: Array<Record<string, unknown>>) => {
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id as string);
  const [columnsResult, recipientsResult, disputesResult] = await Promise.all([
    db.from('student_result_columns').select('event_id, id, label, max_score, description, position').in('event_id', ids),
    db.from('student_result_recipients').select('id, event_id, personal_token, identity_ciphertext, result_ciphertext, status, viewed_at, confirmed_at').in('event_id', ids),
    db.from('student_result_disputes').select('event_id, recipient_id, message_ciphertext, submitted_at, reply_ciphertext, replied_at').in('event_id', ids),
  ]);
  if (columnsResult.error) throw columnsResult.error;
  if (recipientsResult.error) throw recipientsResult.error;
  if (disputesResult.error) throw disputesResult.error;
  const disputes = new Map(await Promise.all((disputesResult.data ?? []).map(async (row) => [row.recipient_id, {
    message: await decryptStudentPayload<string>(row.message_ciphertext),
    submitted_at: row.submitted_at,
    teacher_reply: row.reply_ciphertext ? await decryptStudentPayload<string>(row.reply_ciphertext) : undefined,
    replied_at: row.replied_at,
  }] as const)));
  const recipients = await Promise.all((recipientsResult.data ?? []).map(async (row) => {
    const identity = await decryptStudentPayload<IdentityPayload>(row.identity_ciphertext);
    const result = await decryptStudentPayload<ResultPayload>(row.result_ciphertext);
    const dispute = disputes.get(row.id);
    return {
      id: row.id, eventId: row.event_id, studentKey: identity.studentKey, name: identity.name,
      verificationCode: identity.verificationCode, personalToken: row.personal_token,
      values: result.values, feedback: result.feedback, status: row.status,
      viewedAt: row.viewed_at ?? undefined, confirmedAt: row.confirmed_at ?? undefined,
      dispute: dispute ? { message: dispute.message, submittedAt: dispute.submitted_at, teacherReply: dispute.teacher_reply ?? undefined, repliedAt: dispute.replied_at ?? undefined } : undefined,
    };
  }));
  return rows.map((row) => ({
    id: row.id, ownerId: row.owner_id, publicToken: row.public_token, title: row.title, description: row.description,
    status: row.status, allowConfirmation: row.allow_confirmation, allowDispute: row.allow_dispute,
    columns: (columnsResult.data ?? []).filter((column) => column.event_id === row.id).sort((a, b) => a.position - b.position).map((column) => ({ id: column.id, label: column.label, maxScore: Number(column.max_score), description: column.description })),
    recipients: recipients.filter((recipient) => recipient.eventId === row.id).sort((a, b) => a.studentKey.localeCompare(b.studentKey, 'ko-KR', { numeric: true })).map(({ eventId: _eventId, ...recipient }) => recipient),
    createdAt: row.created_at, updatedAt: row.updated_at,
  }));
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return respond(405, { error: '허용되지 않은 요청입니다.' });
  try {
    const ownerId = await authenticate(request);
    const body = await request.json() as Record<string, unknown>;
    const action = body.action;
    if (action === 'list') {
      const { data, error } = await db.from('student_result_events').select(eventSelect).eq('owner_id', ownerId).order('updated_at', { ascending: false });
      if (error) throw error;
      return respond(200, { events: await loadEvents(data ?? []) });
    }
    const eventId = typeof body.eventId === 'string' ? body.eventId : '';
    if (action === 'get') return respond(200, { event: (await loadEvents([await getOwnedEvent(ownerId, eventId)]))[0] });
    if (action === 'create') {
      const draft = body.draft as Record<string, unknown>;
      const columns = Array.isArray(draft.columns) ? draft.columns as Array<Record<string, unknown>> : [];
      const recipients = Array.isArray(draft.recipients) ? draft.recipients as Array<Record<string, unknown>> : [];
      if (!String(draft.title ?? '').trim() || !columns.length || !recipients.length) throw new HttpError(400, '결과 안내 입력값을 확인해 주세요.');
      const { data: created, error } = await db.from('student_result_events').insert({ owner_id: ownerId, title: String(draft.title).trim(), description: String(draft.description ?? '').trim(), status: 'open', allow_confirmation: Boolean(draft.allowConfirmation), allow_dispute: Boolean(draft.allowDispute) }).select('id').single();
      if (error) throw error;
      try {
        const { error: columnError } = await db.from('student_result_columns').insert(columns.map((column, position) => ({ event_id: created.id, id: String(column.id), position, label: String(column.label).trim(), max_score: Number(column.maxScore), description: String(column.description ?? '').trim() })));
        if (columnError) throw columnError;
        // 이름과 확인번호가 겹치면 조회할 때 누가 누구인지 가릴 수 없다. 확인번호는 임의
        // 솔트를 쓰는 bcrypt라 저장한 뒤에는 대조할 수 없으므로, 평문이 있는 지금 막는다.
        const seenAuthKeys = new Map<string, string>();
        for (const recipient of recipients) {
          const name = String(recipient.name ?? '').trim();
          const code = String(recipient.verificationCode ?? '').trim();
          const authKey = `${await studentNameLookup(name)}::${code}`;
          const previous = seenAuthKeys.get(authKey);
          if (previous !== undefined) {
            throw new HttpError(422, `${previous} 학생과 ${name} 학생의 성명·확인번호가 같습니다. 확인번호를 다르게 정해 주세요.`);
          }
          seenAuthKeys.set(authKey, name);
        }

        const encryptedRecipients = await Promise.all(recipients.map(async (recipient) => {
          const verificationCode = String(recipient.verificationCode ?? '').trim();
          const { data: digest, error: digestError } = await db.rpc('hash_student_result_code', { p_code: verificationCode });
          if (digestError) throw digestError;
          return {
            event_id: created.id, student_key: null, name: null, verification_code: null, verification_digest: digest,
            name_lookup: await studentNameLookup(String(recipient.name ?? '')),
            identity_ciphertext: await encryptStudentPayload({ studentKey: String(recipient.studentKey ?? '').trim(), name: String(recipient.name ?? '').trim(), verificationCode }),
            result_values: null, feedback: null,
            result_ciphertext: await encryptStudentPayload({ values: recipient.values ?? {}, feedback: String(recipient.feedback ?? '').trim() }),
          };
        }));
        const { error: recipientError } = await db.from('student_result_recipients').insert(encryptedRecipients);
        if (recipientError) throw recipientError;
      } catch (createError) { await db.from('student_result_events').delete().eq('id', created.id); throw createError; }
      return respond(200, { event: (await loadEvents([await getOwnedEvent(ownerId, created.id)]))[0] });
    }
    await getOwnedEvent(ownerId, eventId);
    if (action === 'delete') { const { error } = await db.from('student_result_events').delete().eq('id', eventId).eq('owner_id', ownerId); if (error) throw error; return respond(200, { ok: true }); }
    if (action === 'status') { const status = body.status === 'open' ? 'open' : 'closed'; const { error } = await db.from('student_result_events').update({ status }).eq('id', eventId).eq('owner_id', ownerId); if (error) throw error; return respond(200, { ok: true }); }
    const recipientId = typeof body.recipientId === 'string' ? body.recipientId : '';
    const { data: recipient, error: recipientError } = await db.from('student_result_recipients').select('id').eq('id', recipientId).eq('event_id', eventId).maybeSingle();
    if (recipientError) throw recipientError;
    if (!recipient) throw new HttpError(404, '학생 결과를 찾을 수 없습니다.');
    if (action === 'reply') {
      const reply = String(body.reply ?? '').trim();
      if (!reply) throw new HttpError(400, '답변 내용을 입력해 주세요.');
      const { error } = await db.from('student_result_disputes').update({ reply_ciphertext: await encryptStudentPayload(reply), teacher_reply: null, replied_at: new Date().toISOString() }).eq('event_id', eventId).eq('recipient_id', recipientId); if (error) throw error;
      await db.from('student_result_recipients').update({ status: 'reconfirm', confirmed_at: null }).eq('id', recipientId);
      return respond(200, { ok: true });
    }
    if (action === 'regenerate') { const { error } = await db.from('student_result_recipients').update({ personal_token: crypto.randomUUID() }).eq('id', recipientId); if (error) throw error; return respond(200, { ok: true }); }
    throw new HttpError(400, '지원하지 않는 요청입니다.');
  } catch (error) {
    if (error instanceof HttpError) return respond(error.status, { error: error.message });
    console.error('student-results-admin failed', error);
    return respond(500, { error: '학생 결과 요청을 처리하지 못했습니다.' });
  }
});
