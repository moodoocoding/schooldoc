import { PERIODS, type Period, type SchoolDay, type SpecialRoomBooking } from './types';

/**
 * 주간 표의 날짜 계산.
 *
 * 시간대와 월말·연말이 얽혀 실수가 나기 쉬운 곳이라 화면에서 떼어내 여기에 모았다.
 * 날짜는 전부 `YYYY-MM-DD` 문자열로 다룬다. Date 객체를 주고받으면 시간대에 따라 하루가
 * 밀린다. 실제로 흔한 사고다.
 */
export const WEEKDAYS = ['월', '화', '수', '목', '금'] as const;

/** 로컬 기준 YYYY-MM-DD. toISOString()은 UTC라 저녁에 하루가 밀린다. */
export const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseDateKey = (key: string) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
};

/** 그 날짜가 속한 주의 월요일. 일요일은 지난 주로 보내지 않고 다음 월요일로 붙인다. */
export const mondayOf = (key: string) => {
  const date = parseDateKey(key);
  const weekday = date.getDay(); // 0=일 … 6=토
  const offset = weekday === 0 ? 1 : 1 - weekday;
  date.setDate(date.getDate() + offset);
  return toDateKey(date);
};

export const addDays = (key: string, days: number) => {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
};

export const shiftWeek = (mondayKey: string, weeks: number) => addDays(mondayKey, weeks * 7);

/** 월~금 다섯 날. 주말은 학교 수업이 없어 표에 넣지 않는다. */
export const weekDates = (mondayKey: string) => (
  WEEKDAYS.map((_, index) => addDays(mondayKey, index))
);

export const formatWeekRange = (mondayKey: string) => {
  const start = parseDateKey(mondayKey);
  const end = parseDateKey(addDays(mondayKey, 4));
  const month = (date: Date) => `${date.getMonth() + 1}월 ${date.getDate()}일`;
  return start.getMonth() === end.getMonth()
    ? `${start.getFullYear()}년 ${start.getMonth() + 1}월 ${start.getDate()}일 ~ ${end.getDate()}일`
    : `${start.getFullYear()}년 ${month(start)} ~ ${month(end)}`;
};

export const formatDayLabel = (key: string) => {
  const date = parseDateKey(key);
  return `${date.getMonth() + 1}/${date.getDate()}`;
};

/** 예약을 `날짜|교시`로 꺼내 쓸 수 있게 정리한다. 한 칸을 그릴 때마다 훑지 않기 위해서다. */
export const bookingKey = (date: string, period: Period) => `${date}|${period}`;

export const indexBookings = (bookings: SpecialRoomBooking[], roomId: string) => {
  const map = new Map<string, SpecialRoomBooking>();
  bookings.forEach((booking) => {
    if (booking.roomId !== roomId) return;
    map.set(bookingKey(booking.date, booking.period), booking);
  });
  return map;
};

/**
 * 하루의 학사일정을 모은다.
 *
 * 같은 날에 여러 행사가 있을 수 있다. 하나라도 휴업일이면 그 날은 쉬는 날로 본다.
 * 예약을 막지는 않는다. 재량휴업일에 행사 준비로 특별실을 쓰는 경우가 있어서다.
 */
export interface DayNote {
  isOffDay: boolean;
  events: string[];
}

export const indexSchoolDays = (schoolDays: SchoolDay[]) => {
  const map = new Map<string, DayNote>();
  schoolDays.forEach((entry) => {
    const note = map.get(entry.date) ?? { isOffDay: false, events: [] };
    note.isOffDay = note.isOffDay || entry.isOffDay;
    if (entry.eventName) note.events.push(entry.eventName);
    map.set(entry.date, note);
  });
  return map;
};

export const isPeriod = (value: number): value is Period => (
  PERIODS.includes(value as Period)
);

/**
 * 칸에 적어 넣을 수 있는 길이. 표에서 두 줄로 읽히는 만큼이다.
 *
 * 저장소는 40자까지 받는다(마이그레이션의 `char_length(label) between 1 and 40`).
 * 화면이 더 짧게 받는 것은 어긋난 것이 아니라, 읽을 수 없는 길이를 애초에 받지 않기
 * 위해서다. 예전에는 40자를 받아 놓고 표에서는 40%만 보여 줬다. 저장소 쪽 상한은
 * 마지막 방어선으로 그대로 둔다.
 */
export const BOOKING_LABEL_MAX = 24;

/** 칸에 적는 값 정리. 앞뒤 공백과 겹친 공백을 없앤다. */
export const cleanBookingLabel = (value: string) => value.trim().replace(/\s+/g, ' ').slice(0, 40);
