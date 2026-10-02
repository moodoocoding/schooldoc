export type PdfRegistryLayout = 10 | 15 | 20 | 30;

export const getPdfPageSettings = (layout: PdfRegistryLayout) => {
  if (layout === 20) return { tableColumns: 2, rowsPerColumn: 10 } as const;
  if (layout === 30) return { tableColumns: 2, rowsPerColumn: 15 } as const;
  return { tableColumns: 1, rowsPerColumn: layout } as const;
};

export const paginatePdfRows = <T>(rows: T[], pageSize: number) => {
  if (rows.length === 0) return [[]] as T[][];
  const pages: T[][] = [];
  for (let index = 0; index < rows.length; index += pageSize) {
    pages.push(rows.slice(index, index + pageSize));
  }
  return pages;
};

export const chunkPdfRows = <T>(rows: T[], chunkSize: number) => {
  if (!Number.isInteger(chunkSize) || chunkSize < 1) {
    throw new RangeError('PDF 배치 크기는 1 이상의 정수여야 합니다.');
  }
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += chunkSize) {
    chunks.push(rows.slice(index, index + chunkSize));
  }
  return chunks;
};

export { registryColumnWidths as getPdfColumnWidths } from '../_shared/registryPrintLayout.ts';

export const fitPdfFontSize = (
  textWidthAtSizeOne: number,
  maxWidth: number,
  preferredSize: number,
  minimumSize: number,
) => Math.max(minimumSize, Math.min(preferredSize, maxWidth / Math.max(textWidthAtSizeOne, 0.01)));
