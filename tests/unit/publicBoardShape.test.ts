import { describe, expect, test } from 'vitest';
import { handleSpecialRooms } from '../../supabase/functions/_shared/specialRoomsServer';
const token = '10000000-0000-4000-8000-000000000001';
const roomId = '20000000-0000-4000-8000-000000000001';
const send = (body: unknown, port: Parameters<typeof handleSpecialRooms>[1]) =>
  handleSpecialRooms(
    new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    port,
    () => undefined,
  );
describe('공개 예약표 HTTP 계약', () => {
  test('조회는 한 RPC를 통해 받은 범위 응답을 그대로 전달한다', async () => {
    const body = { action: 'week', token, roomId, from: '2026-10-05' };
    const board = {
      id: token,
      periodCount: 9,
      includeSaturday: true,
      bookings: [],
      schoolDays: [],
      rooms: [],
      scopeRevision: 0,
    };
    let count = 0;
    const response = await send(body, {
      rpc: async (name, args) => {
        count++;
        expect(name).toBe('special_room_public_request');
        expect(args.p_body).toEqual(body);
        return { data: { status: 200, board }, error: null };
      },
    });
    expect(response.status).toBe(200);
    expect((await response.json()).board).toEqual(board);
    expect(count).toBe(1);
  });
  test('잠긴 최초 응답에는 알림 JWT를 추가하지 않는다', async () => {
    const response = await send({
      action: 'bootstrap',
      token,
      from: '2026-10-05',
    }, {
      rpc: async () => ({
        data: {
          status: 200,
          locked: true,
          board: { id: token, isPasswordProtected: true, bookings: [] },
        },
        error: null,
      }),
    });
    const result = await response.json();
    expect(result.notification).toBeUndefined();
    expect(result.board.bookings).toEqual([]);
  });
  test('서버 실패를 빈 예약표로 바꾸지 않는다', async () => {
    const response = await send({ action: 'week', token, from: '2026-10-05' }, {
      rpc: async () => ({ data: null, error: new Error('DB unavailable') }),
    });
    expect(response.status).toBe(503);
    expect((await response.json()).board).toBeUndefined();
  });
  test('기대 버전 없는 구버전 쓰기는 새로고침 안내로 차단한다', async () => {
    let count = 0;
    const response = await send({
      action: 'setBooking',
      token,
      roomId,
      date: '2026-10-05',
      period: 9,
      label: '가상 학급',
      operationId: crypto.randomUUID(),
    }, {
      rpc: async () => {
        count++;
        return { data: { status: 200 }, error: null };
      },
    });
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('CLIENT_UPDATE_REQUIRED');
    expect(count).toBe(0);
  });
});
