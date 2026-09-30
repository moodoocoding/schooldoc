// Regressions converted from review probes: assert the desired corrected behavior.
// All HTTP calls are mocked; do not grant network permission.
import { handleClassMissions } from '../../supabase/functions/_shared/classMissionsServer.ts';
import { generateMissionCode, hashMissionCode, missionToday, parseMissionRoster, type StoredMissionState } from '../../supabase/functions/_shared/classMissions.ts';
import { createPayloadCrypto } from '../../supabase/functions/_shared/payloadCrypto.ts';

const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });

async function fixture(run: (context: Awaited<ReturnType<typeof setup>>) => Promise<void>) {
  const previousFetch = globalThis.fetch;
  const keys = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'CLASS_MISSIONS_ENCRYPTION_KEY'];
  const previous = keys.map((key) => Deno.env.get(key));
  Deno.env.set('SUPABASE_URL', 'https://mission-review.invalid');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'fictional-review-key');
  Deno.env.set('CLASS_MISSIONS_ENCRYPTION_KEY', '22'.repeat(32));
  try { await run(await setup()); }
  finally {
    globalThis.fetch = previousFetch;
    keys.forEach((key, i) => previous[i] === undefined ? Deno.env.delete(key) : Deno.env.set(key, previous[i]!));
  }
}

async function setup() {
  const boardId = crypto.randomUUID();
  const token = crypto.randomUUID();
  const roster = parseMissionRoster('1 가상동명\n2 가상동명\n' + Array.from({ length: 58 }, (_, i) => `${i + 3} 가상학생${i + 3}`).join('\n'));
  const codes = ['ABCDEFGHJKLM', 'MNPQRSTUVWXZ', ...Array.from({ length: 58 }, () => generateMissionCode())];
  const state: StoredMissionState = {
    className: '가상 리뷰 학급',
    roster: await Promise.all(roster.map(async (s, i) => ({ ...s, codeHash: await hashMissionCode(boardId, codes[i]) }))),
    missions: [{ id: crypto.randomUUID(), title: '가상 미션', description: '', startDate: missionToday(),
      dueDate: missionToday(new Date(Date.now() + 86400000)), status: 'open', requiresConfirmation: false,
      targets: roster, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
    checks: [], events: [],
  };
  const seal = createPayloadCrypto('CLASS_MISSIONS_ENCRYPTION_KEY', 'fictional review');
  const row = { id: boardId, owner_id: crypto.randomUUID(), public_token: token, public_enabled: true,
    version: 1, updated_at: new Date().toISOString(), encrypted_payload: await seal.encryptPayload(state) };
  const rows = new Map<string, typeof row>([[token, row]]);
  const flags = { limitError: false, conflicts: 0 };
  const buckets = new Map<string, number>();
  const limits: { max: number; seconds: number }[] = [];
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    assert(url.hostname === 'mission-review.invalid', 'Unexpected real HTTP call');
    if (url.pathname.endsWith('/rpc/consume_registry_rate_limit')) {
      if (flags.limitError) return new Response('{}', { status: 503 });
      const body = await request.json();
      const count = (buckets.get(body.p_request_key) ?? 0) + 1;
      buckets.set(body.p_request_key, count);
      limits.push({ max: body.p_max_requests, seconds: body.p_window_seconds });
      return json(count <= body.p_max_requests);
    }
    if (url.pathname.endsWith('/class_mission_boards')) {
      if (request.method === 'GET') { const target = rows.get(url.searchParams.get('public_token')?.replace(/^eq\./, '') ?? ''); return json(target ? [target] : []); }
      if (request.method === 'PATCH') {
        const body = await request.json();
        if (flags.conflicts > 0) { flags.conflicts -= 1; return json([]); }
        const target = [...rows.values()].find(r => r.id === url.searchParams.get('id')?.replace(/^eq\./, ''));
        assert(target && url.searchParams.get('version') === `eq.${target.version}`, 'Unexpected version');
        Object.assign(target!, body);
        return json([{ id: target!.id }]);
      }
    }
    throw new Error(`Unexpected mock request ${url.pathname}`);
  };
  const call = (body: Record<string, unknown>) => handleClassMissions(new Request('https://handler.invalid', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '192.0.2.1' },
    body: JSON.stringify({ token, ...body }),
  }), true);
  const addClass = async () => {
    const nextState = structuredClone(state); const nextId = crypto.randomUUID(); const nextToken = crypto.randomUUID();
    nextState.roster = await Promise.all(nextState.roster.map(async (student, i) => ({ ...student, codeHash: await hashMissionCode(nextId, codes[i]) })));
    rows.set(nextToken, { ...row, id: nextId, public_token: nextToken, encrypted_payload: await seal.encryptPayload(nextState) });
    return nextToken;
  };
  return { state, row, codes, seal, limits, call, flags, addClass };
}


