# 자료 수합 기능 리뷰 · 2026-10-01

## 결론과 확인 범위

기본 생성·공유·파일 회신·같은 세션의 재제출·개별 파일 다운로드는 작동한다. 다만 계정 간 초안 노출, 교실 공용 IP의 제출 제한, 필수 파일 우회, 저장 실패의 비원자성, 명단 없는 수합의 식별·동시 제출 문제가 우선 수정 대상이다. 총 17개 항목(우선순위 P1 7개, P2 10개)을 아래에 기록했다. 제품 코드와 기존 테스트는 수정하지 않았으며 **모든 발견 사항은 미수정**이다.

- 기준 커밋: c208afefca40bb4f15cab164fc292661e80fb9a0
- 브랜치: codex/feature-review-data-collect-20261001
- 워크트리: C:/Users/panth/.codex/worktrees/review-data-collect-20261001/260812_schooldoc
- 전용 서버: http://127.0.0.1:4183 · strictPort · 다른 서버 재사용/종료 없음
- 실제 설치 Chrome 154.0.8037.58, headless. 교사 1366×900, 참여자 390×844, 교사 모바일, CSS zoom 200%를 검증했다. CSS zoom은 브라우저 자체 확대·보조기기 실기 시험과 구분한다.
- 가상 0명·1명·30명·2,000명, 동명이인·긴 이름, 미확인/이상 없음/수정본 제출, 종료/마감, 오류 복구 상태를 사용했다.
- 전체 화면 원본, QR PNG, 내려받은 가상 PDF, 브라우저 A4 출력, JSON 관찰 결과는 [증거 목록](evidence/index.md)에 있다.

**증거 구분**

| 표시 | 의미 | 검증하지 않은 것 |
| --- | --- | --- |
| 실제 Chrome · 로컬 데모 | 실제 화면 클릭·입력·저장·조회·재제출·다운로드. localStorage 데모 데이터 | 원격 인증·실제 Storage·DB |
| 실제 Chrome · API 모의 | 실제 원격 React 컴포넌트를 사용하고, 관찰 도구가 config/Supabase 모듈 경계만 모의 응답으로 교체 | 실제 로그인·Edge Function 배포·RLS |
| 서버 모의 | 수정 없는 Edge Function 본문을 TypeScript 변환 후 가상 Auth/DB/Storage로 실행 | PostgreSQL 트랜잭션·실제 암호화·원격 부하 |
| 소스 확인 | 기준 커밋의 코드·SQL·테스트를 읽어 확인 | 운영 설정·실제 사용자 경험 |

보고서의 디자인 평가는 한 AI가 각 관점을 분리해 수행한 **모의 검토**다. 실제 전문가 6명, 교사 인터뷰, 승인, 학교 사용성 시험을 뜻하지 않는다. 추가 대화나 하위 에이전트를 생성하지 않았다. 사용자 지시에 따라 2차 제품 개발은 하지 않고 수정 요구와 재검증 기준을 제공한다.

## 실제 사용자 워크플로우

| 단계 | 사용자 행동과 제품 경로 | 실제 결과와 증거 |
| --- | --- | --- |
| 1. 교사 진입 | /tools/data-collect → Google 로그인 → 자기 업무 목록 | 데모 빈 목록 정상. 일반 교사 계정 모의 Auth에서 접근 정상. 서버 모의에서 인증 없으면 401, 타 소유자 get은 403 |
| 2. 요청 작성 | 새 자료 수합 → 제목·안내 | 제목 오류가 첫 입력으로 포커스를 옮김. 제목·명단 초안 저장/복원이 계정별로 분리되지 않음(D01) |
| 3A. 명단 있음 | 이름 입력/표 붙여넣기 또는 Excel → 추가/교체 → 검토 | 3명 붙여넣기, 동명이인 구분 정보, 가져오기 실행 취소 정상. Excel 성명 열 자동 선택 및 열 변경 정상. 손상 Excel은 기존 2명 보존 |
| 3B. 저장 명단 | 설정에 저장된 학급 학생 명단을 수합으로 가져오려 함 | 해당 버튼·서비스 연결 없음(D14). 없는 흐름을 성공으로 기록하지 않음 |
| 3C. 명단 없음 | 제출자가 이름 입력 선택 | 명단 편집을 숨김. 첫 제출·같은 세션의 재제출 정상. 재접속 시 개인 토큰을 잃음(D06) |
| 4A. 새 파일 요청 | 새 파일 제출받기 선택 | 파일 없는 생성 가능. 공개 화면은 파일을 올리게 하지만 완료·교사 현황에 “수정본 제출” 표시(D10) |
| 4B. 검토 요청 | 파일을 보내 검토받기 → 가상 PDF 선택 | 배포 파일이 있어야 생성. 클라이언트가 31MB 배포 파일을 허용하지만 SQL 버킷 한도는 30MiB(D08) |
| 5. 제출 조건 | 마감 빠른 선택/날짜·시간, 추가 설정의 비밀번호·재제출 | 기존 E2E에서 기한 없음/3일 후/지나간 기한 오류 정상. 잘못된 비밀번호 오류, 수정 후 해제 정상. 명단 있는 재제출 금지는 UI에서 반영 |
| 6. 공유 | 링크 복사/열기, QR 이미지 저장 | 복사 문자열과 공개 링크 일치. 실제 PNG 다운로드 성공. 200%에서 QR이 카드 밖으로 나감(D16) |
| 7A. 참여자 찾기 | 공개 링크 → 비밀번호 → 두 글자 이름 검색 → 마스킹 후보 선택 | 매칭·선택 정상. 검색 실패/0건 설명 없음. 원격 컴포넌트의 서버 오류는 표시되지 않음(D13) |
| 7B. 공개 제출 | 명단 없는 링크 → 이름·파일·전달 사항 | 모바일 파일 제출 정상. 실제 서버 요청은 파일 없는 confirmed도 허용(D03) |
| 8. 배포 자료 검토 | 파일 다운로드 → 이상 없음 또는 수정본 제출 | 가상 PDF 다운로드, 이상 없음 회신, 수정본 2차 회신 성공. 다른 대상 선택 가능 |
| 9. 실패 복구 | 위장 PDF/업로드 실패 → 파일 교체/재시도 | 데모 위장 PDF 오류 후 메모 유지. 원격 UI 모의 업로드 실패 후 파일·메모 보존, 재시도 완료. 서버 DB/Storage 일관성은 D04/D05/D07 |
| 10. 교사 조회 | 회신 현황 → 최근 파일 다운로드 | 30명 표에서 미확인/이상 없음/수정본을 함께 표시. 파일 다운로드 성공. 전달 사항·이전 버전 열람 없음(D09), 외부 제출 갱신 없음(D12) |
| 11. 종료/재개 | 수합 종료 → 공개 화면 차단 → 다시 열기 | 명시적 종료·재개 정상. 기한 경과의 “수합 중” 표시와 참여자 차단이 모순(D11) |
| 12. 기록 출력 | 현황 Excel/PDF·인쇄 또는 일괄 다운로드를 찾음 | 현황 Excel/PDF·일괄 파일 내려받기 UI 없음. Chrome A4 출력 3쪽 모두 빈 페이지(D15). 개별 원본 파일 다운로드와 구분 |

