export type ResultEventStatus = 'open' | 'closed';
export type ResultRecipientStatus = 'unviewed' | 'viewed' | 'confirmed' | 'disputed' | 'reconfirm';

export interface ResultColumn {
  id: string;
  label: string;
  maxScore: number;
  description: string;
}

export interface ResultDispute {
  message: string;
  submittedAt: string;
  teacherReply?: string;
  repliedAt?: string;
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
}

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
  recipient: Omit<ResultRecipient, 'verificationCode' | 'personalToken'>;
}

export interface PublicStudentResultSession {
  sessionToken: string;
  result: PublicStudentResult;
}
