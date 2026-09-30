import type { CellObject, SheetData } from 'write-excel-file/browser';
import { downloadBlob } from '../../utils/qrImage';
import { buildReceiptExportData, receiptExportFileName } from './receiptExportData';
import type { ReceiptBook } from './types';

export const RECEIPT_EXCEL_HEADERS = ['번호', '날짜', '사용처', '사용 목적', '금액', '증빙 번호'];
export const RECEIPT_EXCEL_COLUMNS = [7, 14, 26, 46, 18, 16].map((width) => ({ width }));

const textCell = (value: string, style: Partial<CellObject> = {}): CellObject => ({
  type: String, value, format: '@', wrap: true, alignVertical: 'center', ...style,
});

const numberCell = (value: number, style: Partial<CellObject> = {}): CellObject => ({
  type: Number, value, format: '#,##0;[Red]-#,##0;0', align: 'right', alignVertical: 'center', ...style,
});

const tableStyle: Partial<CellObject> = { borderColor: '#DCE3EA', borderStyle: 'thin' };
const summaryStyle: Partial<CellObject> = { backgroundColor: '#EEF5FB', fontWeight: 'bold', height: 30 };

const columnWidth = (start: number, count = 1) => RECEIPT_EXCEL_COLUMNS
  .slice(start, start + count)
  .reduce((sum, column) => sum + column.width, 0);

/** 병합 셀의 자동 높이 조정에 의존하지 않고 한글 폭·개행·폰트 크기를 반영한다. */
const wrappedTextHeight = (value: string, width: number, fontSize = 11, minimum = 24) => {
  // Excel 열폭은 기본 글꼴의 숫자 폭 기준이다. 한글을 두 칸으로 계산하고 여백을 둔다.
  const lineWidth = Math.max(1, (width - 2) * 0.9 * 11 / fontSize);
  const lines = value.split(/\r\n?|\n/).reduce((sum, line) => {
    const textWidth = Array.from(line).reduce((size, character) => size + (character === '\t' ? 4 : character.charCodeAt(0) > 255 ? 2 : 1), 0);
    return sum + Math.max(1, Math.ceil(textWidth / lineWidth));
  }, 0);
  // Excel의 한 행 높이 상한은 409pt이며 현재 입력 제한의 한글 최장값은 이 안에 들어간다.
  return Math.min(409, Math.max(minimum, Math.ceil(lines * fontSize * 1.4 + 10)));
};

/** 사용자 입력은 반드시 문자열 셀로 저장해 수식처럼 생긴 내용도 그대로 표시한다. */
export const buildReceiptBookExcelSheet = (book: ReceiptBook): SheetData => {
  const data = buildReceiptExportData(book);
  const title = `${data.title} · 지출대장`;
  const rows: SheetData = [
    [textCell(title, { columnSpan: 6, fontWeight: 'bold', fontSize: 18, height: wrappedTextHeight(title, columnWidth(0, 6), 18, 38) }), null, null, null, null, null],
    [textCell('학년도'), numberCell(data.schoolYear, { format: '0', align: 'left' }), textCell('학급'), textCell(data.classLabel, { columnSpan: 3, height: wrappedTextHeight(data.classLabel, columnWidth(3, 3)) }), null, null],
    [],
    [textCell('전체 예산', summaryStyle), numberCell(data.totalBudget, summaryStyle), textCell('사용 금액', summaryStyle), numberCell(data.usedAmount, summaryStyle), textCell('남은 금액', summaryStyle), numberCell(data.remainingAmount, summaryStyle)],
    [textCell('금액 단위: 원 · 증빙 번호는 영수증 첨부 PDF와 같습니다.', { columnSpan: 6, textColor: '#526174', fontSize: 10, height: 24 }), null, null, null, null, null],
    [],
    RECEIPT_EXCEL_HEADERS.map((value) => textCell(value, { ...tableStyle, fontWeight: 'bold', backgroundColor: '#EAF1F7', align: 'center', height: 28 })),
    ...data.rows.map((row): CellObject[] => {
      const evidence = row.evidenceNumbers.length ? row.evidenceNumbers.join(', ') : '없음';
      const rowStyle = {
        ...tableStyle,
        height: Math.max(
          wrappedTextHeight(row.merchant, columnWidth(2)),
          wrappedTextHeight(row.purpose, columnWidth(3)),
          wrappedTextHeight(evidence, columnWidth(5)),
        ),
      };
      return [
        numberCell(row.number, { ...rowStyle, format: '0', align: 'center' }),
        textCell(row.spentAt, { ...rowStyle, align: 'center' }),
        textCell(row.merchant, rowStyle),
        textCell(row.purpose, rowStyle),
        numberCell(row.amount, rowStyle),
        textCell(evidence, { ...rowStyle, align: 'center' }),
      ];
    }),
  ];
  if (!data.rows.length) {
    rows.push([textCell('등록한 지출이 없습니다.', { ...tableStyle, columnSpan: 6, align: 'center', height: 32 }), null, null, null, null, null]);
  }
  rows.push([
    textCell('합계', { ...tableStyle, ...summaryStyle, columnSpan: 4 }), null, null, null,
    numberCell(data.usedAmount, { ...tableStyle, ...summaryStyle }), textCell('', { ...tableStyle, ...summaryStyle }),
  ]);
  return rows;
};

const ensureNotAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new DOMException('내려받기를 취소했습니다.', 'AbortError');
};

export const downloadReceiptBookExcel = async (book: ReceiptBook, options: { signal?: AbortSignal } = {}): Promise<void> => {
  ensureNotAborted(options.signal);
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  ensureNotAborted(options.signal);
  const blob = await writeXlsxFile(buildReceiptBookExcelSheet(book), {
    sheet: '지출대장',
    columns: RECEIPT_EXCEL_COLUMNS,
    stickyRowsCount: 7,
    showGridLines: false,
    orientation: 'landscape',
  }, { fontFamily: '맑은 고딕', fontSize: 11 }).toBlob();
  ensureNotAborted(options.signal);
  downloadBlob(blob, receiptExportFileName(book.title, '지출대장', 'xlsx'));
};
