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
