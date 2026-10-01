# 가정통신문 DB 최적화 구현·검증 (codex)

작업 기간: 2026-10-01~2026-10-02. 작업 브랜치: `codex/consent-integrity-io-20261001`.
기준 리뷰: [13개 발견 사항](../../feature-reviews/2026-10-01-consent/review.md).
공유 main checkout을 유지하고 별도 작업트리에서 수정했다. 모든 시험 자료는 가상이다.

## 결과와 최종 설계

- 수합·명단·비밀번호 확정, 응답·서명 참조·수신자 최신 포인터·카운터 저장을 각각 DB 트랜잭션으로 처리한다. 새 수합은 `preparing`에서 시작하고 명단 확정 이후 `ready`로 공개한다.
- 요청 UUID와 내용 digest로 같은 제출 재시도를 재사용한다. 수신자/수합 행 잠금과 이전 응답 ID 비교로 다른 화면의 늦은 재제출을 거부한다. Storage 업로드는 트랜잭션 밖에서 수행하며 실패·결과 불명 시 실제 커밋을 확인하고 필요한 정리 기록을 남긴다.
- 응답이 있으면 원본·필드·페이지 구조를 DB에서도 고정한다. 응답 전 수정은 새 UUID 파일을 업로드한 뒤 경로를 전환한다. 기존 자료와 암호화 키를 바꾸지 않는다.
- 관리 목록은 작은 DTO만 읽는다. 관리 첫 조회는 STABLE RPC의 같은 스냅샷에서 수합 설정·명단 60명·최신 응답 헤더 60개를 반환한다. 헤더/이력 조회에서는 암호화된 본문도 선택하지 않는다. 상세와 서명 URL은 버튼을 누를 때만 읽는다.
- 명단은 `(created_at,id)`, 응답은 `(submitted_at,id)` 커서로 60개씩 읽는다. 전체 검색과 QR·Excel 내보내기를 선택하면 전체 자료를 읽는다. 현재 불러온 범위를 표시하며 제출/미제출 수는 전체 카운터를 쓴다.
- 수신자 ID/개인 토큰을 보존하고 HMAC이 달라진 명단만 갱신한다. 불필요한 전체 delete/insert, 새 폴링, 입력별 서버 자동 저장은 추가하지 않았다.
- 원본은 계정·문서 버전·경로를 키로 9분 동안 메모리에 재사용한다. 상세도 9분 메모리 캐시이며 서명 URL 수명 10분보다 짧다. 같은 계정의 동시에 진행되는 읽기 요청을 합치고 저장 요청은 합치지 않는다.
- 최신 응답을 결과 표/전체 PDF에 한 번씩 포함하고 예전 제출은 별도 이력에 보존한다. 내보내기 페이지마다 업무 갱신 버전을 확인하고 바뀌면 재시작을 요구한다.
- 종료된 업무만 교사의 대상·이력 수 확인 후 파기한다. `purging` 동안 재개를 막고 파일 삭제 및 재조회 확인 후 행과 감사 기록을 원자적으로 처리한다. 최초 파일 수를 보존해 부분 실패 후 재시도 감사 수량도 유지한다.
- 원본 필드에 담기지 않는 긴 텍스트는 원본에 별지 안내를 표시하고 전문을 추가 A4 페이지에 쓴다. 개인 QR 인쇄 root/CSS를 수정했고 QR PNG 저장은 유지했다.

## 발견 사항별 완료 근거

