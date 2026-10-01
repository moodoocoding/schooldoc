# 등록부 서명 기능 리뷰 — 2026-10-01

제품 코드는 변경하지 않았다. 정상 과제는 수행할 수 있으나, 동명이인 식별·학교 공용 IP 한도·부분 저장 실패·검색 오류 후 이전 결과 선택·서명 파일 누락·경계 출력에 우선 수정이 필요하다. **기존 테스트 통과와 아래 결함의 미수정 상태를 구분한다.**

## 기준과 검증 범위

| 항목 | 내용 |
| --- | --- |
| 기준 커밋 | `c208afefca40bb4f15cab164fc292661e80fb9a0` |
| 브랜치 | `codex/feature-review-registry-20261001` |
| 전용 워크트리 | `C:/Users/panth/.codex/worktrees/review-registry-20261001/260812_schooldoc` |
| 전용 서버 | `http://127.0.0.1:4182`, Vite `--strictPort`; 공유 서버 미사용 |
| 브라우저 | 설치된 Google Chrome `154.0.8037.58`, Playwright 전용 context, headless |
| 화면 | 교사 1366×900, 참여자 390×844, 기존 E2E 360/768/1440px, CSS `zoom:2` 전체 캡처 |
| 자료 | 가상 0명·24명·30명 4열·41명·500명, 같은 이름/가려진 소속, 긴 이름 |
| 저장 | 명시적 `VITE_REGISTRY_DEMO_MODE=true`, 해당 context의 localStorage |
| 운영 UI 모의 | Chrome route가 **served `registryConfig.ts`만** `false`로 반환. Supabase 주소는 로컬 가짜 주소, 모든 API 응답을 route로 대체. 제품 파일은 그대로 유지 |
| 서버 모의 | 실제 TypeScript 함수 소스를 Node VM에서 실행. DB/RPC/Storage/Auth/암호화 대체. PostgreSQL 트리거 상태 변화는 SQL에 맞춰 모델링 |
| 미실행 | 원격 생성·제출·삭제, 운영 로그인, 실제 JWT/RLS/SQL 트랜잭션, Deno 타입 검사, 물리 기기·프린터, 운영 배포 |

[README](../../../README.md), [DEVELOPMENT](../../../DEVELOPMENT.md), [AGENTS](../../../AGENTS.md), 등록부 소스·마이그레이션·공통 암호화·보관 규칙·관련 단위/E2E/원격 테스트를 읽었다. 관련 하위 AGENTS는 없다. 외부 공유 일지 `../schooldoc-docs/development-history.md`와 `pro/ux-ui-expert.md`는 없었다. checkout의 [기존 공용 기록](../../../docs/development-history.md)은 참고만 했으며 수정하지 않았다. 추가 대화와 하위 에이전트를 만들지 않았다.

세 디자인 프로파일과 여섯 관점은 **동일 AI가 구분하여 수행한 모의 검토**다. 실제 전문가 6명·교사 인터뷰·승인·사용성 시험을 받은 결과가 아니다. 검토 요청이므로 제품의 1차/2차 구현은 하지 않고 수정 요구와 이후 검증 기준을 남긴다.

## 실제 사용자 워크플로우

| 단계 | 사용자의 과제와 현재 경로 | 관찰 결과 |
| --- | --- | --- |
| 교사 진입 | `/tools/registry-sign` → 목록/새 등록부. 실제 모드에서는 Google 인증 gate | 데모 빈 목록·예시 목록 정상. 실제 로그인 미실행. 서버 소유자 분기 모의 확인 |
| 기본 정보 | 사전 명단/현장 자율 입력 선택 → 제목·일시·장소 → 다음 | 빈 제목 차단. 수기 입력 후 이전/다음 보존. 생성 후 기본 정보 수정 UI 없음 |
| 명단 준비 | 소속 등 최대 4열 → 직접 입력/행 추가/표 붙여넣기/Excel 파일 | 수기 정상. 제목/빈 행/별칭 헤더가 있는 xlsx 24명 정상. 붙여넣기 헤더가 참석자로 들어가며 기존 명단 즉시 교체(R10) |
| 미리보기 | 1단 10/15명, 2단 20/30명 → 페이지 선택 | 500명은 50행씩 편집, 인쇄는 한 쪽씩 렌더. 생성 미리보기 하단 공간과 좁은 화면의 수평 이동 부담은 남음 |
| 공개 설정 | 명단 외 추가 허용·선택 비밀번호 → 생성 | 생성 시 설정 정상. 이후 수정/비밀번호 변경/토큰 재발급 UI 없음(R11) |
| 공유 | 관리 화면 QR·PNG 저장·링크 복사·새 창 열기 | QR PNG 1024×1024, 파일 저장·클립보드 값 확인. 데모는 동일 브라우저 저장소 한정이며 다른 기기 공유 아님 |
| 본인 찾기 | 공개 링크 → 필요한 비밀번호 → 이름 검색 → 본인 행 선택 | 오답 비밀번호 안내 정상. 동명+소속 마스킹 충돌(R1), 소속 검색 안내 불일치(R9), 검색 실패 후 이전 행 선택 가능(R4) |
| 서명 | 선택 → 추가 값(빈 값은 기존 값 보존) → 그리기/다시 쓰기 → 제출 | 모바일 폭 마우스 서명·실제 Chrome 터치 에뮬레이션/DPR3 좌표 정상. 제출 오류 시 잉크와 입력 보존. 부분 DB 실패는 이 복구로 해결 안 됨(R3) |
| 현장 입력 | 명단 외 또는 자율 입력에서 이름·소속 → 정보 확인 후 서명 → 제출 | 서명 창을 닫기만 해도 pending 행이 생성됨. 자율형 재진입 중복 경고가 없는 검색을 안내(R7) |
| 수정/재제출 | 참여자 완료 행은 선택 불가. 교사가 `재서명` → 확인 → 기존 서명 삭제 → 참여자가 다시 제출 | 취소 시 기존 서명 유지, 확인 후 재서명 성공. 참여자 스스로 수정하는 경로는 없음. 재서명은 원본 삭제 행동이므로 되돌릴 수 있는 편집과 다름 |
| 교사 현황 | 전체/완료/미서명, 이름/소속 필터, 참가자 추가·삭제, 서명 시각 | 정상 24명 1완료/23미서명 구분. 이미지 URL 누락을 완료 여부와 합쳐 잘못 미서명 처리(R5) |
| 서명 원본 | 미리보기의 서명 img → PDF 확인 | 원본 PNG를 증거로 보존·육안 확인. 관리 표에는 원본 열기/확대/개별 저장 행동이 없고 PDF 미리보기에 의존. 개선 후보 |
| 출력 | 레이아웃 선택 → Excel/PDF 다운로드; 브라우저 인쇄 별도 | Excel에 정확한 완료/미서명/시각. PDF 첫 쪽 정상, 데모 다중 PDF 중간 쪽 손상(R8), 긴 값 A4 잘림(R6), 브라우저 인쇄 실패(R8) |
| 종료/보관/파기 | 수합 종료 → 공개 제출 중단 → 다시 열기 또는 목록 삭제 | 종료/재개 정상. 삭제 수량/비가역 안내·취소·링크 무효화 정상(데모). Storage 삭제 재확인 함수 모의 정상. 등록부 보관 기간·종료 시점·예정 목록·파기 감사/재시도 기록 누락(R12) |

