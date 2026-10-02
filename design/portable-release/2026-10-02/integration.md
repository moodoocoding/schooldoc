# Windows 포터블 통합 진행 일지 (codex)

2026-10-02, `5_배포판`의 로컬 완료를 인계받아 별도 통합 워크트리에서 진행한다.
사용자가 기존 계정을 시험용으로 지정했다. 이번 작업의 가상 업무만 생성·제출·정리하며,
기존 실제 업무·개인정보·다른 checkout의 미커밋 변경은 보존한다.

현재 배포 결과는 아래 ‘정식 릴리즈 및 다운로드 실행 확인 완료’에, 남은 일과 재개 절차는
‘다음 작업에서 이어갈 미완료 항목’에 기록한다. 앞선 실패·대기 상태는 해당 시점의 이력이다.

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
다시 검증한다. 이 수정 시점에는 실제 인증·기능 검증과 main 병합이 완료되지 않았다.


## 2026-10-02 사용자 예외 승인 및 main 통합

사용자가 main 병합·정식 배포를 요청했다. 실제 Google 로그인·Supabase 정상 업무·
Windows 네이티브 인쇄가 미검증임을 알리고 기존 “미실행이면 병합하지 마” 조건의
변경 여부를 확인했다. 사용자는 직접 **“예외를 허용”**이라고 답했다.
이번 배포의 예외이며 상시 AGENTS 검증 정책을 완화하지 않고, 미검증을 통과로 보고하지 않는다.

- PR49에 미검증 범위와 예외를 기록한 뒤 검증한 HEAD ea8bb01을 squash 병합했다.
- main 커밋: `22fa46f39ff8e8c544bbd25381d80370dadc0ea5`.
- main 제목: `feat(shared): 최신 기능의 Windows 포터블과 자동 릴리즈 추가`.
- 후보와 병합 main의 코드 tree diff가 없다. 원본 checkout의 기존 네 변경은 보존했다.
- 병합 직후 상태: main 자동 정식 릴리즈 Actions36950482565의 타입·린트·단위·Electron·Deno·웹 빌드가
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

## 다음 작업에서 이어갈 미완료 항목 (codex)

사용자가 미완료 내용도 GitHub에 남겨 다음 작업을 이어가도록 요청했다.
아래 상태는 main `22fa46f39ff8e8c544bbd25381d80370dadc0ea5`와 위 정식 EXE를 기준으로 한다.
**미검증은 성공을 확인하지 못했다는 뜻이며 오류가 확정됐다는 뜻이 아니다.**
이번 예외 승인으로 아래 항목이 완료된 것은 아니다. 후속 변경의 후보·병합·정식 배포는
[포터블 운영 절차](../../../docs/portable-release.md)의 기존 검증 조건을 따른다.

### 먼저 확보할 접근 조건과 시험 자료

- [ ] 기존 계정을 시험용으로 지정한 권한은 유효하다. 다만 실제 Google 인증은 완료하지
  못했다. 다음 작업 시작 시 해당 계정으로 정상 로그인할 수 있는지 먼저 확인하고,
  사용자 입력이 필요하면 초기에 알린다. 비밀번호·로그인 토큰을 문서나 로그에 남기지 않는다.
- [ ] EXE는 기본 브라우저의 Google 인증 후 앱의 PKCE 콜백으로 돌아와야 한다.
  Supabase redirect allowlist의 `http://127.0.0.1:*/callback**` 실제 등록 여부는 미확인이다.
  문서의 필요 패턴과 원격 설정을 비교하되 기존 웹 redirect·secrets·암호화 키를 덮어쓰지 않는다.
  인증 시작 응답만으로 allowlist나 로그인 성공을 판정하지 않는다.
- [ ] 이전 조작은 로그인 브라우저의 현재 URL을 확인할 수 없어 도구가 중단했다.
  다음에는 현재 URL을 확인할 수 있는 지원 도구와 정상 인증 흐름으로 재개한다.
  기존 Chrome 프로필의 토큰 복사나 인증·보안 장치 우회로 해결하지 않는다.
- [ ] 먼저 계정의 기존 업무·학급 명단 유무를 확인한다. 설정·1인 1역·학급 미션은 명단이
  공유되거나 화면 진입 시 자동 등록될 수 있다. 기존 실제 학급과 격리할 수 없으면 이 세
  기능의 쓰기 검사를 보류하고 빈 시험 계정 또는 명확히 격리된 시험 학급을 확보한다.
