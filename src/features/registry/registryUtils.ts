import type { Registry, RegistryColumn, RegistryParticipant } from './types';

const MAX_SIGNATURE_DATA_URL_LENGTH = 8_000_000;

export const createColumn = (label = ''): RegistryColumn => ({
  id: crypto.randomUUID(),
  label,
});

export const createParticipant = (
  columns: RegistryColumn[],
  name = '',
  initialValues: string[] = [],
): Pick<RegistryParticipant, 'name' | 'values'> => ({
  name,
  values: Object.fromEntries(columns.map((column, index) => [column.id, initialValues[index] ?? ''])),
});

const normalizeExcelHeader = (value: unknown) => String(value ?? '')
  .normalize('NFKC')
  .trim()
  .toLocaleLowerCase('ko-KR')
  .replace(/\([^)]*\)|\[[^\]]*\]/g, '')
  .replace(/[\s._·\-:/\\]+/g, '');

const NAME_HEADERS = new Set([
  '성명',
  '이름',
  'name',
  '참석자명',
  '참가자명',
  '교직원명',
]);

const excelColumnHeaders = (label: string) => {
  const normalized = normalizeExcelHeader(label);
  const aliases = new Set([normalized]);
  if (normalized === '소속') {
    ['소속기관', '기관', '기관명', '학교', '학교명'].forEach((alias) => aliases.add(alias));
  }
  if (normalized === '직위') {
    ['직급', '직책'].forEach((alias) => aliases.add(alias));
  }
  return aliases;
};

export const parseExcelRows = (
  rows: readonly (readonly unknown[])[],
  columns: RegistryColumn[],
) => {
  const headerCandidates = rows.slice(0, 50).map((row, rowIndex) => {
    const headers = row.map(normalizeExcelHeader);
    const nameIndex = headers.findIndex((header) => NAME_HEADERS.has(header));
    const columnIndexes = columns.map((column) => {
      const aliases = excelColumnHeaders(column.label);
      return headers.findIndex((header, index) => index !== nameIndex && aliases.has(header));
    });
    return {
      rowIndex,
      nameIndex,
      columnIndexes,
      score: nameIndex < 0 ? -1 : columnIndexes.filter((index) => index >= 0).length,
    };
  });
  const header = headerCandidates.reduce<(typeof headerCandidates)[number] | undefined>(
    (best, candidate) => candidate.score > (best?.score ?? -1) ? candidate : best,
    undefined,
  );

  if (header && header.nameIndex >= 0) {
    return rows.slice(header.rowIndex + 1)
      .map((row) => createParticipant(
        columns,
        String(row[header.nameIndex] ?? '').trim(),
        header.columnIndexes.map((index) => index < 0 ? '' : String(row[index] ?? '').trim()),
      ))
      .filter((participant) => participant.name && !NAME_HEADERS.has(normalizeExcelHeader(participant.name)));
  }

  return rows.map((row) => {
    const cells = row.map((cell) => String(cell ?? '').trim());
    const nameIndex = cells.length > columns.length ? cells.length - 1 : 0;
    return createParticipant(
      columns,
      cells[nameIndex] ?? '',
      cells.filter((_, index) => index !== nameIndex),
    );
  }).filter((participant) => participant.name);
};

export const maskName = (name: string) => {
  if (name.length <= 1) return '*';
  if (name.length === 2) return `${name[0]}*`;
  return `${name[0]}${'*'.repeat(name.length - 2)}${name.at(-1)}`;
};

export const maskValue = (value: string) => {
  if (!value) return '';
  if (value.length <= 2) return `${value[0]}*`;
  return `${value.slice(0, 2)}${'*'.repeat(Math.min(4, value.length - 2))}`;
};

export const formatSignedAt = (date: string | undefined) => {
  if (!date) return '';
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
};

export const parsePastedRows = (text: string, columns: RegistryColumn[]) => text
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => {
    const cells = line.split('\t').map((cell) => cell.trim());
    if (columns.length === 0) return createParticipant(columns, cells[0] ?? '');
    const nameIndex = cells.length > columns.length ? cells.length - 1 : 0;
    const name = cells[nameIndex] ?? '';
    const values = cells.filter((_, index) => index !== nameIndex);
    return createParticipant(columns, name, values);
  })
  .filter((participant) => participant.name);

export const getRegistryPageSettings = (layout: Registry['layout']) => {
  if (layout === 20) return { columns: 2, rowsPerColumn: 10 } as const;
  if (layout === 30) return { columns: 2, rowsPerColumn: 15 } as const;
  return { columns: 1, rowsPerColumn: layout } as const;
};

export const paginateRegistryParticipants = (
  participants: RegistryParticipant[],
  pageSize: number,
) => {
  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    throw new RangeError('페이지 인원수는 1 이상의 정수여야 합니다.');
  }
  if (participants.length === 0) return [[]] as RegistryParticipant[][];

  const pages: RegistryParticipant[][] = [];
  for (let index = 0; index < participants.length; index += pageSize) {
    pages.push(participants.slice(index, index + pageSize));
  }
  return pages;
};

export const isValidSignatureDataUrl = (dataUrl: string) => {
  if (dataUrl.length > MAX_SIGNATURE_DATA_URL_LENGTH) return false;
  const match = /^data:image\/(?:png|jpe?g|webp);base64,([a-z0-9+/]+={0,2})$/i.exec(dataUrl);
  return Boolean(match?.[1] && match[1].length >= 8);
};
