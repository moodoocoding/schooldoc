# 가정통신문 수합 기능 리뷰

검토일: 2026-10-01 (한국 시간). 기준 제품 커밋: `c208afefca40bb4f15cab164fc292661e80fb9a0`.

## 결론과 적용 범위

원본 PDF 위 응답, 필수 선택 질문의 ‘아니오’, 모바일 확대 입력과 원본 전환, PDF 페이지 실패 시 제출 차단·값 보존·페이지별 재시도, 우리반 명단 재불러오기 중복 제외는 기존 Chrome E2E에서 정상 확인했다. 그러나 응답 저장의 부분 실패와 동시 제출, 원본 교체의 부분 저장, 명단 저장 실패의 무통보 진행, 진행 중 업무의 영구 파기, 재제출 결과의 중복·제출자 유실은 우선 수정이 필요하다.

총 13건: **P1 5건, P2 7건, P3 1건**. 제품 코드·기존 테스트·마이그레이션은 변경하지 않았다. 이 문서는 수정 담당자가 재현하고 완료 기준으로 재검증할 수 있게 만든 리뷰다. 관찰 도구의 실행 완료는 결함 수정 성공을 뜻하지 않는다.

- 브랜치: `codex/feature-review-consent-20261001`
- 전용 관리 워크트리: `C:/Users/panth/.codex/worktrees/review-consent-20261001/260812_schooldoc`
- 전용 서버: `http://127.0.0.1:4181`, `strictPort: true`. 다른 서버를 재사용하거나 종료하지 않았다.
- 실제 설치된 Google Chrome `154.0.8037.58`, Playwright `1.62.1`, PDF.js `6.2.108`, 설치된 Vite `8.1.5`.
- 모든 명단·PDF·응답·사용자는 가상 자료다. 원격 생성·제출·삭제·운영 로그인·키 교체·배포는 수행하지 않았다.
- 데모 데이터는 독립 Chrome context의 localStorage/IndexedDB에 저장한다. 실제 서버 경로의 브라우저 검토는 개발 모드 플래그를 context 안에서만 false로 바꾸고, Supabase Auth/REST/Storage/Functions를 로컬 가상 응답으로 대체했다. 제품 인증 우회나 운영 권한 검증으로 해석하면 안 된다.
- 관리 화면의 0/60명 밀도 fixture는 목록 데이터만 바꾸며 수합 요약의 설정 수량24·응답9는 고정했다. 이 가상 자료의 불일치를 제품 결함으로 보고하지 않는다. 실제 빈 생성 화면과 24명 혼합 상태는 별도 캡처했다.
- 서버 probe는 실제 TypeScript를 Node에서 변환하여 Deno.serve와 Supabase를 메모리 모형으로 대체했다. 실제 공통 AES-GCM 암호화 코드를 가상 키로 실행했으며 네트워크는 사용하지 않았다. SQL 트랜잭션·RLS·Storage 서비스의 원격 실행은 미검증이다.

## 사용한 자료와 검토 방식

[README](../../../README.md), [DEVELOPMENT](../../../DEVELOPMENT.md), [AGENTS](../../../AGENTS.md), [웹디자인 프로파일](../../../pro/web-designer.md), [UX 프로파일](../../../pro/ux-designer.md), [UI 프로파일](../../../pro/ui-designer.md)를 읽었다. 관련 `src/features/consentForms/` 구현, 공통 PDF 로더, 선택 질문·필드 좌표 규칙, 교사 인증·암호화·공개/관리 서버 함수, 개인정보 보관 마이그레이션, 단위/E2E/원격 검사 코드를 함께 확인했다. 하위 AGENTS.md는 발견되지 않았다.

기존 [checkout 개발일지](../../../docs/development-history.md)를 참고했다. 공유 외부 일지 `C:/Users/panth/Documents/vibecoding/schooldoc-docs/development-history.md`와 `pro/ux-ui-expert.md`는 존재하지 않았다. 새 기록은 [이 기능 전용 일지](../../../docs/feature-review-consent-2026-10-01.md)에만 남겼다. 다른 대화·하위 에이전트·실제 전문가나 교사의 검토를 사용하지 않았다.

검토 순서는 실제 과제 수행 → 휴리스틱/디자인 평가 → 기능·권한·상태·오류 복구였다. 아래 평가는 **한 AI가 각각의 기준을 독립적으로 적용한 모의 검토**다. 여섯 전문가 인터뷰나 실제 사용자 시험이 아니다.

## 단계별 워크플로우