## 우선순위와 수정 순서

P1은 서명 대상/완료 상태의 정확성, 제출 가능성 또는 출력 내용 보존에 직접 영향을 주는 문제다. P2는 특정 복구/입력/출력 경로나 기능 설정의 공백이다. P3 개선 후보는 아래 디자인 평가에 분리한다.

| ID | 우선순위 | 발견 사항 | 확인 수준 |
| --- | --- | --- | --- |
| R1 | P1 | 동명이인 공개 행이 같은 표시로 합쳐져 본인 선택 불가 | 실제 Chrome 데모 + 운영 UI 모의 + 서버 소스 모의 |
| R2 | P1 | 같은 학교 IP의 24명 제출 중 14명이 60초 한도에 걸림 | 실제 함수 소스 + 모의 RPC, 원격 부하 미확인 |
| R3 | P1 | 서명 저장 후 항목 저장 실패: 500 뒤 재시도 409, 값 유실 | 실제 함수 소스 모의 장애 주입 |
| R4 | P1 | 검색 실패 후 다른 검색어의 이전 결과가 선택 가능 | 실제 Chrome 운영 UI 분기 + 모의 500 |
| R5 | P1 | 파일 URL/다운로드 실패를 미서명·빈 서명 PDF로 숨김 | 실제 repository/PDF 함수 소스 모의 |
| R6 | P1 | 4열·긴 값 2단 출력에서 이름/행/A4 하단 잘림 | 실제 Chrome PDF·전체 렌더; 서버 출력 일부 소스 모의 |
| R7 | P2 | 자율 입력 취소가 명단을 남기고 재진입 복구 경로 없음 | 실제 데모 취소 + 운영 UI 모의 중복 + 소스 |
| R8 | P2 | 데모 다중 PDF 중간 쪽 손상 및 브라우저 인쇄 실패 | 실제 Chrome 다운로드/인쇄 엔진·전체 PDF 렌더 |
| R9 | P2 | 운영 검색은 이름만, 안내는 소속도 가능하다고 표시 | 최신 SQL + 실제 Chrome 운영 UI 모의 |
| R10 | P2 | 붙여넣기 헤더를 참석자로 저장하고 기존 입력을 확인 없이 교체 | 실제 Chrome 입력/반영 |
| R11 | P2 | 생성 후 공개 설정/비밀번호/토큰 회수 변경 경로 없음 | 실제 생성/관리 화면 + 소스, 기능 공백 |
| R12 | P2 | 등록부가 공통 보관·예정 파기·감사/재시도 이력에 포함되지 않음 | 타입/SQL/설정 소스, 기능 공백 |

R1~R5를 먼저 고친 뒤 R6 출력 보존을 확인하고 R7~R12를 처리한다. 기존 마스킹을 완전히 제거하거나 전체 원문을 공개하여 R1을 해결하지 않는다. R2의 요청 제한 자체를 제거하지 않는다. R3의 실패를 성공 문구로 덮지 않는다.

## 문제별 재현·수정 요구·완료 기준

### R1 — 동명이인과 가려진 추가 정보로 본인 선택 불가

- **코드**: [registry-public](../../../supabase/functions/registry-public/index.ts) 166~201행(마스킹), 242~256행(검색 최대 10명); [RemotePublicRegistrySignPage](../../../src/features/registry/RemotePublicRegistrySignPage.tsx) 204~213행(행 표시, rowNumber 미표시); [SignatureDialog](../../../src/features/registry/SignatureDialog.tsx) 45행(이미 가려진 이름으로 확인).
- **재현**: xlsx에 `가상김하늘 / 가상학교 1반`, `가상김하늘 / 가상학교 2반`을 넣고 생성 → 공개 링크에서 이름 검색. 두 행 모두 `가***늘 · 가상**** · 선택`. 어느 쪽이 본인인지 알 수 없다. 운영 모의도 동일하며 서명 창에서도 원문을 확인할 수 없다. 10명 초과 동일 이름은 반환 상한/페이지 경로도 확인해야 한다.
- **증거**: [동명 모바일 전체](evidence/10-duplicate-names-mobile.png), [운영 모의 전체](evidence/25-mock-duplicate-names.png), [서버 관찰](evidence/server-observations.json) `server-masked-duplicate`.
- **영향**: 다른 참가자 행에 서명할 수 있고, 완료 후 참가자는 수정할 수 없어 교사에게 원본 삭제를 요청해야 한다. 대리 서명의 실제 발생을 주장하는 것은 아니다.
- **수정 요구**: 최소 정보로 확실히 구분하는 본인 확인 절차/교사가 안내할 개인 식별값 등을 설계하고 서버에서 확인한다. 동일 마스킹 결과는 무작위 행 선택으로 진행시키지 않는다. 검색 상한 밖 대상의 복구 경로도 제공한다.
- **완료 기준**: 같은 이름·같은 소속 앞부분·서로 다른 반의 2명/11명/20명에서 각자 자기 행만 선택하고 해당 ID에만 저장. 클라이언트 응답에 다른 사람의 원문/개인 링크를 늘려 노출하지 않음. 실패·이전·취소에서 기존 입력 보존.

### R2 — 학교 공용 IP의 행사 참여를 수용하지 못하는 제한

