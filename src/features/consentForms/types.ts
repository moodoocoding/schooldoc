export interface ConsentDocumentAnalysis {
  fileName: string;
  fileSize: number;
  title: string;
  pageCount: number;
  pageCountLabel: string;
  textPreview: string;
  warnings: string[];
}

export type ConsentFieldKind = 'text' | 'checkbox' | 'date' | 'signature';

export interface ConsentFieldDraft {
  id: string;
  kind: ConsentFieldKind;
  label: string;
  required: boolean;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ConsentRecipientMode = 'named' | 'open';

export interface ConsentRecipientDraft {
  id: string;
  name: string;
  identifier: string;
}

export interface ConsentShareSettings {
  deadline: string;
  passwordEnabled: boolean;
  password: string;
  allowResubmission: boolean;
}

export interface ConsentLocalDraft {
  id: string;
  title: string;
  fileName: string;
  fieldCount: number;
  recipientMode: ConsentRecipientMode;
  recipientCount: number;
  createdAt: string;
  description: string;
  fields: ConsentFieldDraft[];
  publicToken: string;
  deadline: string;
  passwordEnabled: boolean;
  passwordHash: string;
  allowResubmission: boolean;
  responseCount: number;
  status: 'open' | 'closed';
}
