export type PdfRegistryLayout = 10 | 15 | 20 | 30;

export interface PdfColumnWidths {
  number: number;
  name: number;
  fields: number[];
  signature: number;
}

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

export const getPdfColumnWidths = (
  tableWidth: number,
  compact: boolean,
  fieldCount: number,
): PdfColumnWidths => {
  const number = compact ? 25.5 : 39;
  const signature = compact ? 66 : 112.5;
  const preferredName = compact ? 52.5 : 87;

  if (fieldCount === 0) {
    return { number, name: tableWidth - number - signature, fields: [], signature };
  }

  const fieldWidth = (tableWidth - number - preferredName - signature) / fieldCount;
  return {
    number,
    name: preferredName,
    fields: Array.from({ length: fieldCount }, () => fieldWidth),
    signature,
  };
};

export const fitPdfFontSize = (
  textWidthAtSizeOne: number,
  maxWidth: number,
  preferredSize: number,
  minimumSize: number,
) => Math.max(minimumSize, Math.min(preferredSize, maxWidth / Math.max(textWidthAtSizeOne, 0.01)));
