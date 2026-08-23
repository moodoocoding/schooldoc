import { parseDateKey } from './specialRoomWeek';
import type { SpecialRoomBooking } from './types';

/**
 * 교시 수와 토요일 사용 여부를 바꿀 때, 가려지는 예약을 미리 센다.
 *
 * 학교마다 하루가 다르다. 초등은 6교시가 끝이고 고등은 방과후까지 쓴다. 그래서 예약표마다
 * 정하게 했는데, **줄이는 쪽이 문제다.** 8교시를 6교시로 줄이면 7·8교시에 이미 있던 예약이
 * 표에서 사라진다. 아무 말 없이 사라지면 담당자는 자기가 지운 줄도 모른다.
 *
 * 그래서 지우지 않고 감추기만 한다. 다시 늘리면 그대로 나타난다. 지우면 되돌릴 수 없지만
 * 감추는 것은 되돌릴 수 있다. 대신 몇 건이 가려지는지 숫자로 알리고 결정은 사람이 한다.
 *
 * Supabase를 타는 경로라 데모 모드 e2e로는 덮이지 않는다. 세는 규칙을 여기 꺼내 둔다.
 */

export interface ScheduleShape {
  periodCount: number;
  includeSaturday: boolean;
}

export interface HiddenBookings {
  /** 교시를 줄여서 가려지는 예약. */
  byPeriod: SpecialRoomBooking[];
  /** 토요일을 꺼서 가려지는 예약. */
  bySaturday: SpecialRoomBooking[];
  /** 둘을 합친 수. 같은 예약이 두 이유로 가려질 수 있어 중복을 뺀다. */
  total: number;
}

const isSaturday = (dateKey: string) => parseDateKey(dateKey).getDay() === 6;

export const hiddenByShape = (
  bookings: SpecialRoomBooking[], next: ScheduleShape,
): HiddenBookings => {
  const byPeriod = bookings.filter((booking) => booking.period > next.periodCount);
  const bySaturday = next.includeSaturday ? [] : bookings.filter((booking) => isSaturday(booking.date));
  const ids = new Set([...byPeriod, ...bySaturday].map((booking) => booking.id));
  return { byPeriod, bySaturday, total: ids.size };
};

/**
 * 가려지는 예약을 사람이 읽을 말로 바꾼다.
 *
 * 몇 교시가 가려지는지까지 적는다. "3건이 가려집니다"만으로는 어디를 확인해야 할지 모른다.
 */
export const hiddenBookingsNotice = (hidden: HiddenBookings): string => {
  if (hidden.total === 0) return '';
  const parts: string[] = [];

  if (hidden.byPeriod.length > 0) {
    const periods = [...new Set(hidden.byPeriod.map((booking) => booking.period))].sort((a, b) => a - b);
    parts.push(`${periods.join('·')}교시 예약 ${hidden.byPeriod.length}건`);
  }
  if (hidden.bySaturday.length > 0) {
    parts.push(`토요일 예약 ${hidden.bySaturday.length}건`);
  }

  return `${parts.join('과 ')}이 표에서 보이지 않게 됩니다. 지워지는 것은 아니라, 되돌리면 다시 나타납니다.`;
};

/** 바꾸려는 모양이 지금과 다른가. 같으면 저장하러 가지 않는다. */
export const shapeChanged = (saved: ScheduleShape, next: ScheduleShape) => (
  saved.periodCount !== next.periodCount || saved.includeSaturday !== next.includeSaturday
);