| 항목 | 반영 | 실제 확인 |
| --- | --- | --- |
| F01 제출 부분 실패·동시성 | 원자적 RPC, 멱등 요청, 이전 응답 비교 | 실제 PostgreSQL 8개 동시 요청→1건, 두 화면 충돌→1성공/409, 서명 참조 실패 전체 롤백; 실제 Chrome 커밋 응답 유실 후 재시도→응답1/서명1 |
| F02 원본 교체·응답 의미 | 불변 파일 경로, 문서 revision, 제출 후 DB guard | Chrome 응답 전 파일 전환·이전 파일 삭제; 응답 후 SQL 수정과 오래된 revision 제출 차단 |
| F03 명단 실패 무통보 | 비공개 준비 상태, 생성 ID 초안 보존, 같은 수합 재시도 | 관리 서버 HTTP503에서 입력 유지/행1/공개425; 복구 후 같은 수합 ready/명단1 |
| F04 진행 중 파기 | closed·수량 CAS·파일 우선 삭제 | 진행 중 UI/SQL 차단, 실제 파일 삭제 실패 시 행/원본 유지, 재시도 후 삭제·감사 파일수1 |
| F05 중복 결과·제출자 | 최신 view와 이력 분리, recipientId 연결, 미조회 이름은 상세에서 확인 | 최신1/이력2, Excel 최신1만 포함; 100건 페이지/2,000명 표에서 이름 유지 |
| F06 빈 개인 재응답 | 이전 값·선택·서명 복원, 수정 불가 시 완료 안내 | 실제 Chrome 비동의/의견 복원, 이전 서명 재사용 시 파일 추가 없음 |
| F07 실패 무알림 | 오류·저장 중·복구 안내 | 실제 HTTP 실패 후 설정 입력 유지와 성공 재시도 |
| F08 좁은 화면 | 최소 폭 해제·한 열·버튼/행 줄바꿈·수량 축약 제거 | 실제 Chrome390px/루트 글자200%, scrollWidth≤viewport, 모든 관리/하단 버튼 폭 안 |
| F09 긴 PDF | 원본 칸 클립·별지 전문 | 실제 다운로드4쪽을 렌더해 원문/비동의/서명/별지 끝 ‘최신’ 확인 |
| F10 QR 빈 인쇄 | print root/visibility와 페이지 나눔 | 실제 Chrome print-to-PDF3쪽 전부 비어 있지 않음, QR/이름/쪽번호 확인 |
| F11 개인 토큰 | 형식/소속 검증, 익명 변환 금지 | 잘못된 개인 토큰400 및 입력 불가 |
| F12 로컬 안내 | 데모 모드만 안내 | 실제 API 모드에 로컬 저장 안내 없음 |
| F13 이름·대비 | 링크 label·파일명 색 보완 | 키보드 링크 focus/Tab, axe 관리/공개7상태 위반0 |

## 로컬 I/O 비교

동일한 실제 로컬 DB의 가상 명단2,000명·응답100건. 이전 구현의 SQL/DTO 직렬화와 새 HTTP bundle을 비교했다. 이전 운영 버전을 별도 배포해 측정한 것은 아니다.

| 첫 관리 조회 | 이전 | 변경 후 |
| --- | ---: | ---: |
| 업무 요청 | 3 | 1 |
| 응답 본문 바이트 | 617,697 | 29,773 |
| 명단 복호화 | 2,000명 | 60명 |
| 응답 본문 복호화 | 100건 | 0건 |

전송 본문은 95.18% 감소했다. Auth/OPTIONS/DB 내부 RPC 횟수는 ‘업무 요청’과 별도이며, 초기 source PDF 다운로드를 포함하는 숫자가 아니다. 명단 최초/다음 페이지는 실제 `EXPLAIN ANALYZE BUFFERS`에서 `consent_recipients_form_created_idx`를 사용했다. 응답 최신 조회는 작은 시험 데이터에서 planner가 순차 조회/조인을 택했다. 디스크 읽기 블록은 warm cache에서 0이므로 물리 디스크 IOPS 절감률이나 운영 Supabase 과금 감소를 이 결과로 주장하지 않는다. 새 인덱스는 쓰기 비용도 갖는다.

[전체 수치와 SQL 계획](evidence/io-measurement.json).

## 실제 검증 환경과 명령

