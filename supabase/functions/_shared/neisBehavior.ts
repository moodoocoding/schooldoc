import { commentLengthRange, repeatedCommentIds } from './neisHelper.ts';

export type BehaviorLength = 200 | 300 | 400;
export interface BehaviorStudent { id: string; traits: string[]; notes: string }
export interface BehaviorInput {
  length: BehaviorLength;
  students: BehaviorStudent[];
  /** Kept classmates are comparison material, never facts about a target student. */
  avoid: string[];
}
export interface BehaviorRow { id: string; text: string; error: string }
export type BehaviorEvent = { type: 'row'; row: BehaviorRow } | { type: 'done' } | { type: 'error'; message: string };

const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('학생 자료 형식을 확인해 주세요.');
  return value as Record<string, unknown>;
};
const string = (value: unknown, max: number) => {
  if (typeof value !== 'string' || value.length > max) throw new Error('학생 자료의 글자 수를 확인해 주세요.');
  return value.trim();
};
export function validateBehaviorInput(raw: unknown): BehaviorInput {
  const input = record(raw);
  if (![200, 300, 400].includes(Number(input.length)) || typeof input.length !== 'number') throw new Error('작성 분량을 선택해 주세요.');
  if (!Array.isArray(input.students) || !input.students.length || input.students.length > 60) throw new Error('학생은 1~60명까지 요청할 수 있습니다.');
  const ids = new Set<string>();
  const students = input.students.map((rawStudent) => {
    const student = record(rawStudent);
    const id = string(student.id, 5);
    if (!/^s[1-9]\d{0,2}$/.test(id) || ids.has(id)) throw new Error('학생 식별자가 중복되거나 올바르지 않습니다.');
    ids.add(id);
    if (!Array.isArray(student.traits) || student.traits.length > 12) throw new Error('학생별 특성은 12개까지 선택해 주세요.');
    const traits = [...new Set(student.traits.map((value) => string(value, 60)).filter(Boolean))];
    const notes = string(student.notes, 2000);
    if (!traits.length && !notes) throw new Error('학생별 특성 또는 교사 메모를 입력해 주세요.');
    return { id, traits, notes };
  });
  if (!Array.isArray(input.avoid) || input.avoid.length > 60) throw new Error('비교 문장을 확인해 주세요.');
  const avoid = input.avoid.map((value) => string(value, 3000));
  return { length: input.length as BehaviorLength, students, avoid };
}

/** Rules that can be verified mechanically; factual correctness still needs the teacher's edits. */
export function behaviorTextIssues(text: string): string[] {
  const issues: string[] = [];
  if (!text.trim()) return ['내용이 없습니다.'];
  if (text.length > 3000) issues.push('내용이 너무 깁니다.');
  if (/[\r\n]/.test(text)) issues.push('한 문단으로 작성해 주세요.');
  if (/[*#_`◎○◌△•①②③※<>]|^\s*\d+[.)]/u.test(text)) issues.push('강조·번호·특수문자를 확인해 주세요.');
  if (/(모범생|장애우|어린이|칭찬함|비범함|아주|매우)/u.test(text)) issues.push('금지 표현이 있습니다.');
  if (/(^|[.\s])(그리고|그래서|또한|이로 인해|따라서|이러한|하지만)(?=\s|[,])/u.test(text)) issues.push('상투적인 연결어가 있습니다.');
  const sentences = text.split(/(?<=[.!?。])\s*/u).filter(Boolean);
  // Korean nominal endings include 지님/기름/이끎 as well as 함/임/음.
  if (sentences.some((sentence) => {
    const last = sentence.replace(/[.]$/u, '').trim().at(-1)?.charCodeAt(0) ?? 0;
    return last < 0xac00 || last > 0xd7a3 || ![16, 10].includes((last - 0xac00) % 28);
  })) issues.push('문장 끝을 명사형으로 확인해 주세요.');
  if (/(대회|수상|인증시험|자격증|장학금|해외연수|방과후학교|K-MOOC|영재교육.*이수)/iu.test(text)) issues.push('기재 범위를 벗어날 수 있는 내용이 있습니다.');
  return issues;
}

export function createBehaviorValidator(input: BehaviorInput) {
  const expected = new Set(input.students.map((student) => student.id));
  const seen = new Set<string>();
  return {
    accept(raw: unknown): BehaviorRow {
      const value = record(raw);
      if (typeof value.id !== 'string' || !expected.has(value.id) || seen.has(value.id)) throw new Error('학생 응답 식별자가 일치하지 않습니다.');
      seen.add(value.id);
      const text = typeof value.text === 'string' ? value.text.trim() : '';
      const issues = behaviorTextIssues(text);
      if (text) {
        const characters = behaviorCounts(text).characters;
        const { min, max } = commentLengthRange(input.length);
        if (characters < min || characters > max) issues.push(`현재 공백 포함 ${characters}자입니다. 선택한 ${input.length}자의 범위는 ${min}~${max}자입니다. 특성과 메모의 의미를 충분히 풀어 분량에 맞게 다시 작성해 주세요.`);
      }
      return { id: value.id, text: text.slice(0, 3000), error: issues.join(' ') };
    },
    missing(): BehaviorRow[] { return [...expected].filter((id) => !seen.has(id)).map((id) => ({ id, text: '', error: '응답이 누락되었습니다. 다시 요청해 주세요.' })); },
  };
}

export const behaviorDuplicates = (rows: { id: string; text: string }[]) => repeatedCommentIds(rows.filter((row) => row.text.trim()));
export function identicalBehaviorIds(rows: { id: string; text: string }[]): Set<string> {
  const groups = new Map<string, string[]>();
  for (const row of rows) {
    const key = row.text.normalize('NFKC').replace(/\s+/gu, '');
    if (key) groups.set(key, [...(groups.get(key) ?? []), row.id]);
  }
  return new Set([...groups.values()].filter((ids) => ids.length > 1).flat());
}
export function behaviorCounts(text: string) {
  const normalized = text.replace(/\r\n?/g, '\n');
  return { characters: Array.from(normalized).length, bytes: new TextEncoder().encode(normalized).length };
}
