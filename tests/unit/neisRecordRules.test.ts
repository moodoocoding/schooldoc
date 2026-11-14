import { describe, expect, test } from 'vitest';
import { countComment, recordTextProblems, validateCommentLength, validateGeneratedComment, validatePlan } from '../../supabase/functions/_shared/neisHelper';
import type { CommentInput } from '../../supabase/functions/_shared/neisHelper';
import { createClassOutputValidator, risingEvaluations } from '../../supabase/functions/_shared/neisClassComments';
import type { ClassCommentInput } from '../../supabase/functions/_shared/neisClassComments';
import { buildNeisAiRequest } from '../../supabase/functions/neis-helper/core';
import { subjectExampleBlock } from '../../supabase/functions/neis-helper/subjectExamples';
import { teacherCommentPrompt } from '../../supabase/functions/neis-helper/teacherCommentPrompt';
import { reconcileSourcePages } from '../../src/features/neisHelper/sourcePages';
import { neisFunctionName } from '../../src/features/neisHelper/subjectApi';
import { buildClassRequest } from '../../src/features/neisHelper/classWorkflow';
import type { Assessment, GradeBook } from '../../supabase/functions/_shared/neisHelper';

const rubrics = { high: '자료를 정확하게 정리할 수 있다.', middle: '자료를 정리할 수 있다.', low: '자료를 간단히 정리할 수 있다.' };

describe('2026 기재요령 표기 검사', () => {
  test('특수문자·문단 번호·금지 내용·영문을 알린다', () => {
    expect(recordTextProblems('조사한 내용을 표로 정리함. 토의에서 의견을 밝힘.')).toEqual([]);
    expect(recordTextProblems('PPT와 TV 자료를 활용해 발표함.')).toEqual([]);
    expect(recordTextProblems('◎ 수준으로 정리함.')).toContain('특수문자');
    expect(recordTextProblems('1. 조사함.\n2. 발표함.')).toContain('문단 번호');
    expect(recordTextProblems('교내 글쓰기 대회에서 수상함.')).toContain('대회·수상');
    expect(recordTextProblems('방과후 수업에서 익힘.')).toContain('방과후학교');
    expect(recordTextProblems('presentation 자료를 만듦.')).toContain('영문 표기');
    expect(recordTextProblems('気持ち를 전하는 편지를 씀.')).toContain('한글 외 문자');
  });
  test('평범한 문장의 끝 글자를 문단 번호로 오인하지 않는다', () => {
    expect(recordTextProblems('보고서를 씀. 다양한 매체 자료를 활용함. 편지를 완성함.')).toEqual([]);
  });
});

describe('평가계획의 시기와 과정·채점 요소', () => {
  const raw = {
    year: '2026', schoolGrade: '4', semester: '2',
    assessments: [{
      subject: '국어', domain: '쓰기', standardCode: '[4국03-02], [4국06-01]',
      standard: '[4국03-02] 보고하는 글을 쓴다. [4국06-01] 자료를 탐색한다.', task: '조사해 보고하는 글 쓰기',
      rubrics, period: '10월', taskDetails: '보고서. 조사 대상·기간·방법을 밝히고 출처를 적음.', sourcePage: 1, warnings: [],
    }],
  };
  test('기간과 과정 요약을 보존하고 이전 결과에는 없어도 된다', () => {
    const plan = validatePlan(raw);
    expect(plan.assessments[0]).toMatchObject({ period: '10월', taskDetails: '보고서. 조사 대상·기간·방법을 밝히고 출처를 적음.' });
    const { period: _p, taskDetails: _t, ...legacy } = raw.assessments[0];
    expect(validatePlan({ ...raw, assessments: [legacy] }).assessments[0].period).toBeUndefined();
  });
  test('성취기준이 여러 개여도 표 안에서 떨어진 코드와 본문으로 쪽을 찾는다', () => {
    const plan = validatePlan(raw);
    const page = '[4국03-02] 보고하는 글을 쓴다. 조사해 보고하는 글 쓰기 [4국06-01] 자료를 탐색한다. ' +
      Object.values(rubrics).join(' ');
    expect(reconcileSourcePages(plan, ['다른 쪽', page]).assessments[0].sourcePage).toBe(2);
  });
  test('평가계획 분석 요청은 시기와 과정·채점 요소를 함께 받는다', () => {
    const request = buildNeisAiRequest({ action: 'plan', data: 'JVBERi0=' }, 'model') as {
      instructions: string; text: { format: { schema: { properties: { assessments: { items: { required: string[] } } } } } };
    };
    expect(request.text.format.schema.properties.assessments.items.required).toEqual(expect.arrayContaining(['period', 'taskDetails']));
    expect(request.instructions).toContain('수행평가 기준안');
  });
});

