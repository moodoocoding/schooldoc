export interface ImportedConsentRecipient {
  name: string;
  identifier: string;
}

export interface ConsentRecipientImportResult {
  recipients: ImportedConsentRecipient[];
  sourceLabel: string;
  mappingLabel: string;
  warnings: string[];
}

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const NAME_HEADERS = new Set([
  '성명', '이름', '학생명', '학생이름', '수신자', '수신자명', '보호자명', '참가자명', '참석자명',
  'name', 'studentname',
]);
const IDENTIFIER_HEADERS = new Set([
  '식별값', '식별번호', '학번', '학생번호', '번호', '출석번호', '학년반번호', '학년', '반', '학급',
  '소속', '소속기관', '학교', '학교명', '기관', '기관명', '부서', 'identifier', 'studentid', 'id',
]);

const normalizeHeader = (value: unknown) => String(value ?? '')
  .normalize('NFKC')
  .trim()
  .toLocaleLowerCase('ko-KR')
  .replace(/\([^)]*\)|\[[^\]]*\]/g, '')
  .replace(/[\s._·\-:/\\]+/g, '');

const cellText = (value: unknown) => String(value ?? '').normalize('NFKC').trim();
const isNameHeader = (value: unknown) => NAME_HEADERS.has(normalizeHeader(value));
const isIdentifierHeader = (value: unknown) => IDENTIFIER_HEADERS.has(normalizeHeader(value));
const looksLikePersonName = (value: string) => {
  const compact = value.replace(/\s+/g, '');
  if (!compact || isNameHeader(compact) || isIdentifierHeader(compact)) return false;
  if (/^(?:\d+|\d+학년|\d+반|\d+번)$/.test(compact)) return false;
  if (/(학교|학급|명단|가정통신문|수신자|대상자|번호)$/.test(compact)) return false;
  return /^[가-힣]{2,5}$/.test(compact) || /^[A-Za-z][A-Za-z .'-]{1,39}$/.test(value);
};

const deduplicate = (recipients: ImportedConsentRecipient[]) => {
  const keys = new Set<string>();
  return recipients.filter((recipient) => {
    const key = `${recipient.name.toLocaleLowerCase('ko-KR')}\u0000${recipient.identifier.toLocaleLowerCase('ko-KR')}`;
    if (keys.has(key)) return false;
    keys.add(key);
    return true;
  });
};

export const parseConsentRecipientRows = (
  rows: readonly (readonly unknown[])[],
): Omit<ConsentRecipientImportResult, 'sourceLabel'> => {
  const candidates = rows.slice(0, 50).map((row, rowIndex) => {
    const nameIndex = row.findIndex(isNameHeader);
    const identifierIndexes = row
      .map((cell, index) => isIdentifierHeader(cell) && index !== nameIndex ? index : -1)
      .filter((index) => index >= 0);
    return { rowIndex, nameIndex, identifierIndexes, score: nameIndex < 0 ? -1 : 10 + identifierIndexes.length };
  });
  const header = candidates.reduce<(typeof candidates)[number] | undefined>(
    (best, candidate) => candidate.score > (best?.score ?? -1) ? candidate : best,
    undefined,
  );

  if (header && header.nameIndex >= 0) {
    const headerRow = rows[header.rowIndex];
    const parsed = rows.slice(header.rowIndex + 1).flatMap((row) => {
      const name = cellText(row[header.nameIndex]);
      if (!name || isNameHeader(name)) return [];
      const identifier = header.identifierIndexes
        .map((index) => cellText(row[index]))
        .filter(Boolean)
        .join(' · ');
      return [{ name, identifier }];
    });
    const recipients = deduplicate(parsed);
    return {
      recipients,
      mappingLabel: `${cellText(headerRow[header.nameIndex])} → 이름${header.identifierIndexes.length ? `, ${header.identifierIndexes.map((index) => cellText(headerRow[index])).join(' · ')} → 식별값` : ''}`,
      warnings: recipients.length === 0 ? ['헤더는 찾았지만 불러올 수신자가 없습니다.'] : [],
    };
  }

  const columnCount = Math.max(0, ...rows.map((row) => row.length));
  const nameColumn = Array.from({ length: columnCount }, (_, index) => ({
    index,
    score: rows.reduce((score, row) => score + (looksLikePersonName(cellText(row[index])) ? 1 : 0), 0),
  })).sort((a, b) => b.score - a.score)[0];
  if (!nameColumn || nameColumn.score < 2) {
    return { recipients: [], mappingLabel: '', warnings: ['성명 또는 이름 열을 찾지 못했습니다. 명단의 열 제목을 확인해 주세요.'] };
  }

  const parsed = rows.flatMap((row) => {
    const name = cellText(row[nameColumn.index]);
    if (!looksLikePersonName(name)) return [];
    const identifier = row
      .map(cellText)
      .filter((value, index) => index !== nameColumn.index && Boolean(value))
      .slice(0, 3)
      .join(' · ');
    return [{ name, identifier }];
  });
  return {
    recipients: deduplicate(parsed),
    mappingLabel: `${nameColumn.index + 1}번째 열 → 이름`,
    warnings: ['열 제목을 찾지 못해 이름 형태가 가장 많은 열을 기준으로 불러왔습니다. 결과를 확인해 주세요.'],
  };
};

const extractPdfRows = async (file: File) => {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const rows: string[][] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const items = content.items.flatMap((item) => 'str' in item && item.str.trim()
      ? [{ text: item.str.trim(), x: item.transform[4], y: item.transform[5] }]
      : []);
    const lines: Array<{ y: number; items: typeof items }> = [];
    items.sort((a, b) => b.y - a.y || a.x - b.x).forEach((item) => {
      const line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= 3);
      if (line) line.items.push(item);
      else lines.push({ y: item.y, items: [item] });
    });
    lines.sort((a, b) => b.y - a.y).forEach((line) => {
      rows.push(line.items.sort((a, b) => a.x - b.x).map((item) => item.text));
    });
  }
  return rows;
};

