import { cleanBookingLabel } from './specialRoomWeek';
import type { Period, SpecialRoomBooking } from './types';

/**
 * 저장을 기다리지 않고 화면에 먼저 반영한다.
 *
 * 예전에는 칸을 눌러 저장하면 서버가 끝날 때까지 회전 표시만 돌았다. 실제로 재보니
 * 저장 한 번에 엣지 함수를 다섯 번 부르고 표에 반영되기까지 4초가 걸렸다. 교사가 40칸을
 * 훑으며 몇 개씩 잡는 화면에서 한 번에 4초는 쓰지 못할 속도다.
 *
 * 그래서 누른 즉시 로컬 상태를 고쳐 화면에 보여 주고, 서버 응답은 뒤에서 받는다. 실패하면
 * 원래 상태로 되돌리고 무엇이 잘못됐는지 알린다. 되돌릴 수 있어야 하므로 이전 목록을
 * 그대로 두고 새 배열을 만든다.
 */

/** 낙관적 갱신에만 쓰는 임시 식별자. 서버가 준 것과 구분해 둔다. */
const PENDING_PREFIX = 'pending:';

export const isPendingBooking = (booking: SpecialRoomBooking) => booking.id.startsWith(PENDING_PREFIX);

export interface BookingTarget {
  roomId: string;
  date: string;
  period: Period;
}

const isSameCell = (booking: SpecialRoomBooking, target: BookingTarget) => (
  booking.roomId === target.roomId
  && booking.date === target.date
  && booking.period === target.period
);

/** 그 칸에 값을 넣거나 고친다. 이미 있으면 내용만 바꾼다. */
export const applyBooking = (
  bookings: SpecialRoomBooking[], target: BookingTarget, label: string,
): SpecialRoomBooking[] => {
  const clean = cleanBookingLabel(label);
  const now = new Date().toISOString();
  const existing = bookings.find((booking) => isSameCell(booking, target));

  if (existing) {
    return bookings.map((booking) => (
      isSameCell(booking, target) ? { ...booking, label: clean, updatedAt: now } : booking
    ));
  }
  return [...bookings, {
    // 서버가 만들 진짜 id를 아직 모른다. 다시 받아 올 때 이 항목은 통째로 갈린다.
    id: `${PENDING_PREFIX}${target.roomId}|${target.date}|${target.period}`,
    roomId: target.roomId,
    date: target.date,
    period: target.period,
    label: clean,
    updatedAt: now,
  }];
};

/** 그 칸을 비운다. */
export const removeBooking = (
  bookings: SpecialRoomBooking[], target: BookingTarget,
): SpecialRoomBooking[] => bookings.filter((booking) => !isSameCell(booking, target));
