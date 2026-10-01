# 등록부 서명 기능별 개발 기록

## 2026-10-01 등록부 서명 워크플로우·디자인·오류 리뷰 (codex)

- 기준 `c208afefca40bb4f15cab164fc292661e80fb9a0`, 브랜치 `codex/feature-review-registry-20261001`, 이 대화의 전용 관리 워크트리에서 검토했다. 공유 checkout/다른 워크트리/공용 일지/제품 코드/기존 테스트는 수정하지 않았다.
- [리뷰 보고서](../design/feature-reviews/2026-10-01-registry/review.md)에 교사 생성·수기/Excel 명단·공개 설정·참여자 검색/서명·수정/재제출·현황·서명 원본·출력·보관/파기 워크플로우와 10개 휴리스틱, 세 프로파일, 여섯 AI 모의 관점, R1~R12의 우선순위·코드 위치·재현·영향·수정 요구·완료 기준을 기록했다. 실제 전문가/교사 시험 결과가 아니다.
- 우선 발견: 동일 마스킹 동명이인 식별 불가, 학교 IP 24명 제출 중 14명 제한, 서명 행 저장 뒤 항목 실패500→재시도409, 검색 오류 뒤 이전 결과 선택, 파일 오류의 미서명/빈 PDF 처리, 4열·긴 값 A4 잘림. 데모 다중 PDF/브라우저 인쇄 오류와 현장 입력 취소 복구·가져오기 교체·공개 설정 변경·보관 생명주기 공백도 남겼다. 모두 미수정이다.
- 정상 흐름: 수기·헤더/별칭 Excel 가져오기·생성·비밀번호·QR PNG 저장·링크 복사·서명·현황 필터·Excel·교사 재서명·종료/재개·데모 삭제/링크 무효화. Storage remove 성공 응답 뒤 잔존 파일을 재확인하고 중단하는 함수는 소스 모의로 확인했다.
- 실제 설치 Google Chrome 154 headless, 전용 4182 strictPort, 전용 context와 가상 0/24/30/41/500명 자료를 사용했다. 교사 데스크톱·참여자 모바일·미완료/완료·오류·키보드·CSS200 전체 캡처와 QR/Excel/PDF/서명 원본을 보존했다. Chrome 모바일 DPR3 터치 에뮬레이션의 좌표·스크롤·지우기도 확인했다. 물리 휴대전화/교실 전자칠판/프린터 시험은 아니다.
- 검증: 기존 등록부 Chrome E2E 9/9 통과, 단위 4파일 36개 통과. observe/output/touch 관찰 도구 완료·observe pageerror0·추가 axe 위반0, 서버 소스 모의 probe 완료, 관찰 도구4개의 node 구문 검사 통과. 24명2쪽/41명3쪽/경계1쪽/브라우저 인쇄4쪽의 PDF 전체 렌더에서 출력 결함을 확인했다. 결함 관찰 기대값의 통과를 수정 성공으로 보고하지 않는다.
- 한계: 실제 JWT/RLS/PostgreSQL/Storage/기기 간 공유 미검증. Deno와 운영 PDF fontkit 실행 의존성이 없어 서버 타입/운영 PDF 전체 생성 미실행. 제품 변경 없는 문서 리뷰라 typecheck/lint/전체 단위/build 미실행. 실제 생성/제출/삭제가 있는 원격 integration은 요청의 금지 범위라 미실행. 운영 키/실제 학생 자료/운영 로그인/배포를 사용하지 않았다.
- 외부 공유 일지와 `pro/ux-ui-expert.md`는 없었다. 현재 checkout의 기존 공용 기록은 참고만 했으며 과거 이력을 복원하거나 쓰지 않았다. 이 독립 일지는 부모 대화가 이후 순서대로 통합할 자료다. 다른 대화로 별도 메시지를 보내지 않았다.
- 문서 검증: 보고서·일지 링크 84개 모두 유효, 증거 4개 PDF 총 10쪽 A4 크기 확인, staged diff 공백 검사 통과, 제품·기존 테스트 diff 없음. E2E 결과 JSON의 위치를 바로잡고 관찰 도구 config의 출력 경로를 맞췄다.
- Git 상태: 리뷰 자료 커밋 `9b4d8c103dae9e7ae1724ce7a15f9fa826021f26` (`docs(registry): 등록부 서명 워크플로우와 오류 리뷰 기록`). 이 일지는 별도 로컬 문서 커밋으로 남긴다. GitHub push·PR·main 병합 미실행. DB·Edge Functions·프런트엔드 운영 배포 해당 없음.
- 남은 일: R1~R5의 서명 대상/상태/제출 복구를 우선 수정하고 R6의 출력 완전성을 검증한 뒤 R7~R12 처리. 시험 환경이 허용되면 서버 권한·SQL 트랜잭션·실제 부하·운영 PDF와 기기/프린터 검증을 별도로 수행한다.

