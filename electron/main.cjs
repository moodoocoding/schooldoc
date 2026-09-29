const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const http = require('http');

let mainWindow = null;

// 브라우저 해시(#access_token=...) 및 쿼리 파라미터를 읽어 로컬 서버로 전달하는 브릿지 페이지
function renderBridgePage() {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>스쿨독 로그인 처리 중...</title>
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
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
      text-align: center;
      max-width: 440px;
      border: 1px solid #DCE3EA;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #EFF6FC;
      border-top-color: #0F6CBD;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 16px auto;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    h1 { font-size: 20px; font-weight: 800; margin: 0 0 8px 0; color: #0F6CBD; }
    p { font-size: 14px; color: #526174; line-height: 1.6; margin: 0; }
  </style>
</head>
<body>
  <div class="card" id="card">
    <div class="spinner" id="spinner"></div>
    <h1 id="title">스쿨독 로그인 처리 중...</h1>
    <p id="desc">Google 계정 인증 정보를 앱으로 안전하게 연결하고 있습니다.</p>
  </div>
  <script>
    (function() {
      // 1. URL 해시(#access_token=...) 또는 쿼리(?code=...) 파싱
      const rawHash = window.location.hash.startsWith('#') ? window.location.hash.substring(1) : '';
      const rawSearch = window.location.search.startsWith('?') ? window.location.search.substring(1) : '';
      const params = new URLSearchParams(rawHash || rawSearch);

      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const code = params.get('code');
      const error = params.get('error') || params.get('error_description');

      const card = document.getElementById('card');
      const spinner = document.getElementById('spinner');
      const title = document.getElementById('title');
      const desc = document.getElementById('desc');

      if (error) {
        spinner.style.display = 'none';
        title.innerText = '로그인 취소';
        title.style.color = '#B42318';
        desc.innerText = error;
        fetch('/token-exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error })
        });
        return;
      }

      if (accessToken || code) {
        fetch('/token-exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken, refreshToken, code })
        })
        .then(res => res.json())
        .then(() => {
          spinner.style.display = 'none';
          title.innerText = '스쿨독 로그인 성공! 🎉';
          title.style.color = '#126B32';
          desc.innerText = '인증이 완료되었습니다. 이 창을 닫고 스쿨독 앱으로 돌아가세요.';
          setTimeout(() => { window.close(); }, 2500);
        })
        .catch(err => {
          spinner.style.display = 'none';
          title.innerText = '인증 전달 오류';
          title.style.color = '#B42318';
          desc.innerText = '앱으로 인증 정보를 전달하지 못했습니다: ' + err.message;
        });
      } else {
        spinner.style.display = 'none';
        title.innerText = '인증 정보 없음';
        title.style.color = '#B42318';
        desc.innerText = 'URL에 유효한 인증 토큰이나 코드가 없습니다.';
      }
    })();
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

      // 1. 브라우저가 콜백 주소로 리다이렉트되어 들어올 때: 브릿지 HTML을 내려줌
      if (parsedUrl.pathname === '/callback') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(renderBridgePage());
        return;
      }

      // 2. 브라우저 내부 자바스크립트가 해시/토큰을 파싱하여 POST로 전송할 때
      if (parsedUrl.pathname === '/token-exchange' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (data.error) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: false }));
              cleanup();
              reject(new Error(`Google 로그인 오류: ${data.error}`));
              return;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
            cleanup();
            resolve(data);

            if (mainWindow) {
              mainWindow.focus();
            }
          } catch (err) {
            res.writeHead(400);
            res.end();
            cleanup();
            reject(err);
          }
        });
        return;
      }

      res.writeHead(404);
      res.end();
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
