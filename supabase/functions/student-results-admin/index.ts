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

const eventSelect = 'id, owner_id, public_token, title, description, status, allow_confirmation, allow_dispute, revision_ciphertext, created_at, updated_at';
const getOwnedEvent = async (ownerId: string, eventId: string) => {
  const { data, error } = await db.from('student_result_events').select(eventSelect).eq('id', eventId).eq('owner_id', ownerId).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, '결과 안내를 찾을 수 없습니다.');
  return data;
};

const loadEvents = async (rows: Array<Record<string, unknown>>, includeHistory = false) => {
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id as string);
  const [columnsResult, recipientsResult, disputesResult] = await Promise.all([
    db.from('student_result_columns').select('event_id, id, label, max_score, description, kind, position').in('event_id', ids),
    db.from('student_result_recipients').select('id, event_id, personal_token, identity_ciphertext, result_ciphertext, revision_ciphertext, status, viewed_at, confirmed_at, updated_at').in('event_id', ids),
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
      updatedAt: row.updated_at,
      revisions: includeHistory && row.revision_ciphertext
        ? await decryptStudentPayload<unknown[]>(row.revision_ciphertext) : undefined,
      dispute: dispute ? { message: dispute.message, submittedAt: dispute.submitted_at, teacherReply: dispute.teacher_reply ?? undefined, repliedAt: dispute.replied_at ?? undefined } : undefined,
    };
  }));
  return Promise.all(rows.map(async (row) => ({
    id: row.id, ownerId: row.owner_id, publicToken: row.public_token, title: row.title, description: row.description,
    status: row.status, allowConfirmation: row.allow_confirmation, allowDispute: row.allow_dispute,
    columns: (columnsResult.data ?? []).filter((column) => column.event_id === row.id).sort((a, b) => a.position - b.position).map((column) => ({ id: column.id, label: column.label, maxScore: Number(column.max_score), description: column.description, kind: column.kind ?? undefined })),
    recipients: recipients.filter((recipient) => recipient.eventId === row.id).sort((a, b) => a.studentKey.localeCompare(b.studentKey, 'ko-KR', { numeric: true })).map(({ eventId: _eventId, ...recipient }) => recipient),
    createdAt: row.created_at, updatedAt: row.updated_at,
    revisions: includeHistory && typeof row.revision_ciphertext === 'string'
      ? await decryptStudentPayload<unknown[]>(row.revision_ciphertext) : undefined,
  })));
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
    if (action === 'get') return respond(200, { event: (await loadEvents([await getOwnedEvent(ownerId, eventId)], true))[0] });
    if (action === 'create') {
      const draft = body.draft && typeof body.draft === 'object' && !Array.isArray(body.draft)
        ? body.draft as Record<string, unknown> : {};
      const columns = Array.isArray(draft.columns) ? draft.columns as Array<Record<string, unknown>> : [];
      const recipients = Array.isArray(draft.recipients) ? draft.recipients as Array<Record<string, unknown>> : [];
      const title = String(draft.title ?? '').trim();
      const description = String(draft.description ?? '').trim();
      const columnIds = new Set(columns.map((column) => String(column.id ?? '')));
      if (!title || title.length > 200 || description.length > 4000 || !columns.length || !recipients.length
        || columnIds.size !== columns.length
        || columns.filter((column) => column.kind === 'total').length > 1
        || columns.some((column) => !String(column.id ?? '').trim() || String(column.id).length > 100
          || !String(column.label ?? '').trim() || String(column.label).length > 100
          || typeof column.maxScore !== 'number' || !Number.isFinite(column.maxScore as number)
          || (column.maxScore as number) <= 0 || (column.maxScore as number) > 1000000
          || String(column.description ?? '').length > 1000
          || (column.kind !== undefined && column.kind !== 'score' && column.kind !== 'total'))
        || recipients.some((recipient) => {
          const values = recipient.values as Record<string, unknown> | null;
          return !String(recipient.studentKey ?? '').trim() || String(recipient.studentKey).length > 100
            || !String(recipient.name ?? '').trim() || String(recipient.name).length > 100
            || !String(recipient.verificationCode ?? '').trim() || String(recipient.verificationCode).length > 100
            || String(recipient.feedback ?? '').length > 10000
            || !values || Object.keys(values).length !== columns.length
            || columns.some((column) => typeof values[String(column.id)] !== 'number'
              || !Number.isFinite(values[String(column.id)] as number)
              || (values[String(column.id)] as number) < 0
              || (values[String(column.id)] as number) > (column.maxScore as number));
        })) throw new HttpError(400, '결과 안내 입력값을 확인해 주세요.');
      const { data: created, error } = await db.from('student_result_events').insert({ owner_id: ownerId, title: String(draft.title).trim(), description: String(draft.description ?? '').trim(), status: 'open', allow_confirmation: Boolean(draft.allowConfirmation), allow_dispute: Boolean(draft.allowDispute) }).select('id').single();
      if (error) throw error;
      try {
        const { error: columnError } = await db.from('student_result_columns').insert(columns.map((column, position) => ({ event_id: created.id, id: String(column.id), position, label: String(column.label).trim(), max_score: Number(column.maxScore), description: String(column.description ?? '').trim(), kind: column.kind === 'total' ? 'total' : 'score' })));
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
      return respond(200, { event: (await loadEvents([await getOwnedEvent(ownerId, created.id)], true))[0] });
    }
    const ownedEvent = await getOwnedEvent(ownerId, eventId);
    if (action === 'delete') { const { error } = await db.from('student_result_events').delete().eq('id', eventId).eq('owner_id', ownerId); if (error) throw error; return respond(200, { ok: true }); }
    if (action === 'status') { const status = body.status === 'open' ? 'open' : 'closed'; const { error } = await db.from('student_result_events').update({ status }).eq('id', eventId).eq('owner_id', ownerId); if (error) throw error; return respond(200, { ok: true }); }
    if (action === 'update-settings') {
      const current = (await loadEvents([ownedEvent], true))[0];
      if (body.expectedUpdatedAt !== current.updatedAt) throw new HttpError(409, '다른 변경이 반영되었습니다. 새로고침 후 다시 확인해 주세요.');
      const settings = body.settings as Record<string, unknown> | null;
      const incomingColumns = Array.isArray(settings?.columns) ? settings.columns as Array<Record<string, unknown>> : [];
      const title = String(settings?.title ?? '').trim();
      const description = String(settings?.description ?? '').trim();
      const validIds = new Set(current.columns.map((column) => column.id));
      if (!title || title.length > 200 || description.length > 4000
        || incomingColumns.length !== current.columns.length
        || new Set(incomingColumns.map((column) => column.id)).size !== validIds.size
        || incomingColumns.some((column) => !validIds.has(String(column.id))
          || !String(column.label ?? '').trim() || String(column.label).length > 100
          || !Number.isFinite(Number(column.maxScore)) || Number(column.maxScore) <= 0 || Number(column.maxScore) > 1000000
          || String(column.description ?? '').length > 1000
          || (column.kind !== 'score' && column.kind !== 'total' && column.kind !== undefined))) {
        throw new HttpError(400, '안내 정보와 결과 항목을 확인해 주세요.');
      }
      if (incomingColumns.filter((column) => column.kind === 'total').length > 1) throw new HttpError(400, '총점 항목은 하나만 지정할 수 있습니다.');
      for (const recipient of current.recipients) {
        for (const column of incomingColumns) {
          const score = recipient.values[String(column.id)];
          if (!Number.isFinite(score) || score < 0 || score > Number(column.maxScore)) {
            throw new HttpError(400, `${recipient.name} 학생의 ${String(column.label)} 점수가 새 배점을 넘습니다.`);
          }
        }
      }
      const after = {
        title, description,
        allowConfirmation: Boolean(settings?.allowConfirmation),
        allowDispute: Boolean(settings?.allowDispute),
        columns: current.columns.map((column) => {
          const edited = incomingColumns.find((candidate) => candidate.id === column.id)!;
          return { id: column.id, label: String(edited.label).trim(), maxScore: Number(edited.maxScore), description: String(edited.description ?? '').trim(), kind: edited.kind ?? column.kind };
        }),
      };
      const before = {
        title: current.title, description: current.description,
        allowConfirmation: current.allowConfirmation, allowDispute: current.allowDispute,
        columns: current.columns,
      };
      const revisions = [...(current.revisions ?? []), { changedAt: new Date().toISOString(), before, after }];
      const { data: updated, error } = await db.rpc('update_student_result_event_settings', {
        p_owner_id: ownerId,
        p_event_id: eventId,
        p_expected_updated_at: current.updatedAt,
        p_recipient_versions: Object.fromEntries(current.recipients.map((recipient) => [recipient.id, recipient.updatedAt])),
        p_title: title,
        p_description: description,
        p_allow_confirmation: after.allowConfirmation,
        p_allow_dispute: after.allowDispute,
        p_columns: after.columns.map((column) => ({ id: column.id, label: column.label, max_score: column.maxScore, description: column.description, kind: column.kind ?? null })),
        p_revision_ciphertext: await encryptStudentPayload(revisions),
      });
      if (error) throw error;
      if (!updated) throw new HttpError(409, '다른 변경이 반영되었습니다. 새로고침 후 다시 확인해 주세요.');
      return respond(200, { ok: true });
    }
    const recipientId = typeof body.recipientId === 'string' ? body.recipientId : '';
    const { data: recipient, error: recipientError } = await db.from('student_result_recipients').select('id').eq('id', recipientId).eq('event_id', eventId).maybeSingle();
    if (recipientError) throw recipientError;
    if (!recipient) throw new HttpError(404, '학생 결과를 찾을 수 없습니다.');
    if (action === 'update-recipient') {
      const current = (await loadEvents([ownedEvent], true))[0];
      const existing = current.recipients.find((candidate) => candidate.id === recipientId);
      if (!existing) throw new HttpError(404, '학생 결과를 찾을 수 없습니다.');
      if (body.expectedEventUpdatedAt !== current.updatedAt || body.expectedRecipientUpdatedAt !== existing.updatedAt) {
        throw new HttpError(409, '다른 변경이 반영되었습니다. 새로고침 후 다시 확인해 주세요.');
      }
      const values = body.values as Record<string, unknown> | null;
      const feedback = typeof body.feedback === 'string' ? body.feedback.trim() : '';
      const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
      if (!values || feedback.length > 10000 || !reason || reason.length > 200
        || Object.keys(values).length !== current.columns.length
        || current.columns.some((column) => typeof values[column.id] !== 'number'
          || !Number.isFinite(values[column.id] as number) || (values[column.id] as number) < 0
          || (values[column.id] as number) > column.maxScore)) {
        throw new HttpError(400, '점수·피드백과 수정 사유를 확인해 주세요.');
      }
      const before = { values: existing.values, feedback: existing.feedback };
      const after = { values, feedback };
      const revisions = [...(existing.revisions ?? []), { changedAt: new Date().toISOString(), reason, before, after }];
      const { data: updated, error } = await db.rpc('update_student_result_recipient_correction', {
        p_owner_id: ownerId,
        p_event_id: eventId,
        p_recipient_id: recipientId,
        p_expected_event_updated_at: current.updatedAt,
        p_expected_recipient_updated_at: existing.updatedAt,
        p_result_ciphertext: await encryptStudentPayload(after),
        p_revision_ciphertext: await encryptStudentPayload(revisions),
        p_reconfirm: current.allowConfirmation,
      });
      if (error) throw error;
      if (!updated) throw new HttpError(409, '다른 변경이 반영되었습니다. 새로고침 후 다시 확인해 주세요.');
      return respond(200, { ok: true });
    }
    if (action === 'reply') {
      const reply = String(body.reply ?? '').trim();
      if (!reply || reply.length > 4000) throw new HttpError(400, '답변 내용을 4,000자 이내로 입력해 주세요.');
      const { data: result, error } = await db.rpc('reply_student_result_dispute', {
        p_owner_id: ownerId, p_event_id: eventId, p_recipient_id: recipientId,
        p_reply_ciphertext: await encryptStudentPayload(reply),
      });
      if (error) throw error;
      if (result === 'EVENT_NOT_FOUND') throw new HttpError(404, '결과 안내를 찾을 수 없습니다.');
      if (result === 'RECIPIENT_NOT_FOUND') throw new HttpError(404, '학생 결과를 찾을 수 없습니다.');
      if (result === 'DISPUTE_NOT_FOUND') throw new HttpError(409, '접수된 이의가 없습니다. 새로고침 후 다시 확인해 주세요.');
      if (result !== 'OK') throw new Error('Unexpected student result reply response.');
      return respond(200, { ok: true });
    }
    if (action === 'regenerate') {
      const { data: result, error } = await db.rpc('regenerate_student_result_personal_token', {
        p_owner_id: ownerId, p_event_id: eventId, p_recipient_id: recipientId, p_personal_token: crypto.randomUUID(),
      });
      if (error) throw error;
      if (result === 'EVENT_NOT_FOUND') throw new HttpError(404, '결과 안내를 찾을 수 없습니다.');
      if (result === 'RECIPIENT_NOT_FOUND') throw new HttpError(404, '학생 결과를 찾을 수 없습니다.');
      if (result !== 'OK') throw new Error('Unexpected student result regeneration response.');
      return respond(200, { ok: true });
    }
    throw new HttpError(400, '지원하지 않는 요청입니다.');
  } catch (error) {
    if (error instanceof HttpError) return respond(error.status, { error: error.message });
    console.error('student-results-admin failed', error);
    return respond(500, { error: '학생 결과 요청을 처리하지 못했습니다.' });
  }
});