- [ ] `포터블 검증`처럼 식별 가능한 제목, 가상 학생·보호자, 2쪽 가상 PDF, 가상 Excel과
  제출 파일을 준비한다. 이번에 생성한 업무 ID와 파일 목록만 별도로 기록한다.
  기존 업무·개인정보는 수정·삭제하지 않으며, 정리는 이번 시험 자료만 대상으로 한다.

### 다운로드한 정식 EXE로 재개하는 순서

1. 보고 브랜치 `codex/portable-release-report-20261002`의 이 문서를 먼저 읽는다.
   기존 미커밋 변경을 보존하고, 코드 수정이 필요하면 최신 main 기준의 별도 `codex/` 브랜치를
   만든다. 아래 EXE는 이번 배포의 고정된 기준이며 새 main과 같다고 가정하지 않는다.
2. 아래처럼 **새 폴더**로 정식 자산 4개를 다시 받는다. EXE 체크섬, manifest의 커밋·파일명·
   크기, `SHA256SUMS.txt`, 게시 자산 digest를 대조한다. 최신 릴리즈가 바뀌었으면 이번 기준과
   새 대상의 차이도 기록한다. 기존 다운로드나 게시 자산을 덮어쓰지 않는다.

```powershell
$resumeDownloadDir = Join-Path $env:TEMP ('SchoolDoc-resume-' + [guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $resumeDownloadDir | Out-Null
gh release download portable-v1.0.1-22fa46f39ff8 --repo moodoocoding/schooldoc --dir $resumeDownloadDir
$resumeExePath = Join-Path $resumeDownloadDir 'SchoolDoc_Portable_1.0.1_22fa46f39ff8.exe'
$resumeExeHash = (Get-FileHash -LiteralPath $resumeExePath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($resumeExeHash -ne 'd5ebd9bc732dc274558683ef771e14eddfdbbe0feb3d447ffb96ed66454af823') {
  throw '정식 EXE 체크섬 불일치: 실행을 중단한다.'
}
```

3. 다운로드 EXE를 소스 폴더 없는 한글·공백 경로에서 실행한다. 전용 시험 프로필을 쓰고
   기존 앱 프로필을 삭제하지 않는다. 실제 인증 검증에서는 인증·서버 응답을 가로채지 않는다.
4. Google 로그인 → 앱 복귀 → 교사용 화면 접근 → 종료·재실행 시 로그인 유지 → 로그아웃 →
   관리 접근 제한 → 재로그인을 확인한다. 취소·만료·실패 후 다시 시도하는 복구도 확인한다.
5. 아래 기능을 한 개씩 마친 뒤 다음 기능으로 넘어간다. EXE 교사 화면과 실제 Chrome의
   참여자 화면을 함께 사용해 정상 제출과 교사 반영, 새로고침·재시작 후 유지까지 확인한다.
6. 출력 파일·Windows 인쇄와 시험 자료 정리를 완료하고, 항목별 증빙과 남은 한계를 갱신한다.
   오류를 고쳐 앱 코드가 바뀌면 새 후보 게시 → 재다운로드 → 실제 EXE 검증을 다시 진행한다.
   필수 검증이 막히거나 미실행이면 새 PR을 main에 병합하지 않는다.

### 기능별 실제 서버 검증 체크리스트

모든 항목이 현재 **미검증**이다. 정상 흐름뿐 아니라 잘못된 조회 조건·저장 실패·재시도 등
해당 기능의 오류 복구를 실제 사용 흐름으로 확인한다. 참여자 모바일 화면과 교사용 전체
화면을 각각 캡처하고, 증빙에는 가상 자료만 포함한다. 요청에 개인정보나 토큰이 포함되면
원문을 공개 로그에 저장하지 않는다.

