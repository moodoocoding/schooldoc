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
| 전체 PR Actions | 재실행 예정 | 같은 PR HEAD의 검사·Windows 패키징·실제 EXE 자동 검사 통과 |
| 후보 사전 릴리즈 | 미실행 | 검증한 CI 산출물 4개 게시, prerelease이며 latest가 아님 |
| 후보 재다운로드 | 미실행 | 게시 자산 digest·manifest·EXE SHA-256 일치 |
| 후보 실제 사용 | 미실행 | 한글/공백 경로에서 소스 없이 실행, 실제 Google·Supabase·참여자 Chrome·저장/재시작·출력 검증 |
| main squash 병합 | 보류 | 필수 검증 전부 통과, 최신 main 반영. 막힘/미실행이면 병합 금지 |
| main 자동 정식 릴리즈 | 미실행 | 병합 main SHA의 검사·Windows EXE 실행·게시 성공 |
| 정식 재다운로드·실행 | 미실행 | 새 정식 EXE 체크섬·실제 필수 흐름 확인 후 완료 보고 |

필수 기능은 학생 결과 안내·가정통신문·자료 수합·등록부 서명·특별실 예약·1인 1역·
학급 미션·영수증·진행 업무·설정이다. 정상 흐름과 오류 복구, 공개 링크/QR·PDF worker·
파일 업로드·다운로드·Windows 인쇄·localStorage/IndexedDB 재시작을 확인한다.
가상 PDF·명단·결과·제출 파일 5개를 준비했고 Microsoft Print to PDF를 확인했다.
실제 계정 선택·비밀번호·MFA는 사용자가 직접 수행한다.

전체 진행 체크포인트는 무시된 `test-results/portable-integration/progress.md`와
`checkpoint.json`에 연속 기록한다. 게시 후보·정식 자산과 실제 검증 결과는 위 PR에
갱신하여 인계 기록의 미실행 항목과 구분한다. 아직 정식 배포 완료 상태가 아니다.

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
