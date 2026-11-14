import { describe, expect, test, vi } from 'vitest';
import { classAssessmentOrder, validateClassInput, validateClassOutput } from '../../supabase/functions/_shared/neisClassComments';
import { repeatedCommentIds, validateGradeBook } from '../../supabase/functions/_shared/neisHelper';
import type { Assessment } from '../../supabase/functions/_shared/neisHelper';
import { buildNeisAiRequest, createNeisHandler, requestNeisAi, requestNeisClassStream } from '../../supabase/functions/neis-helper/core';
import { teacherCommentPrompt } from '../../supabase/functions/neis-helper/teacherCommentPrompt';
import { neisWritingRules } from '../../supabase/functions/neis-helper/neisWritingRules';
import { readJsonEvents } from '../../supabase/functions/_shared/neisEvents';
import { automaticMappings, buildClassRequest } from '../../src/features/neisHelper/classWorkflow';
import { fitCommentLengthForTest } from '../fixtures/neisCommentLength';

const assessment: Assessment = {
  id: 'average', subject: '수학', standardCode: '6수04-01', standard: '평균의 의미를 알고 계산한다.', task: '평균 구하기',
  rubrics: { high: '평균 문제를 능숙하게 해결한다.', middle: '주어진 자료의 평균을 구한다.', low: '간단한 자료의 평균을 구한다.' },
  sourcePage: 1, warnings: [],
};
const book = validateGradeBook({ context: '', columns: ['평균 구하기'], students: [
  { number: '16', name: '가상하나', grades: ['◎'] },
  { number: '22', name: '가상둘', grades: ['◎'] },
  { number: '30', name: '가상셋', grades: ['△'] },
] });
const mappings = automaticMappings(book, [assessment]);
const request = () => buildClassRequest('수학', 300, book, book.students, [assessment], mappings, {
  average: { file: new File(['fixture'], '평가지.pdf'), convertedFile: null, text: '파일 내용', taskContext: '가상 표의 평균을 구하시오.', warning: '' },
}, {});

