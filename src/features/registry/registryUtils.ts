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