| 단계 | 실제 사용자가 하는 일 | 확인한 동작과 근거 | 판정 |
| --- | --- | --- | --- |
| 교사 1 | 로그인 후 새 수합, 원본 PDF 업로드, 제목·안내 확인 | 실제 Chrome에서 2쪽 가상 PDF 업로드·분석. [원본 준비](evidence/author-document.png), 기존 형식/가로 PDF E2E | 정상. 운영 로그인 미검증 |
| 교사 2 | 원본 모든 쪽에 이름·날짜·선택 질문·서명 배치 | 직접 1쪽 텍스트, 2쪽 서명 배치. 기존 E2E로 다쪽 이동, 복사/붙여넣기, Ctrl+Z, 확대 위치, 작은 필드, 질문 묶기 확인. [2쪽 배치](evidence/author-field-page2.png), [질문 편집](evidence/e2e-consent-checkbox-editor.png) | 정상. 받은 응답 이후 원본 교체는 F02 |
| 교사 3 | 설정 명단/Excel/PDF 또는 직접 입력으로 대상 추가 | 빈 명단·24명 실제 클릭, 재불러오기 중복 24명 제외. 기존 E2E에 23/60명·동명이인·오류 재시도. [빈 명단](evidence/author-roster-empty.png), [24명](evidence/author-roster-24.png) | 가져오기 정상. 저장 실패 F03 |
| 교사 4 | 기한·비밀번호·수정 허용·보관 확인 후 생성 | 데모 생성·관리 이동. 로컬 모드는 개인 매칭 미지원임을 구분. 실제 API 경로는 가상 서버에서 생성/명단503 진행 관찰 | F03, F12 |
| 교사 5 | 공용 링크/개인 링크/QR 배부 | 공용·개인 QR PNG 1024×1024 내려받기. 개인 QR 24명 3쪽 PDF. 재발급 확인창 Esc·포커스 복귀, 기존 E2E에서 예전 링크 무효화 | PNG·PDF 정상. 브라우저 인쇄 F10 |
| 보호자 1 | 개인/공용 링크·비밀번호로 원본 열기 | 기존 E2E에 준비 중 425/지연 원본 자동 복구·개인 대상 표시. 새 API 모의에 이미 제출한 대상 조회 | 원본 정상. F06, F11 |
| 보호자 2 | 모든 원본을 읽고 원본 위치 응답 | 두 쪽 실제 worker 표시 후만 입력. 늦은/실패한 2쪽·새 File 교체는 기존 E2E에서 차단·값 유지·재시도 확인 | 정상 |
| 보호자 3 | 단일/복수/독립 체크, 이름·날짜·서명 작성 | 필수 ‘아니오’ 정상 선택, 필수 누락 안내, 서명 그리기·적용. 모바일 창 닫기·Esc·원본 전환 후 값 유지 | 정상 |
| 보호자 4 | 전체 확인, 수정, 최종 제출/재제출 | 실제 데모 비동의 응답 제출. 기존 E2E 수정·서명 취소·포커스. 실제 서버 코드를 메모리 DB에서 연속·동시 제출 | 최초 정상 경로 정상. F01, F05, F06 |
| 교사 6 | 응답·미제출 현황 조회/검색/재배부 | API 모의 0/24/60명, 제출 8·미제출16, 검색 빈 상태와 필터 16명 확인. [24명 혼합](evidence/manage-24-mixed.png), [60명](evidence/manage-60.png) | 다음 처리 대상이 응답 목록 아래에 있음. F05, F08 |
| 교사 7 | Excel/개별·전체 응답 PDF 내려받기 | Excel을 재열어 아니오 ‘선택’, 서명함, 미제출 행 확인. 2쪽 응답 PDF 전체 렌더 확인 | 대표 정상 출력 정상. F05, F09 |
| 교사 8 | 종료·재개·보관 후 파기 | 보관 단위 검사 및 closed_at DB trigger 정적 확인. 가상 서버에서 저장/종료500, 진행 중 파기 관찰 | F04, F07. 원격 파기 미실행 |

## 10개 휴리스틱

| 기준 | 판단·근거 | 수정 요구와 남은 위험 |
| --- | --- | --- |
| 1. 시스템 상태 가시성 | 수정 필요. 필수 질문 진행도와 제출/미제출 문구는 좋다. 이미 제출한 개인 링크는 0/3 빈 양식(F06), 설정 오류는 무알림(F07) | 제출·저장·실패 상태를 현재 서버 상태와 일치시킨다 |
| 2. 현실과 시스템의 일치 | 수정 필요. ‘필수 질문’은 아니오도 허용한다. ‘제출 후 수정’은 새 응답을 누적하고 옛 이름이 사라짐(F05) | 최신 유효 응답과 이력·건수를 구분한다 |
| 3. 사용자 통제와 자유 | 수정 필요. 원본/확대창 전환·서명 취소·재발급 Esc 정상. 명단503 뒤 선택 방식 전환 없이 진행(F03) | 입력과 명단을 유지한 재시도·명시적 방식 선택 제공 |
| 4. 일관성과 표준 | 수정 필요. 공유 검증/좌표 일관성은 확보. 실제 API 모드에도 ‘현재 로컬’ 안내(F12), PDF와 인쇄 불일치(F10) | 모드·출력 경로에 맞는 안내/같은 출력 구조 |
| 5. 오류 예방 | 수정 필요. 필드 겹침·경계·선택 질문 규칙은 검사. 동시 제출(F01), 원본 부분 교체(F02), 진행 중 파기(F04)는 방어 없음 | 서버의 원자적 확정과 상태 검사 |
| 6. 기억보다 인지 | 수정 필요. 제출 전 전체 요약 정상. 재제출 시 이전 값·제출 시각·수정 안내 없음(F06) | 신원 검증 범위 안에서 기존 응답 확인/수정 흐름 |
| 7. 유연성과 효율 | 부분 통과. 쪽 번호·필드 단축키·명단 재불러오기·미제출 필터 정상. 60명 단일 긴 목록에서 공유·재배부 접근이 길다 | F08 수정 후 교사 주요 작업 위치 재평가. 실제 교사 시험 미실행 |
| 8. 간결하고 필요한 정보 | 수정 필요. 기본 화면은 단일 문서 스크롤·영역 구분. 받음 목록이 명단 현황보다 먼저 있고, 무관한 로컬 안내가 뒤섞임(F12) | 핵심 현황/공유 우선순위와 장문 목록 접기 검토 |
| 9. 오류 인지·진단·복구 | 수정 필요. PDF 페이지 오류의 안전 문구·재시도·응답 보존 정상. 저장 실패 무알림(F07), 부분 제출 후 재시도409(F01) | 실패 위치별 사용자 문구, 보존된 값과 재시도 제공 |
| 10. 도움말과 안내 | 부분 통과. 원본 작성 안내·선택 의무 설명·공개 수합 안내 명확. 이미 제출/재제출 및 브라우저 인쇄 안내와 실제 동작 어긋남 | F06/F10/F12 해결. 실제 학부모 이해도 미검증 |