| 순서·기능 | 다음에 확인할 정상 흐름·오류 복구 | 완료 증빙 |
| --- | --- | --- |
| 1. 학급 미션 | 시험 학급 격리·자동 명단 등록 확인 → 미션 발행 → 이름/개인 코드 조회 → 학생 완료·취소 → 교사 확인·새로고침. 동명이인·잘못된 코드·저장 충돌 복구 확인 | 실제 공개 링크/QR PNG, 학생 완료와 교사 확인의 구분, Excel 내용. 기존 미션 파기 금지 |
| 2. 1인 1역 | 기존 보드·명단 보호 조건 확인 → 가상 역할·기간 배정 → 학생 실천 → 교사 현황 반영. 저장 실패·재접속 확인 | 공개 참여 기록·교사 반영, QR PNG, 20칸 A4 안내문 출력. 실제 명단을 시험 명단으로 덮어쓰지 않음 |
| 3. 학생 결과 안내 | 가상 Excel 업로드 → 잘못된 조회 조건 후 정상 조회 → 확인·이의 제기 → 교사 답변 → 참여자 재조회 | 실제 공개 조회·교사 반영, 제공되는 PDF/Excel 내용과 QR 저장 |
| 4. 가정통신문 수합 | 2쪽 PDF 모두 표시 후 입력 → 전체 확인·제출 → 교사 결과. 페이지 실패·재시도 시 기존 입력 유지, 비동의·단일/복수 선택 의미 확인 | 원본 위치·모바일 응답, 교사 결과·Excel/PDF, QR PNG. 렌더 실패 중 제출 차단 |
| 5. 등록부 서명 | 가상 참석자 명단 생성 → 잘못된 조회 후 정상 조회 → 서명 → 교사 완료 현황 → PDF | 실제 서명·교사 반영, QR PNG, PDF 및 Windows 인쇄 |
| 6. 자료 수합 | 명단 있음/없음 → 가상 파일 제출·확인·재제출 → 교사 다운로드. 잘못된 파일·전송 실패·재시도 확인 | 실제 Storage 반영, 허용된 재제출 의미, 제공되는 Excel/ZIP과 QR PNG |
| 7. 특별실 예약 | 가상 특별실·일정 → 참여자 예약 → 교사 반영. 예약 충돌·저장 실패·재시도·조회 범위 확인 | 실제 예약·새로고침 반영, QR PNG. 빠른 알림을 쓰면 실제 권한 허용/거절과 동작을 별도 기록 |
| 8. 영수증 | 관리자 접근 가능 여부 확인 → 별도 가상 장부·수기 입력 → 확인 후 장부 반영 → 합계/잔액 → 종료·재실행·재로그인 | Excel·영수증 첨부 PDF, 계정/장부별 IndexedDB 원본과 localStorage 유지. 서버 백업으로 안내하지 않음 |
| 9. 진행 업무 | 이번 시험 업무만 대상으로 목록·건수·상태·각 관리 화면 이동·새로고침 확인 | 실제 업무와 목록 상태의 일치. 기존 업무 상태 변경 금지 |
| 10. 설정 | 전용 프로필의 테마·글자 크기·빠른 메뉴 변경 후 재시작. 학급 명단 공유/자동 등록은 격리 조건 확보 후 확인 | 저장값 유지·사용 흐름 확인. 기존 교사 프로필·명단 덮어쓰기 금지 |

영수증은 운영 미리보기 관리자 제한을 우회하지 않는다. AI 분석의 실제 외부 전송·서버
사용자/관리자 검사·한도 확인·분석 실패 후 수기 입력은 **별도 미검증**이다. 해당 권한과
외부 전송 안내를 확인한 가상 영수증으로 검사하고, 접근이 없으면 미실행 이유를 유지한다.

### 공통 미완료와 구현되지 않은 항목

