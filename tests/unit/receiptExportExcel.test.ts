import { readSheet } from 'read-excel-file/node';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CellObject } from 'write-excel-file/browser';
import writeXlsxFile from 'write-excel-file/node';
import { buildReceiptBookExcelSheet, downloadReceiptBookExcel, RECEIPT_EXCEL_HEADERS } from '../../src/features/classBudgetReceipts/receiptExportExcel';
import { buildReceiptSettlementRows, RECEIPT_EVIDENCE_TYPE } from '../../src/features/classBudgetReceipts/receiptSettlement';
import type { ReceiptBook } from '../../src/features/classBudgetReceipts/types';
import { downloadBlob } from '../../src/utils/qrImage';

vi.mock('../../src/utils/qrImage', () => ({ downloadBlob: vi.fn() }));
const browserExcel = vi.hoisted(() => ({ toBlob: vi.fn(), write: vi.fn() }));
vi.mock('write-excel-file/browser', () => ({
  default: browserExcel.write.mockImplementation(() => ({ toBlob: browserExcel.toBlob })),
}));

const book: ReceiptBook = {
  id: 'book', ownerId: 'teacher', title: '학급 운영비', schoolYear: 2026,
  classLabel: '2학년 1반', totalBudget: 50000, status: 'active', files: [], retentionMonths: 3, createdAt: '', updatedAt: '',
  entries: [
    { id: '1', spentAt: '2026-09-02', merchant: '=1+2', purpose: '@물품 구매\n활동 준비', amount: 12000, evidenceFileIds: ['receipt-1'], createdAt: '', updatedAt: '', deletedAt: null, purgeAfter: null },
    { id: '2', spentAt: '2026-09-03', merchant: '마트', purpose: '학급 활동', amount: 40000, evidenceFileIds: [], createdAt: '', updatedAt: '', deletedAt: null, purgeAfter: null },
    { id: '3', spentAt: '2026-09-04', merchant: '삭제됨', purpose: '제외', amount: 8000, evidenceFileIds: [], createdAt: '', updatedAt: '', deletedAt: '2026-09-05', purgeAfter: null },
  ],
};

afterEach(() => vi.clearAllMocks());

describe('Excel 정산내역', () => {
  it('화면과 같은 5열·행 순서로 만들고 증빙구분은 모두 전산자료로 고정한다', async () => {
    const sheet = buildReceiptBookExcelSheet(book);
    const buffer = await writeXlsxFile(sheet, { sheet: '정산내역' }).toBuffer();
    const rows = await readSheet(buffer, '정산내역');
    expect(rows[0]).toEqual(RECEIPT_EXCEL_HEADERS);
    expect(rows).toHaveLength(3);
    expect(rows[1][0]).toBeInstanceOf(Date);
    expect((rows[1][0] as Date).toISOString().slice(0, 10)).toBe('2026-09-02');
    expect(rows[1].slice(1)).toEqual(['=1+2', 12000, '전산자료', '@물품 구매\n활동 준비']);
    expect(rows[2].slice(1)).toEqual(['마트', 40000, '전산자료', '학급 활동']);
    expect(buildReceiptSettlementRows(book).map(row => [row.spentAt, row.merchant, row.amount, row.evidenceType, row.purpose])).toEqual([
      ['2026-09-02', '=1+2', 12000, RECEIPT_EVIDENCE_TYPE, '@물품 구매\n활동 준비'],
      ['2026-09-03', '마트', 40000, RECEIPT_EVIDENCE_TYPE, '학급 활동'],
    ]);
  });

  it('사용자 문자는 수식으로 실행되지 않고 날짜·금액은 실제 타입으로 저장한다', () => {
    const sheet = buildReceiptBookExcelSheet(book);
    expect(sheet[1][0]).toMatchObject({ type: Date, format: 'yyyy-mm-dd' });
    expect(sheet[1][1]).toMatchObject({ type: String, format: '@', wrap: true });
    expect(sheet[1][2]).toMatchObject({ type: Number, value: 12000 });
    expect(sheet[1][4]).toMatchObject({ type: String, format: '@', wrap: true });
    expect(sheet.flat().some(cell => cell && typeof cell === 'object' && 'type' in cell && cell.type === 'Formula')).toBe(false);
  });

  it('긴 사용처·사용내역과 개행이 잘리지 않도록 행 높이를 늘린다', () => {
    const longBook = { ...book, entries: [{ ...book.entries[0], merchant: '다'.repeat(120), purpose: '라'.repeat(300) }] };
    const sheet = buildReceiptBookExcelSheet(longBook);
    const height = (sheet[1][0] as CellObject).height!;
    expect(height).toBeGreaterThan(100);
    expect(height).toBeLessThanOrEqual(409);
    expect(sheet[1].every(cell => (cell as CellObject).height === height)).toBe(true);
    expect((sheet[1][1] as CellObject).value).toBe(longBook.entries[0].merchant);
    expect((sheet[1][4] as CellObject).value).toBe(longBook.entries[0].purpose);
  });

  it('빈 장부는 양식 헤더만 가진다', async () => {
    const sheet = buildReceiptBookExcelSheet({ ...book, entries: [] });
    expect(sheet).toHaveLength(1);
    const rows = await readSheet(await writeXlsxFile(sheet).toBuffer());
    expect(rows).toEqual([RECEIPT_EXCEL_HEADERS]);
  });

  it('이미 취소했거나 생성 도중 취소한 요청은 파일을 내려받지 않는다', async () => {
    const before = new AbortController(); before.abort();
    await expect(downloadReceiptBookExcel(book, { signal: before.signal })).rejects.toMatchObject({ name: 'AbortError' });
    let finish: (blob: Blob) => void = () => {};
    browserExcel.toBlob.mockImplementationOnce(() => new Promise<Blob>(resolve => { finish = resolve; }));
    const during = new AbortController();
    const pending = downloadReceiptBookExcel(book, { signal: during.signal });
    await vi.waitFor(() => expect(browserExcel.toBlob).toHaveBeenCalledOnce());
    during.abort(); finish(new Blob(['workbook']));
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it('정산내역 시트와 파일명으로 내려받는다', async () => {
    const blob = new Blob(['workbook']); browserExcel.toBlob.mockResolvedValueOnce(blob);
    await downloadReceiptBookExcel(book);
    expect(downloadBlob).toHaveBeenCalledWith(blob, '학급 운영비_정산내역.xlsx');
    expect(browserExcel.write).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({
      sheet: '정산내역', stickyRowsCount: 1, showGridLines: false, columns: expect.arrayContaining([{ width: 52 }]),
    }), { fontFamily: '맑은 고딕', fontSize: 11 });
  });
});
