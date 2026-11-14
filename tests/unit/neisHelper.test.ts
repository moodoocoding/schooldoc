import { describe, expect, test } from 'vitest';
import {
  assessmentProblems,
  buildEvidence,
  countComment,
  mappingProblems,
  missingGrades,
  normalizeGrade,
  repeatedCommentIds,
  rosterProblems,
  suggestAssessment,
  validateCommentInput,
  validateGeneratedComment,
  validateGradeBook,
  validatePlan,
} from '../../supabase/functions/_shared/neisHelper';
import type { Assessment } from '../../supabase/functions/_shared/neisHelper';
import { findHeaderRows, parseGradeSheet } from '../../src/features/neisHelper/subjectFiles';
import { parseDelimitedImportText } from '../../src/utils/tabularImport';
import {
  clearNeisDraftUnless,
  emptySubjectDraft,
  readSubjectDraft,
  saveSubjectDraft,
} from '../../src/features/neisHelper/subjectDraft';

const assessment: Assessment = {
  id: 'assessment-1',
  subject: '수학',
  standardCode: '[6수04-01]',
  standard: '평균의 의미를 알고 평균을 구한다.',
  task: '평균 구하기',
  rubrics: {
    high: '평균과 관련된 문제를 능숙하게 해결한다.',
    middle: '주어진 자료의 평균을 구한다.',
    low: '간단한 자료의 평균을 구한다.',
  },
  sourcePage: 3,
  warnings: [],
};
const second: Assessment = {
  ...assessment,
  id: 'assessment-2',
  task: '소수 곱셈',
  standardCode: '[6수01-13]',
};
const book = () =>
  validateGradeBook({
    context: '5학년 1반',
    columns: ['평균 구하기', '소수 곱셈'],
    students: [
      { number: '1', name: '가상학생', grades: ['◎', null] },
      { number: '2', name: '가상학생', grades: ['△', '◌'] },
    ],
  });
const mapping = { 'column-1': assessment.id, 'column-2': second.id };