| 항목 | 현재 상태·이유 | 재개 조건·완료 기준 |
| --- | --- | --- |
| 실제 Google 인증·원격 Supabase | 미검증. 인증 조작 중단으로 실제 정상 업무를 실행하지 못함 | 위 인증·10개 기능·오류 복구 완료. 실제 요청과 교사 반영 증빙을 모의 검사와 구분 |
| 실제 공개 링크/QR | 정상 참여 미검증. 이번 운영 Chrome 확인은 잘못된 가상 링크의 오류 화면까지 | QR PNG 저장·주소 해독·HTTPS 공개 화면 접속 → 제출 → EXE 교사 반영. QR PDF/캡처로 이미지 저장 대체 금지 |
| 실제 파일·저장 경로 | 원격 업로드/다운로드와 인증된 업무의 저장 유지 미검증. 모의 EXE 검사15항목은 통과 | 실제 PDF worker·업로드·다운로드 내용·재시작·계정/장부 격리 확인. 시험 Storage 삭제 확인 후 해당 시험 DB 행 정리 |
| Windows 인쇄 대화상자 | 미검증. Microsoft Print to PDF 존재 및 A4 엔진 출력만 확인 | 다운로드 EXE에서 실제 인쇄 대화상자 → 가상 자료 PDF 저장 → 전체 페이지 A4 잘림·겹침 확인. 실물 프린터 출력은 장비 확보 시 별도 확인 |
| 원격 인증·소유자 격리 | 실제 RLS/Auth/Realtime 미검증. 데모·Deno·HTTP/PGlite 성공으로 대체하지 않음 | 허용된 시험 계정·자료로 원격 검사. 다른 소유자 격리는 별도 허용된 시험 계정 2개 확보 후 확인 |
| SmartScreen·코드 서명 | `NotSigned`. 실제 최초 다운로드 신뢰 검증 미실행, 코드 서명 미구현 | Windows 기본 보안 설정에서 첫 실행 결과 기록. 차단 우회로 성공 처리하지 않음. 서명 구현 시 인증서·CI 접근 조건을 별도 확보 |
| 이전 file:// 베타 저장 자료 이관 | 자동 이관 미구현 | 요청 범위 확인 후 구버전 프로필·백업을 보존하는 이관 설계와 가상 자료 검증. 현 EXE가 자동 이관한다고 안내하지 않음 |
| 정식 게시 첫 실행 안정성 | 미확정. 초안 생성 직후 메타데이터 검사 실패, 검증 산출물로 publish 재실행 성공 | 조회 지연은 추정. 게시 스크립트·로그·독립 검사로 원인 확인 후 필요한 수정. SHA·digest·dirty/main 확인을 완화하거나 게시 자산을 덮어쓰지 않음 |

원격 검사 전에 `tests/integration/`의 대상 테스트와 현재 설정을 읽는다.
`npm run test:integration:registry`는 등록부 하나가 아니라 `**/*.remote.test.ts` 전체를
실행하므로 바로 실행하지 않는다. 생성·제출·삭제 범위와 시험 환경을 확인한 파일 필터 또는
전용 설정으로 실행하고, 대상별 결과를 기록한다. 예를 들어 가정통신문만 허용된 경우
`npm run test:integration:consent`도 먼저 시험 대상·환경 변수·정리 범위를 확인한다.

코드 수정 시 관련 검사와 필요한 서버 검사를 수행한다. 여러 기능·빌드 변경이면
`npm run typecheck`, `npm run lint`, `npm test`, `npm run test:desktop`,
`npm run test:e2e`, `npm run test:server-flow`, `npm run build` 및 관련 Deno 검사를 실행한다.
최종 커밋의 후보/정식 EXE 검증과 원격 검사는 별도 결과로 기록하고,
통과시키려고 테스트를 삭제하거나 기대값을 완화하지 않는다.

### 남겨둔 로컬 증빙과 다음 완료 기록

- 로컬 `test-results/portable-integration/`의 `progress.md`, `checkpoint.json`,
  `stable-live-context.json`, 정식 다운로드·실행 JSON, 화면 캡처와 가상 fixture는 Git 무시 자료다.
  **새 clone에는 없으므로 이 문서와 게시 자산만으로 재개할 수 있게 위 절차를 남겼다.**
- `stable-live-context.json`은 당시 정식 EXE 연결 정보다. 프로세스·포트·프로필·커밋을 재확인한다.
  오래된 `live-context.json`이나 `live-helpers.mjs`는 후보 EXE를 가리킬 수 있으므로 그대로
  사용하지 않는다. 준비된 `live-*.mjs`는 실제 원격 실행을 완료한 검증 결과가 아니다.
- 공용 외부 `schooldoc-docs/development-history.md`는 확인 시 존재하지 않았다. 원본 checkout의
  미커밋 개발일지는 변경하지 않고, 이 추적 문서에 재개 기준을 보존한다.
- 후속 완료 기록에는 실행 시각·코드 SHA·후보/정식 URL·EXE 파일명/SHA-256·실제 Windows/Chrome
  환경·인증/데모/모의 구분·기능별 정상/복구 결과·시험 자료 정리 결과를 남긴다.
  막힌 항목은 이유·필요한 접근·다음 행동을 유지한다. 로그에 비밀값과 실제 개인정보를 넣지 않는다.
