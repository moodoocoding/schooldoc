# 원본 중심 필드 배치·공유·QR 개선 검증 (codex)

2026-10-02 KST. 사용자가 제시한 원본 준비 화면의 왼쪽 설정·오른쪽 큰 PDF 구조를 응답 필드 편집에 적용했다. 후속 요청의 긴 QR 이름/식별값 표시와 긴 명단의 공유 접근성도 함께 해결했다. 기존 DB 최적화와 수합 의미를 유지했다.

## 범위와 기준

- 전용 작업트리: `C:/Users/panth/.codex/worktrees/review-consent-20261001/260812_schooldoc`.
- 브랜치: `codex/consent-integrity-io-20261001`.
- 기준 main: `fb11a4b82419e773fb470d4a00cd621f17de8a21`. 기존 네 기능 통합과 운영 적용 기록을 읽고 이 main을 로컬 병합한 뒤 개선했다. 로컬 병합 커밋 `4dd88e7cc30b1c339ad3c6d3c8aff9294d92d4db`.
- 제품 변경은 가정통신문의 편집기·관리 화면·QR 화면·QR 쪽 나누기 네 파일이다. 공통 CSS, DEVELOPMENT.md, 진행 업무, DB, Edge Functions, 배포 설정과 다른 기능은 기준 main 내용 그대로다. 공유 checkout의 영수증 수정도 건드리지 않았다.
- 자료는 가상 문서·가상 이름만 사용했다. 사용자 선택대로 격리된 실제 로컬 DB로 읽기 검증했다. 새 UI의 원격 배포·운영 자료 변경은 실행하지 않았다.

## 수정 결과

| 항목 | 구현과 완료 근거 |
| --- | --- |
| 응답 필드 편집 구조 | 데스크톱 왼쪽 도구/설정·오른쪽 원본 PDF. 1570px 화면에서 원본 너비800px 이상. 예전 화면 높이 기반 축소식을 제거하고 가용 너비 기준100%로 표시한다. 확대50~300%와 너비 맞춤, 쪽 이동·다쪽 필드 목록 유지. |
| 단축키와 설정 밀도 | 단축키 설명은 기본 접힘. 복사·붙여넣기·되돌리기 버튼을 제공해 키보드 암기가 필요하지 않다. 숫자 크기/위치는 접어 두고 선택 시 이름/필수를 먼저 보여 준다. 200% 글자 확대 시 버튼이 한 열로 바뀐다. |
| 모바일 편집과 접근성 | 원본/설정 전환에서 입력을 유지한다. 설정창이 PDF 도구막대보다 위에 표시되도록 보완했다. 필드 선택과 크기 조절 버튼을 분리해 중첩 조작을 없앴다. Enter/Space 선택·방향키 이동·Alt 크기 조절, 기존 복사/다쪽 붙여넣기·되돌리기를 실제 Chrome으로 확인했다. |
| 관리 공유 접근 | 요약 바로 뒤에 링크 복사·응답 화면 열기·공용 QR 저장·개인 QR·미제출 재배부를 배치했다. 응답/명단 목록을 따로 접고 펼칠 수 있고 건수·내려받기 작업은 유지한다. 접기는 UI 상태이며 자료·검색·필터와 이미 받은 응답을 삭제하지 않는다. 설정 저장 뒤에도 접은 상태를 유지한다. |
| 긴 QR 이름 | 이름60자·식별값60자를 줄임표 없이 줄바꿈한다. QR104px와 PNG1024×1024를 유지했다. A4를2열×3행(쪽당6명)으로 바꿔 문구를 담는다. 24명4쪽,60명10쪽; 미제출16명3쪽·52명9쪽을 확인했다. 종이 사용량이 기존8명/쪽보다 늘어나는 의도된 선택이다. |
| DB I/O 유지 | 관리 초기 bundle1회, 명단60개·응답 헤더60개. 접기/펼치기·링크 복사 추가 업무 요청0. 본문 detail은 클릭 시1회, 다시 보기는 캐시. 응답100건·명단120→2000명 전체 검색·현재100/미제출1900 및 최신1/이력2를 실제 로컬 DB 경로에서 확인했다. |

## 구현 전 세 프로파일 판단

세 프로파일은 [웹디자이너](../../../pro/web-designer.md), [UX 디자이너](../../../pro/ux-designer.md), [UI 디자이너](../../../pro/ui-designer.md)를 읽었다. 아래 평가와 여섯 관점은 AI의 모의 검토이며 실제 전문가6명·교사 인터뷰·사용성 시험이 아니다.

