import { expect, test } from 'vitest';
import { formatPlanTiming, parsePlanTiming } from '../../src/features/schoolDocuments/planTiming';

test('달력에서 고른 기간을 편람 날짜 표기로 저장하고 다시 달력 값으로 되돌린다', () => {
  expect(formatPlanTiming({ start: '2026-11-23', end: '2026-11-27' })).toBe('2026. 11. 23.∼11. 27.');
  expect(formatPlanTiming({ start: '2026-12-28', end: '2027-01-08' })).toBe('2026. 12. 28.∼2027. 1. 8.');
  expect(formatPlanTiming({ start: '2026-11-02', end: '' })).toBe('2026. 11. 2.');
  // 종료일이 시작일보다 앞서거나 같으면 하루로 본다.
  expect(formatPlanTiming({ start: '2026-11-02', end: '2026-11-02' })).toBe('2026. 11. 2.');
  expect(formatPlanTiming({ start: '', end: '2026-11-06' })).toBe('');
  for (const range of [{ start: '2026-11-23', end: '2026-11-27' }, { start: '2026-12-28', end: '2027-01-08' }, { start: '2026-11-02', end: '' }, { start: '', end: '' }])
    expect(parsePlanTiming(formatPlanTiming(range))).toEqual(range);
  // 예전 자유 입력은 달력 값으로 바꾸지 않는다.
  expect(parsePlanTiming('접수 2026년 11월 23~27일, 결과 12월 2일까지')).toBeNull();
});
