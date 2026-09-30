import { describe, expect, it } from 'vitest';
import { buildReceiptExportData, receiptExportFileName } from '../../src/features/classBudgetReceipts/receiptExportData';
import type { ReceiptBook, ReceiptEntry, ReceiptFile } from '../../src/features/classBudgetReceipts/types';

const entry = (id: string, overrides: Partial<ReceiptEntry> = {}): ReceiptEntry => ({
  id, spentAt: '2026-09-01', merchant: '문구점', purpose: '학급 활동 재료', amount: 12000,
  evidenceFileIds: [], createdAt: '2026-09-01T09:00:00Z', updatedAt: '', deletedAt: null, purgeAfter: null,
  ...overrides,
});

const file = (id: string, overrides: Partial<ReceiptFile> = {}): ReceiptFile => ({
  id, bookId: 'book', status: 'uploaded', originalName: `${id}.png`, mimeType: 'image/png', sizeBytes: 100,
  sha256: '', analysisStatus: 'ready', analysis: null, analysisCandidates: [], analysisErrorCode: null,
  analyzedAt: null, previewUrl: '', linkedEntryIds: [], createdAt: '', updatedAt: '', ...overrides,
});

const book = (overrides: Partial<ReceiptBook> = {}): ReceiptBook => ({
  id: 'book', ownerId: 'teacher', title: '우리 반 운영비', schoolYear: 2026, classLabel: '5학년 2반',
  totalBudget: 100000, status: 'active', entries: [], files: [], retentionMonths: 3, createdAt: '', updatedAt: '',
  ...overrides,
});

describe('영수증 출력 데이터', () => {
  it('화면과 같은 날짜·생성 순서로 번호를 붙이고 삭제한 지출은 합계에서 제외한다', () => {
    const source = book({ entries: [
      entry('newer', { spentAt: '2026-09-03', amount: 14000 }),
      entry('same-day-newer', { createdAt: '2026-09-01T10:00:00Z', merchant: '마트', amount: 3000 }),
      entry('deleted', { amount: 90000, deletedAt: '2026-09-04' }),
      entry('older'),
    ] });
    const originalIds = source.entries.map((item) => item.id);
    const data = buildReceiptExportData(source);
    expect(data.rows.map((row) => [row.number, row.spentAt, row.merchant, row.amount])).toEqual([
      [1, '2026-09-01', '문구점', 12000],
      [2, '2026-09-01', '마트', 3000],
      [3, '2026-09-03', '문구점', 14000],
    ]);
    expect(data).toMatchObject({ title: '우리 반 운영비', schoolYear: 2026, classLabel: '5학년 2반', totalBudget: 100000, usedAmount: 29000, remainingAmount: 71000 });
    expect(source.entries.map((item) => item.id)).toEqual(originalIds);
  });

  it('증빙을 첫 참조 순서로 한 번만 넣고 여러 지출 번호를 연결한다', () => {
    const evidence1 = file('receipt-1');
    const evidence2 = file('receipt-2');
    const source = book({ entries: [
      entry('first', { evidenceFileIds: ['receipt-2', 'receipt-2', 'receipt-1'] }),
      entry('second', { spentAt: '2026-09-02', evidenceFileIds: ['receipt-1'] }),
    ], files: [evidence1, evidence2] });
    const data = buildReceiptExportData(source);
    expect(data.rows.map((row) => row.evidenceNumbers)).toEqual([[1, 2], [2]]);
    expect(data.evidence).toEqual([
      { number: 1, fileId: 'receipt-2', file: evidence2, entryNumbers: [1] },
      { number: 2, fileId: 'receipt-1', file: evidence1, entryNumbers: [1, 2] },
    ]);
    expect(evidence1.linkedEntryIds).toEqual([]);
  });

  it('미반영·삭제 지출의 파일은 빼고 사라진 증빙 정보는 누락으로 남긴다', () => {
    const data = buildReceiptExportData(book({
      entries: [
        entry('manual'),
        entry('missing', { spentAt: '2026-09-02', evidenceFileIds: ['missing'] }),
        entry('deleted', { deletedAt: '2026-09-04', evidenceFileIds: ['deleted-file'] }),
      ],
      files: [file('draft', { analysis: { spentAt: '2026-09-01', merchant: '미확인', amount: 50000, confidence: 1, source: 'openai', warnings: [] } }), file('deleted-file')],
    }));
    expect(data.rows[0].evidenceNumbers).toEqual([]);
    expect(data.rows[1].evidenceNumbers).toEqual([1]);
    expect(data.evidence).toEqual([{ number: 1, fileId: 'missing', file: null, entryNumbers: [2] }]);
    expect(data.usedAmount).toBe(24000);
  });

  it('빈 장부와 예산 초과 잔액을 그대로 계산한다', () => {
    expect(buildReceiptExportData(book())).toMatchObject({ rows: [], evidence: [], usedAmount: 0, remainingAmount: 100000 });
    expect(buildReceiptExportData(book({ totalBudget: 10000, entries: [entry('over')] })).remainingAmount).toBe(-2000);
  });
});

describe('영수증 출력 파일명', () => {
  it('한글 제목을 유지하고 경로 문자와 제어 문자·끝 마침표를 정리한다', () => {
    expect(receiptExportFileName('우리 반 운영비', '지출대장', 'xlsx')).toBe('우리 반 운영비_지출대장.xlsx');
    expect(receiptExportFileName('  1/2학기:장부?\n.  ', '영수증', '.PDF')).toBe('1_2학기_장부___영수증.pdf');
    expect(receiptExportFileName(' ... ', '지출대장', 'xlsx')).toBe('학급 운영비_지출대장.xlsx');
  });

  it('긴 제목을 제한하면서 유니코드 문자를 끊지 않는다', () => {
    expect(receiptExportFileName('가'.repeat(80), '지출대장', 'xlsx')).toBe(`${'가'.repeat(60)}_지출대장.xlsx`);
    expect(receiptExportFileName('🎒'.repeat(61), '지출대장', 'xlsx')).toBe(`${'🎒'.repeat(60)}_지출대장.xlsx`);
  });
});