| 프로파일 | 구현 전 판단·근거 | 구현 원칙·남은 위험 |
| --- | --- | --- |
| 웹디자인 | 수정 필요. 사용자 제공 화면은 가로 도구/안내가 위를 차지하고 원본이 약360px 너비로 축소돼 좌우 공백이 크다. 공유가 긴 목록 뒤에 있으며 QR 이름을 잘라 정보가 사라진다. | 원본을 주 작업으로 두고 도구를 왼쪽에 모은다. QR은 글자 크기/QR 크기 대신 쪽 수를 조정한다. 매우 긴 원본은 문서 스크롤이 필요하다. |
| UX | 수정 필요. 기본 설명이 문서보다 먼저 눈에 띄고 공유까지 목록을 지나야 한다. 반복 단축키를 몰라도 작업을 마칠 수 있어야 한다. | 버튼+선택 설정, 공유 우선, 목록 접기. 공개 응답·보관·재제출 의미는 유지한다. 실제 담임의 작업 습관은 미확인이다. |
| UI | 수정 필요. 작은 원본은 조절점을 찾기 어렵고 QR 이름의 줄임표는 동명이인 구분을 어렵게 한다. |44px 조절점/신규 주요 조작 유지, 긴 값 줄바꿈,390px/200% 검사. 화면낭독기·실제 인쇄/카메라는 후속 실물 확인이다. |

## 독립된 여섯 AI 관점의 1차→2차 개발

1차 구현 뒤 전체 화면과0/24/60명, 긴 이름·제출/미제출을 각각 평가했다. [1차200%](evidence/pass1-editor-desktop-css200.png), [1차 모바일](evidence/pass1-editor-mobile-settings.png), [1차 관리24명](evidence/pass1-manage-24-desktop.png), [1차 QR](evidence/pass1-qr-long-desktop.png)를 보존했다. 최초 자동 캡처 일부는 PDF 준비를 기다리지 않아 원본 준비 상태가 찍혔다. 이후 준비 완료와 폰트 준비를 기다리는 캡처로 보정했다.

| 독립 관점 | 1차 판정·근거·수정 요구 | 2차 개발·최종 판정·근거 | 남은 위험 |
| --- | --- | --- | --- |
| 웹디자인: 정보 위계 | 통과. 원본/도구 두 열과 공유 우선이 주 작업을 드러낸다. 보조 숫자 설정의 기본 노출은 줄일 필요가 있다. | 통과. 숫자 크기/위치도 접었다. [최종 편집](evidence/final-editor-selected-desktop.png), [접은 관리](evidence/final-manage-24-collapsed-desktop.png). | 필드가 많으면 왼쪽 목록이 길어질 수 있다. |
| 웹디자인: 화면 밀도 | 수정 필요. CSS200%에서2열 버튼의 문구가 세로로 잘게 줄바꿈한다. 모바일·긴 목록은 기본 펼침 시 세로로 길다. | 통과. 버튼 열을 가용 너비에 따라 자동 조절하고 목록 접기를 제공했다. [200%](evidence/final-editor-desktop-css200.png), [60명](evidence/final-manage-60-desktop.png), [모바일 접기](evidence/final-manage-24-collapsed-mobile.png). | 큰 글자 모바일에서는 자연 줄바꿈과 세로 길이가 늘어난다. |
| UX: 학생/보호자 사용 흐름 | 통과. 교사 편집 개선은 공개 응답의 원본 위치·선택·서명을 바꾸지 않는다. 기존 값 보존과 로딩 실패 복구 회귀가 필요하다. | 통과. 예/아니오·모바일 전환·서명·모든 쪽 준비·실패 재시도 검사 통과. 교사도 이전 단계 왕복 시 필드2개를 유지한다. | 실제 학생/보호자 인터뷰와 휴대폰 기기 검사는 없다. |
| UX: 교실 전자칠판 흐름 | 통과. 큰 원본에서 배치 설명과 쪽 이동이 쉬워지고 배부 작업이 위에 있다. 개인 링크를 담은 출력은 개별 전달해야 한다. | 통과.1570px 실제 Chrome에서 다쪽 이동·복사·너비 맞춤,24/60명 배부 및 공용 QR 저장을 확인했다. [큰 원본](evidence/final-editor-empty-desktop.png). | 실제 전자칠판 터치·카메라 스캔은 미검증이다. 개인 QR 전체 공개 게시를 안내하지 않는다. |
| UI: 접근성 | 수정 필요. 버튼 이름이 페이지 이동과 중복됐고 실제 axe에서 기존 선택 영역 내부 조절점의 nested-interactive를 발견했다. | 통과. 페이지 버튼 이름 구분, 선택/조절점 분리, Enter/Space 선택. [수정 전 axe](evidence/pass2-editor-accessibility.json)→[최종3상태 위반0](evidence/editor-accessibility.json). 관리0/24/60명 모바일·실제 DB CSS200%도 위반0. 실제 키보드·드래그·작은 칸 조절 통과. | 자동 검사는 화면낭독기 전체 흐름과 동등하지 않다. |
| UI: 반응형/상태 표현 | 수정 필요. 전체 모바일 캡처에서 sticky PDF 도구막대가 설정창 위로 겹쳤다. PDF 준비 전 캡처도 구분해야 한다. | 통과. 설정창 z40, PDF 도구막대 z30; 모바일 선택·닫기·재선택을 재검증했다. [최종 설정창](evidence/final-editor-mobile-settings.png), [원본 보기](evidence/final-editor-mobile-document.png). 관리 제출8/미제출16과 실제100/1900을 텍스트·색으로 구분. | 모바일 교사 편집은 도구 뒤 원본 순서로, 세로 스크롤을 사용한다. |

