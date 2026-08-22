import type { DataCollectionKind } from './types';

export const DATA_COLLECTION_KIND_LABELS: Record<DataCollectionKind, string> = {
  worksheet: '평가지',
  plan: '계획서',
  consent: '동의서',
  custom: '직접 입력',
};
export const DATA_COLLECTION_TARGET_LABELS: Record<DataCollectionKind, [string, string]> = {
  worksheet: ['과목', '담당자'],
  plan: ['학급·부서·동아리', '담당자'],
  consent: ['학생', '담당자'],
  custom: ['제출 대상', '담당자'],
};

const ALLOWED_EXTENSIONS = new Set(['hwp', 'hwpx', 'docx', 'xlsx', 'pdf', 'png', 'jpg', 'jpeg']);
export const MAX_COLLECTION_FILE_SIZE = 50 * 1024 * 1024;

const extensionOf = (name: string) => name.toLowerCase().split('.').pop() ?? '';
const startsWithBytes = (bytes: Uint8Array, expected: number[]) => expected.every((value, index) => bytes[index] === value);

export const validateCollectionFile = async (file: File) => {
  const extension = extensionOf(file.name);
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error('한글, Word, Excel, PDF 또는 이미지 파일만 올릴 수 있습니다.');
  }
  if (file.size === 0) throw new Error('내용이 없는 파일은 올릴 수 없습니다.');
  if (file.size > MAX_COLLECTION_FILE_SIZE) throw new Error('파일은 50MB보다 작아야 합니다.');

  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const isPdf = startsWithBytes(bytes, [0x25, 0x50, 0x44, 0x46]);
  const isPng = startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47]);
  const isJpeg = startsWithBytes(bytes, [0xff, 0xd8, 0xff]);
  const isZip = startsWithBytes(bytes, [0x50, 0x4b, 0x03, 0x04]);
  const isOle = startsWithBytes(bytes, [0xd0, 0xcf, 0x11, 0xe0]);
  const valid = extension === 'pdf' ? isPdf
    : extension === 'png' ? isPng
      : extension === 'jpg' || extension === 'jpeg' ? isJpeg
        : extension === 'hwp' ? isOle
          : isZip;
  if (!valid) throw new Error('파일 확장자와 실제 파일 형식이 일치하지 않습니다.');
};

export const maskTargetLabel = (label: string) => {
  const value = label.trim();
  if (value.length <= 1) return value;
  if (value.length === 2) return `${value[0]}○`;
  return `${value[0]}${'○'.repeat(Math.min(2, value.length - 2))}${value.at(-1)}`;
};

