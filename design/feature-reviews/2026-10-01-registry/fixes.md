# 등록부 서명 수정·DB I/O 최적화 결과 — 2026-10-01~02

등록부 목록·진행 업무는 요약만 읽고, 관리 화면은 소유자 스냅샷과 현재 미리보기의 서명 이미지를 나누어 읽도록 수정했다. 서명 저장은 항목 값·서명 기록·완료 상태를 하나의 SQL 트랜잭션에서 처리한다. [기존 리뷰](review.md)의 R1~R12에 대한 코드 변경과 실제 Chrome 검증을 아래에 기록한다.

실제 설치 Chrome에서 화면을 조작했고, 다운로드와 Chrome 인쇄 엔진의 출력물을 확인했다. 이 브라우저 검증의 저장소는 **로컬 데모 저장소**다. Docker가 없어 사용자가 선택한 전체 로컬 Supabase는 실행하지 못했다. PostgreSQL 검사는 PGlite의 실제 PostgreSQL WASM 엔진·pgcrypto로 수행했으며, Edge 계약 검사는 DB·Storage 전송을 대체했다. 이 세 검증을 실제 Supabase 통합 검증으로 합쳐 보고하지 않는다.

## 작업 범위

| 항목 | 내용 |
| --- | --- |
| 기준 제품 코드 | `c208afefca40bb4f15cab164fc292661e80fb9a0` |
| 작업 브랜치 | `codex/fix-registry-io-20261001` |
| 작업 위치 | 이 대화에 붙인 전용 관리 워크트리. 공유 checkout과 다른 작업의 변경은 보존 |
| 변경 | 등록부 프런트엔드·공개/소유자/PDF Edge 함수·신규 SQL 마이그레이션·진행 업무의 등록부 요약·등록부 보관 설정·관련 테스트·문서 |
| 자료 | 가상 명단, 가상 서명 획. 운영 계정·키·학생 자료 미사용 |
| UI 확인 | 설치 Chrome의 실제 탭(CUA), 별도 Chrome Playwright context, 데스크톱·모바일·키보드·CSS 200% 확대 |
| 배포 | DB·Edge Functions·프런트엔드 모두 **미적용**. GitHub push·PR·main 병합 미실행 |

## 최종 설계와 I/O 경계

| 경로 | 변경된 읽기/쓰기 | 남은 비용·한계 |
| --- | --- | --- |
| 목록·진행 업무 | `registry_owner_summaries()`로 제목·상태·인원 집계만 반환. 명단·암호문·서명 URL을 가져오지 않음 | 집계 시 DB는 해당 소유자의 참석자 행을 읽는다. 집계 캐시나 서버 페이지네이션은 추가하지 않음 |
| 상세 | `registry-participants`의 `snapshot` → 소유자 검사 포함 `registry_owner_snapshot()` 한 번으로 관련 자료를 JSON 집계. REST 기본 1000행 절단을 피함 | 상세 명단은 여전히 전체를 읽고 복호화한다. 참석자 서버 페이지네이션은 후속 후보 |
| 서명 이미지 | 현재 인쇄 미리보기 쪽만 signed URL 일괄 발급. 1시간 URL을 컴포넌트 메모리에서 50분 재사용, 영구 저장하지 않음 | 전체 인쇄·PDF를 요청하면 필요한 전체 이미지를 준비한다. 이미지 실패 시 재시도 필요 |
| 변경 반영 | 상세 Realtime 구독을 등록부 ID로 한정. 서명 테이블 구독 제거. 첫 이벤트부터 350ms 동안 묶어 갱신. 읽기 중 이벤트는 완료 후 한 번 재조회 | 목록 구독은 소유자의 관련 INSERT/UPDATE를 받는다. DELETE는 서버 필터가 없어 제외하며 자기 삭제·재진입·탭 복귀·재연결로 보정. 다른 탭의 삭제는 즉시 반영되지 않을 수 있음 |
| 공개 검색 | 두 글자 이상, 버튼/Enter로 명시 조회, 최대 20명. 검색어 변경 시 이전 결과 즉시 비움 | substring 검색은 등록부 내 행을 읽는다. 실제 운영 쿼리 계획·IOPS는 측정하지 않음 |
| 최종 제출 | 공개 조건 조회 후 시도별 파일 업로드, 한 완료 RPC에서 항목 암호문·서명·완료 상태 저장. 동일 요청 재전송은 기존 결과 재사용 | Storage와 PostgreSQL 사이의 분산 트랜잭션은 없다. 응답 유실 확인·시도 파일 정리·재시도 기록으로 복구 |
| 제한 카운터 | 요청별 전체 정리 제거. 소유자 상세 조회 때 isolate당 최대 10분 간격으로 1일 지난 카운터 최대 1000개 정리 | 남용 방지 카운터 쓰기는 유지. 여러 isolate에서는 각자 정리할 수 있음. 무인 cron은 추가하지 않음 |
| 보관·파기 | 예정 목록은 최소 집계 RPC. 명시적 파기 확인 때만 실제 Storage 목록을 읽고 수량 확인·삭제 재확인 | 파기는 교사의 확인이 필요하고 전체 Storage 순회 비용이 듦. 진행 중 업무는 파기 차단 |