describe('시기 순서상 오른 성적', () => {
  test('같은 영역의 앞 시기보다 높은 평가만 찾는다', () => {
    const evaluations = [{ period: '10월', domain: '쓰기' }, { period: '11월', domain: '쓰기' }, { period: '12월', domain: '쓰 기' }];
    expect(risingEvaluations(evaluations, ['middle', 'high', 'high'])).toEqual([2, 3]);
    expect(risingEvaluations(evaluations, ['high', 'middle', 'low'])).toEqual([]);
    expect(risingEvaluations([{ period: '3~4월', domain: '읽기' }, { period: '1월', domain: '읽기' }], ['low', 'middle'])).toEqual([2]);
  });
  test('다른 영역끼리는 비교하지 않는다', () => {
    const evaluations = [{ period: '10월', domain: '쓰기' }, { period: '11월', domain: '듣기·말하기' }, { period: '12월', domain: '문법' }];
    expect(risingEvaluations(evaluations, ['middle', 'high', 'high'])).toEqual([]);
  });
  test('시기나 영역을 모르면 판단하지 않는다', () => {
    expect(risingEvaluations([{ period: '', domain: '쓰기' }, { period: '11월', domain: '쓰기' }], ['low', 'high'])).toEqual([]);
    expect(risingEvaluations([{ period: '10월' }, { period: '11월' }], ['low', 'high'])).toEqual([]);
  });
  test('중·하 수준의 상 수준 수식어와 부족·전망 표현을 거절한다', () => {
    const input: CommentInput = { subject: '국어', length: 200, evidence: [{
      assessmentId: '1', standardCode: '[4국03-02]', standard: '글을 쓴다.', task: '보고서 쓰기', grade: 'middle', criterion: rubrics.middle,
    }] };
    const say = (text: string) => validateGeneratedComment({ sentences: [{ text, assessmentId: '1', evidenceQuote: rubrics.middle }] }, input);
    expect(() => say('자료를 정확히 정리함.')).toThrow('상 수준 표현');
    expect(() => say('자료를 정리하는 능력이 돋보임.')).toThrow('상 수준 표현');
    expect(() => say('자료를 정리하는 연습이 필요함.')).toThrow('부족한 점');
    expect(() => say('자료를 정리하며 정리하는 방법을 익힘.')).not.toThrow();
    expect(() => validateGeneratedComment({ sentences: [{ text: '자료를 정확하게 정리함.', assessmentId: '1', evidenceQuote: rubrics.high }] },
      { ...input, evidence: [{ ...input.evidence[0], grade: 'high', criterion: rubrics.high }] })).not.toThrow();
  });
  test('평가 방법 이름을 거절하고 결과 화면에도 표시한다', () => {
    const input: CommentInput = { subject: '미술', length: 200, evidence: [{
      assessmentId: '1', standardCode: '[4미01-03]', standard: '살펴본다.', task: '모양과 특징 살펴보기', grade: 'high', criterion: rubrics.high,
      context: '서술형 평가: 특징을 글로 설명하기. 채점 기준: 특징 설명, 느낌 표현',
    }] };
    const say = (text: string) => validateGeneratedComment({ sentences: [{ text, assessmentId: '1', evidenceQuote: rubrics.high }] }, input);
    for (const text of ['서술형 평가에서 특징을 설명함.', '수행평가에서 느낌을 나타냄.', '지필 평가에서 답함.', '평가지에 특징을 정리함.', '채점 요소를 갖추어 설명함.'])
      expect(() => say(text)).toThrow('평가 방법 표현');
    expect(() => say('글자 모양의 특징을 찾아 글로 설명하고 느낌을 그림으로 나타냄.')).not.toThrow();
    expect(recordTextProblems('서술형 평가에서 특징을 설명함.')).toContain('평가 방법 표현');
    expect(recordTextProblems('특징을 글로 설명하고 친구와 감상을 나눔.')).toEqual([]);
    const request = buildNeisAiRequest({ action: 'generate-class', input: { subject: '미술', length: 200,
      evaluations: [{ standardCode: 'A', standard: '가', task: '살펴보기', rubrics: { high: rubrics.high } }],
      groups: [{ ids: ['s1'], grades: ['high'] }] } }, 'model') as { instructions: string };
    expect(request.instructions).toContain('평가 방법 이름');
  });
  test('학급 평어에서 평가어와 능력 문장 반복을 거절한다', () => {
    const input: CommentInput = { subject: '국어', length: 200, evidence: [{
      assessmentId: '1', standardCode: '[4국03-02]', standard: '글을 쓴다.', task: '보고서 쓰기', grade: 'high', criterion: rubrics.high,
    }] };
    const say = (texts: string[]) => validateGeneratedComment({ sentences: texts.map((text) => ({ text, assessmentId: '1', evidenceQuote: rubrics.high })) }, input, true);
    expect(() => say(['자료를 정리하는 능력이 돋보임.', '보고서를 쓰는 능력이 뛰어남.', '발표하는 능력이 우수함.'])).toThrow('반복');
    expect(() => say(['자료 정리가 돋보임.', '보고서 구성이 돋보임.', '발표가 돋보임.'])).toThrow('반복');
    expect(() => say(['자료 정리가 돋보임.', '보고서를 쓰는 솜씨가 뛰어남.', '발표 내용이 우수하고 막힘이 없음.'])).not.toThrow();
    expect(() => say(['気持ち를 전하는 편지를 씀.'])).toThrow('한글이 아닌 문자');
    expect(() => say(['자료를 짜임새 있게 정리함.', '보고서를 쓰는 데 능숙하고 결과를 전달하는 능력이 돋보임.'])).not.toThrow();
  });
  test('개조식 문장 수 안내와 교사 원문·국어 문체 예시가 기재요령과 200자 분량 기준을 따른다', async () => {
    const { commentLengthInstruction } = await import('../../supabase/functions/neis-helper/commentPrompts');
    const length200 = commentLengthInstruction(200, 1);
    expect(length200).toContain('문장당 약 30~40자');
    expect(length200).toContain('전체 약 6문장');
    expect(length200).toContain('과목별 고정 단계를 억지로 붙이지 말고');

    const teacherExample = teacherCommentPrompt.match(/- 교과평어:\s*(.+)/u)?.[1]?.trim() ?? '';
    const block = subjectExampleBlock('국어');
    const subjectExamples: [string, 'high' | 'middle' | 'low'][] = [
      [block.match(/- 상:\s*(.+)/u)?.[1]?.trim() ?? '', 'high'],
      [block.match(/- 중:\s*(.+)/u)?.[1]?.trim() ?? '', 'middle'],
      [block.match(/- 하:\s*(.+)/u)?.[1]?.trim() ?? '', 'low'],
      [block.match(/- 같은 상 수준을 다른 순서로 쓴 예:\s*(.+)/u)?.[1]?.trim() ?? '', 'high'],
    ];

    for (const [text, grade] of [[teacherExample, 'high'] as const, ...subjectExamples]) {
      expect(text).not.toBe('');
      expect(text).not.toContain(',');
      expect(text).not.toMatch(/(?:솜씨|능력|힘)이\s*(?:뛰어남|우수함|돋보임)/u);
      expect(recordTextProblems(text)).toEqual([]);
      const sentences = text.split(/(?<=\.)\s+/u).filter(Boolean);
      expect(sentences.length).toBeGreaterThanOrEqual(5);
      expect(sentences.length).toBeLessThanOrEqual(6);
      expect(countComment(text).characters).toBeGreaterThanOrEqual(180);
      expect(countComment(text).characters).toBeLessThanOrEqual(220);
      const criterion = '주장에 알맞은 근거를 마련하고 글의 짜임을 계획하여 고쳐 쓰며 표현한다.';
      const validated = validateGeneratedComment(
        { sentences: sentences.map((s) => ({ text: s, assessmentId: '1', evidenceQuote: criterion })) },
        { subject: '국어', length: 200, evidence: [{ assessmentId: '1', standardCode: '[6국05-04]', standard: criterion, task: '글 쓰기', grade, criterion }] },
        true,
      );
      expect(validateCommentLength(validated, 200).sentences).toHaveLength(sentences.length);
    }
  });

  test('평가 수에 비해 분량이 많으면 채울 재료를 안내하고 능력 문장을 평가마다 허용한다', async () => {
    const { commentLengthInstruction } = await import('../../supabase/functions/neis-helper/commentPrompts');
    expect(commentLengthInstruction(300, 2)).toContain('평가 하나에 쓸 분량이 많다');
    expect(commentLengthInstruction(300, 3)).not.toContain('평가 하나에 쓸 분량이 많다');
    const evidence = (id: string) => ({ assessmentId: id, standardCode: 'A', standard: '가', task: id, grade: 'high' as const, criterion: rubrics.high });
    const comment = { sentences: ['1', '2', '3'].map((id) => ({ text: `${id} 자료를 정리하는 능력이 드러남.`, assessmentId: id, evidenceQuote: rubrics.high })) };
    expect(() => validateGeneratedComment(comment, { subject: '국어', length: 400, evidence: ['1', '2', '3'].map(evidence) }, true)).not.toThrow();
    expect(() => validateGeneratedComment(comment, { subject: '국어', length: 200, evidence: ['1', '2', '3'].map(evidence) }, true)).toThrow('반복');
  });
  test('학급 요청에 해당 교과 문체 예시만 넣는다', () => {
    const base: ClassCommentInput = { subject: '국어', length: 200,
      evaluations: [{ standardCode: 'A', standard: '가', task: '보고서 쓰기', rubrics: { high: rubrics.high } }],
      groups: [{ ids: ['s1'], grades: ['high'] }] };
    const korean = buildNeisAiRequest({ action: 'generate-class', input: base }, 'model') as { instructions: string };
    expect(korean.instructions).toContain('국어 문체 예시');
    const science = buildNeisAiRequest({ action: 'generate-class', input: { ...base, subject: '과학' } }, 'model') as { instructions: string };
    expect(science.instructions).not.toContain('문체 예시 —');
  });
  test('향상 표현은 오른 평가에서만 통과한다', () => {
    const input: CommentInput = { subject: '국어', length: 200, evidence: [{
      assessmentId: '1', standardCode: '[4국03-04]', standard: '글을 쓴다.', task: '편지 쓰기', grade: 'high', criterion: rubrics.high,
    }] };
    const comment = { sentences: [{ text: '편지 쓰기 실력이 향상됨.', assessmentId: '1', evidenceQuote: rubrics.high }] };
    expect(() => validateGeneratedComment(comment, input)).toThrow('향상');
    expect(() => validateGeneratedComment(comment, { ...input, evidence: [{ ...input.evidence[0], rising: true }] })).not.toThrow();
  });
  test('학급 요청에 오른 평가를 학생별로 전달하고 검증에도 쓴다', () => {
    const input: ClassCommentInput = {
      subject: '국어', length: 200,
      evaluations: [
        { standardCode: 'A', standard: '가', task: '보고서 쓰기', rubrics: { middle: rubrics.middle }, period: '10월', domain: '쓰기', taskContext: '조사 방법을 밝힘.' },
        { standardCode: 'B', standard: '나', task: '편지 쓰기', rubrics: { high: rubrics.high }, period: '12월', domain: '쓰기' },
      ],
      groups: [{ ids: ['s1'], grades: ['middle', 'high'] }],
    };
    const request = buildNeisAiRequest({ action: 'generate-class', input }, 'model') as { input: { content: { text: string }[] }[] };
    expect(JSON.parse(request.input[0].content[0].text).students[0].rising).toEqual([2]);
    const row = createClassOutputValidator(input).accept({ id: 's1', sentences: [
      { a: 1, t: '우리말 사용을 조사하고 조사 대상과 방법을 밝혀 보고서로 정리함.' },
      { a: 2, t: '앞선 활동보다 표현이 향상되어 받는 이를 생각하며 높임 표현을 바르게 쓴 편지를 완성함. 상대에게 전하고 싶은 감사의 마음을 짜임에 맞게 담아내는 모습이 돋보임.' },
    ] });
    expect(row.error).not.toContain('향상');
  });
});

