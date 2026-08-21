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
const uniqueLabels = (values: string[]) => [...new Map(values.map((value) => [value.toLocaleLowerCase('ko-KR'), value])).values()];

/**
 * 붙여넣은 표에서 이름/성명 열을 찾아 제출 대상 행으로 변환한다.
 * 헤더가 없으면 이름처럼 보이는 값의 비율이 가장 높은 열을 선택한다.
 */
export const parseDataCollectionRows = (rows: unknown[][]) => {
  const cleanRows = rows.map((row) => row.map(normalizeCell)).filter((row) => row.some(Boolean));
  if (cleanRows.length === 0) return [];
  const headerIndex = cleanRows.slice(0, Math.min(5, cleanRows.length)).findIndex((row) => row.some((cell) => NAME_HEADER_PATTERN.test(cell)));
  const header = headerIndex >= 0 ? cleanRows[headerIndex] : undefined;
  const nameColumn = header ? header.findIndex((cell) => NAME_HEADER_PATTERN.test(cell)) : (() => {
    const width = Math.max(...cleanRows.map((row) => row.length));
    return Array.from({ length: width }, (_, column) => ({
      column,
      score: cleanRows.map((row) => row[column] ?? '').filter(isNameLike).length,
      textScore: cleanRows.map((row) => row[column] ?? '').filter((value) => value.length > 1 && !/^\d+$/.test(value)).length,
      nonEmpty: cleanRows.map((row) => row[column] ?? '').filter(Boolean).length,
    })).sort((a, b) => (b.score / Math.max(b.nonEmpty, 1)) - (a.score / Math.max(a.nonEmpty, 1)) || (b.textScore / Math.max(b.nonEmpty, 1)) - (a.textScore / Math.max(a.nonEmpty, 1)) || b.score - a.score)[0]?.column ?? 0;
  })();
  const start = headerIndex >= 0 ? headerIndex + 1 : 0;
  const selectedValues = cleanRows.slice(start).map((row) => row[nameColumn] ?? '');
  const nameLikeCount = selectedValues.filter(isNameLike).length;
  const values = selectedValues.filter((value) => !HEADER_PATTERN.test(value) && (headerIndex >= 0 || nameLikeCount === 0 || isNameLike(value)));
  return uniqueLabels(values);
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