이 변경은 불필요한 전송·URL 발급·중복 재조회를 줄이는 구조 개선이다. 실제 Supabase의 디스크 I/O·egress·요금 감소율을 측정하거나 특정 절감률을 보장하지 않는다. 기존 전체 명단 API는 호환용으로 남았지만 목록·진행 업무 화면은 호출하지 않는다.

## R1~R12 구현과 확인 수준

| ID | 최종 변경 | 검증·남은 범위 |
| --- | --- | --- |
| R1 | 동명이인은 원래 성명+등록 항목이 유일하게 일치해야 제출. 교사가 발급한 6자리 확인 코드로도 검색·제출 가능. 서버는 bcrypt digest만 보관하고 공개 응답은 마스킹 유지 | 실제 Chrome에서 동일 표시 2명을 각 코드로 구분하여 해당 행에 제출. PostgreSQL 코드 실패 제한·digest 비노출, Edge 계약의 중복 원문 거절 확인. 11/20명 각각의 전체 브라우저 시나리오와 실제 Auth 연동은 미실행 |
| R2 | 학교 공용 IP 기본 한도는 검색/metadata 360, 제출/해제/현장 확인 180회/분. 비밀번호 실패 10회, 코드 실패 12회, 개별 참석자 제출 12회 제한은 별도 유지 | 실제 SQL에서 같은 IP의 서로 다른 60명 제출 context 허용 및 개인·실패 제한 확인. 다중 DB 연결·실제 네트워크 동시 부하 미검증 |
| R3 | 원자적 완료 RPC, 참석자 버전 확인, 동일 request/hash/digest 재시도 성공, 변경된 재시도 409. 각 HTTP 시도 파일 경로를 분리하여 실패 시 자기 파일만 정리. 응답 유실은 저장 사실 확인 후 처리 | PostgreSQL 예외 주입으로 값·서명·상태 동시 rollback, 동일 재시도/변경 재시도 확인. Edge 실제 handler/AES-GCM + 대체 DB/Storage로 실패 정리·응답 유실·중복 업로드 방지 확인 |
| R4 | 검색어/코드 변경·요청 실패 때 후보를 지우고 요청 버전으로 늦은 응답 무시 | 실제 Chrome 검색어 변경 시 이전 후보 제거. 원격 API와의 실제 지연·오류 통합은 미검증 |
| R5 | DB 완료 여부와 이미지 가용성을 분리. URL/이미지 실패는 완료 표시를 유지하고 재시도 안내. 서버 PDF는 완료 기록 불일치·이미지 누락/손상 시 실패로 반환 | 관련 단위 검사·서버 타입 검사·소스 검토. 실제 Supabase Storage 실패, signed URL 갱신, 서버 PDF 전체 생성은 미검증 |
| R6 | 프런트엔드/서버 공유 pt 단위 출력 계획. 모든 문자를 보존해 줄바꿈·헤더·행 높이 계산, 긴 값에 맞게 쪽당 인원 조정. 추가 항목 3열 이상은 2단 선택이어도 1단 적용. A4에 한 행도 못 들어가면 출력 차단 | 실제 Chrome 4개 추가 열·150자 긴 셀의 한 단 변환·셀/페이지 넘침 검사 및 전체 캡처. 공유 계획 단위 검사. 실제 서버 폰트/PDF 생성은 미검증 |
| R7 | 현장 입력 확인은 가상 참석자만 만든다. 최종 서명에서 참석자+항목+서명을 저장. 마스킹 응답 대신 사용자 입력 원문을 서명 창에 유지 | CUA와 Chrome E2E에서 취소 시 0행 추가, 최종 제출 시 정확히 1행·원문 유지. 실제 SQL에서 preview 0쓰기·최종 원자적 생성 확인 |
| R8 | 데모 PDF 각 페이지를 별도 원본 iframe에서 캡처. 전체 인쇄는 원본 전 페이지를 준비. Chrome 메뉴 인쇄에도 `beforeprint`에서 body 직속 원본을 렌더하고 A4·0여백 적용 | CUA PDF 다운로드·QR PNG 저장. Chrome 인쇄 엔진의 41명 A4 3쪽 확인. 내려받은 PDF와 Chrome PDF 각각 3쪽 모두 렌더·육안 확인. Ctrl+P 앱 준비는 확인했으나 네이티브 인쇄창 조작·물리 프린터는 미검증 |
| R9 | 공개 화면 안내를 실제 조건인 ‘이름 검색’으로 통일 | 실제 Chrome 라벨·검색 조작 및 회귀 검사 |
| R10 | 붙여넣기에 기존 Excel 헤더/별칭 파서 재사용. 빈 셀 보존. 반영 전 5행·수량 미리보기, 추가/교체 선택, 취소, 직전 가져오기 되돌리기. 공통 dialog focus trap/Esc/복귀 | 실제 Chrome 취소·추가·되돌리기·Tab/Esc/포커스 복귀. 기존 Excel 가져오기 회귀 통과 |
| R11 | 관리 화면의 접을 수 있는 ‘공유·보관 설정’에서 명단 외 추가·비밀번호 변경/제거·공개 토큰 재발급. 재발급 확인과 기존 QR/링크 무효화 | Chrome에서 설정 변경·이전 링크 차단·파기 확인 취소. 실제 SQL 토큰 회수 확인. 실제 원격 비밀번호 변경·JWT 연동은 미검증 |
| R12 | 새 등록부 보관 기본값만 적용, 기존 미설정은 유지. 종료 시점 기록·재개 시 초기화. 공통 파기 예정 목록 포함. 종료 자료만 수량 확인 후 파기 잠금→Storage 제거/잔존 재확인→DB 삭제와 비식별 감사 기록. 실패 재시도 기록 유지 | Chrome에서 진행 업무 파기 숨김·종료 후 수량 확인/취소. 실제 SQL 수량 불일치·재개/명단 변경 잠금·삭제/감사 확인. 소유자 Storage 전체 파기와 환경 설정 예정 목록의 실제 Supabase 통합은 미검증 |

