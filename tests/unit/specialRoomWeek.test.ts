import { describe, expect, test } from 'vitest';
import {
  addDays,
  cleanBookingLabel,
  formatWeekRange,
  indexBookings,
  indexSchoolDays,
  isPeriod,
  mondayOf,
  shiftWeek,
  toDateKey,
  weekDates,
} from '../../src/features/specialRooms/specialRoomWeek';
import type { SpecialRoomBooking } from '../../src/features/specialRooms/types';

describe('그 주의 월요일 찾기', () => {
  test('주중 아무 날이나 같은 월요일로 모인다', () => {
    // 2026-08-19는 수요일
    expect(mondayOf('2026-08-19')).toBe('2026-08-17');
    expect(mondayOf('2026-08-17')).toBe('2026-08-17');
    expect(mondayOf('2026-08-21')).toBe('2026-08-17');
  });

  test('토요일은 그 주에, 일요일은 다음 주에 붙는다', () => {
    // 주말에 열었을 때 지난 주를 보여주면 헛걸음이 된다.
    expect(mondayOf('2026-08-22')).toBe('2026-08-17'); // 토
    expect(mondayOf('2026-08-23')).toBe('2026-08-24'); // 일 → 다음 주
  });

  test('달과 해를 넘어가도 어긋나지 않는다', () => {
    expect(mondayOf('2026-03-01')).toBe('2026-03-02'); // 일요일
    expect(mondayOf('2027-01-01')).toBe('2026-12-28'); // 금요일
  });
});

describe('주 이동', () => {
  test('앞뒤로 7일씩 움직인다', () => {
    expect(shiftWeek('2026-08-17', 1)).toBe('2026-08-24');
    expect(shiftWeek('2026-08-17', -1)).toBe('2026-08-10');
  });

  test('월말을 넘어도 맞다', () => {
    expect(shiftWeek('2026-08-31', 1)).toBe('2026-09-07');
    expect(addDays('2026-02-27', 2)).toBe('2026-03-01');
  });
});

describe('주간 다섯 날', () => {
  test('월요일부터 금요일까지만 낸다', () => {
    expect(weekDates('2026-08-17')).toEqual([
      '2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20', '2026-08-21',
    ]);
  });
});

describe('주 범위 문구', () => {
  test('같은 달이면 날짜만 이어 쓴다', () => {
    expect(formatWeekRange('2026-08-17')).toBe('2026년 8월 17일 ~ 21일');
  });

  test('달을 넘으면 양쪽 달을 다 쓴다', () => {
    expect(formatWeekRange('2026-08-31')).toBe('2026년 8월 31일 ~ 9월 4일');
  });
});

describe('시간대 때문에 하루가 밀리지 않는다', () => {
  test('밤 11시에 만든 날짜도 그날로 남는다', () => {
    // toISOString()을 쓰면 UTC로 바뀌어 저녁에 하루가 밀린다. 실제로 흔한 사고다.
    expect(toDateKey(new Date(2026, 7, 19, 23, 30))).toBe('2026-08-19');
    expect(toDateKey(new Date(2026, 7, 19, 0, 5))).toBe('2026-08-19');
  });
});

describe('예약 꺼내 쓰기', () => {
  const booking = (id: string, roomId: string, date: string, period: 1 | 2): SpecialRoomBooking => ({
    id, roomId, date, period, label: `${id}반`, updatedAt: '2026-08-19T00:00:00.000Z',
  });

  test('고른 특별실 것만 담는다', () => {
    const map = indexBookings(
      [booking('a', 'room-1', '2026-08-17', 1), booking('b', 'room-2', '2026-08-17', 1)],
      'room-1',
    );
    expect(map.size).toBe(1);
    expect(map.get('2026-08-17|1')?.label).toBe('a반');
  });
});

describe('학사일정 정리', () => {
  test('같은 날 여러 행사를 모으고, 하나라도 휴업이면 쉬는 날로 본다', () => {
    const map = indexSchoolDays([
      { date: '2026-03-01', eventName: '3·1절', isOffDay: true },
      { date: '2026-03-03', eventName: '입학식', isOffDay: false },
      { date: '2026-03-03', eventName: '시업식', isOffDay: false },
    ]);
    expect(map.get('2026-03-01')).toEqual({ isOffDay: true, events: ['3·1절'] });
    expect(map.get('2026-03-03')).toEqual({ isOffDay: false, events: ['입학식', '시업식'] });
  });
});

describe('교시와 칸 값', () => {
  test('1~8교시만 받는다', () => {
    expect(isPeriod(1)).toBe(true);
    expect(isPeriod(8)).toBe(true);
    expect(isPeriod(0)).toBe(false);
    expect(isPeriod(9)).toBe(false);
  });

  test('칸 값의 공백을 정리하고 길이를 자른다', () => {
    expect(cleanBookingLabel('  6-1반   과학  ')).toBe('6-1반 과학');
    expect(cleanBookingLabel('가'.repeat(60)).length).toBe(40);
  });
});
