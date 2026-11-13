/** 브라우저와 서버가 함께 사용하는 입력·근거 검증. AI의 의미 판단을 보증하지 않는다. */
export type NeisGrade = 'high' | 'middle' | 'low';
export const GRADE_LABELS: Record<NeisGrade, string> = { high: '◎', middle: '○', low: '△' };
export interface Assessment {
  id: string;
  subject: string;
  standardCode: string;
  standard: string;
  task: string;
  rubrics: Record<NeisGrade, string>;
  sourcePage: number | null;
  warnings: string[];
}
export interface AssessmentPlan {
  year: string;
  schoolGrade: string;
  semester: string;
  assessments: Assessment[];
}
export interface GradeColumn {
  id: string;
  label: string;
}
export interface GradeStudent {
  id: string;
  number: string;
  name: string;
  grades: string[];
  sourceRow: number;
}
export interface GradeBook {
  context: string;
  columns: GradeColumn[];
  students: GradeStudent[];
}
export interface CommentEvidence {
  assessmentId: string;
  standardCode: string;
  standard: string;
  task: string;
  grade: NeisGrade;
  criterion: string;
}
export interface CommentInput {
  subject: string;
  length: 200 | 300 | 400;
  evidence: CommentEvidence[];
}
export interface GroundedSentence {
  text: string;
  assessmentId: string;
  evidenceQuote: string;
}
export interface GeneratedComment {
  sentences: GroundedSentence[];
}
export const NEIS_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const NEIS_MAX_PAGES = 80;
export const NEIS_MAX_STUDENTS = 60;
export const NEIS_MAX_TASKS = 40;
export const NEIS_MAX_TASK_CONTEXT = 1200;
const MAX_COMMENT_STARTS = NEIS_MAX_STUDENTS * NEIS_MAX_TASKS * 2;
const MAX_PRIOR_SENTENCES = NEIS_MAX_STUDENTS * NEIS_MAX_TASKS;