### 경계별 정상 확인 및 한계

- Auth gate는 로그인 사용자에게 열리며 자료 수합에 특정 이메일 allowlist가 없다. 서버 requireUser는 Auth 검증 사용자 ID를 사용한다.
- admin list는 owner_id 필터, get은 serialize의 소유자 검사, status/delete는 owner_id 조건, 배포 업로드 URL은 사용자 경로 검사를 한다. 서버 모의에서 일반 교사 200, 타 소유자 403, 타 소유자 파일 서명 0회, 잘못된 업로드 경로 422를 확인했다.
- SQL은 수합/대상/파일/제한 테이블에 RLS를 켜고 브라우저 직접 읽기·쓰기 정책을 만들지 않는다. 실제 배포된 정책은 미검증이다.
- 공개 metadata는 잠금 전·종료 후 signed URL을 반환하지 않고 틀린 비밀번호는 401로 거부한다. 공개 제출은 종료 시 410, 제한 RPC 실패 시 DB 읽기를 중단한다.
- 개인 이름·파일명·전달 사항은 서버의 dataCollectCrypto와 payloadCrypto 경로를 사용한다. 모의 cipher는 실제 암호화 검증이 아니다. 실제 키를 읽거나 교체하지 않았다.
- 공개 검색은 마스킹 이름·구분 정보와 선택용 personal_token을 반환한다. 전체 원본 명단과 파일 목록을 반환하지는 않는다. 공용 링크와 이름 검색으로 얻은 토큰은 해당 대상 제출 권한으로 쓰이므로, 이름 검색은 신원 인증이 아니라는 설계 한계가 남는다. 민감 자료의 신원 확인 요구는 별도 정책 결정이 필요하다.

## 10개 휴리스틱 평가

| 휴리스틱 | 판정 | 판단과 근거 |
| --- | --- | --- |
| 1. 시스템 상태 가시성 | 수정 필요 | 수합 중/마감 모순, 원격 현황 갱신 없음, 검색 오류 숨김(D11~D13). 저장·제출 중 문구와 제출 완료 화면은 있음 |
| 2. 실제 업무와 맞는 언어 | 수정 필요 | 첫 파일 제출도 수정본으로 표시(D10). 배포 검토의 이상 없음/수정본 선택은 업무에 맞음 |
| 3. 사용자 통제와 자유 | 수정 필요 | 명단 가져오기 실행 취소, 다른 대상 선택, 명시적 종료/재개는 정상. 재접속 후 재제출 통제가 사라짐(D06) |
| 4. 일관성과 표준 | 수정 필요 | 데모는 같은 이름 재접속을 거절하고 원격 서버는 새 대상으로 처리(D06). 시간 경과 상태도 교사·참여자 간 불일치(D11) |
| 5. 오류 예방 | 수정 필요 | 중복 명단과 제목/마감 입력 검증은 있음. 서버 필수 파일·원자 저장·업로드 정리가 부족(D03~D08) |
| 6. 기억보다 인식 | 수정 필요 | 최종 확인과 선택 대상은 보임. 이전 버전·전달 사항·받은 제출의 복구 정보가 없어 기억에 의존(D06/D09) |
| 7. 유연성과 작업 효율 | 수정 필요 | 붙여넣기·Excel 열 선택은 효율적. 저장 명단 재사용, 현황 출력·일괄 다운로드가 없음(D14/D15) |
| 8. 간결한 구성과 정보 위계 | 부분 통과 | 단일 열 생성 폼과 30명 표의 열 균형은 안정적. 모바일 상단 요약 3칸과 QR이 현황을 아래로 밀며 확대 시 QR 경계 문제(D16) |
| 9. 오류 인식·설명·복구 | 수정 필요 | 파일/메모 보존은 정상. 검색·초기 관리 조회 오류 안내와 재시도, 실패 원자성 부족(D04/D05/D13) |
| 10. 도움말과 사용 안내 | 수정 필요 | 생성·비밀번호·회신 안내는 있으나 입력 형식/크기 안내가 참여자에게 충분하지 않고, 최초 제출/재제출과 이력 보관 안내가 실제 접근 기능과 다름(D08~D10) |

## 세 디자인 프로파일: 검증 전 가설과 검증 후 판정

검토 기준은 [웹디자이너](../../../pro/web-designer.md), [UX 디자이너](../../../pro/ux-designer.md), [UI 디자이너](../../../pro/ui-designer.md)를 먼저 읽었다.

