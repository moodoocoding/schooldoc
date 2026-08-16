import type { ConsentDocumentAnalysis, ConsentFieldDraft, ConsentRecipientMode } from './types';

/**
 * 만들던 수합을 브라우저에 임시 보관한다.
 * 긴 문서에 필드를 배치하다 새로고침하거나 탭이 닫히면 처음부터 다시 해야 하므로,
 * 원본 PDF까지 함께 담아 둔다. 원본이 커서 localStorage로는 감당이 안 돼 IndexedDB를 쓴다.
 *
 * 보호자 명단과 공개 비밀번호는 일부러 담지 않는다.
 * 명단 원문은 생성 화면에만 두기로 한 정책이고, 비밀번호는 남길 이유가 없다.
 */
const DB_NAME = 'schooldoc-consent';
const STORE = 'drafts';
const KEY = 'current';

export type ConsentDraftStep = 'document' | 'fields' | 'recipients' | 'sharing';

export interface ConsentDraftSnapshot {
  savedAt: string;
  editId: string;
  title: string;
  description: string;
  step: ConsentDraftStep;
  fields: ConsentFieldDraft[];
  analysis: ConsentDocumentAnalysis;
  recipientMode: ConsentRecipientMode;
  deadline: string;
  passwordEnabled: boolean;
  allowResubmission: boolean;
  fileName: string;
  file: Blob;
}

const openDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, 1);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error('임시 보관함을 열지 못했습니다.'));
});

const withStore = async <T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) => {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(database.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('임시 보관함을 사용하지 못했습니다.'));
    });
  } finally {
    database.close();
  }
};

/** 임시 보관은 거들 뿐이라, 실패해도 진행 중인 작업을 막지 않는다. */
export const saveConsentDraft = async (draft: ConsentDraftSnapshot) => {
  try {
    await withStore('readwrite', (store) => store.put(draft, KEY));
  } catch {
    /* 저장 공간이 없거나 비공개 모드일 수 있다. */
  }
};

export const loadConsentDraft = async (): Promise<ConsentDraftSnapshot | null> => {
  try {
    const draft = await withStore<ConsentDraftSnapshot | undefined>('readonly', (store) => store.get(KEY));
    return draft?.file && draft.analysis ? draft : null;
  } catch {
    return null;
  }
};

export const clearConsentDraft = async () => {
  try {
    await withStore('readwrite', (store) => store.delete(KEY));
  } catch {
    /* 지우지 못해도 다음 저장이 덮어쓴다. */
  }
};

/** 명단은 복구하지 않으므로, 명단이 필요한 단계면 명단 단계로 되돌린다. */
export const restoredStep = (draft: ConsentDraftSnapshot): ConsentDraftStep => (
  draft.recipientMode === 'named' && draft.step === 'sharing' ? 'recipients' : draft.step
);

export const savedAtLabel = (savedAt: string) => {
  const saved = new Date(savedAt);
  return Number.isNaN(saved.getTime())
    ? ''
    : saved.toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
};
