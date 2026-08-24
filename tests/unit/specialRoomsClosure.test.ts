import { describe, expect, test } from 'vitest';
import {
  CLOSURE_ALL_ROOMS,
  checkClosure,
  closureAt,
  closureLabel,
  closureNotice,
  hiddenByClosures,
} from '../../src/features/specialRooms/specialRoomsClosure';
import type { Period, SpecialRoomBooking, SpecialRoomClosure } from '../../src/features/specialRooms/types';

/**
 * 담당 교사가 출장이나 연가로 자리를 비우면 그 특별실을 쓸 수 없다.
 *
 * 예전에는 담당자가 그날 칸을 하나씩 `출장`이라고 채우는 수밖에 없었다. 8교시면 여덟
 * 칸이고, 그것도 예약으로 보일 뿐 누구나 지울 수 있어 막은 것이 되지 못했다.
 */
const closure = (over: Partial<SpecialRoomClosure> = {}): SpecialRoomClosure => ({
  id: 'c1', roomId: 'room-1', startDate: '2026-09-03', endDate: '2026-09-04', reason: '담당 교사 출장', ...over,
});

const booking = (id: string, roomId: string, date: string, period: Period = 1): SpecialRoomBooking => ({
  id, roomId, date, period, label: `${id}반`, updatedAt: '2026-09-01T00:00:00.000Z',
});

describe('휴관이 걸린 자리를 가른다', () => {
  test('기간 안이면 걸린다', () => {
    const closures = [closure()];
    expect(closureAt(closures, 'room-1', '2026-09-03')?.reason).toBe('담당 교사 출장');
    expect(closureAt(closures, 'room-1', '2026-09-04')?.reason).toBe('담당 교사 출장');
  });

  test('기간 밖이면 걸리지 않는다', () => {
    const closures = [closure()];
    expect(closureAt(closures, 'room-1', '2026-09-02')).toBeNull();
    expect(closureAt(closures, 'room-1', '2026-09-05')).toBeNull();
  });

  test('다른 특별실은 걸리지 않는다', () => {
    // 과학실 담당이 출장이라고 미술실까지 막으면 안 된다.
    expect(closureAt([closure()], 'room-2', '2026-09-03')).toBeNull();
  });

  test('방을 고르지 않은 휴관은 모든 특별실에 걸린다', () => {
    // 시험 기간처럼 전체를 막을 때 쓴다.
    const all = [closure({ roomId: CLOSURE_ALL_ROOMS, reason: '기말고사' })];
    expect(closureAt(all, 'room-1', '2026-09-03')?.reason).toBe('기말고사');
    expect(closureAt(all, 'room-9', '2026-09-03')?.reason).toBe('기말고사');
  });

  test('하루짜리 휴관도 걸린다', () => {
    const oneDay = [closure({ startDate: '2026-09-03', endDate: '2026-09-03' })];
    expect(closureAt(oneDay, 'room-1', '2026-09-03')).not.toBeNull();
    expect(closureAt(oneDay, 'room-1', '2026-09-04')).toBeNull();
  });
});

describe('휴관에 가려지는 예약을 센다', () => {
  const bookings = [
    booking('a', 'room-1', '2026-09-03'),
    booking('b', 'room-1', '2026-09-04', 2),
    booking('c', 'room-1', '2026-09-10'),
    booking('d', 'room-2', '2026-09-03'),
  ];

  test('그 방 그 기간 것만 가려진다', () => {
    expect(hiddenByClosures(bookings, [closure()]).map((x) => x.id)).toEqual(['a', 'b']);
  });

  test('휴관이 없으면 아무것도 가려지지 않는다', () => {
    expect(hiddenByClosures(bookings, [])).toEqual([]);
  });

  test('모든 특별실 휴관이면 다른 방 것도 가려진다', () => {
    const all = [closure({ roomId: CLOSURE_ALL_ROOMS })];
    expect(hiddenByClosures(bookings, all).map((x) => x.id)).toEqual(['a', 'b', 'd']);
  });
});

describe('걸기 전에 무엇이 가려지는지 알린다', () => {
  test('며칠에 몇 건인지 적고 연락하라고 말한다', () => {
    // 이 앱에는 예약한 사람에게 알릴 수단이 없다. 담당자가 직접 연락해야 한다.
    const notice = closureNotice(hiddenByClosures(
      [booking('a', 'room-1', '2026-09-03'), booking('b', 'room-1', '2026-09-04', 2)],
      [closure()],
    ));
    expect(notice).toContain('9/3·9/4');
    expect(notice).toContain('예약 2건');
    expect(notice).toContain('알려 주세요');
    expect(notice).toContain('휴관을 풀면 다시 나타납니다');
  });

  test('날이 많으면 앞의 셋만 적고 나머지는 수로 줄인다', () => {
    const many = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-07']
      .map((date, index) => booking(String(index), 'room-1', date));
    const notice = closureNotice(hiddenByClosures(many, [closure({ startDate: '2026-09-01', endDate: '2026-09-07' })]));
    expect(notice).toContain('등 5일');
  });

  test('가려질 것이 없으면 아무 말도 하지 않는다', () => {
    expect(closureNotice([])).toBe('');
  });
});

describe('휴관 입력을 검사한다', () => {
  const draft = { roomId: 'room-1', startDate: '2026-09-03', endDate: '2026-09-04', reason: '출장' };

  test('제대로 채우면 통과한다', () => {
    expect(checkClosure(draft).ok).toBe(true);
  });

  test('날짜가 거꾸로면 막는다', () => {
    const checked = checkClosure({ ...draft, endDate: '2026-09-01' });
    expect(checked.ok).toBe(false);
    expect(checked.field).toBe('endDate');
  });

  test('사유는 비워도 된다', () => {
    // 적기 귀찮아서 휴관을 안 거는 것보다, 사유 없이라도 막는 편이 낫다.
    expect(checkClosure({ ...draft, reason: '' }).ok).toBe(true);
  });

  test('사유가 너무 길면 막는다', () => {
    expect(checkClosure({ ...draft, reason: '가'.repeat(41) }).ok).toBe(false);
  });
});

describe('목록에 보여 줄 한 줄', () => {
  test('하루짜리는 날짜를 두 번 적지 않는다', () => {
    expect(closureLabel(closure({ startDate: '2026-09-03', endDate: '2026-09-03' }), '과학실'))
      .toBe('과학실 · 9/3 · 담당 교사 출장');
  });

  test('여러 날이면 기간으로 적는다', () => {
    expect(closureLabel(closure(), '과학실')).toBe('과학실 · 9/3 ~ 9/4 · 담당 교사 출장');
  });

  test('방을 고르지 않았으면 모든 특별실이라고 적는다', () => {
    expect(closureLabel(closure({ roomId: CLOSURE_ALL_ROOMS, reason: '기말고사' }), ''))
      .toContain('모든 특별실');
  });

  test('사유가 없으면 사유 자리를 비운다', () => {
    expect(closureLabel(closure({ reason: '' }), '과학실')).toBe('과학실 · 9/3 ~ 9/4');
  });
});
