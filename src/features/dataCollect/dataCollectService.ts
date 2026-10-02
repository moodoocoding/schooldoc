import { isDataCollectDemoMode } from './dataCollectConfig';
import {
  createRemoteDataCollection,
  listRemoteDataCollections,
} from './dataCollectAdminApi';
import {
  createDataCollection as createLocal,
  getDataCollection as getLocal,
  listDataCollections as listLocal,
  subscribeDataCollections,
  updateDataCollectionStatus as updateLocalStatus,
  updateDataCollectionDue as updateLocalDue,
} from './dataCollectStore';
import type {
  DataCollection,
  DataCollectionDraft,
} from './types';

export const listDataCollections = async (ownerId: string) =>
  isDataCollectDemoMode ? listLocal(ownerId) : listRemoteDataCollections();
export const createDataCollection = async (
  ownerId: string,
  draft: DataCollectionDraft,
  sourceFile?: File,
) =>
  isDataCollectDemoMode
    ? createLocal(ownerId, draft, sourceFile)
    : createRemoteDataCollection(draft, sourceFile);
export { subscribeDataCollections };

import {
  getRemoteDataCollectionDownload,
  getRemoteDataCollectionExport,
  getRemoteDataCollectionHistory,
  getRemoteDataCollectionOverview,
  listRemoteDataCollectionSummaries,
  updateRemoteDataCollectionDue,
} from './dataCollectAdminApi';
import type {
  DataCollectionExport,
  DataCollectionListCursor,
  DataCollectionOverview,
  DataCollectionSummary,
  DataCollectionTargetStatus,
} from './types';

const queryCache = new Map<
  string,
  { owner: string; time: number; value: unknown }
>();
const inFlight = new Map<string, Promise<unknown>>();
let cacheOwner = '';
let cacheEpoch = 0;
export const clearDataCollectQueryCache = () => {
  queryCache.clear();
  inFlight.clear();
  cacheOwner = '';
  cacheEpoch++;
};
const cached = async <T>(
  owner: string,
  key: string,
  load: () => Promise<T>,
  force = false,
): Promise<T> => {
  if (cacheOwner !== owner) {
    clearDataCollectQueryCache();
    cacheOwner = owner;
  }
  const full = owner + ':' + key,
    prior = queryCache.get(full);
  if (!force && prior && Date.now() - prior.time < 15_000)
    return prior.value as T;
  if (inFlight.has(full)) return inFlight.get(full) as Promise<T>;
  const epoch = cacheEpoch;
  const pending = load()
    .then((value) => {
      if (cacheOwner === owner && cacheEpoch === epoch)
        queryCache.set(full, { owner, time: Date.now(), value });
      return value;
    })
    .finally(() => {
      if (inFlight.get(full) === pending) inFlight.delete(full);
    });
  inFlight.set(full, pending);
  return pending;
};
const demoSummary = (c: DataCollection): DataCollectionSummary => {
  const latest = new Map(c.submissions.map((s) => [s.targetId, s]));
  return {
    id: c.id,
    title: c.title,
    mode: c.mode,
    status: c.status,
    dueAt: c.dueAt,
    createdAt: c.createdAt,
    hasTemplate: Boolean(c.sourceFile),
    total: c.targets.length,
    responded: latest.size,
    needsRepair: 0,
    confirmed: [...latest.values()].filter((s) => s.decision === 'confirmed')
      .length,
    corrected: [...latest.values()].filter((s) => s.decision === 'corrected')
      .length,
    submitted: [...latest.values()].filter((s) => s.decision === 'submitted')
      .length,
  };
};
const demoRows = (
  c: DataCollection,
  detail = false,
): DataCollectionTargetStatus[] => {
  const latest = new Map(c.submissions.map((s) => [s.targetId, s]));
  return c.targets.map((t) => {
    const s = latest.get(t.id);
    return {
      id: t.id,
      rowNumber: t.rowNumber,
      label: t.label,
      owner: t.owner,
      needsRepair: false,
      submission: s
        ? {
            id: s.id,
            decision: s.decision,
            revision: s.revision,
            uploadedAt: s.uploadedAt,
            hasNote: Boolean(s.note),
            hasFile: Boolean(s.file),
            byteSize: s.file?.byteSize ?? 0,
          }
        : null,
      ...(detail
        ? { note: s?.note ?? '', fileName: s?.file?.originalName ?? '' }
        : {}),
    };
  });
};
const ownDemo = (id: string, owner: string) => {
  const c = getLocal(id);
  if (!c || c.ownerId !== owner)
    throw new Error('자료 수합을 찾을 수 없습니다.');
  return c;
};
export const listDataCollectionSummaries = (
  owner: string,
  cursor?: DataCollectionListCursor,
  force = false,
) =>
  cached(
    owner,
    'list:' + JSON.stringify(cursor ?? null),
    async () => {
      if (!isDataCollectDemoMode)
        return listRemoteDataCollectionSummaries(cursor);
      const all = listLocal(owner)
        .toSorted(
          (a, b) =>
            b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
        )
        .filter(
          (c) =>
            !cursor ||
            c.createdAt < cursor.before ||
            (c.createdAt === cursor.before && c.id < cursor.beforeId),
        );
      return {
        collections: all.slice(0, 20).map(demoSummary),
        nextCursor:
          all.length > 20
            ? { before: all[19].createdAt, beforeId: all[19].id }
            : null,
      };
    },
    force,
  );
