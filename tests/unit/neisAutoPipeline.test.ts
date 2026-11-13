import { describe, expect, test } from 'vitest';
import type { Assessment, AssessmentPlan, GradeBook } from '../../supabase/functions/_shared/neisHelper';
import {
  assessmentsFor,
  autoLinkColumns,
  focusPlanOnSubject,
  pickGradeBook,
  planSubjects,
  PlanSubjectMismatch,
  runLimited,
  studentEvidence,
  studentProblems,
  studentRows,
  subjectKey,
} from '../../src/features/neisHelper/autoPipeline';

const item = (id: string, subject: string, task: string, extra: Partial<Assessment> = {}): Assessment => ({
  id,
  subject,
  standardCode: `[6${id}]`,
  standard: `${task} 성취기준`,
  task,
  rubrics: { high: `${task} 상`, middle: `${task} 중`, low: `${task} 하` },
  sourcePage: 1,
  warnings: [],
  ...extra,
});
const plan = (assessments: Assessment[]): AssessmentPlan => ({
  year: '2026',
  schoolGrade: '5학년',
  semester: '2학기',
  assessments,
});
const book = (labels: string[], rows: [string, string, ...string[]][]): GradeBook => ({
  context: '가상 5학년 1반',
  columns: labels.map((label, i) => ({ id: `column-${i + 1}`, label })),
  students: rows.map(([number, name, ...grades], i) => ({
    id: `student-${i + 1}`,
    number,
    name,
    grades,
    sourceRow: i + 2,
  })),
});

describe('평가계획 두 방식', () => {
  const whole = plan([
    item('a', '수학', '평균 구하기'),
    item('b', '수학과', '소수 곱셈'),
    item('c', '국어', '토론하기'),
    item('d', '실과', '바느질'),
  ]);
  test('전체 계획은 교과 이름의 띄어쓰기·"과" 차이를 하나로 묶는다', () => {
    expect(subjectKey('수학과')).toBe('수학');
    expect(subjectKey('실과')).toBe('실과');
    expect(subjectKey('슬기로운 생활')).toBe('슬기로운생활');
    expect(planSubjects(whole)).toEqual([
      { subject: '수학', count: 2 },
      { subject: '국어', count: 1 },
      { subject: '실과', count: 1 },
    ]);
    expect(assessmentsFor(whole, '수학').map((a) => a.id)).toEqual(['a', 'b']);
  });
  test('교과별 방식은 고른 교과만 남긴다', () => {
    const focused = focusPlanOnSubject(whole, '수학');
    expect(focused.assessments.map((a) => [a.id, a.subject])).toEqual([
      ['a', '수학'],
      ['b', '수학'],
    ]);
  });
  test('교과 이름이 없거나 한 교과뿐인 파일은 고른 교과의 계획으로 본다', () => {
    const single = focusPlanOnSubject(plan([item('a', '', '평균'), item('b', '', '곱셈')]), '수학');
    expect(single.assessments.every((a) => a.subject === '수학')).toBe(true);
    const named = focusPlanOnSubject(plan([item('a', '산수', '평균')]), '수학');
    expect(named.assessments[0].subject).toBe('수학');
  });
  test('다른 교과만 여럿 있으면 임의로 바꾸지 않고 전체 방식을 안내한다', () => {
    expect(() => focusPlanOnSubject(whole, '과학')).toThrow(PlanSubjectMismatch);
    try {
      focusPlanOnSubject(whole, '과학');
    } catch (e) {
      expect((e as PlanSubjectMismatch).found).toEqual(['수학', '국어', '실과']);
    }
  });
});