describe('학급 평어 한 번 생성', () => {
  test('공통 평가 하나와 고유한 성적 조합만 보내고 이름과 출석번호는 브라우저에 남긴다', () => {
    const { input, idMap } = request();
    expect(input.evaluations).toHaveLength(1);
    expect(input.evaluations[0].taskContext).toBe('가상 표의 평균을 구하시오.');
    expect(Object.keys(input.evaluations[0].rubrics)).toEqual(['high', 'low']);
    expect(input.groups).toEqual([{ ids: ['s1', 's2'], grades: ['high'] }, { ids: ['s3'], grades: ['low'] }]);
    expect(idMap.get('s2')).toBe(book.students[1].id);
    expect(JSON.stringify(input)).not.toMatch(/가상하나|가상둘|가상셋|파일 내용|"16"|"22"|"30"/);
    const body = buildNeisAiRequest({ action: 'generate-class', input }, 'fixture-model');
    expect(body.text.format.name).toBe('neis_class');
    expect(body.instructions).toContain(teacherCommentPrompt);
    expect(body.instructions).toContain(neisWritingRules);
    expect(body.store).toBe(false);
    const payload = JSON.parse(body.input[0].content[0].text);
    expect(payload.students).toEqual([{ id: 's1', grades: ['high'], order: [1] }, { id: 's2', grades: ['high'], order: [1] }, { id: 's3', grades: ['low'], order: [1] }]);
    expect(payload.studentCount).toBe(3);
    expect(payload.groups).toBeUndefined();
  });
  test('23명의 첫 평가를 고르게 배정하고 선택 재생성에서도 성적과 평가 연결을 유지한다', () => {
    const orders = Array.from({ length: 23 }, (_, index) => classAssessmentOrder(`s${index + 1}`, 3));
    expect([1, 2, 3].map((id) => orders.filter((order) => order[0] === id).length)).toEqual([8, 8, 7]);
    expect(new Set(orders.map((order) => order.join(','))).size).toBe(6);
    const evaluations = [1, 2, 3].map((id) => ({ ...assessment, standardCode: `평가${id}` }));
    const input = { ...request().input, evaluations, groups: [{ ids: ['s2'], grades: ['high', 'low', 'middle'] as const }] };
    const validated = validateClassInput(input);
    const body = buildNeisAiRequest({ action: 'generate-class', input: validated }, 'fixture-model');
    expect(JSON.parse(body.input[0].content[0].text).students).toEqual([
      { id: 's2', grades: ['high', 'low', 'middle'], order: [2, 3, 1] },
    ]);
    const sentences = [
      { a: 2, t: fitCommentLengthForTest('간단한 자료의 평균을 구함.', 100) },
      { a: 3, t: fitCommentLengthForTest('주어진 수에서 평균값을 계산함.', 100) },
      { a: 1, t: fitCommentLengthForTest('평균을 활용하는 문제를 능숙하게 해결함.', 100) },
    ];
    const result = validateClassOutput({ rows: [{ id: 's2', sentences }] }, validated).rows[0];
    expect(result.error).toBe('');
    expect(result.comment?.sentences.map((sentence) => sentence.evidenceQuote)).toEqual([
      assessment.rubrics.low, assessment.rubrics.middle, assessment.rubrics.high,
    ]);
    const wrongOrder = validateClassOutput({ rows: [{ id: 's2', sentences: [...sentences].reverse() }] }, validated).rows[0];
    expect(wrongOrder.error).toContain('평가 서술 순서');
    expect(wrongOrder.comment).toBeNull();
  });
  test('동일 평가를 가리키는 두 성적 열은 자동 확정하지 않는다', () => {
    expect(automaticMappings({ ...book, columns: [...book.columns, { id: 'duplicate', label: '평균구하기' }] }, [assessment])).toEqual({});
  });
  test('누락되거나 검증에 실패한 행만 다시 요청할 수 있다', () => {
    const { input } = request();
    const parsed = validateClassOutput({ rows: [
      { id: 's3', sentences: [{ a: 1, t: '평균 구하기에 어려움이 있으나 평균을 구함.' }] },
      { id: 's1', sentences: [{ a: 1, t: fitCommentLengthForTest('평균 문제를 능숙하게 해결함.', 300) }] },
    ] }, input);
    expect(parsed.rows.map((row) => row.id)).toEqual(['s1', 's2', 's3']);
    expect(parsed.rows[0].comment?.sentences[0].evidenceQuote).toBe(assessment.rubrics.high);
    expect(parsed.rows[1].error).toContain('없습니다');
    expect(parsed.rows[2].error).toContain('평가기준에 없는');
    expect(() => validateClassOutput({ rows: [{ id: 's99', sentences: [] }] }, input)).toThrow('학생 연결');
    expect(() => validateClassInput({ ...input, groups: [{ ids: ['s1', 's1'], grades: ['high'] }] })).toThrow();
  });
  test('서버가 학급 생성에 사용량 검사와 모델 요청을 각 한 번만 실행한다', async () => {
    const { input } = request();
    const analyze = vi.fn(async () => ({ rows: [{ id: 's1', sentences: [{ a: 1, t: fitCommentLengthForTest('평균 문제를 해결함.', 300) }] }] }));
    const consumeQuota = vi.fn(async () => true);
    const checkPdf = vi.fn(async () => {});
    const handler = createNeisHandler({ authorize: async () => 'fixture-owner', checkPdf, consumeQuota, analyze });
    const response = await handler(new Request('https://local.invalid', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generate-class', input }),
    }));
    expect(response.status).toBe(200);
    expect((await response.json()).result.rows).toHaveLength(3);
    expect(consumeQuota).toHaveBeenCalledTimes(1);
    expect(analyze).toHaveBeenCalledTimes(1);
    expect(checkPdf).not.toHaveBeenCalled();
  });
  test('모델 출력 한도에서 잘려도 완성된 행을 살리고 미완성 행만 표시한다', async () => {
    const { input } = request();
    const completeText = fitCommentLengthForTest('평균 문제 {가상}를 해결함.', 300);
    const complete = JSON.stringify({ id: 's1', sentences: [{ a: 1, t: completeText }] });
    const source = `{"rows":[${complete},{"id":"s2","sentences":[{"a":1,"t":"가상`;
    const fetcher = vi.fn(async () => Response.json({
      status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' },
      output: [{ type: 'message', content: [{ type: 'output_text', text: source }] }],
    }));
    const raw = await requestNeisAi({ action: 'generate-class', input }, 'fixture-key', 'fixture-model', fetcher as typeof fetch);
    const result = validateClassOutput(raw, input);
    expect(result.rows[0].comment?.sentences[0].text).toBe(completeText);
    expect(result.rows.slice(1).every((row) => row.error && !row.comment)).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  test('OpenAI의 여러 델타를 받아 완성한 학생부터 같은 요청에서 전송한다', async () => {
    const { input } = request();
    let upstream!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({ start(controller) { upstream = controller; } });
    const send = (event: unknown) => upstream.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`));
    const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body)).stream).toBe(true);
      return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } });
    });
    const stream = await requestNeisClassStream({ action: 'generate-class', input }, 'fixture-key', 'fixture-model', new AbortController().signal, fetcher as typeof fetch);
    const events = readJsonEvents(stream);
    const first = events.next();
    send({ type: 'response.output_text.delta', delta: '{"ro' });
    send({ type: 'response.output_text.delta', delta: `ws":[${JSON.stringify({ id: 's1', sentences: [{ a: 1, t: fitCommentLengthForTest('평균 문제를 해결함.', 300) }] })}` });
    expect((await first).value).toMatchObject({ type: 'row', row: { id: 's1', error: '' } });
    send({ type: 'response.incomplete', response: { incomplete_details: { reason: 'max_output_tokens' } } });
    upstream.close();
    expect((await events.next()).value).toMatchObject({ type: 'row', row: { id: 's2', comment: null } });
    expect((await events.next()).value).toMatchObject({ type: 'row', row: { id: 's3', comment: null } });
    expect((await events.next()).value).toEqual({ type: 'done' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  test('다른 학생의 첫 단어, 첫 세 글자와 순서가 비슷한 문장을 찾는다', () => {
    const rows = [
      { id: 'a', text: '주어진 자료의 평균을 구함. 소수의 곱셈을 계산함.' },
      { id: 'b', text: '주어진 표를 읽고 문제를 해결함.' },
      { id: 'c', text: '소수의미를 이해함.' },
      { id: 'd', text: '평균을 주어진 자료의 구함.' },
      { id: 'e', text: '그림으로 수의 관계를 표현함.' },
    ];
    expect(repeatedCommentIds(rows)).toEqual(new Set(['a', 'b', 'd']));
  });
  test('접두어가 다르고 단어 일부만 바꾼 긴 문장도 확인 대상으로 찾는다', () => {
    expect(repeatedCommentIds([
      { id: 'a', text: '주제를 정해 우리말 사용을 조사하고 조사 결과를 표와 그림을 활용해 보고서 형식에 맞게 정리함.' },
      { id: 'b', text: '적절한 주제를 정해 우리말 사용을 조사하고 조사 결과를 표와 그림을 활용해 보고서 형식에 맞게 정리함.' },
      { id: 'c', text: '토의에서 모둠이 세운 의견을 말하고 결정 사항을 알기 쉽게 전달함.' },
    ])).toEqual(new Set(['a', 'b']));
  });
});
