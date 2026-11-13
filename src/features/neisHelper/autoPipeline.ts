import {
  assessmentProblems,
  normalizeGrade,
} from '../../../supabase/functions/_shared/neisHelper';
import type {
  Assessment,
  AssessmentPlan,
  CommentEvidence,
  GradeBook,
  GradeStudent,
} from '../../../supabase/functions/_shared/neisHelper';
import type { ImportSheet } from '../../utils/tabularImport';
import { findHeaderRows, parseGradeSheet } from './subjectFiles';

/** 교과를 먼저 고르는 화면의 기본 목록. 평가계획에서 찾은 교과는 이와 무관하게 그대로 쓴다. */
export const ELEMENTARY_SUBJECTS = [
  '국어',
  '사회',
  '도덕',
  '수학',
  '과학',
  '실과',
  '체육',
  '음악',
  '미술',
  '영어',
  '바른 생활',
  '슬기로운 생활',
  '즐거운 생활',
];
export const UNKNOWN_SUBJECT = '교과 미확인';

/** '수학과'와 '수학', 띄어쓰기 차이만 같게 본다. '실과'·'과학'처럼 두 글자 교과는 그대로 둔다. */
export function subjectKey(subject: string) {
  const compact = subject.normalize('NFKC').replace(/\s+/g, '');
  return compact.length > 2 && compact.endsWith('과') ? compact.slice(0, -1) : compact;
}

export function planSubjects(plan: AssessmentPlan) {
  const subjects = new Map<string, { subject: string; count: number }>();
  for (const item of plan.assessments) {
    const subject = item.subject || UNKNOWN_SUBJECT;
    const key = subjectKey(subject);
    const entry = subjects.get(key) ?? { subject, count: 0 };
    entry.count++;
    subjects.set(key, entry);
  }
  return [...subjects.values()];
}

export class PlanSubjectMismatch extends Error {
  found: string[];
  constructor(chosen: string, found: string[]) {
    super(
      `이 파일에서 ${chosen} 평가를 찾지 못했습니다. 찾은 교과: ${found.join(', ')}. 여러 교과가 들어 있는 평가계획이면 '전체 평가계획' 방식을 사용해 주세요.`,
    );
    this.found = found;
  }
}

/**
 * 교과별 방식: 고른 교과의 평가만 남긴다. 교과 이름이 비었거나 한 교과뿐인 파일은
 * 교사가 고른 교과의 평가계획으로 본다. 다른 교과만 여럿 있으면 임의로 바꾸지 않고 알린다.
 */
export function focusPlanOnSubject(plan: AssessmentPlan, chosen: string): AssessmentPlan {
  const key = subjectKey(chosen);
  const matches = plan.assessments.filter((a) => subjectKey(a.subject) === key);
  if (matches.length) return { ...plan, assessments: matches.map((a) => ({ ...a, subject: chosen })) };
  const named = planSubjects(plan).filter((s) => s.subject !== UNKNOWN_SUBJECT);
  if (named.length > 1) throw new PlanSubjectMismatch(chosen, named.map((s) => s.subject));
  return { ...plan, assessments: plan.assessments.map((a) => ({ ...a, subject: chosen })) };
}

export function assessmentsFor(plan: AssessmentPlan | null, subject: string) {
  if (!plan || !subject) return [];
  const key = subjectKey(subject);
  return plan.assessments.filter((a) => subjectKey(a.subject || UNKNOWN_SUBJECT) === key);
}

/** 번호·이름 제목 행이 있는 첫 시트를 고른다. 판별이 모호한 시트는 건너뛴다. */
export function pickGradeBook(sheets: ImportSheet[]): { book: GradeBook; sheet: string } {
  let lastError = '';
  for (const sheet of sheets)
    for (const header of findHeaderRows(sheet.data)) {
      try {
        return { book: parseGradeSheet(sheet, header), sheet: sheet.sheet };
      } catch (e) {
        lastError = e instanceof Error ? e.message : '';
      }
    }
  throw new Error(
    lastError ||
      "번호·이름(성명) 제목이 있는 성적표를 찾지 못했습니다. 나이스에서 내려받은 원본 파일인지 확인해 주세요.",
  );
}

/** 평가 열과 학생 행이 아닌 줄(합계·빈 줄)을 뺀다. 번호나 이름 중 하나라도 있으면 학생으로 남긴다. */
export function studentRows(book: GradeBook): GradeBook {
  return {
    ...book,
    students: book.students.filter(
      (s) => s.name.trim() || /^\d{1,3}$/.test(s.number.trim().normalize('NFKC')),
    ),
  };
}

