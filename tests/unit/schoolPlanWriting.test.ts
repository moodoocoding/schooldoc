import { expect, test, vi } from 'vitest';
import { PLAN_REFERENCE_PROFILES, type PlanReferenceType } from '../../supabase/functions/_shared/schoolPlanReferences';
import { PLAN_PAGE_OPTIONS, type PlanRequest } from '../../supabase/functions/_shared/schoolPlan';
import { PLAN_TYPE_GUIDES } from '../../supabase/functions/school-plan/authoringProfiles';
import { corePrompt, PLAN_PAGE_TARGETS, typeGuide } from '../../supabase/functions/school-plan/prompt';
import { buildPlanAiRequest, requestPlanAi, selectPlanAiModel } from '../../supabase/functions/school-plan/openai';
import { pageVolumeIssues } from '../../src/features/officialDocument/lint';
import { volumeFixture } from '../fixtures/schoolPlanVolume';

const base = { sources: [], analysis: null, answers: {}, conditions: { topic: '가상 운영계획', timing: '', budget: 0 } };
const request: PlanRequest = { action: 'draft', ...base, pages: 5, referenceType: 'teacher-training' };
const completed = (data: unknown) => new Response(JSON.stringify({ status: 'completed', usage: { input_tokens: 10, output_tokens: 20 }, output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(data) }] }] }));

test('모든 작업의 기본 모델은 gpt-6-luna이고 서버 설정을 우선한다', () => {
  expect(selectPlanAiModel('draft')).toBe('gpt-6-luna');
  expect(selectPlanAiModel('revise')).toBe('gpt-6-luna');
  expect(selectPlanAiModel('analyze')).toBe('gpt-6-luna');
  expect(selectPlanAiModel('draft', { model: 'shared', writingModel: ' writer ' })).toBe('writer');
  expect(selectPlanAiModel('draft', { model: 'shared' })).toBe('shared');
  expect(selectPlanAiModel('analyze', { model: 'shared', writingModel: 'writer' })).toBe('shared');
});

test('8개 유형 모두 같은 코어·응답 형식에 해당 유형의 짧은 점검 목록 하나만 붙인다', () => {
  const guides = new Set<string>();
  for (const p of PLAN_REFERENCE_PROFILES) {
    const type = p.id as PlanReferenceType;
    const built = buildPlanAiRequest({ ...request, referenceType: type }, 'test');
    expect(built.instructions).toBe(corePrompt);
    const guide = built.input[0].content[0].text;
    expect(guide).toBe(typeGuide(type));
    expect(guide).toContain(PLAN_TYPE_GUIDES[type].focus);
    for (const other of PLAN_REFERENCE_PROFILES.filter(o => o.id !== p.id)) expect(guide).not.toContain(`# 유형: ${other.label}`);
    expect(guide.length).toBeLessThan(400);
    expect(built).not.toHaveProperty('max_output_tokens');
    guides.add(guide);
  }
  expect(guides.size).toBe(8);
});

test('쪽 수는 분량 선호로만 전달하고 짧다고 다시 쓰게 하지 않는다', async () => {
  let previous = 0;
  for (const pages of PLAN_PAGE_OPTIONS) {
    const { bodyChars } = PLAN_PAGE_TARGETS[pages];
    expect(bodyChars).toBeGreaterThan(previous);
    expect(JSON.parse(buildPlanAiRequest({ ...request, pages }, 'test').input[1].content[0].text).outputPreferences).toMatchObject({ pages, approxBodyChars: bodyChars });
    previous = bodyChars;
  }
  const fetcher = vi.fn(async () => completed(volumeFixture(1)));
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  const result = await requestPlanAi(request, 'test', 'test', fetcher);
  expect(result.draft?.schemaVersion).toBe('2.0');
  expect(fetcher).toHaveBeenCalledTimes(1);
  // 사용량만 기록하고 원문·초안은 기록하지 않는다.
  expect(log).toHaveBeenCalledWith(expect.stringContaining('"input_tokens":10'));
  expect(JSON.stringify(log.mock.calls)).not.toContain('가상 학교 활동');
  log.mockRestore();
});

test('선택한 쪽 수보다 짧거나 마지막 쪽이 덜 찬 것은 알리지 않고, 넘칠 때만 알린다', () => {
  expect(pageVolumeIssues({ fills: [.8, .4], bodyPages: 2 }, 5)).toEqual([]);
  expect(pageVolumeIssues({ fills: [.8, .4], bodyPages: 2 }, 2)).toEqual([]);
  expect(pageVolumeIssues({ fills: [.9, .9, .3], bodyPages: 3 }, 2)[0].message).toContain('1쪽 많은 3쪽');
});
