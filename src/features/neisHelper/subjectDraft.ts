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
  | 'grades'
  | 'length'
  | 'results';
export interface CommentDraft {
  text: string;
  generated: GeneratedComment | null;
  reviewed: boolean;
  error: string;
}
export interface AssessmentWorksheet {
  file: File;
  convertedFile: File | null;
  text: string;
  taskContext: string;
  warning: string;
}
export interface SubjectDraft {
  step: SubjectStep;
  planFile: File | null;
  planPdf: File | null;
  gradeFile: File | null;
  gradePdf: File | null;
  plan: AssessmentPlan | null;
  subject: string;
  reviewAssessmentId: string;
  worksheetAssessmentId: string;
  worksheets: Record<string, AssessmentWorksheet>;
  sheets: ImportSheet[];
  sheetIndex: number;
  headerIndex: number;
  bookOrigin: { sheetIndex: number; headerIndex: number } | null;
  book: GradeBook | null;
  originalBook: GradeBook | null;
  excludedRows: GradeBook['students'];
  mappings: Record<string, string>;
  length: 200 | 300 | 400;
  results: Record<string, CommentDraft>;
}
export const emptySubjectDraft = (): SubjectDraft => ({
  step: 'plan-upload',
  planFile: null,
  planPdf: null,
  gradeFile: null,
  gradePdf: null,
  plan: null,
  subject: '',
  reviewAssessmentId: '',
  worksheetAssessmentId: '',
  worksheets: {},
  sheets: [],
  sheetIndex: 0,
  headerIndex: -1,
  bookOrigin: null,
  book: null,
  originalBook: null,
  excludedRows: [],
  mappings: {},
  length: 200,
  results: {},
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
