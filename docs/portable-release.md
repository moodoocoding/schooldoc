# Windows 포터블 빌드·검증·릴리즈

Windows x64와 Node.js 22.12 이상을 사용한다. Electron 44.4.5와 electron-builder
26.15.3은 `package-lock.json`으로 고정한다. 기존 웹 기능을 현재 소스에서 빌드하며
`feature/portable-app` 브랜치의 과거 기능 코드를 병합해 되돌리지 않는다.

## 연결 설정과 빌드

`.env.production.local` 또는 실행 환경에 다음 공개 설정만 준비한다.

```text
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon JWT 또는 sb_publishable_ 공개 키>
VITE_PUBLIC_APP_URL=https://<공개 웹 앱 주소>
```

`VITE_PUBLIC_APP_URL` 기본값은 `https://schooldoc-nine.vercel.app`이다.
서버 키·암호화 키·실제 개인정보를 넣지 않는다. 빌드 스크립트는 이 세 변수만 선택하며
서비스 역할 JWT·secret 키를 거부한다. Vite portable 모드는 다른 `.env` 파일을 읽지 않는다.
외부 설정 폴더를 이용해야 하면 `SCHOOLDOC_ENV_DIR`을 지정한다. 비밀 파일을 복사하지 않는다.

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run test:desktop
npm run build
npm run electron:build:portable
npm run test:portable
```

빌드 스크립트는 Electron 바이너리를 명시적으로 설치하고 그 고정 배포본을 패키징한다.
웹은 `dist/`, EXE용 번들은 `dist-portable/`, 산출물은 `release/`에 만든다.
개발용 `.env` 플래그는 EXE에 포함하지 않는다. EXE 파일명은
`SchoolDoc_Portable_<version>_<sha12>.exe`다. `portable-manifest.json`에 전체 SHA·크기·체크섬·
공개 주소를 기록하고 `SHA256SUMS.txt`를 생성한다. 키 값은 manifest에 기록하지 않는다.
미커밋 변경이 있는 로컬 시험 빌드는 가능하지만 `dirty: true` 산출물은 게시를 거부한다.
`electron:start`는 먼저 포터블 번들을 빌드한 상태에서 사용하는 개발 실행 명령이다.

## 실행 구조와 인증

- 렌더러는 `schooldoc://app`의 고정 origin과 HashRouter를 사용한다. EXE를 다시 압축 해제해도
  같은 사용자 프로필에서 localStorage·IndexedDB 주소가 바뀌지 않는다.
- Node 접근은 차단하고 sandbox·contextIsolation을 켠다. IPC는 주 창의 주 frame과 앱 주소를
  검사한다. 외부 HTTP(S) 링크는 기본 브라우저로 열고 다른 scheme·webview를 거부한다.
- 공개 링크와 QR은 HTTPS 웹 앱 주소를 사용한다. 학생·학부모는 일반 브라우저에서 접속한다.
- Google 로그인은 기본 브라우저에서 Supabase PKCE로 진행한다. 시도별 임의 포트의
  `127.0.0.1` 콜백과 nonce를 사용하며, 받은 code를 앱의 PKCE verifier로 교환한다.
  access/refresh token을 loopback URL로 받지 않는다. 취소·5분 만료·오류 시 서버를 닫는다.
- Supabase Auth redirect allowlist에는 이 loopback 주소 패턴이 필요하다.
  `http://127.0.0.1:*/callback**`를 해당 프로젝트에서 허용하고 실제 로그인으로 확인한다.
  기존 웹 redirect·프로젝트 secrets·암호화 키를 덮어쓰지 않는다.
- 영수증 관리자 접근과 원본 IndexedDB·장부 localStorage 정책은 유지한다.
  무설치 EXE도 프로필은 사용자 AppData에 저장하므로 EXE 하나에 자료가 함께 담기지는 않는다.
  과거 `file://` 베타 EXE의 저장소를 자동으로 이관하지 않는다. 기존 프로필을 삭제하지 말고
  기존 자료가 필요한 경우 백업·이관과 구버전 프로필 재사용을 별도로 검증한다.

## 자동 검사 범위

웹 E2E는 고정된 가상 Supabase 주소와 데모 자료를 사용한다. 실패를 회피하려고 운영 설정을
가져오지 않는다. Deno 2.9.6의 로컬 서버 계약 검사와 `npm run test:server-flow`의 5개
HTTP·SQL 브라우저 검사는 가상 PostgreSQL(PGlite)과 실제 제품 처리기를 사용한다.
실제 Supabase Auth·WebSocket·다중 PostgreSQL 연결 시험과 구분한다.

