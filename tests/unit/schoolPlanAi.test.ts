import { describe, expect, test, vi } from 'vitest';
import { buildPlanAiRequest, requestPlanAi } from '../../supabase/functions/school-plan/openai';
import { consumePlanQuota } from '../../supabase/functions/school-plan/quota';
import { authorizePlanRequest, createPlanHandler, PlanError, readPlanRequest } from '../../supabase/functions/school-plan/core';
import { analysis, authoredDraft, context, draft, legacyDraft, sources } from '../fixtures/schoolPlan';
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
  test('v2 형식 초안을 받아 형식을 검사하고, 의미 문제는 막지 않고 교사 검토로 넘긴다', async () => {
    const result = await requestPlanAi(drafting, 'fixture', 'fixture', async () => completed(authoredDraft));
    expect(result.draft).toEqual(draft);
    const invalid = { ...authoredDraft, budget: [{ ...draft.budget[0], unitPrice: 999999999 }] };
    await expect(requestPlanAi(drafting, 'fixture', 'fixture', async () => completed(invalid))).rejects.toMatchObject({ status: 502 });
    // 예산 초과는 형식 오류가 아니라 검토 화면에서 저장을 막는 문제다(초안은 버리지 않는다).
    const over = { ...authoredDraft, budget: [{ ...draft.budget[0], unitPrice: 1000, total: 500000 }] };
    expect((await requestPlanAi(drafting, 'fixture', 'fixture', async () => completed(over))).draft?.budget[0].total).toBe(500000);
    await expect(requestPlanAi(analyze, 'fixture', 'fixture', async () => completed({ ...analysis, requirements: [{ ...analysis.requirements[0], quote: '공문에 없는 문구' }] }))).rejects.toMatchObject({ status: 502 });
  });
  test('빈 세부 추진 계획, 예전(v1) 형식의 응답은 초안으로 받지 않는다', async () => {
    await expect(requestPlanAi(drafting, 'fixture', 'fixture', async () => completed({ ...authoredDraft, detailedPlans: [] }))).rejects.toMatchObject({ status: 502 });
    await expect(requestPlanAi(drafting, 'fixture', 'fixture', async () => completed({ ...authoredDraft, purpose: [' '] }))).rejects.toMatchObject({ status: 502 });
    await expect(requestPlanAi(drafting, 'fixture', 'fixture', async () => completed(legacyDraft))).rejects.toThrow('이전 형식');
  });
  test('공문 분석에 없는 근거 ID(참고 사례 ID·지어낸 ID)는 초안을 실패시키지 않고 지운다', async () => {
    const forged = { ...authoredDraft, meta: { ...authoredDraft.meta, requirementIds: ['r1', 'r2', 'r3', 'r4', 'training-01', 'made-up'] } };
    const result = await requestPlanAi(drafting, 'fixture', 'fixture', async () => completed(forged));
    expect(result.draft?.meta.requirementIds).toEqual(['r1', 'r2', 'r3', 'r4']);
  });
  test('선택한 분량을 작업 자료의 분량 선호로 전달한다', () => {
    const data = (pages: 1 | 5) => JSON.parse(buildPlanAiRequest({ ...drafting, pages }, 'fixture').input[1].content[0].text).outputPreferences;
    expect(data(1).pages).toBe(1);
    expect(data(1).approxBodyChars).toBeLessThan(data(5).approxBodyChars);
  });
  test('본문 AI 수정은 본문 필드와 meta만 받고 일정·예산·제목은 보존한다', async () => {
    const req: PlanRequest = { action: 'revise', ...context, referenceType: 'general', draft, revision: { area: 'body', instruction: '나눔 활동을 구체화해 주세요.' } };
    const built = buildPlanAiRequest(req, 'fixture');
    expect(built.text.format.schema.required).toEqual(['background', 'purpose', 'overview', 'policies', 'detailedPlans', 'expectedEffects', 'meta']);
    expect(built.input[0].content[0].text).toContain('# 수정 요청');
    const detailedPlans = [...draft.detailedPlans, { subTitle: '추가 활동', details: ['짝 활동: 친구와 기록 바꿔 읽기(안)'] }];
    const { background, purpose, overview, policies, expectedEffects, meta } = draft;
    const result = await requestPlanAi(req, 'fixture', 'fixture', async () => completed({ background, purpose, overview, policies, detailedPlans, expectedEffects, meta }));
    expect(result.draft).toEqual({ ...draft, detailedPlans });
    await expect(requestPlanAi(req, 'fixture', 'fixture', async () => completed({ background, purpose, overview, policies, detailedPlans, expectedEffects, meta, schedule: [] }))).rejects.toMatchObject({ status: 502 });
  });
  test('공모전은 해당 유형 점검 목록만 붙이고, 배점·동점 규칙을 근거 없이 확정하지 않게 한다', () => {
    const built = buildPlanAiRequest({ ...drafting, referenceType: 'contest' }, 'fixture');
    const guide = built.input[0].content[0].text;
    expect(guide).toContain('# 유형: 공모전·대회');
    expect(guide).toContain('배점·시상·심사 위원 구성은 공문이나 학교 입력의 근거 없이 확정하지 않는다');
    const data = JSON.parse(built.input[1].content[0].text);
    expect(data.referencePack.examples.map((e: { id: string }) => e.id)).toEqual(['contest-01']);
  });
  test('형식 오류에는 고정 안내만 반환하고 AI 본문을 오류에 섞지 않는다', async () => {
    const invalid = { ...structuredClone(authoredDraft), purpose: ['PRIVATE_SOURCE_MARKER'], meta: { requirementIds: [], unknowns: [], budgetStatus: 'maybe' } };
    await expect(requestPlanAi(drafting, 'fixture', 'fixture', async () => completed(invalid))).rejects.toThrow('운영계획서 형식 검사');
    await expect(requestPlanAi(drafting, 'fixture', 'fixture', async () => completed(invalid))).rejects.not.toThrow('PRIVATE_SOURCE_MARKER');
  });
  test('일정 수정만 요청해 반환 받고 다른 영역은 서버 원고를 보존한다', async () => {
    const req: PlanRequest = { action: 'revise', ...context, referenceType: 'general', draft, revision: { area: 'schedule', instruction: '준비를 앞당겨 주세요.' } };
    const schedule = draft.schedule.map((s, i) => i ? s : { ...s, date: '10월 셋째 주(안)' });
    expect(buildPlanAiRequest(req, 'fixture').text.format.schema.required).toEqual(['schedule', 'meta']);
    const result = await requestPlanAi(req, 'fixture', 'fixture', async () => completed({ schedule, meta: draft.meta }));
    expect(result.draft).toEqual({ ...draft, schedule });
    await expect(requestPlanAi(req, 'fixture', 'fixture', async () => completed({ schedule, meta: draft.meta, title: '다른 영역' }))).rejects.toMatchObject({ status: 502 });
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