교사 참석자 추가도 parent row lock을 쓰는 원자적 RPC로 바꾸어 현장 추가와 연번/2000명 정원 경합을 막았다. 실제 다중 연결 경합은 별도 확인해야 한다.

## 세 프로파일의 구현 전후 판단

아래는 [웹디자이너](../../../pro/web-designer.md), [UX 디자이너](../../../pro/ux-designer.md), [UI 디자이너](../../../pro/ui-designer.md)를 읽고 **동일 AI가 기준을 나누어 수행한 모의 검토**다. 실제 전문가 6명·교사 인터뷰·승인·사용성 시험 결과가 아니다. 기존 리뷰의 구현 전 평가를 보존하고, 1차 구현 전체 화면에서 확인한 문제를 2차 개발에 반영했다.

| 프로파일 | 구현 전 판단·근거 | 구현 후 판단·근거 | 남은 위험 |
| --- | --- | --- | --- |
| 웹디자인 | 수정 필요: 설정과 주요 명단의 정보 위계, 긴 값/열 균형·A4 잘림이 미흡. 기존 리뷰 전체 화면과 4열 출력 참고 | 확인한 화면 통과: 공유 설정 접기·동명 미완료 행에만 코드 행동·중앙 미리보기로 밀도 개선. 42명 전체의 완료 3/미완료 39를 텍스트와 함께 구분. 긴 4열 출력은 한 단·높은 행으로 전체 값 보존 | 긴 한 셀에 맞춰 전체 행 높이를 보수적으로 늘려 페이지 수/빈 공간이 커질 수 있음. 실제 다양한 폰트·최대 2000명 전체 화면 판단은 보류 |
| UX | 수정 필요: 동명이인 선택·부분 실패 후 복구·현장 취소·가져오기 교체·공개 설정 변경·파기 생명주기 공백 | 확인한 과제 통과: 코드 검색→자동 이관→오답 수정 후 획 재사용→정확한 행 완료. 현장 취소는 행을 안 만들며 최종 원문 보존. 가져오기 확인/되돌리기·종료 후 수량 확인 제공 | 원격 공유·학교 부하·교사 코드 안내의 실제 업무 효율은 판단 보류. 스크린리더 실사용·실제 교실 시험 없음 |
| UI | 수정 필요: 새로운 가져오기 창 포커스 처리, 제출 오류 시 캔버스 resize로 잉크 소실, 인쇄 여백의 추가 페이지 | 확인한 상태 통과: 공통 dialog hook, Tab/Esc/포커스 복귀, 오류·폭 변경 뒤 획 유지, 360/390/768/1366/1440px 및 CSS 200% 전체 화면 확인, axe 주요 영역 위반 0 | CSS 확대는 브라우저/OS 확대·실제 기기 시험을 모두 대신하지 않음. 모든 상태의 전체 WCAG 준수를 보장하지 않음 |

