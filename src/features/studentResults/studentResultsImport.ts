import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { ResultColumn, ResultRecipientDraft } from './types';

type SheetRows = readonly (readonly unknown[])[];

export interface StudentResultPdfTextItem {
  text: string;
  x: number;
  y: number;
}

export interface StudentResultImportAnalysis {
  title: string;
  description: string;
  sheetName: string;
  headerRowNumber: number;
  columns: ResultColumn[];
  recipients: ResultRecipientDraft[];
  warnings: string[];
}

const normalizeHeader = (value: unknown) => String(value ?? '')
  .normalize('NFKC')
  .trim()
  .toLocaleLowerCase('ko-KR')
  .replace(/\([^)]*\)|\[[^\]]*\]/g, '')
  .replace(/[\s._·\-:/\\]+/g, '');

const NAME_HEADERS = new Set(['성명', '이름', '학생명', 'name']);
const KEY_HEADERS = new Set(['학번', '학생번호', '번호', '연번', '순번', 'id', '식별값']);
const CODE_HEADERS = new Set(['확인번호', '인증번호', '비밀번호', '인증코드', '확인코드', 'accesscode']);
const FEEDBACK_HEADERS = new Set(['피드백', '종합의견', '교사의견', '코멘트', 'feedback', '비고']);
const METADATA_HEADERS = new Set(['학년', '반', '학급', '소속', '학교', '학교명', '출석번호']);
const MAX_IMPORT_FILE_SIZE = 20 * 1024 * 1024;
const MAX_PDF_PAGES = 100;

const text = (value: unknown) => String(value ?? '').trim();
const isNumericCell = (value: unknown) => value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value));

const scoreHeader = (header: string) => {
  const explicitMax = header.match(/(?:\(|\[|\/)\s*(\d+(?:\.\d+)?)\s*점?\s*(?:\)|\])?/)?.[1]
    ?? header.match(/(\d+(?:\.\d+)?)\s*점\s*만점/)?.[1];
  return {
    label: header
      .replace(/(?:\(|\[|\/)\s*\d+(?:\.\d+)?\s*점?\s*(?:\)|\])?/g, '')
      .replace(/\d+(?:\.\d+)?\s*점\s*만점/g, '')
      .trim() || header.trim(),
    explicitMax: explicitMax ? Number(explicitMax) : null,
  };
};

const inferredMaxScore = (values: number[]) => {
  const highest = Math.max(...values, 1);
  if (highest <= 5) return 5;
  if (highest <= 10) return 10;
  if (highest <= 20) return 20;
  if (highest <= 50) return 50;
  if (highest <= 100) return 100;
  return Math.ceil(highest / 10) * 10;
};

const uniqueCodeFactory = (factory: () => string, reserved: string[] = []) => {
  const used = new Set(reserved.filter(Boolean));
  return () => {
    let code = factory();
    while (used.has(code) || code.length < 4) code = factory();
    used.add(code);
    return code;
  };
};

const defaultCode = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 9000 + 1000);

const groupPdfLines = (items: readonly StudentResultPdfTextItem[]) => {
  const lines: Array<{ y: number; items: StudentResultPdfTextItem[] }> = [];
  items
    .filter((item) => item.text.trim())
    .toSorted((a, b) => b.y - a.y || a.x - b.x)
    .forEach((item) => {
      const line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= 3);
      if (line) line.items.push(item);
      else lines.push({ y: item.y, items: [{ ...item, text: item.text.trim() }] });
    });
  return lines
    .toSorted((a, b) => b.y - a.y)
    .map((line) => line.items.toSorted((a, b) => a.x - b.x));
};

const headerLineScore = (items: readonly StudentResultPdfTextItem[]) => {
  const headers = items.map((item) => normalizeHeader(item.text));
  const nameIndex = headers.findIndex((header) => NAME_HEADERS.has(header));
  if (nameIndex < 0) return -1;
  const reserved = headers.filter((header) => (
    KEY_HEADERS.has(header) || CODE_HEADERS.has(header) || FEEDBACK_HEADERS.has(header)
  )).length;
  return 100 + reserved * 10 + headers.filter(Boolean).length;
};