const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
function text(v: unknown, max: number): string {
  if (typeof v !== 'string' || v.length > max) throw new Error('분석 결과의 문자열 형식을 확인해 주세요.');
  return v.trim();
}
function array(v: unknown, max: number): unknown[] {
  if (!Array.isArray(v) || v.length > max) throw new Error('분석 결과의 항목 수를 확인해 주세요.');
  return v;
}
export function normalizeGrade(value: unknown): NeisGrade | null {
  const valueText = String(value ?? '')
    .trim()
    .normalize('NFKC');
  if (['◎', '상'].includes(valueText)) return 'high';
  if (['○', '◯', '◌', '중'].includes(valueText)) return 'middle';
  if (['△', '하'].includes(valueText)) return 'low';
  return null; // 빈칸, 숫자, 알 수 없는 기호는 추측하지 않는다.
}
export function validatePlan(value: unknown): AssessmentPlan {
  if (!record(value)) throw new Error('평가계획 분석 결과를 읽지 못했습니다.');
  const assessments = array(value.assessments, 120).map((item, i): Assessment => {
    if (!record(item) || !record(item.rubrics)) throw new Error('평가기준 분석 결과를 확인해 주세요.');
    const page = item.sourcePage;
    if (page !== null && (!Number.isInteger(page) || Number(page) < 1 || Number(page) > NEIS_MAX_PAGES))
      throw new Error('평가계획의 원본 쪽 번호가 올바르지 않습니다.');
    return {
      id: `assessment-${i + 1}`,
      subject: text(item.subject, 80),
      standardCode: text(item.standardCode, 200),
      standard: text(item.standard, 2000),
      task: text(item.task, 1000),
      rubrics: {
        high: text(item.rubrics.high, 2000),
        middle: text(item.rubrics.middle, 2000),
        low: text(item.rubrics.low, 2000),
      },
      sourcePage: page as number | null,
      warnings: array(item.warnings, 10).map((w) => text(w, 500)),
    };
  });
  if (!assessments.length)
    throw new Error('평가 항목을 찾지 못했습니다. 성취기준과 수준별 평가기준이 있는 PDF를 올려 주세요.');
  return {
    year: text(value.year, 30),
    schoolGrade: text(value.schoolGrade, 30),
    semester: text(value.semester, 30),
    assessments,
  };
}
export function assessmentProblems(item: Assessment): string[] {
  const problems: string[] = [];
  if (!item.subject.trim()) problems.push('교과 이름');
  if (!item.task.trim()) problems.push('평가 내용');
  if (!item.standardCode.trim()) problems.push('성취기준 코드');
  if (!item.standard.trim()) problems.push('성취기준 내용');
  for (const grade of ['high', 'middle', 'low'] as const)
    if (!item.rubrics[grade].trim()) problems.push(`${GRADE_LABELS[grade]} 평가기준`);
  return problems;
}
export function validateGradeBook(value: unknown): GradeBook {
  if (!record(value)) throw new Error('성적 분석 결과를 읽지 못했습니다.');
  const columns = array(value.columns, NEIS_MAX_TASKS).map((label, i) => ({
    id: `column-${i + 1}`,
    label: text(label, 1000) || `${i + 1}번째 평가`,
  }));
  if (!columns.length) throw new Error('성적 파일에서 평가 열을 찾지 못했습니다.');
  const students = array(value.students, NEIS_MAX_STUDENTS).map((row, i): GradeStudent => {
    if (!record(row)) throw new Error('학생 명단 형식을 확인해 주세요.');
    const grades = array(row.grades, NEIS_MAX_TASKS);
    if (grades.length !== columns.length)
      throw new Error('평가 열과 성적 개수가 다릅니다. 원본의 빈칸을 포함해 다시 확인해 주세요.');
    return {
      id: `student-${i + 1}`,
      number: text(row.number, 30),
      name: text(row.name, 100),
      grades: grades.map((g) => (g === null ? '' : text(g, 80))),
      sourceRow: i + 1,
    };
  });
  if (!students.length)
    throw new Error('학생 명단을 찾지 못했습니다. 번호·이름·성적이 있는 파일을 올려 주세요.');
  return { context: text(value.context, 500), columns, students };
}
export function rosterProblems(students: GradeStudent[]): string[] {
  const seen = new Set<string>();
  const problems: string[] = [];
  for (const student of students) {
    const num = student.number.trim().normalize('NFKC');
    if (!/^\d{1,3}$/.test(num) || Number(num) < 1)
      problems.push(`${student.sourceRow}행의 번호를 확인해 주세요.`);
    const normalized = /^\d+$/.test(num) ? String(Number(num)) : num;
    if (seen.has(normalized))
      problems.push(`${student.number}번이 중복되었습니다. 한 학급의 성적만 사용해 주세요.`);
    seen.add(normalized);
    if (!student.name.trim()) problems.push(`${student.sourceRow}행의 이름이 비어 있습니다.`);
  }
  return problems;
}
/** 이름·순서 추정 없이 고유한 완전 일치만 제안한다. 제안도 사용자 확인 전에는 확정하지 않는다. */
export function suggestAssessment(label: string, assessments: Assessment[]): string {
  const normalize = (s: string) => s.normalize('NFKC').replace(/\s+/g, '').toLowerCase();
  const matches = assessments.filter((a) => normalize(a.task) === normalize(label));
  return matches.length === 1 ? matches[0].id : '';
}
export const SKIP_COLUMN = '__skip__';
export function mappingProblems(
  book: GradeBook,
  assessments: Assessment[],
  mappings: Record<string, string>,
): string[] {
  const seen = new Set<string>();
  const problems: string[] = [];
  for (const col of book.columns) {
    const id = mappings[col.id];
    if (id === SKIP_COLUMN) continue;
    if (!assessments.some((a) => a.id === id)) {
      problems.push(`${col.label}: 연결할 평가를 선택해 주세요.`);
      continue;
    }
    if (seen.has(id)) problems.push(`${col.label}: 같은 평가에 두 열이 연결되었습니다.`);
    seen.add(id);
  }
  if (!seen.size) problems.push('평어에 사용할 평가를 한 개 이상 연결해 주세요.');
  return problems;
}
export function missingGrades(book: GradeBook, mappings: Record<string, string>) {
  return book.students.flatMap((student) =>
    book.columns.flatMap((column, columnIndex) =>
      mappings[column.id] &&
      mappings[column.id] !== SKIP_COLUMN &&
      !normalizeGrade(student.grades[columnIndex])
        ? [{ studentId: student.id, columnId: column.id, columnIndex, raw: student.grades[columnIndex] }]
        : [],
    ),
  );
}
export function buildEvidence(
  book: GradeBook,
  studentId: string,
  assessments: Assessment[],
  mappings: Record<string, string>,
): CommentEvidence[] {
  if (rosterProblems(book.students).length || mappingProblems(book, assessments, mappings).length)
    throw new Error('명단과 평가 연결을 먼저 확인해 주세요.');
  const student = book.students.find((s) => s.id === studentId);
  if (!student) throw new Error('학생을 찾지 못했습니다.');
  return book.columns.flatMap((col, i): CommentEvidence[] => {
    if (mappings[col.id] === SKIP_COLUMN) return [];
    const item = assessments.find((a) => a.id === mappings[col.id]);
    const grade = normalizeGrade(student.grades[i]);
    if (!item || !grade || assessmentProblems(item).length)
      throw new Error('평가기준 또는 성적이 비어 있어 생성할 수 없습니다.');
    return [
      {
        assessmentId: item.id,
        standardCode: item.standardCode,
        standard: item.standard,
        task: item.task,
        grade,
        criterion: item.rubrics[grade],
      },
    ];
  });
}
export function validateCommentInput(value: unknown): CommentInput {
  if (!record(value) || ![200, 300, 400].includes(Number(value.length)))
    throw new Error('평어 분량을 선택해 주세요.');
  const subject = text(value.subject, 80);
  if (!subject) throw new Error('교과를 선택해 주세요.');
  const used = new Set<string>();
  const evidence = array(value.evidence, NEIS_MAX_TASKS).map((v): CommentEvidence => {
    if (!record(v) || !['high', 'middle', 'low'].includes(String(v.grade)))
      throw new Error('확인된 성적이 필요합니다.');
    const result = {
      assessmentId: text(v.assessmentId, 80),
      standardCode: text(v.standardCode, 200),
      standard: text(v.standard, 2000),
      task: text(v.task, 1000),
      grade: v.grade as NeisGrade,
      criterion: text(v.criterion, 2000),
    };
    if (Object.values(result).some((s) => !s) || used.has(result.assessmentId))
      throw new Error('누락되거나 중복된 평가 근거를 확인해 주세요.');
    used.add(result.assessmentId);
    return result;
  });
  if (!evidence.length) throw new Error('확인된 평가 근거가 필요합니다.');
  return { subject, length: Number(value.length) as CommentInput['length'], evidence };
}

