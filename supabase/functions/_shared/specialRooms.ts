/** 특별실 전용 날짜·운영 규칙. 날짜 문자열과 한국의 현재 날짜를 구분한다. */
export const validDate = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value + 'T00:00:00Z')) &&
  new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
export const koreanDate = (instant = new Date()) =>
  new Date(instant.getTime() + 9 * 3600000).toISOString().slice(0, 10);
export const datePlus = (key: string, days: number) => {
  if (!validDate(key)) throw new Error('날짜가 올바르지 않습니다.');
  const date = new Date(key + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
export const weekStart = (key: string) => {
  const day = new Date(key + 'T00:00:00Z').getUTCDay();
  return datePlus(key, day === 0 ? 1 : 1 - day);
};
export const repeatRangeError = (start: string, end: string) => {
  if (!validDate(start) || !validDate(end)) return '날짜가 올바르지 않습니다.';
  if (end < start) return '마지막 날짜는 시작 날짜 이후로 선택해 주세요.';
  if (end >= datePlus(start, 52 * 7)) {
    return '반복 예약은 최대 52주까지 가능합니다.';
  }
  return '';
};
export const newBookingAllowed = (
  date: string,
  period: number,
  shape: { periodCount: number; includeSaturday: boolean },
) => {
  const day = new Date(date + 'T00:00:00Z').getUTCDay();
  return validDate(date) && Number.isInteger(period) && period >= 1 &&
    period <= shape.periodCount &&
    day !== 0 && (day !== 6 || shape.includeSaturday);
};
