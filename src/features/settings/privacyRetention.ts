import { MISSION_RETENTION_DAYS } from '../../../supabase/functions/_shared/classMissions';

export const DEFAULT_RETENTION_MONTHS = 3;

export const RETENTION_MONTH_OPTIONS = [1, 3, 12] as const;

export interface PrivacyRetentionSettings {
  defaultRetentionMonths: number;
  purgeMode: 'review';
}

export const DEFAULT_PRIVACY_RETENTION_SETTINGS: PrivacyRetentionSettings = {
  defaultRetentionMonths: DEFAULT_RETENTION_MONTHS,
  purgeMode: 'review',
};

export interface RetainedWorkItem {
  id: string;
  kind: 'consent-form' | 'data-collect' | 'class-mission';
  boardId?: string;
  title: string;
  status: 'open' | 'closed';
  retentionMonths: number;
  closedAt: string;
  recordCount: number;
  fileCount: number;
}

export interface PrivacyPurgeLog {
  id: string;
  resourceKind: RetainedWorkItem['kind'];
  recordCount: number;
  fileCount: number;
  purgedAt: string;
}

export const normalizeRetentionMonths = (value: unknown, fallback = DEFAULT_RETENTION_MONTHS) => {
  const months = Number(value);
  return Number.isInteger(months) && months >= 1 && months <= 120 ? months : fallback;
};

export const normalizePrivacyRetentionSettings = (value: unknown): PrivacyRetentionSettings => {
  if (!value || typeof value !== 'object') return DEFAULT_PRIVACY_RETENTION_SETTINGS;
  const candidate = value as Partial<PrivacyRetentionSettings>;
  return {
    defaultRetentionMonths: normalizeRetentionMonths(candidate.defaultRetentionMonths),
    purgeMode: 'review',
  };
};

/** 월말을 넘기지 않고 종료일 기준으로 보관 개월을 더한다. */
export const retentionDueAt = (closedAt: string, retentionMonths: number) => {
  const closed = new Date(closedAt);
  if (Number.isNaN(closed.getTime())) return null;
  const due = new Date(closed);
  const day = due.getDate();
  due.setDate(1);
  due.setMonth(due.getMonth() + normalizeRetentionMonths(retentionMonths));
  const lastDay = new Date(due.getFullYear(), due.getMonth() + 1, 0).getDate();
  due.setDate(Math.min(day, lastDay));
  return due;
};

export const retainedWorkDueAt = (item: RetainedWorkItem) => {
  if (item.kind !== 'class-mission') return retentionDueAt(item.closedAt, item.retentionMonths);
  const closedAt = Date.parse(item.closedAt);
  return Number.isFinite(closedAt) ? new Date(closedAt + MISSION_RETENTION_DAYS * 24 * 60 * 60 * 1000) : null;
};

export const isPurgeDue = (item: RetainedWorkItem, now = new Date()) => {
  if (item.status !== 'closed' || !item.closedAt) return false;
  const due = retainedWorkDueAt(item);
  return due ? due.getTime() <= now.getTime() : false;
};

export const sortRetainedWorkItems = (items: RetainedWorkItem[]) => items.toSorted((a, b) => {
  const aDue = retainedWorkDueAt(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const bDue = retainedWorkDueAt(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  return aDue - bDue;
});