export const getDataCollectionOverview = (
  owner: string,
  id: string,
  after = 0,
  unsubmitted = false,
  force = false,
) =>
  cached(
    owner,
    'overview:' + id + ':' + after + ':' + unsubmitted,
    async (): Promise<DataCollectionOverview> => {
      if (!isDataCollectDemoMode)
        return getRemoteDataCollectionOverview(id, after, unsubmitted);
      const c = ownDemo(id, owner),
        rows = demoRows(c).filter(
          (t) => t.rowNumber > after && (!unsubmitted || !t.submission),
        );
      return {
        collection: {
          ...demoSummary(c),
          publicToken: c.publicToken,
          description: c.description,
          allowResubmit: c.allowResubmit,
          templateName: c.sourceFile?.originalName ?? '',
          closedAt: c.closedAt ?? '',
          retentionMonths: c.retentionMonths,
        },
        targets: rows.slice(0, 50),
        nextAfter: rows.length > 50 ? rows[49].rowNumber : null,
      };
    },
    force,
  );
export const getDataCollectionHistory = async (
  owner: string,
  id: string,
  targetId: string,
  beforeRevision?: number,
) => {
  if (!isDataCollectDemoMode)
    return getRemoteDataCollectionHistory(id, targetId, beforeRevision);
  const c = ownDemo(id, owner);
  const all = c.submissions
    .filter(
      (s) =>
        s.targetId === targetId &&
        (!beforeRevision || s.revision < beforeRevision),
    )
    .toSorted((a, b) => b.revision - a.revision);
  return {
    submissions: all.slice(0, 10).map((s) => ({
      id: s.id,
      targetId: s.targetId,
      decision: s.decision,
      revision: s.revision,
      note: s.note,
      uploadedAt: s.uploadedAt,
      hasFile: Boolean(s.file),
      fileName: s.file?.originalName ?? '',
      byteSize: s.file?.byteSize ?? 0,
    })),
    nextRevision: all.length > 10 ? all[9].revision : null,
  };
};
export const getDataCollectionDownload = async (
  owner: string,
  id: string,
  fileId?: string,
) => {
  if (!isDataCollectDemoMode)
    return getRemoteDataCollectionDownload(id, fileId);
  const c = ownDemo(id, owner),
    file = fileId
      ? c.submissions.find((s) => s.id === fileId)?.file
      : c.sourceFile;
  if (!file) throw new Error('다운로드할 파일이 없습니다.');
  return { url: file.dataUrl, name: file.originalName };
};
export const getDataCollectionExport = async (
  owner: string,
  id: string,
): Promise<DataCollectionExport> => {
  if (!isDataCollectDemoMode) return getRemoteDataCollectionExport(id);
  const c = ownDemo(id, owner);
  return {
    title: c.title,
    hasTemplate: Boolean(c.sourceFile),
    exportedAt: new Date().toISOString(),
    rows: demoRows(c, true),
  };
};
export const updateDataCollectionDue = async (
  owner: string,
  id: string,
  dueAt: string,
) => {
  if (
    dueAt &&
    (Number.isNaN(Date.parse(dueAt)) || Date.parse(dueAt) <= Date.now())
  )
    throw new Error('마감 시각은 현재보다 뒤로 설정해 주세요.');
  clearDataCollectQueryCache();
  if (!isDataCollectDemoMode) return updateRemoteDataCollectionDue(id, dueAt);
  const c = ownDemo(id, owner);
  updateLocalDue(c.id, dueAt);
  return getDataCollectionOverview(owner, id, 0, false, true);
};

import { setRemoteDataCollectionStatus } from './dataCollectAdminApi';
export const setDataCollectionStatus = async (
  owner: string,
  id: string,
  status: 'open' | 'closed',
) => {
  clearDataCollectQueryCache();
  if (!isDataCollectDemoMode) return setRemoteDataCollectionStatus(id, status);
  const c = ownDemo(id, owner);
  updateLocalStatus(c.id, status);
  return getDataCollectionOverview(owner, id, 0, false, true);
};

import { cleanupRemoteDataCollectionUploads } from './dataCollectAdminApi';
export const cleanupDataCollectionUploads = async (
  owner: string,
  id: string,
) => {
  if (isDataCollectDemoMode) {
    ownDemo(id, owner);
    return { removed: 0, failed: 0 };
  }
  return cleanupRemoteDataCollectionUploads(id);
};

import { cleanupRemoteDataCollectTemplates } from './dataCollectAdminApi';
export const cleanupDataCollectTemplates = async () =>
  isDataCollectDemoMode
    ? { removed: 0, failed: 0 }
    : cleanupRemoteDataCollectTemplates();
