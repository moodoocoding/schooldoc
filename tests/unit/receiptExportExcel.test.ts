import { readSheet } from 'read-excel-file/node';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CellObject } from 'write-excel-file/browser';
import writeXlsxFile from 'write-excel-file/node';
import { buildReceiptBookExcelSheet, downloadReceiptBookExcel, RECEIPT_EXCEL_HEADERS } from '../../src/features/classBudgetReceipts/receiptExportExcel';
import type { ReceiptBook } from '../../src/features/classBudgetReceipts/types';
import { downloadBlob } from '../../src/utils/qrImage';

vi.mock('../../src/utils/qrImage', () => ({ downloadBlob: vi.fn() }));
const browserExcel = vi.hoisted(() => ({ toBlob: vi.fn(), write: vi.fn() }));
vi.mock('write-excel-file/browser', () => ({
  default: browserExcel.write.mockImplementation(() => ({ toBlob: browserExcel.toBlob })),
}));

const book: ReceiptBook = {
  id: 'book', ownerId: 'teacher', title: '=HYPERLINK("https://example.invalid", "장부")', schoolYear: 2026,
  classLabel: '+2학년 1반', totalBudget: 50000, status: 'active', files: [], retentionMonths: 3, createdAt: '', updatedAt: '',
  entries: [
    { id: '1', spentAt: '2026-09-02', merchant: '=1+2', purpose: '@물품 구매\n활동 준비', amount: 12000, evidenceFileIds: ['receipt-1', 'receipt-2'], createdAt: '', updatedAt: '', deletedAt: null, purgeAfter: null },
    { id: '2', spentAt: '2026-09-03', merchant: '마트', purpose: '학급 활동', amount: 40000, evidenceFileIds: [], createdAt: '', updatedAt: '', deletedAt: null, purgeAfter: null },
  ],
};

afterEach(() => vi.clearAllMocks());