## 1차 구현 후 여섯 독립 기준과 2차 개발

여섯 기준은 서로 다른 판단 목적을 적용한 AI 모의 관점이다. 각각의 판정·근거·수정 요구를 분리했으며, 아래 ‘재검증’이 확인한 범위를 넘어서 승인으로 해석하지 않는다.

| 관점 | 1차 판정·전체 화면/과제 근거 | 요구와 2차 변경 | 재검증 판정 |
| --- | --- | --- | --- |
| 웹디자인: 정보 위계 | 수정 필요. 41명 관리 전체 화면에서 공개/보관 설정이 QR와 명단 사이를 길게 차지 | 보조 설정을 접고 오류/발급 결과 안내는 접힘 밖에 유지 | 확인 범위 통과. [1차 전체](fixes/registry-first-desktop.png) → [최종 42명 전체](fixes/registry-second-final-fullscreen.png)에서 QR·명단·출력의 순서 확인 |
| 웹디자인: 화면 밀도 | 수정 필요. 모든 미서명 행의 코드 버튼이 관리 열을 두껍게 하고 미리보기가 한쪽으로 치우침 | 동명 또는 이미 코드가 있는 미완료 행에만 버튼 제공, A4 중앙 정렬 | 확인 범위 통과. [2차 전체](fixes/registry-second-desktop.png), 42명 상태 혼합·4열 긴 값 전체 캡처 확인. 마지막 출력 쪽의 빈 행은 종이 서명용 양식으로 유지 |
| UX: 참여자/학생 흐름 | 수정 필요. 검색 코드 재입력 부담, 오답 오류 표시가 캔버스를 resize하여 잉크 소실. 현장 입력에 마스킹 값을 다시 넣을 위험 | 검색 코드 자동 이관·성공 후 제거, 동기 캔버스 픽셀 보존, 현장 원문 메모리 유지 | 확인 범위 통과. CUA [오답 뒤 획 보존](fixes/registry-error-preserved-fixed.png) 후 재입력 없이 코드만 수정해 성공. Chrome 회귀는 390→768→390에서도 획 확인 |
| UX: 교실 전자칠판 흐름 | 수정 필요. 큰 명단에서 공유·인원 확인을 빨리 읽어야 하며 41명 인쇄가 5쪽으로 늘어남 | 현황 수량을 유지하고 보조 설정 접기, 원본 인쇄 portal·페이지 여백·마지막 페이지 break 조정 | 가상 데스크톱 과제 통과. 42/3/39, QR 1024 PNG와 [Chrome A4 3쪽](fixes/chrome-native-print-41.pdf) 확인. 실제 전자칠판·여러 기기 동시 공유는 판단 보류 |
| UI: 접근성 | 수정 필요. 1차 가져오기 미리보기 창의 키보드 포커스/복귀 경로가 미흡 | 전용 `RegistryRosterImportDialog`에 기존 공통 focus trap·Esc·안전한 취소 초점 적용 | 확인 범위 통과. Chrome Tab 반복·Esc·원래 버튼 복귀, 서명·삭제 확인창 및 주요 화면 axe 검사 통과 |
| UI: 반응형/상태 표현 | 수정 필요. 오류와 화면 크기 변화의 캔버스 소실, 출력 미리보기/인쇄 좌표 차이 | 동일 크기 불필요 resize 방지·동기 픽셀 복사, 전체 인쇄 원본 좌표/이미지 준비, 긴 출력 자동 배치 | 확인 범위 통과. 모바일 오류/성공 전체 캡처, 360/768/1440 및 CSS 200% 넘침 검사, 4열 셀과 A4 하단 검사. 원격 이미지 실패 상태의 실제 Storage 검증은 판단 보류 |