## 2026-10-02 등록부 R1~R12 수정·Supabase I/O 최적화와 Chrome 재검증 (codex)

- 사용자 요청에 따라 코드 수정·실제 Chrome 조작·작업 일지 갱신을 수행했다. 전용 관리 워크트리의 `codex/fix-registry-io-20261001`에서 작업했고 공유 checkout·다른 작업의 변경은 보존했다. 이전 리뷰의 발견 당시 기록은 그대로 두었다.
- 목록·진행 업무를 최소 요약 RPC로 바꾸고, 상세는 소유자 snapshot RPC로 읽는다. 현재 미리보기 쪽의 서명 URL만 일괄 발급·메모리 재사용한다. 등록부별 Realtime 범위·350ms 이벤트 묶기·읽기 중 재조회 합치기로 중복 읽기를 줄였다. 실제 Supabase IOPS/egress 절감률은 미측정이다.
- 동명이인 본인 확인/6자리 코드, 학교 IP와 개별 실패 제한 분리, 원자적 서명/항목/완료 저장과 동일 재시도 복구, 검색 결과 무효화, 이미지 실패와 완료 상태 분리, 공유 출력 계획·전체 인쇄, 현장 취소 무쓰기·원문 보존, 가져오기 미리보기/되돌리기, 공개 설정/링크 회수, 보관·확인 후 파기/재시도 이력을 구현했다. 기존 migration은 수정하지 않고 `202610010200_registry_io_and_atomic_submission.sql`을 추가했다.
- 세 디자인 프로파일의 구현 전후 판단과 여섯 AI 모의 기준의 1차 평가→2차 변경→재검증을 [수정 보고서](../design/feature-reviews/2026-10-01-registry/fixes.md)에 남겼다. 보조 설정 접기·동명 코드 버튼 밀도·미리보기 중앙 정렬·가져오기 포커스·오답 뒤 서명 획 보존·현장 원문 유지·Chrome 인쇄 여백을 2차 개발에서 수정했다. 실제 전문가/교사 인터뷰·승인은 아니다.
- 실제 보이는 설치 Chrome 탭에서 41명 등록부 생성, 동명 2명 개별 제출, 오답 코드 뒤 획 유지·재시도, 현장 입력 취소/최종 제출을 조작했다. 최종 42명/완료 3명/미서명 39명과 소속 원문을 확인했다. QR PNG 저장, 실제 다운로드 PDF와 Chrome 인쇄 엔진 PDF를 각각 A4 3쪽 전체 렌더로 확인했다. 데스크톱·모바일·상태 혼합·CSS 200%·긴 4열 전체 화면 증거를 보고서에 연결했다.
- 최종 검증: `npm run typecheck` 통과, `npm run lint` 통과(기존 경고 7개), `npm test` 59파일/479개 통과, `npm run build` 통과(기존 큰 번들 경고), 세 Edge 함수 Deno check 통과. 실제 handler/AES-GCM + 대체 DB/Storage 계약 8개, 실제 PGlite PostgreSQL·pgcrypto SQL 18개 통과. 설치 Chrome 등록부+앱 스크롤 33개 통과, 마지막 제품 변경 후 등록부 15개 재검증 통과. CSS 200% 추가 접근성 3개와 개선 증거 6개 재실행도 통과했다.
- 확장 E2E는 35/37 통과였다. 요청과 무관한 기존 홈 검사 ‘전체 업무 도구 (10)’ 기대값(현재 12), 설정 검사 단일 status 선택자(현재 2개)의 2건 실패를 남겼다. 전체 E2E 무조건 통과로 보고하지 않는다.
- 한계: Docker가 없어 사용자 선택의 전체 로컬 Supabase를 실행하지 못했다. Chrome은 로컬 데모 저장소, SQL은 실제 PostgreSQL WASM 엔진, 계약 검사는 전송 대체다. 실제 Supabase Auth/Storage/Realtime/JWT·동시 DB 연결·학교 부하·서버 PDF 전체 생성·물리 기기/프린터는 미검증이다. 원격 생성/제출/삭제는 미실행, 운영 키·실제 개인정보 미사용이다.
- 외부 공유 일지는 확인한 경로에 없어서 이 독립 일지를 갱신했다. 제품 변경은 전용 브랜치의 로컬 미커밋 상태이며 GitHub push·PR·main 병합 미실행. DB·Edge Functions·프런트엔드 운영 배포 모두 **미적용**이다.
- 남은 일: Docker 가능한 로컬 시험 환경에서 실제 인증·공개 제출·Storage 실패 복구·Realtime·확인 후 파기·서버 PDF 통합 검증, 다중 연결 부하 검증. 운영 적용을 요청받으면 migration 이력 확인 뒤 DB→관련 Edge→프런트엔드 순서로 적용하고 실제 동작을 다시 확인한다.

