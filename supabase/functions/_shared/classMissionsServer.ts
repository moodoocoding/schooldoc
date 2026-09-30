import { createClient } from 'npm:@supabase/supabase-js@2.110.8';
import { createPayloadCrypto } from './payloadCrypto.ts';
import {
  changeMissionStatus, generateMissionCode, hashMissionCode, missionPurgeCounts, missionToday, normalizeMissionCode,
  parseMissionRoster, publicMissionView, purgeMissionState, safeHashEqual, setMissionCheck,
  validateClassName, validateMissionInput,
  type CheckStatus, type IssuedCode, type Mission, type MissionBoard,
  type StoredMissionState,
} from './classMissions.ts';

const seal = createPayloadCrypto('CLASS_MISSIONS_ENCRYPTION_KEY', '학급 미션 암호화 설정이 필요합니다.');
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers });
class RequestError extends Error { constructor(message: string, readonly status = 400) { super(message); } }
function fail(message: string, status = 400): never { throw new RequestError(message, status); }
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id = (value: unknown) => typeof value === 'string' && idPattern.test(value) ? value : fail('요청 정보를 확인해 주세요.');
const nowIso = () => new Date().toISOString();
type BoardRow = { id: string; owner_id: string; public_token: string; public_enabled: boolean;
  encrypted_payload: string; version: number; updated_at: string };
type Client = ReturnType<typeof createClient<any>>;
function publicError(): never { return fail('이름 또는 링크를 확인해 주세요.', 404); }

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader();
  if (!reader) fail('요청 내용이 없습니다.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 120_000) { await reader.cancel(); fail('요청이 너무 큽니다.', 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try {
    const body = JSON.parse(new TextDecoder().decode(bytes));
    if (body && typeof body === 'object' && !Array.isArray(body)) return body;
  } catch { /* use the same format error */ }
  return fail('요청 형식을 확인해 주세요.');
}
async function rateLimit(db: Client, key: string, maxRequests: number) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const limit = await db.rpc('consume_registry_rate_limit', {
    p_request_key: `missions:${hash}`, p_window_seconds: 60, p_max_requests: maxRequests,
  });
  if (limit.error) fail('잠시 후 다시 시도해 주세요.', 503);
  if (!limit.data) fail('요청이 많습니다. 1분 후 다시 시도해 주세요.', 429);
}
async function loadRow(db: Client, boardId: string, ownerId: string): Promise<BoardRow> {
  const { data, error } = await db.from('class_mission_boards').select('*').eq('id', boardId).eq('owner_id', ownerId).maybeSingle();
  if (error) fail('학급을 불러오지 못했습니다.', 503);
  if (!data) fail('학급을 찾지 못했습니다.', 404);
  return data as BoardRow;
}
async function decrypt(row: BoardRow) { return seal.decryptPayload<StoredMissionState>(row.encrypted_payload); }
function projection(row: BoardRow, state: StoredMissionState): MissionBoard {
  return { id: row.id, version: row.version, publicToken: row.public_token,
    publicEnabled: row.public_enabled, updatedAt: row.updated_at,
    state: { ...state, roster: state.roster.map(({ id, number, name }) => ({ id, number, name })) } };
}
async function saveRow(db: Client, row: BoardRow, next: StoredMissionState,
  extra: Record<string, unknown> = {}): Promise<BoardRow> {
  const { data, error } = await db.from('class_mission_boards').update({
    encrypted_payload: await seal.encryptPayload(next), version: row.version + 1,
    updated_at: nowIso(), ...extra,
  }).eq('id', row.id).eq('version', row.version).select('*').maybeSingle();
  if (error) fail('미션을 저장하지 못했습니다. 다시 시도해 주세요.', 503);
  if (!data) fail('다른 화면에서 변경되었습니다. 새로고침 후 다시 시도해 주세요.', 409);
  return data as BoardRow;
}
async function issueCode(boardId: string, student: { id: string; number: number; name: string }, used: Set<string>) {
  let code = '';
  let codeHash = '';
  do { code = generateMissionCode(); codeHash = await hashMissionCode(boardId, code); } while (used.has(codeHash));
  used.add(codeHash);
  return { student: { ...student, codeHash }, issued: { ...student, code } as IssuedCode };
}

