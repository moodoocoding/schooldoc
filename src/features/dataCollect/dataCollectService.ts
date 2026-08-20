import { isDataCollectDemoMode } from './dataCollectConfig';
import { createRemoteDataCollection, getRemoteDataCollection, listRemoteDataCollections, updateRemoteDataCollectionStatus } from './dataCollectAdminApi';
import { submitRemoteDataCollectReview } from './dataCollectPublicApi';
import { createDataCollection as createLocal, getDataCollection as getLocal, listDataCollections as listLocal, submitDataCollectionReview as submitLocal, subscribeDataCollections, updateDataCollectionStatus as updateLocalStatus } from './dataCollectStore';
import type { DataCollection, DataCollectionDraft, DataCollectionSubmission } from './types';

export const listDataCollections = async (ownerId: string) => isDataCollectDemoMode ? listLocal(ownerId) : listRemoteDataCollections();
export const getDataCollection = async (id: string) => isDataCollectDemoMode ? getLocal(id) : getRemoteDataCollection(id);
export const createDataCollection = async (ownerId: string, draft: DataCollectionDraft, sourceFile?: File) => isDataCollectDemoMode ? createLocal(ownerId, draft, sourceFile) : createRemoteDataCollection(draft, sourceFile);
export const updateDataCollectionStatus = async (id: string, status: DataCollection['status']) => {
  if (isDataCollectDemoMode) { updateLocalStatus(id, status); return getLocal(id); }
  return updateRemoteDataCollectionStatus(id, status);
};
export const submitDataCollectionReview = async (collectionId: string, targetId: string, decision: DataCollectionSubmission['decision'], file?: File, note = '', publicToken = '', password = '', personalToken = '') => {
  if (isDataCollectDemoMode) return submitLocal(collectionId, targetId, decision, file, note);
  return submitRemoteDataCollectReview(publicToken, personalToken, decision, password, file, note);
};
export { subscribeDataCollections };