| 관점 | 검증 전 가설 | 검증 후 판정·근거 | 남은 위험 |
| --- | --- | --- | --- |
| 웹디자인 | 생성은 단일 열, 관리 화면은 전체 폭 표여서 입력/명단 밀도는 안정적일 가능성 | 수정 필요. 0/30/2,000명 전체 화면에서 생성 폼의 열 불균형·의미 없는 큰 공백은 없었음. 관리 모바일의 요약/공유가 높고 CSS 200% QR이 카드 오른쪽을 67px 넘음 | 실제 전자칠판·브라우저 자체 200%·테마별 시각 검토 미실시 |
| UX | 두 명단 방식·두 요청 방식이 독립 선택이고 오류 시 입력은 보존될 가능성 | 수정 필요. 정상 과제는 완료했으나 계정별 초안, 공개 재접속 식별, 전달 사항 열람, 현황 갱신/검색 복구가 끊김 | 실제 교사·학생의 발견성/속도와 동명이인 신원 확인 정책 미검증 |
| UI | 주요 버튼 44px 이상, native input/fieldset 사용으로 기본 키보드는 가능 | 수정 필요. 제목 오류 포커스·키보드 파일 선택/제출 성공. 파일 입력 포커스는 1×1px이고 보이는 label에는 윤곽선 없음. QR 대체 이름과 재제출 안내 대비 위반 | 보조기기 실제 읽기, 모든 테마의 대비, 스마트폰 파일 선택기 실기 미검증 |

## 여섯 독립 AI 모의 관점 평가

서로 다른 판단 질문을 적용했으며 별도 사람이나 하위 에이전트를 사용하지 않았다.

| 모의 관점 | 판정 | 근거 | 수정 요구 |
| --- | --- | --- | --- |
| 웹 · 정보 위계 | 수정 필요 | 관리 30명 전체 화면은 제목→숫자→공유→표 순서. 30명 중 미확인이 28명이어도 미확인 숫자/필터가 없어 교사가 합계를 해석해야 함. 최초 제출 표시는 부정확 | 요청 방식에 맞는 상태 요약, 미제출 대상 우선 접근, 전달 사항/이력 표시 |
| 웹 · 화면 밀도 | 부분 통과 | 생성 30명/2,000명은 360px 명단 영역을 의도적으로 스크롤하여 폼 전체가 무한히 길어지지 않음. 30명 표 열 균형·긴 이름 줄바꿈 정상. 모바일 명단 행은 번호/이름/삭제가 쌓여 2행가량만 보임 | 모바일 행의 불필요한 세로 밀도를 줄이되 터치 크기를 보존. QR 확대 경계 수정 |
| UX · 참여자 흐름 | 수정 필요 | 비밀번호 복구, 파일/메모 보존, 확인·수정본 제출 완료는 정상. 검색 오류/빈 결과는 무응답처럼 보이고 공개 수합 재접속 시 이전 제출을 찾을 수 없음 | 검색 상태 안내·재시도, 안전한 제출 영수증/복구 경로, 입력 파일 규칙 사전 안내 |
| UX · 교사·교실 흐름 | 수정 필요 | 전자칠판에서 동일 공용 IP의 서로 다른 9명 제출 모의 요청 중 9번째 429. 교사 화면은 외부 제출 후 get 재호출 0회. 이력/메모/저장 명단/출력이 빠짐 | 학급 동시 참여를 수용하는 제한, 갱신/마지막 조회 시각, 현황 작업과 내보내기 연결 |
| UI · 접근성 | 수정 필요 | 실제 Tab→Enter로 파일 선택·제출 가능하지만 파일 선택의 포커스가 보이지 않음. axe: QR svg-img-alt 1개, 재제출 안내 대비 4.44:1(기준 4.5:1) | 보이는 파일 선택 focus-within, QR 이름 또는 적절한 장식 처리, 대비 조정 |
| UI · 반응형·상태 | 수정 필요 | 390px 참여자 화면과 CSS 200%는 문서 가로 넘침 없음. 교사 200% QR은 카드/뷰포트 밖으로 나감. 모바일 표는 의도적 가로 스크롤. 완료·마감·처음 제출 상태 의미 모순 | QR 크기/공유 grid 재배치, 최초·수정 제출 분리, 유효 마감 상태 통일 |

2차 개발 후 위 표를 같은 0/1/30/2,000명·혼합 상태·전체 화면 조건으로 다시 평가해야 한다. 이 보고서는 그 재평가를 완료했다고 주장하지 않는다.

## 발견 사항 및 수정 완료 기준

우선순위: P1은 개인정보/제출 정확성/저장 일관성/학급 참여를 막는 문제, P2는 업무 흐름·안내·출력·접근성을 개선해야 하는 문제다. 코드 위치는 **기준 커밋의 줄 번호**다.

### D01 · P1 · 다른 계정에 이전 교사의 작성 중 명단이 복원됨

- 위치: src/features/dataCollect/DataCollectCreatePage.tsx:30, :64, :140, :223
- 재현: 원격 UI 모의에서 A교사로 새 업무의 제목·가상A학생을 입력 → 350ms 후 Auth를 B교사로 변경 → 새로고침.
- 관찰: B계정 화면에 A의 제목과 가상A학생이 복원됨. [캡처 35](evidence/35-mock-draft-cross-account.jpg), remote-ui-mock-observations.json의 unscoped draft crosses accounts.
- 확인 구분: 실제 Chrome/모의 Auth. 저장소 키에 사용자 ID가 없고 초안에 소유자도 없음은 소스 확인.
- 영향: 공유 PC에서 계정별 서버 격리를 해도 미완료 명단이 다른 교사에게 보이고 그 계정 업무로 생성될 수 있음.
- 수정 요구: 인증된 사용자별 초안 키·소유자 검증, 계정 변경 시 메모리 초안 초기화/올바른 재로딩. 소유자 없는 기존 키는 임의로 새 계정에 자동 이전하지 않기.
- 완료 기준: A→B 전환/로그아웃/새로고침에서 A 명단과 제목이 B에 나타나지 않고, A 재로그인 시 자기 초안만 복원. 파일·비밀번호의 별도 취급을 유지.

### D02 · P1 · 학교 공용 IP에서 한 수합의 9번째 제출이 차단됨

