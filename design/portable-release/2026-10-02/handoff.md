# 포터블 배포판 구현·검증 인계 (codex)

기준 main은 `32abb3af88e9957bfa0aae73b19ee706f8601c4e`, 개발 브랜치는
`codex/portable-release`다. 이 세션은 로컬 구현·검사·커밋만 수행했다.
push·PR·후보 게시·게시 자산 다운로드 검증·main 병합·정식 Release와 운영 배포는 미실행이다.
필수 실제 인증/통합 검증이 남아 있어 아직 main 병합 가능한 상태로 보고하지 않는다.
최종 SHA와 파일 크기·체크섬은 최종 `release/portable-manifest.json`과 로컬
`test-results/portable/handoff.json`을 확인한다. 완료 메시지에도 절대 경로와 SHA를 제공한다.

## 구현

| 범위 | 파일·동작 |
| --- | --- |
| 런타임 | `electron/`: 고정 secure origin, sandbox, 제한된 preload/IPC, 외부 브라우저, PKCE code 콜백 |
| 웹 호환 | `src/main.tsx`, `src/utils/desktop.ts`, 인증 client/provider, 미션 검색값·역할 이동 확인·공개 링크 helper |
| 패키징 | `electron-builder.yml`, `vite.config.ts`, `scripts/build-portable.mjs`, package/lock 및 출력 ignore |
| 검사·CI | `portable.yml`, 실제 EXE 검사, 로컬 HTTP/SQL 실행, 게시 스크립트, Electron/게시 방지 테스트 |
| 회귀 검사 수정 | 가상 Supabase 설정, 별도 출력 폴더, 두 상태 메시지의 내용 기반 선택 |
| 보안 패치 | 전이 의존성 DOMPurify 3.4.16만 고정. npm audit 경고 0건 |
| 작업 지침 | AGENTS 기존 사용자 정책 보존·후보 검사와 병합 보류 조건 추가, README/DEVELOPMENT 및 운영 절차 |

전자 앱에 포함된 파일 whitelist와 실제 ASAR 목록을 확인했다. 프런트엔드 원본 소스·시험 자료·scripts·node_modules·
`.git`·`.env`·SECRETS 파일은 포함되지 않는다. 런타임이 사용하는 공개 연결 정보 이외의
키를 복사하거나 출력하지 않았다. Supabase DB·Edge·암호화·RLS 및 원격 설정은 바꾸지 않았다.
다른 checkout의 미커밋 영수증 PDF/코드/일지를 가져오지 않았다.

## 로컬 검증

| 명령·검사 | 결과·한계 |
| --- | --- |
| `npm ci` | 통과. 보안 패치 후 audit 0건 |
| `npm run typecheck` | 통과. 루트 참조 tsconfig에 대한 임의 tsc 명령으로 대체하지 않음 |
| `npm run lint` | 통과. 기존 경고 6개 유지, 이번 추가 파일 경고는 수정 |
| `npm test` | 64파일·503개 통과 |
| `npm run test:desktop` | 10개 통과: 경로·PKCE·nonce·취소·만료·잘못된 HTTP 및 게시 방지·재실행·main 전진 |
| 전체 `npm run test:e2e` | 보안 패치 후 최종 전체 282개 통과·5개 생략(9.4분). 생략 5개는 별도 실행에서 통과 |
| `npm run test:server-flow` | 일반 E2E에서 생략한 5개 모두 통과. Chrome → 실제 HTTP handler → PGlite 경로. 원격 Auth/Realtime 아님 |
| Deno 서버 검사 | `38 passed (20 steps), 0 failed`. 미션·역할·등록부·특별실 계약 및 역할/특별실 SQL |
| `npm run build` | 통과. 기존 500kB chunk 경고 유지 |
| `npm run electron:build:portable` | clean 코드 커밋 `6ac4e5e`의 Windows x64 EXE 생성 성공. 문서 커밋 이후 최종 SHA 증빙은 handoff.json |
| `npm run test:portable` | clean 코드 커밋의 실제 로컬 EXE 15항목 통과·pageerror 0건. 최종 SHA 증빙은 handoff.json |
| ASAR 목록 | 코드 커밋의 28개 경로, 제외 대상 일치 0건. 최종 목록 검사는 handoff.json |
| `actionlint 1.7.12` | 워크플로 문법·식 통과. 실제 GitHub Actions 실행은 미검증 |
| 서명 | Authenticode `NotSigned`. builder의 signtool 로그를 신뢰된 코드 서명으로 보고하지 않음 |