이 PC에 Docker/WSL이 없어 native PostgreSQL18.4 + PostgREST16.4 + Deno2.9.6를 격리 디렉터리에서 실행했다. 브라우저는 설치된 Google Chrome154.0.8037.58을 headed 모드로 Playwright가 직접 제어했다. agent-browser0.27.0 설치 후 daemon 연결이 시간 초과되어 실제 Chrome 직접 제어로 전환했다.

`Chrome UI → 실제 HTTP → 저장소의 Edge Function(Deno) → PostgREST → 실제 PostgreSQL`을 통과했다. 브라우저 응답을 `route.fulfill`로 모사하지 않았다. 로컬 Auth/Storage HTTP 인터페이스는 시험용 JWT 검사·디스크 파일 및 storage.objects 구현이다. 실제 hosted Supabase Auth/Storage나 Google OAuth 검증과 같지 않다. 테이블 RLS와 SQL 권한 검사는 실제 PostgreSQL/PostgREST에서 수행했다. 파일 장애는 이 로컬 Storage 어댑터에서 주입했다.

| 검사 | 결과 |
| --- | --- |
| `npm run typecheck` | 통과 |
| `npm run lint` | 통과, 기존 관련 없는 경고8건 유지; 이번 변경의 새 경고0 |
| `npm test` | 58파일473검사 통과 |
| `npm run build` | 통과, 기존 대형 chunk 경고 유지 |
| Deno `check --no-config --no-lock --node-modules-dir=none` public/admin | 통과 |
| `npm run test:e2e --` consent6파일 + app-shell-scroll | 56검사 통과(Chrome, 데모4173) |
| 마지막 페이징/이름 보완 후 consent-forms.spec.ts | 16검사 재통과 |
| `fresh-migration-check.mjs` | 새 실제 DB에 이전 스키마/자료→최종 마이그레이션 통과. 기존 암호문·이력2·최신1·ready/revision1 보존, 익명 비밀번호 변경/직접 제출 권한 없음 |
| `db-verify.mjs` | 실제 DB 동시성·롤백·소유자/RLS·파기·명단 안정성·얇은 bundle9검사 통과 |
| `chrome-verify.mjs` / `chrome-extra.mjs` | 실제 API4181에서 핵심15흐름 통과, pageerror0 |
| `chrome-accessibility.mjs` | 실제 Chrome7상태 axe 위반0·pageerror0, 링크 열기/Tab·대규모100응답 및2,000명 Excel 확인 |
| `inspect-pdfs.py` | 실제 출력 응답2쪽·긴 응답4쪽·QR인쇄3쪽 전부 렌더/시각 확인 |

관련 E2E 명령의 파일 목록:

```text
npm run test:e2e -- tests/e2e/consent-forms.spec.ts tests/e2e/consent-class-roster.spec.ts tests/e2e/consent-questions.spec.ts tests/e2e/consent-small-fields.spec.ts tests/e2e/consent-pdf-compatibility.spec.ts tests/e2e/consent-pdf-recovery.spec.ts tests/e2e/app-shell-scroll.spec.ts
```

초기 E2E54통과/2실패는 진행 중 자료 삭제를 기대하던 과거 검사와 새 closed-only 규칙의 충돌이었다. 대상 종료와 활성 대상 비활성화 검사를 추가한 후 전체56통과했다. 추가 도구 보정: Storage multipart/CORS 및 PostgREST DLL 경로, 검사에서 동적으로 대상이 바뀌는 locator, read-excel-file9의 sheet/data 형식을 맞췄다. 최종 실제 상태를 검증했으며 이러한 중간 실패를 성공으로 숨기지 않았다.

## 세 프로파일의 구현 전·후 판단 (AI 모의)

다음은 AI 검토이며 실제 전문가·교사6명, 인터뷰·승인·현장 사용성 시험을 뜻하지 않는다. 먼저 저장소의 [웹](../../../pro/web-designer.md), [UX](../../../pro/ux-designer.md), [UI](../../../pro/ui-designer.md) 프로파일과 기존 리뷰를 읽었다.