export const importConsentRecipients = async (file: File): Promise<ConsentRecipientImportResult> => {
  if (file.size === 0) throw new Error('내용이 없는 파일은 불러올 수 없습니다.');
  if (file.size > MAX_FILE_SIZE) throw new Error('명단 파일은 20MB 이하만 불러올 수 있습니다.');
  const isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
  const isExcel = /\.xlsx$/i.test(file.name);
  if (!isPdf && !isExcel) throw new Error('엑셀(.xlsx) 또는 PDF 파일만 불러올 수 있습니다.');

  let rows: readonly (readonly unknown[])[];
  try {
    if (isPdf) rows = await extractPdfRows(file);
    else {
      const { readSheet } = await import('read-excel-file/web-worker');
      rows = await readSheet(file);
    }
  } catch {
    throw new Error(isPdf
      ? 'PDF를 읽지 못했습니다. 손상되거나 암호화된 파일인지 확인해 주세요.'
      : '엑셀 파일을 읽지 못했습니다. 올바른 .xlsx 파일인지 확인해 주세요.');
  }
  if (rows.length === 0) {
    throw new Error(isPdf
      ? 'PDF에서 글자를 찾지 못했습니다. 스캔본 대신 텍스트를 선택할 수 있는 PDF나 엑셀 파일을 사용해 주세요.'
      : '엑셀 파일에 데이터가 없습니다.');
  }
  const result = parseConsentRecipientRows(rows);
  if (result.recipients.length === 0) throw new Error(result.warnings[0] ?? '명단에서 수신자를 찾지 못했습니다.');
  return { ...result, sourceLabel: file.name };
};

export const consentRecipientExcelAccept = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const consentRecipientPdfAccept = '.pdf,application/pdf';
