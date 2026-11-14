import { describe, expect, test } from 'vitest';
import { behaviorCounts, behaviorDuplicates, behaviorTextIssues, createBehaviorValidator, identicalBehaviorIds, validateBehaviorInput } from '../../supabase/functions/_shared/neisBehavior';
import { buildBehaviorAiRequest, behaviorInstruction } from '../../supabase/functions/neis-behavior/prompts';
import { createBehaviorHandler, requestBehaviorStream } from '../../supabase/functions/neis-behavior/core';
import { authorizeNeisRequest, NeisError } from '../../supabase/functions/neis-helper/core';
import { readJsonEvents } from '../../supabase/functions/_shared/neisEvents';
import { applyBehaviorRow, buildBehaviorInput, clearBehaviorDraftUnless, newBehaviorEntries, readBehaviorDraft, saveBehaviorDraft } from '../../src/features/neisHelper/behaviorState';

const input = () => ({ length: 400 as const, students: [{ id: 's1', traits: ['배려'], notes: '친구 의견을 들은 뒤 자신의 의견을 차분히 설명함.' }, { id: 's2', traits: ['끈기'], notes: '' }], avoid: [] });
const text = '친구의 의견을 존중하며 서로의 생각을 차분하게 나누는 태도를 지님.';
// Protocol fixtures meet the requested length; sentence quality is tested with actual model samples.
const generatedText = Array(10).fill(text).join(' ');
const sse = (events: unknown[]) => new Response(new ReadableStream({ start(controller) { const encoded = new TextEncoder().encode(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('')); for (let i = 0; i < encoded.length; i += 7) controller.enqueue(encoded.slice(i, i + 7)); controller.close(); } }), { headers: { 'Content-Type': 'text/event-stream' } });
const request = (body: unknown) => new Request('https://example.test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

describe('행동특성 자료와 문장 검사', () => {
  test('이름·번호를 요청에 넣지 않고 교사 메모와 안정된 식별자를 보존한다', () => {
    const entries = newBehaviorEntries([{ number: 12, name: '가상동명' }, { number: 2, name: '가상동명' }]).map((row) => ({ ...row, traits: ['배려'], notes: '실제 입력 메모', text }));
    const value = buildBehaviorInput({ entries, length: 400, results: false }, [entries[0].id]);
    expect(entries.map((row) => row.number)).toEqual([2, 12]);
    expect(JSON.stringify(value)).not.toContain('가상동명');
    expect(value.students[0].notes).toBe('실제 입력 메모');
    expect(value.avoid).toEqual([text]);
    expect(validateBehaviorInput({ ...value, owner: 'forged', students: value.students.map((row) => ({ ...row, name: '가상동명' })) })).toEqual(value);
  });
  test('중복 식별자·빈 입력·과도한 메모·인원·비교문장을 거절한다', () => {
    for (const invalid of [
      { ...input(), students: [input().students[0], input().students[0]] },
      { ...input(), students: [{ id: 's1', traits: [], notes: ' ' }] },
      { ...input(), students: [{ id: 's1', traits: [], notes: '가'.repeat(2001) }] },
      { ...input(), students: Array(61).fill(input().students[0]) },
      { ...input(), avoid: ['가'.repeat(3001)] }, { ...input(), length: '400' },
    ]) expect(() => validateBehaviorInput(invalid)).toThrow();
  });
  test('다른 학생 응답이나 중복 응답을 수용하지 않고 누락을 정확히 남긴다', () => {
    const validator = createBehaviorValidator(input());
    expect(() => validator.accept({ id: 's99', text })).toThrow();
    expect(validator.accept({ id: 's1', text: generatedText }).error).toBe('');
    expect(() => validator.accept({ id: 's1', text })).toThrow();
    expect(validator.missing().map((row) => row.id)).toEqual(['s2']);
  });
  test.each([[200, 180, 220], [300, 270, 330], [400, 360, 440]] as const)('%i자 생성의 허용 범위 경계를 검사하고 벗어난 본문은 보존한 채 오류로 표시한다', (length, min, max) => {
    for (const size of [min - 1, min, length, max, max + 1]) {
      const candidate = '가'.repeat(size - 2) + '함.';
      const row = createBehaviorValidator({ ...input(), length }).accept({ id: 's1', text: candidate });
      expect(row.text).toBe(candidate);
      expect(!!row.error).toBe(size < min || size > max);
      if (row.error) expect(row.error).toContain(`${min}~${max}자`);
    }
    const payload = buildBehaviorAiRequest({ ...input(), length }, 'fixture-model');
    expect(payload.instructions).toContain(`반드시 ${min}~${max}자 범위`);
    const pattern = new RegExp(payload.text.format.schema.properties.rows.items.properties.text.pattern, 'u');
    expect(pattern.test('가'.repeat(min - 1))).toBe(false);
    expect(pattern.test('가'.repeat(min))).toBe(true);
    expect(pattern.test('가'.repeat(max))).toBe(true);
    expect(pattern.test('가'.repeat(max + 1))).toBe(false);
    expect(pattern.test('가'.repeat(length - 1) + '\n')).toBe(false);
    expect(JSON.parse(payload.input[0].content[0].text).length).toBe(length);
  });
  test('400자 선택에 100자 응답이 오면 완료용 정상 행으로 수용하지 않는다', () => {
    const short = '가'.repeat(98) + '함.';
    const row = createBehaviorValidator(input()).accept({ id: 's1', text: short });
    expect(row.text).toBe(short);
    expect(row.error).toContain('현재 공백 포함 100자');
    expect(row.error).toContain('360~440자');
    expect(behaviorInstruction).not.toContain('분량과 표현 다양성보다 사실 보존이 우선');
    expect(behaviorInstruction).toContain('메모가 짧거나 없다는 이유로 선택 분량을 임의로 줄이지 않습니다');
  });
  test('첫 단어·공백을 제외한 첫 세 글자·동일 문장·유사 문장을 각각 찾는다', () => {
    const pairs = [
      ['친구의 이야기를 들음.', '친구의 과제를 도움.'],
      ['차분한 자세를 갖춤.', '차분 한 태도를 보임.'],
      ['배려하는 마음을 지님. 서로 다른 생각을 존중함.', '자신있게 발표함. 서로 다른 생각을 존중함.'],
      ['친구들의 다양한 의견을 경청하고 자신의 생각을 차분하게 정리하여 함께 나누는 태도를 지님.', '친구들의 다양한 의견을 경청하고 자신의 생각을 침착하게 정리하여 함께 나누는 태도를 지님.'],
    ];
    for (const [a, b] of pairs) expect(behaviorDuplicates([{ id: 'a', text: a }, { id: 'b', text: b }, { id: 'c', text: '정돈된 물건을 스스로 관리함.' }])).toEqual(new Set(['a', 'b']));
    expect(identicalBehaviorIds([{ id: 'a', text }, { id: 'b', text: text.replace(/ /g, '') }])).toEqual(new Set(['a', 'b']));
  });
  test('금지어·접속사·종결·서식과 줄바꿈 1바이트를 검사한다', () => {
    expect(behaviorTextIssues(text)).toEqual([]);
    for (const wrong of ['매우 잘함.', '그리고 친구를 도움.', '친구를 돕습니다.', '**배려**함.', '배려함.\n협력함.', '대회에서 수상함.']) expect(behaviorTextIssues(wrong).length).toBeGreaterThan(0);
    expect(behaviorCounts('가A1\r\n나')).toEqual({ characters: 5, bytes: 9 });
  });
  test('작성 응답은 대상 행만 바꾸고 계정 전환 시 탭 자료를 지운다', () => {
    const entries = newBehaviorEntries([{ number: 1, name: '가상가' }, { number: 2, name: '가상나' }]);
    entries[0] = { ...entries[0], text, edited: true };
    const next = applyBehaviorRow(entries, { id: 's2', text: '과제를 꾸준히 수행함.', error: '' });
    expect(next[0]).toEqual(entries[0]);
    saveBehaviorDraft('one', { entries: next, length: 400, results: true });
    expect(readBehaviorDraft('one').entries).toHaveLength(2);
    clearBehaviorDraftUnless('two');
    expect(readBehaviorDraft('two').entries).toEqual([]);
  });
  test('한 번의 학급 요청에 전체 작성 규칙과 자료를 별도로 담는다', () => {
    const payload = buildBehaviorAiRequest(input(), 'test-model');
    expect(payload.instructions).toContain(behaviorInstruction);
    expect(payload.instructions).toContain('반드시 360~440자 범위');
    expect(behaviorInstruction).toContain('교사 메모를 최우선');
    expect(behaviorInstruction).toContain('첫 세 글자');
    expect(behaviorInstruction).toContain('교사의 짧은 판단도 근거로 반영');
    expect(behaviorInstruction).toContain('구체적인 전후 사례·날짜·수치나 별도 관찰 기록을 요구하지 않습니다');
    expect(behaviorInstruction).not.toContain('메모에 실제 전후 변화가 있을 때만');
    expect(payload.instructions).toContain('메모가 없거나 변화에 대한 언급이 없어도');
    expect(payload.instructions).toContain('현재 모습이나 미래 가능성만으로 제한하지 않습니다');
    expect(payload.instructions).toContain('구체적인 변화 이력은 구별');
    expect(payload.instructions).not.toContain('없는 사건·실적·변화는 추가하지 않습니다');
    expect(behaviorInstruction).toContain('기본값은 약 400자');
    expect(payload.store).toBe(false);
    expect(JSON.parse(payload.input[0].content[0].text).students).toHaveLength(2);
    expect(JSON.parse(payload.input[0].content[0].text).students[1]).toEqual({ id: 's2', traits: ['끈기'], notes: '' });
  });
});

describe('행동특성 서버와 스트리밍', () => {
  test('인증 실패와 사용량 확인 실패 시 모델을 부르지 않는다', async () => {
    let calls = 0;
    const handler = (authorize: () => Promise<string>, consumeQuota: () => Promise<boolean>) => createBehaviorHandler({ authorize, consumeQuota, generate: async () => { calls++; return new ReadableStream(); } });
    expect((await handler(async () => { throw new NeisError(401, '로그인 필요'); }, async () => true)(request(input()))).status).toBe(401);
    expect((await handler(async () => 'owner', async () => false)(request(input()))).status).toBe(429);
    expect((await handler(async () => 'owner', async () => { throw new Error('db detail'); })(request(input()))).status).toBe(500);
    expect(calls).toBe(0);
  });
  test('익명·미확인·일반 계정은 기존 관리자 미리보기 권한을 우회하지 못한다', async () => {
    for (const user of [{ id: 'a', email: 'panthea0@gmail.com', email_confirmed_at: 'date', is_anonymous: true }, { id: 'a', email: 'panthea0@gmail.com' }, { id: 'a', email: 'other@example.test', email_confirmed_at: 'date' }]) {
      await expect(authorizeNeisRequest(new Request('https://example.test', { headers: { Authorization: 'Bearer fixture' } }), async () => ({ data: { user }, error: null }))).rejects.toMatchObject({ status: 403 });
    }
  });
  test('요청 크기를 실제 읽은 바이트로 제한한다', async () => {
    const handler = createBehaviorHandler({ authorize: async () => 'owner', consumeQuota: async () => true, generate: async () => { throw new Error('must not call'); } });
    expect((await handler(request({ data: 'x'.repeat(800_001) }))).status).toBe(413);
    expect((await handler(request({ ...input(), students: [] }))).status).toBe(422);
  });
  test('UTF-8 분할 응답을 한 번의 요청으로 받아 학생 단위로 내보내고 누락을 알린다', async () => {
    let calls = 0;
    const raw = JSON.stringify({ rows: [{ id: 's1', text: generatedText }] });
    const fetcher: typeof fetch = async () => { calls++; return sse([{ type: 'response.output_text.delta', delta: raw.slice(0, 25) }, { type: 'response.output_text.delta', delta: raw.slice(25) }, { type: 'response.completed' }]); };
    const stream = await requestBehaviorStream(input(), 'fixture-key', 'fixture-model', new AbortController().signal, fetcher);
    const events = []; for await (const event of readJsonEvents(stream)) events.push(event);
    expect(calls).toBe(1);
    expect(events).toEqual([{ type: 'row', row: { id: 's1', text: generatedText, error: '' } }, { type: 'row', row: { id: 's2', text: '', error: '응답이 누락되었습니다. 다시 요청해 주세요.' } }, { type: 'done' }]);
  });
  test('스트림이 끊기면 먼저 도착한 행을 유지하고 완료로 보고하지 않는다', async () => {
    const fetcher: typeof fetch = async () => sse([{ type: 'response.output_text.delta', delta: `{"rows":[${JSON.stringify({ id: 's1', text })},` }]);
    const stream = await requestBehaviorStream(input(), 'fixture-key', 'fixture-model', new AbortController().signal, fetcher);
    const events: { type?: string }[] = []; for await (const event of readJsonEvents(stream)) events.push(event as { type?: string });
    expect(events.map((event) => event.type)).toEqual(['row', 'error']);
  });
});