| 프로파일 | 구현 전 판단·근거 | 구현 후 판단·근거 | 남은 확인 범위 |
| --- | --- | --- | --- |
| 웹 | 수정 필요: 모든 자료를 한 번에 읽는 긴 화면, 390/확대 제어 잘림, 불균형 링크/QR 열 | 허용: 요약→최신 응답→명단→배부 순서 유지, 첫60개, 0/24/60/2000 전체 캡처에서 의도된 행 정렬·아래 여백; 모바일 한 열 | 글자200%에서 긴 명단의 세로 길이 증가; 전체 검색/내보내기는 의도적으로 전체 조회 |
| UX | 수정 필요: 명단 실패에도 완료, 제출 불명·재응답 공란, 파기 위험·실패 무알림 | 허용: 비공개 준비/같은 ID복구, 이전 응답·서명 보존, 최신/이력 구별, 종료/수량 확인, 파일 장애 재시도; 실제 버튼/DB 결과 증거 | 실제 보호자·교사 인터뷰 및 교실 전자칠판 현장 미확인 |
| UI | 수정 필요: 링크 이름/파일명 대비, 확대 제어 잘림, 인쇄 빈 쪽 | 허용: 접근 이름/44px 관리 버튼·disabled 표시, 확대 수량 줄바꿈, 오류/성공 role, QR3쪽 출력, axe7상태 위반0/키보드 | canvas/PDF 위 대비의 axe incomplete는 수동 시각 확인으로 보완했지만 화면낭독기 전체 시험은 아님 |

## 여섯 독립 관점과 2차 개발 (AI 모의)

| 관점 | 1차 판정·근거·수정 요구 | 2차 반영과 재검증 판정 |
| --- | --- | --- |
| 웹·정보 위계 | 조건부: 최신1/전체이력2 표기는 개선. 일부 명단만 읽을 때 재배부 숫자를 전체처럼 오해할 수 있음 | 전체 제출/미제출 카운터와 조회 범위를 분리. 2000/100/1900 및 Excel전체2000 실제 확인; 허용 |
| 웹·화면 밀도 | 수정 필요: 390/루트글자200% 첫 캡처에서 링크 input/버튼·QR 버튼4개가 화면 밖으로 나감 | grid의 자동 최소 폭을 풀고 한 열로 재배치, link input 한 행, 명단/응답 버튼 다음 줄. 두 번째 전체 캡처와 실제 좌표 outside0; 허용 |
| UX·학생/보호자 흐름 | 조건부: 응답 복원은 개선. 저장 성공 응답 유실과 이전 서명 유지가 실제 경로로 확인돼야 함 | 실제 Chrome 입력/선택/서명, 커밋 이후 ACK 유실→재시도1건/서명1, 이전 서명 수정 없이 재제출/모바일 닫기·Esc 값 보존; 허용 |
| UX·교실 전자칠판 흐름 | 조건부: 최신과 미제출을 쉽게 구분해야 하고 큰 명단에서 전부 스크롤하기 전 조회 범위가 보여야 함 | 1366 전체 화면의 제출/미제출 문구, 전체 제출 수와60/120/2000 범위, 검색·미제출 재배부 확인; 허용. 실제 전자칠판 관찰은 미실행 |
| UI·접근성 | 조건부: 링크 label·대비를 고치고 실제 Tab과 자동 검사를 확인할 것 | 링크 focus→Tab 버튼, 공개 입력/서명 Esc는 실제 Chrome;7상태 axe0. 관리 버튼 최소44px 및 비활성 시각 표시; 허용 |
| UI·반응형/상태 | 수정 필요: 확대 버튼 잘림, 첫 최종 검토에서 요약 대상 수량 ‘명단2…’ 축약 | 버튼/행 줄바꿈, 요약 수량 wrap, 오류 후 입력 유지·준비/종료/파기/완료 상태 실제 확인, 최종7상태 모든 버튼 폭 안; 허용 |