describe('NEIS 평가 근거와 성적 무결성', () => {
  test('평가계획의 명시된 영역을 보존하며 영역이 없는 기존 결과도 읽는다', () => {
    const value = { year: '2026', schoolGrade: '5학년', semester: '2학기', assessments: [assessment] };
    expect(validatePlan(value).assessments[0].domain).toBeUndefined();
    expect(validatePlan({ ...value, assessments: [{ ...assessment, domain: ' 자료와 가능성 ' }] })
      .assessments[0].domain).toBe('자료와 가능성');
    expect(() => validatePlan({ ...value, assessments: [{ ...assessment, domain: 123 }] })).toThrow();
    expect(() => validatePlan({ ...value, assessments: [{ ...assessment, domain: '가'.repeat(201) }] })).toThrow();
  });
  test('빈 중간 칸과 동명이인을 그대로 보존한다', () => {
    const parsed = validateGradeBook({
      context: '',
      columns: ['A', 'B', 'C'],
      students: [
        { number: '1', name: '동명', grades: ['◎', null, '△'] },
        { number: '2', name: '동명', grades: ['○', '◎', '△'] },
      ],
    });
    expect(parsed.students[0].grades).toEqual(['◎', '', '△']);
    expect(parsed.students).toHaveLength(2);
    expect(rosterProblems(parsed.students)).toEqual([]);
  });
  test('정규화 가능한 기호만 읽으며 알 수 없는 4단계 등급을 임의 매핑하지 않는다', () => {
    expect(['○', '◌', '◯', ' 중 '].map(normalizeGrade)).toEqual(['middle', 'middle', 'middle', 'middle']);
    expect(['', '잘함', '매우잘함', 3, 'A', 'O'].map(normalizeGrade)).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
  });
  test('열 개수 불일치는 부분 성적으로 허용하지 않는다', () => {
    expect(() =>
      validateGradeBook({
        context: '',
        columns: ['A', 'B'],
        students: [{ number: '1', name: '학생', grades: ['◎'] }],
      }),
    ).toThrow('개수');
  });
  test('번호 01과 1은 중복이고 빈 번호·이름도 막는다', () => {
    const rows = book().students;
    rows[0].number = '01';
    rows[1].number = '1';
    rows[1].name = '';
    expect(rosterProblems(rows).join(' ')).toContain('중복');
    expect(rosterProblems(rows).join(' ')).toContain('이름');
  });
  test('중복 평가 연결과 미연결을 막고 제목 유사도만으로 자동 확정하지 않는다', () => {
    expect(
      mappingProblems(book(), [assessment, second], {
        'column-1': assessment.id,
        'column-2': assessment.id,
      }).join(' '),
    ).toContain('두 열');
    expect(mappingProblems(book(), [assessment, second], {}).length).toBeGreaterThan(0);
    expect(suggestAssessment('평균', [assessment])).toBe('');
    expect(suggestAssessment('평균 구하기', [assessment, { ...assessment, id: 'duplicate' }])).toBe('');
  });
  test('명시적으로 제외한 열은 생성 근거와 누락 검사에서 제외한다', () => {
    const maps = { ...mapping, 'column-2': '__skip__' };
    expect(missingGrades(book(), maps)).toHaveLength(0);
    expect(buildEvidence(book(), 'student-1', [assessment, second], maps)).toHaveLength(1);
    expect(
      mappingProblems(book(), [assessment], { 'column-1': '__skip__', 'column-2': '__skip__' }).join(' '),
    ).toContain('한 개 이상');
  });
  test('빈 성적은 생성 불가, 하 성적에는 하 기준만 전달하고 이름은 전달하지 않는다', () => {
    expect(missingGrades(book(), mapping)).toEqual([
      { studentId: 'student-1', columnId: 'column-2', columnIndex: 1, raw: '' },
    ]);
    expect(() => buildEvidence(book(), 'student-1', [assessment, second], mapping)).toThrow('비어');
    const evidence = buildEvidence(book(), 'student-2', [assessment, second], mapping);
    expect(evidence[0].criterion).toBe(assessment.rubrics.low);
    expect(JSON.stringify(evidence)).not.toContain('가상학생');
    expect(JSON.stringify(evidence)).not.toContain('도움');
  });
  test('수준별 기준과 성취기준을 보존하며 빈 기준을 검토 단계에서 막는다', () => {
    const plan = validatePlan({
      year: '2026',
      schoolGrade: '5학년',
      semester: '2학기',
      assessments: [assessment],
    });
    expect(plan.assessments[0].rubrics).toEqual(assessment.rubrics);
    expect(assessmentProblems({ ...assessment, rubrics: { ...assessment.rubrics, low: '' } })).toContain(
      '△ 평가기준',
    );
  });
  test('생성 서버 입력은 빈 기준·미확인 등급·중복 ID를 거부한다', () => {
    const evidence = buildEvidence(book(), 'student-2', [assessment, second], mapping);
    expect(() =>
      validateCommentInput({ subject: '수학', length: 300, evidence: [{ ...evidence[0], criterion: '' }] }),
    ).toThrow();
    expect(() =>
      validateCommentInput({ subject: '수학', length: 300, evidence: [evidence[0], evidence[0]] }),
    ).toThrow();
    expect(() => validateCommentInput({ subject: '수학', length: 250, evidence })).toThrow();
  });
  test('생성 결과의 알 수 없는 근거·변조된 인용·누락된 평가를 거부한다', () => {
    const evidence = buildEvidence(book(), 'student-2', [assessment, second], mapping);
    const input = { subject: '수학', length: 200 as const, evidence };
    const sentences = evidence.map((e) => ({
      text: '평균을 구함.',
      assessmentId: e.assessmentId,
      evidenceQuote: e.criterion,
    }));
    expect(validateGeneratedComment({ sentences }, input).sentences).toHaveLength(2);
    expect(() =>
      validateGeneratedComment(
        { sentences: [{ ...sentences[0], assessmentId: 'invented' }, sentences[1]] },
        input,
      ),
    ).toThrow('연결');
    expect(() =>
      validateGeneratedComment(
        { sentences: [{ ...sentences[0], evidenceQuote: '잘함' }, sentences[1]] },
        input,
      ),
    ).toThrow('연결');
    expect(() => validateGeneratedComment({ sentences: [sentences[0]] }, input)).toThrow('빠진');
  });
  test('공백·한글·CRLF·이모지 분량을 코드로 계산하고 공통 문장을 표시한다', () => {
    // 나이스 기준: 한글 3, 영문·공백 1, 엔터 1바이트.
    expect(countComment('가 A\r\n😀')).toEqual({ characters: 5, bytes: 10 });
    expect(countComment('가나\n1a')).toEqual({ characters: 5, bytes: 9 });
    const repeated = repeatedCommentIds([
      { id: 'a', text: '주어진 자료를 활용하여 평균을 구함.' },
      { id: 'b', text: '주어진 자료를 활용하여 평균을 구함. 다른 내용을 설명함.' },
    ]);
    expect([...repeated]).toEqual(['a', 'b']);
  });
  test('평가기준에 없는 낮은 능력 추정을 차단하고 하 수준만 도움·노력 서술을 허용한다', () => {
    const evidence = buildEvidence(book(), 'student-2', [assessment, second], mapping).slice(0, 1);
    evidence[0].criterion = '간단한 자료의 평균을 구할 수 있다.';
    const input = { subject: '수학', length: 200 as const, evidence };
    const value = (text: string) => ({ sentences: [{
      text, assessmentId: evidence[0].assessmentId, evidenceQuote: evidence[0].criterion,
    }] });
    const at = (grade: 'high' | 'middle' | 'low') => ({ ...input, evidence: [{ ...evidence[0], grade }] });
    expect(() => validateGeneratedComment(value('평균 구하기에 어려움이 있으나 기본적인 과정을 수행함.'), at('low'))).toThrow('평가기준에 없는');
    for (const text of ['교사의 도움으로 평균을 구함.', '평균을 구하려고 노력함.']) {
      expect(() => validateGeneratedComment(value(text), at('middle'))).toThrow('평가기준에 없는');
      expect(() => validateGeneratedComment(value(text), at('low'))).not.toThrow();
    }
    expect(() => validateGeneratedComment(value('평균을 구하는 연습이 필요함.'), at('low'))).toThrow('부족한 점');
    expect(validateGeneratedComment(value('간단한 자료의 평균을 구함'), input).sentences[0].text).toBe('간단한 자료의 평균을 구함.');
    evidence[0].criterion = '교사의 도움으로 간단한 평균을 구한다.';
    expect(validateGeneratedComment(value('교사의 도움으로 간단한 평균을 구함.'), input).sentences).toHaveLength(1);
  });
});
describe('파일 표 구조와 탭 메모리', () => {
  test('쉼표 포함 과제명·제목 행·빈 성적을 잃지 않는다', async () => {
    const rows = await parseDelimitedImportText(
      '2026학년도 5학년 2학기\n번호,이름,"평균, 자료",소수\n1,가상가,,△\n2,가상나,◎,○',
    );
    expect(findHeaderRows(rows)).toEqual([1]);
    const parsed = parseGradeSheet({ sheet: '수학', data: rows }, 1);
    expect(parsed.columns.map((c) => c.label)).toEqual(['평균, 자료', '소수']);
    expect(parsed.students[0].grades).toEqual(['', '△']);
    expect(parsed.students[0].sourceRow).toBe(3);
    expect(parsed.context).toContain('2026학년도');
  });
  test('빈 제목의 성적 열도 보존하고 이름 없는 행을 임의 삭제하지 않는다', () => {
    const data = [
      ['번호', '성명', '', '평균'],
      [1, '가상가', '◎', '○'],
      ['', '', '△', '○'],
    ];
    const parsed = parseGradeSheet({ sheet: '수학', data }, 0);
    expect(parsed.columns[0].label).toContain('제목 없음');
    expect(parsed.students).toHaveLength(2);
    expect(rosterProblems(parsed.students).length).toBeGreaterThan(0);
  });
  test('제목 행·다중 이름 열·60명 초과를 거부한다', () => {
    expect(() =>
      parseGradeSheet(
        {
          sheet: 's',
          data: [
            ['학생', '성적'],
            ['가', '◎'],
          ],
        },
        0,
      ),
    ).toThrow('번호');
    expect(() =>
      parseGradeSheet(
        {
          sheet: 's',
          data: [
            ['번호', '이름', '성명'],
            [1, '가', '나'],
          ],
        },
        0,
      ),
    ).toThrow('각각 하나');
    expect(() =>
      parseGradeSheet(
        {
          sheet: 's',
          data: [['번호', '이름', '평균'], ...Array.from({ length: 61 }, (_, i) => [i + 1, '학생', '◎'])],
        },
        0,
      ),
    ).toThrow('60명');
  });
  test('같은 계정의 내부 이동만 복원하고 로그아웃·계정 전환에는 초안을 비운다', () => {
    const draft = { ...emptySubjectDraft(), subject: '수학' };
    readSubjectDraft('teacher-a');
    saveSubjectDraft('teacher-a', draft);
    expect(readSubjectDraft('teacher-a').subject).toBe('수학');
    clearNeisDraftUnless('');
    expect(readSubjectDraft('teacher-a').subject).toBe('');
    saveSubjectDraft('teacher-a', draft);
    expect(readSubjectDraft('teacher-b').subject).toBe('');
    saveSubjectDraft('teacher-a', draft);
    expect(readSubjectDraft('teacher-b').subject).toBe('');
  });
});
