import { expect, test } from 'vitest';
import { commentLengthRange, countComment, validateCommentLength } from '../../supabase/functions/_shared/neisHelper';
import type { GeneratedComment } from '../../supabase/functions/_shared/neisHelper';
import { createClassOutputValidator } from '../../supabase/functions/_shared/neisClassComments';
import type { ClassCommentInput, ClassCommentRow } from '../../supabase/functions/_shared/neisClassComments';
import { generateClassWithRepairs } from '../../supabase/functions/_shared/neisClassGeneration';
import { buildNeisAiRequest, createNeisHandler } from '../../supabase/functions/neis-helper/core';

const textAtLength = (length: number, start = '가') => start + '나'.repeat(length - start.length - 2) + '임.';
const comment = (text: string): GeneratedComment => ({ sentences: [{ text, assessmentId: '1', evidenceQuote: '자료의 평균을 구한다.' }] });

test.each([[200, 180, 220], [300, 270, 330], [400, 360, 440]] as const)(
  '%i자는 공백 포함 %i~%i자를 허용하고 경계 밖은 보완한다', (target, min, max) => {
    expect(commentLengthRange(target)).toEqual({ min, max });
    for (const length of [min, target, max]) expect(validateCommentLength(comment(textAtLength(length)), target)).toBeTruthy();
    expect(() => validateCommentLength(comment(textAtLength(min - 1)), target)).toThrow(`현재 공백 포함 ${min - 1}자`);
    expect(() => validateCommentLength(comment(textAtLength(max + 1)), target)).toThrow(`목표 ${target}자에 맞추어 약 ${max + 1 - target}자 줄이세요`);
  },
);

test('문장 사이 공백과 문장부호를 포함하고 CRLF와 유니코드 문자를 화면과 같은 방식으로 센다', () => {
  const text = '가\r\n😀 ' + '나'.repeat(173) + '임.';
  expect(countComment(text).characters).toBe(179);
  expect(() => validateCommentLength(comment(text), 200)).toThrow('179자');
  const joined = { sentences: [...comment(textAtLength(90)).sentences, ...comment(textAtLength(89, '다')).sentences] };
  expect(validateCommentLength(joined, 200)).toEqual(joined);
});

const input = (): ClassCommentInput => ({
  subject: '수학', length: 200,
  evaluations: [{ standardCode: '가상', standard: '평균을 구한다.', task: '평균', rubrics: { high: '자료의 평균을 구한다.' } }],
  groups: [{ ids: ['s1', 's2'], grades: ['high'] }],
});

test('분량을 넘긴 학생만 현재 글자 수와 허용 범위를 전달해 재작성한다', async () => {
  const calls: ClassCommentInput[] = [];
  const rows: ClassCommentRow[] = [];
  const kept = textAtLength(200, '자료를 ');
  const short = textAtLength(150, '평균을 ');
  await generateClassWithRepairs(input(), new AbortController().signal, async (next, _signal, onRow) => {
    calls.push(next);
    const validator = createClassOutputValidator(next);
    for (const id of next.groups.flatMap((group) => group.ids)) {
      const t = id === 's2' ? kept : calls.length === 1 ? short : textAtLength(200, '평균을 ');
      onRow(validator.accept({ id, sentences: [{ a: 1, t }] }));
    }
  }, (row) => rows.push(row));
  expect(calls).toHaveLength(2);
  expect(calls[1].groups[0].ids).toEqual(['s1']);
  expect(calls[1].revisions?.[0]).toMatchObject({ id: 's1', text: short });
  expect(calls[1].revisions?.[0].reason).toContain('현재 공백 포함 150자');
  expect(calls[1].revisions?.[0].reason).toContain('180~220자');
  expect(rows.map((row) => row.id)).toEqual(['s2', 's1']);
  expect(rows[0].comment?.sentences[0].text).toBe(kept);
  expect(rows.every((row) => !row.error)).toBe(true);
});

test.each([200, 300, 400] as const)('실제 %i자 요청에는 선택한 범위를 명시한다', (length) => {
  const body = buildNeisAiRequest({ action: 'generate-class', input: { ...input(), length } }, 'fixture');
  const { min, max } = commentLengthRange(length);
  expect(body.instructions).toContain(`${min}자 이상 ${max}자 이하`);
});

test('단일 학생 API도 분량 미달을 성공으로 반환하지 않는다', async () => {
  const handler = createNeisHandler({
    authorize: async () => 'fixture-owner', consumeQuota: async () => true, checkPdf: async () => {},
    analyze: async () => comment(textAtLength(179)),
  });
  const response = await handler(new Request('https://local.invalid', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'generate', input: { subject: '수학', length: 200, evidence: [{
      assessmentId: '1', standardCode: '가상', standard: '평균을 구한다.', task: '평균', grade: 'high', criterion: '자료의 평균을 구한다.',
    }] } }),
  }));
  expect(response.status).toBe(422);
  expect((await response.json()).error).toContain('180~220자');
});