const NAME_HEADER_PATTERN = /^(성명|이름|이름명|학생명|참여자|제출자|수합자|name|student ?name|participant)$/i;
const HEADER_PATTERN = /^(번호|순번|연번|no\.?|number|성명|이름|이름명|학생명|참여자|제출자|수합자|name|student ?name|participant)$/i;
const normalizeCell = (value: unknown) => String(value ?? '').replace(/\u00a0/g, ' ').trim();
const isNameLike = (value: string) => {
  if (!value || value.length > 40 || /^\d+(?:[.\-/]\d+)*$/.test(value)) return false;
  return /^[가-힣]{2,6}$/.test(value) || /^[A-Za-z][A-Za-z .'-]{1,38}$/.test(value);
};

export interface DataCollectionImportColumn {
  index: number;
  label: string;
  sample: string;
}

export interface DataCollectionImportAnalysis {
  columns: DataCollectionImportColumn[];
  selectedColumn: number;
  labels: string[];
  excludedCount: number;
  duplicateCount: number;
  headerRowIndex: number;
}

const spreadsheetColumnName = (index: number) => {
  let value = index + 1;
  let result = '';
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
};

/**
 * 자동으로 이름 열을 고르되 분석 결과를 숨기지 않는다.
 * 엑셀 열이 애매한 경우 화면에서 selectedColumn을 바꿔 같은 함수를 다시 호출한다.
 * 동명이인은 서로 다른 제출 대상일 수 있으므로 이 단계에서 합치지 않는다.
 */
export const analyzeDataCollectionRows = (rows: unknown[][], selectedColumn?: number): DataCollectionImportAnalysis => {
  const cleanRows = rows.map((row) => row.map(normalizeCell)).filter((row) => row.some(Boolean));
  if (cleanRows.length === 0) return { columns: [], selectedColumn: 0, labels: [], excludedCount: 0, duplicateCount: 0, headerRowIndex: -1 };

  const width = Math.max(...cleanRows.map((row) => row.length));
  const headerRowIndex = cleanRows.slice(0, Math.min(5, cleanRows.length)).findIndex((row) => row.some((cell) => NAME_HEADER_PATTERN.test(cell)));
  const header = headerRowIndex >= 0 ? cleanRows[headerRowIndex] : undefined;
  const scores = Array.from({ length: width }, (_, column) => {
    const values = cleanRows.map((row) => row[column] ?? '');
    const nonEmpty = values.filter(Boolean).length;
    return {
      column,
      score: values.filter(isNameLike).length,
      textScore: values.filter((value) => value.length > 1 && !/^\d+$/.test(value)).length,
      nonEmpty,
    };
  });
  const automaticColumn = header
    ? Math.max(0, header.findIndex((cell) => NAME_HEADER_PATTERN.test(cell)))
    : [...scores].sort((a, b) => (b.score / Math.max(b.nonEmpty, 1)) - (a.score / Math.max(a.nonEmpty, 1))
      || (b.textScore / Math.max(b.nonEmpty, 1)) - (a.textScore / Math.max(a.nonEmpty, 1))
      || b.score - a.score)[0]?.column ?? 0;
  const resolvedColumn = selectedColumn !== undefined && selectedColumn >= 0 && selectedColumn < width ? selectedColumn : automaticColumn;
  const start = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;
  const selectedValues = cleanRows.slice(start).map((row) => row[resolvedColumn] ?? '');
  const nameLikeCount = selectedValues.filter(isNameLike).length;
  const labels = selectedValues.filter((value) => value
    && !HEADER_PATTERN.test(value)
    && !/^\d+(?:[.\-/]\d+)*$/.test(value)
    && (selectedColumn !== undefined || headerRowIndex >= 0 || nameLikeCount === 0 || isNameLike(value)));
  const normalized = labels.map((label) => label.toLocaleLowerCase('ko-KR'));
  const duplicateCount = normalized.length - new Set(normalized).size;
  const columns = Array.from({ length: width }, (_, index) => {
    const headerLabel = header?.[index] ?? '';
    const sample = cleanRows.slice(start).map((row) => row[index] ?? '').find(Boolean) ?? '';
    return {
      index,
      label: `${spreadsheetColumnName(index)}열${headerLabel ? ` · ${headerLabel}` : ''}`,
      sample,
    };
  }).filter((column) => column.sample || header?.[column.index]);

  return {
    columns,
    selectedColumn: resolvedColumn,
    labels,
    excludedCount: Math.max(0, selectedValues.length - labels.length),
    duplicateCount,
    headerRowIndex,
  };
};

/**
 * 붙여넣은 표에서 이름/성명 열을 찾아 제출 대상 행으로 변환한다.
 * 헤더가 없으면 이름처럼 보이는 값의 비율이 가장 높은 열을 선택한다.
 */
export const parseDataCollectionRows = (rows: unknown[][]) => {
  return analyzeDataCollectionRows(rows).labels;
};

export const parseDataCollectionPastedRows = (text: string) => parseDataCollectionRows(text.split(/\r?\n/).map((line) => line.split(/\t|,/)));

export const isCollectionOpen = (status: 'open' | 'closed', dueAt: string, now = new Date()) => (
  status === 'open' && (!dueAt || new Date(dueAt).getTime() >= now.getTime())
);

export const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(new Error('파일을 읽지 못했습니다.'));
  reader.readAsDataURL(file);
});

export const hashCollectionPassword = async (password: string) => {
  if (!password) return '';
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};
