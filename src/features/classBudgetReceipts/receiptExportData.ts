import { activeReceiptEntries, calculateReceiptBookSummary } from './receiptBookUtils';
import type { ReceiptBook, ReceiptFile } from './types';

export interface ReceiptExportRow {
  number: number;
  spentAt: string;
  merchant: string;
  purpose: string;
  amount: number;
  evidenceNumbers: number[];
}

export interface ReceiptExportEvidence {
  number: number;
  fileId: string;
  file: ReceiptFile | null;
  entryNumbers: number[];
}

export interface ReceiptExportData {
  title: string;
  schoolYear: number;
  classLabel: string;
  totalBudget: number;
  usedAmount: number;
  remainingAmount: number;
  rows: ReceiptExportRow[];
  evidence: ReceiptExportEvidence[];
}

/** 화면의 지출 번호와 Excel/PDF의 지출·증빙 번호를 일치시킨다. */
export const buildReceiptExportData = (book: ReceiptBook): ReceiptExportData => {
  const entries = activeReceiptEntries(book).slice().reverse();
  const filesById = new Map(book.files.map((file) => [file.id, file]));
  const evidenceById = new Map<string, ReceiptExportEvidence>();
  const rows = entries.map((entry, index): ReceiptExportRow => {
    const number = index + 1;
    const evidenceNumbers = [...new Set(entry.evidenceFileIds)].map((fileId) => {
      let evidence = evidenceById.get(fileId);
      if (!evidence) {
        evidence = {
          number: evidenceById.size + 1,
          fileId,
          file: filesById.get(fileId) ?? null,
          entryNumbers: [],
        };
        evidenceById.set(fileId, evidence);
      }
      evidence.entryNumbers.push(number);
      return evidence.number;
    });
    return {
      number,
      spentAt: entry.spentAt,
      merchant: entry.merchant,
      purpose: entry.purpose,
      amount: entry.amount,
      evidenceNumbers,
    };
  });
  const { usedAmount, remainingAmount } = calculateReceiptBookSummary(book);
  return {
    title: book.title,
    schoolYear: book.schoolYear,
    classLabel: book.classLabel,
    totalBudget: book.totalBudget,
    usedAmount,
    remainingAmount,
    rows,
    evidence: [...evidenceById.values()],
  };
};

const safeFilePart = (value: string) => Array.from(value)
  .map((character) => character.charCodeAt(0) < 32 || /[\\/:*?"<>|]/.test(character) ? '_' : character)
  .join('')
  .trim()
  .replace(/[. ]+$/g, '');

export const receiptExportFileName = (title: string, suffix: string, extension: string) => {
  const base = Array.from(safeFilePart(title)).slice(0, 60).join('') || '학급 운영비';
  const label = safeFilePart(suffix);
  const fileExtension = extension.replace(/[^a-z0-9]/gi, '').toLowerCase();
  return `${base}${label ? `_${label}` : ''}${fileExtension ? `.${fileExtension}` : ''}`;
};
