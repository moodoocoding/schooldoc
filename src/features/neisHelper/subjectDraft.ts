import type {
  AssessmentPlan,
  GradeBook,
  GeneratedComment,
} from '../../../supabase/functions/_shared/neisHelper';
import type { ColumnLink } from './autoPipeline';

/** plan: 평가계획 넣기 · prepare: 교과 선택과 성적 넣기 · results: 평어 결과 */
export type SubjectPhase = 'plan' | 'prepare' | 'results';
/** subject: 교과를 먼저 고르고 그 교과 계획만 넣는다 · whole: 전체 계획을 넣고 AI가 교과별로 나눈다 */
export type PlanMode = 'subject' | 'whole';
export interface CommentDraft {
  text: string;
  generated: GeneratedComment | null;
  error: string;
}
export interface SubjectDraft {
  phase: SubjectPhase;
  planMode: PlanMode;
  chosenSubject: string;
  planFile: File | null;
  planPdf: File | null;
  plan: AssessmentPlan | null;
  subject: string;
  gradeFile: File | null;
  gradeSheet: string;
  book: GradeBook | null;
  links: Record<string, ColumnLink>;
  length: 200 | 300 | 400;
  results: Record<string, CommentDraft>;
  /** 결과를 만든 뒤 연결·기준을 바꿨는지. 다시 생성하기 전까지 안내한다. */
  stale: boolean;
}
export const emptySubjectDraft = (): SubjectDraft => ({
  phase: 'plan',
  planMode: 'subject',
  chosenSubject: '',
  planFile: null,
  planPdf: null,
  plan: null,
  subject: '',
  gradeFile: null,
  gradeSheet: '',
  book: null,
  links: {},
  length: 200,
  results: {},
  stale: false,
});
// 개인정보는 영구 저장하지 않는다. 같은 로그인 계정의 탭 내부 이동만 복원한다.
let owner = '';
let cached: SubjectDraft | null = null;
export function clearNeisDraftUnless(ownerId: string) {
  if (owner !== ownerId) {
    owner = ownerId;
    cached = null;
  }
}
export function readSubjectDraft(ownerId: string) {
  clearNeisDraftUnless(ownerId);
  return cached ?? emptySubjectDraft();
}
export function saveSubjectDraft(ownerId: string, draft: SubjectDraft) {
  if (owner === ownerId) cached = draft;
}
