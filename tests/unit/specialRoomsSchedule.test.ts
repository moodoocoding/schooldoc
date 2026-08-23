import { describe, expect, test } from 'vitest';
import {
  hiddenBookingsNotice,
  hiddenByShape,
  shapeChanged,
} from '../../src/features/specialRooms/specialRoomsSchedule';
import type { Period, SpecialRoomBooking } from '../../src/features/specialRooms/types';

/**
 * 교시를 줄이거나 토요일을 끄면 이미 있던 예약이 표에서 사라진다.
 *
 * 아무 말 없이 사라지면 담당자는 자기가 지운 줄도 모른다. 지우지 않고 감추기만 하되,
 * 몇 건이 가려지는지 숫자로 알리고 결정은 사람이 한다.
 */
const booking = (id: string, date: string, period: Period): SpecialRoomBooking => ({
  id, roomId: 'room-1', date, period, label: `${id}반`, updatedAt: '2026-08-24T00:00:00.000Z',
});

// 2026-08-24는 월요일, 2026-08-29는 토요일
const 월1 = booking('a', '2026-08-24', 1);
const 화7 = booking('b', '2026-08-25', 7);
const 목8 = booking('c', '2026-08-27', 8);
const 토3 = booking('d', '2026-08-29', 3);
const 토8 = booking('e', '2026-08-29', 8);

describe('가려지는 예약을 센다', () => {
  test('줄이지 않으면 가려지는 것이 없다', () => {
    const hidden = hiddenByShape([월1, 화7, 목8], { periodCount: 8, includeSaturday: false });
    expect(hidden.total).toBe(0);
    expect(hiddenBookingsNotice(hidden)).toBe('');
  });

  test('교시를 줄이면 그 너머 예약이 가려진다', () => {
    const hidden = hiddenByShape([월1, 화7, 목8], { periodCount: 6, includeSaturday: false });
    expect(hidden.byPeriod.map((b) => b.id)).toEqual(['b', 'c']);
    expect(hidden.total).toBe(2);
  });

  test('교시를 늘리면 가려지는 것이 없다', () => {
    expect(hiddenByShape([월1, 화7, 목8], { periodCount: 9, includeSaturday: false }).total).toBe(0);
  });

  test('토요일을 끄면 토요일 예약이 가려진다', () => {
    const hidden = hiddenByShape([월1, 토3], { periodCount: 8, includeSaturday: false });
    expect(hidden.bySaturday.map((b) => b.id)).toEqual(['d']);
    expect(hidden.total).toBe(1);
  });

  test('토요일을 켜 두면 토요일 예약은 그대로다', () => {
    expect(hiddenByShape([월1, 토3], { periodCount: 8, includeSaturday: true }).total).toBe(0);
  });

  test('두 이유로 함께 가려지는 예약을 두 번 세지 않는다', () => {
    // 토요일 8교시는 교시로도 토요일로도 가려진다. 담당자에게는 한 건이다.
    const hidden = hiddenByShape([토8], { periodCount: 6, includeSaturday: false });
    expect(hidden.byPeriod).toHaveLength(1);
    expect(hidden.bySaturday).toHaveLength(1);
    expect(hidden.total).toBe(1);
  });
});

describe('가려지는 예약을 사람이 읽을 말로 바꾼다', () => {
  test('어느 교시가 가려지는지까지 적는다', () => {
    // "3건이 가려집니다"만으로는 어디를 확인해야 할지 모른다.
    const notice = hiddenBookingsNotice(hiddenByShape([화7, 목8], { periodCount: 6, includeSaturday: false }));
    expect(notice).toContain('7·8교시 예약 2건');
    expect(notice).toContain('되돌리면 다시 나타납니다');
  });

  test('같은 교시가 여러 건이어도 교시는 한 번만 적는다', () => {
    const 금7 = booking('f', '2026-08-28', 7);
    const notice = hiddenBookingsNotice(hiddenByShape([화7, 금7], { periodCount: 6, includeSaturday: false }));
    expect(notice).toContain('7교시 예약 2건');
  });

  test('교시와 토요일이 함께 걸리면 둘 다 적는다', () => {
    const notice = hiddenBookingsNotice(hiddenByShape([화7, 토3], { periodCount: 6, includeSaturday: false }));
    expect(notice).toContain('7교시 예약 1건');
    expect(notice).toContain('토요일 예약 1건');
  });

  test('지워지는 것이 아니라는 말을 반드시 넣는다', () => {
    // 이 한 줄이 없으면 담당자가 줄이기를 망설인다.
    const notice = hiddenBookingsNotice(hiddenByShape([토3], { periodCount: 8, includeSaturday: false }));
    expect(notice).toContain('지워지는 것은 아니라');
  });
});

describe('바뀐 것이 있을 때만 저장한다', () => {
  test('같으면 바뀌지 않은 것으로 본다', () => {
    expect(shapeChanged({ periodCount: 8, includeSaturday: false }, { periodCount: 8, includeSaturday: false })).toBe(false);
  });

  test('교시 수나 토요일 중 하나만 달라도 바뀐 것이다', () => {
    expect(shapeChanged({ periodCount: 8, includeSaturday: false }, { periodCount: 6, includeSaturday: false })).toBe(true);
    expect(shapeChanged({ periodCount: 8, includeSaturday: false }, { periodCount: 8, includeSaturday: true })).toBe(true);
  });
});
