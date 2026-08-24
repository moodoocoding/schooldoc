import { supabase } from '../../utils/supabaseClient';
import { isConsentFormsDemoMode } from '../consentForms/consentFormsConfig';
import { deleteConsentLocalDraft, getConsentLocalDrafts } from '../consentForms/consentFormsLocalStore';
import { purgeConsentForms } from '../consentForms/consentPurgeApi';
import { dataCollectOwnerId, isDataCollectDemoMode } from '../dataCollect/dataCollectConfig';
import { deleteDataCollection as deleteLocalDataCollection, listDataCollections as listLocalDataCollections } from '../dataCollect/dataCollectStore';
import { deleteRemoteDataCollection } from '../dataCollect/dataCollectAdminApi';
import {
  DEFAULT_PRIVACY_RETENTION_SETTINGS,
  normalizePrivacyRetentionSettings,
  normalizeRetentionMonths,
  type PrivacyPurgeLog,
  type PrivacyRetentionSettings,
  type RetainedWorkItem,
} from './privacyRetention';

const STORAGE_PREFIX = 'schooldoc_privacy_retention_v1:';

export const privacyRetentionStorageKey = (userId: string) => `${STORAGE_PREFIX}${userId || 'local'}`;

const readLocal = (
  userId: string,
  storage: Pick<Storage, 'getItem'> = window.localStorage,
) => {
  try {
    return normalizePrivacyRetentionSettings(JSON.parse(storage.getItem(privacyRetentionStorageKey(userId)) ?? 'null'));
  } catch {
    return DEFAULT_PRIVACY_RETENTION_SETTINGS;
  }
};

const writeLocal = (
  userId: string,
  settings: PrivacyRetentionSettings,
  storage: Pick<Storage, 'setItem'> = window.localStorage,
) => {
  try {
    storage.setItem(privacyRetentionStorageKey(userId), JSON.stringify(settings));
  } catch {
    // 편의 기본값 저장이 막혀도 개별 업무는 계속 만들 수 있어야 한다.
  }
};

export const getDefaultRetentionMonths = (
  userId: string,
  storage: Pick<Storage, 'getItem'> = window.localStorage,
) => readLocal(userId, storage).defaultRetentionMonths;

export const loadPrivacyRetentionSettings = async (userId: string) => {
  const fallback = readLocal(userId);
  if (!userId || !supabase) return fallback;
  const result = await supabase
    .from('teacher_privacy_settings')
    .select('default_retention_months, purge_mode')
    .eq('user_id', userId)
    .maybeSingle();
  if (result.error) return fallback;
  if (!result.data) return fallback;
  const settings = normalizePrivacyRetentionSettings({
    defaultRetentionMonths: result.data.default_retention_months,
    purgeMode: result.data.purge_mode,
  });
  writeLocal(userId, settings);
  return settings;
};

export const savePrivacyRetentionSettings = async (userId: string, settings: PrivacyRetentionSettings) => {
  const normalized = normalizePrivacyRetentionSettings(settings);
  if (!userId || !supabase) {
    writeLocal(userId, normalized);
    return normalized;
  }
  const result = await supabase.from('teacher_privacy_settings').upsert({
    user_id: userId,
    default_retention_months: normalized.defaultRetentionMonths,
    purge_mode: normalized.purgeMode,
  }, { onConflict: 'user_id' });
  if (result.error) throw new Error(`개인정보 보관 정책을 저장하지 못했습니다: ${result.error.message}`);
  writeLocal(userId, normalized);
  return normalized;
};

const listLocalRetainedWork = (ownerId: string): RetainedWorkItem[] => {
  const consent = isConsentFormsDemoMode ? getConsentLocalDrafts().map((form) => ({
    id: form.id,
    kind: 'consent-form' as const,
    title: form.title,
    status: form.status,
    retentionMonths: normalizeRetentionMonths(form.retentionMonths, 12),
    closedAt: form.closedAt ?? '',
    recordCount: form.responseCount,
    fileCount: form.sourcePdfDataUrl ? 1 : 0,
  })) : [];
  const collections = isDataCollectDemoMode ? listLocalDataCollections(dataCollectOwnerId(ownerId)).map((collection) => ({
    id: collection.id,
    kind: 'data-collect' as const,
    title: collection.title,
    status: collection.status,
    retentionMonths: normalizeRetentionMonths(collection.retentionMonths, 12),
    closedAt: collection.closedAt ?? '',
    recordCount: collection.submissions.length,
    fileCount: collection.submissions.filter((submission) => submission.file).length + (collection.sourceFile ? 1 : 0),
  })) : [];
  return [...consent, ...collections].filter((item) => item.status === 'closed' && item.closedAt);
};

export const listRetainedWorkItems = async (ownerId: string): Promise<RetainedWorkItem[]> => {
  if (isConsentFormsDemoMode || isDataCollectDemoMode) return listLocalRetainedWork(ownerId);
  if (!supabase || !ownerId) return [];
  const [consentResult, dataCollectResult] = await Promise.all([
    supabase.from('consent_forms').select('id, title, status, retention_months, closed_at, response_count').eq('status', 'closed'),
    supabase.from('data_collections').select('id, title, status, retention_months, closed_at').eq('status', 'closed'),
  ]);
  if (consentResult.error) throw new Error(`가정통신문 파기 일정을 불러오지 못했습니다: ${consentResult.error.message}`);
  if (dataCollectResult.error) throw new Error(`자료 수합 파기 일정을 불러오지 못했습니다: ${dataCollectResult.error.message}`);
  const consent = (consentResult.data ?? []).map((row) => ({
    id: row.id,
    kind: 'consent-form' as const,
    title: row.title,
    status: row.status as 'closed',
    retentionMonths: normalizeRetentionMonths(row.retention_months, 12),
    closedAt: row.closed_at ?? '',
    recordCount: row.response_count ?? 0,
    fileCount: 1,
  }));
  const collections = (dataCollectResult.data ?? []).map((row) => ({
    id: row.id,
    kind: 'data-collect' as const,
    title: row.title,
    status: row.status as 'closed',
    retentionMonths: normalizeRetentionMonths(row.retention_months, 12),
    closedAt: row.closed_at ?? '',
    recordCount: 0,
    fileCount: 0,
  }));
  return [...consent, ...collections].filter((item) => item.closedAt);
};

export const purgeRetainedWorkItem = async (item: RetainedWorkItem) => {
  if (item.kind === 'consent-form') {
    if (isConsentFormsDemoMode) {
      deleteConsentLocalDraft(item.id);
      return;
    }
    const result = await purgeConsentForms([item.id]);
    if (result.failed.length) throw new Error(result.failed[0].error);
    return;
  }
  if (isDataCollectDemoMode) deleteLocalDataCollection(item.id);
  else await deleteRemoteDataCollection(item.id);
};

export const listPrivacyPurgeLogs = async (): Promise<PrivacyPurgeLog[]> => {
  if (!supabase || isConsentFormsDemoMode || isDataCollectDemoMode) return [];
  const result = await supabase
    .from('privacy_purge_log')
    .select('id, resource_kind, record_count, file_count, purged_at')
    .order('purged_at', { ascending: false })
    .limit(10);
  if (result.error) return [];
  return (result.data ?? []).map((row) => ({
    id: row.id,
    resourceKind: row.resource_kind as PrivacyPurgeLog['resourceKind'],
    recordCount: row.record_count,
    fileCount: row.file_count,
    purgedAt: row.purged_at,
  }));
};
