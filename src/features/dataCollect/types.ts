export type DataCollectionKind = 'worksheet' | 'plan' | 'consent' | 'custom';
export type DataCollectionMode = 'fixed' | 'custom';
export type DataCollectionStatus = 'open' | 'closed';

export interface DataCollectionTarget {
  id: string;
  rowNumber: number;
  label: string;
  owner: string;
  personalToken: string;
}

export interface DataCollectionStoredFile {
  originalName: string;
  mimeType: string;
  byteSize: number;
  dataUrl: string;
}

export interface DataCollectionSubmission {
  id: string;
  targetId: string;
  revision: number;
  decision: 'confirmed' | 'corrected' | 'submitted';
  note: string;
  uploadedAt: string;
  file?: DataCollectionStoredFile;
}

export interface DataCollection {
  id: string;
  ownerId: string;
  publicToken: string;
  title: string;
  description: string;
  kind: DataCollectionKind;
  mode: DataCollectionMode;
  status: DataCollectionStatus;
  allowResubmit: boolean;
  dueAt: string;
  passwordHash: string;
  retentionMonths: number;
  sourceFile?: DataCollectionStoredFile;
  targets: DataCollectionTarget[];
  submissions: DataCollectionSubmission[];
  createdAt: string;
  updatedAt: string;
  /** 수합 종료 시각. 다시 열면 비워진다. */
  closedAt?: string;
}

export interface DataCollectionDraft {
  title: string;
  description: string;
  kind: DataCollectionKind;
  mode: DataCollectionMode;
  allowResubmit: boolean;
  dueAt: string;
  password: string;
  retentionMonths: number;
  targets: Array<Pick<DataCollectionTarget, 'label' | 'owner'>>;
}

export interface DataCollectionSummary {
  id: string;
  title: string;
  mode: DataCollectionMode;
  status: DataCollectionStatus;
  dueAt: string;
  createdAt: string;
  hasTemplate: boolean;
  total: number;
  responded: number;
  needsRepair: number;
  confirmed: number;
  corrected: number;
  submitted: number;
}
export interface DataCollectionCurrentResponse {
  id: string;
  decision: DataCollectionSubmission['decision'];
  revision: number;
  uploadedAt: string;
  hasNote: boolean;
  hasFile: boolean;
  byteSize: number;
}
export interface DataCollectionTargetStatus {
  id: string;
  rowNumber: number;
  label: string;
  owner: string;
  submission: DataCollectionCurrentResponse | null;
  needsRepair: boolean;
  note?: string;
  fileName?: string;
}
export interface DataCollectionOverview {
  collection: DataCollectionSummary & {
    publicToken: string;
    description: string;
    allowResubmit: boolean;
    templateName: string;
    closedAt: string;
    retentionMonths: number;
  };
  targets: DataCollectionTargetStatus[];
  nextAfter: number | null;
}
export interface DataCollectionHistoryItem {
  id: string;
  targetId: string;
  decision: DataCollectionSubmission['decision'];
  revision: number;
  note: string;
  uploadedAt: string;
  hasFile: boolean;
  fileName: string;
  byteSize: number;
}
export interface DataCollectionListCursor {
  before: string;
  beforeId: string;
}
export interface DataCollectionExport {
  title: string;
  hasTemplate: boolean;
  exportedAt: string;
  rows: DataCollectionTargetStatus[];
}