## 세 프로파일의 판단

| 관점 | 판단 | 근거 | 남은 위험 |
| --- | --- | --- | --- |
| 웹디자인 | 수정 필요 | 데스크톱 24명 전체 화면에서 수합 요약·응답·명단·공유가 단일 열로 읽힌다. 하단 링크/QR 두 열의 높이 차이는 QR 크기에 따른 제한된 공백이며 주 작업에 빈 열을 강제하지 않는다. 그러나 60명에서 끝까지 늘어지고 200% 버튼 잘림(F08) | 최적 현황 위치/목록 접기 정도는 실제 교사 과제 시험 필요 |
| UX | 수정 필요 | 명단 중복 제외·질문 전환·원본 값 보존·전체 확인 정상. 재제출, 명단 실패, 저장 실패에서 다음 행동이 부정확(F03/F05/F06/F07) | 실제 학부모의 재제출 기대와 학교 배부 방법 미검증 |
| UI | 수정 필요 | 390px 보호자 axe 위반0, 문구로 상태 구분, 서명/재발급 Esc 정상. 교사 이름 없는 링크 입력·파일명 대비(F13), 200% 잘림(F08), PDF/인쇄 문제(F09/F10) | CSS 200%는 브라우저 확대·실제 iOS/Android/전자칠판 시험의 대체가 아님 |

## 여섯 독립 AI 모의 관점

| 모의 관점 | 판정 | 전체 화면·대표 데이터 근거 | 수정 요구 |
| --- | --- | --- | --- |
| 웹: 정보 위계 | 수정 필요 | [24명](evidence/manage-24-mixed.png)에서 제출 현황/공유가 긴 응답 목록 아래. 기본 요약의 응답9건과 명단8/24가 서로 다른 수량이며 재제출 구분 없음 | F05의 건수 의미 표시, 미제출 현황·배부 작업 우선순위 조정 |
| 웹: 화면 밀도 | 부분 통과 | [60명](evidence/manage-60.png)에서 무기능 좌우 빈 열은 없으나 전체 높이가 크다. [모바일200% 전체](evidence/manage-60-mobile-200.png)에서 이름/시간 열이 극단적으로 좁음 | F08, 대표 24/60명에 전체 목록 접기·필터/응답 구역 높이 설계 |
| UX: 참여자·보호자 흐름 | 수정 필요 | [모바일 입력](evidence/guardian-mobile-input.png)과 [전체 확인](evidence/guardian-mobile-review.png)은 정상. [이미 제출](evidence/already-submitted-blank.png)은 빈 양식으로 안내 | F06, 이미 완료한 보호자에게 쓰기 허용 여부를 먼저 전달 |
| UX: 교사·교실/배부 흐름 | 수정 필요 | 개인 QR PNG·A4 3쪽 내려받기 정상. 브라우저 인쇄4쪽 빈 출력, 진행 중 파기 허용, 실패한 설정 무알림 | F04/F07/F10. 실제 전자칠판·프린터·교사 배부 시험은 미실행 |
| UI: 접근성 | 수정 필요 | [교사 axe](evidence/manage-24-axe.json): 링크 input label1·대비1. 보호자 axe0. 재발급 Esc 후 동일 버튼 포커스 정상 | F13 및 F08. 자동 검사만으로 보조기술 사용자 과제 완료를 보장하지 않음 |
| UI: 반응형·상태 표현 | 수정 필요 | [390px](evidence/manage-mobile.png), [200% 뷰포트](evidence/manage-mobile-200-viewport.png): 큰 글자에서 PDF/재배부 버튼 잘림. 제출/미제출은 문구와 색으로 구분 | F08. 진행/이미 제출/실패는 데이터·화면 모두 일치시킬 것(F01/F06/F07) |

## 문제별 수정 요청

P1은 데이터·보관·수합 계약을 깨는 우선 수정, P2는 주요 과제·출력·복구를 막는 수정, P3는 접근성/품질 개선이다. 코드 위치는 기준 커밋의 1-based 행이며 제품 파일은 변경되지 않았다. 각 재현 도구는 결함을 관찰하는 도구다.

### F01 · P1 · 제출의 부분 실패와 동시 요청에서 응답 상태가 일치하지 않음

- 위치: `supabase/functions/consent-forms-public/index.ts:161–194`; `supabase/migrations/202608160003_consent_recipients.sql:10,20`.
- 재현: [server-probe.mjs](server-probe.mjs)의 `failed increment`에서 수정 불허 개인 링크로 정상 응답을 제출하되 `increment_consent_response_count`만 실패시킨다. 이어 같은 응답을 재시도한다. 별도 `concurrent submits`는 같은 개인 링크에 두 요청을 동시에 보낸다.
- 실제/모의: **실제 서버 TypeScript + 메모리 Supabase 모의**. [서버 관찰](evidence/server-probes.json): 첫 제출500 → 응답행0·건수0, 수신자 `submitted_at`만 남음 → 재시도409. 동시 요청 두 개는 모두200, 응답행2·건수2. FK `ON DELETE SET NULL`의 결과를 메모리 모형으로 반영했다.
- 영향: 제출자는 실패를 봤는데 교사는 제출로 보거나, 제출 후 수정 불허인데 중복 응답이 생긴다. 이 불일치가 재제출을 막는다.
- 수정 요구: 개인 응답 확정·수신자 연결·건수 갱신을 잠금/원자적 DB 연산으로 묶고 idempotency를 도입한다. Storage 실패/후속 DB 실패 시 수신자 상태까지 복구한다. 개인정보 없는 실패 재시도 기록을 남긴다.
- 완료 기준: 수정 불허 동시 제출은 한 건만 확정. 서명·연결·건수 실패를 각 지점에 주입해 응답/명단/건수가 모두 이전 상태를 유지하며 같은 값으로 재시도 가능. 원격 SQL/FK/Storage는 승인된 시험 환경에서 별도 검증해야 한다.