async function handleAdmin(db: Client, body: Record<string, unknown>, ownerId: string): Promise<Response> {
  if (body.action === 'list') {
    const { data, error } = await db.from('class_mission_boards').select('*').eq('owner_id', ownerId).order('updated_at', { ascending: false });
    if (error) fail('학급 목록을 불러오지 못했습니다.', 503);
    const boards: MissionBoard[] = [];
    for (const row of data ?? []) boards.push(projection(row as BoardRow, await decrypt(row as BoardRow)));
    return json({ boards });
  }
  if (body.action === 'createBoard') {
    const className = validateClassName(body.className);
    const { count, error: countError } = await db.from('class_mission_boards').select('id', { count: 'exact', head: true }).eq('owner_id', ownerId);
    if (countError) fail('학급 수를 확인하지 못했습니다.', 503);
    if ((count ?? 0) >= 12) fail('학급은 최대 12개까지 만들 수 있습니다.');
    const state: StoredMissionState = { className, roster: [], missions: [], checks: [], events: [] };
    const { data, error } = await db.from('class_mission_boards').insert({
      owner_id: ownerId, encrypted_payload: await seal.encryptPayload(state),
    }).select('*').single();
    if (error || !data) fail('학급을 만들지 못했습니다.', 503);
    return json({ board: projection(data as BoardRow, state) });
  }
  const boardId = id(body.boardId);
  const row = await loadRow(db, boardId, ownerId);
  if (body.version !== row.version) fail('다른 화면에서 변경되었습니다. 새로고침 후 다시 시도해 주세요.', 409);
  const state = await decrypt(row);
  let next = state;
  let extra: Record<string, unknown> = {};
  let issuedCodes: IssuedCode[] = [];
  switch (body.action) {
    case 'renameBoard': next = { ...state, className: validateClassName(body.className) }; break;
    case 'saveRoster': {
      if (typeof body.rosterText !== 'string' || body.rosterText.length > 10_000) fail('명단을 확인해 주세요.');
      const parsed = parseMissionRoster(body.rosterText, state.roster);
      const remaining = new Set(parsed.map((student) => student.id));
      if (state.missions.some((mission) => mission.status === 'open' && mission.targets.some((student) => !remaining.has(student.id)))) {
        fail('진행 중 미션의 대상은 명단에서 지울 수 없습니다. 미션을 종료한 뒤 수정해 주세요.');
      }
      const used = new Set(state.roster.map((student) => student.codeHash));
      const roster: StoredMissionState['roster'] = [];
      for (const student of parsed) {
        const existing = state.roster.find((entry) => entry.id === student.id);
        if (existing) roster.push(existing);
        else { const generated = await issueCode(row.id, student, used); roster.push(generated.student); issuedCodes.push(generated.issued); }
      }
      next = { ...state, roster };
      break;
    }
    case 'reissueCode': {
      const studentId = id(body.studentId);
      const selected = state.roster.find((student) => student.id === studentId);
      if (!selected) fail('학생을 찾지 못했습니다.');
      const generated = await issueCode(row.id, selected, new Set(state.roster.map((student) => student.codeHash)));
      next = { ...state, roster: state.roster.map((student) => student.id === studentId ? generated.student : student) };
      issuedCodes = [generated.issued];
      break;
    }
    case 'saveMission': {
      const missionId = body.missionId ? id(body.missionId) : null;
      const current = missionId ? state.missions.find((mission) => mission.id === missionId) : null;
      if (missionId && !current) fail('미션을 찾지 못했습니다.');
      const rosterForValidation = [...state.roster, ...(current && current.status !== 'draft'
        ? current.targets.filter((target) => !state.roster.some((student) => student.id === target.id)) : [])];
      const input = validateMissionInput(body.mission, rosterForValidation);
      if (!current && input.status === 'closed') fail('새 미션은 초안이나 진행 중으로 만들어 주세요.');
      if (!current && state.missions.length >= 60) fail('한 학급에는 미션을 최대 60개까지 만들 수 있습니다.');
      if (current && current.status !== 'draft') {
        const oldIds = current.targets.map((student) => student.id).sort().join(',');
        if (oldIds !== [...input.targetStudentIds].sort().join(',') || current.requiresConfirmation !== input.requiresConfirmation || input.status !== current.status) {
          fail('발행한 미션의 대상·확인 방식·상태는 여기서 바꿀 수 없습니다.');
        }
      }
      if (current?.status === 'closed' && input.status !== 'closed') fail('종료된 미션을 먼저 다시 열어 주세요.');
      const targets = input.targetStudentIds.map((studentId) => {
        const { id, number, name } = rosterForValidation.find((student) => student.id === studentId)!;
        return { id, number, name };
      });
      const mission: Mission = { id: current?.id ?? crypto.randomUUID(), title: input.title,
        description: input.description, startDate: input.startDate, dueDate: input.dueDate,
        requiresConfirmation: input.requiresConfirmation, status: input.status,
        closedAt: current?.closedAt,
        targets: current?.status === 'draft' || !current ? targets : current.targets,
        createdAt: current?.createdAt ?? nowIso(), updatedAt: nowIso() };
      next = { ...state, missions: current ? state.missions.map((item) => item.id === current.id ? mission : item) : [...state.missions, mission] };
      break;
    }
    case 'setMissionStatus': {
      const missionId = id(body.missionId);
      const current = state.missions.find((mission) => mission.id === missionId);
      if (!current) fail('미션을 찾지 못했습니다.');
      const target = body.status;
      if (target !== 'open' && target !== 'closed') fail('미션 상태를 확인해 주세요.');
      if (target === 'open' && current.dueDate < missionToday()) fail('마감일을 연장한 뒤 다시 열어 주세요.');
      next = changeMissionStatus(state, missionId, target);
      break;
    }
    case 'purgeMission': {
      const missionId = id(body.missionId);
      const counts = missionPurgeCounts(state, missionId);
      if (body.confirmText !== '영구 파기' || body.expectedTargetCount !== counts.targetCount ||
          body.expectedCheckCount !== counts.checkCount || body.expectedEventCount !== counts.eventCount) {
        fail('파기 대상과 건수를 다시 확인해 주세요.', 409);
      }
      next = purgeMissionState(state, missionId);
      const { data, error } = await db.rpc('commit_class_mission_purge', {
        p_board_id: row.id, p_owner_id: ownerId, p_expected_version: row.version,
        p_mission_id: missionId, p_encrypted_payload: await seal.encryptPayload(next),
        p_target_count: counts.targetCount, p_check_count: counts.checkCount, p_event_count: counts.eventCount,
        p_clear_roster: counts.clearRoster,
      });
      if (error) {
        const { data: after } = await db.from('class_mission_boards').select('*')
          .eq('id', row.id).eq('owner_id', ownerId).maybeSingle();
        if (after) {
          const afterState = await decrypt(after as BoardRow);
          if (!afterState.missions.some((mission) => mission.id === missionId)) {
            return json({ board: projection(after as BoardRow, afterState), issuedCodes });
          }
        }
        const retry = await db.from('class_mission_purge_audit').insert({ board_id: row.id, mission_id: missionId,
          status: 'retry', target_count: counts.targetCount, check_count: counts.checkCount,
          event_count: counts.eventCount, reason_code: 'commit_failed' });
        if (retry.error) fail('파기 상태를 확인하지 못했습니다. 새로고침 후 관리자에게 문의해 주세요.', 503);
        fail('파기를 완료하지 못했습니다. 기록을 확인한 뒤 다시 시도해 주세요.', 503);
      }
      if (!data) fail('다른 화면에서 변경되었습니다. 새로고침 후 다시 시도해 주세요.', 409);
      const saved = await loadRow(db, row.id, ownerId);
      return json({ board: projection(saved, next), issuedCodes });
    }
    case 'setCheck': {
      const status = body.status as CheckStatus;
      if (!['unmarked', 'reported', 'pending', 'confirmed', 'exempt'].includes(status)) fail('상태를 확인해 주세요.');
      if (state.events.length >= 20_000) fail('변경 이력이 가득 찼습니다. 관리자에게 문의해 주세요.');
      next = setMissionCheck(state, id(body.missionId), id(body.studentId), status, 'teacher');
      break;
    }
    case 'confirmPending': {
      const missionId = id(body.missionId);
      if (!state.missions.some((mission) => mission.id === missionId)) fail('미션을 찾지 못했습니다.');
      const pending = state.checks.filter((check) => check.missionId === missionId && check.status === 'pending').map((check) => check.studentId).sort();
      if (!Array.isArray(body.expectedStudentIds) || body.expectedStudentIds.some((value) => typeof value !== 'string' || !idPattern.test(value)) ||
          [...body.expectedStudentIds].sort().join(',') !== pending.join(',')) {
        fail('확인 대기 명단이 변경되었습니다. 새로고침 후 다시 확인해 주세요.', 409);
      }
      if (state.events.length + pending.length > 20_000) fail('변경 이력이 가득 찼습니다. 관리자에게 문의해 주세요.');
      for (const studentId of pending) next = setMissionCheck(next, missionId, studentId, 'confirmed', 'teacher');
      break;
    }
    case 'setPublic':
      if (typeof body.enabled !== 'boolean') fail('공개 설정을 확인해 주세요.');
      extra = { public_enabled: body.enabled };
      break;
    case 'rotateToken': extra = { public_token: crypto.randomUUID() }; break;
    default: fail('지원하지 않는 요청입니다.');
  }
  if (next === state && !Object.keys(extra).length) return json({ board: projection(row, state), issuedCodes });
  const saved = await saveRow(db, row, next, extra);
  return json({ board: projection(saved, next), issuedCodes });
}

