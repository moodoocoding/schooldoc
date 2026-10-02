const { app, BrowserWindow, ipcMain, net, shell } = require('electron');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs');
const { APP_ORIGIN, isAppUrl, isExternalUrl, assetPath } = require('./security.cjs');
const { createOAuthAttempt } = require('./oauth.cjs');
const { protocol } = require('electron');

protocol.registerSchemesAsPrivileged([{ scheme: 'schooldoc', privileges: {
  standard: true, secure: true, supportFetchAPI: true, corsEnabled: true,
} }]);
app.setName('SchoolDoc_Portable');
const profileArg = process.argv.find(value => value.startsWith('--user-data-dir='));
if (profileArg) app.setPath('userData', path.resolve(profileArg.slice('--user-data-dir='.length)));
let mainWindow, attempt;
const buildInfo = JSON.parse(fs.readFileSync(path.join(__dirname, '../dist-portable/desktop-build.json'), 'utf8'));

function assertSender(event) {
  if (event.sender !== mainWindow?.webContents || event.senderFrame !== event.sender.mainFrame
    || !isAppUrl(event.senderFrame.url)) throw new Error('IPC_FORBIDDEN');
}

async function openExternal(value) {
  if (!isExternalUrl(value)) throw new Error('EXTERNAL_URL_INVALID');
  await shell.openExternal(value);
}

function guardContents(contents) {
  contents.on('will-navigate', (event, value) => {
    if (isAppUrl(value) || value.startsWith(`blob:${APP_ORIGIN}/`)) return;
    event.preventDefault();
    if (isExternalUrl(value)) void openExternal(value).catch(() => {});
  });
  contents.on('will-attach-webview', event => event.preventDefault());
  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(`blob:${APP_ORIGIN}/`)) return { action: 'allow', overrideBrowserWindowOptions: {
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
    } };
    if (isExternalUrl(url)) void openExternal(url).catch(() => {});
    return { action: 'deny' };
  });
}

app.on('web-contents-created', (_event, contents) => guardContents(contents));
app.whenReady().then(() => {
  const root = path.join(__dirname, '../dist-portable');
  protocol.handle('schooldoc', async request => {
    const file = assetPath(root, request.url);
    if (!file || !['GET', 'HEAD'].includes(request.method)) return new Response('', { status: 403 });
    try {
      const response = await net.fetch(pathToFileURL(file).toString());
      const headers = new Headers(response.headers);
      headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https: wss:; worker-src 'self' blob:; frame-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'");
      return new Response(response.body, { status: response.status, headers });
    }
    catch { return new Response('', { status: 404 }); }
  });
  mainWindow = new BrowserWindow({
    width: 1360, height: 860, minWidth: 720, minHeight: 600,
    title: '스쿨독 (SchoolDoc)', autoHideMenuBar: true, show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true,
      preload: path.join(__dirname, 'preload.cjs') },
  });
  const session = mainWindow.webContents.session;
  session.setPermissionRequestHandler((contents, permission, callback) =>
    callback(isAppUrl(contents.getURL()) && permission === 'clipboard-sanitized-write'));
  session.setPermissionCheckHandler((_contents, permission, origin) =>
    isAppUrl(origin) && permission === 'clipboard-sanitized-write');
  ipcMain.handle('desktop:info', event => { assertSender(event); return buildInfo; });
  ipcMain.handle('google-oauth:prepare', async event => {
    assertSender(event);
    if (attempt) throw new Error('LOGIN_BUSY');
    // 준비 중 두 번째 요청도 막는다.
    const preparing = { cancel: () => {} };
    attempt = preparing;
    try {
      const created = await createOAuthAttempt({ supabaseUrl: buildInfo.supabaseUrl, openExternal });
      if (attempt !== preparing || !mainWindow) { created.cancel(); throw new Error('LOGIN_CANCELLED'); }
      attempt = created;
      return { id: attempt.id, redirectUrl: attempt.redirectUrl };
    } catch { if (attempt === preparing) attempt = undefined; throw new Error('LOGIN_FAILED'); }
  });
  ipcMain.handle('google-oauth:complete', async (event, id, url) => {
    assertSender(event);
    const current = attempt;
    if (!current?.complete) throw new Error('LOGIN_ATTEMPT_INVALID');
    try { return await current.complete(id, url); }
    finally { if (attempt === current) attempt = undefined; }
  });
  ipcMain.handle('google-oauth:cancel', (event, id) => {
    assertSender(event);
    if (attempt?.id === id) { attempt.cancel(); attempt = undefined; }
  });
  mainWindow.once('ready-to-show', () => {
    mainWindow.showInactive();
  });
  mainWindow.on('closed', () => { attempt?.cancel(); attempt = undefined; mainWindow = undefined; });
  void mainWindow.loadURL(`${APP_ORIGIN}/`);
});
app.on('window-all-closed', () => app.quit());