describe('성적표 자동 정리', () => {
  test('영역 머리글을 과제명과 혼동하지 않고 원문의 영역 관계로 연결한다', () => {
    const assessments = [
      item('reading', '국어', '작품을 감상하고 자신의 생각 나누기', { domain: '읽기' }),
      item('writing', '국어', '학급 누리집을 활용해 글 쓰기', { domain: '쓰기' }),
      item('speaking', '국어', '의견을 제시하고 토의하기', { domain: '듣기ㆍ말하기' }),
    ];
    const grades = book(['듣기·말하기', '쓰기', '읽기'], [['1', '가상학생', '◎', '○', '△']]);
    const links = autoLinkColumns(grades, assessments);
    expect(Object.values(links)).toEqual([
      { assessmentId: 'speaking', method: 'domain' },
      { assessmentId: 'writing', method: 'domain' },
      { assessmentId: 'reading', method: 'domain' },
    ]);
    expect(studentEvidence(grades, grades.students[0], links, assessments).map((e) => [e.assessmentId, e.grade]))
      .toEqual([['speaking', 'high'], ['writing', 'middle'], ['reading', 'low']]);
  });
  test('같은 영역의 평가가 여럿이면 부분 문자열이나 순서로 하나를 고르지 않는다', () => {
    const assessments = [
      item('a', '국어', '소개하는 글 쓰기', { domain: '쓰기' }),
      item('b', '국어', '의견을 나타내는 글 쓰기', { domain: '쓰기' }),
    ];
    const links = autoLinkColumns(book(['쓰기', '수행2'], []), assessments);
    expect(Object.values(links).every((link) => link.method === 'none')).toBe(true);
  });
  test('같은 영역의 성적 열이 여러 개일 때 원문 과제명이 있는 열을 우선한다', () => {
    const assessments = [item('a', '국어', '소개하는 글 쓰기', { domain: '쓰기' })];
    const links = autoLinkColumns(book(['쓰기', '소개하는 글 쓰기'], []), assessments);
    expect(links['column-2']).toEqual({ assessmentId: 'a', method: 'exact' });
    expect(links['column-1'].method).toBe('none');
    const duplicate = autoLinkColumns(book(['쓰기', '쓰기'], []), assessments);
    expect(Object.values(duplicate).every((link) => link.method === 'none')).toBe(true);
  });
  test('한 영역에 여러 평가가 있어도 구체적인 다단 머리글은 각 과제에 연결한다', () => {
    const assessments = [
      item('a', '국어', '소개하는 글 쓰기', { domain: '쓰기' }),
      item('b', '국어', '의견을 나타내는 글 쓰기', { domain: '쓰기' }),
    ];
    const links = autoLinkColumns(book(['쓰기 / 의견을 나타내는 글 쓰기', '쓰기 / 소개하는 글 쓰기'], []), assessments);
    expect([links['column-1'].assessmentId, links['column-2'].assessmentId]).toEqual(['b', 'a']);
  });
  test('번호·이름 제목 행이 있는 시트를 찾는다', () => {
    const picked = pickGradeBook([
      { sheet: '안내', data: [['나이스 내려받기 안내']] },
      {
        sheet: '수학',
        data: [['2026학년도 5학년 1반'], ['번호', '성명', '평균 구하기'], [1, '가상가', '◎']],
      },
    ]);
    expect(picked.sheet).toBe('수학');
    expect(picked.book.students).toHaveLength(1);
    expect(() => pickGradeBook([{ sheet: 'x', data: [['a', 'b']] }])).toThrow('번호');
  });
  test('번호도 이름도 없는 합계 행은 학생에서 뺀다', () => {
    const rows = studentRows(book(['평균'], [['1', '가'], ['', '', '◎'], ['평균', '']]));
    expect(rows.students.map((s) => s.name)).toEqual(['가']);
  });
  test('제목 일치·비슷한 제목을 한 평가에 한 열만 연결한다', () => {
    const assessments = [item('a', '수학', '평균 구하기'), item('b', '수학', '소수의 곱셈 계산하기')];
    const links = autoLinkColumns(book(['평균구하기', '소수 곱셈 계산', '평균 구하기(재평가)'], []), assessments);
    expect(links['column-1']).toEqual({ assessmentId: 'a', method: 'exact' });
    expect(links['column-2']).toEqual({ assessmentId: 'b', method: 'similar' });
    expect(links['column-3']).toEqual({ assessmentId: '', method: 'none' });
  });
  test('제목이 전혀 맞지 않고 수가 같을 때만 순서로 연결한다', () => {
    const assessments = [item('a', '수학', '평균 구하기'), item('b', '수학', '소수 곱셈')];
    expect(autoLinkColumns(book(['수행1', '수행2'], []), assessments)['column-2']).toEqual({
      assessmentId: 'b',
      method: 'order',
    });
    expect(autoLinkColumns(book(['수행1'], []), assessments)['column-1'].method).toBe('none');
  });
});

describe('학생별 판정과 근거', () => {
  const assessments = [
    item('a', '수학', '평균 구하기'),
    item('b', '수학', '소수 곱셈'),
    item('c', '수학', '도형', { rubrics: { high: '', middle: '도형 중', low: '도형 하' } }),
  ];
  const grades = book(
    ['평균 구하기', '소수 곱셈', '도형'],
    [
      ['1', '가상동명', '◎', '○', ''],
      ['2', '가상동명', '', '△', ''],
      ['2', '가상중복', '○', '?', '◎'],
      ['', '이름만', '◎', '◎', ''],
    ],
  );
  const links = autoLinkColumns(grades, assessments);
  test('빈 성적·읽지 못한 기호·번호 문제만 생성을 막고, 기준이 빈 평가의 빈칸은 막지 않는다', () => {
    const problems = studentProblems(grades, links, assessments);
    expect(problems.get('student-1')).toEqual([]);
    expect(problems.get('student-2')).toEqual(['번호 중복', '평균 구하기 빈칸']);
    expect(problems.get('student-3')).toEqual(['번호 중복', "소수 곱셈 '?' 확인"]);
    expect(problems.get('student-4')).toEqual(['번호 확인']);
  });
  test('근거에는 기준이 완전한 평가와 그 학생 수준의 기준만 넣는다', () => {
    const evidence = studentEvidence(grades, grades.students[0], links, assessments);
    expect(evidence.map((e) => [e.assessmentId, e.grade, e.criterion])).toEqual([
      ['a', 'high', '평균 구하기 상'],
      ['b', 'middle', '소수 곱셈 중'],
    ]);
  });
});

test('동시 요청 수를 지키고 stop 이후 새 작업을 시작하지 않는다', async () => {
  let active = 0;
  let peak = 0;
  const seen: number[] = [];
  await runLimited([1, 2, 3, 4, 5, 6], 3, async (n, stop) => {
    active++;
    peak = Math.max(peak, active);
    seen.push(n);
    await new Promise((r) => setTimeout(r, 5));
    if (n === 2) stop();
    active--;
  });
  expect(peak).toBe(3);
  expect(seen.length).toBeLessThan(6);
});
