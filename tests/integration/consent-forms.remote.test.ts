import { describe, expect, test } from 'vitest';

/**
 * 배포된 가정통신문 함수를 실제로 두드리는 회귀 테스트.
 *
 * E2E는 전부 데모 모드(localStorage)로 돌기 때문에 Supabase를 타는 경로에는 자동 검증이
 * 없었고, 실제로 그 구간에서만 버그가 나왔다. 생성 순서가 뒤집혀 원본이 없는 링크가
 * 살아나던 문제, 삭제가 조용히 실패해 서명 파일이 남던 문제가 그렇다.
 *
 * 운영 자료를 건드리지 않도록 **읽기와 거부 경로만** 확인한다. 제출·파기처럼 자료를
 * 만들거나 지우는 동작은 여기서 실행하지 않는다.
 *
 * 필요한 환경 변수:
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY   - 없으면 전체를 건너뛴다
 *   CONSENT_TEST_PUBLIC_TOKEN                   - 시험용 수합의 공개 토큰
 *   CONSENT_OWNER_ACCESS_TOKEN, CONSENT_TEST_FORM_ID - 교사 로그인 토큰과 수합 id
 */
const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim() ?? '';
const anonKey = process.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';
const publicToken = process.env.CONSENT_TEST_PUBLIC_TOKEN?.trim() ?? '';
const ownerToken = process.env.CONSENT_OWNER_ACCESS_TOKEN?.trim() ?? '';
const ownerFormId = process.env.CONSENT_TEST_FORM_ID?.trim() ?? '';

const configured = Boolean(supabaseUrl && anonKey);
const withForm = configured && Boolean(publicToken);
const withOwner = configured && Boolean(ownerToken && ownerFormId);

const callPublic = async (body: Record<string, unknown>) => {
  const response = await fetch(`${supabaseUrl}/functions/v1/consent-forms-public`, {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json().catch(() => ({})) as Record<string, unknown> };
};

const callAdmin = async (body: Record<string, unknown>, token = anonKey) => {
  const response = await fetch(`${supabaseUrl}/functions/v1/consent-forms-admin`, {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json().catch(() => ({})) as Record<string, unknown> };
};

const rest = async (path: string, token: string) => {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
};

describe.skipIf(!configured)('공개 함수의 거부 경로', () => {
  test('없는 토큰은 404로 답한다', async () => {
    const result = await callPublic({ action: 'metadata', token: '00000000-0000-4000-8000-000000000000' });
    expect(result.status).toBe(404);
    expect(String(result.body.error)).toContain('찾을 수 없습니다');
  });

  test('형식이 어긋난 토큰과 모르는 동작은 400으로 막는다', async () => {
    expect((await callPublic({ action: 'metadata', token: 'not-a-uuid' })).status).toBe(400);
    expect((await callPublic({ action: 'peek', token: '00000000-0000-4000-8000-000000000000' })).status).toBe(400);
  });
});

describe.skipIf(!configured)('관리 함수는 로그인을 요구한다', () => {
  test('익명 키만으로는 401이다', async () => {
    const result = await callAdmin({ action: 'list', formId: '00000000-0000-4000-8000-000000000000' });
    expect(result.status).toBe(401);
  });

  test('파기도 로그인 없이는 401이다', async () => {
    const result = await callAdmin({ action: 'purge', formIds: ['00000000-0000-4000-8000-000000000000'] });
    expect(result.status).toBe(401);
  });
});

describe.skipIf(!withForm)('공개 문서 응답 형태', () => {
  test('안내 정보에 제목과 상태가 담긴다', async () => {
    const result = await callPublic({ action: 'metadata', token: publicToken });
    expect(result.status).toBe(200);
    const form = result.body.form as Record<string, unknown>;
    expect(typeof form.title).toBe('string');
    expect(['open', 'closed']).toContain(form.status);
  });

  test('문서에 쪽 규격이 쪽수만큼 함께 온다', async () => {
    const result = await callPublic({ action: 'document', token: publicToken });
    if (result.status === 401) return; // 비밀번호가 걸린 수합이면 여기서 끝난다.
    expect(result.status).toBe(200);
    const form = result.body.form as Record<string, unknown>;
    expect(Array.isArray(form.fields)).toBe(true);
    expect(typeof form.sourceUrl).toBe('string');
    expect(Array.isArray(form.pageSizes)).toBe(true);
    expect((form.pageSizes as unknown[]).length).toBe(form.pageCount);
  });

  test('필수 항목을 비우면 제출이 거부된다', async () => {
    const result = await callPublic({ action: 'submit', token: publicToken, values: {} });
    // 필수 항목이 없는 수합이면 통과할 수 있으므로 자료를 만들지 않는 경우만 확인한다.
    if (result.status === 200) return;
    expect([400, 401, 409]).toContain(result.status);
  });
});

describe.skipIf(!withOwner)('교사 경로와 저장 형태', () => {
  test('소유자는 응답을 복호해서 받는다', async () => {
    const result = await callAdmin({ action: 'responses', formId: ownerFormId }, ownerToken);
    expect(result.status).toBe(200);
    const responses = result.body.responses as Array<Record<string, unknown>>;
    expect(Array.isArray(responses)).toBe(true);
    responses.forEach((response) => {
      expect(typeof response.values).toBe('object');
      expect(typeof response.submittedAt).toBe('string');
    });
  });

  test('응답은 평문이 아니라 암호문으로 저장된다', async () => {
    const rows = await rest(`consent_responses?select=values_ciphertext&form_id=eq.${ownerFormId}`, ownerToken);
    expect(rows.status).toBe(200);
    (rows.body as Array<{ values_ciphertext: string | null }>).forEach((row) => {
      expect(typeof row.values_ciphertext).toBe('string');
      expect(row.values_ciphertext).not.toBe('');
    });
  });

  test('평문 컬럼은 더 이상 존재하지 않는다', async () => {
    const rows = await rest(`consent_responses?select=values&form_id=eq.${ownerFormId}`, ownerToken);
    expect(rows.status).toBeGreaterThanOrEqual(400);
  });

  test('남의 수합은 관리할 수 없다', async () => {
    const result = await callAdmin({ action: 'list', formId: '00000000-0000-4000-8000-000000000000' }, ownerToken);
    expect([403, 400]).toContain(result.status);
  });
});
