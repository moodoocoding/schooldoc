import type { ConsentChoice } from '../../../supabase/functions/_shared/consentQuestions';
export interface ConsentDocumentAnalysis {
  fileName: string;
  fileSize: number;
  title: string;
  pageCount: number;
  pageCountLabel: string;
  textPreview: string;
  warnings: string[];
  pageSizes: ConsentPageSize[];
}

export interface ConsentPageSize { width: number; height: number }

export type ConsentFieldKind = 'text' | 'checkbox' | 'date' | 'signature';

export interface ConsentFieldDraft {
  id: string;
  kind: ConsentFieldKind;
  label: string;
  required: boolean;
  /** 새 필드의 임시 위치를 원본에서 확인하기 전까지 발행을 막는다. 기존 필드는 배치된 것으로 취급한다. */
  placementPending?: boolean;
  choice?: ConsentChoice;
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
  retentionMonths: number;
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
  /** 업무 종료 시각. 진행 중이면 비어 있다. */
  closedAt?: string;
  pageCount?: number;
  pageSizes?: ConsentPageSize[];
  /** 보관 개월. 지나면 정리 화면에 모이지만 자동으로 지워지지는 않는다. */
  retentionMonths?: number;
  publicationState?: 'preparing' | 'ready' | 'purging';
  documentRevision?: number;
  currentResponseCount?: number;
  updatedAt?: string;
  sourcePath?: string;
  sourcePdfDataUrl?: string;
}

export interface ConsentPublicMetadata {
  title: string;
  description: string;
  passwordRequired: boolean;
  status: 'open' | 'closed';
  deadline: string;
  /** 개인 링크로 들어온 경우에만 채워지는 가림 이름. 예: 김○○ */
  recipientHint?: string;
  recipientSubmitted?: boolean;
}

export interface ConsentRecipientRecord {
  id: string;
  token: string;
  name: string;
  studentKey: string;
  responseId: string | null;
  submittedAt: string | null;
}

export interface ConsentResponseRecord {
  id: string;
  submittedAt: string;
  /** 필드 ID별 응답 값. 서명 필드는 이미지 URL 또는 data URL을 담는다. */
  values: Record<string, string>;
  recipientId?: string | null;
  detailsLoaded?: boolean;
  /** 아직 조회하지 않은 명단 대상은 상세 요청 때 이름을 가져온다. */
  recipientName?: string;
}

export interface ConsentPublicDocument extends ConsentPublicMetadata {
  fields: ConsentFieldDraft[];
  sourceUrl: string;
  allowResubmission: boolean;
  pageCount: number;
  pageSizes: ConsentPageSize[];
  documentRevision?: number;
  previousResponseId?: string | null;
  previousValues?: Record<string, string>;
  recipientName?: string;
  recipientSubmitted?: boolean;
}
