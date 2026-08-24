import type { ConsentLocalDraft } from './types';
import { retentionDueAt } from '../settings/privacyRetention';

/**
 * 보유 기간이 지난 수합을 골라 정리 화면에 모은다.
 * 자동으로 지우지는 않는다. 학교 자료가 예고 없이 사라지는 편이 더 위험하다.
 */
export const DEFAULT_RETENTION_MONTHS = 12;

export const retentionMonthsOf = (form: Pick<ConsentLocalDraft, 'retentionMonths'>) => {
  const months = form.retentionMonths;
  return Number.isInteger(months) && (months as number) > 0 ? months as number : DEFAULT_RETENTION_MONTHS;
};

/** 업무 종료 시점부터 보유 개월을 더한다. */
export const retentionDeadline = retentionDueAt;

export const isPastRetention = (form: ConsentLocalDraft, now: Date) => {
  if (form.status !== 'closed' || !form.closedAt) return false;
  const deadline = retentionDeadline(form.closedAt, retentionMonthsOf(form));
  return deadline ? deadline.getTime() <= now.getTime() : false;
};

export const selectPurgeCandidates = (forms: ConsentLocalDraft[], now: Date) => (
  forms.filter((form) => isPastRetention(form, now))
);

/** 확인창에 사라지는 총량을 숫자로 보여주기 위한 요약. */
export const summarizePurge = (forms: ConsentLocalDraft[]) => ({
  forms: forms.length,
  responses: forms.reduce((total, form) => total + (form.responseCount ?? 0), 0),
});
