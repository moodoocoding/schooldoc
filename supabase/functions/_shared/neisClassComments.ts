import {
  NEIS_MAX_STUDENTS, NEIS_MAX_TASK_CONTEXT, NEIS_MAX_TASKS, commentStyleContext, repeatedCommentIds,
  validateCommentStyleContext, validateGeneratedComment, validateCommentLength,
} from './neisHelper.ts';
import type { CommentInput, GeneratedComment, NeisGrade } from './neisHelper.ts';

export interface ClassEvaluation {
  standardCode: string;
  standard: string;
  task: string;
  rubrics: Partial<Record<NeisGrade, string>>;
  taskContext?: string;
}
export interface ClassCommentInput {
  subject: string;
  length: CommentInput['length'];
  evaluations: ClassEvaluation[];
  groups: { ids: string[]; grades: NeisGrade[] }[];
  usedStarts?: string[];
  priorSentences?: string[];
  revisions?: { id: string; text: string; reason: string }[];
}
export interface ClassCommentRow { id: string; comment: GeneratedComment | null; error: string; rejectedText?: string }
export interface ClassCommentResult { rows: ClassCommentRow[] }
export type ClassCommentEvent = { type: 'row'; row: ClassCommentRow } | { type: 'done' } | { type: 'error'; message: string };

const levels = ['high', 'middle', 'low'] as const;
const isGrade = (value: unknown): value is NeisGrade => levels.some((level) => level === value);
const inputError = '학급의 평가기준과 성적 조합을 확인해 주세요.';

/** 익명 번호별로 시작 평가와 진행 방향을 분산한다. 선택 재생성에서도 순서를 유지한다. */
export function classAssessmentOrder(id: string, evaluationCount: number): number[] {
  const studentIndex = Number(id.slice(1)) - 1;
  const start = studentIndex % evaluationCount;
  const direction = Math.floor(studentIndex / evaluationCount) % 2 === 0 ? 1 : -1;
  return Array.from({ length: evaluationCount }, (_, index) =>
    (start + direction * index + evaluationCount) % evaluationCount + 1);
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(inputError);
  return value as Record<string, unknown>;
}
function list(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw new Error(inputError);
  return value;
}
function text(value: unknown, max: number) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(inputError);
  return value.trim();
}

export function validateClassInput(raw: unknown): ClassCommentInput {
  const value = object(raw);
  if (value.length !== 200 && value.length !== 300 && value.length !== 400) throw new Error(inputError);
  const evaluations = list(value.evaluations, NEIS_MAX_TASKS).map((item): ClassEvaluation => {
    const row = object(item);
    const rubrics = object(row.rubrics);
    return {
      standardCode: text(row.standardCode, 200), standard: text(row.standard, 2000), task: text(row.task, 1000),
      rubrics: Object.fromEntries(levels.flatMap((level) => rubrics[level] === undefined ? [] : [[level, text(rubrics[level], 2000)]])),
      ...(row.taskContext ? { taskContext: text(row.taskContext, NEIS_MAX_TASK_CONTEXT) } : {}),
    };
  });
  const studentIds = new Set<string>();
  const groups = list(value.groups, NEIS_MAX_STUDENTS).map((item) => {
    const row = object(item);
    const grades = list(row.grades, NEIS_MAX_TASKS);
    if (grades.length !== evaluations.length || !grades.every(isGrade) ||
      grades.some((grade, index) => !evaluations[index].rubrics[grade])) throw new Error(inputError);
    const ids = list(row.ids, NEIS_MAX_STUDENTS).map((id) => {
      if (typeof id !== 'string' || !/^s[1-9]\d?$/u.test(id) || studentIds.has(id)) throw new Error(inputError);
      studentIds.add(id);
      return id;
    });
    if (!ids.length) throw new Error(inputError);
    return { ids, grades };
  });
  if (!evaluations.length || !studentIds.size || studentIds.size > NEIS_MAX_STUDENTS) throw new Error(inputError);
  const revisionIds = new Set<string>();
  const revisions = value.revisions === undefined ? [] : list(value.revisions, NEIS_MAX_STUDENTS).map((item) => {
    const revision = object(item);
    const id = text(revision.id, 3);
    if (!studentIds.has(id) || revisionIds.has(id)) throw new Error(inputError);
    revisionIds.add(id);
    return { id, text: text(revision.text, 3000), reason: text(revision.reason, 400) };
  });
  return { subject: text(value.subject, 80), length: value.length, evaluations, groups, revisions, ...validateCommentStyleContext(value) };
}

