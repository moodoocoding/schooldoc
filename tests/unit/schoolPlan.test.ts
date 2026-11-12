import { describe, expect, test, vi } from 'vitest';
import { planBudgetTotal, validatePlanAnalysis, validatePlanContext, validatePlanDraft, validatePlanSources } from '../../supabase/functions/_shared/schoolPlan';
import { authorizePlanRequest, createPlanHandler, PlanError, readPlanRequest, validatePlanResult } from '../../supabase/functions/school-plan/core';
import { analysis, context, draft, sources } from '../fixtures/schoolPlan';
import { loadPlanState, savePlanState, emptyPlanState, planStorageKey } from '../../src/features/schoolDocuments/planStore';
import { paginatePlanBlocks, planOutputBlocks } from '../../src/features/schoolDocuments/planHwpx';
import { readHwpxArchive } from '../../src/features/schoolDocuments/planSourceImport';
import { zipSync } from 'fflate';
const request = (body: unknown = { action: 'analyze', sources }) => new Request('https://schooldoc.invalid', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer test-token' }, body: JSON.stringify(body && typeof body === 'object' ? { consent: true, ...body } : body) });

describe('계획서 근거·예산·출력 계약', () => {
  test('압축 파일의 항목 수와 전체 해제 크기를 읽기 전에 제한한다', () => {
    const many = zipSync(Object.fromEntries(Array.from({ length: 2001 }, (_, i) => [`part${i}`, new Uint8Array([0])])));
    const large = zipSync({ 'Contents/section0.xml': new Uint8Array(20 * 1024 * 1024 + 1) });
    expect(() => readHwpxArchive(many)).toThrow(/너무 큽니다/);
    expect(() => readHwpxArchive(large)).toThrow(/너무 큽니다/);
    expect(() => validatePlanSources(Array.from({ length: 4 }, (_, i) => ({ ...sources[0], id: `s${i}` })))).toThrow();
  });
  test('실제 인용과 요구사항 연결이 있는 초안만 받는다', () => {
    expect(validatePlanAnalysis(analysis, sources)).toEqual(analysis);
    expect(validatePlanDraft(draft, context)).toEqual(draft);
    expect(planBudgetTotal(draft)).toBe(200000);
    expect(() => validatePlanAnalysis({ ...analysis, requirements: [{ ...analysis.requirements[0], quote: '공문에 없는 인용' }] }, sources)).toThrow(/원문/);
    expect(() => validatePlanDraft({ ...draft, sections: draft.sections.map(s => ({ ...s, requirementIds: [] })), schedule: [], budget: [] }, context)).toThrow();
    const missing = { ...draft, sections: draft.sections.filter(s => s.id !== 'report'), schedule: draft.schedule.filter(s => !s.requirementIds.includes('r3')) };
    expect(() => validatePlanDraft(missing, context)).toThrow(/필수/);
    expect(() => validatePlanDraft({ ...draft, schedule: [{ ...draft.schedule[0], requirementIds: ['fabricated'] }] }, context)).toThrow(/근거/);
  });
  test('원문 금액과 다른 상한·초과 예산·미정인 예산표를 거부한다', () => {
    expect(() => validatePlanAnalysis({ ...analysis, budgetLimit: { amount: 500000, requirementId: 'r4' } }, sources)).toThrow(/금액/);
    expect(() => validatePlanContext({ ...context, conditions: { ...context.conditions, budget: 300001 } })).toThrow(/상한/);
    for (const pages of [1, 2, 3, 4, 5]) expect(validatePlanContext({ ...context, pages } as typeof context).pages).toBe(pages);
    expect(() => validatePlanContext({ ...context, pages: 6 } as unknown as typeof context)).toThrow(/출력 분량/);
    expect(() => validatePlanDraft(draft, { ...context, conditions: { ...context.conditions, budget: 100000 } })).toThrow(/학교 예산/);
    for (const budget of [0, null]) expect(() => validatePlanDraft(draft, { ...context, conditions: { ...context.conditions, budget } })).toThrow(/금액표/);
    expect(() => validatePlanDraft({ ...draft, budget: [{ ...draft.budget[0], unitPrice: 3.14 }] }, context)).toThrow();
  });
  test('선택하지 않은 영역을 바꾼 수정안은 반영하지 않는다', () => {
    const req = { action: 'revise', ...context, draft, revision: { area: 'schedule', instruction: '준비를 앞당겨 주세요.' } } as const;
    const revised = { ...draft, schedule: draft.schedule.map((s, i) => i ? s : { ...s, when: '10월 셋째 주(안)' }) };
    expect(validatePlanResult(req, { draft: revised })).toEqual({ draft: revised });
    expect(() => validatePlanResult(req, { draft: { ...revised, title: '다른 제목' } })).toThrow(/선택하지 않은/);
  });
  test('큰 본문·중복 ID·유효하지 않은 입력은 AI 호출 전에 거부한다', async () => {
    expect(() => validatePlanSources([{ ...sources[0], parts: [{ id: 'p', label: '본문', text: '가'.repeat(8001) }] }])).toThrow();
    expect(() => validatePlanSources([...sources, ...sources])).toThrow(/중복/);
    await expect(readPlanRequest(request({ action: 'arbitrary', ...context }))).rejects.toMatchObject({ status: 422 });
    const oversized = request(); oversized.headers.set('content-length', '9999999');
    await expect(readPlanRequest(oversized)).rejects.toMatchObject({ status: 413 });
    const stream = new Request('https://test.invalid', { method: 'POST', body: 'a'.repeat(400000), headers: { 'content-type': 'application/json' } });
    await expect(readPlanRequest(stream)).rejects.toMatchObject({ status: 413 });
  });
  test('로그아웃·익명·위조 사용자 ID와 한도 오류는 모델을 호출하지 않는다', async () => {
    const verify = vi.fn(async () => ({ data: { user: { id: 'verified', email: 'panthea0@gmail.com', email_confirmed_at: '2026-10-26T00:00:00Z' } }, error: null }));
    expect(await authorizePlanRequest(request({ userId: 'spoof' }), verify)).toBe('verified');
    await expect(authorizePlanRequest(new Request('https://test.invalid'), verify)).rejects.toMatchObject({ status: 401 });
    await expect(authorizePlanRequest(request(), async () => ({ data: { user: { id: 'x', is_anonymous: true } }, error: null }))).rejects.toMatchObject({ status: 403 });
    const run = vi.fn(async () => ({ analysis })), consumeQuota = vi.fn(async () => true);
    expect((await createPlanHandler({ authorize: async () => { throw new PlanError(401, '로그인'); }, consumeQuota, run })(request())).status).toBe(401);
    expect(consumeQuota).not.toHaveBeenCalled(); expect(run).not.toHaveBeenCalled();
    for (const quota of [async () => false, async () => { throw new PlanError(503, '사용량 확인 실패'); }]) {
      expect((await createPlanHandler({ authorize: async () => 'u', consumeQuota: quota, run })(request())).status).toBeGreaterThanOrEqual(429);
    }
    expect(run).not.toHaveBeenCalled();
  });
  test('검증된 결과만 no-store로 반환하며 내부 오류는 숨긴다', async () => {
    const deps = { authorize: async () => 'u', consumeQuota: async () => true, run: async () => ({ analysis }) };
    const response = await createPlanHandler(deps)(request());
    expect(response.headers.get('cache-control')).toBe('no-store'); expect(await response.json()).toEqual({ analysis });
    const failed = await createPlanHandler({ ...deps, run: async () => { throw new Error('private-document-and-key'); } })(request());
    expect(failed.status).toBe(502); expect(await failed.text()).not.toContain('private-document-and-key');
  });
  test('내용을 지우거나 글자를 줄이지 않고 쪽 수 한계를 알린다', () => {
    const blocks = planOutputBlocks(draft, draft.title);
    expect(blocks.map(b => b.text).join('\n')).toContain('합계 200,000원');
    expect(paginatePlanBlocks(blocks, 2)).toBeGreaterThan(2);
    expect(() => paginatePlanBlocks([...blocks, ...blocks, ...blocks, ...blocks], 2)).toThrow(/2쪽/);
    expect(blocks[0].text).toContain('[초안]');
  });
  test('계정별 초안을 분리하고 손상된 기록은 복구용으로 보존한다', () => {
    const map = new Map<string, string>(); const storage = { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => { map.set(key, value); } };
    const state = emptyPlanState(); state.conditions.topic = '가상 주제';
    expect(savePlanState('one', state, storage)).toBe(true);
    expect(loadPlanState('one', storage).state.conditions.topic).toBe('가상 주제');
    expect(loadPlanState('two', storage).state.conditions.topic).toBe('');
    storage.setItem(planStorageKey('one'), 'damaged');
    expect(loadPlanState('one', storage).warning).toContain('복구용');
    expect(storage.getItem(`${planStorageKey('one')}:recovery`)).toBe('damaged');
    expect(savePlanState('x', state, { setItem: () => { throw new Error('full'); } })).toBe(false);
  });
});
