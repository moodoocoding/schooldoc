import { createClient } from 'npm:@supabase/supabase-js@2.110.8';

/**
 * 공개 예약 창구. 가입하지 않은 교사가 링크로 들어와 쓴다.
 *
 * 칸에 들어가는 것은 '6-1반' 같은 학급 이름이지 사람 이름이 아니라, 개인정보를 다루지
 * 않는다. 그래서 암복호도, 세션도 없다.
 *
 * 공유 시트와 같은 규칙이다. 링크를 아는 사람은 누구나 고치고 지울 수 있다. 대신 같은
 * 칸을 두 사람이 동시에 잡는 것만 DB의 유니크 제약이 막는다.
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
});
class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }

const url = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY');
if (!url || !serviceKey) throw new Error('Supabase service environment is not configured.');
const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const actionLimits: Record<string, number> = {
  metadata: 60,
  unlock: 10,
  week: 120,
  setBooking: 60,
  clearBooking: 60,
};

const hashText = async (value: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const consumeRateLimit = async (request: Request, action: string, token: string) => {
  const ip = request.headers.get('cf-connecting-ip')
    ?? request.headers.get('x-real-ip')
    ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? 'unknown';
  const key = await hashText(`${ip}:${token}:${action}`);
  const { data, error } = await db.rpc('consume_special_room_rate_limit', {
    p_request_key: key,
    p_window_seconds: 60,
    p_max_requests: actionLimits[action] ?? 30,
  });
  if (error) throw error;
  if (!data) throw new HttpError(429, '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.');
};

interface BoardRow {
  id: string;
  public_token: string;
  title: string;
  description: string;
  school_name: string | null;
  status: 'open' | 'closed';
  password_digest: string | null;
}

const getBoard = async (token: string) => {
  const { data, error } = await db.from('special_room_boards')
    .select('id, public_token, title, description, school_name, status, password_digest')
    .eq('public_token', token).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, '예약표를 찾을 수 없습니다.');
  return data as BoardRow;
};

const verifyPassword = async (board: BoardRow, password: unknown) => {
  if (!board.password_digest) return;
  if (typeof password !== 'string' || password.length > 200) {
    throw new HttpError(401, '비밀번호가 맞지 않습니다.');
  }
  const { data, error } = await db.rpc('verify_special_room_password', {
    p_board_id: board.id,
    p_password: password,
  });
  if (error) throw error;
  if (!data) throw new HttpError(401, '비밀번호가 맞지 않습니다.');
};

const readPeriod = (value: unknown) => {
  const period = Number(value);
  if (!Number.isInteger(period) || period < 1 || period > 8) {
    throw new HttpError(400, '교시는 1교시부터 8교시까지입니다.');
  }
  return period;
};

const readRoom = async (boardId: string, roomId: unknown) => {
  if (typeof roomId !== 'string' || !uuidPattern.test(roomId)) throw new HttpError(400, '특별실을 찾을 수 없습니다.');
  const { data, error } = await db.from('special_rooms')
    .select('id').eq('id', roomId).eq('board_id', boardId).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, '특별실을 찾을 수 없습니다.');
  return roomId;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json(405, { error: '허용되지 않은 요청입니다.' });

  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = typeof body.action === 'string' ? body.action : '';
    const token = typeof body.token === 'string' ? body.token : '';
    if (!Object.hasOwn(actionLimits, action) || !uuidPattern.test(token)) {
      throw new HttpError(400, '요청 형식이 올바르지 않습니다.');
    }

    await consumeRateLimit(request, action, token);
    const board = await getBoard(token);

    if (action === 'metadata') {
      const { data: rooms, error } = await db.from('special_rooms')
        .select('id, position, name, location').eq('board_id', board.id).order('position');
      if (error) throw error;
      return json(200, {
        board: {
          id: board.id,
          publicToken: board.public_token,
          title: board.title,
          description: board.description,
          schoolName: board.school_name ?? '',
          status: board.status,
          hasPassword: Boolean(board.password_digest),
          rooms: (rooms ?? []).map((room) => ({
            id: room.id, position: room.position, name: room.name, location: room.location,
          })),
        },
      });
    }

    await verifyPassword(board, body.password);
    if (action === 'unlock') return json(200, { ok: true });

    if (action === 'week') {
      const from = typeof body.from === 'string' ? body.from : '';
      const to = typeof body.to === 'string' ? body.to : '';
      if (!datePattern.test(from) || !datePattern.test(to)) throw new HttpError(400, '기간이 올바르지 않습니다.');

      const [bookingsResult, daysResult] = await Promise.all([
        db.from('special_room_bookings')
          .select('id, room_id, booking_date, period, label, updated_at')
          .eq('board_id', board.id).gte('booking_date', from).lte('booking_date', to),
        db.from('special_room_school_days')
          .select('day, event_name, is_off_day')
          .eq('board_id', board.id).gte('day', from).lte('day', to),
      ]);
      if (bookingsResult.error) throw bookingsResult.error;
      if (daysResult.error) throw daysResult.error;

      return json(200, {
        bookings: (bookingsResult.data ?? []).map((row) => ({
          id: row.id, roomId: row.room_id, date: row.booking_date,
          period: row.period, label: row.label, updatedAt: row.updated_at,
        })),
        schoolDays: (daysResult.data ?? []).map((row) => ({
          date: row.day, eventName: row.event_name, isOffDay: row.is_off_day,
        })),
      });
    }

    // 여기부터는 자료를 바꾼다. 닫힌 예약표는 읽기만 된다.
    if (board.status !== 'open') throw new HttpError(409, '예약이 종료되었습니다.');

    const roomId = await readRoom(board.id, body.roomId);
    const date = typeof body.date === 'string' ? body.date : '';
    if (!datePattern.test(date)) throw new HttpError(400, '날짜가 올바르지 않습니다.');
    const period = readPeriod(body.period);

    if (action === 'setBooking') {
      const label = typeof body.label === 'string' ? body.label.trim().replace(/\s+/g, ' ') : '';
      if (!label || label.length > 40) throw new HttpError(422, '내용을 40자 이내로 입력해 주세요.');

      // 있으면 고치고 없으면 만든다. 아무나 고칠 수 있는 공유 시트 규칙이다.
      const { data: existing, error: findError } = await db.from('special_room_bookings')
        .select('id').eq('room_id', roomId).eq('booking_date', date).eq('period', period).maybeSingle();
      if (findError) throw findError;

      if (existing) {
        const { error } = await db.from('special_room_bookings')
          .update({ label }).eq('id', existing.id);
        if (error) throw error;
        return json(200, { ok: true, updated: true });
      }

      const { error } = await db.from('special_room_bookings')
        .insert({ board_id: board.id, room_id: roomId, booking_date: date, period, label });
      if (error) {
        // 두 사람이 같은 순간에 눌렀다. 유니크 제약이 막아 준 것이므로 그대로 알린다.
        if ((error as { code?: string }).code === '23505') {
          throw new HttpError(409, '방금 다른 분이 이 시간을 예약했습니다. 새로고침해 주세요.');
        }
        throw error;
      }
      return json(200, { ok: true, updated: false });
    }

    if (action === 'clearBooking') {
      const { error } = await db.from('special_room_bookings')
        .delete().eq('board_id', board.id).eq('room_id', roomId)
        .eq('booking_date', date).eq('period', period);
      if (error) throw error;
      return json(200, { ok: true });
    }

    throw new HttpError(400, '지원하지 않는 요청입니다.');
  } catch (error) {
    if (error instanceof HttpError) return json(error.status, { error: error.message });
    if ((error as { code?: string }).code === '42P01') {
      console.error('special-rooms-public: migration not applied', error);
      return json(503, { error: '특별실 예약 마이그레이션이 아직 적용되지 않았습니다. 202608210002을 적용해 주세요.' });
    }
    console.error('special-rooms-public failed', error);
    return json(500, { error: '예약을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
  }
});