- 위치: supabase/functions/data-collect-public/index.ts:31, :34
- 재현: 배포 파일 있는 수합에 가상 대상 9명을 마련 → 같은 IP·공개 토큰으로 60초 창 안에서 각자 confirmed 제출.
- 관찰: 서버 모의 상태 [200,200,200,200,200,200,200,200,429]. 제한 키는 IP+수합 토큰+action이며 학생별 구분 없음.
- 확인 구분: 실제 함수의 제한 인수/해시, 가상 RPC의 창 내 카운터를 사용. 실제 학교 부하·플랫폼 IP 헤더는 미검증.
- 영향: 30명 한 학급 동시 참여에 실패하며 학생·교사는 정상 제출 실패 원인을 구분하기 어려움.
- 수정 요구: 정상 학급 부하를 수용하는 수합/IP 전체 제한과 식별된 대상별 제한을 나누고 실패한 추측 제한도 유지. RPC 오류 시 호출 중단 정책 유지.
- 완료 기준: 같은 IP의 30명 정상 1차 제출·필요한 조회가 한 분 안에 완료되고, 동일 대상 반복·추측·전체 남용은 계속 차단. 원격 부하 확인은 허가된 시험 환경에서 별도 수행.

### D03 · P1 · 새 파일 요청을 파일 없는 “이상 없음”으로 우회 가능

- 위치: supabase/functions/data-collect-public/index.ts:170, :190, :197
- 재현: template_path가 없는 명단 기반 수합에 submit, 유효 personalToken, decision=confirmed를 보내고 파일 경로·이름은 생략.
- 관찰: 서버 모의 200, 파일 없는 confirmed 행 생성. 일반 공개 UI에서는 이 선택을 숨기지만 서버는 배포 파일 유무와 decision을 연결하지 않음.
- 영향: 교사가 새 파일을 요청한 업무에 파일 없이 완료 기록이 남음. 화면 제어만으로 필수 조건을 보장하지 못함.
- 수정 요구: 서버에서 요청 종류와 허용 decision을 결합. 배포 파일 없으면 submitted+유효 파일 필수, 배포 검토는 confirmed/corrected 계약을 명시.
- 완료 기준: fixed/custom 두 모드 모두 파일 없는 새 제출·허용되지 않은 decision을 4xx로 거절하며 대상·현황·Storage에 완료/고아 기록이 생성되지 않음.

### D04 · P1 · 재제출 실패가 이전 현재 버전을 해제하고 성공 응답과 대상 상태가 어긋남

- 위치: supabase/functions/data-collect-public/index.ts:185, :194, :196, :198, :202
- 관련: supabase/migrations/202608210001_data_collect.sql:67의 current unique index; supabase/migrations/202608270001_active_work_summary.sql:80의 is_current 집계
- 재현: 1차 현재 파일을 두고 2차 insert에 실패를 주입. 별도 시나리오로 target update만 실패.
- 관찰: 2차 실패는 500이나 기존 is_current=false, 현재 행 0개. target update 실패는 제출 파일이 생기고도 200 반환·submitted_at 없음.
- 확인 구분: 실제 함수 + 모의 DB 오류. 이전 파일 자체 삭제는 관찰되지 않았으며 현재 플래그/집계 손상 문제다. 실제 SQL 동시성은 미검증.
- 영향: 진행 업무 집계·대상 상태·파일 이력이 불일치. 다음 재제출·동시 요청에서 현재 버전 의미가 깨질 수 있음.
- 수정 요구: revision 할당/기존 현재 해제/새 행 삽입/대상 상태 변경을 DB 트랜잭션으로 처리하고 각 오류 검사. Storage 보상과 실패 재시도도 별도 명확히 처리.
- 완료 기준: 모든 실패 지점에서 기존 current·revision·대상 상태가 유지되며 성공 때 한 target의 current가 정확히 하나. 동시 제출도 중복 revision/현재 행 없이 안정적으로 성공 또는 명확한 충돌 반환.

### D05 · P1 · 무효 업로드가 공개 수합의 유령 대상과 고아 Storage 파일을 남김

- 위치: supabase/functions/data-collect-public/index.ts:183, :193, :196; src/features/dataCollect/dataCollectPublicApi.ts:38, :41, :44
- 재현: custom 수합의 walk-in 경로에 가짜 PDF Blob을 두고 submitted 요청 → 서버 magic validation 실패.
- 관찰: 400이지만 target 1개, 파일 DB 행 0개, Storage 객체가 남고 remove 호출 0회. 대상 생성이 파일 검증보다 먼저임.
- 영향: 실제 제출이 없는 이름이 “전체 대상”에 누적되고 파일 저장 비용·보관/파기 대상이 DB 파일 행과 어긋남. prepare 이후 제출 취소·마감·비밀번호 오류·DB 초기 실패에도 고아가 남을 수 있음(후자는 소스상 위험).
- 수정 요구: 검증 전 공개 대상 확정 방지, 업로드 예약과 finalization을 연결, 실패/만료 업로드의 소유권 확인된 정리·재시도 기록. 교사의 배포 파일 선업로드 후 생성 실패 경로도 함께 점검.
- 완료 기준: 위장/빈 파일·제출 중단·검증 실패·DB 실패 각각에서 새 대상/파일 행을 남기지 않고 파일이 정리되거나 비개인정보 재시도 기록으로 추적됨. 사용자 기존 파일은 보존.

### D06 · P1 · 명단 없는 수합은 재접속을 새 사람으로 처리함

