import type { CellObject, SheetData } from 'write-excel-file/browser';
import { downloadBlob } from '../../utils/qrImage';
import { receiptExportFileName } from './receiptExportData';
import { buildReceiptSettlementRows, RECEIPT_SETTLEMENT_HEADERS } from './receiptSettlement';
import type { ReceiptBook } from './types';

export const RECEIPT_EXCEL_HEADERS = RECEIPT_SETTLEMENT_HEADERS;
export const RECEIPT_EXCEL_COLUMNS = [17, 30, 18, 18, 52].map((width) => ({ width }));

const textCell = (value: string, style: Partial<CellObject> = {}): CellObject => ({
  type: String, value, format: '@', wrap: true, alignVertical: 'center', ...style,
});
const tableStyle: Partial<CellObject> = { borderColor: '#D5D9DE', borderStyle: 'thin' };

/** 한글·개행으로 내용이 잘리지 않도록 행 높이를 명시한다. */
const wrappedTextHeight = (value: string, width: number) => {
  const lineWidth = Math.max(1, (width - 2) * 0.9);
  const lines = value.split(/\r\n?|\n/).reduce((sum, line) => {
    const textWidth = Array.from(line).reduce((size, character) => size + (character.charCodeAt(0) > 255 ? 2 : 1), 0);
    return sum + Math.max(1, Math.ceil(textWidth / lineWidth));
  }, 0);
  return Math.min(409, Math.max(28, Math.ceil(lines * 15.4 + 10)));
};

/** 정산내역 양식과 동일한 다섯 열만 내보낸다. 사용자 입력은 수식이 아닌 텍스트다. */
export const buildReceiptBookExcelSheet = (book: ReceiptBook): SheetData => [
  RECEIPT_EXCEL_HEADERS.map((value) => textCell(value, {
    ...tableStyle, backgroundColor: '#595959', textColor: '#FFFFFF', fontWeight: 'bold', height: 34,
  })),
  ...buildReceiptSettlementRows(book).map((row): CellObject[] => {
    const height = Math.max(
      wrappedTextHeight(row.merchant, RECEIPT_EXCEL_COLUMNS[1].width),
      wrappedTextHeight(row.purpose, RECEIPT_EXCEL_COLUMNS[4].width),
    );
    const style = { ...tableStyle, height };
    return [
      { type: Date, value: new Date(`${row.spentAt}T00:00:00Z`), format: 'yyyy-mm-dd', alignVertical: 'center', ...style },
      textCell(row.merchant, style),
      { type: Number, value: row.amount, format: '#,##0', align: 'right', alignVertical: 'center', ...style },
      textCell(row.evidenceType, style),
      textCell(row.purpose, style),
    ];
  }),
];

const ensureNotAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new DOMException('내려받기를 취소했습니다.', 'AbortError');
};

export const downloadReceiptBookExcel = async (book: ReceiptBook, options: { signal?: AbortSignal } = {}): Promise<void> => {
  ensureNotAborted(options.signal);
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  ensureNotAborted(options.signal);
  const blob = await writeXlsxFile(buildReceiptBookExcelSheet(book), {
    sheet: '정산내역', columns: RECEIPT_EXCEL_COLUMNS, stickyRowsCount: 1,
    showGridLines: false, orientation: 'landscape',
  }, { fontFamily: '맑은 고딕', fontSize: 11 }).toBlob();
  ensureNotAborted(options.signal);
  downloadBlob(blob, receiptExportFileName(book.title, '정산내역', 'xlsx'));
};
