const DB = 'schooldoc-receipt-originals-v1';
const STORE = 'originals';
const originalKey = (ownerId: string, bookId: string, fileId: string) => JSON.stringify([ownerId, bookId, fileId]);
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('영수증 원본 저장소를 열지 못했습니다.'));
  });
}
async function transact<T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = op(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = tx.onabort = () => reject(new Error('영수증 원본을 저장하거나 읽지 못했습니다. 브라우저 저장 공간을 확인해 주세요.'));
    });
  } finally { db.close(); }
}
export const putReceiptOriginal = (ownerId: string, bookId: string, fileId: string, file: File) => transact('readwrite', s => s.put(file, originalKey(ownerId, bookId, fileId)));
export const getReceiptOriginal = (ownerId: string, bookId: string, fileId: string): Promise<File | undefined> => transact('readonly', s => s.get(originalKey(ownerId, bookId, fileId)));
export const deleteReceiptOriginal = (ownerId: string, bookId: string, fileId: string) => transact('readwrite', s => s.delete(originalKey(ownerId, bookId, fileId)));
