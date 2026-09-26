export type ImportRows = readonly (readonly unknown[])[];

export interface ImportSheet {
  sheet: string;
  data: ImportRows;
}

export const normalizeImportHeader = (value: unknown) => String(value ?? '')
  .normalize('NFKC')
  .trim()
  .toLocaleLowerCase('ko-KR')
  .replace(/\([^)]*\)|\[[^\]]*\]/g, '')
  .replace(/[\s._·\-:/\\]+/g, '');

/** UTF-8, UTF-16 BOM, 그리고 국내 Excel의 EUC-KR 텍스트를 읽는다. */
export const decodeImportText = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le'
    : bytes[0] === 0xfe && bytes[1] === 0xff ? 'utf-16be' : 'utf-8';
  try {
    return new TextDecoder(encoding, { fatal: true }).decode(bytes);
  } catch {
    try {
      return new TextDecoder('euc-kr', { fatal: true }).decode(bytes);
    } catch {
      throw new Error('한글 인코딩을 읽지 못했습니다. UTF-8 형식으로 저장한 뒤 다시 선택해 주세요.');
    }
  }
};

export const parseDelimitedImportText = async (input: string, delimiter?: string): Promise<string[][]> => {
  const { default: Papa } = await import('papaparse');
  const source = input.replace(/^\uFEFF/, '');
  // 제목/빈 행이 표 앞에 있어도 실제 데이터 행을 기준으로 구분자를 고른다.
  const candidates = (delimiter ? [delimiter] : ['\t', ',', ';']).map((separator) => {
    const result = Papa.parse<string[]>(source, { delimiter: separator, skipEmptyLines: false });
    return { result, score: result.data.filter((row) => row.length > 1).length };
  });
  const best = candidates.toSorted((a, b) => b.score - a.score)[0];
  if (best.result.errors.length) throw new Error('표의 따옴표나 구분자가 올바르지 않습니다. 원본 파일을 확인해 주세요.');
  return best.result.data;
};

export const readDelimitedImportFile = async (file: File, delimiter?: string) =>
  parseDelimitedImportText(decodeImportText(await file.arrayBuffer()), delimiter);

export const readExcelImportFile = async (file: File): Promise<ImportSheet[]> => {
  const { default: readWorkbook } = await import('read-excel-file/web-worker');
  try {
    return await readWorkbook(file);
  } catch {
    throw new Error('엑셀 파일을 읽지 못했습니다. 손상되거나 암호화되지 않은 .xlsx 파일인지 확인해 주세요.');
  }
};