Deno.test('동명 이름 조회·저장을 거부하고 두 번째 학생은 코드로 자기 기록만 변경한다', () => fixture(async ({ state, row, seal, call, codes }) => {
  const initial = row.encrypted_payload;
  for (const action of ['view', 'mark']) {
    const response = await call({ action, studentName: '가상동명', missionId: state.missions[0].id, status: 'reported' });
    assert(response.status === 400 && (await response.json()).error.includes('개인 코드'), 'Ambiguous identity must be rejected');
  }
  assert(row.encrypted_payload === initial, 'Ambiguous name wrote data');
  const response = await call({ action: 'mark', code: codes[1], missionId: state.missions[0].id, status: 'reported' });
  assert(response.status === 200, 'Personal code was rejected');
  const saved = await seal.decryptPayload<StoredMissionState>(row.encrypted_payload);
  assert(saved.checks.length === 1 && saved.checks[0].studentId === state.roster[1].id, 'Wrong student changed');
  assert((await (await call({ action: 'view', code: codes[0] })).json()).missions[0].check === 'unmarked', 'Namesake changed');
}));

Deno.test('공용 학교 IP에서 60명이 조회·완료·취소·새로고침할 수 있다', () => fixture(async ({ state, call, codes }) => {
  for (const code of codes) {
    for (const body of [{ action: 'view' }, { action: 'mark', status: 'reported' }, { action: 'mark', status: 'unmarked' }, { action: 'view' }]) {
      const response = await call({ ...body, code, missionId: state.missions[0].id });
      assert(response.status === 200, 'Normal classroom request was blocked: ' + response.status);
    }
  }
}));

Deno.test('같은 학생의 이름·코드 반복 요청은 하나의 학생 한도로 제한한다', () => fixture(async ({ call, codes }) => {
  for (let i = 0; i < 12; i++) {
    assert((await call({ action: 'view', ...(i % 2 ? { code: codes[2] } : { studentName: '가상학생3' }) })).status === 200, 'Early identity limit');
  }
  assert((await call({ action: 'view', code: codes[2] })).status === 429, 'Repeated identity not limited');
  assert((await call({ action: 'view', code: codes[3] })).status === 200, 'Another student blocked');
}));

Deno.test('잘못된 이름 추측은 분당 40회로 제한하고 정상 학생은 계속 접속한다', () => fixture(async ({ call, codes }) => {
  for (let i = 0; i < 40; i++) assert((await call({ action: 'view', studentName: '없는학생' + i })).status === 404, 'Early failed limit');
  assert((await call({ action: 'view', studentName: '또없는학생' })).status === 429, 'Guessing not limited');
  assert((await call({ action: 'view', code: codes[2] })).status === 200, 'Valid request blocked after guesses');
}));

Deno.test('요청 제한 확인 오류에서 읽기·쓰기를 중단한다', () => fixture(async ({ call, flags, state, row, codes }) => {
  flags.limitError = true;
  const initial = row.encrypted_payload;
  assert((await call({ action: 'view', code: codes[2] })).status === 503, 'Limit failure allowed read');
  assert((await call({ action: 'mark', code: codes[2], missionId: state.missions[0].id, status: 'reported' })).status === 503, 'Limit failure allowed write');
  assert(row.encrypted_payload === initial, 'Limit failure wrote data');
}));

Deno.test('공개 저장의 버전 재시도는 학생 한도를 중복 차감하지 않는다', () => fixture(async ({ call, flags, state, limits, codes }) => {
  flags.conflicts = 2;
  assert((await call({ action: 'mark', code: codes[2], missionId: state.missions[0].id, status: 'reported' })).status === 200, 'Optimistic retry failed');
  assert(limits.filter((limit) => limit.max === 12).length === 1, 'Retry charged student more than once');
}));

Deno.test('같은 학교 IP의 두 학급 120명 참여를 학급별로 구분한다', () => fixture(async ({ call, codes, state, addClass }) => {
  const otherToken = await addClass();
  for (const code of codes) {
    for (const tokenPatch of [{}, { token: otherToken }]) {
      for (const body of [{ action: 'view' }, { action: 'mark', status: 'reported' }, { action: 'mark', status: 'unmarked' }, { action: 'view' }]) {
        assert((await call({ ...body, ...tokenPatch, code, missionId: state.missions[0].id })).status === 200, 'Classes incorrectly shared a low IP bucket');
      }
    }
  }
}));

Deno.test('학급·IP 한도는 유지하고 다른 학급의 정상 참여를 막지 않는다', () => fixture(async ({ call, codes, addClass }) => {
  for (let i = 0; i < 360; i++) assert((await call({ action: 'view', code: codes[i % codes.length] })).status === 200, 'Early class limit');
  assert((await call({ action: 'view', code: codes[0] })).status === 429, 'Class limit removed');
  const otherToken = await addClass();
  assert((await call({ action: 'view', token: otherToken, code: codes[0] })).status === 200, 'Other class blocked by class bucket');
}));