### F02 · P1 · 원본 PDF 교체 실패가 새 질문과 이전 PDF를 혼합하고 기존 응답 의미를 바꿈

- 위치: `src/features/consentForms/consentFormsRepository.ts:160–194`; `ConsentFormsCreatePage.tsx:190`; `ConsentFormsManagePage.tsx:291`; `consentResponseRender.ts:150–164`.
- 재현: 2쪽 원본·24개 응답이 있는 수합에 1쪽 새 PDF/새 필드로 수정하고 Storage update를 실패시킨다. [source-replacement-probe.mjs](source-replacement-probe.mjs) 실행.
- 실제/모의: **실제 저장 함수 + Supabase 모의**. [관찰](evidence/source-replacement-probe.json): DB의 `page_count=1`, 새 필드/새 파일명은 남지만 Storage에는 이전 2쪽 PDF가 남는다. probe의 layout 유틸리티만 유효한 필드에 대해 통과하도록 대체했다.
- 영향: 보호자 화면은 2번째 원본을 표시하지 않을 수 있고, 응답 PDF는 기존 원본에 새 좌표/새 필드 ID를 적용한다. 성공한 교체도 모든 과거 응답을 현재 PDF·현재 필드로 내보내므로 과거 문서/응답 의미가 바뀐다.
- 수정 요구: 새 Storage 경로에 업로드 완료 후 검증된 문서/필드 버전을 원자적으로 전환한다. 응답이 있는 버전은 고정하고, 변경은 새 수합 복제 또는 명시적인 새 버전으로 처리한다. 실패한 임시 파일 정리도 확인한다.
- 완료 기준: 모든 실패 지점에서 기존 문서·필드·쪽수 유지. 새 버전 성공 후에도 과거 비동의/서명 PDF가 제출 당시 원본·위치·질문 의미를 보존. 변경 도중 열린 보호자 화면은 버전 불일치를 명확히 안내.

### F03 · P1 · 명단 저장 실패를 무시하고 명단 수합 생성이 완료됨

- 위치: `ConsentFormsCreatePage.tsx:194–205`; `consentAdminApi.ts:29–34`; `consentFormsRepository.ts:111–128`.
- 재현: 실제 API 경로를 쓰는 가상 교사로 새 수합을 만들고 수신자1명을 추가한다. 생성 REST/원본 upload는 성공, 관리 `replace`만503을 반환한다. [browser-review.mjs](browser-review.mjs) `named create despite roster save failure`.
- 실제/모의: **실제 Chrome·제품 생성 화면 + Auth/REST/Storage/Function 모의**. [브라우저 관찰](evidence/browser-observations.json)의 명단 저장 실패 시나리오에서 replace503 뒤 관리 주소로 이동하고 alert는0. [완료처럼 보이는 화면](evidence/named-create-roster-save-failure.png). 생성 REST 요청은 `recipient_mode=named`, `recipient_count=1`; 관리 fixture의 반환 수량24는 가상 자료이며 실제 저장된 명단 검증이 아니다.
- 영향: 교사가 선택한 개인 현황·개인 링크가 준비되지 않았는데 원본/폼 행만 남고 임시 작업은 삭제된다. 그 외 명단 오류는 생성된 폼을 남긴 채 실패하므로 새로 ‘수합 만들기’를 누르면 다른 폼이 더 생길 위험도 있다.
- 수정 요구: 명단 수합은 명단 저장 완료까지 비공개 초안으로 유지. 실패를 안내하고 같은 formId의 명단 저장을 재시도한다. 명단 없는 방식으로 전환하려면 교사가 그 결과를 확인하고 선택하게 한다.
- 완료 기준: 404/503/500/권한 오류/네트워크 실패마다 입력·명단 보존, 새 폼 중복 생성 없음, 개인 배부 버튼 비활성 또는 정확한 복구 안내. 성공한 저장 수량과 개인 링크 조회를 확인한 뒤 완료 표시.

### F04 · P1 · 진행 중 업무를 서버가 영구 파기함

- 위치: `supabase/functions/consent-forms-admin/index.ts:52–57,99–146,157–177`; `ConsentFormsManagePage.tsx:295`; `ConsentFormsListPage.tsx:36–76`.
- 재현: 소유자가 `status=open`인 가상 폼에 `{action:'purge',formIds:[id]}` 호출. [server-probe.mjs](server-probe.mjs) `admin purge accepts ongoing form`.
- 실제/모의: **실제 서버 코드 + 메모리 모형**에서200·폼행0. 교사 UI도 수합 중에 삭제를 제공하고 기존 E2E는 이 삭제를 성공으로 기대한다. 원격 파기는 수행하지 않았다.
- 영향: AGENTS의 ‘진행 중인 업무는 파기하지 않는다’ 조건이 서버에 없다. 처리 중 제출·보호자 열람과 영구 파기가 겹칠 수 있다.
- 수정 요구: 서버에서 status·closed_at·진행 요청을 검증하고 진행 중 파기는 거부한다. 화면에서도 종료 후 대상/수량/동의를 확인하는 흐름을 제공한다. 의도적인 빈 초안 삭제와 업무 자료 파기를 구분해야 한다면 서버 계약을 따로 만든다.
- 완료 기준: 진행 중 업무 purge 거부, 제출과 파기 동시 요청에서도 자료가 중간 유실되지 않음. 종료 자료만 대상·수량 확인과 동의 후 처리하며 Storage 잔존 확인 실패 시 DB 유지·재시도 기록. 보관 만료 자동 삭제는 도입하지 않는다.

### F05 · P1 · 재제출을 수정으로 표시하지만 옛 응답도 합계·출력에 남고 이름이 사라짐

