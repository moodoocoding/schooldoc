import type { ConsentLocalDraft } from './types';

/**
 * 보유 기간이 지난 수합을 골라 정리 화면에 모은다.
 * 자동으로 지우지는 않는다. 학교 자료가 예고 없이 사라지는 편이 더 위험하다.
 */
export const DEFAULT_RETENTION_MONTHS = 12;

export const retentionMonthsOf = (form: Pick<ConsentLocalDraft, 'retentionMonths'>) => {
  const months = form.retentionMonths;
  return Number.isInteger(months) && (months as number) > 0 ? months as number : DEFAULT_RETENTION_MONTHS;
};

/** 만든 날로부터 보유 개월이 지난 시점. 말일 넘침은 자바스크립트 규칙을 그대로 따른다. */
export const retentionDeadline = (createdAt: string, months: number) => {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return null;
  const deadline = new Date(created);
  deadline.setMonth(deadline.getMonth() + months);
  return deadline;
};

export const isPastRetention = (form: ConsentLocalDraft, now: Date) => {
  const deadline = retentionDeadline(form.createdAt, retentionMonthsOf(form));
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
