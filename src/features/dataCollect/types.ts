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
