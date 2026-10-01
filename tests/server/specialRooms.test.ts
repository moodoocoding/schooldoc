import {
  handleSpecialRooms,
  notificationToken,
} from '../../supabase/functions/_shared/specialRoomsServer.ts';
const assert = (v: unknown, m = 'HTTP assertion failed') => {
  if (!v) throw new Error(m);
};
const token = '10000000-0000-4000-8000-000000000001';
const room = '20000000-0000-4000-8000-000000000001';
Deno.test('HTTP boundary: one RPC, typed conflicts, strict period and fail closed', async () => {
  let calls = 0;
  let response: unknown = { status: 200, booking: null };
  let rpcError: unknown = null;
  const port = {
    rpc: (_name: string, _args: Record<string, unknown>) => {
      calls++;
      return Promise.resolve({ data: response, error: rpcError });
    },
  };
  const send = (data: unknown) =>
    handleSpecialRooms(
      new Request('http://localhost/functions/v1/special-rooms-public', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
      port,
      () => undefined,
    );
  const base = {
    token,
    roomId: room,
    date: '2026-10-05',
    action: 'setBooking',
    period: 9,
    label: '가상 학급',
    operationId: crypto.randomUUID(),
    expected: null,
  };
  assert((await send(base)).status === 200 && calls === 1);
  for (const period of [0, 10, 1.5, '9']) {
    assert((await send({ ...base, period })).status === 400);
  }
  assert(calls === 1, 'invalid input must not call DB');
  assert((await send({ ...base, date: '2026-02-29' })).status === 400);
  const old = { ...base } as Record<string, unknown>;
  delete old.expected;
  assert((await send(old)).status === 409);
  response = {
    status: 409,
    code: 'BOOKING_CONFLICT',
    current: { id: 'current' },
    error: '변경되었습니다.',
  };
  const conflict = await send(base);
  assert(conflict.status === 409);
  assert((await conflict.json()).code === 'BOOKING_CONFLICT');
  rpcError = new Error('database unavailable');
  assert((await send(base)).status === 503);
});
Deno.test('notification JWT: dedicated role, board+epoch, short TTL, real ES256 signature', async () => {
  const keys = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  );
  const jwk = await crypto.subtle.exportKey('jwk', keys.privateKey);
  const env = (name: string) =>
    name === 'SPECIAL_ROOMS_NOTIFICATION_JWK'
      ? JSON.stringify(jwk)
      : name === 'SPECIAL_ROOMS_NOTIFICATION_KID'
      ? 'synthetic-key'
      : name === 'SUPABASE_URL'
      ? 'http://localhost'
      : undefined;
  const result = await notificationToken({ id: token, accessEpoch: 4 }, env);
  assert(result);
  const [header, body, sig] = result!.token.split('.');
  const decode = (s: string) =>
    Uint8Array.from(
      atob(s.replaceAll('-', '+').replaceAll('_', '/')),
      (c) => c.charCodeAt(0),
    );
  const claims = JSON.parse(new TextDecoder().decode(decode(body)));
  assert(
    claims.role === 'special_room_viewer' && claims.sr_board === token &&
      claims.sr_epoch === '4',
  );
  assert(claims.exp - claims.iat === 900);
  assert(!claims.password);
  assert(
    await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      keys.publicKey,
      decode(sig),
      new TextEncoder().encode(header + '.' + body),
    ),
  );
});