- 위치: src/features/dataCollect/RemotePublicDataCollectPage.tsx:12, :13, :24, :67; supabase/functions/data-collect-public/index.ts:176, :183; src/features/dataCollect/dataCollectStore.ts:107
- 재현: 이름·파일 첫 제출 → 같은 페이지의 다시 회신하기는 성공 → 새로고침/링크 재접속 후 같은 이름·파일 제출.
- 관찰: 원격 UI 모의는 다시 보낸 personalToken이 빈 문자열. 서버 모의는 동일 이름 2대상·각 revision=1을 생성하며 allow_resubmit=false도 새 대상으로 들어감. 데모는 같은 이름의 기록이 있다는 오류로 막힘. [데모 캡처 21](evidence/21-custom-reload-blocked-mobile.jpg).
- 영향: “제출 후 파일 교체 허용”을 켜도 재접속 후 이전 기록을 잇지 못하고 제출자 수·버전 의미가 깨짐. 같은 이름 자체만으로 동일인이라고 가정할 수도 없음.
- 수정 요구: 제출 완료 시 안전한 영수증/개인 재접속 링크·복구 수단을 제공하고 안정된 대상 식별자로 재제출. 동명이인을 이름만으로 합치지 않기. 데모/실서버 계약 일치.
- 완료 기준: 새로고침·다른 탭·복구 링크에서도 같은 target에 revision 2로 이어지고, 금지된 재제출은 기존 target에서 차단. 이름이 같은 다른 참여자는 명시적으로 구분. 전체 명단이나 타인의 링크를 공개하지 않음.

### D07 · P1 · 공개 동시 제출 대상 번호를 max+1로 계산해 충돌함

- 위치: supabase/functions/data-collect-public/index.ts:52, :53, :58; supabase/migrations/202608210001_data_collect.sql:39
- 재현: custom 최초 제출 2개가 같은 마지막 row_number 조회 결과를 먼저 읽도록 모의 barrier를 둔 뒤 동시에 대상 insert.
- 관찰: unique(collection_id,row_number)를 모델링한 결과 200/500, 대상 1개. server-mocks.mjs의 barrierWalkInNumbering으로 재현 가능.
- 확인 구분: 가능한 interleaving을 명시한 실제 함수 + SQL 제약 모형. 실제 PostgreSQL 동시 요청 시험은 수행하지 않음.
- 영향: 서로 다른 참여자의 정상 제출 하나가 실패하며 이미 올린 파일도 남을 수 있음.
- 수정 요구: 수합별 번호를 트랜잭션·잠금·원자 RPC 등으로 할당하고 명확한 재시도 계약 제공.
- 완료 기준: 30명 동시 최초 제출에서 대상 30개·중복 번호 0개·완료 결과 30개. 충돌/재시도에도 같은 제출이 중복 생성되지 않음.

### D08 · P2 · 배포 파일 크기 안내와 서버 한도가 다르고 공개 업로드 사전 검사가 없음

- 위치: src/features/dataCollect/DataCollectCreatePage.tsx:463; src/features/dataCollect/dataCollectUtils.ts:18; supabase/migrations/202608210001_data_collect.sql:139, :142; src/features/dataCollect/dataCollectPublicApi.ts:35
- 재현: 교사 배포 파일로 31MiB 가상 PDF 선택 → 정상 선택 표시. 버킷 설정은 31,457,280bytes(30MiB). 공개 요청 함수는 파일 유효성 검사 없이 prepare/upload를 먼저 수행.
- 관찰: [캡처 26](evidence/26-template-31MB-accepted.jpg)에서 31.0MB 선택·최대 50MB 안내. 51MiB 파일은 클라이언트에서 거절.
- 확인 구분: Chrome 선택 + SQL 소스 비교. 운영 버킷이 이 설정과 같은지, 실제 31MiB 업로드가 거절되는지는 원격 미실시.
- 영향: 큰 배포 자료를 다 작성한 뒤 Storage에서 실패. 참여자는 제한 안내와 조기 검증 없이 데이터 전송 후 실패를 접함.
- 수정 요구: 배포/제출별 한도를 공통 규칙으로 일치시키고 화면·서버·Storage에 적용. 공개 API 호출 전 size/extension/magic 검사, 파일 선택 영역에 형식·크기 안내.
- 완료 기준: 각 한도 직전/정확한 한도/초과 파일 결과와 문구가 모든 계층에서 같고, 빈/위장/초과 파일은 업로드 호출 0회. 서버 검증도 유지.

### D09 · P2 · 참여자 전달 사항과 이전 제출 버전을 교사가 읽을 수 없음

- 위치: src/features/dataCollect/DataCollectManagePage.tsx:25, :47; supabase/functions/data-collect-admin/index.ts:83
- 재현: 가상 메모를 넣은 이상 없음 1차 → 수정본/새 메모 2차 → 교사 관리 화면.
- 관찰: localStorage/API에는 note와 전체 이력이 있지만 화면은 latestByTarget와 최근 파일만 표시. noteVisibleInManagement=false. 이력 열기 조작·이전 회신/파일 링크 없음. [캡처 14](evidence/14-manage-30-mixed-desktop.jpg).
- 영향: 참여자의 질문·수정 설명을 놓침. “이전 제출은 버전으로 남습니다” 안내대로 교사가 과거 기록을 확인할 수 없음.
- 수정 요구: 대상별 현재 전달 사항과 버전별 결정·시각·전달 사항·파일 열람을 제공. 기존 데이터/상태 의미 보존.
- 완료 기준: 메모 있는 confirmed와 파일 있는 corrected/submitted 모두 교사가 읽고 1차/2차 파일·결정을 구분해 조회/다운로드. 공개 API에 다른 대상 이력을 포함하지 않음.

### D10 · P2 · 최초 파일 제출을 수정본으로 표시함

- 위치: src/features/dataCollect/PublicDataCollectPage.tsx:59; src/features/dataCollect/RemotePublicDataCollectPage.tsx:76; src/features/dataCollect/DataCollectManagePage.tsx:35, :45, :47
- 재현: 배포 파일 없는 업무를 만들고 처음 파일 제출 → 완료·관리 화면.
- 관찰: decision=submitted인데 두 화면 모두 “수정본 제출”. [캡처 20](evidence/20-custom-first-complete-mobile.jpg), [캡처 22](evidence/22-custom-management-status.jpg).
- 영향: 교사가 제출 요청을 수정 요청으로 오해하고 실제 수정 회신과 최초 자료를 구분하기 어려움.
- 수정 요구: submitted/confirmed/corrected를 표시 계층에서 분리. 새 파일 요청은 미제출/제출 완료, 배포 검토는 미확인/이상 없음/수정본 제출. 이미 받은 decision 값은 임의 변환하지 않기.
- 완료 기준: fixed/custom, 첫 제출/재제출, 배포 유무의 모든 조합에서 label·합계·현황/내보내기 의미가 일치.