- 위치: `consent-forms-public/index.ts:163–189`; `consent-forms-admin/index.ts:267–276`; `ConsentFormsManagePage.tsx:252,308–318`; `consentResponsesExcel.ts:25`.
- 재현: 수정 허용 개인 링크로 ‘아니오’ 제출 후 ‘예’로 다시 제출. [server-probe.mjs](server-probe.mjs) 첫 시나리오 및 Chrome 24명 fixture의 첫/두 번째 응답 확인.
- 실제/모의: **실제 서버 코드 모의 + 실제 Chrome/Excel 내려받기**. [서버 결과](evidence/server-probes.json)는 동일 recipientId 응답2·count2. [Excel 재열기](evidence/excel-inspection.json)에서 이전 응답의 제출자/식별값은 비고 새 응답만 이름을 갖는다. [관리 화면](evidence/manage-24-mixed.png)에도 첫 행 이름이 없다.
- 영향: 같은 학생의 상충하는 동의와 비동의가 모두 현재 결과처럼 나온다. 합계는 사람 수보다 커지고 이전 PDF 파일명도 수신자 이름이 사라진다. 비동의를 동의로 뒤집는 표시는 아니지만 유효한 최종 답변을 구분할 수 없다.
- 수정 요구: 최신 유효 응답과 버전 이력의 의미를 정하고 화면/Excel/PDF에 일관되게 반영한다. 이력을 남겨도 recipientId로 신원을 연결하고 ‘이전 응답’으로 표시한다. 명단 제출 수·유효 응답 수·이력 수를 구분한다.
- 완료 기준: 같은 학생 아니오→예/예→아니오/연속 재제출 모두 최종 유효 결과가 명확. 모든 이력에 올바른 제출자·식별값·제출시각, 미제출자 수 불변, 출력에서도 동일 기준 적용.

### F06 · P2 · 이미 제출한 개인 링크가 새 빈 양식을 열고 마지막에 재제출 거부

- 위치: `PublicConsentResponsePage.tsx:34–42,114–115,128,136`; `consent-forms-public/index.ts:127,138,161`.
- 재현: metadata/document에 `recipientSubmitted=true`, `allowResubmission=false`를 반환한 개인 링크에 재접속한다. [browser-review.mjs](browser-review.mjs) `already submitted personal link`.
- 실제/모의: **실제 Chrome + 공개 API 모의**. [전체 캡처](evidence/already-submitted-blank.png), [관찰](evidence/browser-observations.json): 필수0/3, 이름 빈 값, ‘입력 시작’ 활성. 실제 서버는 뒤늦게 submit409을 반환한다.
- 영향: 보호자가 같은 응답을 다시 작성하고 서명해도 마지막에 실패한다. 수정 허용일 때도 기존 값/서명을 불러오는 계약이 없어 전체를 다시 작성해야 하며 완료 화면에는 수정 경로가 없다.
- 수정 요구: 이미 제출/수정 불허를 문서 열기 시점에 안내. 수정 허용이면 신원 검증 범위 안에서 이전 응답/서명을 안전하게 조회하고 수정 의도를 먼저 확인한다. 개인정보를 공용 링크에 노출하지 않는다.
- 완료 기준: 수정 불허는 빈 쓰기 양식 대신 제출 완료 상태. 수정 허용은 이전 값 확인/변경/취소/재제출을 정확히 제공하고 서명도 유지. 공용·개인 링크 및 새로고침에서 같은 규칙.

### F07 · P2 · 설정 저장·수합 종료/재개 실패를 사용자에게 알리지 않음

- 위치: `ConsentFormsManagePage.tsx:120–150,294,298`.
- 재현: 설정 PATCH500을 주입, 제목을 바꾸고 ‘설정 저장’. 이어 ‘수합 종료’를 클릭. [browser-review.mjs](browser-review.mjs) `settings and close errors`.
- 실제/모의: **실제 Chrome + REST 모의**. [캡처](evidence/settings-save-failure.png), [관찰](evidence/browser-observations.json): pageerror2, alert0. 저장 입력은 남지만 실패/재시도 안내가 없다. 종료 버튼에 진행 중 상태나 중복 클릭 차단도 없다.
- 영향: 저장 여부를 판단하지 못하고 종료했다고 오해할 수 있다. 종료/재개 중 연속 클릭도 같은 요청을 여러 번 만든다.
- 수정 요구: 저장/상태 변경별 오류 상태와 role=alert, 입력 보존 및 재시도, 작업 중 버튼 비활성/중복 요청 방지. 제목·비밀번호 부분 성공은 최신 상태를 다시 확인해 안내한다.
- 완료 기준: 401/403/409/500/오프라인 각각 안전 문구와 재시도 가능. 입력 유실·unhandled rejection 없음. 종료/재개 한 번에 요청1개, 실패 시 이전 상태 표시 유지.

### F08 · P2 · CSS 200%에서 주요 버튼이 화면 밖으로 잘림

- 위치: `ConsentFormsManagePage.tsx:308,322–328,331–343`; 앱 공통 가로 clip은 잘림을 숨기지만 배치 오류를 해결하지 못한다.
- 재현: 24명·9응답 관리 화면, viewport390×844, `document.documentElement.style.fontSize='200%'`.
- 실제/모의: **실제 Chrome + 가상 데이터**. [전체 캡처](evidence/manage-mobile-200.png), [대표 viewport](evidence/manage-mobile-200-viewport.png), [측정](evidence/browser-observations.json): 전체 PDF 버튼 right602.8px, 미제출자 재배부 right654.0px. 문서 scrollWidth는390이어서 기존 ‘넘침 없음’ 검사만으로 놓친다.
- 영향: PDF/재배부 작업명·터치 영역이 화면 밖이며 명단 이름·제출시각 열도 심하게 좁아진다.
- 수정 요구: 버튼 묶음에 min-w-0/max-w-full 및 작은 폭의 세로 배치/줄바꿈을 적용하고 상태/시간/이름 열을 재배치. 가로 clip로 검사를 통과시키지 않는다.
- 완료 기준:390px 기본/200%, 데스크톱200%, 긴 이름·0/24/60명에서 필수 버튼 전체 bounding box가 viewport 안에 있고 키보드로 접근 시 보임. 전체 화면과 대표 viewport 재캡처.

