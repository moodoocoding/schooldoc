export type ResultEventStatus = 'open' | 'closed';
export type ResultRecipientStatus = 'unviewed' | 'viewed' | 'confirmed' | 'disputed' | 'reconfirm' | 'replied';

export interface ResultColumn {
  id: string;
  label: string;
  maxScore: number;
  description: string;
  /** 총점은 개별 점수와 합산하지 않는다. 이전 안내에는 이 값이 없을 수 있다. */
  kind?: 'score' | 'total';
}

export interface ResultDispute {
  message: string;
  submittedAt: string;
  teacherReply?: string;
  repliedAt?: string;
}

export interface ResultRevision {
  changedAt: string;
  reason: string;
  before: { values: Record<string, number>; feedback: string };
  after: { values: Record<string, number>; feedback: string };
}

export interface ResultEventRevision {
  changedAt: string;
  before: { title: string; description: string; allowConfirmation: boolean; allowDispute: boolean; columns: ResultColumn[] };
  after: { title: string; description: string; allowConfirmation: boolean; allowDispute: boolean; columns: ResultColumn[] };
}

export interface ResultRecipient {
  id: string;
  studentKey: string;
  name: string;
  verificationCode: string;
  personalToken: string;
  values: Record<string, number>;
  feedback: string;
  status: ResultRecipientStatus;
  viewedAt?: string;
  confirmedAt?: string;
  dispute?: ResultDispute;
  updatedAt?: string;
  revisions?: ResultRevision[];
}

export interface StudentResultEvent {
  id: string;
  ownerId: string;
  publicToken: string;
  title: string;
  description: string;
  status: ResultEventStatus;
  allowConfirmation: boolean;
  allowDispute: boolean;
  columns: ResultColumn[];
  recipients: ResultRecipient[];
  createdAt: string;
  updatedAt: string;
  revisions?: ResultEventRevision[];
}

export type StudentResultEventSettings = Pick<StudentResultEvent, 'title' | 'description' | 'allowConfirmation' | 'allowDispute' | 'columns'>;

export interface ResultRecipientDraft {
  studentKey: string;
  name: string;
  verificationCode: string;
  values: Record<string, number | ''>;
  feedback: string;
}

export interface StudentResultDraft {
  title: string;
  description: string;
  allowConfirmation: boolean;
  allowDispute: boolean;
  columns: ResultColumn[];
  recipients: ResultRecipientDraft[];
}

export interface AuthenticatedStudentResult {
  event: Pick<StudentResultEvent, 'id' | 'publicToken' | 'title' | 'description' | 'status' | 'allowConfirmation' | 'allowDispute' | 'columns'>;
  recipient: ResultRecipient;
}

export interface PublicStudentResult extends Omit<AuthenticatedStudentResult, 'recipient'> {
  recipient: Omit<ResultRecipient, 'verificationCode' | 'personalToken' | 'revisions'>;
}

export interface PublicStudentResultSession {
  sessionToken: string;
  result: PublicStudentResult;
}
