import type { BehaviorInput, BehaviorLength, BehaviorRow } from '../../../supabase/functions/_shared/neisBehavior';
export interface BehaviorEntry {
  id: string; number: number; name: string; traits: string[]; notes: string;
  text: string; error: string; edited: boolean; stale: boolean;
}
export interface BehaviorDraft { entries: BehaviorEntry[]; length: BehaviorLength; results: boolean }
const empty = (): BehaviorDraft => ({ entries: [], length: 400, results: false });
let owner = '';
let cached = empty();
export function clearBehaviorDraftUnless(id: string) { if (owner !== id) { owner = id; cached = empty(); } }
export function readBehaviorDraft(id: string) { clearBehaviorDraftUnless(id); return cached; }
export function saveBehaviorDraft(id: string, draft: BehaviorDraft) { clearBehaviorDraftUnless(id); cached = draft; }
export const newBehaviorEntries = (roster: { number: number; name: string }[]): BehaviorEntry[] => roster.toSorted((a, b) => a.number - b.number).map((s, index) => ({ ...s, id: `s${index + 1}`, traits: [], notes: '', text: '', error: '', edited: false, stale: false }));
export const hasBehaviorInput = (entry: BehaviorEntry) => !!(entry.traits.length || entry.notes.trim());
export function buildBehaviorInput(draft: BehaviorDraft, ids: string[]): BehaviorInput {
  const target = new Set(ids);
  const entries = draft.entries.filter((entry) => target.has(entry.id));
  // Number and name stay in the browser. Explicitly enumerate the allowed fields.
  return { length: draft.length, students: entries.map(({ id, traits, notes }) => ({ id, traits, notes })), avoid: draft.entries.filter((entry) => !target.has(entry.id) && entry.text.trim()).map((entry) => entry.text) };
}
export function applyBehaviorRow(entries: BehaviorEntry[], row: BehaviorRow): BehaviorEntry[] {
  return entries.map((entry) => entry.id === row.id ? { ...entry, text: row.text || entry.text, error: row.error, edited: false, stale: row.text ? false : entry.stale } : entry);
}
export const BEHAVIOR_TRAITS: Record<string, string[]> = {
  '학습 태도': ['학습 의욕', '집중력', '꾸준한 과제 수행', '자기주도 학습', '적극적인 발표', '질문과 탐구', '창의적인 생각', '끈기', '책 읽기', '꼼꼼한 확인'],
  '인성과 정서': ['배려', '정직', '책임감', '차분함', '밝은 성격', '자신감', '예의 바른 태도', '감정 표현', '도전 정신'],
  '교우 관계와 공동체': ['협력', '경청', '친구 돕기', '다른 의견 존중', '갈등 조율', '약속 지키기', '공동 활동 참여'],
  '생활 습관': ['정리 정돈', '시간 관리', '규칙 준수', '준비물 챙기기', '건강한 생활 습관'],
  '발전이 필요한 부분': ['집중 유지에 도움 필요', '발표 자신감 기르기', '감정 조절 연습 필요', '과제 마무리 연습 필요', '차례 지키기 연습 필요', '친구 의견 듣기 연습 필요'],
};