async function handlePublic(db: Client, body: Record<string, unknown>, remoteIp: string): Promise<Response> {
  const token = id(body.token);
  const rawName = typeof body.studentName === 'string' ? body.studentName
    : typeof body.name === 'string' ? body.name : '';
  const trimmedName = rawName.trim();
  const normalized = typeof body.code === 'string' ? normalizeMissionCode(body.code) : '';
  const hasValidCode = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{12}$/.test(normalized);
  if (!trimmedName && !hasValidCode) publicError();
  await rateLimit(db, `public:${remoteIp}`, 40);
  await rateLimit(db, `token:${token}`, 400);
  if (body.action !== 'view' && body.action !== 'mark') fail('지원하지 않는 요청입니다.');
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await db.from('class_mission_boards').select('*').eq('public_token', token).maybeSingle();
    if (error) fail('학급을 불러오지 못했습니다.', 503);
    const row = data as BoardRow | null;
    if (!row || !row.public_enabled) publicError();
    const state = await decrypt(row);
    let student = trimmedName ? state.roster.find((entry) => entry.name.trim() === trimmedName) : undefined;
    if (!student && hasValidCode) {
      const hash = await hashMissionCode(row.id, normalized);
      student = state.roster.find((entry) => safeHashEqual(entry.codeHash, hash));
    }
    if (!student) publicError();
    if (body.action === 'view') return json(publicMissionView(state, student.id));
    const status = body.status;
    if (status !== 'reported' && status !== 'unmarked') fail('완료 상태를 확인해 주세요.');
    if (state.events.length >= 20_000) fail('기록을 저장할 수 없습니다. 교사에게 문의해 주세요.', 503);
    const missionId = id(body.missionId);
    const mission = state.missions.find((item) => item.id === missionId);
    if (!mission) fail('미션을 찾지 못했습니다.');
    const nextStatus = status === 'unmarked' ? 'unmarked' : mission.requiresConfirmation ? 'pending' : 'reported';
    const next = setMissionCheck(state, missionId, student.id, nextStatus, 'student');
    if (next === state) return json(publicMissionView(state, student.id));
    const { data: saved, error: saveError } = await db.from('class_mission_boards').update({
      encrypted_payload: await seal.encryptPayload(next), version: row.version + 1, updated_at: nowIso(),
    }).eq('id', row.id).eq('version', row.version).select('id').maybeSingle();
    if (saveError) fail('기록을 저장하지 못했습니다. 다시 시도해 주세요.', 503);
    if (saved) return json(publicMissionView(next, student.id));
  }
  return fail('동시에 기록이 바뀌었습니다. 다시 시도해 주세요.', 409);
}

export async function handleClassMissions(request: Request, publicRequest: boolean): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { headers });
  if (request.method !== 'POST') return json({ error: '지원하지 않는 요청입니다.' }, 405);
  try {
    const body = await readBody(request);
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY');
    if (!url || !key || !seal.isConfigured()) fail('학급 미션 서비스가 아직 준비되지 않았습니다.', 503);
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    if (publicRequest) {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
      return await handlePublic(db, body, ip);
    }
    const bearer = request.headers.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1];
    if (!bearer) fail('교사 로그인이 필요합니다.', 401);
    const { data, error } = await db.auth.getUser(bearer);
    if (error || !data.user) fail('다시 로그인해 주세요.', 401);
    await rateLimit(db, `admin:${data.user.id}`, 120);
    return await handleAdmin(db, body, data.user.id);
  } catch (error) {
    if (error instanceof RequestError) return json({ error: error.message }, error.status);
    if (error instanceof Error && /^[가-힣]/.test(error.message)) return json({ error: error.message }, 400);
    return json({ error: '요청을 처리하지 못했습니다. 다시 시도해 주세요.' }, 503);
  }
}
