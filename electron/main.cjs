const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const http = require('http');

let mainWindow = null;

function renderCallbackPage(title, message, isSuccess = true) {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Pretendard Variable", Pretendard, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background-color: #F6F8FB;
      color: #0F172A;
    }
    .card {
      background: white;
      padding: 40px;
      border-radius: 20px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01);
      text-align: center;
      max-width: 420px;
      border: 1px solid #DCE3EA;
    }
    .icon {
      font-size: 48px;
      margin-bottom: 16px;
    }
    h1 {
      font-size: 20px;
      font-weight: 800;
      margin: 0 0 8px 0;
      color: ${isSuccess ? '#0F6CBD' : '#B42318'};
    }
    p {
      font-size: 14px;
      color: #526174;
      line-height: 1.6;
      margin: 0;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${isSuccess ? '🎉' : '⚠️'}</div>
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
  <script>
    setTimeout(() => { window.close(); }, 3000);
  </script>
</body>
</html>`;
}

// 로컬 루프백 OAuth 콜백 처리기
function handleGoogleOAuth(authUrlTemplate) {
  return new Promise((resolve, reject) => {
    let server = null;
    let timer = null;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (server) {
        try { server.close(); } catch (_) {}
      }
    };

    server = http.createServer((req, res) => {
      const parsedUrl = new URL(req.url, 'http://127.0.0.1');
      if (parsedUrl.pathname !== '/callback') {
        res.writeHead(404);
        res.end();
        return;
      }

      const code = parsedUrl.searchParams.get('code');
      const error = parsedUrl.searchParams.get('error');

      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(renderCallbackPage('로그인 취소', 'Google 로그인이 취소되었습니다.', false));
        cleanup();
        reject(new Error(`Google 로그인 오류: ${error}`));
        return;
      }

      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(renderCallbackPage('스쿨독 로그인 성공!', '인증이 완료되었습니다. 이 창을 닫고 스쿨독 앱으로 돌아가세요.', true));
        cleanup();
        resolve({ code });
        if (mainWindow) {
          mainWindow.focus();
        }
        return;
      }

      res.writeHead(400);
      res.end('Missing code parameter');
      cleanup();
      reject(new Error('OAuth 콜백에 인증 코드가 없습니다.'));
    });

    server.on('error', (err) => {
      cleanup();
      reject(err);
    });

    // 127.0.0.1의 빈 포트 자동 할당
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const redirectUri = `http://127.0.0.1:${port}/callback`;

      // Supabase OAuth 주소에 redirect_to 주입
      const authUrl = authUrlTemplate.replace('__REDIRECT_URI__', encodeURIComponent(redirectUri));

      shell.openExternal(authUrl).catch((err) => {
        cleanup();
        reject(err);
      });
    });

    // 5분 타임아웃
    timer = setTimeout(() => {
      cleanup();
      reject(new Error('로그인 대기 시간이 초과되었습니다.'));
    }, 300000);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1080,
    minHeight: 700,
    autoHideMenuBar: true,
    title: '스쿨독 (SchoolDoc) - 교사용 행정 올인원 비서',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  const indexPath = path.join(__dirname, '../dist/index.html');
  mainWindow.loadFile(indexPath).catch((err) => {
    console.error('Failed to load local HTML file:', err);
  });
}

app.whenReady().then(() => {
  ipcMain.handle('google-oauth:start', async (_event, authUrlTemplate) => {
    return handleGoogleOAuth(authUrlTemplate);
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
