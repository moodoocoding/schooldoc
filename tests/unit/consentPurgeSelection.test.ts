import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RETENTION_MONTHS,
  isPastRetention,
  retentionDeadline,
  retentionMonthsOf,
  selectPurgeCandidates,
  summarizePurge,
} from '../../src/features/consentForms/consentPurgeSelection';
import type { ConsentLocalDraft } from '../../src/features/consentForms/types';

const form = (patch: Partial<ConsentLocalDraft> = {}): ConsentLocalDraft => ({
  id: 'form', title: '동의서', fileName: 'a.pdf', fieldCount: 1, recipientMode: 'open', recipientCount: 0,
  createdAt: '2025-01-15T00:00:00.000Z', description: '', fields: [], publicToken: 'token', deadline: '',
  passwordEnabled: false, passwordHash: '', allowResubmission: false, responseCount: 0, status: 'open', ...patch,
});

const now = new Date('2026-08-17T00:00:00.000Z');

describe('보유 기간이 지난 수합 고르기', () => {
  it('설정이 없으면 기본 보관 개월을 쓴다', () => {
    expect(retentionMonthsOf(form())).toBe(DEFAULT_RETENTION_MONTHS);
    expect(retentionMonthsOf(form({ retentionMonths: 0 }))).toBe(DEFAULT_RETENTION_MONTHS);
    expect(retentionMonthsOf(form({ retentionMonths: 24 }))).toBe(24);
  });

  it('만든 날에 보관 개월을 더해 기한을 잡는다', () => {
    expect(retentionDeadline('2026-01-15T00:00:00.000Z', 12)?.toISOString()).toBe('2027-01-15T00:00:00.000Z');
    expect(retentionDeadline('2026-01-15T00:00:00.000Z', 6)?.toISOString()).toBe('2026-07-15T00:00:00.000Z');
  });

  it('만든 날을 읽을 수 없으면 대상으로 삼지 않는다', () => {
    expect(retentionDeadline('언제인지 모름', 12)).toBeNull();
    expect(isPastRetention(form({ createdAt: '언제인지 모름' }), now)).toBe(false);
  });

  it('기한이 지난 것만 고른다', () => {
    const old = form({ id: 'old', createdAt: '2025-01-15T00:00:00.000Z' });
    const recent = form({ id: 'recent', createdAt: '2026-08-01T00:00:00.000Z' });

    expect(isPastRetention(old, now)).toBe(true);
    expect(isPastRetention(recent, now)).toBe(false);
    expect(selectPurgeCandidates([old, recent], now).map((entry) => entry.id)).toEqual(['old']);
  });

  it('보관 개월을 늘리면 대상에서 빠진다', () => {
    const kept = form({ createdAt: '2025-01-15T00:00:00.000Z', retentionMonths: 36 });
    expect(isPastRetention(kept, now)).toBe(false);
  });

  it('사라지는 총량을 합산한다', () => {
    const summary = summarizePurge([form({ responseCount: 12 }), form({ responseCount: 3 })]);
    expect(summary).toEqual({ forms: 2, responses: 15 });
    expect(summarizePurge([])).toEqual({ forms: 0, responses: 0 });
  });
});
