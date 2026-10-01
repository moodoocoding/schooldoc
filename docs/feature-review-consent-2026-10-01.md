# 가정통신문 기능별 검토 일지 (codex)

검토일: 2026-10-01. 기준 제품 커밋: `c208afefca40bb4f15cab164fc292661e80fb9a0`.
브랜치: `codex/feature-review-consent-20261001`.

## 목적과 결과

사용자 요청에 따라 가정통신문 수합의 교사 작성·명단·배부·현황·출력·보관과 보호자 원본 응답·확인·재제출 흐름을 검토했다. 전용 관리 워크트리와 4181 데모 서버를 사용했고 공유 checkout·제품 코드·기존 테스트·마이그레이션은 변경하지 않았다. 가상 자료만 사용했다.

[상세 리뷰](../design/feature-reviews/2026-10-01-consent/review.md)에 재현 단계, 실제/모의 구분, 코드 위치, 영향, 수정 요구, 완료 기준, 전체 화면 및 PDF/Excel 증거를 기록했다. 세 디자인 프로파일과 여섯 독립 관점 평가는 AI 모의 검토이며 실제 전문가·교사 인터뷰나 사용성 시험이 아니다.

총 13건(P1 5, P2 7, P3 1)을 발견했다.

| 우선순위 | 발견 내용 |
| --- | --- |
| P1 | 제출 부분 실패·동시 요청에서 응답/수신자/건수 불일치; 원본 교체의 부분 저장·기존 응답 의미 변화; 명단 저장 실패의 무통보 진행; 진행 중 업무 파기 허용; 재제출 결과 중복·옛 제출자 유실 |
| P2 | 이미 제출한 개인 링크가 빈 입력으로 열림; 설정 저장/종료 실패 무알림; 390px CSS200% 주요 버튼 잘림; 긴 응답 PDF의 본문 침범; 개인 QR 브라우저 인쇄 빈 페이지; 잘못된 개인 토큰의 익명 처리; 실제 API 모드의 로컬 안내 |
| P3 | 교사 링크 input 접근 가능한 이름 누락과 파일명 대비 부족 |

필수 질문의 ‘아니오’, 원본 모든 페이지 준비 전 제출 차단, 페이지 실패 후 값 보존·재시도, 모바일 확대/원본 전환·서명, 명단 중복 제외, 대표 Excel·응답 PDF·QR PNG 다운로드는 정상 확인했다. 발견한 결함은 이번 리뷰에서 수정하지 않았다.

## 검증과 한계

- 관련 단위: 10파일 86검사 통과. 실제 명령과 파일 목록은 상세 리뷰의 검증 표에 기록했다.
- 기존 Chrome E2E: 6파일 38검사 통과, 전용 `127.0.0.1:4181` 데모 서버. 원격 Supabase 검증이 아니다.
- 추가 브라우저 관찰: 실제 Chrome 8시나리오 실행 완료, 관찰 도구 오류0. 제품 오류·레이아웃·접근성 문제는 별도로 기록했다. 결함 수정 통과를 뜻하지 않는다.
- 실제 서버 TypeScript·가상 AES-GCM·메모리 Supabase로 7가지 요청/권한/오류 계약 관찰. 원본 교체 부분 실패와 긴 텍스트 PDF는 별도 도구로 재현했다.
- 내려받은 Excel을 재열고 응답 PDF2쪽·QR PDF3쪽·브라우저 인쇄4쪽 전부 렌더해 시각 확인했다. 인쇄4쪽은 모두 빈 페이지였다.
- 초기 node_modules junction의 Vite worker 경로 오류는 리뷰 전용 설정으로 해결했다. agent-browser 실행 파일이 없어 사용자 허용 대안인 Playwright와 설치된 Chrome을 사용했다. 도구 보정 이력은 상세 리뷰에 기록했다.
- 타입/lint/build·전체 단위·Deno 타입·원격 integration·운영 로그인·실제 SQL/RLS/Storage·실제 휴대폰/프린터/카메라·브라우저 UI200% 확대는 미실행. 제품 변경 없는 리뷰 범위의 관련 검사만 수행했고 운영 자료/변경은 허용되지 않았다.
- 외부 공용 개발일지와 `pro/ux-ui-expert.md`가 이 checkout 환경에 없어 확인하지 못했다. 기존 `docs/development-history.md`를 참고했으며 새 기록은 본 전용 일지에만 남겼다.

