import { chromium, expect } from '@playwright/test';
import { jsPDF } from 'jspdf';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, copyFile, mkdtemp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import net from 'node:net';
import path from 'node:path';

const manifest = JSON.parse(await readFile('release/portable-manifest.json', 'utf8'));
const output = path.resolve(process.env.PORTABLE_TEST_OUTPUT || 'test-results/portable');
await mkdir(output, { recursive: true });
const executableDir = path.join(output, '한글 공백 경로');
await mkdir(executableDir, { recursive: true });
const source = process.env.PORTABLE_TEST_EXE || path.resolve('release', manifest.artifactName);
const executable = path.join(executableDir, manifest.artifactName);
await copyFile(source, executable);
const actualHash = createHash('sha256').update(await readFile(executable)).digest('hex');
if (actualHash !== manifest.sha256) throw new Error('EXE checksum mismatch');
const results = { commit: manifest.commit, sha256: actualHash, localArtifact: true,
  remoteGoogleLogin: 'not-tested', realSupabase: 'not-tested', mockedBackend: true, checks: [], success: false };
const profile = await mkdtemp(path.join(output, 'isolated-profile-'));
const errors = [];
let child, browser, nativeDebuggerUrl;
const user = { id: 'b05d4619-6710-4d50-9e34-2f3bd98af825', aud: 'authenticated', role: 'authenticated',
  email: 'portable-test@example.invalid', email_confirmed_at: new Date().toISOString(),
  app_metadata: { role: 'admin', provider: 'google', providers: ['google'] },
  user_metadata: { full_name: '포터블 가상 교사' }, created_at: new Date().toISOString() };
const expiry = Math.floor(Date.now() / 1000) + 3600;
const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, exp: expiry, role: 'authenticated', aud: 'authenticated' })).toString('base64url')}.fake_signature`;
const sessionKey = `sb-${new URL(manifest.supabaseUrl).hostname.split('.')[0]}-auth-token`;
const roleBoard = { id: '00000000-0000-4000-8000-000000000001', version: 1,
  public_token: '00000000-0000-4000-8000-000000000002',
  state: { roster: [], roles: [], periods: [], settings: { title: '1인 1역', schoolDays: [1, 2, 3, 4, 5],
    excludedDates: [], publicEnabled: false, maskDisplayNames: true, showPublicStatus: false } } };

async function freePort() {
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  return port;
}

async function nativeEvaluate(expression) {
  const socket = new WebSocket(nativeDebuggerUrl);
  return await new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => { socket.close(); reject(new Error('Native evaluation timed out')); }, 30_000);
    const finish = (error, value) => {
      if (settled) return;
      settled = true; clearTimeout(timer); socket.close();
      if (error) reject(error); else resolve(value);
    };
    socket.onopen = () => socket.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
    socket.onerror = () => finish(new Error('Native debugger connection failed'));
    socket.onclose = () => finish(new Error('Native debugger closed'));
    socket.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.id !== 1) return;
      if (message.error || message.result?.exceptionDetails) return finish(new Error('Native evaluation failed'));
      finish(undefined, message.result.result.value);
    };
  });
}

async function start() {
  const port = await freePort();
  const nativePort = await freePort();
  child = spawn(executable, [`--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1',
    `--inspect=127.0.0.1:${nativePort}`, `--user-data-dir=${profile}`], { windowsHide: true, stdio: 'ignore', cwd: executableDir });
  child.on('error', error => errors.push(error.message));
  await expect.poll(async () => {
    try { return (await fetch(`http://127.0.0.1:${port}/json/version`)).ok; } catch { return false; }
  }, { timeout: 60_000 }).toBe(true);
  nativeDebuggerUrl = (await (await fetch(`http://127.0.0.1:${nativePort}/json/list`)).json())[0].webSocketDebuggerUrl;
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const context = browser.contexts()[0];
  await context.route(`${manifest.supabaseUrl}/**`, async route => {
    const url = new URL(route.request().url());
    const json = value => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(value) });
    if (url.pathname.includes('/auth/v1/user')) return json(user);
    if (url.pathname.includes('/auth/v1/logout')) return route.fulfill({ status: 204 });
    if (url.pathname.includes('/realtime/')) return route.abort();
    if (url.pathname.endsWith('/rest/v1/rpc/list_special_room_summaries')) return json({ items: [], nextCursor: null });
    if (url.pathname.includes('/functions/v1/')) {
      if (url.pathname.endsWith('/classroom-roles-admin')) {
        const body = route.request().postDataJSON();
        return json(body.action === 'records' ? { records: [], total: 0 } : roleBoard);
      }
      return json({ boards: [], events: [], forms: [], collections: [], items: [], rows: [], total: 0, nextCursor: null });
    }
    return json([]);
  });
  const page = context.pages().find(page => page.url().startsWith('schooldoc:')) || context.pages()[0];
  page.on('pageerror', error => errors.push(error.message));
  await page.reload();
  return { page, context };
}