전체 페이지 증거: [0명](evidence/manage-empty.png), [24명](evidence/manage-24-final.png), [60명](evidence/manage-60.png), [2000명/초기60개](evidence/manage-max-initial.png), [전체 검색](evidence/manage-max-search.png), [모바일](evidence/manage-mobile.png), [확대1차](evidence/manage-mobile-200-pass1.png), [확대최종](evidence/manage-mobile-final.png), [보호자확대](evidence/public-mobile-200.png), [최신/이력](evidence/manage-history.png), [생성실패](evidence/creation-error-kept.png), [파기실패](evidence/purge-failure-retained.png).

출력: [응답](evidence/response.pdf), [긴 응답/서명/별지](evidence/long-response-with-signature.pdf), [QR 브라우저 인쇄](evidence/qr-browser-print.pdf), [QR PNG](evidence/personal-qr.png), [최신 응답 표](evidence/results.xlsx), [2000명 표](evidence/max-results.xlsx). PDF 페이지 PNG와 검사 JSON도 같은 evidence 폴더에 보존했다.

## 적용 상태·한계

DB 변경: 신규 마이그레이션을 **격리 로컬 DB에 적용 확인**, 원격 DB는 미적용. Edge Functions: 실제 로컬 Deno 실행 확인, 원격 함수는 미적용. 프런트엔드: 로컬 Vite/Chrome 및 build 확인, 운영 배포는 미적용. 검증 완료 당시 GitHub push·PR·main 병합·새 커밋은 하지 않았다. 후속 로컬 커밋 인계 내용은 아래에 기록한다.

사용자가 격리 로컬 검증을 선택했으므로 원격 integration, 운영 로그인/배포 확인은 실행하지 않았다. Docker 기반 전체 Supabase 스택도 미실행이다. 실제 휴대폰·카메라 QR 스캔·프린터·브라우저 UI zoom200%·화면낭독기 전체 흐름은 미확인이다. 200% 검사는 Chrome의 root CSS font-size를200%로 설정한 것이다. 긴 QR 카드 이름은 기존처럼 줄임표로 표시될 수 있고 식별값을 함께 표시한다.

마이그레이션은 이전 직접 수정/삭제·비밀번호 RPC 권한을 회수한다. 운영 적용 시 구 클라이언트와 동시에 섞어 배포하면 구 관리 저장이 실패할 수 있다. 배포 요청이 있을 때 점검 시간 또는 호환 전환을 준비하고 secrets 확인(기존 암호화 키 유지)→linked 이력 비교→DB→두 대상 Edge Functions→프런트 순서로 적용한 뒤 실제 원격 가상 자료로 확인해야 한다.

외부 `../schooldoc-docs/development-history.md`와 `pro/ux-ui-expert.md`는 없었다. 기존 전용 [일지](../../../docs/feature-review-consent-2026-10-01.md)에 이번 완료 내용을 추가했다.

검증 후 이 작업의 전용 서버를 종료하고 산출물·시험 DB를 보존했다. 로컬 재현용 서버 재시작에서 명단2,000명/응답100건과 기존 암호화 키로 복호화되는 자료를 다시 확인했다([증거](evidence/local-restart.json)).

## 통합 세션 인계 준비 (codex)

2026-10-02. 승인된 F01~F13 수정과 DB I/O 최적화는 완료했다. 기능·관련 검사·이 보고서와 가상 증거를 로컬 기능 커밋으로 보존하고, 기능별 작업일지는 별도 문서 커밋으로 정리한다. 기존 리뷰 커밋은 재작성하지 않는다. GitHub push·PR·main 병합·운영 DB/함수/프런트 배포는 통합 세션에서 수행하며 이 세션에서는 실행하지 않는다.

### 앞서 알린 미완료 항목

