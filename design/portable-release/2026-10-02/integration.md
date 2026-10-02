# Windows 포터블 통합 진행 일지 (codex)

2026-10-02, `5_배포판`의 로컬 완료를 인계받아 별도 통합 워크트리에서 진행한다.
사용자가 기존 계정을 시험용으로 지정했다. 이번 작업의 가상 업무만 생성·제출·정리하며,
기존 실제 업무·개인정보·다른 checkout의 미커밋 변경은 보존한다.

## 기준과 상태

- 기준 main: `32abb3af88e9957bfa0aae73b19ee706f8601c4e`.
- 개발 인계: `cce537128c9e72aea0bacdf0cd9ffae379c1d4da`의 목적별 4개 커밋.
- 통합 PR: [#49](https://github.com/moodoocoding/schooldoc/pull/49).
- 공개 연결 Repository Variables 3개만 설정했다. 서버 secrets·DB·Edge Functions 변경은 해당 없음.
- 원본 checkout의 영수증 관련 4개 변경과 개발 워크트리의 디자인 증빙 55개를 포함하지 않았다.
- 공용 외부 개발일지는 이 checkout에 없어 확인하지 못했다.

## 실제 Actions에서 발견한 검사 문제

1. [첫 실행](https://github.com/moodoocoding/schooldoc/actions/runs/36934592882)의
   한국 날짜 검사가 Linux UTC 실행 시각에 의존했다. 제품 동작과 기대 날짜를 유지하고
   시험 입력에 한국 offset을 명시했다. UTC 한국 자정 경계 검사도 추가했다.
   UTC 전체 단위 504개, Asia/Seoul 관련 날짜 20개 통과. 수정 커밋 `836ed45`.
2. [다음 실행](https://github.com/moodoocoding/schooldoc/actions/runs/36934942672)은
   타입·린트·단위 504개·Electron 경계·Deno 서버·웹 빌드 통과 후
   Chrome 전체 E2E 281개 통과·1개 실패·5개 생략이었다.
   자료 수합 테스트가 제출 완료 전에 새로고침해 저장을 중단했다.
   실패 화면과 비동기 저장 코드를 확인하고 제출 성공 대기를 추가했다.
   재제출 금지·동명이인·빈 검색·오류 기대값은 변경하지 않았다.
   해당 실제 Chrome E2E 3회 연속, 타입·린트 통과(기존 경고 6개).

테스트를 삭제하거나 기대값을 완화하지 않았다. 실패한 두 실행은 Windows 패키징과
정식 릴리즈 단계로 진행하지 않았다. 데모 Chrome·모의 인증·로컬 HTTP/PGlite 검사를
원격 Google/Supabase 사용 흐름 검증으로 보고하지 않는다.

## 후속 단계와 완료 기준

| 단계 | 현재 상태 | 완료 기준 |
| --- | --- | --- |
| 전체 PR Actions | 통과 | 최종 후보 ea8bb01의 Actions36940446473 verify/package 성공 |
| 후보 사전 릴리즈 | 게시 완료 | [최종 후보 ea8bb01](https://github.com/moodoocoding/schooldoc/releases/tag/portable-rc-v1.0.1-ea8bb0115f56), 자산 4개, prerelease/latest=false |
| 후보 재다운로드 | 통과 | 네 자산 digest·manifest·EXE SHA-256 일치, 다운로드 EXE 자동 검사 15항목 통과(모의 인증·서버) |
| 후보 실제 사용 | 일부 확인·예외 승인 | Windows 11 x64 소스 없는 한글/공백 경로 실행. 실제 Google·Supabase 정상 업무·네이티브 인쇄는 미검증 |
| main squash 병합 | 완료 | 사용자 미검증 예외 명시 승인 후 [main22fa46](https://github.com/moodoocoding/schooldoc/commit/22fa46f39ff8e8c544bbd25381d80370dadc0ea5)로 PR49 병합 |
| main 자동 정식 릴리즈 | 게시 완료 | [Actions36950482565](https://github.com/moodoocoding/schooldoc/actions/runs/36950482565) attempt2 성공. verify/package 산출물 유지, 게시 단계 재개 |
| 정식 재다운로드·실행 | 확인 완료·예외 유지 | 네 자산 digest 일치, 다운로드한 EXE 모의 검사15항목 통과 및 실제 서버/비로그인 프로필 실행 확인. 실제 인증 업무·네이티브 인쇄는 미검증 |

필수 기능은 학생 결과 안내·가정통신문·자료 수합·등록부 서명·특별실 예약·1인 1역·
학급 미션·영수증·진행 업무·설정이다. 정상 흐름과 오류 복구, 공개 링크/QR·PDF worker·
파일 업로드·다운로드·Windows 인쇄·localStorage/IndexedDB 재시작을 확인한다.
가상 PDF·명단·결과·제출 파일 5개를 준비했고 Microsoft Print to PDF를 확인했다.
실제 계정 인증은 이번 검증에서 완료하지 못했으며, 미검증 범위로 기록한다.

전체 진행 체크포인트는 무시된 `test-results/portable-integration/progress.md`와
`checkpoint.json`에 연속 기록한다. 게시 후보·정식 자산과 실제 검증 결과는 위 PR에
갱신하여 인계 기록의 미실행 항목과 구분한다. 후속 진행과 이번 사용자 예외는 아래에 이어서 기록한다.

## 후보 게시 자동화의 실제 오류와 수정

`5ca5970`의 전체 Actions는 성공했다. 단위 504개, Electron 경계 10개,
Deno 38개·20 steps, Chrome E2E 282개·5개 생략 및 별도 HTTP/PGlite 5개,
Windows EXE 빌드와 모의 인증을 사용하는 실제 EXE 자동 검사 15항목이 통과했다.

첫 후보 초안에는 검증한 자산 4개가 업로드됐으나, 게시 전 tag 조회가 404로 중단됐다.
GitHub tag 조회는 게시된 릴리즈를 반환하므로 초안을 목록에서 찾아 ID로 확인하도록 고쳤다.
부분 업로드의 안전한 재개와 초안 digest 불일치 게시 차단 검사를 추가해 경계 검사 12개가 통과했다.
실패한 초안과 자산은 덮어쓰지 않고 보존한다. 기존 정식 latest는 바뀌지 않았다.

게시 자동화 수정은 EXE 앱 코드를 바꾸지 않는다. 통과한 기존 후보로 실제 인증을 우선
확인할 수 있으나, 병합 대상 새 커밋은 전체 CI·새 후보 게시·재다운로드·실제 실행으로
다시 검증한다. 실제 인증·기능 검증과 main 병합은 아직 완료되지 않았다.


## 2026-10-02 사용자 예외 승인 및 main 통합

사용자가 main 병합·정식 배포를 요청했다. 실제 Google 로그인·Supabase 정상 업무·
Windows 네이티브 인쇄가 미검증임을 알리고 기존 “미실행이면 병합하지 마” 조건의
변경 여부를 확인했다. 사용자는 직접 **“예외를 허용”**이라고 답했다.
이번 배포의 예외이며 상시 AGENTS 검증 정책을 완화하지 않고, 미검증을 통과로 보고하지 않는다.

- PR49에 미검증 범위와 예외를 기록한 뒤 검증한 HEAD ea8bb01을 squash 병합했다.
- main 커밋: `22fa46f39ff8e8c544bbd25381d80370dadc0ea5`.
- main 제목: `feat(shared): 최신 기능의 Windows 포터블과 자동 릴리즈 추가`.
- 후보와 병합 main의 코드 tree diff가 없다. 원본 checkout의 기존 네 변경은 보존했다.
- main 자동 정식 릴리즈 Actions36950482565의 타입·린트·단위·Electron·Deno·웹 빌드가
  통과했고, 전체 Chrome E2E 단계가 진행 중이다. Windows 패키징·정식 게시는 아직 대기다.
- 운영 프런트엔드 적용 확인: GitHub Production deployment `6799016255` 성공,
  [운영 사이트](https://schooldoc-nine.vercel.app),
  [배포 식별 URL](https://schooldoc-2ssf0al75-panthea0-9353s-projects.vercel.app).
- 실제 Chrome154에서 홈페이지(1360x900), 비로그인 교사용 7경로, 잘못된 가상 공개 링크
  7경로(390x844)를 검사했다. 가로 넘침·pageerror가 없고 전체 화면을 캡처·시각 확인했다.
  인증된 정상 업무·실제 제출 확인과 구분한다. 실제 업무 생성·변경·삭제는 하지 않았다.
- DB 마이그레이션·Edge Functions·서버 secrets·암호화 키 변경은 해당 없음이다.
- 컴퓨터 제어는 후보 EXE 화면·Google 로그인 시작까지 성공했으나, 로그인 브라우저의 URL을
  확인할 수 없어 도구가 해당 턴 조작을 중단했다. 이는 로그인 성공이나 인쇄 성공이 아니다.
- 정식 게시 뒤 네 자산 다운로드·digest/체크섬·실제 EXE 실행을 확인하고 아래에 결과를 남긴다.


## 정식 릴리즈 및 다운로드 실행 확인 완료

이번 배포는 사용자가 승인한 **미검증 예외가 적용된 정식 배포**다. 필수 실제 인증 업무와
네이티브 인쇄를 모두 검증한 배포라고 보고하지 않는다.

- 정식 릴리즈: [portable-v1.0.1-22fa46f39ff8](https://github.com/moodoocoding/schooldoc/releases/tag/portable-v1.0.1-22fa46f39ff8).
  draft=false, prerelease=false이며 GitHub latest다. 태그는 main22fa46과 일치한다.
- EXE: `SchoolDoc_Portable_1.0.1_22fa46f39ff8.exe`, 101,073,042 bytes.
- SHA-256: `d5ebd9bc732dc274558683ef771e14eddfdbbe0feb3d447ffb96ed66454af823`.
- 후보: [portable-rc-v1.0.1-ea8bb0115f56](https://github.com/moodoocoding/schooldoc/releases/tag/portable-rc-v1.0.1-ea8bb0115f56),
  SHA-256 `fa5cc80fe5433d0780a31fd3f75c946d5a0eda9db65552628f51b0dad9997595`.

### 게시 실패와 안전한 재개

첫 main 실행에서 verify와 Windows package 및 EXE 실행 검사는 성공했으나,
초안 생성 직후 `Draft release metadata mismatch`로 게시 단계가 중단됐다.
생성된 초안401481559의 대상 SHA와 빈 자산을 확인했다. 같은 main 커밋의 검증 산출물을
유지하고 **실패한 publish 단계만 재실행**해 attempt2에서 verify/package/publish 모두
성공했다. 실패한 파일을 정식 최신으로 게시하지 않았고 검사나 기대값을 완화하지 않았다.
초안 생성 직후 조회 지연 가능성은 추정이며, 이번 재실행으로 초안 재개가 실제 성공했다.
새 게시 자동화 코드를 추가로 수정했다거나 근본 원인을 확정했다고 보고하지 않는다.

### main의 실제 검사 결과

| 검사 | 결과 | 범위·한계 |
| --- | --- | --- |
| npm ci / npm run typecheck / npm run lint | 통과 | audit0, 기존 lint 경고6개 |
| npm test | 통과 | 단위504개·64파일 |
| npm run test:desktop | 통과 | Electron/PKCE/게시 경계12개 |
| Deno 서버 검사 | 통과 | 38개·20 steps, 모의 계약·SQL 검사 |
| npm run build | 통과 | 기존 chunk 크기 경고 |
| npm run test:e2e | 통과 | 실제 Chrome 데모282개·별도 서버5개 생략 |
| npm run test:server-flow | 통과 | 위5개 Chrome→HTTP→PGlite 검사. 원격 Auth/Realtime와 구분 |
| Windows EXE 빌드·CI 실행 | 통과 | 실제 EXE15항목, 모의 인증·서버 |
| 게시 자산 재다운로드 | 통과 | EXE/SHA256SUMS/manifest/smoke 네 자산의 GitHub digest·크기·main SHA 일치 |
| 다운로드한 정식 EXE 실행 재검증 | 통과 | 한글/공백 경로·8도구 이동·2쪽 PDF worker·파일 다운로드·A4 엔진·localStorage/IndexedDB·재시작·로그아웃15항목. 모의 인증·서버 |
| 정식 EXE의 실제 서버 환경 시작 | 통과 | 별도 빈 시험 프로필, 소스 없는 폴더, main SHA/dirty=false/secure origin/sandbox/로그인 전 관리 제한, pageerror0. 인증·서버 가로채기 없음 |
| 실제 Google·Supabase 정상 업무·네이티브 인쇄 | 미검증 | 사용자가 이번 배포에만 예외 승인 |

실행 환경은 Windows 11 Pro 10.0.26200 x64, 운영 웹 검사는 Chrome154.0.8037.58이다.
정식 EXE 홈페이지와 2쪽 PDF 렌더링의 전체 화면을 캡처·시각 확인했다. EXE는 `NotSigned`이며
SmartScreen 신뢰 검증은 하지 않았다. 이전 file:// 베타 저장 자료 자동 이관은 구현되지 않았다.
학생 결과 안내·가정통신문·자료 수합·등록부·특별실·1인1역·미션·영수증·진행 업무·설정의
실제 인증된 정상 흐름과 오류 복구는 미검증이며, 자동 데모/모의 검사를 원격 성공으로 바꾸지 않았다.

코드 main 병합·운영 웹 적용·정식 EXE 게시 및 재다운로드 실행은 확인했다. 최종 검증 일지는
별도 문서 브랜치 `codex/portable-release-report-20261002`에 목적별 문서 커밋으로 보존한다.
원본 checkout의 영수증 관련 변경과 개발 세션의 디자인 증빙을 변경하거나 삭제하지 않았다.
