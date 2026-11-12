import { beforeEach, describe, expect, test, vi } from 'vitest';
import { analysis, context, draft, sources } from '../fixtures/schoolPlan';
const auth = vi.hoisted(() => ({ getSession: vi.fn(), invoke: vi.fn() }));
vi.mock('../../src/utils/supabaseClient', () => ({ supabase: { auth: { getSession: auth.getSession }, functions: { invoke: auth.invoke } } }));
import { runPlanAi } from '../../src/features/schoolDocuments/planApi';

beforeEach(() => {
  auth.getSession.mockReset().mockResolvedValue({ data: { session: { user: { id: 'fixture', email: 'panthea0@gmail.com', email_confirmed_at: '2026-10-26T00:00:00Z', is_anonymous: false } } }, error: null });
  auth.invoke.mockReset().mockResolvedValue({ data: { analysis }, error: null });
});
describe('계획서 클라이언트 연결', () => {
  test('동의 후 원문 본문을 인증된 함수로 보내고 결과를 검증한다', async () => {
    expect(await runPlanAi({ action: 'analyze', sources }, undefined, true)).toEqual({ analysis });
    expect(auth.invoke).toHaveBeenCalledWith('school-plan', expect.objectContaining({ body: { action: 'analyze', sources, consent: true } }));
    auth.invoke.mockResolvedValue({ data: { draft }, error: null });
    expect(await runPlanAi({ action: 'draft', ...context }, undefined, true)).toEqual({ draft });
  });
  test('동의 누락·로그아웃·익명·인증 오류는 호출하지 않는다', async () => {
    await expect(runPlanAi({ action: 'analyze', sources })).rejects.toThrow(/동의/);
    expect(auth.getSession).not.toHaveBeenCalled();
    for (const session of [null, { user: { id: 'anon', is_anonymous: true } }]) {
      auth.getSession.mockResolvedValue({ data: { session }, error: null });
      await expect(runPlanAi({ action: 'analyze', sources }, undefined, true)).rejects.toThrow(/로그인/);
    }
    auth.getSession.mockResolvedValue({ data: { session: null }, error: new Error('auth') });
    await expect(runPlanAi({ action: 'analyze', sources }, undefined, true)).rejects.toThrow(/로그인/);
    expect(auth.invoke).not.toHaveBeenCalled();
  });
  test('서버 한도·연결 오류는 안내하고 원문과 내부 오류를 출력하지 않는다', async () => {
    auth.invoke.mockResolvedValue({ data: null, error: { context: new Response(JSON.stringify({ error: 'AI 요청 한도입니다.' }), { status: 429 }) } });
    await expect(runPlanAi({ action: 'analyze', sources }, undefined, true)).rejects.toThrow('AI 요청 한도');
    auth.invoke.mockResolvedValue({ data: null, error: new Error('private-internal-error') });
    await expect(runPlanAi({ action: 'analyze', sources }, undefined, true)).rejects.not.toThrow('private-internal-error');
  });
  test('일반 계정·미확인 이메일·프로필 역할 위장은 AI 함수를 호출하지 않는다', async () => {
    for (const user of [
      { id: 'teacher', email: 'teacher@example.invalid', email_confirmed_at: '2026-10-26T00:00:00Z' },
      { id: 'unconfirmed', email: 'panthea0@gmail.com' },
      { id: 'spoof', email: 'teacher@example.invalid', email_confirmed_at: '2026-10-26T00:00:00Z', user_metadata: { role: 'admin', email: 'panthea0@gmail.com' } },
    ]) {
      auth.getSession.mockResolvedValue({ data: { session: { user } }, error: null });
      await expect(runPlanAi({ action: 'analyze', sources }, undefined, true)).rejects.toThrow(/관리자/);
    }
    expect(auth.invoke).not.toHaveBeenCalled();
  });
  test('취소된 요청·잘못된 응답은 원고에 반영하지 않는다', async () => {
    const c = new AbortController(); c.abort();
    await expect(runPlanAi({ action: 'analyze', sources }, c.signal, true)).rejects.toThrow();
    expect(auth.invoke).not.toHaveBeenCalled();
    auth.invoke.mockResolvedValue({ data: { draft: {} }, error: null });
    await expect(runPlanAi({ action: 'draft', ...context }, undefined, true)).rejects.toThrow();
  });
});
