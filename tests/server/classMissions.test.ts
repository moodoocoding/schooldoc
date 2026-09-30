// Isolated HTTP contract tests. Fetch is mocked; no network permission is needed.
// Run: deno test --allow-env --node-modules-dir=manual tests/server/classMissions.test.ts
import { handleClassMissions } from '../../supabase/functions/_shared/classMissionsServer.ts';
import { hashMissionCode, parseMissionRoster, type Mission, type StoredMissionState } from '../../supabase/functions/_shared/classMissions.ts';
import { createPayloadCrypto } from '../../supabase/functions/_shared/payloadCrypto.ts';

const owner = '10000000-0000-4000-8000-000000000001';
const otherOwner = '10000000-0000-4000-8000-000000000002';
const boardId = '20000000-0000-4000-8000-000000000001';
const token = '30000000-0000-4000-8000-000000000001';
const code = 'ABCDEFGHJKLM';
const assert = (condition: unknown, message = 'Assertion failed') => { if (!condition) throw new Error(message); };
const respond = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'content-type': 'application/json' },
});

async function fixture(run: (context: Awaited<ReturnType<typeof createFixture>>) => Promise<void>, closedDays = 91) {
  const oldFetch = globalThis.fetch;
  const names = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'CLASS_MISSIONS_ENCRYPTION_KEY'];
  const previous = names.map((name) => Deno.env.get(name));
  Deno.env.set('SUPABASE_URL', 'https://mission-test.invalid');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key-not-a-real-secret');
  Deno.env.set('CLASS_MISSIONS_ENCRYPTION_KEY', '11'.repeat(32));
  try { await run(await createFixture(closedDays)); }
  finally {
    globalThis.fetch = oldFetch;
    names.forEach((name, index) => previous[index] === undefined ? Deno.env.delete(name) : Deno.env.set(name, previous[index]!));
  }
}