### D11 · P2 · 마감이 지난 업무가 교사에게 계속 수합 중으로 표시됨

- 위치: src/features/dataCollect/DataCollectListPage.tsx:41; src/features/dataCollect/DataCollectManagePage.tsx:42; src/features/dataCollect/dataCollectUtils.ts:152; supabase/functions/data-collect-public/index.ts:69
- 재현: status=open이고 dueAt이 지난 가상 업무를 조회.
- 관찰: 교사 목록/관리 로직은 status만 보고 수합 중, 공개 화면/서버는 종료·차단. [교사 24](evidence/24-expired-management-open.jpg), [참여자 25](evidence/25-expired-mobile-closed.jpg).
- 영향: 교사가 링크를 다시 공유하거나 “다시 열기”와 기한 변경을 혼동함. 현재 관리 UI에는 기한 수정 기능도 없음.
- 수정 요구: 기한 경과와 명시적 종료를 구분하는 공통 유효 상태, 관리 마감 시각·수정/연장 경로 제공. 기한 경과만으로 closed_at/보관 기산점을 임의 변경하지 않기.
- 완료 기준: 현재 시각이 기한을 넘을 때 목록·관리·공개/API가 같은 제출 가능 상태를 설명하고, 허용된 연장 후 다시 제출 가능.

### D12 · P2 · 원격 교사 현황을 외부 제출 뒤 갱신할 방법이 없음

- 위치: src/features/dataCollect/dataCollectService.ts:4, :19; src/features/dataCollect/dataCollectStore.ts:137; src/features/dataCollect/DataCollectManagePage.tsx:20; src/features/dataCollect/DataCollectListPage.tsx:19
- 재현: 원격 UI 모의 get 응답으로 미확인 표시 → 외부 제출 응답 상태를 바꿈 → 기다림/탭 복귀 → 이후 브라우저 새로고침.
- 관찰: 변경 후 get 재호출 0회, 미확인 유지. 새로고침 뒤 파일·완료 표시. subscribe는 localStorage/커스텀 이벤트뿐이며 원격 구독·polling·수동 갱신 UI 없음. [32](evidence/32-mock-management-stale.jpg), [33](evidence/33-mock-management-after-reload.jpg).
- 확인 구분: 실제 Chrome/API 모의 + 소스. 1.5초 관찰만으로 장시간을 단정하지 않으며, 소스에 갱신 스케줄이 없음을 함께 확인.
- 영향: 제출 완료 후 교사가 재촉하거나 교실 진행을 잘못 판단.
- 수정 요구: 수동 새로고침 및 마지막 갱신 시각, 필요시 Realtime/주기 조회/탭 복귀 조회. 소유자 조건과 요청량 유지.
- 완료 기준: 다른 세션의 제출이 정한 시간 내 현황에 반영되고 실패 시 이전 데이터·갱신 실패 안내·재시도 제공. 데모만의 이벤트로 성공을 판단하지 않음.

### D13 · P2 · 검색과 최초 관리 조회의 오류가 숨겨지고 복구 조작이 없음

- 위치: src/features/dataCollect/RemotePublicDataCollectPage.tsx:35, :46, :79; src/features/dataCollect/PublicDataCollectPage.tsx:31, :62; src/features/dataCollect/DataCollectManagePage.tsx:20, :32
- 재현: 원격 검색에 빈 입력/500/0건 응답. 관리 get에 500 응답.
- 관찰: 검색 validation/error/0건 안내 모두 없음. error 출력은 대상 선택 뒤 submit form 안에만 존재. 관리 get 500은 “자료 수합을 찾을 수 없습니다”로 바뀌며 실제 오류·재시도 버튼 없음. [34](evidence/34-mock-load-error-hidden.jpg), [37](evidence/37-mock-search-error-mobile.jpg).
- 영향: 검색 버튼이 고장 난 것처럼 보임. 일시 장애를 주소 오류로 오해해 교사에게 불필요한 문의.
- 수정 요구: 검색 전/조회 중/0건/오류를 분리하고 해당 단계에서 role=alert·재시도 제공. 관리 not-found와 load-error 분리, 입력·기존 현황 보존.
- 완료 기준: 422/401/429/500/0건 각각 설명과 다음 행동이 화면·보조기술에 나타나고, 원인 해결 후 새로고침 없이 작업 재개 가능.

### D14 · P2 · 저장된 학급 명단 가져오기 연결 없음

- 위치: src/features/dataCollect/DataCollectCreatePage.tsx:13, :424; 참고 src/features/classroomRoles/ClassRosterSettings.tsx:101, src/features/consentForms/ConsentRecipientsStep.tsx:53
- 재현: 수합 생성의 명단 선택·가져오기 조작을 확인하고 관련 소스에서 저장 명단 읽기/버튼을 검색.
- 관찰: 이름 입력/Excel만 있음. 2,000명 화면에서도 저장 명단 affordance 0개. 공통 학급 명단은 다른 기능에 존재.
- 확인 구분: Chrome + 소스. 저장 명단 연동 흐름 자체가 없어 성공/실패 시험을 할 수 없었음. 기존 기능의 회귀라고 주장하지 않는 기능 공백.
- 영향: 같은 학급을 매번 붙여넣거나 Excel로 준비해야 함.
- 수정 요구: 기존 소유자별 공통 명단 서비스를 재사용하고 미리보기·추가/교체·동명이인 구분·실행 취소 제공.
- 완료 기준: 자기 저장 명단만 가져오고, 빈 명단/서버 실패가 기존 수합 초안을 덮어쓰지 않음. 잘못된 학급·중복·번호 의미를 검토 후 확정.

### D15 · P2 · 현황 내보내기 경로가 없고 A4 브라우저 인쇄는 빈 페이지

