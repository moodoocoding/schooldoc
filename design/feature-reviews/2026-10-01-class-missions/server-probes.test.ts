// Review probes assert the observed defects, not the desired future behavior.
// All HTTP calls are mocked; do not grant network permission.
import { handleClassMissions } from '../../../supabase/functions/_shared/classMissionsServer.ts';
import { hashMissionCode, missionToday, parseMissionRoster, type StoredMissionState } from '../../../supabase/functions/_shared/classMissions.ts';
import { createPayloadCrypto } from '../../../supabase/functions/_shared/payloadCrypto.ts';

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
  const roster = parseMissionRoster('1 가상동명\n2 가상동명');
  const codes = ['ABCDEFGHJKLM', 'MNPQRSTUVWXZ'];
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
  const buckets = new Map<string, number>();
  const limits: { max: number; seconds: number }[] = [];
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    assert(url.hostname === 'mission-review.invalid', 'Unexpected real HTTP call');
    if (url.pathname.endsWith('/rpc/consume_registry_rate_limit')) {
      const body = await request.json();
      const count = (buckets.get(body.p_request_key) ?? 0) + 1;
      buckets.set(body.p_request_key, count);
      limits.push({ max: body.p_max_requests, seconds: body.p_window_seconds });
      return json(count <= body.p_max_requests);
    }
    if (url.pathname.endsWith('/class_mission_boards')) {
      if (request.method === 'GET') return json([row]);
      if (request.method === 'PATCH') {
        const body = await request.json();
        assert(url.searchParams.get('version') === `eq.${row.version}`, 'Unexpected version');
        Object.assign(row, body);
        return json([{ id: row.id }]);
      }
    }
    throw new Error(`Unexpected mock request ${url.pathname}`);
  };
  const call = (body: Record<string, unknown>) => handleClassMissions(new Request('https://handler.invalid', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '192.0.2.1' },
    body: JSON.stringify({ token, ...body }),
  }), true);
  return { state, row, codes, seal, limits, call };
}

Deno.test('review: duplicate name marking updates the first student only', () => fixture(async ({ state, row, seal, call, codes }) => {
  const response = await call({ action: 'mark', studentName: '가상동명', missionId: state.missions[0].id, status: 'reported' });
  assert(response.status === 200, 'Duplicate name was rejected instead of silently selected');
  const saved = await seal.decryptPayload<StoredMissionState>(row.encrypted_payload);
  assert(saved.checks.length === 1 && saved.checks[0].studentId === state.roster[0].id, 'Expected first student update');
  const second = await call({ action: 'view', code: codes[1] });
  assert((await second.json()).missions[0].check === 'unmarked', 'Second student unexpectedly updated');
}));

Deno.test('review: 24 students sharing an IP exceed the 40-request classroom limit', () => fixture(async ({ state, limits, call }) => {
  const statuses = [];
  // Count 24 view + 24 mark calls from one fictional school IP inside one window.
  // Repeated fictional identity keeps the probe focused on the IP bucket.
  for (let i = 0; i < 24; i++) {
    statuses.push((await call({ action: 'view', studentName: '가상동명' })).status);
    statuses.push((await call({ action: 'mark', studentName: '가상동명', missionId: state.missions[0].id, status: 'reported' })).status);
  }
  assert(statuses.filter((status) => status === 200).length === 40, 'Unexpected successful request count');
  assert(statuses.filter((status) => status === 429).length === 8, 'Expected 8 requests blocked');
  assert(limits.some((limit) => limit.max === 40 && limit.seconds === 60), 'IP limit contract changed');
}));