- **코드**: [registry-public](../../../supabase/functions/registry-public/index.ts) 30~35행(`search:30`, `walk-in:10`, `submit:10`), 64~77행(키=`ip:token:action`, 60초); [rate-limit SQL](../../../supabase/migrations/202608130001_registry_auth_and_public_api.sql) 233~279행.
- **재현**: 24개의 서로 다른 participant ID를 같은 IP·공개 토큰으로 같은 60초 창에서 제출. 실제 함수의 모의 RPC 결과는 `[200×10,429×14]`. 이름 검색 31회는 30회 성공·1회 제한. 정상 사용자 여러 명의 요청이 합산된다.
- **증거**: [서버 관찰](evidence/server-observations.json) `same-ip-24-submits`, `same-ip-31-searches`; [도구](server-probes.mjs). PostgreSQL의 실제 시간 창/비용/학교 네트워크는 미검증.
- **영향**: 교실·강당 Wi-Fi나 같은 전자칠판을 통한 수합이 멈추며 정상 재시도까지 한도를 쓴다.
- **수정 요구**: IP 전체·등록부·식별 참가자·실패한 추측을 구분하고 행사 규모를 수용하도록 조정한다. 제한 저장소 오류 시 fail-closed 동작은 유지한다. 남은 대기 시간과 잉크 보존을 UI에서 안내한다.
- **완료 기준**: 최소 60명 동시 참가의 조회·검색·제출·재시도 대표 부하가 정상 수용되고 한 사람의 추측/중복 요청은 제한. 시간 창 초기화·오류 차단·여러 토큰 경계가 독립 테스트로 확인됨. 원격 부하는 허용된 시험 환경에서 별도 검증.

### R3 — 부분 제출 실패가 영구 중복 차단 상태를 만듦

- **코드**: [registry-public](../../../supabase/functions/registry-public/index.ts) 311행(이미 signed 차단), 315~335행(Storage→서명 insert), 337~345행(그 뒤 복호화/암호화/항목 update); [상태 트리거](../../../supabase/migrations/202608130001_registry_auth_and_public_api.sql) 105~130행.
- **재현**: 정상 PNG와 수정 소속을 제출하고 마지막 항목 update만 실패시킨다. 파일 1개·서명 행 1개가 남고 트리거로 참가자는 signed. 응답 500 → 같은 내용으로 재시도 → 409 `이미 서명이 제출되었습니다`. 수정 소속은 저장되지 않았다. 행 생성 후 현장 정보 봉인 실패도 500과 빈 pending 행을 남긴다.
- **증거**: [서버 관찰](evidence/server-observations.json) `partial-submit-failure`, `partial-walkin-failure`. DB update 장애 및 트리거는 모의, 실제 DB 장애 실험은 하지 않았다.
- **영향**: 사용자에게 실패로 보이지만 실제 서명은 저장됨. 입력 항목과 서명이 불일치하고 정상 재시도로 복구되지 않는다.
- **수정 요구**: 봉인 준비를 저장 전에 완료하고 DB의 서명/값/상태 전환을 원자적으로 처리한다. Storage 보상 삭제의 실패도 추적한다. idempotency/저장 결과 확인으로 응답 유실과 실제 실패를 구분한다. 기존 signed 자료를 임의 덮어쓰지 않는다.
- **완료 기준**: 업로드·insert·봉인·update·응답 단절 각각의 장애 주입에서 완전 성공 또는 추적 가능한 미완료 상태. 재시도 후 서명/값 1건만 일치하며 남은 파일·행·이력을 확인. 가상 자료로 트랜잭션 검사를 추가.

### R4 — 검색 실패 뒤 이전 사람의 결과가 활성화됨

- **코드**: [RemotePublicRegistrySignPage](../../../src/features/registry/RemotePublicRegistrySignPage.tsx) 61~85행. 새 검색 시작에 `setSearching(true)`만 하고 실패에 `setSearchError`만 설정한다. 207~213행은 searching이 끝나면 기존 results 버튼을 다시 활성화한다.
- **재현**: `가상김하늘` 검색 성공 → `가상홍길동`으로 바꾸고 두 번째 요청에 500 반환 → 화면 입력은 홍길동이고 오류 안내 아래/위에는 김하늘의 결과 2개와 `선택` 버튼이 남는다. 버튼을 누르면 이전 참가자의 서명 창을 열 수 있다.
- **증거**: [전체 모바일](evidence/27-mock-stale-search-results.png), [Chrome 관찰](evidence/observations.json) `stale-search-on-error`.
- **영향**: 다른 검색어의 행을 현재 결과로 오인해 잘못 서명할 수 있음.
- **수정 요구**: 결과를 성공한 검색어와 함께 관리한다. 요청 시작/실패 시 이전 결과를 제거하거나 명확히 비활성으로 구분. 실패한 검색의 재시도와 입력 유지 제공. 초기 로딩 오류도 `등록부 없음`과 통신 실패를 구분하고 재시도 행동을 제공한다.
- **완료 기준**: 성공→다른 검색어 실패/지연/빠른 연속 입력/조회 취소에서 현재 검색어와 일치하는 최신 성공 결과만 선택 가능. 실패 후 재시도 정상. 잉크/추가 입력을 관련 없는 응답이 지우지 않음.

### R5 — 서명 파일 오류가 미서명 또는 빈 PDF로 숨겨짐

- **코드**: [registryRepository](../../../src/features/registry/registryRepository.ts) 134~175행: per-item signedUrl이 없으면 `signature` 자체를 없앰; [RegistryManagePage](../../../src/features/registry/RegistryManagePage.tsx) 72~73/108/259행: 객체 유무로 필터·완료 수·Excel 상태 계산; [registry-pdf](../../../supabase/functions/registry-pdf/index.ts) 197~219행: 다운로드/임베드 실패를 `continue`로 건너뜀.
- **재현**: participant.status=`signed`, signature 행이 존재하지만 signed URL 응답에 item error/null URL을 반환 → assemble 결과에 signature 없음. 교사 UI/Excel은 이를 미서명으로 해석한다. PDF의 Storage.download 실패를 주입 → 서명 map 0개, 오류 없이 계속 생성 가능한 반환. 현재 공개 UI는 draw만 쓰지만 기존 webp 파일도 PNG 임베드 경로에서 생략될 위험이 있다.
- **증거**: [서버 관찰](evidence/server-observations.json) `signed-status-lost-with-missing-url`, `pdf-missing-signature-silent`. 실제 Storage 실패를 발생시킨 것은 아니다.
- **영향**: 이미 제출한 사람을 미제출로 오인하거나 공식 출력물에서 서명을 누락. 성공한 다운로드가 완전한 등록부라는 보장이 없다.
- **수정 요구**: 제출 상태와 이미지 로딩 상태를 분리. 이미지 오류를 표시하고 URL 재발급/재조회 복구를 제공한다. PDF는 누락 건을 명시하고 완전성 확인 없이 성공 파일을 반환하지 않는다. 원본의 개별 확인/확대 경로도 제공한다.
- **완료 기준**: 정상/만료 URL/개별 item 오류/404/지원하지 않는 이미지에서 완료 수·Excel 상태는 DB 제출 상태와 일치. signed 파일 실패가 빈 서명 성공 PDF로 처리되지 않으며 재시도 후 원본 복구.

