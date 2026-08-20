import { describe, expect, test } from 'vitest';

interface PublicParticipant {
  id: string;
  name: string;
  values: Record<string, string>;
  signed: boolean;
}

interface PublicResponse {
  error?: string;
  participants?: PublicParticipant[];
  registry?: {
    hasPassword: boolean;
    status: string;
  };
}

const requiredEnv = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} 환경 변수가 필요합니다.`);
  return value;
};

const supabaseUrl = requiredEnv('VITE_SUPABASE_URL');
const publishableKey = requiredEnv('VITE_SUPABASE_ANON_KEY');
const publicToken = requiredEnv('REGISTRY_TEST_PUBLIC_TOKEN');
const registryPassword = requiredEnv('REGISTRY_TEST_PASSWORD');
const participantQuery = requiredEnv('REGISTRY_TEST_PARTICIPANT_QUERY');

const functionUrl = `${supabaseUrl}/functions/v1/registry-public`;
const restUrl = `${supabaseUrl}/rest/v1/registries`;
const publicHeaders = {
  apikey: publishableKey,
  Authorization: `Bearer ${publishableKey}`,
};

const invoke = async (body: Record<string, unknown>) => {
  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      ...publicHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token: publicToken, ...body }),
  });
  const data = await response.json() as PublicResponse;
  return { data, status: response.status };
};

const onePixelPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

describe('원격 등록부 공개 API 경계', () => {
  test('비밀번호, 병렬 중복 제출, 요청 제한을 서버에서 강제한다', async () => {
    const anonymousRead = await fetch(`${restUrl}?select=id&limit=1`, {
      headers: publicHeaders,
    });
    expect(anonymousRead.status).toBe(200);
    expect(await anonymousRead.json()).toEqual([]);

    const anonymousWrite = await fetch(restUrl, {
      method: 'POST',
      headers: {
        ...publicHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'RLS boundary probe' }),
    });
    expect(anonymousWrite.status).toBe(401);

    const metadata = await invoke({ action: 'metadata' });
    expect(metadata.status).toBe(200);
    expect(metadata.data.registry).toMatchObject({ hasPassword: true, status: 'open' });

    const wrongPassword = await invoke({
      action: 'unlock',
      password: `wrong-${Date.now()}`,
    });
    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.data.error).toContain('비밀번호');

    const correctPassword = await invoke({
      action: 'unlock',
      password: registryPassword,
    });
    expect(correctPassword.status).toBe(200);

    const search = await invoke({
      action: 'search',
      password: registryPassword,
      query: participantQuery,
    });
    expect(search.status).toBe(200);
    expect(search.data.participants).toHaveLength(1);
    const participant = search.data.participants?.[0];
    if (!participant) throw new Error('병렬 제출에 사용할 참석자를 찾지 못했습니다.');
    expect(participant.signed).toBe(false);

    const submission = {
      action: 'submit',
      password: registryPassword,
      participantId: participant.id,
      dataUrl: onePixelPng,
      source: 'draw',
      values: participant.values,
      width: 1,
      height: 1,
    };
    const concurrent = await Promise.all([invoke(submission), invoke(submission)]);
    expect(concurrent.map(({ status }) => status).sort()).toEqual([200, 409]);
    expect(concurrent.find(({ status }) => status === 409)?.data.error).toContain('이미 서명');

    const signedSearch = await invoke({
      action: 'search',
      password: registryPassword,
      query: participantQuery,
    });
    expect(signedSearch.status).toBe(200);
    expect(signedSearch.data.participants?.[0]?.signed).toBe(true);

    const unlockStatuses: number[] = [];
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const result = await invoke({ action: 'unlock', password: registryPassword });
      unlockStatuses.push(result.status);
      if (result.status === 429) break;
    }
    const firstLimitedRequest = unlockStatuses.indexOf(429);
    expect(firstLimitedRequest).toBeGreaterThanOrEqual(0);
    expect(unlockStatuses.slice(0, firstLimitedRequest).every((status) => status === 200)).toBe(true);
  });
});

describe('공개 화면으로 나가는 값은 서버에서 가려진다', () => {
  // 예전에는 서버가 원문을 보내고 브라우저가 별표로 덮어 보여줬다. 화면만 가려질 뿐
  // 응답에는 원문이 그대로 있어, 링크를 아는 사람이 검색을 반복하면 명단을 긁을 수 있었다.
  test('검색 결과의 이름과 항목 값에 원문이 남지 않는다', async () => {
    const result = await invoke({
      action: 'search',
      password: registryPassword,
      query: participantQuery,
    });
    expect(result.status).toBe(200);

    const participants = result.data.participants ?? [];
    expect(participants.length).toBeGreaterThan(0);
    participants.forEach((participant) => {
      // 가린 이름에는 반드시 별표가 들어간다. 한 글자 이름은 통째로 별표가 된다.
      expect(participant.name).toContain('*');
      // 검색어를 그대로 되돌려주면 가려지지 않은 것이다.
      expect(participant.name).not.toBe(participantQuery);
      Object.values(participant.values).forEach((value) => {
        if (value !== '') expect(value).toContain('*');
      });
    });
  });

  test('안내 정보만 물으면 명단이 딸려 오지 않는다', async () => {
    const result = await invoke({ action: 'metadata' });
    expect(result.status).toBe(200);
    expect(result.data.participants).toBeUndefined();
  });
});