서버 검사 재현 명령(Deno 2.9.6):

```bash
deno test --no-lock --allow-env --allow-read --node-modules-dir=none tests/server/classMissions.test.ts tests/server/classMissionsRegression.test.ts tests/server/classroomRoles.test.ts tests/server/classroomRolesSql.test.ts tests/server/registryPublic.test.ts tests/server/specialRooms.test.ts tests/server/specialRoomsSql.test.ts
```

로컬 환경의 전체 E2E는 `CI=true`, `PLAYWRIGHT_TEST_PORT=4187`로 별도 Vite를 실행했다.
서버 흐름 명령은 `DENO_BIN`으로 설치된 Deno 실행 파일을 지정할 수 있다. 시험 서버는
127.0.0.1:4196, 별도 Vite는 4195를 사용한다. 포트를 다른 프로세스가 쓰면 재사용하지 않는다.

로컬 증빙은 `playwright-report/index.html`, `playwright-report/server-flow/index.html`,
`test-results/portable-local/`에 있다. 최종 clean SHA의 EXE 증빙은 `test-results/portable/`에 저장한다.
기본 검사 보고서는 실제 인증을 `not-tested`, `mockedBackend: true`로 표시한다.
공통 IndexedDB/localStorage 재시작 검사는 특정 영수증 장부 전체 이관 검사와 구분한다.

## 발견·수정

- 가상 서버 설정이 없는 checkout에서 공개 가정통신문 원격 형태 검사가 연결 설정 오류로
  실패했다. 가상 주소를 고정해 가로채는 요청만 사용하도록 수정했다.
- 설정 안내와 저장 결과의 `role=status`가 중복됐다. 원하는 메시지를 내용으로 선택하도록
  검사만 수정했다. 제품의 접근 가능한 상태 표현은 없애지 않았다.
- 숨긴 Electron 창의 캡처가 멈췄다. 실제 창을 `showInactive`로 표시하고 종료를 보완했다.
- builder의 압축 해제 폴더 rename이 EPERM으로 실패했다. Electron 44의 별도 바이너리 설치를
  명시하고 설치된 고정 배포본을 `electronDist`로 사용해 재현 가능한 빌드를 확인했다.
- 시험 응답의 역할/특별실 데이터 형식을 실제 API 계약에 맞추고 업무 제목까지 검사한다.
- Electron은 CDP `Page.printToPDF`를 제공하지 않았다. 시험용 loopback Node 디버거에서 제품의
  네이티브 `webContents.printToPDF`를 호출한다. 제품에 시험 IPC나 서버 우회 권한을 추가하지 않았다.
- CDP 다운로드 위치와 Playwright `saveAs`의 임시 경로가 달랐다. 실제 저장 파일명·바이트를
  폴더에서 검증하고 두 쪽 PDF 렌더링은 로딩 종료와 그려진 픽셀까지 기다리도록 강화했다.
- artifact 업로드의 공통 상위 폴더 문제를 방지하기 위해 네 게시 파일을 단일 staging 폴더에
  모았다. 게시 스크립트는 네 파일 모두 크기·digest를 대조한다.

## AI 모의 화면 검토

세 프로파일을 구현 전에 읽었다. 기존 화면의 디자인·배치를 변경하는 작업은 아니므로
여섯 전문가를 실제로 호출하거나 무의미한 독립 평가를 만들지 않았다. 아래는 AI의 모의 판단이다.

