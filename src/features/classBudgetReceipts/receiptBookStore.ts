import type { CreateReceiptBookInput, ReceiptAnalysisDraft, ReceiptBook, ReceiptEntryInput, ReceiptFile } from './types';
import { deleteReceiptOriginal, putReceiptOriginal } from './receiptOriginalStore';

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
  analysisCandidates: Array.isArray(file.analysisCandidates)
    ? file.analysisCandidates
    : file.analysis ? [file.analysis] : [],
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

export const uploadLocalReceiptFiles = async (ownerId: string, bookId: string, files: File[]) => {
  const uploaded: ReceiptFile[] = [];
  try {
  for (const file of files) {
    const createdAt = now();
    const stored: ReceiptFile = {
      id: id('receipt-file'), bookId, status: 'uploaded', originalName: file.name, mimeType: file.type,
      sizeBytes: file.size, sha256: await digest(file), analysisStatus: 'pending', analysis: null,
      analysisCandidates: [],
      analysisErrorCode: null, analyzedAt: null, previewUrl: '', linkedEntryIds: [],
      createdAt, updatedAt: createdAt,
    };
    if (getReceiptBook(ownerId, bookId)?.files.some(f => f.sha256 === stored.sha256) || uploaded.some(f => f.sha256 === stored.sha256)) throw new Error('이미 등록한 영수증 파일입니다. 등록된 파일에서 확인해 주세요.');
    await putReceiptOriginal(ownerId, bookId, stored.id, file);
    uploaded.push(stored);
  }
  const commit = () => update(ownerId, bookId, (book) => {
    if (uploaded.some(u => book.files.some(f => f.sha256 === u.sha256))) throw new Error('다른 탭에서 이미 등록한 영수증입니다.');
    return { ...book, files: [...book.files, ...uploaded], updatedAt: now() };
  }).files.filter(f => uploaded.some(u => u.id === f.id));
  return navigator.locks ? await navigator.locks.request(`receipt-upload:${ownerId}:${bookId}`, commit) : commit();
  } catch (error) {
    await Promise.allSettled(uploaded.map(f => deleteReceiptOriginal(ownerId, bookId, f.id)));
    throw error;
  }
};

export const saveLocalReceiptFileAnalysis = (ownerId: string, bookId: string, fileId: string, drafts: ReceiptAnalysisDraft[] | null, errorMessage?: string) => update(ownerId, bookId, (book) => ({
  ...book,
  files: book.files.map((file) => file.id === fileId ? {
    ...file,
    analysisStatus: drafts?.length ? 'ready' : 'failed',
    analysis: drafts?.[0] ?? null,
    analysisCandidates: drafts ?? [],
    analysisErrorCode: drafts?.length ? null : errorMessage ?? '자동 분석에 실패했습니다.',
    analyzedAt: now(),
    updatedAt: now(),
  } : file),
  updatedAt: now(),
}));

export const addReceiptEntry = (ownerId: string, bookId: string, input: ReceiptEntryInput) => update(ownerId, bookId, (book) => {
  validateEntry(input, book);
  if (input.analysisCandidateKey && book.entries.some(e => e.analysisCandidateKey === input.analysisCandidateKey)) throw new Error('이미 반영한 분석 결과입니다. 기존 지출을 확인하거나 복원해 주세요.');
  const createdAt = now();
  const entryId = id('receipt-entry');
  return {
    ...book,
    entries: [...book.entries, { id: entryId, ...input, createdAt, updatedAt: createdAt, deletedAt: null, purgeAfter: null }],
    files: book.files.map((file) => input.evidenceFileIds.includes(file.id) ? { ...file, linkedEntryIds: [...new Set([...file.linkedEntryIds, entryId])] } : file),
    updatedAt: createdAt,
  };
});

export const editReceiptEntry = (ownerId: string, bookId: string, entryId: string, input: ReceiptEntryInput) => update(ownerId, bookId, (book) => {
  validateEntry(input, book);
  if (!book.entries.some(e => e.id === entryId && !e.deletedAt)) throw new Error('수정할 지출을 찾지 못했습니다.');
  return ({
  ...book,
  entries: book.entries.map((entry) => entry.id === entryId ? { ...entry, ...input, updatedAt: now() } : entry),
  files: book.files.map((file) => {
    const linked = input.evidenceFileIds.includes(file.id);
    return { ...file, linkedEntryIds: linked ? [...new Set([...file.linkedEntryIds, entryId])] : file.linkedEntryIds.filter((idValue) => idValue !== entryId) };
  }),
  updatedAt: now(),
}); });

const validateEntry = (input: ReceiptEntryInput, book: ReceiptBook) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.spentAt) || !Number.isFinite(Date.parse(input.spentAt)) || new Date(input.spentAt).toISOString().slice(0, 10) !== input.spentAt) throw new Error('사용 날짜를 확인해 주세요.');
  if (!input.merchant.trim() || !input.purpose.trim()) throw new Error('사용처와 사용 목적을 입력해 주세요.');
  if (!Number.isSafeInteger(input.amount) || input.amount < 1 || input.amount > 100_000_000) throw new Error('금액은 1원 이상 1억원 이하의 정수로 입력해 주세요.');
  if (input.evidenceFileIds.some(id => !book.files.some(f => f.id === id))) throw new Error('연결할 영수증 원본을 찾지 못했습니다.');
};

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
