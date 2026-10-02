# 개발일지

이 checkout에는 공유 개발일지 `../schooldoc-docs/development-history.md`가 없다. 이 파일은 이번 작업부터 작성하는 로컬 기록이며 과거 이력을 복원한 문서가 아니다. 기존 `docs/영수증폴더` 자료는 변경하지 않았다.

각 항목의 미수정·미배포 표기는 작성 당시 상태다. 이후 학급 미션의 수정·배포·원격 검사는 [학급 미션 개발 기록](class-missions-development-history.md), 1인 1역의 후속 구현은 [구현·검증 기록](../design/feature-reviews/2026-10-01-classroom-roles-workflow/implementation.md)을 함께 확인한다.

## 2026-10-01 학급 미션 워크플로우·휴리스틱·오류 리뷰 (codex)

- 브랜치: `codex/feature-review-class-missions`.
- 요청한 순서: 학급 미션 → 1인 1역 → 학생 결과 안내 → 가정통신문 수합 → 등록부 서명 → 자료 수합 → 특별실 예약. 이번에는 학급 미션만 분석했다.
- [상세 보고서](../design/feature-reviews/2026-10-01-class-missions/review.md)에 교사·학생·보관/파기 워크플로우, 10개 휴리스틱, 세 디자인 프로파일과 여섯 AI 모의 관점, 9개 발견 사항·우선순위·수정 요구를 기록했다.
- 실제 Google Chrome을 헤드리스로 자동 조작했다. 로컬 데모 서버·가상 학생만 사용했으며 0명·24명·60명, 데스크톱·모바일·CSS 200% 전체 캡처를 보존했다. 운영 사용자나 실제 전문가의 검토가 아니다.
- 우선 문제: 동명이인 완료 오기록, 나가기 후 지연 응답의 이전 학생 화면 재표시, 학생 제출에 따른 교사 저장 충돌·새로고침 입력 유실, 학교 공용 IP의 요청 제한. 추가로 종료 미션 우선 정렬, 교사 현황의 낮은 위치, 학생 화면 대비, 오래된 E2E selector, 시작 전 상태 표시를 확인했다.
- 검증: 타입 통과; lint 오류 없음·기존 다른 화면 경고 6건; 관련 단위 12개 통과; 기존 Deno 모의 서버 7개 통과; 두 함수 Deno 타입 통과; 스크롤 E2E 1개 통과. 기존 학급 미션 E2E는 3개 통과·3개 실패·3개 미실행(이전 UI selector에서 중단).
- 현재 UI 전용 도구 8개 시나리오 수행(정상 흐름·파기 확인과 결함 재현을 구분), 추가 서버 probe 2개로 동명 기록·IP 한도 문제 재현. QR PNG 1024×1024와 내려받은 Excel의 완료 표시/교사 확인 열을 검증했다. 학생 모바일 axe 대비 위반 노드 2개, 교사 60명 모바일 axe 위반 0개.
- 수정·배포 상태: 제품 코드와 기존 테스트는 변경하지 않았으며 결함은 미수정이다. GitHub push·PR·main 병합 미실행. DB·Edge Functions·프런트엔드 배포 미적용. 원격 RLS·SQL 트랜잭션·실제 학교 장비는 미검증이다.
- 남은 일: F1~F4 우선 수정과 회귀 검증, F5~F9 UI·테스트 개선. 다음 기능은 1인 1역이다.
- 작업 도중 다른 작업이 공유 checkout의 브랜치를 바꿔 전용 `class-missions-review` 워크트리에 리뷰 브랜치를 연결했다. 검증 당시와 동일한 기준 커밋에 리뷰 자료만 복사하고 파일 해시를 대조했다. 기존 checkout의 다른 작업 변경은 보존했다.
- 리뷰 자료 로컬 커밋: `7173d3e` (`docs(missions): 학급 미션 워크플로우와 오류 리뷰 기록`). GitHub push는 하지 않았으며 이 작업일지는 커밋에서 제외했다.

## 2026-10-01 1인 1역 워크플로우·휴리스틱·오류 리뷰 (codex)

- 브랜치: `codex/feature-review-classroom-roles`. 학급 미션 리뷰 커밋 `7173d3e`에서 분기해 같은 전용 워크트리에서 검토했다. 제품 코드는 변경하지 않았다.
- 학급 미션 수정은 별도 대화 `01a0f350-9644-7462-ab7a-f627c0ba6095`에 보고서·재현 도구·우선순위·검증·전용 워크트리 조건과 함께 인계했다. 이 대화에서는 다음 기능인 1인 1역을 검토했다.
- [상세 보고서](../design/feature-reviews/2026-10-01-classroom-roles/review.md)에 교사/학생/전자칠판/출력 워크플로우, 10개 휴리스틱, 세 프로파일와 여섯 AI 모의 관점, R1~R8 수정 요구·완료 기준을 기록했다.
- 주요 발견: 학생 상세의 할 일 설명 누락, 지난 날짜 정정 진입 불가, 전자칠판 메뉴 경로 누락, SPA 뒤로 가기/홈 이동 초안 유실, 다른 학생에게 나타나는 지연 저장 안내, 60명 한 역할 A4 겹침, 학교 IP 요청 한도, 작은 보조 글자 대비. 현재 모두 미수정이다.
- 실제 Google Chrome 154 헤드리스로 로컬 데모와 가상 학생을 조작했다. 교사 PC/모바일·학생 모바일·1920×1080 전자칠판·60명·CSS 200% 전체 캡처를 보존했다. QR PNG 1024×1024 다운로드와 정상 24명 A4 한 페이지, 경계 데이터의 PDF 겹침을 Poppler 전체 렌더로 확인했다.
- 검증: typecheck 통과; lint 오류 없음·경고 7개(기존 제품 6개와 직전 미션 리뷰 도구 1개); 관련 단위 53개; Deno 모의 서버 11개; 기능 Chrome E2E 45개와 스크롤 8개 통과. 추가 Chrome 도구 7시나리오 완료·pageerror 0, 서버 probe 2개로 과거 정정 계약과 300요청 중 60개 제한을 확인했다. 관찰용 기대값의 통과는 결함 수정 통과가 아니다.
- SQL 트랜잭션/RLS용 PGlite 패키지가 설치/캐시되지 않아 로컬 SQL 검사 미실행. 전체 단위·빌드는 제품 변경 없는 리뷰라 미실행. 운영 Supabase·실제 로그인/기기 간 공유·학교 장비·프린터·배포는 미검증이다.
- 리뷰 자료만 로컬 커밋하며 개발일지는 제외한다. 기존 공유 checkout의 AGENTS.md·.github·docs/영수증폴더 변경을 보존했다. GitHub push·PR·main 병합·DB·함수/프런트 배포 미실행.
- 다음 리뷰는 학생 결과 안내다. 외부 공유 개발일지와 pro/ux-ui-expert.md가 없는 제한은 유지한다.
- 리뷰 자료 로컬 커밋: `68243b3` (`docs(roles): 1인 1역 워크플로우와 오류 리뷰 기록`). GitHub push와 배포는 하지 않았으며 개발일지는 커밋에서 제외했다.

## 2026-10-01 학급 미션·1인 1역 리뷰 자료 GitHub 게시 (codex)

