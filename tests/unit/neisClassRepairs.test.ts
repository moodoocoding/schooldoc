import { describe, expect, test, vi } from 'vitest';
import { commentStyleContext, validateGradeBook } from '../../supabase/functions/_shared/neisHelper';
import { createClassOutputValidator, validateClassInput } from '../../supabase/functions/_shared/neisClassComments';
import type { ClassCommentInput, ClassCommentRow } from '../../supabase/functions/_shared/neisClassComments';
import { generateClassWithRepairs, MAX_CLASS_ATTEMPTS } from '../../supabase/functions/_shared/neisClassGeneration';
import { buildClassRequest } from '../../src/features/neisHelper/classWorkflow';
import { fitCommentLengthForTest } from '../fixtures/neisCommentLength';

const evaluation = {
  standardCode: 'fixture', standard: '자료의 평균을 구한다.', task: '평균 구하기',
  rubrics: { high: '자료의 평균을 정확하게 구한다.' },
};
const input = (): ClassCommentInput => ({ subject: '수학', length: 200, evaluations: [evaluation], groups: [{ ids: ['s1', 's2'], grades: ['high'] }] });
const raw = (id: string, text: string) => ({ id, sentences: [{ a: 1, t: text }] });
const first = fitCommentLengthForTest('주어진 자료의 평균을 정확하게 구함.');
const second = fitCommentLengthForTest('평균값을 구하는 계산을 바르게 수행함.');