describe('평가계획의 과정 요약을 학급 요청에 사용', () => {
  test('따로 넣은 평가지가 없으면 평가계획의 과정·채점 요소와 시기를 보낸다', () => {
    const assessment: Assessment = {
      id: 'a1', subject: '국어', standardCode: '[4국03-02]', standard: '보고하는 글을 쓴다.', task: '보고서 쓰기',
      rubrics, period: '10월', taskDetails: '조사 대상·방법을 밝히고 출처를 적음.', sourcePage: 1, warnings: [],
    };
    const book: GradeBook = { context: '', columns: [{ id: 'c1', label: '보고서 쓰기' }],
      students: [{ id: 'st1', number: '1', name: '가상학생', grades: ['◎'], sourceRow: 1 }] };
    const { input } = buildClassRequest('국어', 200, book, book.students, [assessment], { c1: 'a1' }, {}, {});
    expect(input.evaluations[0]).toMatchObject({ taskContext: '조사 대상·방법을 밝히고 출처를 적음.', period: '10월' });
    const { input: withSheet } = buildClassRequest('국어', 200, book, book.students, [assessment], { c1: 'a1' },
      { a1: { file: null, convertedFile: null, text: '', taskContext: '평가지 문항', warning: '' } as never }, {});
    expect(withSheet.evaluations[0].taskContext).toBe('평가지 문항');
  });
});

describe('시험용 함수 이름', () => {
  test('neis-helper 계열 이름만 허용한다', () => {
    expect(neisFunctionName(undefined)).toBe('neis-helper');
    expect(neisFunctionName(' neis-helper-next ')).toBe('neis-helper-next');
    expect(neisFunctionName('registry-pdf')).toBe('neis-helper');
    expect(neisFunctionName('neis-helper/../x')).toBe('neis-helper');
  });
});
