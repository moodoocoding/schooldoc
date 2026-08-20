import { isDataCollectDemoMode } from './dataCollectConfig';
import { fileToDataUrl, hashCollectionPassword, validateCollectionFile } from './dataCollectUtils';
import type { DataCollection, DataCollectionDraft, DataCollectionStoredFile, DataCollectionSubmission } from './types';

const STORAGE_KEY = 'schooldoc_data_collect_v1';
const CHANGE_EVENT = 'schooldoc-data-collect-change';
const makeId = () => crypto.randomUUID();

const read = (): DataCollection[] => {
  if (!isDataCollectDemoMode) return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as DataCollection[];
  } catch {
    return [];
  }
};

const write = (collections: DataCollection[]) => {
  if (!isDataCollectDemoMode) throw new Error('자료 수합 서버 저장소는 다음 단계에서 연결합니다.');
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collections));
  } catch {
    throw new Error('브라우저 저장 공간이 부족합니다. 개발 모드에서는 작은 시험 파일을 사용해 주세요.');
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
};

export const listDataCollections = (ownerId: string) => read()
  .filter((collection) => collection.ownerId === ownerId)
  .toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt));

export const getDataCollection = (id: string) => read().find((collection) => collection.id === id) ?? null;
export const getDataCollectionByToken = (token: string) => read().find((collection) => collection.publicToken === token) ?? null;

const storeFile = async (file: File): Promise<DataCollectionStoredFile> => {
  await validateCollectionFile(file);
  return {
    originalName: file.name,
    mimeType: file.type || 'application/octet-stream',
    byteSize: file.size,
    dataUrl: await fileToDataUrl(file),
  };
};

export const createDataCollection = async (ownerId: string, draft: DataCollectionDraft, sourceFile?: File) => {
  const now = new Date().toISOString();
  const collection: DataCollection = {
    id: makeId(),
    ownerId,
    publicToken: makeId().replaceAll('-', ''),
    title: draft.title.trim(),
    description: draft.description.trim(),
    kind: draft.kind,
    status: 'open',
    allowResubmit: draft.allowResubmit,
    dueAt: draft.dueAt,
    passwordHash: await hashCollectionPassword(draft.password),
    retentionMonths: draft.retentionMonths,
    sourceFile: sourceFile ? await storeFile(sourceFile) : undefined,
    targets: draft.targets.map((target, index) => ({
      id: makeId(),
      rowNumber: index + 1,
      label: target.label.trim(),
      owner: target.owner.trim(),
      personalToken: makeId().replaceAll('-', ''),
    })),
    submissions: [],
    createdAt: now,
    updatedAt: now,
  };
  write([...read(), collection]);
  return collection;
};

export const updateDataCollectionStatus = (id: string, status: DataCollection['status']) => {
  write(read().map((collection) => collection.id === id ? {
    ...collection,
    status,
    updatedAt: new Date().toISOString(),
  } : collection));
};

export const deleteDataCollection = (id: string) => write(read().filter((collection) => collection.id !== id));

export const submitDataCollectionReview = async (
  collectionId: string,
  targetId: string,
  decision: DataCollectionSubmission['decision'],
  file?: File,
  note = '',
) => {
  const collection = getDataCollection(collectionId);
  if (!collection) throw new Error('자료 수합을 찾을 수 없습니다.');
  const revisions = collection.submissions.filter((item) => item.targetId === targetId);
  if (revisions.length > 0 && !collection.allowResubmit) throw new Error('이 수합은 다시 제출할 수 없습니다.');
  if ((decision === 'corrected' || decision === 'submitted') && !file) {
    throw new Error(decision === 'corrected' ? '수정한 파일을 선택해 주세요.' : '제출할 파일을 선택해 주세요.');
  }
  const submission: DataCollectionSubmission = {
    id: makeId(),
    targetId,
    revision: revisions.length + 1,
    decision,
    note: note.trim(),
    uploadedAt: new Date().toISOString(),
    file: file ? await storeFile(file) : undefined,
  };
  write(read().map((item) => item.id === collectionId ? {
    ...item,
    submissions: [...item.submissions, submission],
    updatedAt: submission.uploadedAt,
  } : item));
  return submission;
};

export const subscribeDataCollections = (listener: () => void) => {
  const onStorage = (event: StorageEvent) => { if (event.key === STORAGE_KEY) listener(); };
  window.addEventListener('storage', onStorage);
  window.addEventListener(CHANGE_EVENT, listener);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(CHANGE_EVENT, listener);
  };
};
