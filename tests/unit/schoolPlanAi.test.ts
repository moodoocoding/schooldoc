import { describe, expect, test, vi } from 'vitest';
import { buildPlanAiRequest, requestPlanAi } from '../../supabase/functions/school-plan/openai';
import { consumePlanQuota } from '../../supabase/functions/school-plan/quota';
import { authorizePlanRequest, createPlanHandler, PlanError, readPlanRequest } from '../../supabase/functions/school-plan/core';
import { analysis, authoredDraft, context, draft, sources } from '../fixtures/schoolPlan';
import type { PlanRequest } from '../../supabase/functions/_shared/schoolPlan';

const analyze: PlanRequest = { action: 'analyze', sources };
const drafting: PlanRequest = { action: 'draft', ...context, referenceType: 'general' };
const completed = (value: unknown) => new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }] }));
const httpRequest = (body: Record<string, unknown>) => new Request('https://schooldoc.invalid', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('계획서 OpenAI 연결', () => {
  test('추출 본문만 strict JSON 계약으로 보내고 응답 저장을 끈다', async () => {
    const built = buildPlanAiRequest(analyze, 'fixture-model');
    expect(built).toMatchObject({ model: 'fixture-model', store: false, text: { format: { type: 'json_schema', strict: true } } });
    expect(built.input[0].content).toHaveLength(1);
    expect(built.input[0].content[0].type).toBe('input_text');
    expect(JSON.parse(built.input[0].content[0].text)).toEqual(analyze);
    const fetcher = vi.fn(async () => completed(analysis));
    expect(await requestPlanAi(analyze, 'fixture-secret', 'fixture-model', fetcher)).toEqual({ analysis });
    const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(options.headers).toMatchObject({ Authorization: 'Bearer fixture-secret' });
    expect(options.body).not.toContain('fixture-secret');
    expect(options.body).not.toContain('file_data');
    expect(options.body).not.toContain('base64');
  });
  test('본문 전체를 생성하고 필수 공문 근거와 예산을 검증한다', async () => {
    const result = await requestPlanAi(drafting, 'fixture', 'fixture', async () => completed(authoredDraft));
    expect(result.draft).toMatchObject({ title: draft.title, schedule: draft.schedule, budget: draft.budget, unknowns: draft.unknowns });
    const activities = result.draft!.sections.find(s => s.id === 'activities')!;
    expect(activities.paragraphs).toHaveLength(2);
    for (const [i, activity] of authoredDraft.body.activities.entries()) {
      expect(activities.paragraphs[i]).toContain(activity.procedure);
      expect(activities.paragraphs[i]).toContain(activity.result);
      expect(activities.paragraphs[i]).toContain('(방법안)');
    }
    const invalid = { ...authoredDraft, budget: [{ ...draft.budget[0], unitPrice: 99999999 }] };
    await expect(requestPlanAi(drafting, 'fixture', 'fixture', async () => completed(invalid))).rejects.toMatchObject({ status: 502 });
    await expect(requestPlanAi(analyze, 'fixture', 'fixture', async () => completed({ ...analysis, requirements: [{ ...analysis.requirements[0], quote: '공문에 없는 문구' }] }))).rejects.toMatchObject({ status: 502 });
  });
  test('진행 절차·결과물이 없는 활동은 완성된 초안으로 받지 않는다', async () => {
    for (const override of [{ procedure: '' }, { result: '' }, { methodKind: 'confirmed-by-teacher' }]) {
      const invalid = { ...authoredDraft, body: { ...authoredDraft.body, activities: [{ ...authoredDraft.body.activities[0], ...override }, authoredDraft.body.activities[1]] } };
      await expect(requestPlanAi(drafting, 'fixture', 'fixture', async () => completed(invalid))).rejects.toMatchObject({ status: 502 });
    }
    // A structurally valid legacy draft lacks the new provider's activity fields.
    // It remains valid as client input, but cannot masquerade as a newly authored response.
    await expect(requestPlanAi(drafting, 'fixture', 'fixture', async () => completed(draft))).rejects.toMatchObject({ status: 502 });
  });
  test('공문 분석에 없는 근거 ID(참고 사례 ID·지어낸 ID)는 초안을 실패시키지 않고 지운다', async () => {
    const forged = { ...authoredDraft, body: { ...authoredDraft.body, activities: [{ ...authoredDraft.body.activities[0], requirementIds: ['r2', 'training-01', 'made-up'] }, authoredDraft.body.activities[1]] },
      schedule: authoredDraft.schedule.map((row, i) => i ? row : { ...row, requirementIds: [...row.requirementIds, 'program-01'] }) };
    const result = await requestPlanAi(drafting, 'fixture', 'fixture', async () => completed(forged));
    const ids = [...result.draft!.sections, ...result.draft!.schedule, ...result.draft!.budget].flatMap(row => row.requirementIds);
    expect(ids.every(id => analysis.requirements.some(r => r.id === id))).toBe(true);
    expect(ids).not.toContain('training-01');
    // 필수 요구사항을 하나도 연결하지 못하면 여전히 실패한다.
    const unlinked = { ...authoredDraft, body: { ...authoredDraft.body, effects: { ...authoredDraft.body.effects, requirementIds: ['made-up'] } }, schedule: authoredDraft.schedule.map(row => ({ ...row, requirementIds: row.requirementIds.filter(id => id !== 'r3') })) };
    await expect(requestPlanAi(drafting, 'fixture', 'fixture', async () => completed(unlinked))).rejects.toMatchObject({ status: 502 });
  });
  test('선택한 분량을 AI 지침과 응답 형식의 항목 수에 반영한다', () => {
    const one = buildPlanAiRequest({ ...drafting, pages: 1 }, 'fixture'), two = buildPlanAiRequest({ ...drafting, pages: 2 }, 'fixture');
    expect(one.instructions).toContain('출력 분량은 A4 1쪽이다');
    expect(two.instructions).toContain('출력 분량은 A4 2쪽이다');
    expect(one.instructions).not.toContain('1200~1800자');
    const schema = (request: ReturnType<typeof buildPlanAiRequest>) => request.text.format.schema as { properties: { schedule: { maxItems: number }; body: { properties: { activities: { maxItems: number } } } } };
    expect(schema(one).properties.schedule.maxItems).toBeLessThan(schema(two).properties.schedule.maxItems);
    expect(schema(one).properties.body.properties.activities.maxItems).toBeLessThanOrEqual(schema(two).properties.body.properties.activities.maxItems);
  });
  test('본문 AI 수정도 활동 구조를 조립하고 기존 일정·예산·확인 사항은 보존한다', async () => {
    const req: PlanRequest = { action: 'revise', ...context, referenceType: 'general', draft, revision: { area: 'body', instruction: '읽기와 나눔 활동을 구체화해 주세요.' } };
    expect(buildPlanAiRequest(req, 'fixture').text.format.schema.required).toEqual(['body']);
    const result = await requestPlanAi(req, 'fixture', 'fixture', async () => completed({ body: authoredDraft.body }));
    expect(result.draft).toMatchObject({ title: draft.title, schedule: draft.schedule, budget: draft.budget, unknowns: draft.unknowns });
    expect(result.draft!.sections.find(s => s.id === 'activities')!.paragraphs.join(' ')).toContain(authoredDraft.body.activities[1].result);
    await expect(requestPlanAi(req, 'fixture', 'fixture', async () => completed({ body: authoredDraft.body, unknowns: [] }))).rejects.toMatchObject({ status: 502 });
  });
  test('공모전은 실제 심사 기준과 동점 순서를 요구하고 기존 본문 계약으로 출력한다', async () => {
    const req: PlanRequest = { ...drafting, referenceType: 'contest' };
    const selectionRules = {
      criteria: [{ name: '적합성', check: '주제와 어울리는가', maxScore: 50 }, { name: '의미', check: '뜻이 분명한가', maxScore: 50 }],
      evaluationMethod: '각 항목을 같은 비중으로 평가하고 합산한다.', exclusions: ['부적절한 표현이 포함된 작품'],
      tieBreakPriority: ['적합성', '의미'], finalTie: '작품별 근거를 함께 논의하고 선정 이유를 기록한다.', methodKind: 'proposal', requirementIds: ['r2'],
    };
    const providerDraft = { ...authoredDraft, body: { purpose: authoredDraft.body.purpose, overview: authoredDraft.body.overview,
      intake: authoredDraft.body.activities, publication: { paragraphs: ['담당 교사가 선정 결과와 작품을 취합하여 11월 9일까지 제출한다. 수합 시 작품 제목·선정 이유·공개 동의가 빠지지 않았는지 확인하고, 누락된 자료는 작성자에게 다시 안내해 보완한다(안).', '선정작은 공개에 동의한 작품만 학급 게시판에 소개하고 개인정보를 제외한다(안). 담임교사는 학생의 응모 과정에서 드러난 관심과 어려움을 정리해 다음 활동 안내에 반영한다.'], requirementIds: ['r2', 'r3'] }, selectionRules, effects: authoredDraft.body.effects } };
    const result = await requestPlanAi(req, 'fixture', 'fixture', async () => completed(providerDraft));
    const section = result.draft!.sections.find(s => s.id === 'selection_rules')!;
    expect(section.paragraphs.join(' ')).toContain('적합성 → 의미');
    expect(section.paragraphs.join(' ')).toContain(selectionRules.finalTie);
    expect(section.paragraphs.join(' ')).toContain(selectionRules.exclusions[0]);
    expect(section.heading).toContain('(안)');
    expect(section.paragraphs.join(' ')).toContain('만점 합계 100점');
    const sixCriteria = Array.from({ length: 6 }, (_, i) => ({ name: `기준${i + 1}`, check: '가'.repeat(80), maxScore: 10000 }));
    const longRules = { ...selectionRules, criteria: sixCriteria, tieBreakPriority: sixCriteria.map(c => c.name), evaluationMethod: '나'.repeat(160), exclusions: ['다'.repeat(50), '라'.repeat(50)], finalTie: '마'.repeat(60) };
    const longResult = await requestPlanAi(req, 'fixture', 'fixture', async () => completed({ ...providerDraft, body: { ...providerDraft.body, selectionRules: longRules } }));
    const longSection = longResult.draft!.sections.find(s => s.id === 'selection_rules')!;
    expect(longSection.paragraphs).toHaveLength(4);
    expect(longSection.paragraphs.every(p => p.length <= 400)).toBe(true);
    expect(longSection.paragraphs.join(' ')).toContain('기준6');
    expect(longSection.paragraphs.join(' ')).toContain(longRules.finalTie);
    const qualitative = { ...selectionRules, criteria: selectionRules.criteria.map(c => ({ ...c, maxScore: null })), evaluationMethod: '작품별 근거를 비교해 최종 합의한 작품을 선정한다.' };
    const qualitativeResult = await requestPlanAi(req, 'fixture', 'fixture', async () => completed({ ...providerDraft, body: { ...providerDraft.body, selectionRules: qualitative } }));
    expect(qualitativeResult.draft!.sections.find(s => s.id === 'selection_rules')!.paragraphs.join(' ')).not.toContain('만점');
    for (const rules of [undefined, { ...selectionRules, tieBreakPriority: ['없는 항목'] }, { ...selectionRules, tieBreakPriority: ['적합성', '적합성'] }, { ...selectionRules, finalTie: '' }, { ...selectionRules, criteria: [{ ...selectionRules.criteria[0], maxScore: null }, selectionRules.criteria[1]] }]) {
      await expect(requestPlanAi(req, 'fixture', 'fixture', async () => completed({ ...providerDraft, body: { ...providerDraft.body, selectionRules: rules } }))).rejects.toMatchObject({ status: 502 });
    }
  });
  test('필수 조건 누락의 고정 안내만 반환하고 AI 본문을 오류에 섞지 않는다', async () => {
    const invalid = structuredClone(authoredDraft);
    invalid.body.effects.requirementIds = [];
    invalid.schedule = invalid.schedule.filter(s => !s.requirementIds.includes('r3'));
    invalid.body.purpose.paragraphs = ['PRIVATE_SOURCE_MARKER'];
    await expect(requestPlanAi(drafting, 'fixture', 'fixture', async () => completed(invalid))).rejects.toThrow('필수 요구사항');
    await expect(requestPlanAi(drafting, 'fixture', 'fixture', async () => completed(invalid))).rejects.not.toThrow('PRIVATE_SOURCE_MARKER');
  });
  test('일정 수정만 요청해 반환 받고 다른 영역은 서버 원고를 보존한다', async () => {
    const req: PlanRequest = { action: 'revise', ...context, referenceType: 'general', draft, revision: { area: 'schedule', instruction: '준비를 앞당겨 주세요.' } };
    const schedule = draft.schedule.map((s, i) => i ? s : { ...s, when: '10월 셋째 주(안)' });
    expect(buildPlanAiRequest(req, 'fixture').text.format.schema.required).toEqual(['schedule']);
    const result = await requestPlanAi(req, 'fixture', 'fixture', async () => completed({ schedule }));
    expect(result.draft).toEqual({ ...draft, schedule });
    expect(result.draft?.sections).toEqual(draft.sections);
    expect(result.draft?.budget).toEqual(draft.budget);
    await expect(requestPlanAi(req, 'fixture', 'fixture', async () => completed({ schedule, title: '다른 영역' }))).rejects.toMatchObject({ status: 502 });
  });
  test.each(['incomplete', 'failed', 'cancelled', null])('완료되지 않은 상태 %s를 성공으로 표시하지 않는다', async status => {
    await expect(requestPlanAi(analyze, 'fixture', 'fixture', async () => new Response(JSON.stringify({ status })))).rejects.toMatchObject({ status: 502 });
  });
  test('거부·손상 응답을 사용자 오류로 처리한다', async () => {
    const refusal = new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal' }] }] }));
    await expect(requestPlanAi(analyze, 'fixture', 'fixture', async () => refusal)).rejects.toMatchObject({ status: 422 });
    await expect(requestPlanAi(analyze, 'fixture', 'fixture', async () => new Response('invalid JSON'))).rejects.toMatchObject({ status: 502 });
    await expect(requestPlanAi(analyze, 'fixture', 'fixture', async () => new Response(JSON.stringify({ status: 'completed', output: [] })))).rejects.toMatchObject({ status: 502 });
  });
  test('사용 한도·연결 실패·내부 오류에서 원문이나 키를 노출하지 않는다', async () => {
    await expect(requestPlanAi(analyze, 'fixture', 'fixture', async () => new Response('private-source-and-key', { status: 429 }))).rejects.toMatchObject({ status: 429 });
    await expect(requestPlanAi(analyze, 'fixture', 'fixture', async () => new Response('private-source-and-key', { status: 401 }))).rejects.not.toThrow('private-source-and-key');
    await expect(requestPlanAi(analyze, 'fixture', 'fixture', async () => { throw new Error('private-source-and-key'); })).rejects.toMatchObject({ status: 504 });
  });
  test('취소된 요청은 모델을 호출하지 않고 진행 중 취소도 전파한다', async () => {
    const c = new AbortController(); c.abort(); const fetcher = vi.fn();
    await expect(requestPlanAi(analyze, 'fixture', 'fixture', fetcher, c.signal)).rejects.toMatchObject({ status: 499 });
    expect(fetcher).not.toHaveBeenCalled();
    const active = new AbortController();
    await expect(requestPlanAi(analyze, 'fixture', 'fixture', async () => { active.abort(); throw new Error('aborted'); }, active.signal)).rejects.toMatchObject({ status: 499 });
  });
});

describe('계획서 동의·사용량 제한', () => {
  test('서버가 확인한 관리자만 허용하며 일반 계정은 한도·본문·모델 처리 전에 거부한다', async () => {
    const admin = { id: 'fixture-admin', email: 'panthea0@gmail.com', email_confirmed_at: '2026-10-26T00:00:00Z' };
    const bearer = () => { const r = httpRequest({ ...analyze, consent: true, email: admin.email, user_metadata: { role: 'admin' } }); r.headers.set('authorization', 'Bearer fixture'); return r; };
    expect(await authorizePlanRequest(bearer(), async () => ({ data: { user: admin }, error: null }))).toBe(admin.id);
    const run = vi.fn(), consumeQuota = vi.fn();
    for (const user of [
      { ...admin, id: 'teacher', email: 'teacher@example.invalid' },
      { ...admin, email_confirmed_at: null },
      { ...admin, is_anonymous: true },
      { ...admin, email: 'teacher@example.invalid', user_metadata: { role: 'admin', email: admin.email } },
    ]) {
      const handler = createPlanHandler({ authorize: r => authorizePlanRequest(r, async () => ({ data: { user }, error: null })), consumeQuota, run });
      expect((await handler(bearer())).status).toBe(403);
    }
    expect(consumeQuota).not.toHaveBeenCalled(); expect(run).not.toHaveBeenCalled();
  });
  test('명시적인 전송 동의 없이 원문을 처리하거나 모델을 호출하지 않는다', async () => {
    const run = vi.fn(), consumeQuota = vi.fn();
    for (const consent of [undefined, false, 'true']) {
      const req = httpRequest({ ...analyze, consent });
      await expect(readPlanRequest(req)).rejects.toMatchObject({ status: 422 });
      const response = await createPlanHandler({ authorize: async () => 'fixture', consumeQuota, run })(httpRequest({ ...analyze, consent }));
      expect(response.status).toBe(422);
    }
    expect(consumeQuota).not.toHaveBeenCalled(); expect(run).not.toHaveBeenCalled();
  });
  test('서버 입력 정리에서 원본 파일 필드와 임의 사용자 ID를 제거한다', async () => {
    const parsed = await readPlanRequest(httpRequest({ ...analyze, consent: true, userId: 'spoof', rawFile: 'not forwarded', sources: [{ ...sources[0], data: 'not forwarded' }] }));
    expect(parsed).toEqual(analyze);
    expect(JSON.stringify(buildPlanAiRequest(parsed, 'fixture'))).not.toContain('not forwarded');
  });
  test('분·일·전체의 독립 키를 순서대로 원자적 RPC에 전달한다', async () => {
    const consume = vi.fn(async () => ({ data: true, error: null }));
    expect(await consumePlanQuota('fixture-user', consume)).toBe(true);
    expect(consume.mock.calls).toEqual([
      ['school-plan:minute:fixture-user', 60, 6], ['school-plan:day:fixture-user', 86400, 30], ['school-plan:global:day', 86400, 100],
    ]);
  });
  test('한도 초과에서 중단하고 제한 확인 실패를 허용으로 바꾸지 않는다', async () => {
    const denied = vi.fn(async () => ({ data: false, error: null }));
    expect(await consumePlanQuota('fixture', denied)).toBe(false); expect(denied).toHaveBeenCalledTimes(1);
    for (const result of [{ data: null, error: null }, { data: true, error: new Error('rpc') }, { data: 'true', error: null }]) {
      await expect(consumePlanQuota('fixture', async () => result)).rejects.toBeInstanceOf(PlanError);
    }
    await expect(consumePlanQuota('fixture', async () => { throw new Error('network'); })).rejects.toMatchObject({ status: 503 });
  });
});