### R6 — 경계 데이터에서 A4 출력 내용 잘림·겹침

- **코드**: [RegistryPrintSheet](../../../src/features/registry/RegistryPrintSheet.tsx) 16~33행(고정 열 폭, 헤더 break-keep), 38~50행(내용 overflow-hidden), 83행(1123px 고정 A4); [registry-pdf](../../../supabase/functions/registry-pdf/index.ts) 76~97행(최소 글자 크기 이하로 줄이지 않고 drawText), 108행(헤더 두 줄만), [layout](../../../supabase/functions/registry-pdf/layout.ts) 66~72행.
- **재현**: 30명, `2단 30`, 추가 열 4개, 긴 열 이름·20자 이상의 성명·`가상학교 긴 추가항목 데이터 n`. 한 표 높이가 1044.90px(미리보기 배율 적용), 쪽 높이는 965.78px. 표 하단 4310.54가 쪽 하단 4081.78을 넘어감. 실제 내려받은 1쪽 PDF에서 12~15번/27~30번이 하단에서 잘리고 긴 성명과 열 제목은 겹치거나 잘린다.
- **증거**: [전체 관리 화면](evidence/19-boundary-four-columns.png), [PDF](evidence/registry-boundary-download.pdf), [전체 렌더](evidence/boundary-page-1.png), [치수](evidence/observations.json) `boundary-print-layout`.
- **서버 한계**: 운영 PDF 전체 렌더는 하지 않았다. 실제 drawCellText/헤더 함수를 모의 font로 실행했을 때 최소 크기에서 셀 폭 초과 텍스트를 그대로 draw하고 세 번째 헤더 줄을 버림을 확인했다. 모의 font의 82.5pt를 실제 Nanum 측정값으로 해석하지 않는다. 브라우저 미리보기는 세 줄 모두 표시하여 정보 구조도 다름.
- **수정 요구**: 행 높이와 페이지 배치를 고정하되 허용 값의 적절한 줄바꿈/줄수/폰트 정책을 적용한다. 정보 생략을 숨기지 않으며 열이 너무 많으면 안전한 레이아웃으로 안내한다. 미리보기와 운영 PDF의 헤더·표 규칙을 공유한다.
- **완료 기준**: 0/1/4열, 10/15/20/30명, 긴 성명 100자/항목 200자/열 50자/다중 헤더에서 모든 참가자 번호와 서명이 쪽 안에 보존. 셀·footer 겹침 없음. 미리보기·데모 PDF·운영 PDF의 같은 자료를 전체 렌더로 비교.

### R7 — 현장 자율 입력 취소 후 미서명 행으로 돌아갈 수 없음

- **코드**: [RemotePublicRegistrySignPage](../../../src/features/registry/RemotePublicRegistrySignPage.tsx) 135~153행(walk-in이 먼저 생성), 200행(fixed에만 검색), 235행(무조건 위 검색 안내), 242행(닫을 때 selected만 비움); [registry-public](../../../supabase/functions/registry-public/index.ts) 259~290행; [DemoPublic](../../../src/features/registry/PublicRegistrySignPage.tsx) 101~105행.
- **재현**: 자율 입력형에서 이름·소속 → `정보 확인 후 서명하기` → 서명 창 닫기. 데모 명단에는 pending 1행이 이미 생김. 다시 같은 이름으로 제출하면 데모에는 2행(미서명/완료)이 남는다. 운영 분기는 기존 pending 이름에 중복 경고를 반환하며 `위에서 이름을 검색`하라고 안내하지만 자율형에는 검색 입력 0개다.
- **증거**: [데모 명단](evidence/22-custom-cancel-and-submit-teacher.png), [운영 모의 전체](evidence/34-mock-custom-duplicate-no-search.png), `custom-cancel-leaves-participant`, `custom-duplicate-has-no-search`. 모의 중복 count를 반환했으며 운영 DB에 중복을 만든 것은 아니다.
- **영향**: 아직 제출하지 않은 사람을 명단 외 중복자로 처리하고 수합 인원을 부풀림. 자기 입력을 이어가려면 `동명이인으로 추가`라는 잘못된 행동을 선택해야 함.
- **수정 요구**: 서명 확정 시 행 생성 또는 서버 발급 임시 식별자로 본인 pending 행 재개. 이름만으로 다른 사람 pending을 반환하지 않는다. 취소·재접속·응답 유실에 재개 경로를 제공하고 custom/fixed 안내 분리. 중복 추가 확인창의 처리 중 버튼도 중복 실행을 막는다.
- **완료 기준**: 입력→닫기→재진입→서명, 저장 응답 유실/페이지 새로고침에서 본인 1행만 유지. 실제 동명이인은 별도 확인 후 추가 가능. `custom`에 존재하지 않는 검색 행동을 안내하지 않음.

### R8 — 다중 데모 PDF의 중간 쪽 손상, 브라우저 인쇄 잘림