- 사용자 요청에 따라 리뷰 두 브랜치를 GitHub에 push하고 원격 SHA가 로컬 커밋과 일치하는지 확인했다.
- 학급 미션 리뷰: [7173d3e](https://github.com/moodoocoding/schooldoc/commit/7173d3e7eee34ace4c70c159b98e922ac5d82272), 브랜치 `codex/feature-review-class-missions`.
- 1인 1역 리뷰: [68243b3](https://github.com/moodoocoding/schooldoc/commit/68243b3be46e86126eedf5b17ed03caf2e2d9a1e), 브랜치 `codex/feature-review-classroom-roles`.
- 보고서·Chrome 재현 도구·모의 서버 probes·가상 데이터의 전체 화면 및 출력 증거를 게시했다. 운영 비밀값·실제 학생 자료·기존 사용자 변경·영수증 백업 자료는 포함하지 않았다.
- 기존 리뷰 검증 결과는 위 각 항목과 보고서를 따른다. 이번에는 문서 링크·diff·커밋 범위와 원격 SHA를 확인했으며 제품 코드를 바꾸지 않아 기능 테스트를 재실행하지 않았다.
- 개발일지는 리뷰/제품 코드와 분리한 문서 커밋으로 게시한다. 로컬 전용 PC 경로를 저장소의 상대 링크로 정리했다.
- 이 대화의 작업은 main 병합·운영 배포를 포함하지 않는다. DB·Edge Functions·프런트엔드 운영 적용은 해당 없음이다. 학급 미션 제품 수정 및 main 통합은 별도 대화 ‘학급 미션 리뷰 결과 수정’에서 진행하고 있다. 그 통합 완료와 운영 검증은 여기서 확인한 것으로 기록하지 않는다.
- 현재 1인 1역 R1~R8은 리뷰 단계의 미수정 사항이다. 다음 검토 대상은 학생 결과 안내다.

## 2026-10-01 원격 비교·최신 main 반영·로컬 문서 커밋 (codex)

- GitHub main과 비교했을 때 로컬 `024b2ec`가 3커밋 뒤였고, 로컬에만 있는 커밋은 없었다. 이후 [PR #43](https://github.com/moodoocoding/schooldoc/pull/43)의 1인 1역 변경과 [PR #44](https://github.com/moodoocoding/schooldoc/pull/44)의 학생 결과 안내 변경이 포함된 원격 main `c4422cf`를 fast-forward pull했다.
- pull 후 로컬 HEAD와 origin/main의 SHA가 일치하고 앞섬/뒤처짐이 0/0인지 확인했다. 기존 작성 규칙·PR 템플릿·공용 일지·영수증 원본 총 42개 파일의 내용 해시가 유지됐다. 학급 미션 코드·원격 검사 도구·전용 일지도 원격과 같았다.
- 사용자 요청에 따라 원격 main에 빠진 작성 규칙과 PR 템플릿을 `c38c814` (`docs(repo): 커밋과 PR 작성 형식 통일`)로 커밋했다. 내용·참조 경로·공백 diff를 확인했다.
- 사용자 의견을 반영해 영수증 원본·샘플 39개(JPG 35개·PDF 4개)는 Git에 포함하지 않았다. `ca50869` (`chore(repo): 로컬 영수증 자료를 Git 추적에서 제외`)에서 해당 폴더만 `.gitignore`에 추가했다. 39개 파일의 제외 상태와 원본 해시 유지 여부를 확인했다.
- 공용 일지는 다른 원격 리뷰 브랜치에도 일부 게시돼 있으나 main에는 없었다. 기존 로컬 기록을 유지하고 개인 PC 경로를 상대 링크로 바꿨으며, 과거 리뷰 상태와 후속 수정 기록을 구분했다. 작성 규칙이나 영수증 자료와 섞지 않고 별도 문서 커밋으로 남긴다.
- 이번 문서·Git 관리 작업에서는 기능 테스트·타입·빌드·원격 쓰기 검사를 재실행하지 않았다. 문서 내용·상대 링크·비밀값 패턴·공백 검사만 수행했다. GitHub push·새 PR·main 원격 병합·운영 배포는 이번 커밋 요청의 범위에 포함하지 않았다.


## 2026-10-01~02 특별실 예약 결함 수정·DB 최적화·Chrome 검증 (codex)

- 브랜치: `codex/fix-special-rooms-db-io`. 첨부 특별실 작업트리에서 기존 리뷰·수정계획을 유지하며 구현했다. 공유 checkout의 다른 변경은 건드리지 않았다.
- [구현·검증 기록](../design/feature-reviews/2026-10-01-special-rooms/implementation.md)에 SR-01~18 변경과 확인 범위, 세 디자인 프로파일의 전후 판단, 여섯 AI 모의 관점과 2차 수정·재검증을 기록했다. 실제 전문가·교사 검토나 사용성 시험은 아니다.
- 목록 20개 요약/선택 실·주 최대 54예약/영향 수 집계로 조회를 분리했다. 9교시·원자 CAS 저장·실제 반복 수량·초안/지연 응답 보호·관리 오류 재시도·NEIS 차이 원자 적용·범위 알림 JWT/RLS를 구현했다. 진행 업무의 기존 정상 요약은 유지하고 특별실 fallback을 경량화했다.
- 한국 날짜·토요일·연도 경계, 50실 선택·날짜 이동, 모바일 두 줄 라벨·낮은 화면/200% 대화상자·키보드·종료 상세·A4 출력을 수정했다. 인쇄 방향/행 분리와 관리 열 빈 공간·대비 문제는 실제 Chrome 관찰 후 재수정했다.
- 설치된 Google Chrome을 실제 조작했다. 데모 특별실 60개/진행 업무 4개, 스크롤 18개, 다른 기능 인쇄 1개 통과. 별도 비데모 Chrome→HTTP→실제 PGlite SQL 흐름 5개에서 저장·두 창 충돌·503 복구·지연 조회·반복 경쟁을 확인했다. headed Chrome에서도 저장한 SQL 행을 확인했다. 관리 오류 콜백 주입 검사는 실제 컴포넌트의 복구 검사로 구분했다.
- 타입 통과; lint 오류 0·기존 경고 5개; 전체 단위 58파일 475개 통과; 빌드 통과(기존 큰 번들 경고). 공개/관리 함수 Deno check 통과, Deno 3검사/10단계 통과. 최종 관리/출력 재검사는 구현 기록의 결과 파일을 따른다.
- 공개·관리 axe 위반 0, pageerror 0. 전체 데스크톱/모바일/전자칠판 크기/CSS200 캡처, QR PNG를 보존했다. 정상 공개·관리 A4 가로 각각 1장, 긴 제목/안내/예약 54개는 2장 전체 렌더·식별자/bbox 확인. 1인 1역 A4 세로 출력도 유지됐다.
- 실제 로컬 SQL 1/3/50실 계측: 기존 공개 주간 예약 54/162/2700행 → 선택 실 54행. 50실에서 새 snapshot 17,256바이트(기존 예약 projection 591,301바이트, 메타 포함 범위가 달라 전체 응답 절감률로 사용하지 않음). 단일 저장은 부모 예약표 UPDATE 0, 반복 52주는 상태/알림 52개가 추가되며 동일 작업 재시도는 요청 제한만 갱신했다. 작은 자료의 내부 shared hit 증가는 숨기지 않고 상세 기록에 남겼다.
- 자동 승인 검토의 광역 Realtime restrictive 정책 거절은 `sr:` 행만 보호하는 정책으로 좁혀 해결했다. 기존 다른 기능 정책 유지/타 특별실 차단을 실제 SQL로 확인했다. 거절된 광역 변경은 실행하지 않았으며 원격 정책도 변경하지 않았다.
- 원격 Supabase Auth/실제 Realtime·NEIS·다중 연결 잠금·IOPS/WAL·50탭 부하·학교 장비·프린터는 미검증이다. crypt/Realtime은 명시한 SQL 시험 adapter를 썼다. 새 키가 실제 신뢰되는 상태와 private 권한을 원격 시험 환경에서 확인해야 빠른 갱신 배포를 완료할 수 있다.
- 최초 private 구독 뒤 유실 복구 확인 1회를 추가했다. 모든 실 주간 수량은 선택 실 변경만 즉시 반영하고 다른 실 변경은 수동/복귀/5분에 반영한다. 구버전 읽기 호환의 넓은 조회와 취소 응답 유실 재시도의 안전한 충돌 안내를 구현 기록에 적었다.
- 이번 구현은 목적별 로컬 커밋으로 정리했다. GitHub push·PR·main 병합 미실행, DB/Edge Functions/프런트엔드 배포 미적용. 배포 요청 범위에서 원격 이력·키·RLS·잠금/부하를 확인한 뒤 secrets→마이그레이션→지정 함수→프런트엔드 순서로 적용한다.
- 외부 공유 일지 `../schooldoc-docs/development-history.md`와 `pro/ux-ui-expert.md`는 없는 checkout이다. 기존 로컬 일지에 이 항목을 덧붙였으며 과거 기록은 유지했다.

- 목적별 로컬 커밋 확인:
  - `f9f911772516de3ab0b4548165f9f3165171d2ab` — `docs(special-rooms): 범위 조회와 변경 알림 수정계획 기록`.
  - `7ccff618f910a597fb14f070616f65d5e21bc4bb` — `fix(special-rooms): 예약 충돌과 범위 조회 및 출력 오류 개선`.
  - `561bcf46dd69998c836dda78db831bf3b5e5d7e8` — `perf(shared): 진행 업무 특별실 복구 조회 경량화`.
- 최종 추가 확인: 관리/휴관/운영 Chrome 25개(실패 주입 컴포넌트 1개 포함), 전체 단위 475개 재실행, 타입·lint·빌드 통과. 마지막 공통 인쇄 CSS로 1인 1역 전용 Chrome 출력 검사 1개 통과. Windows npm 인자 처리로 잠시 넓어진 다른 기능 검사는 중단하고 직접 Playwright CLI로 필요한 출력 검사만 완료했다. 그 전체 파일의 통과를 주장하지 않는다.
- 남은 제품 코드 수정: 로컬 검증에서 확인한 미해결 결함 없음. 배포 전 실제 Supabase JWT/private Realtime 검증과 다중 연결 잠금·WAL/I/O·부하 측정은 필수 후속으로 남겼다. 데모 52주 결과 로그 영속 보장은 운영 SQL 검사와 구분한다.
- 공통 파일: `src/features/activeWork/activeWorkProviders.ts`, `tests/e2e/active-work.spec.ts`는 별도 shared 커밋. `src/index.css`는 특별실 scoped 인쇄/색상, `DEVELOPMENT.md`는 특별실 동작·검증·적용 경계 설명만 추가. 의존성·인증·다른 기능 제품 파일 변경 없음.
- DB 새 이력: `supabase/migrations/202610010600_special_room_scoped_sync.sql`. 관련 함수: `special-rooms-public`, `special-rooms-admin` 및 특별실 `_shared` 두 파일. DB/함수/프런트 운영 적용은 모두 미적용.
- 작업일지는 기능·공통 코드와 분리한 `docs(special-rooms): 구현과 실제 Chrome 검증 일지 기록` 커밋으로 정리한다. GitHub/통합/main/운영 배포는 통합 세션에서 담당하며 이 세션에서는 실행하지 않았다.

## 2026-10-02 네 기능 리뷰 수정 통합과 DB·서버 배포 (codex)

- 가정통신문·등록부·자료 수합·특별실 예약의 완료 커밋과 기능별 작업일지를 별도 워크트리에서 통합했다. 네 기능 브랜치의 GitHub SHA가 인계 SHA와 같은지 확인했으며 [통합 PR #45](https://github.com/moodoocoding/schooldoc/pull/45)를 만들었다.
- 기능별 기록: [가정통신문](feature-review-consent-2026-10-01.md), [등록부](feature-review-registry-2026-10-01.md), [자료 수합](feature-review-data-collect-2026-10-01.md), [특별실](feature-review-special-rooms-2026-10-01.md). 공통 CSS와 개발 참고 충돌은 모든 기능의 규칙을 보존해 해결했다. 기존 공유 main의 영수증 미커밋 변경은 보존하고 배포에 포함하지 않았다.
- [통합 검사·적용 보고서](../design/feature-reviews/2026-10-02-integration/report.md): 타입·린트(기존 경고 6개)·빌드·전체 단위 501개 통과. 실제 설치 Chrome의 네 기능·진행 업무·스크롤 고유 검사 90개 통과, 공통 집계 보완 뒤 진행 업무 5개 재검사. PDF worker 공유 경로 및 모의 API 환경 부재를 바로잡은 재실행 결과와 첫 실패 로그도 구분해 기록했다.
- 아홉 Edge Functions Deno check와 계약/로컬 SQL 검사 11개·10단계 통과. PGlite+pgcrypto에서 전체 마이그레이션 33개 함께 적용, 현재 응답 집계와 직접 제출 RPC 권한을 확인했다. Auth/Storage/Realtime 어댑터 한계를 표시했으며 실제 서비스 전체 검사로 보고하지 않았다.
- 통합에서 가정통신문 재제출 누적 수가 진행 업무의 현재 응답 수로 표시되는 문제를 추가로 고쳤다. preparing 수합도 숨겼다. 이미 적용한 SQL을 수정하지 않고 새 202610020100_consent_active_summary.sql과 실제 Chrome·SQL fixture 검사를 추가했다.
- Supabase jhystopaacyfvjxhnpyd에 신규 SQL 5개를 적용하고 local/remote 33개 이력과 실제 집계 함수 정의·권한을 확인했다. 관련 Edge 9개를 지정 배포해 ACTIVE·버전·기존 JWT 설정 유지 확인. 브라우저 공개 함수의 기존 verify_jwt=false를 배포 설정에도 명시했고 기존 암호화/Auth 키는 교체하지 않았다.
- 배포된 API 읽기·형식 오류·익명 거부/RLS 검사 17개 통과. 운영 업무 생성·실제 제출·파일 삭제·파기, 실제 로그인·소유자 간 쓰기·서버 PDF·다중 연결 부하 검사는 자동 실행하지 않았다.
- 가정통신문의 긴 QR 이름과 긴 목록 배치 개선이 남는다. 특별실 새 private 알림 서명키는 준비되지 않아 수동/복귀/5분 조건부 갱신을 사용하며 빠른 알림 활성화·Realtime 권한과 부하 검증은 남는다.
- 이 기록 시점: GitHub 기능별 브랜치·통합 PR 게시 완료, DB·Edge 적용 확인, main 병합·프런트 운영 배포 대기. main 자동 배포가 확인돼 DB→지정 서버→main/프런트 순서를 지켰다. 최종 결과는 확인 후 다음 기록과 PR 배포 표에 반영한다.
- 기존 외부 개발일지는 해당 checkout에서 확인되지 않아 저장소의 공용·기능별 일지를 사용했다. 실제 전문가·교사 사용성 시험을 받았다고 보고하지 않는다.

## 2026-10-02 네 기능 main 병합·운영 배포 완료 (codex)

- [통합 PR #45](https://github.com/moodoocoding/schooldoc/pull/45)를 squash 병합했다. main `fdc2e19ffbf4c1f923998fbb4b5616b90f28e866`, 제목 `fix(shared): 수합·서명·예약 검토 수정과 DB 조회 최적화 통합`을 확인했다. 기능별 GitHub 브랜치와 인계 이력을 유지했다.
- [최종 운영 적용 기록](../design/feature-reviews/2026-10-02-integration/release.md): DB 신규 5개/전체 33개 이력 일치, 지정 Edge 9개 ACTIVE를 확인한 뒤 main 자동 프런트 배포까지 완료했다. Vercel `dpl_FkSNmp6MtwTk7bdCH3XK6KKcxLR8`의 READY 및 위 main SHA 일치 확인. [운영 사이트](https://schooldoc-nine.vercel.app).
- 설치된 Chrome에서 데스크톱·모바일 홈/로그인 전 네 관리 화면 탐색/존재하지 않는 네 공개 링크 총 18개 화면과 재시도 4개 통과. 실제 운영 Supabase 404·사용자 오류 표시, page error 0, 수평 넘침 0을 확인했고 대표 전체 화면을 직접 열어 점검했다. 최초 all-zero UUID의 400을 유효한 형식의 가상 UUID로 바꿔 404 경로를 확인했다.
- 단위 501개·실제 Chrome 데모/모의 API 고유 90개·원격 읽기/거부 17개·운영 화면 18개/재시도 4개를 구분한다. 코드 검사는 앞 기록과 [통합 보고서](../design/feature-reviews/2026-10-02-integration/report.md)의 명령·로그를 따른다. 이번 완료 기록만의 변경에는 내용·상대 링크·비밀값 패턴·git diff 공백을 확인한다.
- 실제 OAuth 로그인 후 쓰기·파일 제출/파기·서버 PDF·Realtime·다중 연결 부하는 미검증이다. 특별실 빠른 private 알림은 새 신뢰 서명키 준비와 원격 검증이 남아 수동/복귀/5분 갱신을 사용한다. 가정통신문 긴 QR 이름·긴 목록 공유 영역 후속 UI 개선도 남는다.
- 최종 증거와 이 일지는 기능 코드를 다시 바꾸지 않는 별도 문서 PR로 게시한다. 이 기록에 적은 배포 ID는 위 기능 병합 커밋의 확인된 배포이며 후속 일지 병합으로 발생하는 배포와 구분한다. 공유 checkout의 영수증 미커밋 수정은 보존하고 자동 pull하지 않았다. 외부 공유 일지는 없어 이 저장소 일지를 사용했다.

## 2026-10-02 가정통신문 편집·공유·QR 후속 개선 통합 (codex)

- 사용자 요청에 따라 가정통신문 개발 세션의 검사·커밋을 기다리고 메인 세션에서 GitHub 반영·통합·운영 배포를 이어 진행한다. 기존 기능 main/일지 main을 반영한 가정통신문 작업을 전용 통합 브랜치로 가져왔다.
- [개발 세션 보고서](../design/consent-field-editor/2026-10-02/report.md): 왼쪽 설정/오른쪽 큰 원본 PDF, 접힌 단축키·숫자 설정, 상단 공유와 목록 접기, 긴 QR 이름·식별값 전체 표시를 구현했다. A4 6명/쪽으로 종이 사용량 증가를 기록했고 QR 크기·PNG 저장은 유지했다.
- 통합 담당 실제 Chrome에서 640/768px 카드 잘림을 추가로 발견해 전달했다. 개발 세션은 화면 가용 너비/한 열과 인쇄·PDF A4 두 열×세 행을 분리해 보완했다. 통합 담당 여섯 너비 재확인도 통과. [통합 확인 기록](../design/consent-ui-integration/2026-10-02/report.md).
- 개발 세션 단위 501개·Chrome 고유 64개·실제 로컬 DB 읽기 5개·A4 PDF 20쪽 통과. 통합 소스 SHA-256 8개 일치와 타입·lint(기존 경고 6개)·빌드(기존 번들 경고)·관련 단위 45개를 재확인했다. 실제/모의·실물 미검증을 구분했다.
- 이번 UI 변경의 DB/Edge 배포는 해당 없음. 원격 실제 로그인 후 생성·제출·Storage·PDF는 시험 계정/자료 미지정으로 미검증이다. 새 프런트 배포 결과는 확인 후 별도 완료 기록에 추가한다. 원래 checkout의 영수증 변경과 이전 일지는 보존했다.

## 2026-10-02 가정통신문 후속 UI main 병합·운영 배포 완료 (codex)

- 개발 세션의 완료·clean과 최종 인계 `7a4424181d10003421067589e1c1aab9085a6b29`를 확인한 뒤 통합 세션에서 GitHub 게시·PR·main squash 병합·운영 확인을 이어 수행했다. [PR #47](https://github.com/moodoocoding/schooldoc/pull/47), main `429fae26ec8b1674cb404a766a620ac77b4627e3`, 제목 `fix(consent): 원본 중심 필드 편집과 공유·QR 표시 개선`을 확인했다.
- 큰 원본 PDF 중심 편집, 접힌 단축키·숫자 설정, 상단 공유/QR와 목록 접기, 긴 QR 이름·식별값 표시를 반영했다. 통합에서 발견한 640/768px 카드 잘림도 보완됐다. A4 6명/쪽으로 기존 8명/쪽보다 종이가 더 필요하다.
- [최종 운영 적용 기록](../design/consent-ui-integration/2026-10-02/release.md): 프런트 Vercel `dpl_4pn6Az2Cw1ihGDXGF9MpMycKJeRr` READY와 기능 main SHA 일치 확인. [운영 사이트](https://schooldoc-nine.vercel.app). 이번 UI 변경의 DB 마이그레이션·Edge 배포는 해당 없음.
- 설치된 실제 Chrome에서 데스크톱·모바일 홈/관리 로그인 안내/가상 공개 링크 총 6개 화면 통과. 실제 운영 Supabase 404·사용자 오류 표시·page error 0, 배포 JS의 새 UI 코드 표식 4개를 확인했다. 개발 세션 단위 501개·Chrome 데모/일부 모의 API 64개·로컬 DB 읽기 5개·PDF 20쪽, 통합 관련 단위 45개·여섯 QR 너비 확인과 구분한다.
- 운영 로그인 후 편집·생성·제출·Storage·PDF 및 실물 장비는 시험 계정/자료가 없어 미검증이다. UI 코드 배포 포함 확인을 전체 운영 사용성·제출 검사로 보고하지 않는다. 실제 전문가·교사 검토를 받은 것이 아니다.
- 기능 코드를 바꾸지 않는 최종 문서·증거 PR로 완료 기록을 게시한다. 기록의 배포 ID는 위 기능 커밋의 확인된 배포이며 후속 일지 병합 배포와 구분한다. 내용·링크·비밀값 패턴·공백 검사를 수행하고 문서만 변경하는 단계에서 코드 검사를 반복하지 않는다. 원래 checkout의 영수증 변경은 보존했으며 외부 공유 일지는 확인되지 않아 기존 저장소 일지를 사용했다.

## 2026-10-02 학생 결과 총점·설정 재확인 수정과 작업 중단 인계 (codex)

- 최신 main `22fa46f39ff8e8c544bbd25381d80370dadc0ea5`와 관련 원격 브랜치·열린 PR을 확인한 뒤 별도 checkout의 `codex/student-result-total-settings-fix-20261002`에서 작업했다. 두 오류가 main에 남아 있고 진행 중인 작업에 같은 수정이 없는 것을 확인했다. 기존 사용자 작업은 변경하지 않았다. 외부 공유 일지 `../schooldoc-docs/development-history.md`는 없어 Git에 추적 중인 이 일지에 추가한다. 로컬 Codex 메모리에는 참고할 최근 기록이 없었으며 저장소 지침·현재 코드·CI를 직접 확인했다.
- 해결 대상: PR #44의 [총점 종류 저장 오류](https://github.com/moodoocoding/schooldoc/pull/44#discussion_r4152129952), [설정 변경 후 확인 무효화 오류](https://github.com/moodoocoding/schooldoc/pull/44#discussion_r4152129957). [PR #50](https://github.com/moodoocoding/schooldoc/pull/50)을 draft로 생성하고 검증 후 ready로 전환했다.
- 코드 커밋: `4bf07e4824cc6529e68ae3d8e9c2c7d93b034e8d` (`fix(student-results): 총점 저장과 설정 변경 후 재확인 보장`), 최종 검증 코드 head `28afa9d127d4a1f30414af0910f6fc8af5f834c5` (`fix(student-results): 기존 안내 무변경 저장의 확인 유지`). 이 항목을 추가하는 후속 커밋은 문서만 변경하며 최종 브랜치 head는 push 후 원격 SHA로 대조한다.
- 사용자 최신 요청은 “지금작업까지만 작업일지에 기록해줘, 앞으로 해야 할 일도 남겨 놓고, 그리고 깃과 깃허브에 푸시해줘.”이다. 이전 병합 요청을 중단하고 **수정 브랜치까지만 push한 뒤 멈춘다. main 병합과 운영 DB/함수 적용은 수행하지 않는다.** 재개에는 새로운 사용자 요청이 필요하다.

### 완료한 수정·검토

- 입력·표시·저장·재조회에서 공통 총점 판별을 사용한다. `총점`·`합계` 등 이름으로 추론한 종류를 생성/설정 저장 전에 명시하며, 명시적인 개별 점수 선택은 유지한다. 추론 총점이 두 개인 입력은 서버에서도 거부한다. 저장·재조회 후 총점과 세부 점수를 중복 합산하지 않는다.
- 새 migration [202610020200_student_result_settings_versions.sql](../supabase/migrations/202610020200_student_result_settings_versions.sql)은 기존 적용 이력을 수정하지 않고 설정 저장 RPC의 이벤트→수신자 잠금·버전 확인·확인 무효화를 구현한다. 실제 설정 변경은 모든 수신자 버전을 갱신하며, 동일 설정 저장은 버전·확인·이력을 유지한다. 같은 시각·transaction에서도 버전이 증가한다.
- 학생 확인은 버전 누락·불일치와 읽기/쓰기 사이의 정정을 409로 거부한다. 조회 도중 설정이 바뀌어 이전 안내와 새 수신자 버전이 섞이는 응답도 거부한다. 오래 열린 화면은 최신 결과를 읽고 재확인해야 한다. 확인 옵션 해제·답변 완료·미처리 이의 상태는 회귀 검사로 구분했다.
- 자동 Codex 리뷰가 이전 NULL 종류의 무변경 저장도 재확인시키는 문제를 추가로 지적했다. 추론된 의미로 비교하도록 수정하고 로컬/SQL 회귀를 추가했다. 해당 스레드는 해결 처리했고 최종 코드 head 재리뷰는 추가 지적 없이 👍로 완료했다. 실제 전문가·교사 승인이나 별도 사람의 코드 리뷰를 받은 것은 아니다.
- AI 자체 웹디자인·UX·UI 검토와 실제 Chrome 교사 1366px/학생 390px 전체 화면 캡처로 재확인 경고→최신 조회→확인 완료, 키보드 Enter 갱신, 합계/배점 변화와 가로 넘침 없음을 확인했다. 실제 운영 사용성·200% 확대는 미검증이다. 실제 학생 자료 대신 합성 자료를 사용했다.

### 검증 상태

| 구분 | 결과와 근거 |
| --- | --- |
| 통과 — 설치·타입·lint·빌드 | `npm ci`, `npm run typecheck`, `npm run lint`, `npm run build` 성공. 기존 lint 경고 6개와 번들 크기 경고 유지. |
| 통과 — 단위·desktop | `npm test`: 64파일 517개. `npm run test:desktop`: 12개. 최종 코드 head의 CI에서도 통과. |
| 통과 — 서버·SQL | Deno 2.9.6 서버 CI 44개·20단계, 학생 결과 6개 포함. 실제 Edge handler·AES-GCM·PGlite SQL을 사용하며 Auth/PostgREST/pgcrypto/Realtime는 대역 또는 제외. Deno 타입 검사를 포함한다. |
| 통과 — 학생 결과 Chrome | 관련 E2E 13개: 총점 저장·재조회, 세부/총점 혼합, 항목명·배점·종류 변경, 오래 열린 화면 거부·갱신·재확인, 확인 전 학생의 오래된 버전 거부. |
| 예상 실패 재현 | 원본 main `22fa46f`에 추가 서버 회귀를 이식하면 5개 실패. 원본의 기존 Deno 타입 오류 때문에 이 재현에만 `--no-check`를 사용했다. 수정본 실패와 구분한다. |
| 실패 — CI 첫 실행 | [Actions 36958020023 attempt 1](https://github.com/moodoocoding/schooldoc/actions/runs/36958020023/attempts/1): E2E 282개 통과·5개 예정된 제외·기존 가정통신문 PDF 호환성 390px 1개 실패. `route.fetch: read ECONNRESET`로 로컬 PDF Worker 요청이 끊겼다. 이후 server-flow/package는 실행되지 않았다. PDF 코드·의존성·브라우저 설정 diff는 없다. 실패 trace를 보존했다. |
| 통과 — PDF 반복 재검증 | 같은 PDF 검사 4개를 로컬에서 세 차례 반복하여 12개 모두 통과, 최종 exit 0·HTML 보고서 확인. Windows 종료 대기 중인 해당 시험용 Vite 프로세스만 정리했다. 최초 CI 실패를 숨기거나 제품 코드를 우회하지 않았다. |
| 통과 — CI 재실행 | 같은 코드 head의 [Actions 36958020023 attempt 2](https://github.com/moodoocoding/schooldoc/actions/runs/36958020023/attempts/2) 최종 success. verify/package 성공. 전체 E2E 283개 통과·5개 예정된 제외, 별도 `test:server-flow`에서 그 HTTP·SQL Chrome 5개 모두 통과. |
| 통과 — Windows 패키지 | 위 CI의 실제 산출 EXE 실행 검사 15개 성공: 격리된 가상 교사, 화면 이동·PDF·다운로드·저장·재시작 등. 서버는 모의 환경이며 실제 Google/Supabase 통합 검증과 구분한다. PR 실행의 publish job은 예정대로 skipped여서 새 정식 Release는 게시하지 않았다. |
| 실행 중/후속 확인 | 문서 기록 직전 코드 CI는 완료됐다. 이 일지 push가 새 문서 head의 CI/Preview를 시작하면 그 상태를 완료 보고에 남기고, 사용자 중단 지시에 따라 추가 완료 대기·병합을 진행하지 않는다. 문서만 바뀌므로 로컬 제품 검사를 반복하지 않고 내용·상대 링크·비밀값 패턴·`git diff --check`를 확인한다. |
| 미실행 | 운영 Supabase 로그인/쓰기·실제 Realtime·다중 PostgreSQL 연결 잠금·실물 장비·프린터·운영 학생 자료 시험. 원격 통합 검증을 로컬 fixture 통과로 보고하지 않는다. |

### GitHub·배포·연결 상태

- 기록 시점 PR #50은 OPEN·미병합이며 main은 `22fa46f39ff8e8c544bbd25381d80370dadc0ea5` 그대로다. 운영 main push·자동 프런트 배포·main 포터블 릴리즈는 이번 작업에서 실행하지 않았다. 코드 브랜치 push와 PR 게시는 완료했고, 이 일지는 별도 `docs(student-results)` 커밋으로 같은 브랜치에 push한다. force push/amend/rebase를 하지 않는다.
- 프런트: 코드 head `28afa9d`의 Vercel Preview deployment `6800221843` 성공. [미리보기](https://schooldoc-m9fi5nho6-panthea0-9353s-projects.vercel.app). 운영 프런트는 미적용이다. 문서 push의 새 Preview와 위 코드 Preview를 구분한다.
- DB: `202610020200_student_result_settings_versions.sql` **준비 완료·운영 미적용·추가 승인 대기**. Edge Functions: `student-results-admin`, `student-results-public` **수정 완료·운영 미적용·추가 승인 대기**. 현재 프런트는 이미 버전을 전송하므로 코드 통합과 실제 서버 적용을 구분할 수 있다. 운영 기능 해결 완료로 보고하지 않는다.
- 최근 저장소 운영 기록의 프로젝트는 `jhystopaacyfvjxhnpyd`, 웹은 `https://schooldoc-nine.vercel.app`이다. 실제 현재 연결·migration 이력·운영 함수 정의는 아직 재검증하지 않았다. 운영 DB에 접속/변경하거나 실제 학생 자료를 조작하지 않았다.
- 실행 환경 websocket 연결에서 일시적인 HTTP 503/transport disconnect가 발생했지만 재연결하여 Git 상태와 CI 완료를 확인했다. 인증·자격 증명 변경이나 예상치 못한 권한 승인은 발생하지 않았다. 연결이 다시 끊겨 push/원격 확인이 막히면 완료로 기록하지 않고 블로커로 보고한다.

### 앞으로 해야 할 일과 운영 승인 범위

1. 사용자 새 요청이 있을 때 최신 main·PR head·미해결 리뷰·새 문서 head CI를 다시 확인한다. 필요 시 관련 변경을 재검증하고 승인된 경우에만 PR #50을 squash 병합한다. main 자동 프런트 배포와 같은 main SHA의 포터블 CI/정식 Release/게시 EXE 다운로드·체크섬·Windows 실행은 각각 확인해야 한다.
2. **운영 적용은 아직 승인되지 않았다.** 별도 승인 후 실제 Supabase 프로젝트·기존 암호화 secret의 존재·migration 이력·dry-run을 확인한다. 다른 기능의 미적용 migration을 함께 적용하지 않고, 준비한 `202610020200`만 적용한 다음 위 두 Edge Functions만 이름 지정 배포한다. 기존 JWT 설정·암호화 키·권한 범위를 유지한다.
3. migration은 `touch_student_result_updated_at()`와 `update_student_result_event_settings(...)` 두 기존 함수를 교체한다. 적용 순간 기존 성적·개인정보·확인 상태를 바꾸는 UPDATE는 없고 테이블/컬럼/접근 권한을 추가하지 않는다. 적용 후 실제 항목·배점·종류·안내 설정 변경부터 모든 수신자 버전과 확인 상태를 갱신한다. 확인 기능이 켜져 있으면 완료 상태는 재확인 필요로, 꺼져 있으면 실제 답변 유무에 따라 답변 완료/조회로 전환한다. 미처리 이의·점수·피드백·개인 링크는 유지하며 무변경 저장은 기존 확인을 유지한다.
4. 실제 안내 전체 수신자 잠금으로 큰 안내/동시 확인에 잠금 대기가 생길 수 있고, 오래 열린 화면/버전 없는 구버전 확인은 409와 새로고침이 필요하다. 승인된 합성 원격 자료로 생성→저장 후 재조회→확인→설정 정정→오래된 화면 거부→갱신→재확인과 실제 Auth/Realtime/다중 연결 경로를 검증해야 한다.
5. 되돌리기 준비: 적용 직전 두 DB 함수 정의·migration 이력·두 Edge 배포 버전과 소스를 보존한다. 문제 시 이전 확인된 Edge 소스로 이름 지정 재배포하고, 새 전진 migration으로 이전 DB 함수 정의를 복구한다. 기존 migration/이력 삭제나 테이블 DROP을 하지 않는다. 이후 변경으로 이미 무효화된 확인 시각은 코드 롤백으로 복원되지 않으므로 재확인을 유지한다. 상태/성적 일괄 복원은 별도 승인·정확한 복원 자료가 필요하다. 롤백하면 이번 오류가 재발할 수 있다.
6. 과거 잘못 `score`로 저장된 총점은 교사의 의도적인 개별 점수 선택과 구분할 수 없어 자동 일괄 보정하지 않았다. 필요한 안내는 교사가 종류를 확인하여 정정해야 하며 과거 실제 학생 자료 소급 변경은 이번 범위에 없다.


## 2026-10-02 학생 결과 미반영 리뷰의 선택 통합 및 재검증 (codex)

- 최신 main `23d4d1f`에서 `codex/student-results-review-integration-20261002`를 만들고 과거 리뷰 `378c12e`/`8b01885`의 필요한 코드만 선택했다. 코드 커밋 `e73f9b8`이며 최신 총점·설정 재확인 처리와 원본 영수증 미커밋 변경을 보존했다.
- 조회 종료 후 늦은 개인정보 응답 차단, 만료/안내 이동 복구, 계정별 탭 메모리 초안, 모바일 관리, QR PNG/A4, 보호 RPC·실패한 이름/코드 추측 한도를 통합했다. 전체 시각 검토 뒤 긴 학생명이 PC 표의 다른 열을 좁히는 문제도 고쳤다.
- 최종 타입·린트(기존 경고 6)·단위 531·학생 Chrome 26·전체 Chrome 296 통과. 전체 명령에서 조건부 건너뛴 서버 흐름 5개는 별도 명령으로 5개 모두 통과. Deno 서버 70개/20하위 단계, pgcrypto SQL 18, 데스크톱 12, 웹 빌드 통과. 데모·로컬 SQL/HTTP 결과이며 실제 Supabase/EXE 완료가 아니다.
- 세 프로파일·여섯 AI 모의 관점·1차/2차 전체 화면과 한계는 [상세 통합 기록](../design/student-results-integration/2026-10-02/report.md)에 남겼다. 실제 전문가·교사 인터뷰나 전자칠판 현장 검사는 하지 않았다.
- 원격 이력을 읽어 최신 main의 설정 버전 migration 미적용과 기존 학생 safety 번호 중복을 확인했다. `202610020200`과 새 `202610021000` 두 개만 dry-run 대상으로 확인했다. 학생 함수의 기존 JWT true·암호화 키·서버 secrets를 유지한다.
- 기록 시점에는 DB/Edge Functions/프런트엔드/main·후보/정식 EXE 미적용·미검증이다. 실제 Chrome 기존 로그인은 확인했으며 가상 자료만 사용하는 원격 검증과 다운로드 EXE 검증을 이어간다. 이전 릴리즈 예외를 새 통합본에 자동 적용하지 않는다.
- 원격 main은 `23d4d1f` 그대로이고 다른 세션의 가정통신문 PR #52가 열려 있다. 병합 전 main 변경을 다시 확인하고 최신 기능을 보존한다.

## 2026-10-02 PR #52·#53 통합 비교와 실제 후보 검증 (codex)

- 사용자의 다른 PC 결과가 이전 구현일 수 있다는 요청에 따라 #52를 최신 main과 비교했다. head `aab72db`는 main `23d4d1f`를 기준으로 2커밋 앞서 있고 뒤처진 커밋은 0개다. 가정통신문 6개 소스 외 학생 결과·영수증·서버·Electron 제품 코드를 되돌리지 않는다. 과거 리뷰 문서와 현재 제품 완료 증거를 구분했다.
- 별도 `codex/consent-student-combined-check` 워크트리에서 #53 `73c9110`과 #52를 커밋하지 않는 시험 병합으로 적용했다. 충돌 없음. 타입·린트(기존 경고 6)·단위 532개·설치된 Chrome 전체 298개·빌드 통과. Chrome 조건부 생략 5개는 별도 SQL 서버가 필요한 검사이며 이전 전용 실행 결과와 구분한다. 두 PR과 main을 병합하거나 변경하지 않았다.
- #53 후보 `SchoolDoc_Portable_1.0.1_73c9110b3f2c.exe`를 사전 릴리즈로 게시하고 다시 다운로드했다. SHA-256 `5e982a26302eeaf6a38abe9f9506adf2e4a6f17acd3de25715f1c7ea7f1d1ae6`, 101078043바이트. Windows 64비트 `10.0.26200.0`, 소스 밖 한글·공백 경로에서 실제 실행했다.
- 실제 지정 계정·Supabase에 가상 2명의 안내를 만들어 CSV 업로드, 총점, 틀린 번호 거절, 본인 조회, 확인/이의/답변, 사유 없는 정정 거절, 정정 후 오래된 확인 거절·최신 재확인, 링크 재발급의 세션 폐기, 안내 종료를 검증했다. 일반 Chrome과 EXE 교사 현황의 반영을 확인했다. 실제 PNG·A4 PDF 다운로드와 저장 PNG의 QR 링크 접속, EXE Google 로그아웃·재로그인·종료 후 재실행, 두 쪽 PDF.js 표시도 확인했다. 이번 시험 안내만 삭제하고 기존 실제 업무는 보존했다.
- DB `202610020200`·`202610021000` 적용 확인. 공개 함수 v18·교사 함수 v16 ACTIVE, JWT true 유지. 서버 secrets·암호화 키는 변경하지 않았다. #53 CI `36981467326` verify/package 성공, Preview `6803967495` 성공. main·운영 웹·정식 EXE는 아직 미적용이다.
- 남은 사항: EXE 전체 세션 로그아웃 뒤 열려 있던 Chrome의 사용자 표시가 남는 복구 UX, 실제 인쇄 출력, IndexedDB 원본 재실행 보존, #52의 실제 가정통신문 발행·보호자 제출과 필요한 다른 EXE 흐름. 정상 Chrome 로그아웃·재로그인 복구는 성공했지만 자동 복구 개선 완료로 보고하지 않는다. Ctrl+P가 인쇄창을 열지 않았고 실제 앱 인쇄 버튼 검사를 대신하지 않는다.
- 두 PR은 draft OPEN이며 필수 후보 검증 완료 전 main에 병합하지 않는다. 기존 main `23d4d1f` 정식 게시의 `Draft release metadata mismatch` 실패도 후속 확인한다. 문서 커밋은 제품 코드와 별도로 기록하며 문서 head의 후보가 검증됐다고 주장하지 않는다. 이전 릴리즈의 예외를 새 작업에 적용하지 않는다.
- 판단·전체 검사·실제 증거·재개 순서는 [상세 통합 기록의 후속 절](../design/student-results-integration/2026-10-02/report.md)에 추가했다. 기록과 증거만 별도 커밋·push하고 원본 사용자 checkout의 미커밋 4개를 보존한다.

## 2026-10-02 배포 전 오류와 남은 사용 흐름 검토 (codex)

- 제품 코드 변경 없이 실제 `73c9110` 후보와 현재 main·PR #52·#53을 검토했다. main에도 존재하는 P1 자료 수합 마감 시각 9시간 차이와 P2 서버 인증 거절 후 Chrome 사용자 표시·재로그인 복구 문제를 확인했다. 근거·영향·수정 완료 기준은 [상세 통합 기록의 남은 흐름 검토](../design/student-results-integration/2026-10-02/report.md)에 남겼다.
- 실제 `A4 인쇄 · PDF` 버튼으로 Windows 인쇄창과 Microsoft Print to PDF 실행까지 확인했지만 출력 파일은 확인하지 못했다. 가상 11쪽 PDF의 서버 분석 거절·원본 보관·직접 입력 복구·저장 원본 첫 표시가 성공했다. EXE 종료·재실행 후 다른 작업의 동일 창 사용이 관찰돼 조작을 중단했으며 IndexedDB 원본의 재실행 보존은 미검증이다.
- 이번 원격 가상 수합 `f630f461-beef-4577-97e0-be9b81822a43`만 종료했다(가상 대상 2명·제출/파일 0개). 삭제는 미완료다. `[검증용 20261002] EXE 저장 검토` 로컬 장부와 가상 PDF도 보존 검사·이번 자료만 정리가 남았다. 기존 실제 업무·다른 장부는 변경·정리하지 않았다.
- #53 head `ee424e0` CI `36993499733` verify/package 성공, PR publish 생략. #52·#53은 draft OPEN, main `23d4d1f` 유지. main CI `36966642401`은 게시 metadata 검사 실패이며 현재 일치하는 초안 메타데이터만으로 당시 원인을 확정하지 않았다. 게시된 정식 최신은 `48de047b8447` 기준이다.
- 두 오류 해결과 출력·저장·가정통신문 실제 후보 검증을 마친 뒤 main 병합 및 정식 EXE 검증을 이어간다. 이번에는 문서·가상 화면만 커밋·push하며 제품 코드와 사용자 checkout의 미커밋 4개를 보존한다.

## 2026-10-02 자료 수합 마감 시간대와 교사 로그인 복구 수정 (codex)

- 앞선 실제 후보 검토의 두 오류를 수정했다. 자료 수합 생성·변경은 현지 시각을 UTC로 전송하고 서버는 유효한 미래 시각을 검증한다. 기존 시간대 없는 요청은 한국 시각으로 호환하며 기존 업무의 마감값·DB 구조·암호화 키는 일괄 변경하지 않는다. 코드 커밋 `487fd7b`.
- 현재 교사 요청의 401 뒤 인증 서버가 세션을 명확히 거절하면 앱 사용자 상태와 Google 재로그인 화면을 맞춘다. 네트워크 실패·익명 요청은 로그인 해제로 처리하지 않고 늦은 이전 요청이 새 로그인을 지우지 않게 했다. 자동 저장 재시도나 학생 자료 영속 저장은 추가하지 않았다. 코드 커밋 `82844ab`.
- 타입·린트(기존 경고 6)·단위 547개·빌드·desktop 12개·기존 Deno 서버 70개/20하위단계 통과. 실제 로컬 PostgreSQL의 마감 시간대/정각 제출 차단 5개와 HTTP/SQL Chrome 5개 통과. 서버 타입·SQL 마감 검사를 CI에 추가했다.
- 전체 Chrome 실행은 301통과·새 대역 준비 오류 2실패·별도 서버 검사 5생략이었다. 대역의 보관 설정 API와 실제 접근 가능한 이름을 맞추고 최종 관련 7개를 재검증해 통과했다. 전체 303개 항목을 확인했고 5생략은 전용 서버 검사로 따로 통과했다. 옵션이 전달되지 않은 중복 전체 실행은 중단했으며 완료로 세지 않았다.
- 1366/390px 전체 화면·Axe·키보드 복구와 한국/미국 시간대 가상 왕복 증거를 [상세 수정 기록](../design/student-results-integration/2026-10-02/report.md)에 남겼다. 실제 전문가·교사 시험이 아니다. 브라우저 OAuth의 전체 페이지 이동은 기존 탭 메모리 초안 한계를 유지한다.
- GitHub PR #53에 목적별 코드 커밋과 별도 문서 커밋을 push하고 제목·검증 본문을 갱신했다. #52와 원본 checkout의 사용자 변경 4개는 보존했다. 새 data-collect-admin 원격 배포, 실제 Google·Supabase·수정 후보 EXE 검증, 인쇄 PDF/IndexedDB 보존/시험 자료 정리는 미완료다. main 병합·정식 배포 완료로 보고하지 않는다.

### 최종 후보 통합·배포 진행 (codex)

#52 가정통신문을 #53 통합 브랜치에 반영하고 자료 수합 서버 v10(ACTIVE/JWT 유지)을 배포했다. 타입·린트·548단위·빌드·15desktop 통과. 릴리즈 초안 조회 지연을 안전 재시도로 처리하며 원인 미확정인 기존 실패를 진단할 필드를 추가했다. 새 실제 후보·전체 Chrome·원격 흐름·인쇄·재시작 보존·main/정식은 진행 중이며 완료로 보고하지 않는다. 상세: [통합 검증 기록](../design/student-results-integration/2026-10-02/report.md).


## 2026-10-03 최종 통합 후보 실제 검증 (codex)

- #52 가정통신문을 포함한 #53 b28 후보를 게시 후 다운로드, SHA-256 일치와 실제 Windows 한글·공백 경로 실행 확인. 최종 타입·린트·548단위·305 Chrome + 별도 서버5·15desktop·빌드 및 CI verify/package 통과.
- 실제 Supabase 자료 수합의 마감 시각 일치·마감 거절 후 입력 유지/연장 재제출, EXE 현황 반영·파일/Excel/QR 저장·Windows Print to PDF 실제 출력 성공. 통신문 개별 배치·발행 확인·모바일 아니오 제출·교사 조회·PDF/Excel의 비동의 유지 성공. 영수증 원본/수기 장부·종료 후 재실행·IndexedDB 1/11쪽·로그아웃/재로그인 후 저장 유지 성공.
- 재로그인 오류의 Google 창 미생성 가설은 오래된 브라우저 연결의 빈 탭 목록으로 인한 판단을 정정했다. 현재 창 연결 후 원래 게시 후보의 정상 로그아웃→Google 선택→재로그인→가상 장부 재조회 통과. 임시 진단 변경을 복원했으며 토큰을 추출하지 않았다.
- 기능별 검증 방식/범위, 실제 전체 화면·출력, 시험 자료 ID, 영구 삭제 불가 수합과 기존 기본 프로필의 미정리 자료, 실물 프린터·AI 인식 정확도 미검증을 [상세 기록](../design/student-results-integration/2026-10-02/report.md)의 최신 절에 남겼다. 실제 전문가/교사 시험으로 보고하지 않는다.
- 문서 기록 시점에는 main 23d4d1f 유지·병합/새 정식 릴리즈 대기. 최신 head CI/후보 실행을 확인한 뒤 squash 병합·main 자동 릴리즈·정식 다운로드 실제 검증을 이어간다. 기존 사용자 미커밋4개·실제 업무·개인정보·키/secrets는 보존했다.


## 2026-10-03 최신 후보 재검증과 주말 CI 복구 (codex)

- 문서 커밋 d057f241c20f5491090d408157b7535f6c03b652의 [후보](https://github.com/moodoocoding/schooldoc/releases/tag/portable-rc-v1.0.1-d057f241c20f)를 게시·다시 다운로드했다. SchoolDoc_Portable_1.0.1_d057f241c20f.exe, 101078546바이트, SHA-256 `3f78e84999a1c3fdbd07918b30669626f6378781e0eb847230be78e26a335ebc` 일치. 실제 패키지 대역 15개 통과. 앞선 b28과 제품 소스는 같으며 세부 흐름 전체를 새 후보에서 반복한 것으로 보고하지 않는다.
- 실제 Windows 10.0.26200 x64 한글·공백 경로에서 같은 전용 시험 프로필로 실행했다. 기존 가상 영수증 12,340원/잔액37,660원·원본 PDF 1/11쪽 유지, 정상 Google 로그아웃→현재 Chrome 계정 선택→같은 EXE 재로그인→가상 장부 복원 성공. 이번 가상 학생 안내 196c1452-c99e-4b8a-9349-9dbf1cb62100의 82점·확인1명도 원격 재조회했다. 기존 실제 업무는 열거나 변경하지 않았다.
- [CI 37025330119](https://github.com/moodoocoding/schooldoc/actions/runs/37025330119)는 Chrome 304통과·1실패·5별도 서버 생략으로 verify 실패, package/publish 미실행이었다. 한국 시간 토요일에 월~금 예약표의 오늘 칸이 없는데 배색 검사가 이를 요구하는 날짜 준비 오류다. 실패 전체 화면·DOM과 한국 날짜 공통 함수를 대조해 확인했다. 실패한 CI를 통과로 보고하거나 main을 병합하지 않았다.
- 검사 커밋 3a6d03d에서 평일 시계만 고정하고 기존 배색 3개 기대값을 그대로 유지했다. UTC 금요일·한국 토요일 경계에서는 오늘 표시가 없고 예약 칸이 활성화되는 별도 검사를 추가했다. 제품 소스는 변경하지 않았다. `node node_modules/@playwright/test/cli.js test tests/e2e/special-rooms-week-grid.spec.ts` 11개, `npm run typecheck`, `npm run lint` 통과(기존 경고6).
- 이 기록 시점에는 최신 전체 CI·새 후보·main squash·자동 정식 릴리즈·정식 다운로드 실제 검증은 대기다. 최신 main 변경 여부와 필수 결과를 확인한 뒤 이어간다. 기존 사용자 미커밋4개와 실제 자료·키·secrets는 보존했다. 시험 자료의 정리 대기 ID·이유와 실물 프린터/AI 인식 정확도 한계는 앞 절을 따른다.

## 2026-10-03 전체 미사용 코드 검토와 정리 (codex)

- 기준은 최신 원격 main의 7cc1680ee30d3416154c9473fe7fa741fbedc444이다. 별도 브랜치 codex/remove-unused-code-20261003에서 진행했으며, 코드 커밋은 e7acb6c8efc7c4edbe0b69fe56799762c0a0b7ec이다.
- 추적 중인 TypeScript/JavaScript 466개 파일을 대상으로 import/export·동적 import·require·자산 URL 참조를 분석했다. 제품 프런트엔드 224개, Edge Function 37개, Electron 4개, 빌드·검증·릴리즈 스크립트 4개와 설정·테스트의 진입점을 대조했다. 미사용 코드 정리를 위한 참조 검토이며 모든 코드의 보안·정확성을 보증하는 감사가 아니다.
- 완료 기준은 삭제 대상의 실행/테스트 참조 확인 → 남은 동작 코드 대조 → 타입·단위·서버·Chrome 검사 → 변경과 한계 기록이다. 네 단계 모두 완료했다. 자동 분석 후보를 그대로 삭제하지 않고 전체 검색과 호출 경로를 함께 확인했다.
- 시작 전 원본 main checkout의 사용자 변경 4개(DEVELOPMENT.md, 개발 일지, receiptExportPdf.ts, receipt-export.spec.ts)를 확인했으며 종료 시 동일한 64줄 추가·38줄 삭제 상태를 확인했다. 사용자 변경은 별도 워크트리의 이번 커밋에 포함하지 않았다.

### 삭제 대상과 근거

| 범위 | 정리 내용과 근거 |
| --- | --- |
| 연결되지 않은 화면 19개 | Classmate, Community, CreateEventModal, Dashboard, EventDetail, Infomate, KanbanSidebar, KanbanWorkspace, LandingPage, Navbar, PinterestGrid, PinterestNavbar, PinterestSidebar, QRPrintView, StudentPortal, TeacherDashboard, Timetable, ToolExecutionPage, Workmate의 TSX 파일을 삭제했다. 현재 App 라우팅·데모·테스트에서 도달하지 않으며 현행 기능 화면으로 대체되었거나 시안으로 남아 있었다. |
| 이전 데이터 모델·유틸리티 | src/types/index.ts, src/utils/excelHelper.ts, src/utils/mockData.ts와 schooldoc.ts의 이전 시안 전용 타입 5개를 삭제했다. 삭제한 예전 화면 이외의 호출이 없다. 현재 학생 결과 안내의 가져오기·조회·QR·내보내기는 별도 기능 구현과 테스트를 유지한다. |
| 시안 자산·별칭 | 미사용 App.css, hero.png, react.svg, vite.svg, public/icons.svg와 RemotePublicDataCollectPage.tsx의 사용하지 않는 재수출 별칭을 삭제했다. index.html이 사용하는 favicon.svg와 PDF 폰트·라이선스는 유지했다. |
| 1인 1역 | 연결되지 않은 RolePracticePage와 관련 import를 삭제했다. 현행 RolePracticeBoardPage·RoleHistoryPage 및 학생/전자칠판 경로는 유지했다. |
| 자료 수합 | 사용하지 않는 라벨·용량 상수 별칭, 관리자 오류 판별 별칭, 이전 get/status/delete/submit 서비스 래퍼 및 get/status API를 제거했다. 목록·현황·공개 제출·재제출·마감 복구·소유자 확인·파기는 현행 경로를 유지한다. 진행 업무의 이전 목록 fallback은 실제 사용하므로 남겼다. |
| 등록부 서명 | 사용하지 않는 전체 목록/관련 행 일괄 조회와 데모 백업·복원·초기화 연결 함수를 제거했다. 현행 요약 목록·snapshot·이미지 조회·서명·파기 경로는 유지했다. |
| 학급 미션·특별실 예약·통신문 | 미사용 subscribeMissions, 특별실 listBoards/getBoard 서비스 래퍼, 통신문 replaceConsentRecipients/getConsentPublicMetadata 래퍼를 제거했다. 실제 사용하는 변경 이벤트·새로고침·공개 open/document·발행 경로는 유지했다. |
| 영수증 | 미사용 복원 날짜 라벨과 호출되지 않는 브라우저 이미지/PDF OCR 파이프라인을 제거했다. 서버 AI 분석·외부 전송 동의·수기 입력·예산 반영·IndexedDB/localStorage·PDF 내보내기는 유지했다. |
| 의존성·Tailwind 설정 | tesseract.js와 전이 의존성 12개를 제거했다. 새 패키지 추가나 남은 패키지 버전 변경은 없다. 현재 사용하는 클래스가 없는 fluent/brand 색상 설정을 제거했다. |
| 서버 공통 선언 | normalizeRecipientName 별칭, DataCollectDecision 타입, PdfColumnWidths 인터페이스만 제거했다. 암호화 구현·키·인증·RLS·요청 제한·파일 검증·마이그레이션은 변경하지 않았다. |

- 코드 변경은 48개 파일, 6,515줄 삭제·3줄 추가이며 파일 자체 삭제는 28개다. 남은 17개 수정 코드 파일의 import 이외 최상위 실행 문장은 삭제 전과 동일하다.
- 정리 후 프런트엔드 파일은 201개다. 실행·테스트 기준의 미참조 소스 파일은 남지 않았다. 테스트 전용 receiptOcr.ts의 텍스트 파서, registryBackup.ts, specialRoomsOptimistic.ts는 기존 회귀 검사 계약을 유지했다. 이 세 모듈을 실제 제품의 실행 경로라고 보고하지 않는다.
- 자동 분석에서 미사용으로 보였던 downloadReceiptBookPdf는 ReceiptBookDetailPage의 동적 import 후 구조 분해로 실제 호출되므로 보존했다. HTML·CSS·서버 설정에만 쓰이는 자산도 별도로 확인했다.
- 현재 화면을 새로 만들거나 배치를 바꾸지 않았다. 삭제 전후 CSS를 대조하여 사용하지 않는 클래스 409개가 빠졌고, 해당 클래스의 현재 소스 내 직접 참조는 0개였다. 프로덕션 CSS는 130,953 → 92,557바이트로 38,396바이트(약 29.3%) 감소했다. 미사용 색상 설정 추가 정리 뒤에도 CSS 파일 이름·크기가 같았다. JavaScript 전체 크기나 EXE 크기 감소로 과장하지 않는다.
- Chrome에서 생성한 가상 24명 통신문 PC 전체 화면과 혼합 제출 상태의 30명 자료 수합 모바일 전체 화면을 확인했다. 현황·QR·제출 상태·다운로드 영역의 배치를 유지했다. 별도의 신규 디자인 평가나 실제 전문가/교사 사용성 시험을 한 것으로 보고하지 않는다.

### 검증 결과

| 실행한 검사 | 최종 결과 | 검증 범위 |
| --- | --- | --- |
| npm run typecheck | 통과 | 최초에는 삭제 후 남은 roleButton import를 검출했다. 제거 후 전체 타입 검사 통과. |
| npm run lint | 통과, 기존 경고 4개 | ToolCard/BookingSheet의 컴포넌트와 도구 함수 혼합 export 2개, 과거 design 검증 스크립트의 미사용 인자 2개. 현행 기능에서 쓰는 함수를 경고 해소 목적으로 삭제하지 않았다. |
| npm test | 69개 파일·547개 테스트 통과 | 기존 테스트 삭제·기대값 완화 없이 전체 실행. 서버 선언 정리 후 다시 실행해 같은 결과 확인. |
| npm run test:e2e | Chrome 306개 통과·5개 조건부 생략 | 새 시험 프로필, 127.0.0.1:4173 데모/가상 HTTP 대역. 학급 미션·1인 1역·학생 결과 안내·통신문·등록부·자료 수합·특별실·영수증·진행 업무·설정·인증 복구·모바일·QR/PDF/Excel을 포함. 실제 Google/Supabase 검증과 구분한다. |
| npm run test:server-flow | 별도 Chrome 5개 모두 통과 | 기존 Deno 2.9.6으로 4195/4196 로컬 HTTP·PGlite PostgreSQL 가상 서버 실행. 위 전체 E2E에서 생략된 5개를 별도 완료했다. |
| npm run test:desktop | 15개 통과 | Electron URL·IPC·OAuth 경계와 릴리즈 게시의 단위 검사. 실제 게시 EXE 실행 검사를 대신하지 않는다. |
| Deno 2.9.6 check --no-lock --node-modules-dir=none | 수정한 서버 모듈 3개 통과 | _shared/dataCollectRules.ts, _shared/consentCrypto.ts, registry-pdf/layout.ts |
| Deno 2.9.6 test --no-lock --allow-env --allow-read --node-modules-dir=none | 70개·20하위단계 통과 | classMissions.test.ts, classMissionsRegression.test.ts, classroomRoles.test.ts, classroomRolesSql.test.ts, registryPublic.test.ts, specialRooms.test.ts, specialRoomsSql.test.ts, studentResults.test.ts, studentResultsSafety.test.ts. 모두 tests/server 아래의 대역·로컬 SQL 검사. |
| npm run build | 통과 | 의존성 정리·PDF.js legacy worker·CSS 생성 확인. 기존 500KB 초과 chunk 안내는 남아 있으며 경고 기준을 완화하지 않았다. |
| npm ls --depth=0·의존성 diff | 통과 | tesseract 계열 12개만 제거, 추가/버전 변경 0개 |
| git diff --check·남은 코드 AST 대조 | 통과 | 삭제 대상 이외의 실행 문장 변경 없음, 테스트 및 과거 검증 이력 변경 없음 |

- 전체 E2E가 덮어쓴 과거 리뷰 이미지·PDF·Excel·JSON 53개는 이번 로컬 test-results/code-review/e2e-evidence로 보관하고 추적 파일을 원래 이력으로 복원했다. 참조 그래프·삭제 목록·CSS/의존성 대조는 같은 무시된 test-results/code-review에 보관했다. 이 검사 산출물을 GitHub에 게시한 것으로 보고하지 않는다.
- 외부 ../schooldoc-docs/development-history.md는 없어 이 저장소의 기존 개발 일지에 기록했다. 원본 README·DEVELOPMENT·AGENTS 및 기존 개발 이력을 다시 쓰지 않았다.

### 원격 적용과 남은 범위

- Git은 위 별도 브랜치의 로컬 코드 커밋과 별도 일지 커밋으로 정리한다. 이번 요청에는 새 GitHub push·PR 생성·main 병합·릴리즈를 포함하지 않았으며 원격 반영 완료로 보고하지 않는다.
- DB: 해당 없음. 마이그레이션·RLS·운영 자료·암호화 키·secrets 변경 없음.
- Edge Functions: 미적용. 서버 변경은 미사용 선언 삭제이며 관련 Deno/단위 검사는 통과했지만 이번 정리의 원격 함수 배포는 실행하지 않았다.
- 프런트엔드·EXE: 미적용. 새 후보/정식 EXE 빌드·다운로드·실행, 실제 Google 로그인·원격 Supabase 연동 검사는 이번 코드 정리에서 미실행이다.
- 현재 제거 근거가 있는 코드 정리와 회귀 검증은 완료했다. 별도 보안 감사, 원격 인증/DB 실행 및 릴리즈 검증 결과로 확대 해석하지 않는다.

## 2026-10-03 미사용 코드 정리 병합·배포 진행 (codex)

- 사용자는 정리 브랜치의 main 병합과 웹·포터블 배포를 요청했으며, 추가 지시로 실제 사용자 흐름 재검증은 이후에 진행하도록 했다. 이번 배포는 이 명시적인 순서 지시를 따른다. 후보 EXE의 실제 Google/Supabase 검증을 이번 병합 전에 완료한 것으로 기록하지 않는다.
- 원격 main 7cc1680ee30d3416154c9473fe7fa741fbedc444와 정리 브랜치를 다시 대조했다. main의 추가 변경은 없고 브랜치에는 코드 정리 e7acb6c와 검사 기록 42493a7이 있다. 원본 checkout의 기존 사용자 변경 4개를 보존했다.
- 앞 절의 로컬 검사 결과는 유지된다. PR과 main의 필수 자동 검사는 배포 절차에서 실행하며 실패하면 원인을 확인한다. 테스트 삭제·기대값 완화·자동 게시 안전장치 우회는 하지 않는다.
- secrets·DB 마이그레이션은 해당 없음이다. 서버 변경은 미사용 별칭·타입·인터페이스 삭제이며 실행 경로·API 계약 변경이 없어 운영 Edge Functions 재배포는 필요하지 않다. 해당 원격 함수에는 이번 소스 정리를 적용하지 않으며 이를 적용 확인으로 보고하지 않는다.
- 진행 상태: 브랜치 push·PR 생성·필수 CI 확인·squash 병합·main 자동 EXE 릴리즈·Vercel 운영 배포 식별자 확인 대기. 실제 Chrome/EXE 조작 및 운영 시험 자료 생성·제출은 이번 단계에서 실행하지 않는다.
- 후속 검증 대기: 게시된 EXE 다운로드와 SHA-256 대조 및 Windows 실행, 실제 Google 로그인·세션·로그아웃, Supabase 업무별 정상 흐름·오류 복구, EXE와 공개 Chrome의 링크/QR 제출 및 교사 반영, PDF·업로드·다운로드·인쇄, 한글/공백 경로·저장값 유지·재시작. 데모·모의 서버 CI 통과를 이 항목들의 성공으로 대체하지 않는다.

### main 통합과 웹 배포 확인

- PR: https://github.com/moodoocoding/schooldoc/pull/54 — 2026-10-03 07:45:39 KST squash 병합 완료.
- main: 9c03e05bcc4ff2e8c84949ab2c91f18d616110b5, 제목은 refactor(shared): 미사용 화면과 중복 서비스 코드 제거. PR head c6e2c4c53c039a9f4fb68f99e36368adad471c1d와 병합 main의 파일 내용 차이는 없다.
- PR CI: https://github.com/moodoocoding/schooldoc/actions/runs/37071591362 — verify·package 통과, PR에서 정식 게시 단계는 의도적으로 생략. 타입·린트·단위 547개·desktop 15개·Deno 서버 70개/20단계·SQL 안전 검사·웹 빌드·Chrome 306통과/5조건부 생략·별도 서버 흐름 5개·Windows EXE 빌드와 모의 실행을 완료했다. Chrome 검사는 21.6분, verify 전체 24분7초, package 4분이었다.
- 진행 중 CI 상태에서의 초기 병합 시도는 자동 승인 검토가 필수 검사 미완료를 이유로 거절했으며 실행되지 않았다. CI를 우회하지 않고 verify와 package가 모두 성공한 후 같은 head와 최신 main을 확인해 병합했다.
- Vercel 프런트엔드: 적용 확인. GitHub Production deployment 6819833934가 위 main SHA와 일치하고 success다. 배포 URL은 https://schooldoc-2v8qefcw1-panthea0-9353s-projects.vercel.app, GitHub 상태가 연결한 Vercel 배포 페이지는 https://vercel.com/panthea0-9353s-projects/schooldoc/849T8a4jGaSDRxCE22kEXErPeW6F이다. 운영 주소는 https://schooldoc-nine.vercel.app. 현재 연결 앱의 Vercel scope 권한 제한으로 직접 상세 조회는 실패했으며, GitHub의 Vercel commit status와 Production 배포 상태를 근거로 확인했다. 운영 사용자 흐름을 시험했다는 뜻은 아니다.
- GitHub Pages 보조 배포: https://github.com/moodoocoding/schooldoc/actions/runs/37074197102 — success. 포터블 CI와 구분한다.
- 정식 포터블: https://github.com/moodoocoding/schooldoc/actions/runs/37074197649 — 위 main의 verify·package·publish 진행 중. PR EXE를 이름만 바꾸어 정식 자산으로 게시하지 않는다.
- 후속 배포 결과는 main 9c03e05를 기준으로 만든 codex/unused-code-deployment-report-20261003의 별도 문서 커밋에 보관한다. 이미 배포한 소스 SHA와 결과 기록을 구분하고, 기록만을 위해 정식 EXE를 반복 생성하지 않는다. 기존 원본 checkout의 사용자 변경 4개는 보존한다.

### 정식 EXE 게시 완료와 후속 검증 대기

- 정식 CI: https://github.com/moodoocoding/schooldoc/actions/runs/37074197649 — 2026-10-03 08:12:32 KST 완료, verify·package·publish 모두 success. main 9c03e05bcc4ff2e8c84949ab2c91f18d616110b5로 새로 빌드했다. verify 22분29초, Windows package 3분44초, publish 27초다.
- main 검사: typecheck·lint·단위 69파일/547개·desktop 15개·Deno 서버 70개/20단계·학생 결과 안전 SQL·자료 수합 마감 SQL·웹 build 모두 통과. Chrome E2E는 306통과/5조건부 생략(20.3분), 별도 서버 흐름은 위 생략 대상 5개 모두 통과했다. 데모/가상 HTTP·로컬 SQL 검사이며 운영 Google/Supabase 검증으로 보고하지 않는다. 기존 lint 경고 4개와 대형 chunk 안내는 유지한다.
- 정식 릴리즈: https://github.com/moodoocoding/schooldoc/releases/tag/portable-v1.0.1-9c03e05bcc4f — draft=false, prerelease=false, GitHub latest 릴리즈다. 릴리즈 태그·게시 manifest·smoke 보고서·현재 원격 main이 모두 위 전체 SHA와 일치한다. 이번 정리의 별도 후보 prerelease는 게시하지 않았으며, PR 빌드 산출물과 정식 main 릴리즈를 구분한다.
- EXE: SchoolDoc_Portable_1.0.1_9c03e05bcc4f.exe, 101,073,626바이트. SHA-256: 4694e7bbe0baa8495aa9c770ee9231d3ec75fcb684869391aa3dbacdff328af5.
- 게시 확인 범위: GitHub EXE 자산 digest/크기와 다운로드한 portable-manifest.json·SHA256SUMS.txt·portable-smoke.json의 commit/hash/size/success를 대조해 일치를 확인했다. EXE 파일 자체의 재다운로드·로컬 SHA-256 계산·이 PC에서의 실행은 하지 않았다. 위 체크섬은 게시 자산과 CI 기록의 값이다.
- 실제 자동 실행 환경: GitHub Actions windows-latest의 Windows x64 패키지 EXE. 보고서는 localArtifact=true, mockedBackend=true, remoteGoogleLogin=not-tested, realSupabase=not-tested, success=true, errors=[]다. 교사 인증 차단, 가상 인증의 8개 업무 이동, 한글/공백 경로, 2페이지 PDF.js worker/canvas, Blob 다운로드와 한글 파일명, 종료·재실행 후 localStorage/IndexedDB 유지, 가상 로그아웃을 확인했다. Electron A4 printToPDF는 통과했지만 실물 프린터와 네이티브 인쇄 대화상자는 미검증이다.
- 사용자 지시에 따라 실제 수동 재검증은 대기다. 새 정식 EXE 다운로드→파일 해시 재계산→소스 폴더와 별개인 한글/공백 경로 실행→Google 로그인/로그아웃→가상 업무 생성·공개 Chrome 링크/QR 제출·교사 반영→PDF/파일/인쇄→저장과 재시작을 이후에 확인한다. 기존 실제 업무·개인정보·키·서버 secrets는 변경하지 않는다.
- 실제 정상 흐름·오류 복구 대기 기능: 학급 미션, 1인 1역, 학생 결과 안내, 가정통신문, 자료 수합, 등록부 서명, 특별실 예약, 영수증, 진행 업무, 설정. 자동 Chrome 검사는 이 기능들의 가상 흐름을 포함하며, 실제 운영 검증 성공으로 바꾸어 기록하지 않는다.
- 최종 배포 상태: 기능 코드 main 통합 완료, Vercel Production 웹 적용 확인, 정식 Windows 포터블 게시 확인. secrets·DB 마이그레이션 해당 없음. Edge Functions는 실행/API 변화 없는 미사용 선언 삭제이므로 이번 소스 정리는 원격 미적용이며 재배포 불필요. 운영 동작 재검증은 미실행이다.
- 원본 checkout 사용자 변경 4개와 64줄 추가/38줄 삭제 상태를 마지막으로 다시 확인했다. 후속 배포 기록은 codex/unused-code-deployment-report-20261003에 커밋·push하며 main에는 아직 통합하지 않는다. 기능 코드는 모두 위 main에 포함됐고, 이 브랜치의 추가 변경은 배포 이후 작성한 작업일지뿐이다. 다음 기능 변경과 함께 기록을 통합할 수 있다.