최종 세 프로파일은 모두 이 범위에서 통과다. 웹디자인은 큰 원본과 공유 위치/빈 공간, UX는 편집·배부·조회량 유지, UI는 긴 값·설정창 겹침·키보드/axe·출력 근거를 각각 확인했다. A4는 모든 페이지를 렌더해 여섯 카드·균형·본문/푸터 잘림을 확인했다.

## 실제 검사와 결과

| 검사/명령 | 결과와 범위 |
| --- | --- |
| `npm run typecheck` | 통과. 최종 변경 후 실제 tsc -b --noEmit. |
| `npm run lint` | 통과. 기존 다른 기능/리뷰 도구 경고6개 유지, 이번 수정 파일 경고0. |
| `npm test` |63파일501검사 통과. 첫 실행의 접근 가능한 이름 중복1건을 수정하고 전체 재검증했다. |
| `npm run build` | 통과. 기존500kB 초과 번들 경고 유지. PDF 본체/worker 공통 로더 유지. |
| 실제 설치 Chrome 데모/모의 API E2E | 고유63개 통과: 가정통신문45개+앱 껍데기18개. 최종 구조 보완 후 직접 영향25개와 질문/복구13개를 다시 실행했고 Space 선택·설정 저장 후 접힘 유지4개도 통과했다. 명단3개·호환4개 및 스크롤18개도 통과했다. 아래 실행 파일/명령을 참고한다. |
| `node design/consent-field-editor/2026-10-02/verify-local-db.mjs` | 실제 headed Chrome154.0.8037.58에서5흐름 통과, pageerror0. PostgreSQL18.4/PostgREST16.4/현재 Deno Edge 코드를 실제 HTTP로 실행했다. Auth/Storage는 로컬 JWT·디스크 어댑터. SQL/RLS 저장 회귀9개는 이전 보고서 결과이고 이번 UI 검사에는 쓰기를 추가하지 않았다. [결과](evidence/local-db-ui.json). |
| `node design/consent-field-editor/2026-10-02/check-editor-accessibility.mjs` | 실제 Chrome 빈 편집·필드 선택·모바일 선택3상태 axe 위반0. [결과](evidence/editor-accessibility.json). 도구 최초 implicit context 오류는 명시적 newContext로 보정했다. |
| `inspect-pdfs.py <pdftoppm>` | 실제 다운로드4쪽+실제 Chrome 인쇄4쪽/10쪽, 총18쪽 A4·빈 페이지 없음. PNG2개1024×1024. 전쪽 렌더·직접 시각 확인. 재실행 시 전체 보기 PNG가 페이지 파일에 섞이는 검증 도구 필터도 보정했다. [검사](evidence/pdf-inspection.json), [다운로드 전체](evidence/final-qr-download-all-pages.png), [24명 인쇄 전체](evidence/final-qr-print-all-pages.png), [60명 인쇄 전체](evidence/final-qr-60-print-all-pages.png). |

Chrome E2E는 Playwright 설정의 `channel: chrome`을 사용하고 `--headed`로 실제 설치 브라우저를 표시해 클릭·드래그·키보드·다운로드를 제어했다. 데모 localStorage 또는 일부 API 모의 응답을 쓰는 E2E를 실제 DB 검증으로 합치지 않았다. 실제 DB 검사는 별도4181 서버에서 데모를 끄고 시행했다. 초기6개 검사는 npm.ps1이 --headed 옵션을 전달하지 않은 실행이 있어 시각 검사 완료의 근거로 쓰지 않고, Node CLI로 다시 실행한 headed 결과를 기준으로 한다. agent-browser 세션은 실제 Chrome 진입까지 성공했지만 캡처/대기 명령이 Windows에서 타임아웃돼 Playwright로 검증을 이어갔다.

