import { afterAll, describe, expect, test } from 'vitest';

interface AuthUser {
  id: string;
  email?: string;
}

interface RegistryRow {
  id: string;
  owner_id: string;
  title: string;
  status: string;
}

const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim() ?? '';
const publishableKey = process.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';
const ownerAToken = process.env.REGISTRY_OWNER_A_ACCESS_TOKEN?.trim() ?? '';
const ownerBToken = process.env.REGISTRY_OWNER_B_ACCESS_TOKEN?.trim() ?? '';
const configured = Boolean(supabaseUrl && publishableKey && ownerAToken && ownerBToken);

const registryIds: Array<{ id: string; token: string }> = [];

const headers = (token: string, prefer?: string) => ({
  apikey: publishableKey,
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
  ...(prefer ? { Prefer: prefer } : {}),
});

const request = async <T>(
  path: string,
  token: string,
  init: RequestInit = {},
) => {
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers: {
      ...headers(token),
      ...init.headers,
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) as T : null as T;
  return { data, response };
};

const getUser = async (token: string) => {
  const { data, response } = await request<AuthUser>('/auth/v1/user', token);
  expect(response.status).toBe(200);
  return data;
};

const createRegistry = async (token: string, ownerId: string, title: string) => {
  const { data, response } = await request<RegistryRow[]>('/rest/v1/registries', token, {
    method: 'POST',
    headers: headers(token, 'return=representation'),
    body: JSON.stringify({
      owner_id: ownerId,
      mode: 'fixed',
      title,
      status: 'open',
      layout: 10,
      allow_walk_in: false,
    }),
  });
  expect(response.status).toBe(201);
  expect(data).toHaveLength(1);
  const registry = data[0];
  registryIds.push({ id: registry.id, token });
  return registry;
};

describe.skipIf(!configured)('교사별 등록부 owner RLS 경계', () => {
  afterAll(async () => {
    await Promise.all(registryIds.map(({ id, token }) => request(`/rest/v1/registries?id=eq.${id}`, token, {
      method: 'DELETE',
    })));
  });

  test('두 교사가 상대 등록부를 조회하거나 변경할 수 없다', async () => {
    const [ownerA, ownerB] = await Promise.all([getUser(ownerAToken), getUser(ownerBToken)]);
    expect(ownerA.id).not.toBe(ownerB.id);

    const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const registryA = await createRegistry(ownerAToken, ownerA.id, `RLS A ${suffix}`);
    const registryB = await createRegistry(ownerBToken, ownerB.id, `RLS B ${suffix}`);

    const columnId = crypto.randomUUID();
    const participantId = crypto.randomUUID();
    const [columnResult, participantResult] = await Promise.all([
      request('/rest/v1/registry_columns', ownerAToken, {
        method: 'POST',
        body: JSON.stringify({
          id: columnId,
          registry_id: registryA.id,
          key: columnId,
          label: '소속',
          position: 0,
        }),
      }),
      request('/rest/v1/registry_participants', ownerAToken, {
        method: 'POST',
        body: JSON.stringify({
          id: participantId,
          registry_id: registryA.id,
          row_number: 1,
          name: '격리 검증 참석자',
          field_values: { [columnId]: '격리 검증 학교' },
        }),
      }),
    ]);
    expect(columnResult.response.status).toBe(201);
    expect(participantResult.response.status).toBe(201);

    const [aSeesA, aSeesB, bSeesA, bSeesB] = await Promise.all([
      request<RegistryRow[]>(`/rest/v1/registries?id=eq.${registryA.id}&select=id,owner_id,title,status`, ownerAToken),
      request<RegistryRow[]>(`/rest/v1/registries?id=eq.${registryB.id}&select=id,owner_id,title,status`, ownerAToken),
      request<RegistryRow[]>(`/rest/v1/registries?id=eq.${registryA.id}&select=id,owner_id,title,status`, ownerBToken),
      request<RegistryRow[]>(`/rest/v1/registries?id=eq.${registryB.id}&select=id,owner_id,title,status`, ownerBToken),
    ]);
    expect(aSeesA.data.map(({ id }) => id)).toEqual([registryA.id]);
    expect(aSeesB.data).toEqual([]);
    expect(bSeesA.data).toEqual([]);
    expect(bSeesB.data.map(({ id }) => id)).toEqual([registryB.id]);

    const [hiddenColumns, hiddenParticipants] = await Promise.all([
      request<unknown[]>(`/rest/v1/registry_columns?registry_id=eq.${registryA.id}&select=id`, ownerBToken),
      request<unknown[]>(`/rest/v1/registry_participants?registry_id=eq.${registryA.id}&select=id`, ownerBToken),
    ]);
    expect(hiddenColumns.data).toEqual([]);
    expect(hiddenParticipants.data).toEqual([]);

    const foreignUpdate = await request<RegistryRow[]>(`/rest/v1/registries?id=eq.${registryA.id}`, ownerBToken, {
      method: 'PATCH',
      headers: headers(ownerBToken, 'return=representation'),
      body: JSON.stringify({ status: 'closed' }),
    });
    const foreignDelete = await request<RegistryRow[]>(`/rest/v1/registries?id=eq.${registryA.id}`, ownerBToken, {
      method: 'DELETE',
      headers: headers(ownerBToken, 'return=representation'),
    });
    expect(foreignUpdate.response.status).toBe(200);
    expect(foreignUpdate.data).toEqual([]);
    expect(foreignDelete.response.status).toBe(200);
    expect(foreignDelete.data).toEqual([]);

    const foreignColumn = await request('/rest/v1/registry_columns', ownerBToken, {
      method: 'POST',
      body: JSON.stringify({
        id: crypto.randomUUID(),
        registry_id: registryA.id,
        key: crypto.randomUUID(),
        label: '침범 열',
        position: 1,
      }),
    });
    expect([401, 403]).toContain(foreignColumn.response.status);

    const passwordChange = await request('/rest/v1/rpc/set_registry_password', ownerBToken, {
      method: 'POST',
      body: JSON.stringify({ p_registry_id: registryA.id, p_password: 'blocked-password' }),
    });
    expect(passwordChange.response.status).toBeGreaterThanOrEqual(400);

    const pdfRequest = await fetch(`${supabaseUrl}/functions/v1/registry-pdf`, {
      method: 'POST',
      headers: headers(ownerBToken),
      body: JSON.stringify({ registryId: registryA.id }),
    });
    expect(pdfRequest.status).toBe(404);

    const ownerConfirmation = await request<RegistryRow[]>(
      `/rest/v1/registries?id=eq.${registryA.id}&select=id,owner_id,title,status`,
      ownerAToken,
    );
    expect(ownerConfirmation.data).toMatchObject([{
      id: registryA.id,
      owner_id: ownerA.id,
      status: 'open',
    }]);
  });
});
