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

/** 날짜 문자열에 며칠을 더한다. 시간대에 밀리지 않도록 숫자로 다룬다. */
const addDays = (key: string, days: number) => {
  const [year, month, day] = key.split('-').map(Number);
  const moved = new Date(year, month - 1, day + days);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${moved.getFullYear()}-${pad(moved.getMonth() + 1)}-${pad(moved.getDate())}`;
};
const actionLimits: Record<string, number> = {
  metadata: 60,
  unlock: 10,
  week: 120,
  setBooking: 60,
  setRepeat: 20,
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
    .select('id, public_token, title, description, period_count, include_saturday, school_name, status, password_digest')
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

      /*
        이번 학기 마지막 날을 찾아 둔다. 반복 예약의 `학기 말까지` 빠른 선택에 쓴다.
        NEIS 학사일정의 행사 이름에 `여름방학`·`겨울방학`이 들어온다. 방학 첫날부터는
        잡을 이유가 없으므로 그 앞날까지만 반복한다. 공개 화면은 이번 주 학사일정만
        받으므로 여기서 계산해 주지 않으면 알 길이 없다.
      */
      const today = new Date().toISOString().slice(0, 10);
      const vacation = await db.from('special_room_school_days')
        .select('day').eq('board_id', board.id).gt('day', today)
        .ilike('event_name', '%방학%').order('day').limit(1).maybeSingle();
      if (vacation.error) throw vacation.error;
      const termEndDate = vacation.data ? addDays(vacation.data.day as string, -1) : '';
      return json(200, {
        board: {
          id: board.id,
          publicToken: board.public_token,
          title: board.title,
          description: board.description,
          periodCount: board.period_count,
          includeSaturday: board.include_saturday,
          termEndDate,
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

    if (action === 'setRepeat') {
      /*
        매주 같은 시간을 한 번에 잡는다.

        펼치는 일을 서버에서 하는 이유는, 공개 화면이 이번 주 학사일정만 들고 있어
        앞으로 올 휴업일을 모르기 때문이다. 화면에서 펼치면 추석 주에도 예약이 들어간다.
        여기서는 받아 둔 학사일정 전체를 볼 수 있다.

        반복은 넣는 방식이지 저장하는 방식이 아니다. 펼쳐서 보통 예약으로 하나씩 넣는다.
        그래야 나중에 한 주만 지우는 것이 그냥 그 칸을 지우는 일이 된다.
      */
      const label = typeof body.label === 'string' ? body.label.trim().replace(/\s+/g, ' ') : '';
      if (!label || label.length > 40) throw new HttpError(422, '내용을 40자 이내로 입력해 주세요.');
      const until = typeof body.until === 'string' ? body.until : '';
      if (!datePattern.test(until)) throw new HttpError(400, '마지막 날짜가 올바르지 않습니다.');

      // 최대 52주. 한 학년도가 대략 52주다.
      const dates: string[] = [];
      for (let index = 0; index < 52; index += 1) {
        const next = addDays(date, index * 7);
        if (next > until) break;
        dates.push(next);
      }
      if (dates.length === 0) dates.push(date);

      const [offDayResult, takenResult] = await Promise.all([
        db.from('special_room_school_days').select('day')
          .eq('board_id', board.id).eq('is_off_day', true).in('day', dates),
        db.from('special_room_bookings').select('booking_date')
          .eq('room_id', roomId).eq('period', period).in('booking_date', dates),
      ]);
      if (offDayResult.error) throw offDayResult.error;
      if (takenResult.error) throw takenResult.error;

      const offDays = new Set((offDayResult.data ?? []).map((row) => row.day as string));
      const taken = new Set((takenResult.data ?? []).map((row) => row.booking_date as string));

      const skippedOffDay = dates.filter((day) => offDays.has(day));
      const skippedTaken = dates.filter((day) => !offDays.has(day) && taken.has(day));
      const created = dates.filter((day) => !offDays.has(day) && !taken.has(day));

      if (created.length > 0) {
        const { error } = await db.from('special_room_bookings').insert(
          created.map((day) => ({ board_id: board.id, room_id: roomId, booking_date: day, period, label })),
        );
        // 넣는 사이에 누가 한 칸을 채웠을 수 있다. 그때는 그 칸만 남의 것으로 둔다.
        if (error && (error as { code?: string }).code !== '23505') throw error;
        if (error) {
          const retry = await db.from('special_room_bookings').select('booking_date')
            .eq('room_id', roomId).eq('period', period).in('booking_date', created);
          if (retry.error) throw retry.error;
          const now = new Set((retry.data ?? []).map((row) => row.booking_date as string));
          const left = created.filter((day) => !now.has(day));
          if (left.length > 0) {
            const again = await db.from('special_room_bookings').insert(
              left.map((day) => ({ board_id: board.id, room_id: roomId, booking_date: day, period, label })),
            );
            if (again.error) throw again.error;
          }
        }
      }

      return json(200, { created, skippedOffDay, skippedTaken });
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