const bannedStyle = /(?:^|[^가-힣])(?:모범생|장애우|어린이|칭찬함|아주|매우|비범함|그리고|그래서|또한|이로 인해|따라서|이러한|하지만)(?![가-힣])/u;

export function validateGeneratedComment(value: unknown, input: CommentInput, strictStyle = false): GeneratedComment {
  if (!record(value)) throw new Error('평어 결과를 읽지 못했습니다. 다시 생성해 주세요.');
  const sentences = array(value.sentences, NEIS_MAX_TASKS).map((v): GroundedSentence => {
    if (!record(v)) throw new Error('평어 문장 형식을 확인해 주세요.');
    const sentence = {
      text: text(v.text, 1000),
      assessmentId: text(v.assessmentId, 80),
      evidenceQuote: text(v.evidenceQuote, 2000),
    };
    const evidence = input.evidence.find((e) => e.assessmentId === sentence.assessmentId);
    if (!sentence.text || !evidence || sentence.evidenceQuote !== evidence.criterion)
      throw new Error('평어와 평가 근거의 연결을 확인하지 못했습니다. 다시 생성해 주세요.');
    // 연결 ID만으로 의미 정확성을 보증할 수 없다. 자주 발생하는 근거 없는 추정은 추가로 차단한다.
    const inferredClaims = [/어려[움워운웠우]/u, /미흡/u, /부족/u, /도움|도와/u, /노력/u,
      /향상/u, /성장/u, /발전/u, /리더십/u, /자기\s*주도/u, /적극/u, /흥미/u, /자신감/u];
    if (inferredClaims.some((claim) => claim.test(sentence.text) && !claim.test(evidence.criterion)))
      throw new Error('평가기준에 없는 어려움·도움·태도 등의 표현이 포함되었습니다. 다시 생성해 주세요.');
    const statement = sentence.text.replace(/[.!?。]+$/u, '').trimEnd();
    const last = statement.charCodeAt(statement.length - 1);
    if (strictStyle && (bannedStyle.test(statement) || /[*_`]/u.test(statement) || !(last >= 0xac00 && last <= 0xd7a3) || (last - 0xac00) % 28 !== 16))
      throw new Error('금지 표현이나 명사형 종결을 확인해 주세요. 평어를 다시 생성할 수 있습니다.');
    if (strictStyle) sentence.text = `${statement}.`;
    else if (!/[.!?。]$/u.test(sentence.text)) sentence.text += '.';
    return sentence;
  });
  if (!sentences.length || sentences.map((s) => s.text).join(' ').length > 3000)
    throw new Error('평어 분량을 확인하지 못했습니다. 다시 생성해 주세요.');
  if (input.evidence.some((e) => !sentences.some((s) => s.assessmentId === e.assessmentId)))
    throw new Error('생성 결과에 빠진 평가가 있습니다. 다시 생성해 주세요.');
  return { sentences };
}
export function countComment(textValue: string) {
  const normalized = textValue.replace(/\r\n?/g, '\n');
  return {
    characters: Array.from(normalized).length,
    bytes: new TextEncoder().encode(normalized).length + (normalized.match(/\n/g)?.length ?? 0),
  };
}
export function commentLengthRange(target: CommentInput['length']) {
  return { min: Math.ceil(target * 0.9), max: Math.floor(target * 1.1) };
}
export function validateCommentLength(comment: GeneratedComment, target: CommentInput['length']): GeneratedComment {
  const characters = countComment(comment.sentences.map((sentence) => sentence.text).join(' ')).characters;
  const { min, max } = commentLengthRange(target);
  if (characters < min || characters > max) {
    const correction = characters < min
      ? `목표 ${target}자에 맞추어 약 ${target - characters}자 보완하세요. 기존 평가기준의 기능·방법·결과를 구체적으로 풀어 쓰고 새로운 사실이나 반복 문구를 추가하지 마세요.`
      : `목표 ${target}자에 맞추어 약 ${characters - target}자 줄이세요. 모든 평가의 핵심 내용과 자연스러운 문장을 유지해 주세요.`;
    throw new Error(`현재 공백 포함 ${characters}자입니다. 선택한 ${target}자의 허용 범위는 ${min}~${max}자입니다. ${correction}`);
  }
  return comment;
}
export function repeatedCommentIds(rows: { id: string; text: string }[], { compareStarts = true } = {}): Set<string> {
  const owners = new Map<string, Set<string>>();
  const phrases: { owner: string; length: number; grams: number }[] = [];
  const postings = new Map<string, number[]>();
  const overlaps = new Set<string>();
  for (const row of rows) {
    const sentences = commentSentences(row.text);
    for (const key of [
      ...(compareStarts ? commentStartKeys(sentences[0] ?? '').map((start) => `start:${start}`) : []),
      ...sentences.flatMap((sentence) => {
      const words = sentence.match(/[\p{L}\p{N}]+/gu) ?? [];
      const normalized = words.join('');
      // Compare longer sentences even when a few words or the opening were replaced.
      if (normalized.length >= 26) {
        const grams = new Set(Array.from({ length: normalized.length - 2 }, (_, i) => normalized.slice(i, i + 3)));
        const counts = new Map<number, number>();
        for (const gram of grams) {
          const entries = postings.get(gram) ?? [];
          for (const index of entries) {
            if (phrases[index].owner !== row.id) counts.set(index, (counts.get(index) ?? 0) + 1);
          }
          entries.push(phrases.length);
          postings.set(gram, entries);
        }
        for (const [index, shared] of counts) {
          const candidate = phrases[index];
          if (Math.min(normalized.length, candidate.length) >= Math.max(normalized.length, candidate.length) * 0.8 &&
            2 * shared >= (grams.size + candidate.grams) * 0.86) {
            overlaps.add(row.id);
            overlaps.add(candidate.owner);
          }
        }
        phrases.push({ owner: row.id, length: normalized.length, grams: grams.size });
      }
      return [
        ...(normalized ? [`sentence:${normalized}`] : []),
        ...(words.length >= 4 ? [`words:${words.toSorted().join(' ')}`] : []),
      ];
    })]) {
      const set = owners.get(key) ?? new Set<string>();
      set.add(row.id);
      owners.set(key, set);
    }
  }
  for (const ids of owners.values()) if (ids.size > 1) for (const id of ids) overlaps.add(id);
  return overlaps;
}

function commentSentences(value: string) {
  return value.normalize('NFKC').toLowerCase().split(/\.(?!\d)|[!?。\n]+/u).map((part) => part.trim()).filter(Boolean);
}

function commentStartKeys(sentence: string) {
  const words = sentence.match(/[\p{L}\p{N}]+/gu) ?? [];
  const prefix = words.join('').slice(0, 3);
  return [...new Set([words[0]?.slice(0, 60), prefix.length === 3 ? prefix : ''].filter((key): key is string => !!key))];
}

export function commentStyleContext(comments: string[]) {
  const sentences = comments.flatMap(commentSentences);
  const usedStarts = [...new Set(comments.flatMap((comment) => commentStartKeys(commentSentences(comment)[0] ?? '')))];
  const priorSentences = [...new Set(sentences)];
  if (usedStarts.length > MAX_COMMENT_STARTS || priorSentences.length > MAX_PRIOR_SENTENCES || priorSentences.some((sentence) => sentence.length > 3000))
    throw new Error('비교할 평어가 너무 깁니다. 학생별 평어 분량을 확인해 주세요.');
  return { usedStarts, priorSentences };
}

export function validateCommentStyleContext(value: Record<string, unknown>) {
  const usedStarts = value.usedStarts === undefined ? [] : array(value.usedStarts, MAX_COMMENT_STARTS).map((entry) => text(entry, 60));
  const priorSentences = value.priorSentences === undefined ? [] : array(value.priorSentences, MAX_PRIOR_SENTENCES).map((entry) => text(entry, 3000));
  return { usedStarts, priorSentences };
}