describe('평어 중복 차단과 자동 재작성', () => {
  test.each([first, '주어진 수의 평균을 계산함.', '주어진값의 평균을 구함.'])(
    '동일 문장·첫 단어·첫 세 글자가 겹친 행은 서버에서 완료로 반환하지 않는다: %s', (candidate) => {
      const validator = createClassOutputValidator(input());
      expect(validator.accept(raw('s1', first)).error).toBe('');
      expect(validator.accept(raw('s2', candidate))).toMatchObject({ id: 's2', comment: null, rejectedText: candidate });
    },
  );
  test('이미 유지할 학생의 문장과 시작 표현도 서버에서 비교한다', () => {
    const validator = createClassOutputValidator({ ...input(), ...commentStyleContext([first]) });
    expect(validator.accept(raw('s1', first)).error).toContain('겹칩니다');
    expect(validator.accept(raw('s2', second)).error).toBe('');
  });
  test('본문 중간의 같은 시작 용어는 허용하지만 같은 완성 문장은 차단한다', () => {
    const comments = [
      '주어진 수의 평균을 구함. 글의 중심 내용을 요약함.',
      '평균값을 정확히 계산함. 글의 맥락에서 이어질 내용을 추론함.',
    ];
    const context = commentStyleContext(comments);
    expect(context.usedStarts).not.toContain('글의');
    expect(context.priorSentences).toHaveLength(4);
    const withPrior = { ...input(), ...commentStyleContext([comments[0]]) };
    expect(createClassOutputValidator(withPrior).accept(raw('s1', fitCommentLengthForTest(comments[1]))).error).toBe('');
    const rejected = createClassOutputValidator(withPrior).accept(raw('s1', fitCommentLengthForTest('평균값을 정확히 계산함. 글의 중심 내용을 요약함.')));
    expect(rejected.error).toContain('거의 같은 문장');
    expect(rejected.error).toContain('「글의 중심 내용을 요약함」');
    expect(rejected.error).not.toContain('「평균값을 정확히 계산함」');
  });
  test('첫 응답이 정상이면 학급 전체를 한 번만 요청한다', async () => {
    const request = vi.fn(async (next, _signal, onRow) => {
      const validator = createClassOutputValidator(next);
      onRow(validator.accept(raw('s1', first)));
      onRow(validator.accept(raw('s2', second)));
    });
    const rows: ClassCommentRow[] = [];
    await generateClassWithRepairs(input(), new AbortController().signal, request, (row) => rows.push(row));
    expect(request).toHaveBeenCalledTimes(1);
    expect(rows.map((row) => row.id)).toEqual(['s1', 's2']);
  });
  test('구버전 서버가 중복을 통과시켜도 해당 학생만 재작성하고 원래 ID와 검증된 결과를 유지한다', async () => {
    const calls: ClassCommentInput[] = [];
    const request = vi.fn(async (next, _signal, onRow) => {
      calls.push(next);
      if (calls.length === 1) {
        const valid = createClassOutputValidator(next).accept(raw('s1', first));
        onRow(valid);
        onRow({ ...valid, id: 's2' });
      } else onRow(createClassOutputValidator(next).accept(raw('s2', second)));
    });
    const rows: ClassCommentRow[] = [];
    await generateClassWithRepairs(input(), new AbortController().signal, request, (row) => rows.push(row));
    expect(calls).toHaveLength(2);
    expect(calls[1].groups).toEqual([{ ids: ['s2'], grades: ['high'] }]);
    expect(calls[1].priorSentences).toContain(first.split('.')[0]);
    expect(calls[1].usedStarts).toContain('주어진');
    expect(calls[1].revisions?.[0]).toMatchObject({ id: 's2', text: first });
    expect(rows.map((row) => row.id)).toEqual(['s1', 's2']);
    expect(rows[0].comment?.sentences[0].text).toBe(first);
  });
  test('계속 겹쳐도 자동 호출을 네 번에서 멈추고 실패를 유지한다', async () => {
    const request = vi.fn(async (next, _signal, onRow) => {
      const validator = createClassOutputValidator(next);
      for (const id of next.groups.flatMap((group: { ids: string[] }) => group.ids)) onRow(validator.accept(raw(id, first)));
    });
    const rows: ClassCommentRow[] = [];
    await generateClassWithRepairs(input(), new AbortController().signal, request, (row) => rows.push(row));
    expect(request).toHaveBeenCalledTimes(MAX_CLASS_ATTEMPTS);
    expect(rows[0].error).toBe('');
    // 다른 학생과의 중복만 남으면 미생성으로 두지 않고 결과에 넣는다(결과 화면이 중복을 표시한다).
    expect(rows[1]).toMatchObject({ id: 's2', error: '' });
    expect(rows[1].comment?.sentences[0].text).toBe(first);
  });
  test('근거·표현 검사에 걸리거나 분량이 크게 벗어나면 네 번 뒤에도 실패로 남긴다', async () => {
    const hard = fitCommentLengthForTest('평균 구하기에 어려움이 있으나 평균을 구함.');
    for (const text of [hard, '평균을 구함.']) {
      const request = vi.fn(async (next, _signal, onRow) => {
        const validator = createClassOutputValidator(next);
        for (const id of next.groups.flatMap((group: { ids: string[] }) => group.ids)) onRow(validator.accept(raw(id, text)));
      });
      const rows: ClassCommentRow[] = [];
      await generateClassWithRepairs(input(), new AbortController().signal, request, (row) => rows.push(row));
      expect(request).toHaveBeenCalledTimes(MAX_CLASS_ATTEMPTS);
      expect(rows.every((row) => row.comment === null && row.error.includes('자동 재작성을 마치지 못했습니다'))).toBe(true);
    }
  });
  test('분량이 조금 벗어난 평어는 마지막에 결과로 넣는다', async () => {
    const short = fitCommentLengthForTest('계산 과정을 차례대로 정리해 평균을 설명함.', 160);
    const request = vi.fn(async (next, _signal, onRow) => {
      const validator = createClassOutputValidator(next);
      for (const id of next.groups.flatMap((group: { ids: string[] }) => group.ids)) onRow(validator.accept(raw(id, id === 's1' ? first : short)));
    });
    const rows: ClassCommentRow[] = [];
    await generateClassWithRepairs(input(), new AbortController().signal, request, (row) => rows.push(row));
    expect(rows.find((row) => row.id === 's2')).toMatchObject({ error: '' });
  });
  test('취소와 사용량 오류는 자동으로 재호출하지 않는다', async () => {
    const controller = new AbortController();
    const cancelled = vi.fn(async () => { controller.abort(); });
    await expect(generateClassWithRepairs(input(), controller.signal, cancelled, () => {})).rejects.toThrow();
    expect(cancelled).toHaveBeenCalledTimes(1);
    const denied = vi.fn(async () => { throw new Error('AI 요청 한도'); });
    await expect(generateClassWithRepairs(input(), new AbortController().signal, denied, () => {})).rejects.toThrow('AI 요청 한도');
    expect(denied).toHaveBeenCalledTimes(1);
  });
  test('재작성 요청의 ID와 문맥 크기를 검증한다', () => {
    expect(() => validateClassInput({ ...input(), revisions: [{ id: 's9', text: first, reason: '재작성' }] })).toThrow();
    const sentences = Array.from({ length: 80 }, (_, index) => `문맥${index}을 확인함.`);
    const context = commentStyleContext(sentences);
    expect(context.priorSentences).toHaveLength(80);
    expect(validateClassInput({ ...input(), ...context }).priorSentences).toHaveLength(80);
  });
  test('선택 재생성은 실제 화면에서 수정한 다른 학생의 평어를 사용한다', () => {
    const book = validateGradeBook({ context: '', columns: ['평균 구하기'], students: [
      { number: '1', name: '가상하나', grades: ['◎'] }, { number: '2', name: '가상둘', grades: ['◎'] },
    ] });
    const assessment = { ...evaluation, id: 'a', subject: '수학', sourcePage: 1, warnings: [], rubrics: { ...evaluation.rubrics, middle: '평균을 구한다.', low: '간단한 평균을 구한다.' } };
    const result = buildClassRequest('수학', 200, book, [book.students[1]], [assessment], { [book.columns[0].id]: 'a' }, {}, {
      [book.students[0].id]: { generated: { sentences: [{ text: '이전 문장임.', assessmentId: '1', evidenceQuote: evaluation.rubrics.high }] }, text: first, error: '', reviewed: false },
    });
    expect(result.input.groups[0].ids).toEqual(['s2']);
    expect(result.input.priorSentences?.join('. ') + '.').toBe(first);
    expect(result.idMap.get('s2')).toBe(book.students[1].id);
  });
});