| 항목 | 현재 상태와 남기는 이유 |
| --- | --- |
| QR 카드의 긴 이름 | 미개선. 기존 A4 카드 규격과 식별값 표시를 유지해 긴 이름은 줄임표가 될 수 있다. 이름 줄바꿈·카드 높이 변경은 다쪽 출력 설계와 재검증이 필요한 후속 UI 개선으로 남겼다. 빈 인쇄 결함 F10은 수정·실제 출력 확인 완료다. |
| 긴 응답·명단에서 공유/배부 접근 | 부분 개선. 초기60개와 추가 조회 범위·전체 카운터는 반영했다. 목록 접기와 공유 영역 우선 배치는 업무 화면 구조를 추가 변경하는 후속 UX 개선으로 남겼다. 좁은 화면의 버튼 잘림 F08은 수정 완료다. |
| hosted Supabase 연동 | 미검증. 사용자가 선택한 격리 로컬 검증을 완료했고, 통합 세션의 배포 이후 승인된 가상 자료로 Auth/Storage/Google OAuth·공개 제출·교사 소유자 권한을 확인해야 한다. |
| 실제 기기·접근성·운영 비용 | 실제 휴대폰/프린터/카메라, Chrome UI zoom200%, 화면낭독기 전체 흐름, 운영 IOPS/과금은 미확인. CSS 글자200%, 실제 Chrome 출력 PDF·전체 시각 확인, axe7상태 검사를 해당 확인의 대체 성공으로 보고하지 않는다. |
| 기존 lint·bundle 경고 | 관련 없는 lint8건과 기존 대형 chunk 경고 유지. 다른 기능이나 공통 구조의 무관한 정리를 이번 기능 커밋에 섞지 않았다. |

### 커밋 전 재확인

- `npm run typecheck`: 통과.
- `npm run lint`: 통과, 기존 경고8건.
- `npm test -- tests/unit/consentSubmissionIntegrity.test.ts tests/unit/consentResponseRender.test.ts`: 2파일13검사 통과.
- `git diff --check` 및 최종 staged diff 검사: 통과. 가상 원본 PDF가 텍스트로 판정돼 staged 검사에서 PDF xref 행 공백 경고가 발생한 것은 폴더 범위 `.gitattributes`의 PDF binary 지정으로 수정했다. PDF 바이트 보존을 확인했다. 검증 manifest에 기록된 마이그레이션·두 Edge 함수·공통 서버 유틸리티·관리 화면·CSS의 SHA-256은 현재 파일과 모두 일치했다.
- 기존 완료 증거(전체 단위473, 데모 E2E56/최종16, 실제 로컬 DB9, 실제 Chrome15, 접근성7상태 및 출력 전체)는 위 본문과 evidence에 보존했다. 이번 인계에서는 서버·브라우저를 다시 시작하거나 원격 integration을 실행하지 않았다.
- 추적 대상 텍스트에서 JWT/서버 API 키 형태가 발견되지 않았고, 시험 DB·키·토큰·의존성을 담은 `.runtime/`과 캐시는 Git 제외 상태다. 모든 내보내기와 캡처 자료는 가상이다.

공통 파일 변경은 `DEVELOPMENT.md`의 가정통신문 DB 저장·조회/배포 규칙, `src/index.css`의 가정통신문 인쇄·관리 화면에 한정한 규칙, `src/features/settings/privacyRetentionSettings.ts`의 가정통신문 파기 확인 수량 전달이다. 다른 기능의 로직은 변경하지 않았다.

통합 대상 DB 마이그레이션은 `supabase/migrations/202610011000_consent_integrity_io.sql` 하나다. 관련 Edge Functions는 `consent-forms-admin`, `consent-forms-public`이며 새 공통 구현 `supabase/functions/_shared/consentServer.ts`가 함께 필요하다. 원격 권한 회수와 구 클라이언트 호환 전환을 조정하고 secrets 확인→이력 비교→DB→두 함수→프런트→실제 원격 검증 순서를 따른다.