실행한 E2E 명령(저장소 루트, 별도4173 데모 서버):

```text
node node_modules/@playwright/test/cli.js test tests/e2e/consent-editor-layout.spec.ts tests/e2e/consent-small-fields.spec.ts tests/e2e/consent-forms.spec.ts --headed --reporter=list
# 최종25개 통과. 신규7개·작은 칸2개·기존 흐름16개.
node node_modules/@playwright/test/cli.js test tests/e2e/consent-questions.spec.ts tests/e2e/consent-pdf-recovery.spec.ts --headed --reporter=list
# 최종13개 통과.
node node_modules/@playwright/test/cli.js test tests/e2e/consent-forms.spec.ts tests/e2e/consent-class-roster.spec.ts tests/e2e/consent-pdf-compatibility.spec.ts --headed --reporter=list
#23개 통과(기존 흐름16개는 중복).
node node_modules/@playwright/test/cli.js test tests/e2e/app-shell-scroll.spec.ts --headed --reporter=list
# 초기 관련 묶음 실행에 포함된18개 통과. 위 명령은 같은 파일을 재현할 때의 필터다.
```

최초 관련56개 실행은55통과·1실패였다. 실패는 제거된 `쪽 맞춤` 버튼을 찾는 이전 검사 선택자였다. 독립 배율 표시와 `너비 맞춤`으로 검사 문구를 맞추되 원본/필드 상대 좌표 검증은 유지했고 해당 파일16개를 재통과했다. 최초 묶음에 잘못 적은 명단/호환 파일명은 매칭되지 않아 별도 정확한 파일 필터로7개를 추가했다. 초기 개발 중 숫자 설정의 JSX 닫힘 누락으로 타입/lint와 첫 화면 검사가 실패한 상태도 수정 후 재검증했다. 최종 구조 보완까지 완료된25개/13개 결과와 이전 성공 파일을 합쳐 중복 제외63개다.

## 실제 로컬 DB 전체 화면

- [2,000명 초기60개](evidence/local-db-2000-initial-60.png), [데스크톱 접기](evidence/local-db-2000-collapsed-desktop.png), [모바일 접기](evidence/local-db-2000-collapsed-mobile.png), [모바일 CSS200%](evidence/local-db-2000-collapsed-mobile-css200.png).
- [전체2,000명 검색](evidence/local-db-2000-all-search.png), [최신 응답과 이력](evidence/local-db-latest-and-history.png).
- 초기 업무 요청은 bundle1회다. 접기/펼치기는 추가0회이며 새로고침·다른 업무 진입마다 초기 화면을 펼친다. 사용자가 전체 검색을 누르면 기존 커서60개 단위로 전부 읽으므로 추가 요청이 생긴다. UI 변경이 전체 명단을 자동으로 불러오지 않는다.

## 반영 상태와 남은 확인

| 대상 | 이번 변경 상태 |
| --- | --- |
| DB 마이그레이션·Edge Functions | 해당 없음. 신규 UI 변경은 DB/API 규칙을 바꾸지 않는다. |
| 프런트엔드 | 로컬 코드·빌드·실제 Chrome 검증 완료. 이번 UI의 운영 배포는 미적용. |
| GitHub push·PR·main 병합 | 이 세션에서는 미실행. 기능/검증과 작업일지를 별도 로컬 커밋으로 인계한다. |

기존 DB 최적화의 원격 적용은 [통합 운영 적용 기록](../../feature-reviews/2026-10-02-integration/release.md)에 기록돼 있다. 이 세션은 그 기록과 기준 main을 읽었으며 운영 Google OAuth·로그인 후 RLS 쓰기·Storage 제출/복구/파기를 새로 검증했다고 보고하지 않는다. 실제 학교 기기·프린터·카메라 QR 판독·화면낭독기·Chrome UI zoom200%는 미검증이고200% 증거는 root CSS 글자 확대다. DB 디스크 IOPS나 과금 절감률을 새로 측정하지 않았다.