### F09 · P2 · 긴 응답 PDF가 원본 입력칸 밖의 본문을 덮음

- 위치: `consentResponseRender.ts:24–49,54–74`; `ConsentResponseField.tsx:26`의 `maxLength=5000` 및 서버 `consent-forms-public/index.ts:157`.
- 재현: 유효 최소 텍스트칸 너비3%·높이1%에 560자 가상 의견을 넣어 `renderConsentResponsePdf` 실행. [long-text-probe.mjs](long-text-probe.mjs).
- 실제/모의: **실제 Chrome·제품 PDF 렌더 함수/worker**. [PDF](evidence/long-text-overflow.pdf), [전체 렌더](evidence/long-text-overflow-1.png), [계산](evidence/long-text-overflow.json): fit 실패 시 한 줄 전체를 반환, 측정폭2119px(제한32px); 실제 결과가 본문을 가로질러 덮는다.
- 영향: 합성 문서의 안내 본문이 읽히지 않고 응답도 페이지 끝에서 잘린다. 검토 화면과 출력 정보 구조가 불일치한다.
- 수정 요구: 합성이 칸을 벗어나지 않도록 제한하고, 정보 유실 없이 긴 응답 별첨 또는 적절한 입력길이·교사 칸크기 안내를 제공한다. 조용한 truncation이나 극단적으로 작은 글씨만으로 해결하지 않는다.
- 완료 기준: 최대 허용 길이·한글/숫자/개행/혼합·가장 작은 유효칸에서 본문/다른 필드와 겹치지 않고 전체 값 확인 가능. 원본·확인 요약·PDF가 같은 응답을 보존.

### F10 · P2 · 개인 QR 브라우저 인쇄가 모두 빈 페이지

- 위치: `src/index.css:525–542`; `ConsentQrPrintPage.tsx:127–160`.
- 재현: 24명 개인 QR 배부 화면에서 print media로 전환하고 Chrome `page.pdf({format:'A4'})` 실행. 앱의 ‘PDF 다운로드’도 별도로 실행.
- 실제/모의: **실제 Chrome·가상 명단·PDF 생성/Poppler 전체 페이지 렌더**. [PDF 내려받기](evidence/personal-qr-sheet.pdf)는3쪽 정상; [브라우저 인쇄](evidence/personal-qr-browser-print.pdf)는4쪽, [분석](evidence/pdf-inspection.json)에서 모든 page nonWhiteBounds=null. [빈 첫 쪽](evidence/personal-qr-browser-print-1.png).
- 영향: 교사가 Ctrl+P로 배부자료를 출력하면 빈 종이를 받는다. 원인은 print에서 body 하위 전체를 숨긴 뒤 가정통신문 QR root를 다시 보이게 하지 않는 CSS다.
- 수정 요구: QR 인쇄 root·페이지를 명시하고 A4 페이지 분리/마지막 페이지 예외를 적용. 화면 전용 버튼/사이드바를 출력에서 제외한다.
- 완료 기준:24명3쪽·빈 명단0쪽·미제출 필터·긴 제목/이름 모두 브라우저 인쇄와 내려받기 정보 동일, 잘림/겹침/빈 마지막 쪽 없음. 실제 프린터는 별도 시험.

### F11 · P2 · 잘못된 개인 토큰이 익명 응답으로 처리됨

- 위치: `consent-forms-public/index.ts:68–69,125,171`.
- 재현: 유효한 수합 토큰에 `recipientToken='mistyped-recipient'`를 넣어 submit. [server-probe.mjs](server-probe.mjs) `malformed personal token`.
- 실제/모의: **실제 서버 코드 + 메모리 모형**. [관찰](evidence/server-probes.json):200, `recipient_id=null`.
- 영향: 망가진 개인 링크로 제출해도 성공을 보지만 명단에는 미제출로 남는다. 이 관찰은 새 접근권한 유출의 증거가 아니라 개인 응답 매칭 계약의 오류다.
- 수정 요구: 개인 토큰 생략은 기존 공용 흐름으로 처리하되, 값이 주어진 경우 형식/존재/폼 일치를 모두 검사하고 잘못된 값은 거부한다. 클라이언트에도 담당자에게 개인 링크 재요청 안내.
- 완료 기준: 공용 token-only 정상, malformed/wrong-form/deleted personal token은 쓰기 없이 안전한 오류, 올바른 개인 token만 해당 대상에 매칭.

### F12 · P2 · 실제 API 모드에서도 ‘현재 로컬 모드’와 개인 매칭 불가 안내

- 위치: `ConsentFormsManagePage.tsx:347`.
- 재현: 데모 플래그false·명단/응답 API 성공인 24명 관리 화면에서 응답 링크 아래 확인.
- 실제/모의: **실제 Chrome·제품 조건문 + API 모의**. [전체 관리](evidence/manage-24-mixed.png)에는 위쪽 개인 매칭·개인 QR과 아래쪽 로컬/매칭불가 안내가 동시에 표시된다. 조건은 `recipientMode==='named'`이며 demo 여부가 없다.
- 영향: 교사가 서버 연결이 실패했다고 오해하고 개인 링크 대신 공용 링크를 배부할 수 있다.
- 수정 요구: 안내를 실제 demo mode/명단 기능 가용성에 한정하고 명단 수합에서는 개인 링크 배부를 주 경로로 설명한다. F03의 실패 상태와도 구분한다.
- 완료 기준: 로컬/정상 API/명단 API 미준비 각각 정확한 안내. 개인 매칭이 실제 가능한 화면에는 불가 안내 없음.