- **코드**: [RegistryManagePage](../../../src/features/registry/RegistryManagePage.tsx) 185~250행(데모 html2canvas export), 217~242행(clone/viewport/페이지 처리), 428~434행(720px 내부 scroll·현재 쪽 렌더); [index.css](../../../src/index.css) 490~514/525~580행(미리보기 scale, print에서 화면 flow/scroll/transform 유지).
- **재현 A**: 24명 2단20 PDF 내려받기 → 파일은 A4 2쪽이지만 두 번째 쪽 제목·헤더·가로선이 없다. 41명 3쪽도 둘째 쪽 손상, 1·3쪽 정상. export DOM에서는 각 쪽 제목과 78px 균일 행이 존재하여 단순 데이터 부족이 아니다. **A는 데모 전용 분기**다. 운영은 registry-pdf를 호출한다.
- **재현 B**: 24명 관리 페이지에서 Chrome 인쇄 엔진으로 A4 PDF 생성(브라우저 Ctrl+P와 같은 print CSS 사용). 결과 4쪽: 첫 두 쪽 빈 쪽, 이후 표 일부만 출력. 1~20명의 현재 쪽만 DOM에 있고 21~24명은 렌더되지 않음. 축소 preview와 내부 scroll도 남아 있음. 실제 프린터에서는 시험하지 않았다.
- **증거**: [24명 다운로드](evidence/registry-download.pdf), [둘째 쪽](evidence/download-page-2.png), [41명 다운로드](evidence/registry-41-download.pdf), [41명 둘째 쪽](evidence/download-41-page-2.png), [브라우저 인쇄 PDF](evidence/registry-browser-print.pdf), [전체 인쇄 렌더 3쪽](evidence/browser-print-page-3.png), [4쪽](evidence/browser-print-page-4.png), [치수](evidence/output-observations.json).
- **영향**: 다운로드 성공/파일 수만 확인하는 기존 E2E로는 잘못된 출력물을 놓친다. 브라우저 인쇄는 전체 명단을 출력할 수 없다.
- **수정 요구**: export용 페이지를 숨은 부모 scroll/scale과 분리해 독립된 원본 크기로 캡처. 다중 페이지 전체 렌더를 검사한다. 브라우저 인쇄를 제공하려면 전체 페이지를 렌더하고 print에 layout/clip/transform을 초기화한다. 지원 범위를 UI에 명확히 표현한다.
- **완료 기준**: 1/2/3/50쪽에서 각 쪽 제목·헤더·표선·명단·쪽 번호 일치. Ctrl+P 경로에서 빈 쪽/누락/잘림 없음. PDF 버튼이 존재하는 것만으로 통과시키지 않음.

### R9 — 소속 검색 안내와 운영 계약 불일치

- **코드**: [최신 검색 SQL](../../../supabase/migrations/202608200001_registry_field_value_encryption.sql) 30~61행은 `participant.name ilike`만; [RemotePublicRegistrySignPage](../../../src/features/registry/RemotePublicRegistrySignPage.tsx) 203행은 `이름이나 소속을 두 글자 이상` 안내.
- **재현**: 이름 `가상김하늘`, 소속 `가상학교 1반` → 소속으로 검색. 최신 SQL 모델은 0명이며 Chrome 운영 UI 모의도 빈 결과. 이름 검색은 찾음. 데모는 항목 값까지 검색해서 이 차이를 숨긴다.
- **증거**: [소속 검색 빈 결과](evidence/24-mock-affiliation-not-found.png), `name-only-affiliation-search`, 최신 마이그레이션.
- **영향**: 안내대로 입력한 참여자가 자기 이름이 없다고 생각해 현장 중복 등록을 시도함.
- **수정 요구/완료 기준**: 암호화 항목을 평문으로 되돌리지 말고 이름 검색만 지원한다면 문구·placeholder·데모 계약을 일치시킨다. 소속 검색이 필요하면 별도의 안전한 검색 설계/서버 검증. 같은 가상 자료로 데모·운영 모의·허용된 서버 검사가 동일 결과를 보임.

### R10 — 붙여넣기 헤더가 참가자가 되고 입력 교체를 되돌릴 수 없음

- **코드**: [registryUtils](../../../src/features/registry/registryUtils.ts) 138~150행(마지막 셀=성명, 헤더 검사 없음); [RegistryCreatePage](../../../src/features/registry/RegistryCreatePage.tsx) 112~135행(기존 배열 교체), 357행(형식은 placeholder에만 안내).
- **재현**: 수기 1행을 채운 뒤, 안내와 같은 소속[TAB]성명 순서로 `소속\t성명\n가상학교\t가상홍길동` 붙여넣기 → 명단 반영. 첫 행 이름=`성명`, 두 번째=`가상홍길동`. 기존 수기 행은 확인창 없이 없어지고 붙여넣기 입력도 비워짐. 일반 성명→소속 순서를 붙이면 이름이 소속으로 바뀌는 추가 위험이 있다.
- **증거**: [전체 생성 화면](evidence/03-paste-header-imported.png), `paste-header-and-replacement`(2행, confirm=0). xlsx 헤더 매핑은 정상으로 확인했다.
- **수정 요구**: Excel 파일 경로의 공통 헤더 인식을 재사용하거나 열 매핑/미리보기 제공. 추가/교체를 명시하고 데이터 있는 교체는 확인/되돌리기 제공. 헤더·열수 불일치·성명 비어 있음에 검증 결과를 설명한다.
- **완료 기준**: 헤더 포함/없음·성명 앞/뒤·빈 셀·반복 헤더·기존 입력 상황에서 사람만 가져오고 확인/취소/되돌리기 가능. 동일 자료의 xlsx와 붙여넣기 결과 일치.

### R11 — 생성 후 공개 설정·비밀번호·토큰 회수 경로 없음

- **코드**: [RegistryCreatePage](../../../src/features/registry/RegistryCreatePage.tsx) 403~444행은 생성 단계 설정; [RegistryManagePage](../../../src/features/registry/RegistryManagePage.tsx) 109/327/335행은 기존 링크·보호 상태 표시만; [repository](../../../src/features/registry/registryRepository.ts) 299~321행에는 비밀번호/allowWalkIn update 지원이 있으나 UI에서 호출하지 않음.
- **재현/증거**: 보호 비밀번호와 명단 외 추가=true로 생성 → 관리 페이지 전체 [공유 영역/명단/내보내기](evidence/08-teacher-24-pending-desktop.png)에서 수정 메뉴가 없음. 수합 종료/다시 열기는 같은 토큰을 재사용. 토큰 재발급 action도 없음.
- **영향**: 잘못 정한 설정, 유출된 비밀번호/QR을 교사가 회수·변경하기 위해 종료/삭제/새 문서 생성에 의존. 실제 유출을 발견한 것은 아니다.
- **수정 요구**: 소유 교사에게 공유 설정 편집과 비밀번호 변경/해제, 공개 토큰 재발급을 제공한다. 제출 자료를 보존하고 이전 링크 중지 범위를 구체적으로 확인시킨다. 생성 후 제목/표 수정은 받은 서명의 의미를 바꾸지 않는 별도 정책을 먼저 결정한다.
- **완료 기준**: 기존 서명 보존한 상태에서 추가 허용 on/off·비밀번호 교체/해제·토큰 재발급 가능. 이전 비밀번호/토큰의 서버 거절·새 QR PNG 다운로드·다른 교사 거절을 검사. 실제 운영 테스트는 승인된 환경에서 수행.