const cellsFromPdfLine = (
  items: readonly StudentResultPdfTextItem[],
  anchors: readonly number[],
) => {
  const cells = Array.from({ length: anchors.length }, () => [] as string[]);
  items.forEach((item) => {
    const nearestIndex = anchors.reduce((bestIndex, anchor, index) => (
      Math.abs(anchor - item.x) < Math.abs(anchors[bestIndex] - item.x) ? index : bestIndex
    ), 0);
    cells[nearestIndex].push(item.text.trim());
  });
  return cells.map((parts) => parts.join(' ').replace(/\s+/g, ' ').trim());
};

/** PDF 글자의 위치를 표의 열로 되돌린다. 숫자는 추측하지 않고 원문에 있는 값만 사용한다. */
export const reconstructStudentResultPdfRows = (
  pages: readonly (readonly StudentResultPdfTextItem[])[],
): string[][] => {
  const pageLines = pages.map(groupPdfLines);
  const headerCandidates = pageLines.flatMap((lines, pageIndex) => lines.map((items, lineIndex) => ({
    pageIndex,
    lineIndex,
    items,
    score: headerLineScore(items),
  })));
  const header = headerCandidates.reduce<(typeof headerCandidates)[number] | null>(
    (best, candidate) => candidate.score > (best?.score ?? -1) ? candidate : best,
    null,
  );
  if (!header || header.score < 0) return pageLines.flatMap((lines) => lines.map((items) => items.map((item) => item.text)));

  const canonicalHeaders = header.items.map((item) => item.text.trim());
  const canonicalAnchors = header.items.map((item) => item.x);
  const nameIndex = canonicalHeaders.findIndex((value) => NAME_HEADERS.has(normalizeHeader(value)));
  const rows: string[][] = [];

  pageLines.forEach((lines, pageIndex) => {
    let anchors = canonicalAnchors;
    let tableStarted = pageIndex > header.pageIndex;

    lines.forEach((items, lineIndex) => {
      const isBeforeFirstHeader = pageIndex < header.pageIndex
        || (pageIndex === header.pageIndex && lineIndex < header.lineIndex);
      if (isBeforeFirstHeader) {
        const lineText = items.map((item) => item.text.trim()).filter(Boolean).join(' ');
        if (lineText) rows.push([lineText]);
        return;
      }

      if (headerLineScore(items) >= 0) {
        anchors = items.length === canonicalHeaders.length ? items.map((item) => item.x) : canonicalAnchors;
        if (!tableStarted) rows.push(canonicalHeaders);
        tableStarted = true;
        return;
      }
      if (!tableStarted) return;

      const cells = cellsFromPdfLine(items, anchors);
      const hasName = Boolean(cells[nameIndex]?.trim());
      const hasNumericValue = cells.some((value, index) => index !== nameIndex && isNumericCell(value));
      if (hasName && hasNumericValue) rows.push(cells);
    });
  });
  return rows;
};

const extractStudentResultPdfRows = async (file: File) => {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  let document: PDFDocumentProxy;
  try {
    document = await loadingTask.promise;
  } catch {
    await loadingTask.destroy();
    throw new Error('PDF를 읽지 못했습니다. 손상되거나 암호화된 파일인지 확인해 주세요.');
  }
  try {
    if (document.numPages > MAX_PDF_PAGES) {
      throw new Error(`PDF는 ${MAX_PDF_PAGES}쪽 이하만 분석할 수 있습니다.`);
    }
    const pages: StudentResultPdfTextItem[][] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.flatMap((item) => 'str' in item && item.str.trim()
        ? [{ text: item.str, x: item.transform[4], y: item.transform[5] }]
        : []));
    }
    if (pages.every((items) => items.length === 0)) {
      throw new Error('PDF에서 글자를 찾지 못했습니다. 스캔본은 분석할 수 없습니다. 텍스트를 선택할 수 있는 PDF나 엑셀 파일을 사용해 주세요.');
    }
    return { rows: reconstructStudentResultPdfRows(pages), pageCount: document.numPages };
  } finally {
    await loadingTask.destroy();
  }
};

