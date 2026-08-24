import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PRIVACY_RETENTION_SETTINGS,
  isPurgeDue,
  normalizePrivacyRetentionSettings,
  retentionDueAt,
  sortRetainedWorkItems,
  type RetainedWorkItem,
} from '../../src/features/settings/privacyRetention';
import { getDefaultRetentionMonths, privacyRetentionStorageKey } from '../../src/features/settings/privacyRetentionSettings';

const item = (patch: Partial<RetainedWorkItem> = {}): RetainedWorkItem => ({
  id: 'item',
  kind: 'data-collect',
  title: '자료 수합',
  status: 'closed',
  retentionMonths: 3,
  closedAt: '2026-01-31T09:00:00.000Z',
  recordCount: 3,
  fileCount: 2,
  ...patch,
});

describe('개인정보 보관 및 파기 정책', () => {
  it('잘못된 설정은 안전한 기본값으로 정규화한다', () => {
    expect(normalizePrivacyRetentionSettings({ defaultRetentionMonths: 0 })).toEqual(DEFAULT_PRIVACY_RETENTION_SETTINGS);
    expect(normalizePrivacyRetentionSettings({ defaultRetentionMonths: 12, purgeMode: 'automatic' })).toEqual({ defaultRetentionMonths: 12, purgeMode: 'review' });
  });

  it('월말 종료일도 다음 달 말일을 넘기지 않는다', () => {
    expect(retentionDueAt('2026-01-31T09:00:00.000Z', 1)?.toISOString()).toBe('2026-02-28T09:00:00.000Z');
  });

  it('종료된 뒤 보관기간이 지난 업무만 확인 대상으로 삼는다', () => {
    const now = new Date('2026-05-01T00:00:00.000Z');
    expect(isPurgeDue(item(), now)).toBe(true);
    expect(isPurgeDue(item({ status: 'open', closedAt: '' }), now)).toBe(false);
  });

  it('가까운 파기 예정일 순서로 정렬한다', () => {
    expect(sortRetainedWorkItems([
      item({ id: 'later', closedAt: '2026-03-01T00:00:00.000Z' }),
      item({ id: 'sooner', closedAt: '2026-01-01T00:00:00.000Z' }),
    ]).map((entry) => entry.id)).toEqual(['sooner', 'later']);
  });

  it('계정별 브라우저 기본값을 새 업무에서 읽는다', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };
    storage.setItem(privacyRetentionStorageKey('teacher-1'), JSON.stringify({ defaultRetentionMonths: 12, purgeMode: 'review' }));
    expect(getDefaultRetentionMonths('teacher-1', storage)).toBe(12);
  });
});