### F13 · P3 · 교사 링크 입력 이름 누락·파일명 대비 부족

- 위치: `ConsentFormsManagePage.tsx:286,347`.
- 재현:24명 관리 화면에서 Axe WCAG2A/AA 및 링크 input의 접근 가능한 이름 확인.
- 실제/모의: **실제 Chrome + 가상 데이터·Axe 자동 검사**. [axe](evidence/manage-24-axe.json): 읽기전용 응답 링크 input의 label 위반1, 파일명 `#64748B/#F6F8FB` 대비4.47(요구4.5) 위반1. [보호자 axe](evidence/guardian-mobile-axe.json)는0.
- 영향: 보조기술에서 링크 input 목적을 알기 어렵고 작은 파일명 가독성이 낮다.
- 수정 요구: input에 명시적 label/aria-labelledby, 파일명 대비 조정. 40/36px 보조 버튼도44px 목표로 검토하되 원본 위의 작은 좌표 필드는 확대 입력과 함께 판단한다.
- 완료 기준: 해당 axe 위반0, Tab 순서·포커스·읽기전용 링크 목적 확인. 실제 스크린리더 과제 시험은 별도.

## 정상 확인된 흐름과 남은 판단

- 필수 단일 질문에서 ‘아니오’가 정상 답변이며 예/아니오 동시 선택은 공유 검증에서 거부된다. 복수 선택 최소 수·선택 질문 건너뛰기·기존 독립 필수 체크 의미도 유지된다.
- PDF 표시/분석/합성은 공통 [legacy 로더](../../../src/utils/pdfjs.ts)를 쓰고 본체/worker 모두 설치된 `6.2.108`이다. 실제 main/Worker에서 Map API가 없는 환경 모의도 Chrome E2E 통과했다. 이는 모든 구형 브라우저 호환성의 보장이 아니다.
- 모든 원본 페이지 준비 전 응답 비활성, 2쪽 지연·렌더 실패·새 File 원본 교체 시 제출 차단, 내부 에러 비노출, 기존 값 유지, 해당 페이지 재시도 성공을 E2E로 확인했다.
- 모바일 확대/원본 전환·Esc·다른 칸·화면 크기 전환 후 값 보존; 자유 입력/전체 확인/수정/서명 적용·취소·포커스 정상.
- 우리반 명단 두 번 불러오기 중복 제외, 동명이인의 다른 번호 보존, 삭제 후 다시 불러오기, 빈 명단/깨진 localStorage 오류 후 입력 유지·재시도 정상.
- 대표 응답 Excel의 아니오 열만 ‘선택’, 서명은 ‘서명함’, 미제출16행. 대표 2쪽 응답 PDF에 아니오 원본 위치·성명·2쪽 서명 합성 정상. 긴 값은 F09 예외.
- 공용/개인 QR PNG1024×1024 내려받기를 실제 클릭했으며 개인 QR24명3쪽 PDF 전체를 렌더·시각 확인했다. 가상 긴 이름은 truncate되므로 배부 식별 개선 여지가 있다. 실제 카메라 스캔/프린터 시험은 미실행.
- 서버 소유자 검사에서 다른 가상 교사의 responses 요청403. 정적 RLS/비공개 Storage/공개 토큰·비밀번호·암호화 키 실패 차단을 확인했으나 원격 정책이 이 checkout과 동일한지는 확인하지 않았다.
- 보관 단위 검사에서 진행 업무는 만료 목록에 포함되지 않고 종료시점 기준으로 기간 계산. 실제 DB의 `track_closed_at` trigger 소스도 확인했다. F04 때문에 만료 목록 제외가 직접 purge 방어를 뜻하지 않는다.
- 공유 IP는 token/action별60초 submit8회 제한이며 메모리 probe9번째429. 부모 설명회 등 같은 IP에서 여럿 응답할 실제 부하 수용 여부는 판단 보류. 정상 참여와 추측 제한을 구분하는 정책/학교 네트워크 자료가 필요하다.
- PDF 원본 표 위 작은 입력 좌표는 본문을 가리지 않는 가상 문서로 확인했다. 실제 학교 서식·중복된 표·회전/스캔/100쪽 최대 문서·저사양 기기·실제 휴대폰·브라우저 UI 확대200%는 미검증이다.

## 검증 결과와 재현 도구