### R12 — 등록부 보관·예정 파기·감사/재시도 기록 공백

- **코드**: [Registry/types](../../../src/features/registry/types.ts) 26~45행에는 보관 기간/종료 시점 없음; [등록부 SQL](../../../supabase/migrations/202608120001_registry_sign.sql) 3~19행에는 예약 `closes_at`만 있고 `closed_at`/retention 없음; [privacyRetentionSettings](../../../src/features/settings/privacyRetentionSettings.ts) 124~155행은 consent/data-collect/missions만 목록에 포함. [deleteRemoteRegistry](../../../src/features/registry/registryRepository.ts) 323~330행은 Storage 확인 후 행 삭제하되 감사/영속 재시도 기록 없음.
- **재현/확인 수준**: 등록부 종료 시 `status`만 바뀐다. 전체 마이그레이션·설정의 등록부 보관 계약이 없음을 소스로 확인했다. 원격 자료나 실제 장기간 경과/삭제 실험은 하지 않았다.
- **정상 부분**: 삭제 전 인원/서명 수·되돌릴 수 없음 안내와 Storage 제거 후 재목록 확인은 존재한다. `delete-verifies-storage-removal` 모의에서 remove가 성공처럼 응답해도 파일이 남으면 중단, 재시도에서 제거했다.
- **수정 요구**: 새 등록부의 보관 기본값 스냅샷, 종료 시점, 기간 도래 목록, 교사의 명시 동의, Storage 먼저 삭제·실제 확인·DB 삭제, 개인정보 없는 감사/실패 재시도 기록을 같은 생명주기로 연결한다. 기존 업무에 기간을 소급하지 않고 진행 중 업무를 파기하지 않는다.
- **완료 기준**: 새/기존 등록부·진행/종료/재개 상태에서 예정일이 일관됨. 파기 대상/수량 확인 및 동의 없이는 실행 불가. 파일 실패 시 행과 재시도 기록 보존, 완료 후 링크/원본 제거 확인, 로그에 이름/제목/파일명 없음. 실제 RLS·Storage·감사 기록은 시험 환경에서 별도 검증.

## 10개 휴리스틱 평가

| 휴리스틱 | 판정 | 워크플로우 근거와 수정 방향 |
| --- | --- | --- |
| 1. 시스템 상태 가시성 | 수정 필요 | 정상 미서명/완료/수합 종료 텍스트와 수량은 명확. 파일 상태를 제출 상태로 합침(R5), 부분 성공을 실패로 표시(R3) |
| 2. 실제 세계와의 일치 | 수정 필요 | 교사의 등록부·소속·일시·서명 용어 자연스러움. 학교 IP 집단 참여와 자율형 재방문을 모델링하지 못함(R2/R7) |
| 3. 사용자 제어와 자유 | 수정 필요 | 생성 이전/다음·서명 지우기·대화상자 취소·교사 재서명 정상. 가져오기 교체 복구·공유 설정 수정 공백(R10/R11) |
| 4. 일관성과 표준 | 수정 필요 | 버튼·필터·확인창 이름은 일관. 데모 소속 검색/운영 이름 검색 불일치, preview/서버 PDF 헤더 줄수 차이(R9/R6) |
| 5. 오류 예방 | 수정 필요 | 필수 제목/빈 명단 차단·삭제 수량·중복 제출 서버 확인 존재. 동명 행과 이전 검색 결과 선택 가능(R1/R4) |
| 6. 기억 대신 인식 | 수정 필요 | 이름 검색은 부담이 적으나 같은 마스킹 결과를 구분할 근거 없음(R1). 자율형 중복 경고가 없는 검색을 요구(R7) |
| 7. 유연성과 효율 | 조건부 통과 | 수기·Excel·붙여넣기·50행/한 쪽 렌더 정상. 대량 수합 한도(R2), QR 블록 아래 현황/출력까지 긴 이동 개선 후보 |
| 8. 심미성과 최소주의 | 수정 필요 | 목록·요약·표 위계 안정. 생성 preview의 남는 공백, 200% 필터 문구 세로 줄바꿈, 4열 출력 밀도 문제(R6) |
| 9. 오류 인지·진단·복구 | 수정 필요 | 비밀번호/서명 오류와 입력 유지 정상. 실제 부분 성공/이미 제출/파일 누락·stale search의 올바른 복구 부족(R3/R4/R5) |
| 10. 도움말과 문서 | 수정 필요 | 명단/공유/재서명 설명 존재. 소속 검색·자율 중복 안내 잘못됨(R7/R9), 보관·공유 설정 회수·인쇄 지원 범위 설명 부족(R8/R11/R12) |

## 세 디자인 프로파일: 검토 전 판단과 검토 후 근거

| 관점 | 검토 전 가설 | 검토 후 판정·근거 | 남은 위험 |
| --- | --- | --- | --- |
| [웹디자인](../../../pro/web-designer.md) | 단계/표/QR/출력의 우선순위와 0·24·500명의 밀도를 전체로 확인해야 함 | **수정 필요**. 24명/500명 명단은 한 폭에 균형 있게 배치. 생성 preview는 page 1010.70px 대비 region 1163px로 남는 공간, 모바일 하단 큰 공백. 4열 출력은 제목 겹침·쪽 밖 행 | 실제 교사 화면 선호·전자칠판 거리 가독성 미시험 |
| [UX](../../../pro/ux-designer.md) | 입력→본인 선택→서명→수정→출력·파기를 이어서 완료하는지 확인 | **수정 필요**. 정상 과제/취소/교사 재서명 완료. 동명 식별과 자율형 pending 재개 불가, 오류 뒤 다른 사람 결과 남음. 보관/파기 생명주기 빠짐 | 실제 참여자/교사의 실수 빈도·현장 부하 미확인 |
| [UI](../../../pro/ui-designer.md) | 포커스·44px 목표·상태 텍스트·모바일·200%·인쇄를 별도로 확인 | **수정 필요**. 대화상자 focus trap/Esc/복귀·axe 위반 0, 공개 버튼 터치/잉크 지우기 정상. 200% 교사 필터 글자가 세로로 좁아지고 관리 아이콘 36px는 44px 목표 미달. 출력 잘림 | CSS 확대는 Chrome 메뉴 확대와 동일 시험 아님. 실제 스크린리더·물리 휴대전화/프린터 미확인 |

## 여섯 독립된 AI 모의 관점