- 위치: src/index.css:525, :532; src/features/dataCollect/DataCollectManagePage.tsx:39, :47
- 재현: 30명 혼합 현황 화면 → Chrome print 미디어 → A4 PDF → Poppler로 모든 3쪽 렌더링.
- 관찰: 전역 body * visibility:hidden에서 자료 수합을 다시 보이게 하는 print root가 없어 3쪽 모두 백지. [PDF](evidence/19-browser-print-A4.pdf), [1쪽](evidence/print-A4-1.jpg), [2쪽](evidence/print-A4-2.jpg), [3쪽](evidence/print-A4-3.jpg).
- 확인 구분: 실제 Chrome 브라우저 인쇄. 제품의 전용 PDF 내보내기 버튼은 없으므로 전용 내보내기를 실행한 것으로 표현하지 않음.
- 영향: 제출 현황을 회의·공문용으로 남길 수 없음. 현재 개별 파일 다운로드만 있어 여러 파일의 묶음 작업도 불편.
- 수정 요구: 필요한 현황 Excel/PDF/인쇄 및 일괄 파일 다운로드 범위를 명시하고 제공. 화면/출력 상태·메모·버전 구조를 맞춤. print root는 해당 화면에 한정.
- 완료 기준: 0/1/30명·긴 이름에서 백지·잘림·겹침·행 분할이 없고 페이지 전체를 검토. 최신/이전 버전·submitted/confirmed/corrected의 의미가 출력에서도 같음. QR PNG 저장은 별도로 유지.

### D16 · P2 · CSS 200%에서 QR이 공유 카드 밖으로 나감

- 위치: src/features/dataCollect/DataCollectManagePage.tsx:46의 lg grid 고정 190px 열과 QRCodeSVG size=144
- 재현: 교사 1366px 화면의 body CSS zoom=2.
- 관찰: 실제 QR 오른쪽 1369.406px, 카드 오른쪽 1302px, viewport 1366px. 카드 67.406px 초과. 문서 scrollWidth는 1366px로 가로 넘침 수치만으로는 발견 불가. [16](evidence/16-manage-css-200.jpg), [42](evidence/42-single-teacher-css-200.jpg).
- 영향: 확대 사용자의 QR·공유 조작이 카드 경계를 벗어나고 일부 화면에서 잘림.
- 수정 요구: 고정 열·SVG의 확대 실제 크기를 수용하는 공유 레이아웃, 필요시 QR 영역 세로 배치. 문서 하나의 세로 스크롤 유지.
- 완료 기준: 1366/390px·CSS 200%에서 QR/버튼이 카드와 viewport 안에 있고, 문서 폭뿐 아니라 각 요소 rect를 확인. 브라우저 자체 확대도 후속 검증.

### D17 · P2 · 키보드 파일 선택 포커스·QR 이름·재제출 안내 대비가 부족

- 위치: src/features/dataCollect/PublicDataCollectPage.tsx:61, :64; src/features/dataCollect/RemotePublicDataCollectPage.tsx:79; src/features/dataCollect/DataCollectManagePage.tsx:46
- 재현: 참여자 화면 Tab으로 파일 input 이동 → Enter 선택 → Tab 메모/제출. 관리 화면과 재제출 오류 화면 axe 검사.
- 관찰: 키보드 파일 선택/제출은 성공하지만 input이 1×1px이고 보이는 label에는 outline/box-shadow 없음. [43](evidence/43-mobile-keyboard-file-focus.jpg). QR svg-img-alt 1개. “이미 1차 회신…” 12px 안내의 #9A6700/#F1F5F9 대비 4.44:1.
- 영향: 키보드 사용자는 현재 파일 선택 위치를 찾기 어렵고 보조기술 사용자는 QR 의미를 알기 어려움.
- 수정 요구: 파일 label의 focus-within 또는 보이는 버튼, QR title/접근 가능한 이름(링크와 중복 장식이면 적절한 숨김), 안내 대비 4.5:1 이상. QR 저장 버튼의 40px 높이는 44px 목표로 보완.
- 완료 기준: 실제 Tab·Enter·Shift+Tab에서 위치가 보이고 순서/접근 가능한 이름이 일치. 관련 axe 위반 0개와 대비 계산 확인. 자동 검사만으로 실제 보조기기 사용성을 단정하지 않음.

## 추가 검증 필요 사항

다음은 확인된 결함 수에 추가하지 않은 소스상 위험 또는 시험 한계다.

- 공개 배포 signed URL 유효기간 300초, 교사 파일 URL 600초. 오래 열린 페이지의 URL 갱신/만료 복구 동작은 원격 미검증이며 파일·메모를 잃지 않는 재발급 흐름이 필요하다.
- admin은 templatePath의 사용자/수합 경로를 검사하지만 배포 파일 실제 존재·형식·실제 크기를 제출 파일처럼 읽어 확인하지 않는다. Storage MIME 한도 및 거짓 client metadata와의 경계는 허가된 로컬/시험 Storage 검증이 필요하다.
- prepare-upload는 재제출 금지 여부를 최종 submit 단계까지 확인하지 않는다. 이미 끝난 대상의 불필요한 업로드와 실패 정리도 D05 수정에서 다뤄야 한다.
- DB INSERT 성공 뒤 응답/serialize 실패의 재시도는 새로운 수합 UUID/업로드를 만들 수 있다. 업무 생성과 최초 제출의 idempotency·응답 유실 복구를 별도 검증해야 한다.
- 공개 검색으로 personal_token을 받을 수 있고 공유 비밀번호는 대상별 신원 확인 수단이 아니다. 이 설계를 유지할 업무 범위를 정하고 실제 학생 개인정보를 더 요구하지 않는 방식으로 신원 요구를 설계해야 한다.
- 영구 파기는 실행하지 않았다. admin delete의 Storage 선삭제·재조회·DB 후삭제는 소스로 확인했으나 실제 삭제/권한/부분 실패·재시도 기록은 미검증이다.
- 2,000명은 생성 폼에 실제 입력·렌더링만 했고 2,000명 원격 저장/파일 업로드/목록 복호화 부하는 시험하지 않았다.

