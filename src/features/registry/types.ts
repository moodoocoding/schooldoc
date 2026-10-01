export type RegistryMode = 'fixed' | 'custom';
export type RegistryStatus = 'open' | 'closed';
export type RegistryLayout = 10 | 15 | 20 | 30;
export type SignatureSource = 'draw' | 'photo';

export interface RegistryColumn {
  id: string;
  label: string;
}

export interface RegistrySignature {
  dataUrl: string;
  source: SignatureSource;
  signedAt: string;
}

export interface RegistryParticipant {
  id: string;
  rowNumber: number;
  name: string;
  values: Record<string, string>;
  signature?: RegistrySignature;
  signaturePath?: string;
  imageError?: boolean;
  requiresIdentity?: boolean;
  requiresCode?: boolean;
  verificationCode?: string;
}

export interface RegistrySummary {
  id: string;
  title: string;
  leftHeader: string;
  rightHeader: string;
  mode: RegistryMode;
  status: RegistryStatus;
  participantCount: number;
  signedCount: number;
  updatedAt: string;
}

export interface Registry {
  id: string;
  publicToken: string;
  title: string;
  leftHeader: string;
  rightHeader: string;
  mode: RegistryMode;
  status: RegistryStatus;
  layout: RegistryLayout;
  allowWalkIn: boolean;
  publicPassword?: string;
  isPasswordProtected?: boolean;
  columns: RegistryColumn[];
  participants: RegistryParticipant[];
  createdAt: string;
  updatedAt: string;
  retentionMonths?: number;
  closedAt?: string;
  purgeStartedAt?: string;
}

export interface RegistryDraft {
  title: string;
  leftHeader: string;
  rightHeader: string;
  mode: RegistryMode;
  layout: RegistryLayout;
  allowWalkIn: boolean;
  publicPassword?: string;
  columns: RegistryColumn[];
  participants: Array<Pick<RegistryParticipant, 'name' | 'values'>>;
  retentionMonths?: number;
}

export interface SignatureVerification {
  requestId: string;
  verifyName: string;
  verificationValues: Record<string, string>;
  code: string;
}

export interface SignatureSubmission {
  participantId: string;
  dataUrl: string;
  source: SignatureSource;
  values?: Record<string, string>;
}

export interface RegistryPurgeCounts { recordCount: number; signatureCount: number; fileCount: number; }
