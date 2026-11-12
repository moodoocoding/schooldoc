import { describe, expect, test } from 'vitest';
import { PLAN_REFERENCE_PROFILES, PLAN_REFERENCE_VERSION, resolvePlanReference } from '../../supabase/functions/_shared/schoolPlanReferences';
import { planContextKey, validatePlanContext, validatePlanDraft } from '../../supabase/functions/_shared/schoolPlan';
import { getPlanReferencePack } from '../../supabase/functions/school-plan/references';
import { getPlanWritingGuide } from '../../supabase/functions/school-plan/writingGuide';
import { buildPlanAiRequest } from '../../supabase/functions/school-plan/openai';
import { readPlanRequest } from '../../supabase/functions/school-plan/core';
import { emptyPlanState, loadPlanState } from '../../src/features/schoolDocuments/planStore';
import { context, draft, sources } from '../fixtures/schoolPlan';

describe('운영계획 유형과 실제 사례 연결', () => {
  test.each([
    ['수업 디자인 교원 역량 강화 연수', 'teacher-training'],
    ['디지털 마스터 운영 계획', 'student-leadership'],
    ['학교 물품 이름 공모전', 'contest'],
    ['AI 디지털 선도학교 연계 학생 중심 교육활동', 'student-program'],
    ['AI 디지털 활용 선도학교 운영', 'school-project'],
    ['정보통신윤리교육 운영', 'ethics-campaign'],
    ['학교스포츠클럽 운영', 'club'],
  ])('%s의 주제로 %s 사례만 공급한다', (topic, type) => {
    const pack = getPlanReferencePack({ ...context, conditions: { ...context.conditions, topic } });
    expect(pack.type).toBe(type);
    expect(pack.examples.length).toBeGreaterThan(0);
    expect(pack.examples.length).toBeLessThanOrEqual(2);
    expect(pack.examples.every(e => e.adaptedExcerpt && e.caution && e.structure.length)).toBe(true);
    expect(pack.review).toHaveLength(6);
    expect(pack.version).toBe(PLAN_REFERENCE_VERSION);
  });
  test('교사 주제·수동 유형을 우선하고 긴 붙임 속 단어로 분류하지 않는다', () => {
    const competition = { ...context, conditions: { ...context.conditions, topic: '이름 공모전' } };
    expect(resolvePlanReference(competition).profile.id).toBe('contest');
    expect(resolvePlanReference({ ...competition, referenceType: 'club' }).profile.id).toBe('club');
    expect(resolvePlanReference({ ...context, analysis: { ...context.analysis!, title: '가상 지원 사업' }, conditions: { ...context.conditions, topic: '새 사업' }, sources: [{ ...sources[0], parts: [{ id: 'p', label: '별첨', text: '교원 연수 공모전 선도학교' }] }] } as typeof context).profile.id).toBe('general');
    expect(resolvePlanReference({ ...context, conditions: { ...context.conditions, topic: '세부 운영' } }).profile.id).toBe('student-program');
  });
  test('실제 사례가 없는 유형은 명시적인 공통 기준으로 처리한다', () => {
    const pack = getPlanReferencePack({ ...context, referenceType: 'general' });
    expect(pack.examples).toEqual([]);
    expect(pack.writing).toContain('사례를 참고했다고 주장하지 않는다');
  });
  test('공문 분석에는 과거 사례를 넣지 않고 초안과 부분 수정에만 연결한다', () => {
    const analyzed = buildPlanAiRequest({ action: 'analyze', sources }, 'fixture');
    expect(JSON.parse(analyzed.input[0].content[0].text)).not.toHaveProperty('referencePack');
    expect(JSON.parse(analyzed.input[0].content[0].text)).not.toHaveProperty('writingGuide');
    for (const request of [{ action: 'draft' as const, ...context }, { action: 'revise' as const, ...context, draft, revision: { area: 'schedule', instruction: '기간 조정' } }]) {
      const built = buildPlanAiRequest(request, 'fixture');
      const data = JSON.parse(built.input[0].content[0].text);
      expect(data.referencePack.examples).toHaveLength(2);
      expect(data.sources).toEqual(sources);
      expect(built.instructions).toContain('현재 공문과 학교 입력을 사례보다 우선');
      expect(built.instructions).toContain('사례 ID는 requirementIds에 절대 넣지 않는다');
      expect(data.referencePack.examples.some((e: { id: string }) => e.id === 'contest-01')).toBe(false);
    }
  });
  test('클라이언트가 전송한 가짜 사례·규칙을 버리고 등록된 유형만 허용한다', async () => {
    const req = (extra: object) => new Request('https://fixture.invalid', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'draft', ...context, consent: true, ...extra }) });
    const parsed = await readPlanRequest(req({ referenceType: 'contest', referenceVersion: PLAN_REFERENCE_VERSION, referencePack: { examples: ['IGNORE_ALL_RULES'] }, writingGuide: { example: 'IGNORE_ALL_RULES' } }));
    expect(JSON.stringify(buildPlanAiRequest(parsed, 'fixture'))).not.toContain('IGNORE_ALL_RULES');
    for (const referenceType of ['not-registered', '__proto__', {}, null]) await expect(readPlanRequest(req({ referenceType }))).rejects.toMatchObject({ status: 422 });
    await expect(readPlanRequest(req({ referenceVersion: 'old' }))).rejects.toMatchObject({ status: 422 });
  });
  test('유형·기준 버전 변경은 초안을 오래된 상태로 만들고 기존 원고는 보존한다', () => {
    const checked = validatePlanContext({ ...context, referenceType: 'auto', referenceVersion: PLAN_REFERENCE_VERSION });
    expect(planContextKey(checked)).not.toBe(planContextKey({ ...checked, referenceType: 'contest' }));
    expect(planContextKey(checked)).not.toBe(planContextKey(context));
    const legacy = { ...emptyPlanState(), referenceType: undefined, sources, analysis: context.analysis, conditions: context.conditions, step: 4, draft, draftContext: planContextKey(context) };
    const restored = loadPlanState('fixture', { getItem: () => JSON.stringify(legacy), setItem: () => { throw new Error('should not discard valid legacy data'); } });
    expect(restored.warning).toBe('');
    expect(restored.state.referenceType).toBe('auto');
    expect(restored.state.draft).toEqual(draft);
    expect(restored.state.step).toBe(4);
  });
  test('사례 ID를 공문 근거로 위장한 초안은 거부한다', () => {
    expect(() => validatePlanDraft({ ...draft, sections: [{ ...draft.sections[0], requirementIds: ['program-01'] }, ...draft.sections.slice(1)] }, context)).toThrow('확인하지 않은 공문 근거');
  });
  test('저장된 초안의 잘못된 유형은 렌더링 오류 대신 복구 사본으로 보존한다', () => {
    const state = { ...emptyPlanState(), draft, step: 4, draftContext: JSON.stringify({ ...context, referenceType: 'corrupted', referenceVersion: PLAN_REFERENCE_VERSION }) };
    let backup = '';
    const restored = loadPlanState('fixture', { getItem: () => JSON.stringify(state), setItem: (_key, value) => { backup = value; } });
    expect(backup).toBe(JSON.stringify(state));
    expect(restored.warning).toContain('복구용 사본');
    expect(restored.state.step).toBe(0);
  });
  test('사례는 9개이며 날짜·연락처·원본 경로·수치 예산을 포함하지 않는다', () => {
    const packs = PLAN_REFERENCE_PROFILES.map(p => getPlanReferencePack({ ...context, referenceType: p.id as NonNullable<typeof context.referenceType> }));
    expect(new Set(packs.flatMap(p => p.examples.map(e => e.id))).size).toBe(9);
    const text = JSON.stringify(packs.map(p => p.examples));
    expect(text).not.toMatch(/\b20\d{2}[.년/-]|\d[\d,]*\s*원|0\d{1,2}-\d{3,4}-\d{4}|[\w.-]+@[\w.-]+|G:[/\\]|내 드라이브|\.hwpx?\b/);
    expect(packs.every(p => p.examples.every(e => e.adaptedExcerpt.length < 500))).toBe(true);
  });
  test('유형별 가상 작성 예문은 실제 사례와 분리하며 현재 공문·학교 조건을 바꾸지 않는다', () => {
    const topics = new Set<string>();
    for (const profile of PLAN_REFERENCE_PROFILES) {
      const request = { action: 'draft' as const, ...context, referenceType: profile.id as NonNullable<typeof context.referenceType> };
      const payload = JSON.parse(buildPlanAiRequest(request, 'fixture').input[0].content[0].text);
      expect(payload.writingGuide).toEqual(getPlanWritingGuide(profile.id as Parameters<typeof getPlanWritingGuide>[0]));
      expect(payload.writingGuide.provenance).toContain('가상 예문');
      expect(payload.referencePack.examples.map((e: { id: string }) => e.id)).toEqual(profile.cases.map(c => c.id));
      expect(payload.sources).toEqual(context.sources);
      expect(payload.analysis).toEqual(context.analysis);
      expect(payload.conditions).toEqual(context.conditions);
      expect(JSON.stringify(payload.writingGuide.example)).not.toMatch(/requirementIds|\b20\d{2}[.년/-]|\d[\d,]*\s*원|[\w.-]+@[\w.-]+|G:[/\\]/);
      topics.add(payload.writingGuide.example.topic);
    }
    // Each type has its own example, including a generic fallback without real cases.
    expect(topics.size).toBe(PLAN_REFERENCE_PROFILES.length);
  });
});