| 관점 | 구현 전 판단 | 구현 후 근거·남은 위험 |
| --- | --- | --- |
| 웹디자인 | 기존 업무 카드·화면 밀도 보존, 전체 창 캡처 필요 | EXE 전체 홈·8개 업무 캡처에서 제목·카드 위계·빈 공간과 가로 넘침을 확인. PDF 준비/렌더링 상태를 구분. Windows 사용자 DPI 및 모든 자료 규모는 별도 실기기 검증 필요 |
| UX | 앱 주소를 QR로 배부하지 않기, HashRouter 검색·이동과 입력 유지 | HTTPS 공개 helper·미션 검색값·역할 이동 확인 수정. 웹 E2E의 가상 제출/교사 확인·오류 복구와 EXE 저장/재시작 통과. 실제 Google·공개 브라우저와 EXE 연동은 인계 |
| UI | 기존 접근 가능한 이름·키보드·반응형 유지, PDF/출력 재검사 | 전체 웹 검사에서 모바일·확대·대표 0/24/60명·긴 이름·상태와 출력 흐름 확인. EXE 8개 제목·가로 넘침·PDF 렌더링·다운로드·A4 엔진 검사. 실제 Windows 프린터 대화상자와 SmartScreen은 미검증 |

실제 전문가 6명·담임교사 인터뷰·사용성 시험·승인을 받지 않았다.
외부 공용 개발일지와 `pro/ux-ui-expert.md`는 이 checkout에 없어 확인하지 못했다.

## 메인 통합 세션의 필수 후속 작업

1. 로컬 최종 HEAD와 최신 origin/main을 확인한다. 이 브랜치의 목적별 커밋을 사용하고 기존
   디자인 증빙의 미커밋 변경이나 공유 checkout의 영수증 변경을 PR에 섞지 않는다.
2. 공개 Repository Variables 3개와 Supabase loopback redirect allowlist를 확인한다.
   현재 세션에서 원격 설정을 조회·변경하지 않았으며 실제 Google 로그인을 실행하지 못했다.
3. push/PR 후 verify/package job이 같은 PR head SHA로 통과하는지 확인한다. release artifact를
   이용해 candidate 명령으로 prerelease를 게시한다. 실제 Actions를 실행하기 전에는
   문법·모의 게시 검사 성공을 원격 자동화 성공이라고 보고하지 않는다.
4. 후보에서 직접 다운로드하고 체크섬을 대조한 EXE를 실제 Windows에서 실행한다.
   실제 Google 로그인·세션 재시작·로그아웃, 사용자별 격리와 관리자 접근, 8개 업무 핵심 흐름,
   공개 브라우저의 가상 제출과 EXE 현황 갱신, QR PNG·Excel/ZIP/PDF·인쇄를 확인한다.
   영수증은 원본·장부와 재시작 보존, 기존 베타 프로필 필요 시 이관도 확인한다.
5. 필수 인증/연동을 실행할 수 없거나 실패하면 **main 병합을 보류**한다. 로그인된 시험 계정,
   해당 Supabase 프로젝트 접근 또는 redirect 설정 등 필요한 정확한 조건을 요청한다.
   server secrets·실제 학생 자료·암호화 정책을 임의로 변경하지 않는다.
6. 모두 통과하면 최신 main에 조건부 squash 병합한다. 새 main SHA의 Actions 산출물과
   정식 Release를 확인하고 새 EXE를 다시 다운로드해 체크섬·Windows 실행을 검증한다.

운영 웹/DB/Edge 배포는 모두 미적용이다. 이 변경은 원격 서버 마이그레이션이나 Edge 함수
수정이 없으며 EXE 게시만으로 서버 반영을 보고하지 않는다.

자동 승인 검토는 기존 `design/` 증빙 복원을 사용자 변경 유실 가능성으로 거부했다.
해당 변경은 보존하며 이 브랜치 커밋에 포함하지 않는다. 최종 EXE는 최종 커밋의 별도
임시 checkout에서 빌드해 clean SHA를 증명하고 원래 워크트리의 파일을 되돌리지 않는다.
