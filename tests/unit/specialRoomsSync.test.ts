import { describe, expect, test, vi } from 'vitest';
import {
  koreanDate,
  newBookingAllowed,
  repeatRangeError,
  validDate,
} from '../../supabase/functions/_shared/specialRooms';
import { applyCellEvent } from '../../src/features/specialRooms/specialRoomsRealtime';
import { formatWeekRange } from '../../src/features/specialRooms/specialRoomWeek';
import type {
  SpecialRoomBoard,
  SpecialRoomBooking,
} from '../../src/features/specialRooms/types';
const booking: SpecialRoomBooking = {
  id: 'a',
  roomId: 'r',
  date: '2026-10-05',
  period: 9,
  label: '가상 학급',
  updatedAt: '2026-10-05T00:00:00Z',
  revision: 1,
};
const board = {
  selectedRoomId: 'r',
  weekStart: '2026-10-05',
  scopeRevision: 2,
  bookings: [booking],
} as SpecialRoomBoard;
describe('특별실 범위 동기화와 한국 날짜', () => {
  test('연속 셀 이벤트를 재조회 없이 적용하고 중복을 무시한다', () => {
    const event = {
      roomId: 'r',
      weekStart: '2026-10-05',
      scopeRevision: 3,
      upserts: [{ ...booking, revision: 2, label: '수정' }],
      deletedIds: [],
    };
    const result = applyCellEvent(board, event);
    expect(result.gap).toBe(false);
    expect(result.board.bookings[0].label).toBe('수정');
    expect(applyCellEvent(result.board, event).board).toBe(result.board);
  });
  test('버전 누락은 표를 임의로 바꾸지 않고 복구 조회를 요구한다', () => {
    const result = applyCellEvent(board, {
      roomId: 'r',
      weekStart: '2026-10-05',
      scopeRevision: 4,
      upserts: [],
      deletedIds: ['a'],
    });
    expect(result.gap).toBe(true);
    expect(result.board).toBe(board);
  });
  test('다른 실/주의 이벤트와 예전 삭제 ID는 현재 재생성된 예약을 지우지 않는다', () => {
    expect(
      applyCellEvent(board, {
        roomId: 'other',
        weekStart: '2026-10-05',
        scopeRevision: 3,
        upserts: [],
        deletedIds: ['a'],
      }).board,
    ).toBe(board);
    expect(
      applyCellEvent(board, {
        roomId: 'r',
        weekStart: '2026-10-05',
        scopeRevision: 3,
        upserts: [],
        deletedIds: ['old'],
      }).board.bookings,
    ).toHaveLength(1);
  });
  test('같은 순간은 기기 시간대와 무관하게 한국 날짜다', () => {
    expect(koreanDate(new Date('2026-10-04T15:01:00Z'))).toBe('2026-10-05');
  });
  test('실제 달력 날짜·교시·요일과 반복 상한을 검증한다', () => {
    expect(validDate('2026-02-29')).toBe(false);
    expect(validDate('2028-02-29')).toBe(true);
    expect(
      newBookingAllowed('2026-10-10', 9, {
        periodCount: 9,
        includeSaturday: true,
      }),
    ).toBe(true);
    expect(
      newBookingAllowed('2026-10-10', 9, {
        periodCount: 9,
        includeSaturday: false,
      }),
    ).toBe(false);
    expect(
      newBookingAllowed('2026-10-11', 1, {
        periodCount: 9,
        includeSaturday: true,
      }),
    ).toBe(false);
    expect(repeatRangeError('2026-10-05', '2027-10-04')).toContain('52주');
  });
  test('토요일과 연도 경계를 범위 제목에 포함한다', () => {
    expect(formatWeekRange('2026-12-28', true)).toBe(
      '2026년 12월 28일 ~ 2027년 1월 2일',
    );
  });
  test('현재 주 전체 건수는 선택 실의 실제 추가/삭제만큼 바뀐다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-05T00:00:00Z'));
    try {
      const current = {
        ...board,
        thisWeekBookingCount: 100,
        includeSaturday: true,
      };
      const added = applyCellEvent(current, {
        roomId: 'r',
        weekStart: '2026-10-05',
        scopeRevision: 3,
        upserts: [{ ...booking, id: 'new', period: 1 }],
        deletedIds: [],
      });
      expect(added.board.thisWeekBookingCount).toBe(101);
      const removed = applyCellEvent(added.board, {
        roomId: 'r',
        weekStart: '2026-10-05',
        scopeRevision: 4,
        upserts: [],
        deletedIds: ['new'],
      });
      expect(removed.board.thisWeekBookingCount).toBe(100);
    } finally {
      vi.useRealTimers();
    }
  });
});
