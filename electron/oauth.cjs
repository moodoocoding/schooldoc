const http = require('node:http');
const { randomBytes } = require('node:crypto');
const { assertAuthUrl } = require('./security.cjs');

// PKCE code만 받는다. access/refresh token은 브라우저 URL이나 loopback 서버로 전달하지 않는다.
async function createOAuthAttempt({ supabaseUrl, openExternal, timeoutMs = 300_000 }) {
  const id = randomBytes(32).toString('hex');
  let resolveCode, rejectCode, settled = false, launched = false, timer;
  const result = new Promise((resolve, reject) => { resolveCode = resolve; rejectCode = reject; });
  void result.catch(() => {}); // 브라우저를 열기 전에 만료/취소될 수 있다.
  const server = http.createServer((req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
    res.setHeader('Referrer-Policy', 'no-referrer');
    let url;
    try { url = new URL(req.url, redirectUrl); }
    catch { res.writeHead(400); res.end('Invalid callback'); return; }
    if (req.method !== 'GET' || req.headers.host !== new URL(redirectUrl).host
      || url.pathname !== '/callback' || url.searchParams.get('state') !== id || !launched || settled) {
      res.writeHead(400); res.end('Invalid callback'); return;
    }
    const code = url.searchParams.get('code');
    const ok = Boolean(code && code.length <= 4096 && !url.searchParams.has('error'));
    res.writeHead(ok ? 200 : 400, { 'Content-Type': 'text/html; charset=utf-8' });
    res.once('finish', () => finish(ok ? undefined : new Error('LOGIN_CANCELLED'), code));
    res.end(`<!doctype html><html lang="ko"><meta charset="utf-8"><title>스쿨독 로그인</title><body><h1>${ok ? '스쿨독 앱으로 돌아가세요.' : '로그인을 완료하지 못했습니다.'}</h1><p>이 창을 닫고 앱에서 로그인 결과를 확인해 주세요.</p></body></html>`);
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 10_000;
  server.maxHeadersCount = 30;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const redirectUrl = `http://127.0.0.1:${server.address().port}/callback?state=${id}`;
  function finish(error, code) {
    if (settled) return;
    settled = true; clearTimeout(timer); server.close(); server.closeAllConnections();
    if (error) rejectCode(error); else resolveCode(code);
  }
  timer = setTimeout(() => finish(new Error('LOGIN_TIMEOUT')), timeoutMs);
  timer.unref();
  server.on('error', () => finish(new Error('LOGIN_FAILED')));
  return {
    id, redirectUrl,
    cancel: () => finish(new Error('LOGIN_CANCELLED')),
    complete: async (attemptId, authUrl) => {
      if (attemptId !== id || launched || settled) throw new Error('LOGIN_ATTEMPT_INVALID');
      try {
        const verifiedUrl = assertAuthUrl(authUrl, supabaseUrl, redirectUrl);
        launched = true;
        await openExternal(verifiedUrl);
        return await result;
      } catch (error) { finish(new Error('LOGIN_FAILED')); throw error; }
    },
  };
}

module.exports = { createOAuthAttempt };
