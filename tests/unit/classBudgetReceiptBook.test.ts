import { describe, expect, test } from 'vitest';
import { calculateReceiptBookSummary, isReceiptEntryRestorable } from '../../src/features/classBudgetReceipts/receiptBookUtils';
import type { ReceiptBook } from '../../src/features/classBudgetReceipts/types';

const book = (entries: ReceiptBook['entries']): ReceiptBook => ({ id: 'b', ownerId: 'u', title: '장부', schoolYear: 2026, classLabel: '5학년 2반', totalBudget: 100000, status: 'active', entries, files: [], retentionMonths: 3, createdAt: '', updatedAt: '' });

describe('학급 운영비 합계', () => {
  test('휴지통 지출은 합계에서 제외한다', () => {
    const base = { purpose: '재료', evidenceFileIds: [], createdAt: '', updatedAt: '', purgeAfter: null };
    const summary = calculateReceiptBookSummary(book([
      { ...base, id: '1', spentAt: '2026-09-02', merchant: '문구점', amount: 32000, deletedAt: null },
      { ...base, id: '2', spentAt: '2026-09-01', merchant: '마트', amount: 5000, deletedAt: '2026-09-03', purgeAfter: '2026-09-10' },
    ]));
    expect(summary).toMatchObject({ usedAmount: 32000, remainingAmount: 68000, entryCount: 1, trashedCount: 1 });
  });

  test('복원 기간을 지난 지출은 복원할 수 없다', () => {
    expect(isReceiptEntryRestorable({ id: '1', spentAt: '', merchant: '', purpose: '', amount: 1, evidenceFileIds: [], createdAt: '', updatedAt: '', deletedAt: '', purgeAfter: '2020-01-01' })).toBe(false);
  });
});