async function createFixture(closedDays: number) {
  const roster = parseMissionRoster('1 가상하늘\n2 가상바다');
  const storedRoster = await Promise.all(roster.map(async (student, index) => ({
    ...student, codeHash: await hashMissionCode(boardId, index === 0 ? code : 'MNPQRSTUVWXZ'),
  })));
  const closedAt = new Date(Date.now() - closedDays * 24 * 60 * 60 * 1000).toISOString();
  const mission: Mission = {
    id: '40000000-0000-4000-8000-000000000001', title: '가상 독서 미션', description: '',
    startDate: '2026-01-01', dueDate: '2026-02-01', requiresConfirmation: false,
    status: 'closed', closedAt,
    targets: roster, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: closedAt,
  };
  const state: StoredMissionState = {
    className: '가상 학급', roster: storedRoster, missions: [mission],
    checks: [{ missionId: mission.id, studentId: roster[0].id, status: 'reported', updatedAt: closedAt }],
    events: [{ id: crypto.randomUUID(), missionId: mission.id, studentId: roster[0].id,
      from: 'unmarked', status: 'reported', actor: 'student', updatedAt: closedAt }],
  };
  const seal = createPayloadCrypto('CLASS_MISSIONS_ENCRYPTION_KEY', 'test');
  const row = { id: boardId, owner_id: owner, public_token: token, public_enabled: true,
    version: 1, updated_at: closedAt, encrypted_payload: await seal.encryptPayload(state) };
  const calls: { path: string; method: string; body?: Record<string, unknown> }[] = [];
  const flags = { commitConflict: false, commitError: false, hideCreatedBoardOnce: false };
  const createdBoards = new Map<string, typeof row>();
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    assert(url.hostname === 'mission-test.invalid', 'Unexpected network request');
    const body = request.method === 'POST' || request.method === 'PATCH' ? await request.json() as Record<string, unknown> : undefined;
    calls.push({ path: url.pathname + url.search, method: request.method, body });
    if (url.pathname === '/auth/v1/user') {
      const bearer = request.headers.get('authorization');
      if (bearer !== 'Bearer teacher-a' && bearer !== 'Bearer teacher-b') return respond({ message: 'invalid token' }, 401);
      return respond({ id: bearer === 'Bearer teacher-a' ? owner : otherOwner,
        aud: 'authenticated', role: 'authenticated', created_at: new Date().toISOString() });
    }
    if (url.pathname.endsWith('/rpc/consume_registry_rate_limit')) return respond(true);
    if (url.pathname.endsWith('/rpc/commit_class_mission_purge')) {
      if (flags.commitError) return respond({ message: 'db unavailable' }, 500);
      if (flags.commitConflict) return respond(false);
      row.encrypted_payload = String(body?.p_encrypted_payload);
      row.version += 1;
      row.updated_at = new Date().toISOString();
      if (body?.p_clear_roster) { row.public_token = crypto.randomUUID(); row.public_enabled = false; }
      return respond(true);
    }
    if (url.pathname.endsWith('/class_mission_purge_audit') && request.method === 'POST') return respond({}, 201);
    if (url.pathname.endsWith('/class_mission_boards')) {
      if (request.method === 'HEAD') {
        return new Response(null, { headers: { 'content-range': `0-0/${createdBoards.size + 1}` } });
      }
      if (request.method === 'POST') {
        const requestedId = String(body?.id ?? crypto.randomUUID());
        if (createdBoards.has(requestedId)) return respond({ code: '23505', message: 'duplicate key' }, 409);
        const created = { id: requestedId, owner_id: String(body?.owner_id), public_token: crypto.randomUUID(),
          public_enabled: true, version: 1, updated_at: new Date().toISOString(),
          encrypted_payload: String(body?.encrypted_payload) };
        createdBoards.set(requestedId, created);
        return respond(created, 201);
      }
      const requestedId = url.searchParams.get('id')?.replace(/^eq\./, '');
      if (requestedId && createdBoards.has(requestedId)) {
        if (flags.hideCreatedBoardOnce) { flags.hideCreatedBoardOnce = false; return respond([]); }
        return respond([createdBoards.get(requestedId)]);
      }
      const allowed = url.searchParams.get('owner_id') === `eq.${owner}` || url.searchParams.get('public_token') === `eq.${token}`;
      return respond(allowed && (!requestedId || requestedId === row.id) ? [row] : []);
    }
    throw new Error(`Unexpected fake endpoint ${url.pathname}`);
  };
  const call = (body: object, publicRequest = false, bearer = 'teacher-a') => handleClassMissions(
    new Request('https://handler.invalid/', { method: 'POST', headers: {
      'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    }, body: JSON.stringify(body) }), publicRequest,
  );
  const purge = (patch: Record<string, unknown> = {}) => ({ action: 'purgeMission', boardId, version: 1,
    missionId: mission.id, expectedTargetCount: 2, expectedCheckCount: 1, expectedEventCount: 1,
    confirmText: '영구 파기', ...patch });
  return { state, row, calls, flags, createdBoards, call, purge, seal };
}

Deno.test('설정 학급 자동 생성은 재요청과 동시 생성 충돌에서 같은 학급을 반환한다', () => fixture(async ({ call, calls, flags, createdBoards }) => {
  const request = { action: 'createBoard', className: '3학년 2반', fromSettings: true };
  const first = await call(request);
  assert(first.status === 200, `Unexpected status ${first.status}`);
  const firstBoard = (await first.json()).board;
  flags.hideCreatedBoardOnce = true;
  const second = await call(request);
  assert(second.status === 200, `Unexpected status ${second.status}`);
  const secondBoard = (await second.json()).board;
  assert(firstBoard.id === secondBoard.id && firstBoard.publicToken === secondBoard.publicToken);
  assert(createdBoards.size === 1);
  assert(calls.filter((entry) => entry.method === 'POST' && entry.path.includes('/class_mission_boards')).length === 2);
}));

Deno.test('교사 인증과 소유자 검사를 통과해야 파기 요청을 읽는다', () => fixture(async ({ call, calls, purge }) => {
  assert((await call(purge(), false, '')).status === 401);
  assert((await call(purge(), false, 'invalid')).status === 401);
  assert((await call(purge(), false, 'teacher-b')).status === 404);
  assert(!calls.some((entry) => entry.path.includes('/rpc/commit_class_mission_purge')));
}));

Deno.test('90일 전이나 확인 건수가 달라진 파기 요청은 DB 변경 전에 거부한다', () => fixture(async ({ call, calls, purge }) => {
  assert((await call(purge())).status === 400);
  assert((await call(purge({ expectedCheckCount: 2 }))).status === 409);
  assert(!calls.some((entry) => entry.path.includes('/rpc/commit_class_mission_purge')));
}, 89));

Deno.test('90일 뒤 파기는 응답·이력·마지막 명단을 지우고 링크를 중지한다', () => fixture(async ({ call, row, purge, seal, calls }) => {
  const response = await call(purge());
  assert(response.status === 200, `Unexpected status ${response.status}`);
  const result = await response.json();
  assert(result.board.version === 2 && result.board.publicEnabled === false);
  assert(result.board.publicToken !== token);
  assert(result.board.state.roster.length === 0 && result.board.state.missions.length === 0);
  const stored = await seal.decryptPayload<StoredMissionState>(row.encrypted_payload);
  assert(stored.roster.length === 0 && stored.missions.length === 0 && stored.checks.length === 0 && stored.events.length === 0);
  assert(!JSON.stringify(result).includes('codeHash'));
  assert(calls.some((entry) => entry.path.includes('/rpc/commit_class_mission_purge')));
}));

Deno.test('DB 충돌은 409를 돌려주고 암호문을 바꾸지 않는다', () => fixture(async ({ call, row, flags, purge }) => {
  flags.commitConflict = true;
  const before = row.encrypted_payload;
  assert((await call(purge())).status === 409);
  assert(row.encrypted_payload === before);
}));

Deno.test('DB 오류는 개인정보 없는 재시도 기록을 남긴다', () => fixture(async ({ call, calls, flags, purge }) => {
  flags.commitError = true;
  assert((await call(purge())).status === 503);
  const retry = calls.find((entry) => entry.path.includes('/class_mission_purge_audit'));
  assert(retry?.body?.status === 'retry');
  assert(!JSON.stringify(retry?.body).includes('가상'));
}));

Deno.test('학생 이름 또는 코드는 자기 미션만 반환하고 잘못된 정보는 거부한다', () => fixture(async ({ call }) => {
  const byNameResponse = await call({ action: 'view', token, studentName: '가상하늘' }, true, '');
  assert(byNameResponse.status === 200);
  const byNameView = await byNameResponse.json();
  assert(byNameView.studentName === '가상하늘' && byNameView.missions.length === 1);
  assert(!JSON.stringify(byNameView).includes('가상바다'));

  const response = await call({ action: 'view', token, code }, true, '');
  assert(response.status === 200);
  const view = await response.json();
  assert(view.studentName === '가상하늘' && view.missions.length === 1);
  assert(!JSON.stringify(view).includes('가상바다'));
  assert((await call({ action: 'view', token, studentName: '없는학생' }, true, '')).status === 404);
  assert((await call({ action: 'view', token, code: 'AAAAAAAAAAAA' }, true, '')).status === 404);
}));