| 검사 | 명령/대상 | 결과·한계 |
| --- | --- | --- |
| 전용 서버 | `node node_modules/vite/bin/vite.js --config design/feature-reviews/2026-10-01-consent/vite.review.config.ts` | 4181 strictPort. 데모 env/가상 Supabase 연결값 사용 |
| Chrome 첫 화면 | `node design/feature-reviews/2026-10-01-consent/server-check.mjs` | 본문/핵심버튼 표시, overlay0·pageerror0. [결과](evidence/server-check.json) |
| 관련 단위 | `node node_modules/vitest/vitest.mjs run tests/unit/consentDocumentReady.test.ts tests/unit/consentDuplicate.test.ts tests/unit/consentFieldLayout.test.ts tests/unit/consentRecipientImport.test.ts tests/unit/consentQuestions.test.ts tests/unit/consentPurgeSelection.test.ts tests/unit/consentResponseRender.test.ts tests/unit/consentFormsConfig.test.ts tests/unit/consentRecipientSheet.test.ts tests/unit/consentResponsesExcel.test.ts` | **10파일86검사 통과**. `npm test -- ...`와 같은 Vitest 실행 파일을 직접 호출(이 호스트의 PowerShell npm 인자 전달 문제) |
| 기존 E2E | `$env:PLAYWRIGHT_TEST_PORT='4181'; node node_modules/@playwright/test/cli.js test tests/e2e/consent-forms.spec.ts tests/e2e/consent-questions.spec.ts tests/e2e/consent-pdf-recovery.spec.ts tests/e2e/consent-pdf-compatibility.spec.ts tests/e2e/consent-small-fields.spec.ts tests/e2e/consent-class-roster.spec.ts --reporter=list` | **38검사 통과, 약1.8분**. 단일 worker·실제 Chrome·본 대화 서버 |
| 추가 브라우저 관찰 | `node design/feature-reviews/2026-10-01-consent/browser-review.mjs` |8시나리오 실행 완료·도구 errors0. 제품의 의도된 오류2개/교사 axe2종/잘림 등은 [관찰 JSON](evidence/browser-observations.json)에 남아 있음. **수정 통과가 아님** |
| 서버 관찰 | `node design/feature-reviews/2026-10-01-consent/server-probe.mjs` |7가지 계약/결함 관찰, 실제 서버 TypeScript·실제 가상 AES-GCM·메모리 DB. Deno 런타임 타입 검사는 아님 |
| 원본 교체 관찰 | `node design/feature-reviews/2026-10-01-consent/source-replacement-probe.mjs` | 실제 저장 함수의 부분 실패 재현. 원격 검증 아님 |
| 긴 텍스트 출력 | `node design/feature-reviews/2026-10-01-consent/long-text-probe.mjs` | 실제 Chrome PDF 생성·PDF.js worker. 560자 원본 겹침 재현 |
| 출력 재열기 | `node design/feature-reviews/2026-10-01-consent/inspect-excel.mjs`; 번들 Python의 `inspect-pdf.py`, Poppler | Excel 값·PNG 크기·PDF 모든 페이지 렌더 확인. [Excel 결과](evidence/excel-inspection.json), [PDF 결과](evidence/pdf-inspection.json) |
| 타입/lint/build·전체 단위 | 미실행 | 제품 코드 변경 없는 리뷰 전용. 범위에 맞는 기존 단위/E2E만 실행. 프런트엔드 통과로 서버 검증을 대체하지 않음 |
| 원격 integration·운영 로그인/RLS/Storage/SQL | 미실행 | 시험 대상·자료/운영 변경 미허용. 원격 테스트 소스만 읽음 |
| 문서/diff | 링크·기준행·JSON·스크립트 구문·`git diff --check`, 변경 경로 확인 | 제품 파일변경0. 해당 리뷰/전용 일지만 커밋 |

초기 검증 환경 문제도 숨기지 않는다. 첫 `npm run dev -- --host ...` 실행은 PowerShell 인자 전달 오류로 종료했고 Vite 직접 호출로 바꿨다. 처음 연결한 node_modules junction은 worker 실제 경로가 Vite fs allow 밖이어서 첫 E2E1개가 timeout된 뒤 중단했다. 리뷰 전용 `fs.allow`·전용 `.vite-cache` 설정으로 해결한 최종 E2E38개만 정상 검증으로 사용했다. agent-browser 실행 파일은 PATH/전역/프로젝트/번들에 없어 사용하지 못했으며 요청에서 허용한 Playwright+설치된 Chrome으로 대체했다. 추가 관찰 도구의 초기 React 중복/가상 사용자 metadata/Storage multipart 응답 문제는 도구만 보정했고 최종8시나리오 완료를 확인했다. 도구 문제를 제품 결함으로 분류하지 않았다.

재현 서버 env는 `VITE_CONSENT_FORMS_DEMO_MODE=true`, `VITE_CLASSROOM_ROLES_DEMO_MODE=true`, `VITE_PUBLIC_APP_URL=http://127.0.0.1:4181`, `VITE_SUPABASE_URL=http://127.0.0.1:9`, `VITE_SUPABASE_ANON_KEY=local-review-placeholder`다. browser-review의 가상 API context는 URL을54321로 대체하고 모든 Auth/REST/Storage/Functions 요청을 route.fulfill한다. 원격 CDN 글꼴 요청은 차단해 설치된 한국어 대체 글꼴로 캡처했다. 실행하려면 의존성을 설치하고 전용 포트가 비었는지 먼저 확인한다. node_modules를 연결한다면 `vite.review.config.ts`의 실제 경로 허용을 사용한다.

## 수정 순서와 인계

1. F01/F02/F03/F04/F05의 서버·DB·문서 버전 계약부터 정하고 실패/동시성/과거 비동의 보존 회귀 검사를 만든다. 마이그레이션은 새 파일로 만들며 현재 번호를 다른 워크트리와 비교한다.
2. F06/F07/F11의 사용자 상태·오류·재시도 흐름을 맞춘다. 개인 값은 서버에서 올바른 개인 링크와 필요한 비밀번호를 검증한 뒤만 반환한다.
3. F08/F09/F10/F12/F13의 레이아웃·출력·안내·접근성을 수정하고 0/24/60명·390px·CSS200%·전체 PDF를 다시 확인한다. 세 프로파일과 여섯 모의 관점 재평가 및 2차 개선은 수정 작업에서 수행한다.
4. 원격 적용은 이번 리뷰에 포함되지 않는다. 실제 수정 후 사용자가 허용한 시험 환경에서 secrets → DB → 관련 Edge Functions → 프런트엔드 호환성을 확인하고, 데모와 원격 검증을 분리해 보고한다.

리뷰 자료와 전용 일지는 서로 다른 목적의 로컬 문서 커밋으로 보존한다. GitHub push·PR·main 병합은 미실행. DB·Edge Functions·프런트엔드 배포는 모두 **미적용**이다.