긴 QR 이름과 긴 목록 공유 우선 배치는 이전 보고서의 후속 미수정 항목이었으며 이번에 완료했다. 정상 A4 이름60자/식별값60자에서 줄임표 없이 확인했다. 전체 명단을 펼치거나 모바일 QR을 한 열로 볼 때 페이지가 길어지는 특성과6명/쪽 출력의 종이 증가를 남은 설계 제약으로 기록한다.

외부 공용 작업일지 `../schooldoc-docs/development-history.md`와 `pro/ux-ui-expert.md`는 없어 읽거나 복원하지 않았다. [전용 작업일지](../../../docs/feature-review-consent-2026-10-01.md)에 완료·검증·인계 상태를 추가한다. 시험 DB/키/JWT/의존성은 기존 `.runtime/` 무시 규칙을 유지했고 신규 검증 폴더도 `.runtime/`를 제외한다. 새 증거 PDF는 binary로 보존한다.
## 통합 전 추가 QR 반응형 보완 (codex)

2026-10-02. 첫 기능 커밋과 일지 커밋 이후 통합 세션의 실제 Chrome 검토에서640px/768px QR 페이지 잘림이 전달됐다. `sm:w-[794px]`가640px부터 화면용 페이지를 고정해 오른쪽 카드3개를 화면 밖으로 밀었다. 앞선390px/1366px 검사만으로 이 중간 구간을 확인하지 못한 한계다. 기존 커밋은 재작성하지 않고 이 보완을 별도 fix 커밋으로 추가한다.

화면 페이지의 고정 너비를 제거해 가용 너비를 사용하고1024px 미만에서는 한 열로 배치했다. 인쇄는 A4 두 열×세 행을 유지하며 PDF 저장 시 복제본에794×1123px·42/48px 여백·두 열/세 행·빈 칸 표시를 명시해 화면 폭과 출력 규격을 분리했다.6명/쪽·QR104px·PNG1024×1024 및 기존 다쪽 출력/미제출 필터는 유지한다. 공통 CSS·DB/API와 다른 기능은 변경하지 않았다.

- 실제 headed Chrome 새 폭 검사1개와 기존 QR24/60명2개, 총3개 통과.390/640/768/1024/1280/1570px 모두6개 카드·QR·이름·식별값·이미지 저장 버튼의 가로 이탈0, 긴 값 잘림0, pageerror0. [측정](evidence/tablet-qr-layout.json).
- 전체 화면 [390px](evidence/final-qr-width-390.png), [640px](evidence/final-qr-width-640.png), [768px](evidence/final-qr-width-768.png), [1024px](evidence/final-qr-width-1024.png), [1280px](evidence/final-qr-width-1280.png), [1570px](evidence/final-qr-width-1570.png)을 직접 열어 모든 카드와 저장 버튼을 확인했다. 좁은 화면은 문서의 세로 스크롤로 나머지 카드를 본다.
- 768px에서 실제 내려받은 [PDF](evidence/tablet-qr-768-download.pdf)와390px 실제 [인쇄 PDF](evidence/tablet-qr-390-print.pdf) 각각 A4 한 쪽에6명 모두 정상. [다운로드 렌더](evidence/tablet-qr-768-download-1.png), [인쇄 렌더](evidence/tablet-qr-390-print-1.png)에서 긴 이름·식별값, QR 크기와 여섯 카드·푸터를 확인했다. 기존4/4/10쪽도 재확인해 현재 PDF5개20쪽 A4·빈 페이지0이다.
- `npm run typecheck`·`npm run lint`·`npm run build` 통과, 기존 lint6개·번들 경고 유지. `npm test -- tests/unit/consentRecipientSheet.test.ts tests/unit/scrollContainersAreDeliberate.test.ts tests/unit/accessibleNamesDoNotOverlap.test.ts`3파일45개 통과. 이어 전체 단위501개도 최종 재확인했다. E2E의 중복 제외 누적은64개다.

추가 세 프로파일 판단: 웹디자인은640/768px의 밀도/잘림 수정 필요→한 열 전체 캡처로 통과, UX는 화면에서6명을 세로로 확인하고 A4는 두 열로 배부할 수 있어 통과, UI는 카드/QR/전체 이름/저장 버튼의 실제 경계 측정과 다운로드/인쇄 재확인으로 통과다. 앞선 여섯 AI 관점 중 밀도·반응형·출력 근거를 이 자료로 갱신하며 실제 전문가 검토로 해석하지 않는다. 종이 증가·모바일 세로 길이·실물 인쇄/카메라의 미검증은 그대로다. 수정본/일지는 별도 로컬 커밋으로 추가하며 원격 push·PR·main 병합·운영 배포는 통합 세션 담당이다.