## 남은 작업과 반영 상태

우선 제출의 원자성·원본/응답 버전·명단 확정·진행 중 파기 차단·최신 응답/이력 계약을 정하고 오류 주입과 동시성 회귀 검사를 추가해야 한다. 이후 사용자 상태/복구, 작은 화면, 출력, 안내, 접근성을 수정하고 세 프로파일·여섯 AI 관점으로 재검증한다. 원격 시험은 사용자에게 허용받은 시험 환경과 가상 자료로 별도 수행해야 한다.

리뷰 자료 커밋: `7447fb22ba6c66681f43643646170f663366dacd`.
일지는 리뷰 자료와 별도 로컬 문서 커밋으로 보존한다. GitHub push·PR 생성·main 병합은 미실행. DB·Edge Functions·프런트엔드 배포는 모두 미적용이다.


## DB 최적화 구현·실제 Chrome 재검증 (codex)

2026-10-02 완료(2026-10-01 착수). 사용자 요청으로 13개 발견 사항의 수정과 DB 최적화를 구현했다. 작업 브랜치는 `codex/consent-integrity-io-20261001`이며 공유 main checkout은 유지했다. 사용자가 선택한 격리 로컬 DB와 가상 자료만 사용했다.

- 원자적 명단 확정/응답 저장, 제출 UUID 멱등·동시성 제어, 불변 원본 revision, 최신/이력 분리, 개인 응답·서명 복원, 종료/확인 후 파일 우선 파기를 구현했다.
- 얇은 목록과 초기 bundle60개, 커서 조회, 요청 시 본문/서명 조회, 명단 변경분 저장, 메모리 원본/상세 캐시로 불필요한 I/O를 줄였다. 같은2,000명/응답100건에서 초기 응답량617,697→29,773바이트(95.18% 감소), 업무 요청3→1. 운영 디스크 IOPS·과금 절감률은 측정하지 않았다.
- 실제 설치 Chrome을 headed Playwright로 제어해 실제 HTTP/Deno/PostgREST/PostgreSQL 경로에서 핵심15흐름을 통과했다. 저장 후 ACK 유실/명단 서버 장애/파일 삭제 실패를 주입해 같은 수합·같은 응답 재시도와 파기 복구를 실제로 확인했다. Auth/Storage는 로컬 JWT·디스크 어댑터로, hosted Supabase 검증은 아니다.
- 타입/lint/build/Deno 서버 check 통과, 전체 단위58파일473검사·관련 데모 Chrome E2E56검사 통과, 마지막 페이징/이름 보완의 해당 파일16검사 재통과. 실제 SQL9검사·이전 암호화 자료 위 전체 신규 마이그레이션 검사 통과. 기존 lint 경고8건/대형 bundle 경고 유지.
- 실제 Chrome7상태 접근성 위반0·pageerror0,2,000명 중 제출100/미제출1900·Excel전체2000명 및 이름 확인. 실제 PDF2/4/3쪽 전체 렌더·시각 확인. 세 프로파일과 여섯 독립 AI 모의 관점의 1차→2차 수정·재검증을 기록했다. 실제 전문가/교사 인터뷰가 아니다.

[상세 구현·검증 보고서](../design/consent-implementation/2026-10-01/report.md)에 항목별 완료 근거, 실제/모의 구분, 전체 화면, PDF/Excel, 정확한 명령과 남은 확인 범위를 보존했다. `DEVELOPMENT.md`에 새로운 DB 저장/조회 및 호환 전환 원칙을 추가했다.

원격 integration·운영 Google OAuth/Storage·실제 기기/프린터/카메라·브라우저 UI zoom200%는 미실행. 200%는 root CSS 글자 확대다. 구현·검증 완료 당시 원격 DB/Edge Functions/프런트엔드 배포는 모두 미적용, GitHub push/PR/main 병합/새 커밋도 미실행이었다. 후속 로컬 커밋은 아래 인계 항목에 기록한다. 신규 SQL은 격리 로컬 DB에만 적용했다. 운영 적용 시 구 직접 수정 API 권한 회수에 따른 점검/호환 전환이 필요하다. 외부 공용 개발일지와 `pro/ux-ui-expert.md`가 없어 기존 전용 일지에 추가했다.

## 통합 세션 인계·로컬 커밋 (codex)

