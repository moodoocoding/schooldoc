import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const fixtureUrl = 'http://127.0.0.1:4196';
try {
  await fetch(`${fixtureUrl}/fixture`);
  throw new Error('Port 4196 is already occupied; refusing to reuse another server');
} catch (error) { if (error.message.startsWith('Port ')) throw error; }
const fixture = spawn(process.env.DENO_BIN || 'deno', ['run', '--no-lock', '--node-modules-dir=none',
  '--allow-read', '--allow-net=127.0.0.1:4196', 'tests/server/specialRoomsLocalServer.ts'],
{ windowsHide: true, stdio: 'inherit' });
let failure;
fixture.on('error', error => { failure = error; });
try {
  let ready = false;
  for (let retry = 0; retry < 120; retry++) {
    if (failure) throw failure;
    if (fixture.exitCode !== null) throw new Error('Local SQL fixture stopped before becoming ready');
    try { ready = (await fetch(`${fixtureUrl}/fixture`)).ok; } catch { /* starting */ }
    if (ready) break;
    await delay(500);
  }
  if (!ready) throw new Error('Local SQL fixture startup timed out');
  const test = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', 'tests/e2e/special-rooms-server-flow.spec.ts'],
    { windowsHide: true, stdio: 'inherit', env: { ...process.env, CI: 'true', PLAYWRIGHT_TEST_PORT: '4195',
      SPECIAL_ROOMS_SQL_URL: fixtureUrl, PLAYWRIGHT_OUTPUT_DIR: 'test-results/server-flow', PLAYWRIGHT_REPORT_DIR: 'playwright-report/server-flow' } });
  const status = await new Promise((resolve, reject) => { test.once('error', reject); test.once('exit', resolve); });
  if (status !== 0) throw new Error(`Local HTTP/SQL browser tests failed (${status})`);
} finally { fixture.kill(); }
