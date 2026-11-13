/** 브라우저와 서버가 함께 사용하는 입력·근거 검증. AI의 의미 판단을 보증하지 않는다. */
export type NeisGrade = 'high' | 'middle' | 'low';
export const GRADE_LABELS: Record<NeisGrade, string> = { high: '◎', middle: '○', low: '△' };
export interface Assessment {
  id: string;
  subject: string;
  /** 평가계획에 명시된 영역. 이전 분석 결과에는 없을 수 있다. */
  domain?: string;
  standardCode: string;
  standard: string;
  task: string;
  rubrics: Record<NeisGrade, string>;
  /** 평가 시기 원문(예: 10월). 이전 분석 결과에는 없을 수 있다. */
  period?: string;
  /** 수행평가 기준안·평가지에서 정리한 수업·평가 방법, 채점 요소, 평가지 문항. 학생별 사실이 아니다. */
  taskDetails?: string;
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
  /** 평가지·채점 요소. 서버 검증에서 근거 문장으로 함께 사용한다. */
  context?: string;
  /** 앞 시기 평가보다 높은 성취를 보인 평가. 향상·성장 표현을 허용한다. */
  rising?: boolean;
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
      ...(item.domain === undefined ? {} : { domain: text(item.domain, 200) }),
      standardCode: text(item.standardCode, 200),
      standard: text(item.standard, 2000),
      task: text(item.task, 1000),
      rubrics: {
        high: text(item.rubrics.high, 2000),
        middle: text(item.rubrics.middle, 2000),
        low: text(item.rubrics.low, 2000),
      },
      ...(item.period === undefined ? {} : { period: text(item.period, 40) }),
      ...(item.taskDetails === undefined ? {} : { taskDetails: text(item.taskDetails, NEIS_MAX_TASK_CONTEXT) }),
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
    const basis = `${evidence.criterion}\n${evidence.context ?? ''}`;
    const inferredClaims = [/어려[움워운웠우]/u, /미흡/u, /부족/u, /도움|도와/u, /노력/u,
      /리더십/u, /자기\s*주도/u, /적극/u, /흥미/u, /자신감/u];
    if (inferredClaims.some((claim) => claim.test(sentence.text) && !claim.test(basis)))
      throw new Error('평가기준에 없는 어려움·도움·태도 등의 표현이 포함되었습니다. 다시 생성해 주세요.');
    // 향상·성장은 같은 영역에서 시기 순서상 성적이 오른 평가에서만 쓴다.
    if (/향상|성장|발전|나아[짐졌지]|앞선\s*시기|이전\s*시기|이전보다/u.test(sentence.text) && !evidence.rising && !/향상|성장|발전/u.test(basis))
      throw new Error('같은 영역의 앞 시기보다 성적이 오른 평가에서만 향상·성장 표현을 쓸 수 있습니다. 다시 생성해 주세요.');
    if (/(?:연습|보완|노력)이\s*필요|기대[됨된]|처음에는|학기\s*초/u.test(sentence.text))
      throw new Error('부족한 점·전망·성장 서사 표현은 쓰지 않습니다. 확인된 수행만 긍정적으로 다시 써 주세요.');
    // 중·하 수준에는 평가기준에 없는 상 수준 수식어를 쓰지 않는다.
    if (evidence.grade !== 'high') {
      const strong = sentence.text.match(/정확(?:히|하게)|능숙|체계적|뛰어|우수|탁월|돋보|막힘\s*없/u)?.[0];
      if (strong && !basis.includes(strong))
        throw new Error(`중·하 수준 평가에 상 수준 표현 '${strong}'이 있습니다. 해당 수준의 평가기준에 맞게 담백하게 다시 써 주세요.`);
    }
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
/** 나이스 기준: 한글 3Byte, 영문·숫자 1Byte, 엔터 1Byte(2026 기재요령 참고자료 07). */
export function countComment(textValue: string) {
  const normalized = textValue.replace(/\r\n?/g, '\n');
  return {
    characters: Array.from(normalized).length,
    bytes: new TextEncoder().encode(normalized).length,
  };
}

/** 기재요령의 서술형 표기·기재 금지 사항 중 문자열로 확인할 수 있는 것만 알린다. 의미 판단은 교사가 한다. */
const RECORD_SYMBOLS = /[◎○◌△●•▪■□◆◇★☆※→⇒①-⑳㉠-㉭"“”'‘’「」『』<>《》#*_`~|]/u;
const RECORD_NUMBERING = /(?:^|\n)\s*(?:\d{1,2}[.)]|[가나다라마바사아자차카타파하][.)]|-)\s/u;
const RECORD_BANNED: [RegExp, string][] = [
  [/대회|수상|입상|금상|은상|동상|장려상|최우수상|우수상|표창/u, '대회·수상'],
  [/인증\s*시험|자격증|급수|토익|토플|TOEIC|TOEFL|HSK|JLPT/iu, '인증시험·자격증'],
  [/방과\s*후/u, '방과후학교'],
  [/K-?MOOC|KOCW|MOOC/iu, '온라인 공개강좌'],
  [/학원|과외|사교육/u, '사교육'],
  [/해외|어학\s*연수|유학/u, '해외 활동'],
  [/부모님의?\s*직업|아버지의?\s*직업|어머니의?\s*직업/u, '부모 직업'],
  [/장학/u, '장학'],
];
const ALLOWED_ENGLISH = new Set(['CEO', 'PD', 'UCC', 'IT', 'POP', 'CF', 'TV', 'PAPS', 'SNS', 'PPT', 'AI', 'CD', 'DVD', 'PC', 'USB', 'QR', 'URL']);
export function recordTextProblems(textValue: string): string[] {
  const problems: string[] = [];
  if (RECORD_SYMBOLS.test(textValue)) problems.push('특수문자');
  if (RECORD_NUMBERING.test(textValue)) problems.push('문단 번호');
  for (const [pattern, label] of RECORD_BANNED) if (pattern.test(textValue)) problems.push(label);
  const english = (textValue.match(/[A-Za-z]{2,}/g) ?? []).filter((word) => !ALLOWED_ENGLISH.has(word.toUpperCase()));
  if (english.length) problems.push('영문 표기');
  return [...new Set(problems)];
}
export function commentLengthRange(target: CommentInput['length']) {
  return { min: Math.ceil(target * 0.9), max: Math.floor(target * 1.1) };
}
export function validateCommentLength(comment: GeneratedComment, target: CommentInput['length']): GeneratedComment {
  const characters = countComment(comment.sentences.map((sentence) => sentence.text).join(' ')).characters;
  const { min, max } = commentLengthRange(target);
  if (characters < min || characters > max) {
    const correction = characters < min
      ? `목표 ${target}자에 맞추어 약 ${target - characters}자 보완하세요. 평가 과제에서 수행한 과정과 성취 특성을 보완하고, 성취기준 문장을 되풀이하거나 새로운 사실·반복 문구를 추가하지 마세요.`
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
