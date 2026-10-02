import type { FormSnapshot, HistoryEntry } from './studentResultsHistory';
import type { StudentResultImportAnalysis } from './studentResultsImport';

export interface StudentResultTabDraft {
  form: FormSnapshot;
  history: HistoryEntry[];
  pendingImport: StudentResultImportAnalysis | null;
  pendingImportFileName: string;
}

// Student data stays in this tab's memory; it is never written to browser storage.
let draft: { ownerId: string; value: StudentResultTabDraft } | null = null;
export const readStudentResultTabDraft = (ownerId: string) => {
  if (draft?.ownerId !== ownerId) { draft = null; return null; }
  return structuredClone(draft.value);
};
export const saveStudentResultTabDraft = (ownerId: string, value: StudentResultTabDraft) => {
  if (ownerId) draft = { ownerId, value: structuredClone(value) };
};
export const clearStudentResultTabDraft = (ownerId: string) => {
  if (draft?.ownerId === ownerId) draft = null;
};