## 2026-10-02 등록부 변경 커밋·통합 전달 정리 (codex)

- 승인된 현재 수정 범위를 전용 워크트리 `C:/Users/panth/.codex/worktrees/review-registry-20261001/260812_schooldoc`, 브랜치 `codex/fix-registry-io-20261001`에서 로컬 커밋했다. 기능·관련 테스트·검증 보고서/화면/PDF 증거·개발 참고는 `238223025d14be5cb064c6e87ba01ff03642ccc9` (`fix(registry): 서명 제출과 출력 오류 수정 및 조회 최적화`)이다. 이 일지는 별도 문서 커밋으로 정리한다. 기존 리뷰/일지 커밋 `9b4d8c1`, `5ba7b310`은 재작성하지 않았다.
- 앞 항목의 ‘미커밋’은 첫 완료 보고 당시 상태이며, 현재는 로컬 기능 커밋을 만들었다. 이번 마무리에는 제품 코드를 추가로 바꾸지 않았고 기존 최종 검사 로그와 소스/공통 파일 diff를 확인했다. 새 검증을 실행한 것처럼 수치를 늘리지 않았다. 새 문서·로그의 말미 빈 줄/공백만 정리하고 staged diff 공백 검사와 보고서·일지 링크 41개를 확인했다.
- 검증 결과 유지: 타입·린트·빌드 통과(린트 기존 경고 7개/큰 번들 경고), 단위 59파일/479개, 설치 Chrome 데모+앱 스크롤 33개 및 마지막 제품 변경 후 등록부 15개, 확대 접근성 3개/개선 증거 6개, Deno Edge check/전송 대체 계약 8개, 실제 PostgreSQL WASM·pgcrypto SQL 18개 통과. 별도 확장 35/37 중 홈 도구 수 기대값과 설정 status 선택자 2건은 범위 밖으로 남겼다.
- R1~R12의 코드 변경과 2차 화면 개선은 [수정·검증 보고서](../design/feature-reviews/2026-10-01-registry/fixes.md)에 기록했다. 실제 Supabase Auth/Storage/Realtime/JWT·동시 연결·학교 부하·서버 PDF 전체 생성·이미지 실패 통합 및 11/20명 동명 전체 시나리오는 완료 판정을 보류한다. Docker CLI/Desktop이 없어 전체 로컬 Supabase는 계속 미실행이며, 승인되지 않은 원격 integration은 실행하지 않았다. 물리 기기·프린터도 미검증이다.
- 공통 파일 변경은 `src/features/activeWork/activeWorkProviders.ts`의 등록부 요약 연결, `src/features/settings/PrivacyRetentionPanel.tsx`·`privacyRetention.ts`·`privacyRetentionSettings.ts`의 등록부 보관/파기 연결, `DEVELOPMENT.md`의 등록부 운영 참고 추가다. 다른 기능의 독립 수정이나 공유 checkout 변경은 포함하지 않았다.
- 신규 DB migration은 `202610010200_registry_io_and_atomic_submission.sql`, 관련 Edge Functions는 `registry-public`, `registry-participants`, `registry-pdf`다. 공통 출력 규칙 `supabase/functions/_shared/registryPrintLayout.ts`도 함께 반영해야 한다. 기존 암호화 키·migration 이력·신규 서버 API와 프런트 호환성을 통합 단계에서 확인한다.
- GitHub push·PR·main 병합·DB migration 원격 적용·Edge Functions/프런트엔드 운영 배포는 모두 미실행/미적용이다. 이 세션에서는 로컬 커밋만 수행하며, 실제 Supabase 검증과 원격 반영은 통합 단계의 남은 일로 전달한다. 외부 공유 일지는 없어서 이 기능별 일지만 갱신했다.
