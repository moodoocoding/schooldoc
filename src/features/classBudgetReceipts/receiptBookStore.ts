import type { CreateReceiptBookInput, ReceiptAnalysisDraft, ReceiptBook, ReceiptEntryInput, ReceiptFile } from './types';

const STORAGE_PREFIX = 'schooldoc_class_budget_receipts_v1:';
const EVENT_NAME = 'schooldoc-class-budget-receipts-change';
const id = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const now = () => new Date().toISOString();

const normalizeFile = (file: Partial<ReceiptFile>, bookId: string): ReceiptFile => ({
  id: file.id ?? id('receipt-file'),
  bookId,
  status: file.status === 'failed' ? 'failed' : 'uploaded',
  originalName: file.originalName ?? '영수증',
  mimeType: file.mimeType ?? 'application/octet-stream',
  sizeBytes: Number(file.sizeBytes) || 0,
  sha256: file.sha256 ?? '',
  analysisStatus: file.analysisStatus ?? 'pending',
  analysis: file.analysis ?? null,
  analysisErrorCode: file.analysisErrorCode ?? null,
  analyzedAt: file.analyzedAt ?? null,
  previewUrl: file.previewUrl ?? '',
  linkedEntryIds: Array.isArray(file.linkedEntryIds) ? file.linkedEntryIds : [],
  createdAt: file.createdAt ?? now(),
  updatedAt: file.updatedAt ?? now(),
});

const normalizeBook = (book: ReceiptBook): ReceiptBook => ({
  ...book,
  entries: Array.isArray(book.entries) ? book.entries : [],
  files: Array.isArray(book.files) ? book.files.map((file) => normalizeFile(file, book.id)) : [],
  retentionMonths: Number(book.retentionMonths) || 3,
});

const key = (ownerId: string) => `${STORAGE_PREFIX}${ownerId}`;
const emit = () => window.dispatchEvent(new Event(EVENT_NAME));

const read = (ownerId: string): ReceiptBook[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key(ownerId)) ?? '[]') as ReceiptBook[];
    return Array.isArray(parsed) ? parsed.map(normalizeBook) : [];
  } catch { return []; }
};

const write = (ownerId: string, books: ReceiptBook[]) => {
  localStorage.setItem(key(ownerId), JSON.stringify(books));
  emit();
};

const update = (ownerId: string, bookId: string, mutate: (book: ReceiptBook) => ReceiptBook) => {
  const books = read(ownerId);
  const index = books.findIndex((book) => book.id === bookId);
  if (index < 0) throw new Error('학급 운영비 장부를 찾을 수 없습니다.');
  books[index] = mutate(books[index]);
  write(ownerId, books);
  return books[index];
};

export const subscribeReceiptBooks = (listener: () => void) => {
  window.addEventListener(EVENT_NAME, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(EVENT_NAME, listener);
    window.removeEventListener('storage', listener);
  };
};

export const listReceiptBooks = (ownerId: string) => read(ownerId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
export const getReceiptBook = (ownerId: string, bookId: string) => read(ownerId).find((book) => book.id === bookId) ?? null;

export const createReceiptBook = (ownerId: string, input: CreateReceiptBookInput) => {
  const createdAt = now();
  const book: ReceiptBook = {
    id: id('receipt-book'), ownerId, ...input, status: 'active', entries: [], files: [],
    retentionMonths: 3, createdAt, updatedAt: createdAt,
  };
  write(ownerId, [book, ...read(ownerId)]);
  return book;
};

const digest = async (file: File) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer())))
  .map((byte) => byte.toString(16).padStart(2, '0')).join('');

const preview = (file: File) => new Promise<string>((resolve) => {
  if (file.size > 1_000_000) { resolve(''); return; }
  const reader = new FileReader();
  reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
  reader.onerror = () => resolve('');
  reader.readAsDataURL(file);
});

export const uploadLocalReceiptFiles = async (ownerId: string, bookId: string, files: File[]) => {
  const uploaded: ReceiptFile[] = [];
  for (const file of files) {
    const createdAt = now();
    uploaded.push({
      id: id('receipt-file'), bookId, status: 'uploaded', originalName: file.name, mimeType: file.type,
      sizeBytes: file.size, sha256: await digest(file), analysisStatus: 'analyzing', analysis: null,
      analysisErrorCode: null, analyzedAt: null, previewUrl: await preview(file), linkedEntryIds: [],
      createdAt, updatedAt: createdAt,
    });
  }
  return update(ownerId, bookId, (book) => ({ ...book, files: [...book.files, ...uploaded], updatedAt: now() })).files.filter((file) => uploaded.some((item) => item.id === file.id));
};

export const saveLocalReceiptFileAnalysis = (ownerId: string, bookId: string, fileId: string, draft: ReceiptAnalysisDraft | null) => update(ownerId, bookId, (book) => ({
  ...book,
  files: book.files.map((file) => file.id === fileId ? {
    ...file,
    analysisStatus: draft ? 'ready' : 'failed',
    analysis: draft,
    analysisErrorCode: draft ? null : 'browser_analysis_failed',
    analyzedAt: now(),
    updatedAt: now(),
  } : file),
  updatedAt: now(),
}));

export const addReceiptEntry = (ownerId: string, bookId: string, input: ReceiptEntryInput) => update(ownerId, bookId, (book) => {
  const createdAt = now();
  const entryId = id('receipt-entry');
  return {
    ...book,
    entries: [...book.entries, { id: entryId, ...input, createdAt, updatedAt: createdAt, deletedAt: null, purgeAfter: null }],
    files: book.files.map((file) => input.evidenceFileIds.includes(file.id) ? { ...file, linkedEntryIds: [...new Set([...file.linkedEntryIds, entryId])] } : file),
    updatedAt: createdAt,
  };
});

export const editReceiptEntry = (ownerId: string, bookId: string, entryId: string, input: ReceiptEntryInput) => update(ownerId, bookId, (book) => ({
  ...book,
  entries: book.entries.map((entry) => entry.id === entryId ? { ...entry, ...input, updatedAt: now() } : entry),
  files: book.files.map((file) => {
    const linked = input.evidenceFileIds.includes(file.id);
    return { ...file, linkedEntryIds: linked ? [...new Set([...file.linkedEntryIds, entryId])] : file.linkedEntryIds.filter((idValue) => idValue !== entryId) };
  }),
  updatedAt: now(),
}));

export const trashReceiptEntry = (ownerId: string, bookId: string, entryId: string) => update(ownerId, bookId, (book) => {
  const deletedAt = now();
  const purgeAfter = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  return { ...book, entries: book.entries.map((entry) => entry.id === entryId ? { ...entry, deletedAt, purgeAfter, updatedAt: deletedAt } : entry), updatedAt: deletedAt };
});

export const restoreReceiptEntry = (ownerId: string, bookId: string, entryId: string) => update(ownerId, bookId, (book) => ({
  ...book, entries: book.entries.map((entry) => entry.id === entryId ? { ...entry, deletedAt: null, purgeAfter: null, updatedAt: now() } : entry), updatedAt: now(),
}));

export const discardReceiptFile = (ownerId: string, bookId: string, fileId: string) => update(ownerId, bookId, (book) => {
  const file = book.files.find((item) => item.id === fileId);
  if (file?.linkedEntryIds.length) throw new Error('지출에 연결된 파일은 먼저 연결을 해제해 주세요.');
  return { ...book, files: book.files.filter((item) => item.id !== fileId), updatedAt: now() };
});