React 검토에서도 생성/상세의 중복 읽기를 제거했고, 상세 hook은 한 요청을 진행 중인 동안 이벤트를 합친 뒤 다시 읽도록 했다. StrictMode cleanup에서 이전 promise를 재사용하지 않도록 수정하여 로딩이 멈추는 문제를 재검증했다. 마지막에는 삭제·내보내기·참석자 변경의 중복 실행 guard를 확인했다.

## 실제 Chrome 조작과 출력 증거

- 실제 보이는 Chrome 탭에서 생성 화면에 헤더가 있는 41명 가상 명단을 입력해 등록부를 만들었다. 동명 2명은 교사 확인 코드를 발급받아 공개 모바일 화면에서 각각 서명했다. 틀린 코드의 오류 상태에서 그려둔 획이 유지되었고 올바른 코드로 성공했다.
- 현장 입력 확인 후 닫았을 때 인원 41명을 유지했다. 최종 제출 후 42명·완료 3명·미서명 39명, 현장 소속 원문을 확인했다. [필터 화면](fixes/registry-final-manage.png), [모바일 성공](fixes/registry-mobile-final-success.png), [최종 전체](fixes/registry-second-final-fullscreen.png).
- 기본 인쇄 미리보기는 전체 3쪽 중 한 쪽만 DOM에 렌더했다. [QR PNG](fixes/chrome-qr.png)를 실제 저장했고, [다운로드 PDF](fixes/chrome-download-41.pdf)의 1~3쪽을 전부 렌더했다: [1쪽](fixes/chrome-download-41-1.png), [2쪽](fixes/chrome-download-41-2.png), [3쪽](fixes/chrome-download-41-3.png). 다운로드 시점 자료는 41명이다.
- Chrome 인쇄 엔진이 만든 별도 [PDF](fixes/chrome-native-print-41.pdf)는 41명, A4 3쪽이다. 1~20/21~40/41번과 1/3·2/3·3/3 하단을 전체 렌더로 확인했다: [1쪽](fixes/chrome-native-print-41-1.png), [2쪽](fixes/chrome-native-print-41-2.png), [3쪽](fixes/chrome-native-print-41-3.png). 물리 프린터는 사용하지 않았다.
- 좁은/중간/큰 화면, CSS 확대, 긴 값의 전체 캡처도 보존했다: [목록 360](fixes/registry-list-360.png), [관리 768](fixes/registry-manage-768.png), [관리 1440](fixes/registry-manage-1440.png), [관리 CSS 200%](fixes/registry-manage-css-200.png), [공개 360](fixes/registry-public-360.png), [4열 긴 값](fixes/four-column-long-values.png).

## 실행한 검사

