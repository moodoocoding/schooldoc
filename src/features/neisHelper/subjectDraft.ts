import type {
  AssessmentPlan,
  GradeBook,
  GeneratedComment,
} from '../../../supabase/functions/_shared/neisHelper';
import type { ImportSheet } from '../../utils/tabularImport';
export type SubjectStep =
  | 'plan-upload'
  | 'subject'
  | 'plan-review'
  | 'grade-upload'
  | 'sheet'
  | 'header'
  | 'mapping'
  | 'coverage'
  | 'roster'
  | 'grades'
  | 'length'
  | 'results';
export interface CommentDraft {
  text: string;
  generated: GeneratedComment | null;
  reviewed: boolean;
  error: string;
}
export interface SubjectDraft {
  step: SubjectStep;
  planFile: File | null;
  gradeFile: File | null;
  plan: AssessmentPlan | null;
  subject: string;
  planIndex: number;
  sheets: ImportSheet[];
  sheetIndex: number;
  headerIndex: number;
  book: GradeBook | null;
  originalBook: GradeBook | null;
  excludedRows: GradeBook['students'];
  mappings: Record<string, string>;
  columnIndex: number;
  gradeIndex: number;
  length: 200 | 300 | 400;
  results: Record<string, CommentDraft>;
  studentIndex: number;
}
export const emptySubjectDraft = (): SubjectDraft => ({
  step: 'plan-upload',
  planFile: null,
  gradeFile: null,
  plan: null,
  subject: '',
  planIndex: 0,
  sheets: [],
  sheetIndex: 0,
  headerIndex: -1,
  book: null,
  originalBook: null,
  excludedRows: [],
  mappings: {},
  columnIndex: 0,
  gradeIndex: 0,
  length: 200,
  results: {},
  studentIndex: 0,
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
