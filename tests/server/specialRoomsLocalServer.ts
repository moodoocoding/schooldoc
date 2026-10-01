// 실제 Edge handler + 실제 PostgreSQL 엔진. localhost 가상 자료만 사용한다.
// 원격 Supabase/Auth/Realtime WebSocket 서비스의 검증을 대신하지 않는다.
import { createSpecialRoomPg } from './specialRoomsPgFixture.ts';
import { handleSpecialRooms } from '../../supabase/functions/_shared/specialRoomsServer.ts';
const { db, board, room, token } = await createSpecialRoomPg();
const requests: {
  action: unknown;
  from: unknown;
  roomId: unknown;
  status: number;
  bytes: number;
}[] = [];
let failNext = false;
let delayWeek = '';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization,apikey,x-client-info,content-type',
  'Content-Type': 'application/json',
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: cors });
const port = {
  rpc: async (name: string, args: Record<string, unknown>) => {
    if (name !== 'special_room_public_request')
      return { data: null, error: new Error('unsupported RPC') };
    try {
      const result = await db.query<{ data: unknown }>(
        'select special_room_public_request($1::jsonb,$2) data',
        [JSON.stringify(args.p_body), args.p_request_key],
      );
      return { data: result.rows[0].data, error: null };
    } catch (e) {
      return { data: null, error: e };
    }
  },
};
Deno.serve({ hostname: '127.0.0.1', port: 4196 }, async (request) => {
  const path = new URL(request.url).pathname;
  if (request.method === 'OPTIONS')
    return new Response('ok', { headers: cors });
  if (path === '/fixture') return json({ board, room, token });
  if (path === '/metrics')
    return json({
      requests,
      bookings: (
        await db.query(
          'select id,booking_date::text booking_date,period,label,revision from special_room_bookings order by booking_date,period',
        )
      ).rows,
      states: (
        await db.query(
          'select * from special_room_week_state order by week_start',
        )
      ).rows,
      messages: (
        await db.query(
          "select topic,event,payload from realtime.messages where event='cells'",
        )
      ).rows,
    });
  if (path === '/control' && request.method === 'POST') {
    const body = await request.json();
    if (body.action === 'reset') {
      await db.exec(
        'delete from special_room_bookings; delete from special_room_week_state; delete from special_room_repeat_operations; delete from special_room_rate_limits; delete from realtime.messages;',
      );
      requests.length = 0;
      failNext = false;
      delayWeek = '';
    } else if (body.action === 'failNext') failNext = true;
    else if (body.action === 'delayWeek') delayWeek = body.week;
    else if (body.action === 'status')
      await db.query('update special_room_boards set status=$1 where id=$2', [
        body.status,
        board,
      ]);
    else if (body.action === 'config')
      await db.query(
        'update special_room_boards set period_count=$1,include_saturday=$2 where id=$3',
        [body.periodCount, body.includeSaturday, board],
      );
    return json({ ok: true });
  }
  if (path === '/functions/v1/special-rooms-public') {
    const body = await request.clone().json();
    if (failNext) {
      failNext = false;
      return json({ error: '시험용 연결 실패' }, 503);
    }
    if (body.from === delayWeek) {
      delayWeek = '';
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    const response = await handleSpecialRooms(request, port, () => undefined);
    requests.push({
      action: body.action,
      from: body.from,
      roomId: body.roomId,
      status: response.status,
      bytes: (await response.clone().text()).length,
    });
    return response;
  }
  return json({ error: 'not found' }, 404);
});
