import { expect, test, vi } from 'vitest';
import { PLAN_REFERENCE_PROFILES, type PlanReferenceType } from '../../supabase/functions/_shared/schoolPlanReferences';
import { PLAN_PAGE_OPTIONS, type PlanRequest, type PlanDraft } from '../../supabase/functions/_shared/schoolPlan';
import { PLAN_AUTHORING_PROFILES } from '../../supabase/functions/school-plan/authoringProfiles';
import { composePlanDraft, PLAN_PAGE_BUDGETS, planDepthIssues } from '../../supabase/functions/school-plan/composition';
import { buildPlanAiRequest, requestPlanAi } from '../../supabase/functions/school-plan/openai';
import { createPlanHandler, PlanError } from '../../supabase/functions/school-plan/core';
import { pageVolumeIssues } from '../../src/features/officialDocument/lint';
import { volumeFixture } from '../fixtures/schoolPlanVolume';

const base = { sources: [], analysis: null, answers: {}, conditions: { topic: '가상 운영계획', timing: '', budget: 0 } };
const request: PlanRequest = { action: 'draft', ...base, pages: 5, referenceType: 'teacher-training' };
const completed = (data: unknown) => new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(data) }] }] }));

test('8개 유형의 필수 키·작성 지침·실제 목차가 동일한 계약을 따른다', () => {
  const keys = new Set<string>();
  for (const p of PLAN_REFERENCE_PROFILES) {
    const type = p.id as PlanReferenceType;
    const built = buildPlanAiRequest({ ...request, referenceType: type }, 'test');
    const schema = built.text.format.schema as { properties: { body: { required: string[] } } };
    const headings = (composePlanDraft(volumeFixture(5, type), type, 5) as PlanDraft).sections.map(s => s.heading.replace('(안)', ''));
    expect(headings).toEqual(p.outline);
    for (const s of PLAN_AUTHORING_PROFILES[type].sections) {
      expect(schema.properties.body.required).toContain(s.key);
      expect(built.instructions).toContain(`body.${s.key} → ${s.heading}`);
      expect(built.instructions).toContain(s.requiredContent);
    }
    keys.add(schema.properties.body.required.join(','));
    expect(built.instructions).toContain('[학교 문서 공통 원칙]');
    expect(built.instructions).toContain('[문서 종류: 운영계획서]');
    expect(built.instructions).not.toContain('paragraphs 1~4');
    expect(built.input[0].content[0].text).not.toContain('1~2쪽 요약 초안');
  }
  expect(keys.size).toBe(8);
});

test('1~5쪽 모두 최소 내용·목표 분량과 실행 깊이가 증가한다', () => {
  let previous = 0;
  for (const pages of PLAN_PAGE_OPTIONS) {
    const b = PLAN_PAGE_BUDGETS[pages];
    expect(b.minBodyChars).toBeGreaterThan(previous);
    expect(b.targetBodyChars).toBeGreaterThan(b.minBodyChars);
    const draft = composePlanDraft(volumeFixture(pages), 'general', pages) as PlanDraft;
    expect(planDepthIssues(draft.sections, 'general', pages)).toEqual([]);
    expect(buildPlanAiRequest({ ...request, pages }, 'test').instructions).toContain(`최소 ${b.minBodyChars}자`);
    previous = b.minBodyChars;
  }
});

test('5쪽 요청에 짧은 응답이 오면 부족 이유를 보내 한 번 보완하고 사용량을 확인한다', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(completed(volumeFixture(1, 'teacher-training'))).mockResolvedValueOnce(completed(volumeFixture(5, 'teacher-training')));
  const quota = vi.fn(async () => {});
  const result = await requestPlanAi(request, 'test', 'test', fetcher, undefined, quota);
  expect(result.draft?.sections.find(s => s.id === 'trainingModules')?.paragraphs).toHaveLength(8);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(quota).toHaveBeenCalledTimes(1);
  const retry = JSON.parse(fetcher.mock.calls[1][1].body);
  const data = JSON.parse(retry.input[0].content[0].text);
  expect(data.correction.issues.join(' ')).toContain('4100');
  expect(data.conditions).toEqual(base.conditions);
  expect(data.pages).toBe(5);
});

test('보완 후에도 짧으면 실패로 남기며 반복 호출하지 않는다', async () => {
  const fetcher = vi.fn(async () => completed(volumeFixture(1, 'teacher-training')));
  await expect(requestPlanAi(request, 'PRIVATE_KEY', 'test', fetcher)).rejects.toMatchObject({ status: 502, message: expect.stringContaining('충분히 작성하지 못했습니다') });
  expect(fetcher).toHaveBeenCalledTimes(2);
});

test('보완 사용량 거부·취소·공급자 오류는 다시 호출하지 않는다', async () => {
  const fetcher = vi.fn(async () => completed(volumeFixture(1, 'teacher-training')));
  await expect(requestPlanAi(request, 'test', 'test', fetcher, undefined, async () => { throw new PlanError(429, '사용량 제한'); })).rejects.toMatchObject({ status: 429 });
  expect(fetcher).toHaveBeenCalledTimes(1);
  const failure = vi.fn(async () => new Response('internal', { status: 500 }));
  await expect(requestPlanAi(request, 'test', 'test', failure)).rejects.toMatchObject({ status: 502 });
  expect(failure).toHaveBeenCalledTimes(1);
  const controller = new AbortController();
  const cancel = vi.fn(async () => { controller.abort(); return completed(volumeFixture(1, 'teacher-training')); });
  await expect(requestPlanAi(request, 'test', 'test', cancel, controller.signal)).rejects.toMatchObject({ status: 499 });
  expect(cancel).toHaveBeenCalledTimes(1);
});

test('서버도 자동 보완의 사용량을 추가로 차감하고 실패 시 중단한다', async () => {
  const quota = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
  const fetcher = vi.fn(async () => completed(volumeFixture(1, 'teacher-training')));
  const handler = createPlanHandler({ authorize: async () => 'teacher', consumeQuota: quota, run: (r, signal, beforeRetry) => requestPlanAi(r, 'test', 'test', fetcher, signal, beforeRetry) });
  const response = await handler(new Request('https://test.invalid', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...request, consent: true }) }));
  expect(response.status).toBe(429);
  expect(quota).toHaveBeenCalledTimes(2);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test('선택한 쪽 수보다 짧거나 마지막 쪽이 덜 찬 것은 알리지 않고, 넘칠 때만 알린다', () => {
  expect(pageVolumeIssues({ fills: [.8, .4], bodyPages: 2 }, 5)).toEqual([]);
  expect(pageVolumeIssues({ fills: [.8, .4], bodyPages: 2 }, 2)).toEqual([]);
  expect(pageVolumeIssues({ fills: [.9, .9, .3], bodyPages: 3 }, 2)[0].message).toContain('1쪽 많은 3쪽');
});
