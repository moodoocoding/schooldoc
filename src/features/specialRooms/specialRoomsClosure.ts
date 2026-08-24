import { formatDayLabel } from './specialRoomWeek';
import type { SpecialRoomBooking, SpecialRoomClosure } from './types';

/**
 * 특별실을 못 쓰는 기간.
 *
 * 담당 교사가 출장이나 연가로 자리를 비우면 그 특별실을 쓸 수 없다. 시설 점검이나 시험
 * 기간도 마찬가지다. 예전에는 담당자가 그날 칸을 하나씩 `출장`이라고 채우는 수밖에
 * 없었는데, 8교시면 여덟 칸이고 그것도 예약으로 보일 뿐 누구나 지울 수 있었다.
 *
 * 휴관 기간의 예약은 **감추고 또 알린다.** 감추는 이유는 예약이 보이면 그 사람이 그날
 * 오기 때문이고, 알리는 이유는 담당자가 그 사람들에게 따로 연락해야 하기 때문이다.
 * 지우지는 않는다. 휴관을 풀면 그대로 돌아온다.
 */

/** 방을 고르지 않은 휴관은 그 예약표의 모든 특별실에 걸린다. */
export const CLOSURE_ALL_ROOMS = '';

/** 사유 길이. DB의 `char_length(reason) <= 40`과 같은 값이다. */
export const CLOSURE_REASON_MAX = 40;

const covers = (closure: SpecialRoomClosure, roomId: string, date: string) => (
  (closure.roomId === CLOSURE_ALL_ROOMS || closure.roomId === roomId)
  && closure.startDate <= date && date <= closure.endDate
);

/** 그 방 그 날짜에 걸린 휴관. 없으면 null. */
export const closureAt = (
  closures: SpecialRoomClosure[], roomId: string, date: string,
): SpecialRoomClosure | null => closures.find((closure) => covers(closure, roomId, date)) ?? null;

/** 휴관에 가려지는 예약. 지우지 않고 감추기만 한다. */
export const hiddenByClosures = (
  bookings: SpecialRoomBooking[], closures: SpecialRoomClosure[],
) => bookings.filter((booking) => closures.some((closure) => covers(closure, booking.roomId, booking.date)));

/**
 * 휴관을 걸기 전에 무엇이 가려지는지 알린다.
 *
 * 몇 건인지와 어느 날인지를 함께 적는다. 건수만으로는 누구에게 연락해야 할지 모른다.
 * 이 앱에는 예약한 사람에게 알릴 수단이 없으므로, 담당자가 직접 연락하도록 말해 준다.
 */
export const closureNotice = (hidden: SpecialRoomBooking[]): string => {
  if (hidden.length === 0) return '';
  const days = [...new Set(hidden.map((booking) => formatDayLabel(booking.date)))].sort();
  const shown = days.slice(0, 3).join('·');
  const more = days.length > 3 ? ` 등 ${days.length}일` : '';
  return `${shown}${more}에 예약 ${hidden.length}건이 있습니다. 휴관으로 두면 표에서 감춰지니 예약한 분들께 따로 알려 주세요. 지워지는 것은 아니라, 휴관을 풀면 다시 나타납니다.`;
};

export interface ClosureDraft {
  roomId: string;
  startDate: string;
  endDate: string;
  reason: string;
}

export interface ClosureCheck {
  ok: boolean;
  error: string;
  field: 'startDate' | 'endDate' | 'reason' | '';
}

export const checkClosure = (draft: ClosureDraft): ClosureCheck => {
  if (!draft.startDate) return { ok: false, error: '시작 날짜를 골라 주세요.', field: 'startDate' };
  if (!draft.endDate) return { ok: false, error: '마지막 날짜를 골라 주세요.', field: 'endDate' };
  if (draft.endDate < draft.startDate) {
    return { ok: false, error: '마지막 날짜가 시작 날짜보다 앞섭니다.', field: 'endDate' };
  }
  if (draft.reason.trim().length > CLOSURE_REASON_MAX) {
    return { ok: false, error: `사유는 ${CLOSURE_REASON_MAX}자까지 쓸 수 있습니다.`, field: 'reason' };
  }
  return { ok: true, error: '', field: '' };
};

/** 목록에 보여 줄 한 줄. 하루짜리는 날짜를 두 번 적지 않는다. */
export const closureLabel = (closure: SpecialRoomClosure, roomName: string) => {
  const room = closure.roomId === CLOSURE_ALL_ROOMS ? '모든 특별실' : roomName;
  const when = closure.startDate === closure.endDate
    ? formatDayLabel(closure.startDate)
    : `${formatDayLabel(closure.startDate)} ~ ${formatDayLabel(closure.endDate)}`;
  return closure.reason ? `${room} · ${when} · ${closure.reason}` : `${room} · ${when}`;
};