export type LinkMethod = 'exact' | 'domain' | 'similar' | 'order' | 'manual' | 'none';
export interface ColumnLink {
  assessmentId: string;
  method: LinkMethod;
}
const comparable = (s: string) =>
  s.replace(/[·ㆍ∙・]/gu, '').normalize('NFKC').replace(/[\s()[\]{}.,:;'"‘’“”\-_/]/gu, '').toLowerCase();
function bigrams(s: string) {
  const grams = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const gram = s.slice(i, i + 2);
    grams.set(gram, (grams.get(gram) ?? 0) + 1);
  }
  return grams;
}
export function labelSimilarity(a: string, b: string) {
  const x = comparable(a);
  const y = comparable(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) return 0.9;
  const gx = bigrams(x);
  const gy = bigrams(y);
  let shared = 0;
  for (const [gram, count] of gx) shared += Math.min(count, gy.get(gram) ?? 0);
  const total = Math.max(1, x.length - 1 + y.length - 1);
  return (2 * shared) / total;
}
const SIMILAR_THRESHOLD = 0.5;

/**
 * 성적 열을 평가에 자동으로 연결한다. 한 평가에는 한 열만 연결한다.
 * 원문의 영역을 먼저 구분하고, 고유한 영역은 해당 평가로 연결한다. 같은 영역에 여러 평가가 있으면 추측하지 않는다.
 * 영역이 없는 이전 분석 결과에서만 기존 순서 연결을 유지하고, 결과 화면에 그 사실을 표시한다.
 */
export function autoLinkColumns(book: GradeBook, assessments: Assessment[]): Record<string, ColumnLink> {
  const candidates = book.columns.flatMap((column) => {
    const label = comparable(column.label);
    const domains = assessments.filter((assessment) => label && comparable(assessment.domain ?? '') === label);
    if (domains.length) {
      const uniqueColumn = book.columns.filter((other) => comparable(other.label) === label).length === 1;
      return domains.length === 1 && uniqueColumn
        ? [{ column: column.id, assessment: domains[0].id, score: 1, rank: 2, method: 'domain' as LinkMethod }]
        : [];
    }
    return assessments.flatMap((assessment) => {
      const score = Math.max(
        labelSimilarity(column.label, assessment.task),
        labelSimilarity(column.label, assessment.standardCode) >= 0.9 ? 0.9 : 0,
      );
      return score >= SIMILAR_THRESHOLD
        ? [{ column: column.id, assessment: assessment.id, score, rank: score === 1 ? 3 : 1,
          method: (score === 1 ? 'exact' : 'similar') as LinkMethod }]
        : [];
    });
  });
  candidates.sort((a, b) => b.rank - a.rank || b.score - a.score);
  const links: Record<string, ColumnLink> = {};
  const used = new Set<string>();
  for (const c of candidates) {
    if (links[c.column] || used.has(c.assessment)) continue;
    links[c.column] = { assessmentId: c.assessment, method: c.method };
    used.add(c.assessment);
  }
  if (!used.size && !assessments.some((a) => a.domain?.trim()) && book.columns.length === assessments.length)
    book.columns.forEach((column, i) => {
      links[column.id] = { assessmentId: assessments[i].id, method: 'order' };
    });
  for (const column of book.columns) links[column.id] ??= { assessmentId: '', method: 'none' };
  return links;
}

/** 기준이 비어 있지 않은 평가에 연결된 열만 평어 근거로 쓴다. */
export function usableColumns(
  book: GradeBook,
  links: Record<string, ColumnLink>,
  assessments: Assessment[],
) {
  return book.columns.flatMap((column, index) => {
    const assessment = assessments.find((a) => a.id === links[column.id]?.assessmentId);
    return assessment && !assessmentProblems(assessment).length ? [{ column, index, assessment }] : [];
  });
}

/** 학생별로 평어를 만들 수 없는 이유. 빈 배열이면 생성할 수 있다. */
export function studentProblems(
  book: GradeBook,
  links: Record<string, ColumnLink>,
  assessments: Assessment[],
): Map<string, string[]> {
  const counts = new Map<string, number>();
  const numberKey = (s: GradeStudent) => {
    const n = s.number.trim().normalize('NFKC');
    return /^\d+$/.test(n) ? String(Number(n)) : n;
  };
  for (const s of book.students) counts.set(numberKey(s), (counts.get(numberKey(s)) ?? 0) + 1);
  const columns = usableColumns(book, links, assessments);
  return new Map(
    book.students.map((student) => {
      const problems: string[] = [];
      const number = student.number.trim().normalize('NFKC');
      if (!/^\d{1,3}$/.test(number) || Number(number) < 1) problems.push('번호 확인');
      else if ((counts.get(numberKey(student)) ?? 0) > 1) problems.push('번호 중복');
      if (!student.name.trim()) problems.push('이름 없음');
      for (const { column, index } of columns)
        if (!normalizeGrade(student.grades[index]))
          problems.push(`${column.label} ${student.grades[index] ? `'${student.grades[index]}' 확인` : '빈칸'}`);
      return [student.id, problems];
    }),
  );
}

export function studentEvidence(
  book: GradeBook,
  student: GradeStudent,
  links: Record<string, ColumnLink>,
  assessments: Assessment[],
): CommentEvidence[] {
  return usableColumns(book, links, assessments).flatMap(({ index, assessment }) => {
    const grade = normalizeGrade(student.grades[index]);
    return grade
      ? [
          {
            assessmentId: assessment.id,
            standardCode: assessment.standardCode,
            standard: assessment.standard,
            task: assessment.task,
            grade,
            criterion: assessment.rubrics[grade],
          },
        ]
      : [];
  });
}

/** 동시에 몇 건씩 요청한다. 한도·로그인 오류는 호출부가 stop()으로 나머지를 멈춘다. */
export async function runLimited<T>(
  items: T[],
  limit: number,
  task: (item: T, stop: () => void) => Promise<void>,
) {
  let next = 0;
  let stopped = false;
  const stop = () => {
    stopped = true;
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (!stopped && next < items.length) await task(items[next++], stop);
    }),
  );
}