export function validateClassOutput(raw: unknown, input: ClassCommentInput): ClassCommentResult {
  const validator = createClassOutputValidator(input);
  const rows = list(object(raw).rows, NEIS_MAX_STUDENTS).map((row) => validator.accept(row));
  const byId = new Map([...rows, ...validator.missing()].map((row) => [row.id, row]));
  return { rows: input.groups.flatMap((group) => group.ids.map((id) => byId.get(id)!)) };
}

export function createClassOutputValidator(input: ClassCommentInput) {
  const gradesById = new Map(input.groups.flatMap((group) => group.ids.map((id) => [id, group.grades] as const)));
  const seen = new Set<string>();
  const acceptedText = [...(input.priorSentences ?? [])];
  const reservedStarts = new Set(input.usedStarts ?? []);

  function accept(raw: unknown): ClassCommentRow {
    const row = object(raw);
    const id = row.id;
    const grades = typeof id === 'string' ? gradesById.get(id) : undefined;
    if (typeof id !== 'string' || !grades || seen.has(id))
      throw new Error('생성된 평어의 학생 연결이 잘못되었습니다. 다시 시도해 주세요.');
    seen.add(id);
    const evidence = input.evaluations.map((item, index) => ({
      ...item, assessmentId: String(index + 1), grade: grades[index], criterion: item.rubrics[grades[index]] ?? '',
    }));
    let rejectedText = '';
    try {
      const sentences = list(row.sentences, NEIS_MAX_TASKS).map((item) => {
        const sentence = object(item);
        const index = typeof sentence.a === 'number' && Number.isInteger(sentence.a) ? sentence.a - 1 : -1;
        return { text: sentence.t, assessmentId: String(index + 1), evidenceQuote: evidence[index]?.criterion };
      });
      rejectedText = sentences.map((sentence) => typeof sentence.text === 'string' ? sentence.text : '').join(' ').slice(0, 3000);
      const comment = validateGeneratedComment({ sentences }, { subject: input.subject, length: input.length, evidence }, true);
      rejectedText = comment.sentences.map((sentence) => sentence.text).join(' ');
      const expectedOrder = classAssessmentOrder(id, input.evaluations.length);
      const actualOrder = comment.sentences.map((sentence) => Number(sentence.assessmentId))
        .filter((assessmentId, index, ids) => index === 0 || assessmentId !== ids[index - 1]);
      if (actualOrder.join(',') !== expectedOrder.join(','))
        throw new Error(`배정된 평가 서술 순서(${expectedOrder.join(' → ')})에 맞춰 문장을 구성해 주세요. 성적과 평가의 연결은 유지해 주세요.`);
      const style = commentStyleContext([rejectedText]);
      const overlappingStarts = style.usedStarts.filter((start) => reservedStarts.has(start));
      if (overlappingStarts.length)
        throw new Error(`평어 맨 처음의 '${overlappingStarts.join("', '")}'이 다른 학생의 시작과 겹칩니다. 배정된 첫 평가 영역에서 대상·방법·결과 중 시작 내용을 바꾸고, 중복 없는 나머지 문장은 유지해 주세요.`);
      const previous = { id: 'accepted', text: acceptedText.join('\n') };
      const repeatsSentence = (candidate: string) => repeatedCommentIds([
        previous, { id, text: candidate },
      ], { compareStarts: false }).has(id);
      if (repeatsSentence(rejectedText)) {
        const duplicates = style.priorSentences.filter(repeatsSentence).slice(0, 2);
        throw new Error(`본문에 다른 학생과 같거나 거의 같은 문장이 있습니다: ${duplicates.map((sentence) => `「${sentence.slice(0, 130)}」`).join(', ')}. 표시한 문장의 구성을 바꾸거나 같은 평가의 관련 내용과 자연스럽게 연결해 다시 작성해 주세요.`);
      }
      validateCommentLength(comment, input.length);
      acceptedText.push(rejectedText);
      for (const start of style.usedStarts) reservedStarts.add(start);
      return { id, comment, error: '' };
    } catch (error) {
      return { id, comment: null, error: error instanceof Error ? error.message : '평어를 다시 생성해 주세요.',
        ...(rejectedText ? { rejectedText } : {}) };
    }
  }

  const missing = (): ClassCommentRow[] => [...gradesById.keys()].filter((id) => !seen.has(id))
    .map((id) => ({ id, comment: null, error: '이 학생의 평어가 응답에 없습니다.' }));
  return { accept, missing };
}