## 재현 도구와 실행 결과

### 전용 데모 서버 시작

다른 세션의 서버를 재사용하지 않는다. 이 워크트리에서 의존성을 준비한 후 PowerShell에서 실행한다. npm.ps1의 인수 전달 문제 때문에 관찰 때 Vite를 직접 실행했다.

~~~powershell
$env:VITE_DATA_COLLECT_DEMO_MODE='true'
$env:VITE_CONSENT_FORMS_DEMO_MODE='true'
$env:VITE_PUBLIC_APP_URL='http://127.0.0.1:4183'
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4183 --strictPort
~~~

4183이 이미 사용 중이면 기존 서버를 종료하지 말고 전용 포트/도구 baseURL을 함께 바꾼다. 새 browser context마다 네트워크를 로컬 origin으로 제한하며 실제 계정·키·자료를 사용하지 않는다.

| 검사/도구 | 결과 | 범위·한계 |
| --- | --- | --- |
| agent-browser 전용 session으로 open/screenshot/snapshot/eval | 완료 | 실제 Chrome 데모가 열리고 콘텐츠/주요 버튼·오류 오버레이 없음 |
| npm.cmd test -- tests/unit/dataCollectUtils.test.ts tests/unit/dataCollectStoragePaths.test.ts tests/unit/dataCollectPublicApi.test.ts | 통과: 3파일·11검사 | 기존 클라이언트 공통 규칙/공개 metadata 모의 |
| npm.cmd run test:e2e -- --config design/feature-reviews/2026-10-01-data-collect/playwright-review.config.mjs | 통과: 7검사 | 기존 tests/e2e/data-collect.spec.ts. 전용 서버·각 테스트 독립 Chrome context. [로그](evidence/existing-e2e.log) |
| node design/feature-reviews/2026-10-01-data-collect/browser-demo.mjs | 관찰 완료: 13시나리오 | 정상 과제와 결함을 함께 기록. 실제 Chrome/localStorage 데모 |
| node design/feature-reviews/2026-10-01-data-collect/browser-remote-mocks.mjs | 관찰 완료: 7시나리오 | 실제 원격 React UI + 모의 Auth/API. 현황·오류·초안·재접속 관찰 |
| node design/feature-reviews/2026-10-01-data-collect/server-mocks.mjs | 관찰 완료: 11시나리오 | 실제 handler + 모의 DB/Storage/Auth. assertions는 기존 결함을 기대하므로 수정 성공 검사가 아님 |
| node design/feature-reviews/2026-10-01-data-collect/supplemental.mjs | 완료 | Tab/Enter 실제 파일 선택·제출, 허용 8확장자 signature·허용되지 않은 확장자/빈/위장/51MiB 파일 거절, 확대 rect |
| axe-core Playwright | 위반 발견 | QR 대체 이름, 재제출 안내 대비. 자동 검사 0개인 화면도 전문가/보조기기 시험 통과 의미 아님 |
| Chrome A4 print + Poppler 3쪽 렌더링/전체 검토 | 실패 재현 | 3쪽 백지. 제품 PDF 내보내기 검증이 아님 |
| git diff --check·문서 상대 링크·대상 경로 확인 | 완료 | 제품 코드 diff 없음. 별도 일지와 리뷰 커밋 분리 |
| npm run typecheck/lint/build·전체 단위·다른 기능 E2E | 미실행 | 제품 TypeScript/설정/의존성을 바꾸지 않은 리뷰 문서 작업. 범위에 맞는 기존 자료 수합 검사를 수행 |
| 원격 Supabase 통합·실제 RLS/Storage·운영 로그인·실제 파기 | 미실행 | 사용자 요청이 로컬 데모/네트워크 없는 모의로 한정 |
| DB/Edge Functions/프런트엔드 운영 배포 | 해당 없음 | 변경/적용/운영 검증 없음 |

도구 작성 중 실제 UI의 “제목 필수” 접근성 이름, Playwright의 50MiB buffer 전달 제한, 도구의 모듈 문자열 작성, 동시성 barrier 누락을 수정했다. 초기 실패는 제품의 검사 실패로 분류하지 않았다. 최종 관찰 도구는 위 시나리오를 모두 완료했고 기존 테스트는 고치지 않았다. node_modules는 기존 설치를 전용 워크트리에 junction으로 연결했으며 버전/lockfile을 바꾸지 않았다.

## 후속 수정 작업 순서

1. D01 계정별 초안 격리, D03 요청 종류 서버 검증을 먼저 해결한다.
2. D04/D05/D07의 트랜잭션·예약 업로드·실패 정리를 함께 설계하되 각 실패 재현을 유지한다.
3. D06의 안정된 제출 식별·복구 계약과 D02의 학교 공용 IP 제한을 실제 사용자 흐름에 맞게 정한다.
4. D08~D13의 안내·상태·메모/이력·갱신·복구를 구현하고 교사/참여자 전체 흐름을 재검증한다.
5. D14~D17의 명단 재사용·출력·반응형·접근성을 보완한다. 관찰용 assertions를 수정 후 성공 계약으로 별도 작성하며 기존 결함 관찰 통과를 성공으로 재사용하지 않는다.

각 변경의 배포 여부는 secrets/DB/Edge Functions/프런트엔드를 나눠 기록해야 한다. 이 작업은 push·PR·main 병합·운영 배포를 포함하지 않는다.

## 문서·이력 관리 한계

README.md, DEVELOPMENT.md, 루트 AGENTS.md와 관련 코드·공통 규칙·테스트를 읽었다. 하위 AGENTS.md는 없었다. pro/ux-ui-expert.md와 저장소 바깥의 ../schooldoc-docs/development-history.md는 이 checkout 기준에서 없었다. 공유 checkout의 docs/development-history.md가 존재해 최근 기록을 읽기만 했으며 편집하지 않았다. 개인 개발일지는 [지정된 독립 파일](../../../docs/feature-review-data-collect-2026-10-01.md)에 기록한다.
