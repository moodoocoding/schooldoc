const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assetPath, isExternalUrl, assertAuthUrl } = require('../../electron/security.cjs');
const { createOAuthAttempt } = require('../../electron/oauth.cjs');
const path = require('node:path');
const http = require('node:http');

test('assets cannot escape the bundled directory or use another host', () => {
  const root = path.resolve('dist-portable');
  assert.equal(assetPath(root, 'schooldoc://app/'), path.join(root, 'index.html'));
  for (const url of ['schooldoc://other/assets/a.js', 'schooldoc://app/%2e%2e%2fsecret',
    'schooldoc://app/%5csecret', 'schooldoc://app/%00secret', 'file:///C:/secret']) assert.equal(assetPath(root, url), null);
  assert.equal(isExternalUrl('file:///secret'), false);
  assert.equal(isExternalUrl('javascript:alert(1)'), false);
  assert.equal(isExternalUrl('https://school.example/s/missions/token'), true);
});

const authUrl = redirect => 'https://project.supabase.co/auth/v1/authorize?' + new URLSearchParams({
  provider: 'google', redirect_to: redirect, code_challenge_method: 's256', code_challenge: 'a'.repeat(43),
});

test('OAuth URL is bound to configured Supabase, PKCE and the prepared redirect', () => {
  const redirect = 'http://127.0.0.1:12345/callback?state=example';
  assert.equal(assertAuthUrl(authUrl(redirect), 'https://project.supabase.co', redirect), authUrl(redirect));
  for (const bad of [authUrl(redirect).replace('project.supabase.co', 'attacker.example'),
    authUrl(redirect).replace('s256', 'plain'), authUrl('http://attacker.example')]) {
    assert.throws(() => assertAuthUrl(bad, 'https://project.supabase.co', redirect));
  }
});

test('loopback rejects wrong nonce, accepts PKCE callback once and closes', async () => {
  let opened;
  const attempt = await createOAuthAttempt({ supabaseUrl: 'https://project.supabase.co', openExternal: async url => { opened = url; } });
  const completion = attempt.complete(attempt.id, authUrl(attempt.redirectUrl));
  const bad = new URL(attempt.redirectUrl); bad.searchParams.set('state', 'wrong'); bad.searchParams.set('code', 'not-accepted');
  assert.equal((await fetch(bad)).status, 400);
  assert.ok(opened.includes('code_challenge='));
  const valid = new URL(attempt.redirectUrl); valid.searchParams.set('code', 'fake-pkce-code');
  const response = await fetch(valid);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(await response.text(), /스쿨독 앱으로 돌아가세요/);
  assert.equal(await completion, 'fake-pkce-code');
  await assert.rejects(attempt.complete(attempt.id, authUrl(attempt.redirectUrl)));
  await assert.rejects(fetch(valid));
});

test('cancel and timeout release the callback server without leaking tokens', async () => {
  const attempt = await createOAuthAttempt({ supabaseUrl: 'https://project.supabase.co', openExternal: async () => {}, timeoutMs: 30 });
  const completion = attempt.complete(attempt.id, authUrl(attempt.redirectUrl));
  await assert.rejects(completion, /LOGIN_TIMEOUT/);
  await assert.rejects(fetch(attempt.redirectUrl));
  const cancelled = await createOAuthAttempt({ supabaseUrl: 'https://project.supabase.co', openExternal: async () => {} });
  const pending = cancelled.complete(cancelled.id, authUrl(cancelled.redirectUrl));
  cancelled.cancel();
  await assert.rejects(pending, /LOGIN_CANCELLED/);
});

test('malformed callback requests are rejected and the valid login can continue', async () => {
  const attempt = await createOAuthAttempt({ supabaseUrl: 'https://project.supabase.co', openExternal: async () => {} });
  const completion = attempt.complete(attempt.id, authUrl(attempt.redirectUrl));
  const endpoint = new URL(attempt.redirectUrl);
  const status = await new Promise((resolve, reject) => {
    const request = http.get({ hostname: endpoint.hostname, port: endpoint.port, path: 'http://[' }, response => {
      response.resume(); response.on('end', () => resolve(response.statusCode));
    }); request.on('error', reject);
  });
  assert.equal(status, 400);
  endpoint.searchParams.set('code', 'valid-code');
  assert.equal((await fetch(endpoint)).status, 200);
  assert.equal(await completion, 'valid-code');
});