export const analyzeStudentResultRows = (
  rows: SheetRows,
  sheetName = 'Sheet1',
  fallbackTitle = '학생 결과 안내',
  createCode: () => string = defaultCode,
): StudentResultImportAnalysis => {
  const candidates = rows.slice(0, 80).map((row, rowIndex) => {
    const headers = row.map(normalizeHeader);
    const nameIndex = headers.findIndex((header) => NAME_HEADERS.has(header));
    const codeIndex = headers.findIndex((header) => CODE_HEADERS.has(header));
    const keyIndex = headers.findIndex((header) => KEY_HEADERS.has(header));
    const feedbackIndex = headers.findIndex((header) => FEEDBACK_HEADERS.has(header));
    const filled = headers.filter(Boolean).length;
    return {
      rowIndex,
      headers,
      nameIndex,
      codeIndex,
      keyIndex,
      feedbackIndex,
      score: nameIndex < 0 ? -1 : 100 + (codeIndex >= 0 ? 20 : 0) + (keyIndex >= 0 ? 10 : 0) + filled,
    };
  });
  const header = candidates.reduce<(typeof candidates)[number] | null>(
    (best, candidate) => candidate.score > (best?.score ?? -1) ? candidate : best,
    null,
  );
  if (!header || header.nameIndex < 0) throw new Error('성명 또는 이름 머리글을 찾지 못했습니다.');

  const preHeaderRows = rows.slice(0, header.rowIndex)
    .map((row) => row.map(text).filter(Boolean))
    .filter((row) => row.length > 0);
  const titleRow = preHeaderRows.find((row) => row.length === 1 && !/^(일시|날짜|학년|학기|안내)\s*[:：]/.test(row[0]));
  const title = titleRow?.[0] ?? fallbackTitle;
  const description = preHeaderRows
    .filter((row) => row !== titleRow)
    .flat()
    .filter((value) => value !== title)
    .join(' · ');

  const reservedIndexes = new Set([header.nameIndex, header.codeIndex, header.keyIndex, header.feedbackIndex].filter((index) => index >= 0));
  const dataRows = rows.slice(header.rowIndex + 1).filter((row) => {
    const name = text(row[header.nameIndex]);
    return name && !NAME_HEADERS.has(normalizeHeader(name));
  });
  if (dataRows.length === 0) throw new Error('성명 머리글 아래에서 학생 데이터를 찾지 못했습니다.');

  const ignoredHeaders: string[] = [];
  const columns = header.headers.flatMap((normalized, index) => {
    if (!normalized || reservedIndexes.has(index)) return [];
    const originalHeader = text(rows[header.rowIndex][index]);
    if (METADATA_HEADERS.has(normalized)) {
      ignoredHeaders.push(originalHeader);
      return [];
    }
    const numericValues = dataRows.map((row) => row[index]).filter(isNumericCell).map(Number);
    if (numericValues.length === 0) {
      ignoredHeaders.push(originalHeader);
      return [];
    }
    const parsed = scoreHeader(originalHeader);
    return [{
      id: `imported-${index}-${normalizeHeader(parsed.label) || index}`,
      label: parsed.label,
      maxScore: parsed.explicitMax ?? inferredMaxScore(numericValues),
      description: '',
      sourceIndex: index,
      inferred: parsed.explicitMax === null,
    }];
  });
  if (columns.length === 0) throw new Error('숫자 결과 항목을 찾지 못했습니다. 점수 열의 값을 확인해 주세요.');

  const existingCodes = header.codeIndex < 0 ? [] : dataRows.map((row) => text(row[header.codeIndex]));
  const nextCode = uniqueCodeFactory(createCode, existingCodes);
  let generatedCodeCount = 0;
  const recipients = dataRows.map((row, index) => {
    let verificationCode = header.codeIndex >= 0 ? text(row[header.codeIndex]) : '';
    if (!verificationCode) {
      verificationCode = nextCode();
      generatedCodeCount += 1;
    }
    return {
      studentKey: header.keyIndex >= 0 ? text(row[header.keyIndex]) || String(index + 1) : String(index + 1),
      name: text(row[header.nameIndex]),
      verificationCode,
      values: Object.fromEntries(columns.map((column) => [
        column.id,
        isNumericCell(row[column.sourceIndex]) ? Number(row[column.sourceIndex]) : '' as const,
      ])),
      feedback: header.feedbackIndex >= 0 ? text(row[header.feedbackIndex]) : '',
    };
  });

  const warnings = [
    ...(generatedCodeCount > 0 ? [`확인번호가 없는 학생 ${generatedCodeCount}명에게 4자리 확인번호를 생성했습니다.`] : []),
    ...(columns.some((column) => column.inferred) ? ['머리글에 배점이 없는 결과 항목은 입력된 최고 점수를 기준으로 배점을 추정했습니다.'] : []),
    ...(ignoredHeaders.length > 0 ? [`숫자 값이 없는 열은 결과 항목에서 제외했습니다: ${ignoredHeaders.join(', ')}`] : []),
  ];

  return {
    title,
    description,
    sheetName,
    headerRowNumber: header.rowIndex + 1,
    columns: columns.map(({ sourceIndex: _sourceIndex, inferred: _inferred, ...column }) => column),
    recipients,
    warnings,
  };
};

