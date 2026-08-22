import { createClient } from 'npm:@supabase/supabase-js@2.110.8';

/**
 * 담당자 전용 창구. 하는 일은 NEIS를 대신 불러 주는 것뿐이다.
 *
 * NEIS는 CORS가 열려 있어 브라우저에서 바로 부를 수 있지만, 그러면 인증키가 번들에 박혀
 * 사이트를 여는 누구나 꺼내 쓸 수 있다. 그래서 키를 여기에 두고 우리가 대신 부른다.
 *
 * 예약판과 특별실의 생성·수정은 RLS로 브라우저가 직접 한다. 개인정보가 없어 암복호가
 * 필요 없기 때문이다.
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
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
if (!url || !serviceKey) throw new Error('Supabase service environment is not configured.');
const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const NEIS_BASE = 'https://open.neis.go.kr/hub';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const neisKey = () => Deno.env.get('NEIS_API_KEY')?.trim() ?? '';

const requireUser = async (request: Request) => {
  const authorization = request.headers.get('Authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) throw new HttpError(401, '로그인이 필요합니다.');
  if (!anonKey) throw new HttpError(500, 'Supabase anon key is not configured.');
  const caller = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data, error } = await caller.auth.getUser();
  if (error || !data.user) throw new HttpError(401, '로그인 정보를 확인하지 못했습니다.');
  return data.user.id;
};

const requireOwnedBoard = async (boardId: string, userId: string) => {
  if (!uuidPattern.test(boardId)) throw new HttpError(400, '예약판을 찾을 수 없습니다.');
  const { data, error } = await db.from('special_room_boards')
    .select('id, neis_office_code, neis_school_code')
    .eq('id', boardId).eq('owner_id', userId).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(403, '이 예약판을 관리할 권한이 없습니다.');
  return data as { id: string; neis_office_code: string | null; neis_school_code: string | null };
};

/**
 * NEIS 응답은 성공과 실패의 모양이 다르다.
 * 성공이면 `{ <이름>: [{head}, {row}] }`, 실패나 자료 없음이면 `{ RESULT: {...} }`가 온다.
 */
const readNeis = async (path: string, params: Record<string, string>) => {
  const key = neisKey();
  if (!key) throw new HttpError(503, 'NEIS 인증키가 설정되지 않아 학사일정을 가져올 수 없습니다.');

  const query = new URLSearchParams({ KEY: key, Type: 'json', ...params });
  let payload: Record<string, unknown>;
  try {
    const response = await fetch(`${NEIS_BASE}/${path}?${query}`, { signal: AbortSignal.timeout(15_000) });
    payload = await response.json() as Record<string, unknown>;
  } catch {
    throw new HttpError(502, 'NEIS에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  }

  // 자료가 없을 때도 RESULT로 온다. 오류가 아니므로 빈 배열로 돌려준다.
  const result = payload.RESULT as { CODE?: string; MESSAGE?: string } | undefined;
  if (result) {
    if (result.CODE === 'INFO-200') return [];
    throw new HttpError(502, `NEIS가 요청을 거절했습니다. (${result.CODE ?? '알 수 없음'})`);
  }

  const blocks = Object.values(payload)[0];
  if (!Array.isArray(blocks)) return [];
  const rowBlock = blocks.find((block) => block && typeof block === 'object' && 'row' in block);
  const rows = (rowBlock as { row?: unknown[] } | undefined)?.row;
  return Array.isArray(rows) ? rows as Record<string, string>[] : [];
};

/** NEIS의 YYYYMMDD를 YYYY-MM-DD로. */
const toDateKey = (value: string) => `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
const toNeisDate = (value: string) => value.replaceAll('-', '');

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json(405, { error: '허용되지 않은 요청입니다.' });

  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = typeof body.action === 'string' ? body.action : '';
    const userId = await requireUser(request);

    if (action === 'searchSchool') {
      const name = typeof body.schoolName === 'string' ? body.schoolName.trim() : '';
      if (name.length < 2 || name.length > 50) throw new HttpError(400, '학교 이름을 두 글자 이상 입력해 주세요.');

      const rows = await readNeis('schoolInfo', { pIndex: '1', pSize: '20', SCHUL_NM: name });
      return json(200, {
        schools: rows.map((row) => ({
          officeCode: row.ATPT_OFCDC_SC_CODE,
          schoolCode: row.SD_SCHUL_CODE,
          name: row.SCHUL_NM,
          kind: row.SCHUL_KND_SC_NM,
          address: row.ORG_RDNMA ?? '',
        })),
      });
    }

    if (action === 'syncSchoolDays') {
      const boardId = typeof body.boardId === 'string' ? body.boardId : '';
      const board = await requireOwnedBoard(boardId, userId);
      if (!board.neis_office_code || !board.neis_school_code) {
        throw new HttpError(400, '이 예약판에는 학교가 지정되어 있지 않습니다.');
      }
      const from = typeof body.from === 'string' ? body.from : '';
      const to = typeof body.to === 'string' ? body.to : '';
      if (!datePattern.test(from) || !datePattern.test(to)) throw new HttpError(400, '기간이 올바르지 않습니다.');

      const rows = await readNeis('SchoolSchedule', {
        pIndex: '1',
        pSize: '1000',
        ATPT_OFCDC_SC_CODE: board.neis_office_code,
        SD_SCHUL_CODE: board.neis_school_code,
        AA_FROM_YMD: toNeisDate(from),
        AA_TO_YMD: toNeisDate(to),
      });

      const days = rows
        .filter((row) => typeof row.AA_YMD === 'string' && row.AA_YMD.length === 8)
        .map((row) => ({
          board_id: boardId,
          day: toDateKey(row.AA_YMD),
          event_name: (row.EVENT_NM ?? '').trim(),
          // '해당없음'이 아니면 쉬는 날이다. 공휴일·토요휴업일·학교장재량휴업일이 여기 들어온다.
          is_off_day: Boolean(row.SBTR_DD_SC_NM) && row.SBTR_DD_SC_NM !== '해당없음',
        }));

      // 받은 기간만 갈아 끼운다. 전체를 지우면 다른 기간에 받아 둔 것이 사라진다.
      const cleared = await db.from('special_room_school_days')
        .delete().eq('board_id', boardId).gte('day', from).lte('day', to);
      if (cleared.error) throw cleared.error;

      if (days.length > 0) {
        const { error } = await db.from('special_room_school_days')
          .upsert(days, { onConflict: 'board_id,day,event_name' });
        if (error) throw error;
      }
      return json(200, { count: days.length });
    }

    throw new HttpError(400, '지원하지 않는 요청입니다.');
  } catch (error) {
    if (error instanceof HttpError) return json(error.status, { error: error.message });
    if ((error as { code?: string }).code === '42P01') {
      console.error('special-rooms-admin: migration not applied', error);
      return json(503, { error: '특별실 예약 마이그레이션이 아직 적용되지 않았습니다. 202608210002을 적용해 주세요.' });
    }
    console.error('special-rooms-admin failed', error);
    return json(500, { error: '학사일정을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
  }
});