async function stop() {
  await nativeEvaluate("process.mainModule.require('electron').app.quit()").catch(() => {});
  await browser.close().catch(() => {});
  if (child && child.exitCode === null) child.kill();
}

try {
  let { page, context } = await start();
  await expect(page.locator('#root')).not.toBeEmpty();
  const info = await page.evaluate(() => window.electronAPI.getInfo());
  expect(info.commit).toBe(manifest.commit);
  expect(await page.evaluate(() => typeof window.require)).toBe('undefined');
  await page.screenshot({ path: path.join(output, 'home-desktop.png'), fullPage: true });
  results.checks.push('actual EXE / sandboxed renderer / matching commit / Korean and space path');
  await page.goto('schooldoc://app/#/tools/consent-forms');
  await expect(page.getByRole('button', { name: /Google/ }).first()).toBeVisible();
  results.checks.push('unauthenticated teacher route remains gated');
  await page.evaluate(({ sessionKey, user, token, expiry }) => {
    localStorage.setItem(sessionKey, JSON.stringify({ user, access_token: token, refresh_token: 'fake-refresh', token_type: 'bearer', expires_at: expiry, expires_in: 3600 }));
  }, { sessionKey, user, token, expiry });
  await page.reload();
  for (const [route, heading] of Object.entries({ 'registry-sign': '등록부 서명', 'student-results': '학생 결과 안내',
    'consent-forms': '가정통신문 수합', 'data-collect': '자료 수합', 'special-rooms': '특별실 예약',
    'classroom-roles': '1인 1역', 'class-missions': '학급 미션', 'receipts': '학급 운영비 영수증' })) {
    await page.goto(`schooldoc://app/#/tools/${route}`);
    await expect(page.locator('main').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /Google/ })).toHaveCount(0);
    await page.screenshot({ path: path.join(output, `${route}-desktop.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    results.checks.push(`packaged navigation / authenticated mock / ${route}`);
  }
  await page.goto('schooldoc://app/#/tools/consent-forms/new');
  const pdf = new jsPDF(); pdf.text('PORTABLE PDF PAGE 1', 20, 30); pdf.addPage(); pdf.text('PORTABLE PDF PAGE 2', 20, 30);
  await page.locator('input[type=file]').setInputFiles({ name: '가상 원본 두 쪽.pdf', mimeType: 'application/pdf', buffer: Buffer.from(pdf.output('arraybuffer')) });
  await expect(page.getByText('문서 분석 완료', { exact: true })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: '확인 후 필드 배치', exact: true }).click();
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByLabel('원본 PDF 렌더링 중', { exact: true })).toHaveCount(0, { timeout: 30_000 });
  await page.getByLabel('쪽 번호', { exact: true }).fill('2');
  await expect(page.getByLabel('쪽 번호', { exact: true })).toHaveValue('2');
  await expect(page.getByLabel('원본 PDF 렌더링 중', { exact: true })).toHaveCount(0, { timeout: 30_000 });
  await expect.poll(() => page.locator('canvas').first().evaluate(canvas => {
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, Math.min(canvas.height, 300)).data;
    let ink = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 0 && data[i] + data[i + 1] + data[i + 2] < 500) ink++;
    return ink;
  })).toBeGreaterThan(10);
  await page.screenshot({ path: path.join(output, 'pdf-upload-desktop.png'), fullPage: true });
  results.checks.push('packaged PDF.js legacy worker / uploaded 2-page PDF / rendered canvas');
  const cdp = await context.newCDPSession(page);
  const printed = await nativeEvaluate("(async () => { const { BrowserWindow } = process.mainModule.require('electron'); const pdf = await BrowserWindow.getAllWindows()[0].webContents.printToPDF({ printBackground: true, pageSize: 'A4' }); return pdf.toString('base64'); })()");
  const printedBytes = Buffer.from(printed, 'base64');
  expect(printedBytes.subarray(0, 5).toString()).toBe('%PDF-');
  await writeFile(path.join(output, 'electron-print.pdf'), printedBytes);
  results.checks.push('Electron native A4 printToPDF (physical printer and native print dialog not tested)');
  const downloadDir = await mkdtemp(path.join(output, 'downloads-'));
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir, eventsEnabled: true });
  const downloadEvent = page.waitForEvent('download');
  await page.evaluate(() => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['portable download test'], { type: 'text/plain' }));
    a.download = '한글 다운로드.txt'; document.body.append(a); a.click(); a.remove();
  });
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('한글 다운로드.txt');
  const downloadedPath = path.join(downloadDir, '한글 다운로드.txt');
  await expect.poll(async () => {
    try { return await readFile(downloadedPath, 'utf8'); } catch { return ''; }
  }).toBe('portable download test');
  await copyFile(downloadedPath, path.join(output, '한글 다운로드.txt'));
  results.checks.push('actual Blob download / Korean filename');
  await page.evaluate(async () => {
    localStorage.setItem('portable-storage-probe', 'restart-preserved');
    const db = await new Promise((resolve, reject) => {
      const r = indexedDB.open('portable-storage-probe', 1); r.onupgradeneeded = () => r.result.createObjectStore('originals');
      r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction('originals', 'readwrite'); tx.objectStore('originals').put(new Blob(['fake original']), 'receipt');
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
    }); db.close();
  });
  await stop();
  ({ page, context } = await start());
  expect(await page.evaluate(() => localStorage.getItem('portable-storage-probe'))).toBe('restart-preserved');
  const original = await page.evaluate(async () => {
    const db = await new Promise(resolve => { const r = indexedDB.open('portable-storage-probe', 1); r.onsuccess = () => resolve(r.result); });
    const blob = await new Promise(resolve => { const r = db.transaction('originals').objectStore('originals').get('receipt'); r.onsuccess = () => resolve(r.result); });
    db.close(); return blob.text();
  });
  expect(original).toBe('fake original');
  results.checks.push('restart preserves localStorage and IndexedDB Blob at stable origin');
  await page.goto('schooldoc://app/#/tools/registry-sign');
  await page.getByRole('button', { name: /사용자 메뉴:/ }).click();
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await expect(page.getByRole('button', { name: /Google/ }).first()).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), sessionKey)).toBeNull();
  results.checks.push('logout button clears local session and restores auth gate (mock logout endpoint)');
  await stop(); browser = undefined;
  expect(errors).toEqual([]);
  results.success = true;
} catch (error) {
  results.failure = error.message;
  const failedPage = browser?.contexts()[0]?.pages()[0];
  if (failedPage) {
    results.failedUrl = failedPage.url();
    await failedPage.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {});
  }
  throw error;
} finally {
  if (browser) {
    const page = browser.contexts()[0]?.pages()[0];
    if (page) await stop().catch(() => {});
    await browser.close().catch(() => {});
  }
  if (child && child.exitCode === null) child.kill();
  results.errors = errors;
  await writeFile(path.join(output, 'portable-smoke.json'), JSON.stringify(results, null, 2) + '\n');
}
console.log(JSON.stringify({ success: results.success, checks: results.checks.length, report: path.join(output, 'portable-smoke.json') }));
