import type { ReceiptBook, ReceiptEntry } from './types';

export const localDateValue = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export const formatWon = (value: number) => `${Math.round(value).toLocaleString('ko-KR')}원`;

export const activeReceiptEntries = (book: ReceiptBook) => book.entries
  .filter((entry) => !entry.deletedAt)
  .sort((a, b) => b.spentAt.localeCompare(a.spentAt) || b.createdAt.localeCompare(a.createdAt));

export const trashedReceiptEntries = (book: ReceiptBook) => book.entries
  .filter((entry) => Boolean(entry.deletedAt))
  .sort((a, b) => (b.deletedAt ?? '').localeCompare(a.deletedAt ?? ''));

export const calculateReceiptBookSummary = (book: ReceiptBook) => {
  const entries = activeReceiptEntries(book);
  const usedAmount = entries.reduce((sum, entry) => sum + entry.amount, 0);
  return {
    usedAmount,
    remainingAmount: book.totalBudget - usedAmount,
    entryCount: entries.length,
    trashedCount: trashedReceiptEntries(book).length,
  };
};

export const receiptEntryRestoreLabel = (entry: ReceiptEntry) => {
  if (!entry.purgeAfter) return '';
  return new Date(entry.purgeAfter).toLocaleDateString('ko-KR');
};

export const isReceiptEntryRestorable = (entry: ReceiptEntry) => Boolean(entry.purgeAfter)
  && new Date(entry.purgeAfter!).getTime() > Date.now();