| 명령/검사 | 결과 | 근거·의미 |
| --- | --- | --- |
| `npm run typecheck` | 통과 | [로그](fixes/typecheck.txt), 마지막 제품 변경 뒤 재실행 |
| `npm run lint` | 통과, 기존 경고 7개 | [로그](fixes/lint.txt). 특별실·공통 컴포넌트·다른 리뷰 도구의 경고이며 이번 등록부 변경의 경고는 없음 |
| `npm test` | 59파일/479개 통과 | [로그](fixes/unit.txt). 전체 단위 검사, 신규 I/O·출력 계획 검사 포함 |
| `npm run build` | 통과, 번들 크기 경고 | [로그](fixes/build.txt). main minified 약 1118KB 경고 유지 |
| `npx --yes deno check --no-lock --node-modules-dir=none supabase/functions/registry-public/index.ts supabase/functions/registry-participants/index.ts supabase/functions/registry-pdf/index.ts` | 통과 | [로그](fixes/edge-check.txt). 프런트 타입 검사와 별개로 세 서버 함수 검사 |
| `npx --yes deno test --no-lock --node-modules-dir=none --allow-env --allow-read tests/server/registryPublic.test.ts` | 8개 통과 | [로그](fixes/edge-contract.txt). 실제 handler·AES-GCM, **DB/Storage 전송 대체**. 네트워크 없이 실행 |
| `REGISTRY_PG_RUNTIME=<임시 런타임> node tests/integration/registry-sql.local.mjs` | 18개 통과 | [로그](fixes/sql-local.txt). 실제 PostgreSQL WASM·pgcrypto에서 기존 3개+신규 migration 적용, 소유자/RLS·제한·rollback·재시도·토큰·정원·파기 SQL 확인 |
| `PLAYWRIGHT_TEST_PORT=4184 npm run test:e2e -- tests/e2e/app-shell-scroll.spec.ts tests/e2e/registry-accessibility.spec.ts tests/e2e/registry-optimization.spec.ts tests/e2e/registry-sign.spec.ts` | 33개 통과 | [로그](fixes/chrome-e2e.txt). 설치 Chrome, 전체 화면 스크롤 포함. **데모 저장소** |
| 마지막 제품 guard 변경 후 등록부 세 파일 E2E | 15개 통과 | [로그](fixes/chrome-final-followup.txt). 상기 등록부 15개 재검증 |
| CSS 200% 검사 추가 후 접근성 E2E | 3개 통과 | [로그](fixes/chrome-accessibility-200.txt), 주요 영역 axe 위반 0·전체 화면 넘침 없음 |
| 최종 개선 E2E 증거 보존 재실행 | 6개 통과 | [로그](fixes/chrome-optimization-evidence.txt), 4열/원본 인쇄 캡처 재보존 |
| 추가 범위: 위 기능 + `active-work.spec.ts`·`settings.spec.ts` | 35/37 통과, 2개 실패 | 홈의 기존 ‘전체 업무 도구 (10)’ 기대값은 현재 12와 불일치. 설정 검사의 단일 `getByRole('status')`는 기존 데모 안내+작업 안내 2개와 충돌. 관련 홈/선택자를 이번 작업에 섞어 수정하지 않음 |

테스트 수는 중복 재실행을 합산한 총 성공 건수로 표현하지 않는다. 초기 4183 실행은 데모 환경 변수가 맞지 않아 중단했고, 정확한 데모 환경의 전용 4184 서버에서 다시 검사했다. 기존 서버나 운영 프로젝트를 재사용하지 않았다.

## 아직 확인하지 못한 범위와 적용 조건

1. Docker가 없어 전체 로컬 Supabase Auth·PostgREST·Storage·Realtime·Edge gateway·JWT 통합 검사는 미실행이다. 원격 integration은 로컬 환경만 허용된 요청 범위 밖이므로 실행하지 않았다. PGlite fixture의 암호문 표시는 SQL 자료이며, 실제 AES 암복호화는 별도 Deno 계약 검사에서 확인했다.
2. 실제 다중 DB 연결의 동시 제출/추가/파기, 학교 네트워크 부하, Storage 실패/복구, 실제 서버 PDF 폰트·전체 생성, 물리 휴대전화·전자칠판·프린터는 추가 검증 대상이다. 코드와 SQL lock 검토를 동시성 통합 시험의 통과로 보고하지 않는다.
3. 운영 적용은 요청되지 않았다. 적용할 때 기존 암호화 key를 유지하고 migration 이력·번호를 비교한 뒤 **신규 DB migration → `registry-public`·`registry-participants`·`registry-pdf` → 프런트엔드**의 호환성을 확인해야 한다. 프런트엔드만 배포하면 새 RPC와 맞지 않는다.
4. 외부 일지 `../schooldoc-docs/development-history.md`와 `pro/ux-ui-expert.md`는 확인한 경로에 없었다. [독립 작업 일지](../../../docs/feature-review-registry-2026-10-01.md)에 `(codex)` 항목을 추가했으며 과거 이력을 재작성하지 않았다.