export const analyzeStudentResultFile = async (file: File) => {
  if (file.size === 0) throw new Error('내용이 없는 파일은 불러올 수 없습니다.');
  if (file.size > MAX_IMPORT_FILE_SIZE) throw new Error('결과 파일은 20MB 이하만 불러올 수 있습니다.');
  const isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
  const isCsv = /\.csv$/i.test(file.name) || file.type === 'text/csv';
  const isXlsx = /\.xlsx$/i.test(file.name)
    || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (!isPdf && !isCsv && !isXlsx) {
    throw new Error('XLSX, CSV 또는 PDF 파일만 불러올 수 있습니다.');
  }

  const fallbackTitle = file.name.replace(/\.(xlsx|csv|pdf)$/i, '').trim() || '학생 결과 안내';
  if (isPdf) {
    const { rows, pageCount } = await extractStudentResultPdfRows(file);
    let analysis: StudentResultImportAnalysis;
    try {
      analysis = analyzeStudentResultRows(rows, `PDF ${pageCount}쪽`, fallbackTitle);
    } catch (error) {
      if (error instanceof Error && /성명 또는 이름 머리글/.test(error.message)) {
        throw new Error('PDF에서 성명과 점수 표를 찾지 못했습니다. 표 머리글에 성명/이름과 점수 항목이 있는지 확인해 주세요.');
      }
      throw error;
    }
    return {
      ...analysis,
      warnings: [
        ...analysis.warnings,
        'PDF의 글자 위치를 바탕으로 표를 복원했습니다. 적용 전 학생·점수·배점을 원본과 확인해 주세요.',
      ],
    };
  }

  if (isCsv) {
    const { default: Papa } = await import('papaparse');
    const result = await new Promise<unknown[][]>((resolve, reject) => {
      Papa.parse<unknown[]>(file, {
        skipEmptyLines: false,
        complete: (parsed) => parsed.errors.length ? reject(new Error(parsed.errors[0].message)) : resolve(parsed.data),
        error: reject,
      });
    });
    return analyzeStudentResultRows(result, 'CSV', fallbackTitle);
  }

  const { default: readWorkbook } = await import('read-excel-file/web-worker');
  const sheets = await readWorkbook(file);
  const analyses = sheets.flatMap(({ sheet, data }) => {
    try {
      return [analyzeStudentResultRows(data, sheet, fallbackTitle)];
    } catch {
      return [];
    }
  });
  if (analyses.length === 0) throw new Error('성명과 점수 데이터가 있는 시트를 찾지 못했습니다.');
  return analyses.toSorted((a, b) => (
    b.recipients.length * 100 + b.columns.length - (a.recipients.length * 100 + a.columns.length)
  ))[0];
};

export const studentResultImportAccept = [
  '.xlsx',
  '.csv',
  '.pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/pdf',
].join(',');