각 행은 다른 평가 질문으로 같은 전체 화면·대표 자료를 검토한 판단이다. 사람 6명/여섯 독립 실행 에이전트가 참여한 것이 아니다.

| 모의 관점 | 판정 | 전체 화면·대표 자료 근거 | 수정 요구/이후 확인 |
| --- | --- | --- | --- |
| 웹 1 — 정보 위계 | 수정 필요 | [24명 관리 전체](evidence/13-teacher-mixed-desktop.png): 전체/완료/미서명 요약은 상단. 공유 QR의 큰 높이 아래에 실제 대상 표, 출력은 명단 하단 | 수합 중에는 미완료자·새 응답이 주 작업이 되도록 공유 영역 접기/표 이동 단축 검토. QR을 보여줄 명확한 공유 모드 유지 |
| 웹 2 — 화면 밀도/빈 공간 | 수정 필요 | [500명 전체](evidence/20-teacher-500-last-page.png)는 50행 페이지로 제어, 좌우 열 불균형은 없음. [생성 모바일 preview](evidence/32-create-preview-mobile.png)는 원본 차지 높이를 scale이 줄이지 않아 큰 하단 공간 | 생성 preview도 관리 화면의 scale/frame 규칙 재사용·fit 선택. 0/24/500명과 4열 자료로 2차 전체 캡처 |
| UX 1 — 참여자 흐름 | 수정 필요 | [동명](evidence/25-mock-duplicate-names.png), [stale search](evidence/27-mock-stale-search-results.png), [자율형 경고](evidence/34-mock-custom-duplicate-no-search.png)에서 본인/다음 행동 불명확 | R1/R4/R7 우선. 비밀번호/오류/재시도/이탈 후 복구를 하나의 과제로 반복 |
| UX 2 — 교사·교실/전자칠판 흐름 | 수정 필요 | [QR+현황 전체](evidence/08-teacher-24-pending-desktop.png), R2의 같은 IP 24명 모의. QR을 공개할 때 교사 전체 이름표가 같은 관리 문서 아래에 있어 화면 스크롤 시 공개 범위 주의가 필요 | 교실 공유용 QR/제목 전용 보기와 관리 복귀 검토. 교사가 실제 장비에서 거리를 두고 읽는 시험은 판단 보류. 이번 1920px 전자칠판 물리 시험 미실행 |
| UI 1 — 접근성/키보드 | 조건부 통과 | 기존 axe/E2E 및 직접 Enter/Tab/Esc: 닫기 초기 focus, 대화상자 내 이동, 삭제 취소 안전 focus·복귀 정상. canvas는 Tab 대상이 아니며 그리기를 제외한 조작 가능 | 44×44px 관리/삭제 아이콘 목표 보완. 손그림은 경로 입력이라 자동으로 키보드 WCAG 위반으로 단정하지 않음; 교사 보조 등 대체 업무 처리와 실제 보조기술 시험 필요 |
| UI 2 — 반응형/상태/출력 | 수정 필요 | [교사 모바일](evidence/14-teacher-mixed-mobile.png), [CSS200](evidence/15-teacher-css-200.png), [공개 CSS200](evidence/16-public-css-200.png), [터치](evidence/35-touch-signature-mobile.png): 공개 흐름 리플로우/서명 정상. 관리 표는 내부 가로 이동, 4열 A4 경계 실패 | 필터/레이아웃 문구를 좁은 열에 압축하지 않음. R5/R6/R8 완료/오류/파일 상태와 인쇄 완전성 재검증 |

## 정상 확인된 흐름과 측정 해석

- 제목 필수·수기 명단·이전/다음 입력 보존·별칭 헤더 Excel 24명 가져오기·생성·비밀번호 오답/정답·QR PNG·링크 복사·서명·관리 완료 현황·Excel·교사 재서명 취소/확정·종료/재개·데모 삭제 후 링크 중지까지 실제 Chrome에서 수행했다.
- 정상 첫 쪽 PDF는 제목·일시·장소·양단 명단·서명·쪽 번호가 읽히며 서명은 셀 안에 있다. 다중/경계 출력의 실패 때문에 PDF 전체 통과로 보고하지 않는다.
- 500명 명단은 관리 표 50행, 인쇄 DOM 1쪽, 마지막 참가자와 17번째 인쇄 쪽 선택을 확인했다. 500명 전체 PDF 내보내기는 실행하지 않았다. 실제 최대 서버 createMany 2,000명의 브라우저 과제는 미실행이며 소스 제한만 확인했다.
- 모바일 390px 서명: 대화상자 전체 캡처, 화면 방향 변경 후 잉크 존재, 저장 원본 유지. Chrome 터치 에뮬레이션 DPR3에서 canvas 942×570, ink 3503px, 좌표 범위 x184~522/y223~346, 캔버스 드래그의 문서 scroll 변화 없음, 다시 쓰기 후 제출 비활성. 물리 모바일 시험은 아니다.
- 키보드로 검색 행 Enter, 대화상자 Tab trap/Esc/복귀, 삭제 확인 취소 초기 focus/Esc/복귀를 검증. canvas에 키보드로 손그림을 그렸다고 보고하지 않는다.
- 기존 E2E axe와 추가 teacher/dialog/운영 public 모의 axe에서 위반 0. 자동 검사와 키보드 확인은 포함했으나 스크린리더 발화 전체/일반 사용자 시험은 하지 않았다.
- 교사 관리/공개 CSS200 documentWidth는 viewport와 같다. 생성 명단의 fullPage 스크린샷은 documentWidth 748px로 오른쪽 공백이 잡혔으나 [실제 390px viewport](evidence/30-create-mobile-viewport.png)와 [표 이동](evidence/31-create-mobile-table-scrolled.png)을 추가 확인했다. parent는 clientWidth326/scrollWidth740/scrollLeft300인 의도된 가로 표이며 `sr-only` 절대 위치가 바깥 scrollWidth에 기여한다. 이를 실제 모든 버튼이 화면 밖으로 사라지는 기능 실패로 과장하지 않았다.
- 공개 API의 잘못된 토큰400/비밀번호401/종료409/다른 등록부 참가자404/잘못된 이미지400/중복409, 교사 미인증401/다른 소유자 쓰기403/읽기 빈 결과/암호화 미설정503, rate-limit 확인 오류 차단을 **소스 모의**로 확인했다. DB의 owner RLS·private Storage·PDF owner 조건은 읽었다. 실제 JWT/정책 적용 확인은 별도다.
- 서명 제출 오류500 화면에서 추가 값과 잉크가 유지되고 모의 재시도200은 성공했다. 이 정상 복구가 R3의 실제 저장 완료 후500/409 상태까지 해결한다는 뜻은 아니다.