`test:portable`은 실제 산출 EXE의 체크섬을 확인한 뒤 한글·공백 경로에 복사해 실행한다.
실행마다 시험 프로필을 새로 만들고 loopback 디버거로 다음을 검사한다.

- 커밋 정보·격리된 렌더러·로그인하지 않은 교사 화면의 접근 제한
- 가상 로그인 상태에서 업무 8개의 정상 제목·화면 이동·가로 넘침
- 2쪽 PDF 분석·필드 편집 캔버스와 Electron 네이티브 A4 `printToPDF`
- 실제 Blob 다운로드와 한글 파일명
- 정상 종료·재시작 후 localStorage와 IndexedDB Blob 보존
- 로그아웃 버튼·모의 logout 요청 후 세션 제거와 교사 화면 접근 제한

서버 응답과 사용자 세션은 가상이다. 실제 Google 인증, 운영 자료 생성·공개 제출·교사 확인,
모든 업무의 Excel/ZIP/PDF 파일 내용, 실제 프린터·Windows 인쇄 대화상자, 구버전 데이터 이관을
이 검사 통과만으로 완료 처리하지 않는다. `PORTABLE_TEST_OUTPUT`으로 증빙 폴더를 지정할 수
있으며 기본값은 `test-results/portable`이다. 게시된 EXE를 검사할 때는 다운로드한
동일 release의 manifest와 `PORTABLE_TEST_EXE`를 사용하고, 별도로 게시 URL·다운로드 경로·
체크섬과 실제 통합 시험을 기록한다. 자동 보고서의 `localArtifact`는 로컬 검사임을 나타낸다.

## 후보 → main → 정식 릴리즈

1. 검증 브랜치의 코드·웹·서버·EXE 검사를 완료한다. 필요한 변경을 목적별 커밋으로 만든 뒤
   깨끗한 최종 HEAD를 다시 패키징·실행 검사한다.
2. 허용된 범위에서 push·PR을 생성하고 필수 CI가 같은 PR head SHA로 성공하는지 확인한다.
   Windows package job의 `portable-<전체SHA>` artifact에는 EXE·체크섬·manifest·검사 보고서를 담는다.
3. 검증한 artifact를 `release/`에 받아 `PORTABLE_SMOKE_REPORT=release/portable-smoke.json`을
   설정하고 `npm run release:portable -- --candidate`로 후보 prerelease를 게시한다.
   태그는 `portable-rc-v<version>-<sha12>`이다. PR 실행에서는 자동 게시하지 않는다.
4. 후보 Release에서 EXE를 새로 다운로드해 SHA-256을 대조하고 Windows에서 실제 실행한다.
   실제 Google 로그인·유지·로그아웃, 업무별 핵심 흐름, 공개 브라우저 제출·교사 확인,
   QR·파일 출력·인쇄·저장·재시작을 가상 시험 자료로 검증한다. 계정·환경 접근이 없으면
   해당 필수 검증과 main 병합을 보류하고 필요한 권한과 재현 자료를 남긴다.
5. 필수 검증이 모두 통과하면 최신 main과의 차이를 다시 확인하고 조건부 squash 병합한다.
   다른 작업과 충돌하거나 main이 바뀌었으면 정리 후 영향 검사를 다시 한다.
6. main push의 `.github/workflows/portable.yml`은 웹·서버·Windows EXE 실행 검사가 성공한 뒤
   **새 main SHA**로 정식 `portable-v<version>-<sha12>` Release를 게시한다. 후보 EXE를 재명명하지 않는다.
7. 최종 Release와 모든 자산의 존재·크기·체크섬·대상 커밋을 확인하고 정식 EXE도 다운로드해
   Windows에서 실행한다. 웹·DB·Edge 배포 상태는 EXE 게시와 별도로 보고한다.

GitHub Actions Repository Variables에 위 세 공개 `VITE_` 변수가 필요하다. 릴리즈 job에만
`contents: write`를 부여한다. 릴리즈 스크립트는 깨끗한 커밋·EXE 크기/체크섬·동일 SHA의
성공한 실행 보고서를 요구하며 정식 게시 전 main SHA를 두 번 확인한다. 같은 tag가 다른
커밋을 가리키거나 기존 자산의 바이트가 다르면 중단한다. 동일한 검증 자산 재실행은 기존
게시 결과를 재사용한다. 재빌드로 바이너리가 달라졌다면 게시된 자산을 덮어쓰지 말고 원래
검증 artifact로 재개한다. 코드 서명 인증서가 없는 빌드는 unsigned이며 SmartScreen 신뢰를
검증했다고 보고하지 않는다.
