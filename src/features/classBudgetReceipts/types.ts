export type ReceiptBookStatus = 'active' | 'closed';
export type ReceiptFileStatus = 'uploaded' | 'failed';
export type ReceiptAnalysisStatus = 'pending' | 'analyzing' | 'ready' | 'failed';
export type ReceiptAnalysisSource = 'pdf-text' | 'browser-ocr';

export interface ReceiptAnalysisDraft {
  spentAt: string;
  merchant: string;
  amount: number | null;
  confidence: number;
  source: ReceiptAnalysisSource;
  warnings: string[];
}

export interface ReceiptFile {
  id: string;
  bookId: string;
  status: ReceiptFileStatus;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  analysisStatus: ReceiptAnalysisStatus;
  analysis: ReceiptAnalysisDraft | null;
  analysisErrorCode: string | null;
  analyzedAt: string | null;
  previewUrl: string;
  linkedEntryIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ReceiptEntry {
  id: string;
  spentAt: string;
  merchant: string;
  purpose: string;
  amount: number;
  evidenceFileIds: string[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  purgeAfter: string | null;
}

export interface ReceiptBook {
  id: string;
  ownerId: string;
  title: string;
  schoolYear: number;
  classLabel: string;
  totalBudget: number;
  status: ReceiptBookStatus;
  entries: ReceiptEntry[];
  files: ReceiptFile[];
  retentionMonths: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReceiptBookInput {
  title: string;
  schoolYear: number;
  classLabel: string;
  totalBudget: number;
}

export interface ReceiptEntryInput {
  spentAt: string;
  merchant: string;
  purpose: string;
  amount: number;
  evidenceFileIds: string[];
}