## 실행 도구와 재현 방법

기존 의존성을 전용 워크트리의 무시되는 node_modules junction으로 재사용했다. 공유 checkout/의존성 파일을 수정하거나 설치하지 않았다. 초기 PowerShell `npm run dev -- ...` 인자가 잘못 전달되어 Vite가 종료됐고, 아래 직접 CLI로 정상 시작했다. `agent-browser` 실행 파일이 없어 사용자 요청에서 허용한 Playwright로 전환했다.

```powershell
$env:VITE_REGISTRY_DEMO_MODE='true'
$env:VITE_PUBLIC_APP_URL='http://127.0.0.1:4182'
$env:VITE_SUPABASE_URL='http://127.0.0.1:4182/mock-supabase'
$env:VITE_SUPABASE_ANON_KEY='local-review-placeholder'
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4182 --strictPort
```

별도 터미널에서 워크트리 루트를 cwd로 실행한다. 이 도구들은 자신의 evidence 파일을 갱신하며 다른 세션/제품 파일을 변경하지 않는다. `observe.mjs`의 결함 관찰 기대값이 통과해도 제품 결함을 고쳤다는 뜻이 아니다.

```powershell
node design/feature-reviews/2026-10-01-registry/observe.mjs
node design/feature-reviews/2026-10-01-registry/output-probes.mjs
node design/feature-reviews/2026-10-01-registry/touch-probes.mjs
node design/feature-reviews/2026-10-01-registry/server-probes.mjs
node node_modules/@playwright/test/cli.js test --config design/feature-reviews/2026-10-01-registry/playwright.review.config.ts
node node_modules/vitest/vitest.mjs run tests/unit/registryUtils.test.ts tests/unit/registryReviewFixes.test.ts tests/unit/registryPdfLayout.test.ts tests/unit/registryBackup.test.ts
```

서버 probe는 signature-original.png를 사용하므로 observe를 먼저 실행한다. 모의 서버가 지연/실패 계약을 만드는 곳과 실제 소스 실행 부분은 각 도구 주석에 명시했다. PDF는 Poppler 전체 페이지 PNG, pypdf 페이지 수/A4 크기를 확인했다. 운영 PDF 폰트 모듈 `@pdf-lib/fontkit`과 Deno가 이 실행 환경에서 없으므로 운영 PDF 전체 생성은 미실행이다.

## 검증 결과·한계

| 검사 | 결과 |
| --- | --- |
| 실제 Chrome 초기 로딩/overlay/pageerror | 통과, 의미 있는 목록/관리/공개 화면, 초기 pageerror 0 |
| 추가 Chrome 관찰 도구 | `observe.mjs`, `output-probes.mjs`, `touch-probes.mjs` 완료. [관찰 JSON](evidence/observations.json), [출력 JSON](evidence/output-observations.json), [터치 JSON](evidence/touch-observations.json). observe pageerror 0. 결함은 미수정 |
| 기존 등록부 E2E | **9/9 통과**, 전용 config, 전용 4182 데모. [JSON 결과](evidence/e2e-results.json). 원본 테스트 미수정 |
| 등록부 단위 | **4파일 36개 통과**, registryUtils/registryReviewFixes/registryPdfLayout/registryBackup |
| 서버 probe | 완료, [모의 JSON](evidence/server-observations.json). 결함 조건과 정상 거절/Storage 제거 확인을 함께 검사. PostgreSQL/Deno 통과 의미 아님 |
| 관찰 도구 구문 | `node --check`로 observe/output-probes/server-probes/touch-probes 확인 |
| 출력 | 24명 PDF 2쪽·41명 PDF 3쪽·경계 PDF 1쪽·브라우저 인쇄4쪽을 전체 렌더/육안 확인. 첫 쪽 정상, R6/R8 실패. QR PNG·Excel 실제 다운로드 |
| typecheck/lint/전체 단위/build | 미실행: 제품/빌드 설정/의존성 변경 없는 리뷰 문서 작업. 관련 기존 검사와 관찰 도구 구문만 실행 |
| 서버 타입/실제 SQL/RLS/Storage | 미실행: Deno 없음, 원격 쓰기 금지. 가짜 Auth/DB 계약은 운영 보안 검증을 대신하지 않음 |
| 원격 integration | 테스트의 생성·제출·삭제·rate-limit 소모 코드를 읽고 미실행. 시험 자료/환경 미승인 및 이번 요청의 원격 쓰기 금지 |
| 실제 Google 로그인/기기 간 공유/휴대전화·프린터/교사 시험 | 미실행. 설치 Chrome의 로컬 과제와 모바일 에뮬레이션만 수행 |
| 문서 링크/증거 경로/공백 diff/커밋 범위 | 완료 시 직접 검증. 제품 diff 없이 리뷰 폴더와 독립 일지만 포함 |

관찰 도구의 초기 실행은 중복 label selector에서 중단되었고, 서버 probe 초기 모의 데이터에 registry_id/레이아웃 helper가 빠져 중단되었다. 도구와 모의 fixture만 고쳐 최종 실행을 완료했다. 이를 제품 결함이나 제품 수정으로 계산하지 않았다. 원본 테스트를 고치지 않았다.

## 증거와 인계 경계

[evidence](evidence/)에는 이름/학교/비밀번호까지 가상인 자료만 있다. 운영 .env·키·JWT·학생/학부모 자료를 읽어 내보내거나 커밋하지 않았다. 화면 캡처는 전체 페이지이며 작은 영역 캡처로 디자인 판정을 대체하지 않았다. 내려받은 파일은 QR/Excel/PDF와 원본 서명 PNG이고 PDF 전체 렌더도 남겼다.

이번 변경은 리뷰 문서/관찰 도구/가상 증거뿐이다. 리뷰 자료와 [독립 개발일지](../../../docs/feature-review-registry-2026-10-01.md)는 서로 다른 목적의 로컬 커밋으로 남긴다. GitHub push·PR·main 병합은 미실행. DB·Edge Functions·프런트엔드 운영 배포는 **해당 없음**. 모든 R1~R12는 현재 미수정이며, 수정 에이전트는 위 완료 기준에 따라 정상·경계·실패 경로를 다시 확인해야 한다.
