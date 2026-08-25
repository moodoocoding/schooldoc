import { describe, expect, test } from 'vitest';
import {
  applyBooking,
  isPendingBooking,
  removeBooking,
} from '../../src/features/specialRooms/specialRoomsOptimistic';
import type { Period, SpecialRoomBooking } from '../../src/features/specialRooms/types';

/**
 * 저장을 기다리지 않고 화면에 먼저 반영한다.
 *
 * 실제로 재보니 저장 한 번에 엣지 함수를 다섯 번 부르고 표에 반영되기까지 4초가 걸렸다.
 * 낙관적으로 먼저 그려 주되, 실패하면 되돌릴 수 있도록 원래 목록을 건드리지 않는다.
 */
const booking = (id: string, roomId: string, date: string, period: Period, label: string): SpecialRoomBooking => ({
  id, roomId, date, period, label, updatedAt: '2026-08-24T00:00:00.000Z',
});

const target = { roomId: 'room-1', date: '2026-08-24', period: 1 as Period };

describe('빈 칸에 넣기', () => {
  test('없던 칸이면 새로 더한다', () => {
    const next = applyBooking([], target, '6-1반');
    expect(next).toHaveLength(1);
    expect(next[0].label).toBe('6-1반');
    expect(next[0].roomId).toBe('room-1');
  });

  test('새로 더한 것은 아직 서버에 없다고 표시된다', () => {
    // 다시 받아 올 때 통째로 갈릴 항목이라 서버가 준 것과 구분해 둔다.
    expect(isPendingBooking(applyBooking([], target, '6-1반')[0])).toBe(true);
  });

  test('앞뒤 공백과 겹친 공백을 정리해 넣는다', () => {
    // 서버가 저장하는 모양과 같아야 다시 받아 왔을 때 글자가 튀지 않는다.
    expect(applyBooking([], target, '  6-1반   과학  ')[0].label).toBe('6-1반 과학');
  });
});

describe('이미 있는 칸 고치기', () => {
  const existing = [booking('a', 'room-1', '2026-08-24', 1, '6-1반')];

  test('같은 칸이면 내용만 바꾸고 개수는 그대로다', () => {
    const next = applyBooking(existing, target, '5-3반 과학');
    expect(next).toHaveLength(1);
    expect(next[0].label).toBe('5-3반 과학');
    expect(next[0].id).toBe('a');
  });

  test('서버가 준 id는 그대로 둔다', () => {
    expect(isPendingBooking(applyBooking(existing, target, '5-3반')[0])).toBe(false);
  });
});

describe('다른 칸을 건드리지 않는다', () => {
  const many = [
    booking('a', 'room-1', '2026-08-24', 1, '6-1반'),
    booking('b', 'room-1', '2026-08-25', 1, '6-2반'),
    booking('c', 'room-2', '2026-08-24', 1, '미술'),
    booking('d', 'room-1', '2026-08-24', 2, '2교시'),
  ];

  test('날짜·교시·특별실이 하나라도 다르면 그대로다', () => {
    const next = applyBooking(many, target, '바뀜');
    expect(next.find((x) => x.id === 'a')?.label).toBe('바뀜');
    expect(next.find((x) => x.id === 'b')?.label).toBe('6-2반');
    expect(next.find((x) => x.id === 'c')?.label).toBe('미술');
    expect(next.find((x) => x.id === 'd')?.label).toBe('2교시');
  });

  test('지울 때도 그 칸만 빠진다', () => {
    const next = removeBooking(many, target);
    expect(next.map((x) => x.id)).toEqual(['b', 'c', 'd']);
  });
});

describe('되돌릴 수 있어야 한다', () => {
  const original = [booking('a', 'room-1', '2026-08-24', 1, '6-1반')];

  test('넣어도 원래 목록은 그대로 남는다', () => {
    applyBooking(original, { ...target, date: '2026-08-26' }, '새로');
    expect(original).toHaveLength(1);
    expect(original[0].label).toBe('6-1반');
  });

  test('지워도 원래 목록은 그대로 남는다', () => {
    removeBooking(original, target);
    expect(original).toHaveLength(1);
  });
});

describe('없는 칸을 지워도 터지지 않는다', () => {
  test('빈 목록에서 지우면 그대로 빈 목록', () => {
    expect(removeBooking([], target)).toEqual([]);
  });
});
