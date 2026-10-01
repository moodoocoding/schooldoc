import {
  koreanDate,
  repeatRangeError,
  validDate,
  weekStart,
} from './specialRooms.ts';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
  });
export interface SpecialRoomsPort {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: unknown }>;
}
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const encode = (value: Uint8Array) =>
  btoa(String.fromCharCode(...value))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
/** 별도로 등록한 ES256 서명 키만 사용한다. 기존 Auth 키는 변경하지 않는다. */
export async function notificationToken(
  board: Record<string, unknown>,
  env: (name: string) => string | undefined,
) {
  const raw = env('SPECIAL_ROOMS_NOTIFICATION_JWK');
  const kid = env('SPECIAL_ROOMS_NOTIFICATION_KID');
  if (!raw || !kid) return null;
  const jwk = JSON.parse(raw) as JsonWebKey;
  if (jwk.kty !== 'EC' || jwk.crv !== 'P-256' || !jwk.d) {
    throw new Error('notification signing key must be ES256');
  }
  const now = Math.floor(Date.now() / 1000);
  const header = encode(
    new TextEncoder().encode(JSON.stringify({ alg: 'ES256', typ: 'JWT', kid })),
  );
  const body = encode(
    new TextEncoder().encode(
      JSON.stringify({
        iss: env('SUPABASE_URL') + '/auth/v1',
        aud: 'authenticated',
        iat: now,
        exp: now + 900,
        sub: crypto.randomUUID(),
        role: 'special_room_viewer',
        sr_board: board.id,
        sr_epoch: String(board.accessEpoch),
      }),
    ),
  );
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(header + '.' + body),
  );
  return {
    token: header + '.' + body + '.' + encode(new Uint8Array(signature)),
    expiresAt: (now + 900) * 1000,
  };
}
export async function handleSpecialRooms(
  request: Request,
  db: SpecialRoomsPort,
  env: (name: string) => string | undefined,
) {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }
  if (request.method !== 'POST') {
    return json(405, { error: '허용되지 않은 요청입니다.' });
  }
  try {
    if (Number(request.headers.get('Content-Length') ?? 0) > 16384) {
      return json(413, { error: '요청이 너무 큽니다.' });
    }
    const text = await request.text();
    if (text.length > 16384) return json(413, { error: '요청이 너무 큽니다.' });
    const body = JSON.parse(text) as Record<string, unknown>;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return json(400, { error: '요청 형식이 올바르지 않습니다.' });
    }
    delete body.legacyWeek;
    const action = body.action;
    if (
      typeof action !== 'string' ||
      ![
        'metadata',
        'bootstrap',
        'unlock',
        'week',
        'setBooking',
        'clearBooking',
        'setRepeat',
      ].includes(action) ||
      typeof body.token !== 'string' ||
      !uuid.test(body.token)
    )
      return json(400, { error: '요청 형식이 올바르지 않습니다.' });
    if (
      body.password !== undefined &&
      (typeof body.password !== 'string' || body.password.length > 200)
    )
      return json(400, { error: '비밀번호가 올바르지 않습니다.' });
    if (
      body.roomId !== undefined &&
      (typeof body.roomId !== 'string' ||
        (body.roomId !== '' && !uuid.test(body.roomId)))
    )
      return json(400, { error: '특별실을 찾을 수 없습니다.' });
    if (['metadata', 'bootstrap', 'unlock', 'week'].includes(action)) {
      body.from = body.from ?? weekStart(koreanDate());
      if (!validDate(body.from) || weekStart(body.from) !== body.from) {
        return json(400, { error: '주간 시작은 월요일이어야 합니다.' });
      }
      if (
        action === 'week' &&
        body.roomId === undefined &&
        body.to !== undefined
      ) {
        if (
          !validDate(body.to) ||
          body.to < String(body.from) ||
          Date.parse(body.to) - Date.parse(String(body.from)) > 5 * 86400000
        )
          return json(400, { error: '주간 기간이 올바르지 않습니다.' });
        body.legacyWeek = true;
      }
      if (
        body.known !== undefined &&
        (!body.known ||
          typeof body.known !== 'object' ||
          ['scopeRevision', 'metadataRevision', 'calendarRevision'].some(
            (k) =>
              !Number.isSafeInteger(
                (body.known as Record<string, unknown>)[k],
              ) || Number((body.known as Record<string, unknown>)[k]) < 0,
          ))
      )
        return json(400, { error: '조회 버전이 올바르지 않습니다.' });
    } else {
      if (
        !validDate(body.date) ||
        typeof body.period !== 'number' ||
        !Number.isInteger(body.period) ||
        body.period < 1 ||
        body.period > 9 ||
        typeof body.roomId !== 'string' ||
        !uuid.test(body.roomId)
      ) {
        return json(400, {
          error: '날짜와 교시는 1교시부터 9교시까지 올바르게 입력해 주세요.',
        });
      }
      if (
        typeof body.operationId !== 'string' ||
        !uuid.test(body.operationId)
      ) {
        return json(409, {
          error: '예약 화면을 새로고침한 뒤 다시 시도해 주세요.',
          code: 'CLIENT_UPDATE_REQUIRED',
        });
      }
      if (
        action !== 'clearBooking' &&
        (typeof body.label !== 'string' ||
          !body.label.trim() ||
          body.label.trim().length > 40)
      )
        return json(400, { error: '내용은 1자부터 40자까지 입력해 주세요.' });
      if (action === 'setRepeat') {
        if (
          typeof body.until !== 'string' ||
          repeatRangeError(body.date, body.until)
        ) {
          return json(400, {
            error: repeatRangeError(body.date, String(body.until)),
          });
        }
      } else if (
        !Object.hasOwn(body, 'expected') ||
        (body.expected !== null &&
          (!body.expected ||
            typeof body.expected !== 'object' ||
            !uuid.test(String((body.expected as Record<string, unknown>).id)) ||
            !Number.isSafeInteger(
              (body.expected as Record<string, unknown>).revision,
            ) ||
            Number((body.expected as Record<string, unknown>).revision) < 1))
      ) {
        return json(409, {
          error: '予約 화면을 새로고침한 뒤 다시 시도해 주세요.',
          code: 'CLIENT_UPDATE_REQUIRED',
        });
      }
    }
    const ip =
      request.headers.get('cf-connecting-ip') ??
      request.headers.get('x-real-ip') ??
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      'unknown';
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(ip + ':' + body.token + ':' + action),
    );
    const key = Array.from(new Uint8Array(digest), (x) =>
      x.toString(16).padStart(2, '0'),
    ).join('');
    const { data, error } = await db.rpc('special_room_public_request', {
      p_body: body,
      p_request_key: key,
    });
    if (error || !data) {
      return json(503, {
        error: '예약 서버를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      });
    }
    const result = data as Record<string, unknown>;
    const status = Number(result.status ?? 500);
    if (status === 200 && result.board && !result.locked) {
      // 알림 연결 실패는 이미 완료된 조회/저장을 실패로 바꾸지 않는다.
      try {
        result.notification = await notificationToken(
          result.board as Record<string, unknown>,
          env,
        );
      } catch {
        result.notification = null;
      }
    }
    return json(status, result);
  } catch {
    return json(400, { error: '요청 형식이 올바르지 않습니다.' });
  }
}