describe('Excel 지출대장', () => {
  it('숫자 합계·잔액·증빙 번호와 입력 문자열을 실제 XLSX로 왕복해 유지한다', async () => {
    const sheet = buildReceiptBookExcelSheet(book);
    const buffer = await writeXlsxFile(sheet, { sheet: '지출대장' }).toBuffer();
    const rows = await readSheet(buffer, '지출대장');
    expect(rows[0][0]).toBe(`${book.title} · 지출대장`);
    expect(rows[1]).toEqual(['학년도', 2026, '학급', '+2학년 1반', null, null]);
    expect(rows[3]).toEqual(['전체 예산', 50000, '사용 금액', 52000, '남은 금액', -2000]);
    expect(rows[6]).toEqual(RECEIPT_EXCEL_HEADERS);
    expect(rows[7]).toEqual([1, '2026-09-02', '=1+2', '@물품 구매\n활동 준비', 12000, '1, 2']);
    expect(rows[8]).toEqual([2, '2026-09-03', '마트', '학급 활동', 40000, '없음']);
    expect(rows[9]).toEqual(['합계', null, null, null, 52000, null]);
  });

  it('사용자 텍스트를 문자열 타입으로 지정하고 긴 내용은 줄바꿈 표시한다', () => {
    const sheet = buildReceiptBookExcelSheet(book);
    for (const [row, column] of [[0, 0], [1, 3], [7, 1], [7, 2], [7, 3]]) {
      expect(sheet[row][column]).toMatchObject({ type: String, format: '@', wrap: true });
    }
    expect((sheet[7][4] as CellObject).type).toBe(Number);
    expect(sheet.flat().some((cell) => cell && typeof cell === 'object' && 'type' in cell && cell.type === 'Formula')).toBe(false);
  });

  it('입력 상한의 한글 제목·사용처·목적과 긴 기존 제목이 보이도록 행 높이를 늘린다', () => {
    const longBook = {
      ...book, title: '가'.repeat(80), classLabel: '나'.repeat(30),
      entries: [{ ...book.entries[0], merchant: '다'.repeat(120), purpose: '라'.repeat(300) }],
    };
    const sheet = buildReceiptBookExcelSheet(longBook);
    const titleHeight = (sheet[0][0] as CellObject).height!;
    const bodyHeight = (sheet[7][0] as CellObject).height!;
    expect(titleHeight).toBeGreaterThanOrEqual(3 * 18 * 1.4);
    expect(bodyHeight).toBeGreaterThanOrEqual(16 * 11 * 1.4);
    expect(bodyHeight).toBeLessThanOrEqual(409);
    expect(sheet[7].every((cell) => (cell as CellObject).height === bodyHeight)).toBe(true);
    expect((sheet[1][3] as CellObject).height).toBeGreaterThanOrEqual(24);
    const legacyTitleSheet = buildReceiptBookExcelSheet({ ...longBook, title: '가'.repeat(120) });
    expect((legacyTitleSheet[0][0] as CellObject).height).toBeGreaterThan(titleHeight);
    expect((sheet[7][2] as CellObject).value).toBe(longBook.entries[0].merchant);
    expect((sheet[7][3] as CellObject).value).toBe(longBook.entries[0].purpose);
  });

  it('명시 개행과 여러 증빙 번호가 요구하는 높이를 각각 반영한다', () => {
    const multiline = buildReceiptBookExcelSheet({
      ...book, title: '첫 줄\n둘째 줄\r\n셋째 줄', classLabel: '학급\n활동 모둠\n특별반',
      entries: [{ ...book.entries[0], merchant: '문구점', purpose: '준비\n활동\n마무리\n보관', evidenceFileIds: [] }],
    });
    expect((multiline[0][0] as CellObject).height).toBeGreaterThanOrEqual(3 * 18 * 1.4);
    expect((multiline[1][3] as CellObject).height).toBeGreaterThanOrEqual(3 * 11 * 1.4);
    expect((multiline[7][0] as CellObject).height).toBeGreaterThanOrEqual(4 * 11 * 1.4);
    const manyEvidence = buildReceiptBookExcelSheet({
      ...book,
      entries: [{ ...book.entries[0], merchant: '문구점', purpose: '준비물', evidenceFileIds: Array.from({ length: 50 }, (_, index) => `file-${index}`) }],
    });
    expect((manyEvidence[7][0] as CellObject).height).toBeGreaterThan(200);
    expect((manyEvidence[7][0] as CellObject).height).toBeLessThanOrEqual(409);
    expect((manyEvidence[7][5] as CellObject).value).toBe(Array.from({ length: 50 }, (_, index) => index + 1).join(', '));
  });

  it('빈 장부도 예산과 0원 합계가 있는 파일로 만든다', async () => {
    const sheet = buildReceiptBookExcelSheet({ ...book, entries: [] });
    const buffer = await writeXlsxFile(sheet).toBuffer();
    const rows = await readSheet(buffer);
    expect(rows[3]).toEqual(['전체 예산', 50000, '사용 금액', 0, '남은 금액', 50000]);
    expect(rows[7][0]).toBe('등록한 지출이 없습니다.');
    expect(rows[8][4]).toBe(0);
  });

  it('이미 취소한 요청은 파일을 내려받지 않는다', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(downloadReceiptBookExcel(book, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it('파일 생성 도중 취소하면 생성이 끝나도 다운로드를 시작하지 않는다', async () => {
    const controller = new AbortController();
    let finish: (blob: Blob) => void = () => {};
    browserExcel.toBlob.mockImplementationOnce(() => new Promise<Blob>((resolve) => { finish = resolve; }));
    const pending = downloadReceiptBookExcel(book, { signal: controller.signal });
    await vi.waitFor(() => expect(browserExcel.toBlob).toHaveBeenCalledOnce());
    controller.abort();
    finish(new Blob(['workbook']));
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it('생성한 파일을 한글 이름과 지출대장 서식으로 내려받는다', async () => {
    const blob = new Blob(['workbook']);
    browserExcel.toBlob.mockResolvedValueOnce(blob);
    await downloadReceiptBookExcel({ ...book, title: '학급 운영비' });
    expect(downloadBlob).toHaveBeenCalledWith(blob, '학급 운영비_지출대장.xlsx');
    expect(browserExcel.write).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ sheet: '지출대장', stickyRowsCount: 7, showGridLines: false, columns: expect.arrayContaining([{ width: 46 }]) }),
      { fontFamily: '맑은 고딕', fontSize: 11 },
    );
  });
});