2026-10-02. 통합 세션에서 전달된 사용자 승인에 따라 자기 워크트리의 기능 변경·관련 테스트·검증 보고서·가상 산출물을 로컬 커밋했다. 기존 리뷰 커밋은 확인만 했으며 재작성하지 않았다. 이 작업일지는 기능 커밋과 별도 문서 커밋으로 보존한다.

- 워크트리: `C:/Users/panth/.codex/worktrees/review-consent-20261001/260812_schooldoc`.
- 브랜치: `codex/consent-integrity-io-20261001`.
- 기능 커밋: `fd293cea6dcb532671d5b12b40ea38f809b208b7` — `fix(consent): 응답 저장 무결성과 DB 조회 최적화`.
- 검증 보고서: [구현·검증 보고서](../design/consent-implementation/2026-10-01/report.md). 커밋 전 결과: [commit-readiness.json](../design/consent-implementation/2026-10-01/evidence/commit-readiness.json).
- 커밋 전 재확인: `npm run typecheck`·`npm run lint` 통과(기존 경고8), `npm test -- tests/unit/consentSubmissionIntegrity.test.ts tests/unit/consentResponseRender.test.ts` 2파일13검사 통과. staged diff 통과, 주요 검증 소스6개의 manifest 해시 일치, 최종 일지를 포함한 로컬 Markdown 링크30개 누락0.
- 산출물 보완: 가상 원본 PDF가 Git에서 텍스트로 판정되는 문제를 검증 폴더 `.gitattributes`의 PDF binary 지정으로 해결했다. PDF4개 모두 작업 파일과 staged blob 바이트 일치 확인. 시험 DB/키/토큰/의존성은 `.runtime/` 제외 상태다.
- 기존 완료 검증: 단위473·데모 Chrome E2E56/최종16·실제 PostgreSQL9·실제 Chrome15·axe7상태 위반0·PDF 전체 시각 확인. 이번 인계에는 서버/Chrome를 재시작하거나 원격 검사를 추가 실행하지 않았다. Auth/Storage는 로컬 어댑터이고 hosted Supabase/Google OAuth 성공으로 보고하지 않는다.

앞서 알린 미완료 항목은 다음과 같이 남겼다. F01~F13 결함 수정은 완료했으며, 긴 QR 이름 줄임표는 기존 A4 카드 규격을 유지한 후속 출력 개선이다. 긴 명단/응답의 초기60개·추가 조회 범위는 개선했지만, 목록 접기와 공유 영역 우선 배치는 추가 UX 구조 변경으로 남겼다. 각각 카드 높이/다쪽 출력 및 업무 우선순위 설계·전체 화면 재검증이 필요하므로 이번 확정된 기능 인계에 구조 변경을 추가하지 않았다. 관련 없는 lint8건과 기존 대형 bundle 경고도 유지했다.

공통 파일 변경은 `DEVELOPMENT.md`의 가정통신문 DB 규칙, `src/index.css`의 가정통신문에 한정한 인쇄/관리 스타일, `src/features/settings/privacyRetentionSettings.ts`의 가정통신문 파기 확인 수량 전달이다. 공유 main checkout과 다른 세션/기능의 파일은 수정하거나 포함하지 않았다.

DB 마이그레이션: `supabase/migrations/202610011000_consent_integrity_io.sql`. 관련 Edge Functions: `consent-forms-admin`, `consent-forms-public`. 두 함수가 함께 사용하는 신규 `_shared/consentServer.ts`도 기능 커밋에 포함했다. 신규 SQL은 격리 로컬 DB 적용 확인이며 원격 DB는 미적용, 서버 함수와 프런트도 운영 미적용이다. 구 직접 수정 권한 회수 때문에 호환 전환과 프런트 자동 배포 순서 조정이 필요하다.

GitHub push·PR·main 병합·Supabase DB/함수·프런트 운영 배포는 통합 세션 담당이며 이 세션에서는 실행하지 않았다. hosted Supabase Auth/Storage/Google OAuth·실제 원격 제출/권한 검증은 허용된 가상 자료와 대상으로 배포 이후 수행할 남은 검사다. 실제 기기/프린터/카메라·Chrome UI zoom200%·화면낭독기 전체 흐름·운영 IOPS/과금도 미확인이다. 로컬 DB/HTTP/Chrome 증거와 원격 검사 결과를 구분해 인계한다.
