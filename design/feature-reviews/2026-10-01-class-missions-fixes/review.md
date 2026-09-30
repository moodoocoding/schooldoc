# 학급 미션 수정 검토 (codex)

날짜: 2026-10-01. 기준: 7173d3e. 실제 전문가·교사 검토가 아닌 AI 모의 평가다.

## 구현 전 세 프로파일 평가

| 관점 | 판정·근거 | 남은 위험 |
| --- | --- | --- |
| 웹디자인 | 수정 필요: 현황 시작 y=1023, QR 오른쪽 공백. 현황을 우선 배치하고 준비 영역을 접는다. | 실제 교사 소요시간 미측정 |
| UX | 수정 필요: 동명 오선택, 나가기 후 재표시, 충돌 입력 유실, 학교 IP 48회 중 8회 거부. | 실제 학교 NAT 부하 미측정 |
| UI | 수정 필요: 학생 보조 문구 4.45:1, 접속 뒤 BODY 포커스, 시작 전 표시 불일치. | 실제 보조기술 시험 미수행 |

세 프로파일 pro/web-designer.md, pro/ux-designer.md, pro/ui-designer.md 및 원 리뷰의 전체 화면·결과를 근거로 구현했다.

1차 구현 후 여섯 관점의 전체 화면 평가와 2차 반영 결과를 아래에 기록한다.

## 1차 전체 화면·여섯 모의 관점 평가

설치된 Chrome에서 가상 0/24/60명, 1366×900/390×844/CSS 200% 전체 캡처와 실제 클릭 결과를 평가했다. 여섯 독립 기준을 순차 적용한 AI 모의 검토이며 실제 전문가 6명·병렬 에이전트·교사 인터뷰가 아니다.

| 관점 | 판정·근거 | 2차 수정 요구 / 남은 위험 |
| --- | --- | --- |
| 웹: 정보 위계 | 통과: 현황 y=523(기존 1023), 공유/명단/추가가 현황 뒤에 있다. | 실제 교사 처리 시간 미측정 |
| 웹: 화면 밀도 | 수정 필요: 24명 두 열 끝은 균형적이나, 미션 1건도 3열의 1칸만 차지해 공백과 CSS 200% 줄바꿈이 크다. | 1건은 전체 폭, 최소 높이 축소 |
| UX: 학생 흐름 | 부분 통과: 동명 거부·코드 선택·나가기·입력 보존 후 재저장이 동작한다. 완료 후 할 일 없음 카드가 완료 기록을 밀어낸다. | 현재 완료 카드가 있으면 빈 안내 생략 |
| UX: 전자칠판 흐름 | 수정 필요: 현황·상태·일괄 확인이 앞에 있지만 60명 명단 뒤 QR을 찾으려면 길게 내려야 한다. | 학급 선택 옆 QR·학생 링크 바로가기. 이름 가림은 현황에만 적용되며 공유/명단의 정보는 별도 관리 |
| UI: 접근성 | 통과: 교사 60명 모바일·학생 모바일 axe 위반 0건. Enter 후 H1, 나가기 후 이름 입력 포커스 확인. | 스크린리더 실사용 미검증. 코드 모드 안내를 입력 방식과 일치시킬 것 |
| UI: 반응형·상태 | 부분 통과: 모바일/200% 가로 넘침 없음, 상태 5종 텍스트 표시, 시작 전 일치. 새로고침 중 기존 화면에는 상태 안내가 없다. | 현황 갱신 상태·입력 유지 안내 추가, 조작 중 학급 변경 방지 |

## 2차 개발

위 요구를 반영해 단일 미션 전체 폭, QR 바로가기, 학생의 중복 빈 안내 생략, 코드 모드 안내, 현황 갱신 안내와 저장 중 학급 변경 방지를 추가했다. 명단 입력도 수정 표시가 있으면 새로고침에서 보존한다. 발행 미리보기는 최신 버전 변경 시 다시 확인하며, 일괄 확인·파기는 자동 재시도하지 않는다.

## 최종 수정과 회귀 근거

| 항목 | 수정 결과 | 검증 |
| --- | --- | --- |
| F1 | 공통 이름/코드 식별 함수. 동명은 명단을 공개하지 않고 개인 코드 안내. 코드가 식별되면 해당 학생만 반환한다. 이름 접속 유지. | 단위, Deno 조회/저장 거부·암호문 불변·두 번째 학생 코드 저장, Chrome 오류·코드 접속 |
| F2 | 접속 요청 세대, 나가기·언마운트 무효화, 토큰별 컴포넌트 분리. 이전 성공/오류/finally를 모두 폐기한다. | 지연된 완료·새로고침 뒤 다음 학생 접속을 유지하는 E2E, 나가기 입력 포커스 |
| F3 | 상위 편집 입력과 명단 수정 입력 보존. 현황 갱신 때 편집기를 유지하고 최신 버전으로 수동 재저장. 모든 단순 변경 Promise 처리. | 제목·안내·시작일·마감일·대상·확인 방식·명단 보존, 충돌 처리 후 재저장, 미처리 오류 0건, 초안 다시 발행 |
| F4 | 분당 IP 1,200 / 학급 600 / 학급·IP 360 / 학생 12 / 실패 추측 학급·IP 40. 제한 RPC 실패 시 중단. 버전 재시도에 학생 한도 중복 차감 없음. | 실제 핸들러+모의 카운터: 60명×4=240회, 두 학급 120명×4=480회 전부 성공. 13번째 학생 요청·41번째 실패 추측·361번째 학급 요청 거부. 다른 학급 정상 참여 |
| F5 | 현재 할 미션 우선, 현재 완료와 전체 기록 구분, 시작 전·지난 기록 접기. | 현재 버튼 y=663(기존 1666), 지난 기록 열기, 학생 빈 상태 |
| F6 | 학급 선택 압축, 미션·현황 우선, 명단·QR·학급 추가 보조 영역. 단일 미션 전체 폭과 QR 바로가기/포커스. | 현황 y=507(기존 1023), 24/60명 전체 화면, QR PNG 1024×1024와 키보드 포커스 |
| F7 | 학생 보조 문구 색 #526174. 접속 후 H1, 나가기 후 입력 포커스. | 교사 60명 모바일·학생 모바일 axe 위반 0건, Enter 접속 |
| F8 | 현재 접근 가능한 이름·공유 펼치기에 맞춘 기존 E2E, 수정 기대 동작을 검사하는 영구 회귀 추가. | 기존 9개+추가 6개 E2E. 원 리뷰 probe는 수정 성공 검사로 실행하지 않음 |
| F9 | 공통 기간 상태 문구를 교사·진행 업무에서 사용. | 날짜 경계 단위 검사와 교사·학생·진행 업무의 시작 전 E2E |

## 2차 검증과 세 프로파일 판정

| 프로파일 | 최종 판정·근거 | 남은 위험 |
| --- | --- | --- |
| 웹디자인 | 통과: 현황 우선, 단일 미션 공백 제거, 24/60명 열 끝 균형과 긴 이름 줄바꿈, 전체 캡처에서 잘림·겹침 없음 | 60개 미션 목록 밀도와 실제 교사 시간 측정 없음 |
| UX | 통과: 이름/코드 구분, 저장·취소·나가기·충돌 복구·초안 재발행·과거 기록 열기·QR 접근 완료 | 실제 학생/교사 사용성·학교 부하 시험 없음 |
| UI | 통과: 상태 문자·색 병행, axe 0건, Enter·H1/입력/QR 요약 포커스, 390px 및 실제 Chrome 200% 가로 넘침 없음 | 스크린리더 실사용·모든 기기/테마 미검증 |

여섯 관점의 수정 요구는 단일 카드 전체 폭(웹 밀도), 현재 완료 앞 중복 빈 안내 생략(학생 UX), QR 바로가기(전자칠판 UX), 코드 방식별 안내·QR 포커스(접근성), 갱신 안내·저장 중 학급 변경 방지(상태)로 반영했다. 2차 전체 화면을 다시 직접 확인했다. 실제 전문가나 교사 승인을 받은 결과가 아니다.

## 실행 검사와 한계

- npm run typecheck: 통과. 프런트엔드 프로젝트 참조 검사.
- npm run lint: 오류 0, 기존 경고 7건. 공통/특별실 6건과 원 리뷰 verify.mjs의 unused codeHash 1건. 새 수정 경로 경고 없음.
- npm test: 57개 파일, 469개 통과. 공통 규칙·진행 업무를 포함한 전체 단위 검사.
- deno test --cached-only --allow-env --node-modules-dir=manual tests/server/classMissions.test.ts tests/server/classMissionsRegression.test.ts: 15개 통과. 실제 핸들러·암호화, 모의 HTTP/RPC. 실제 PostgreSQL/RLS 검사는 아님.
- deno check --cached-only --node-modules-dir=manual supabase/functions/class-missions-admin/index.ts supabase/functions/class-missions-public/index.ts: 통과.
- PLAYWRIGHT_TEST_PORT=4177 npm run test:e2e -- tests/e2e/class-missions.spec.ts tests/e2e/class-missions-regressions.spec.ts: 기존 9개·추가 6개 통과. 최종 앱 스크롤 검사는 학급 미션 한 경로에 한정한다.
- npm run build: 통과. 큰 번들 경고 존재. 새 의존성이나 번들 분할 변경은 없음.
- node design/feature-reviews/2026-10-01-class-missions-fixes/verify.mjs: 기대 동작 9개 시나리오 통과. QR 실제 PNG와 Excel의 자기보고/교사 확인 열을 다시 읽어 확인.
- node design/feature-reviews/2026-10-01-class-missions-fixes/real-zoom.mjs: 실제 Chrome 200% 통과. CSS zoom=1, devicePixelRatio=2, innerWidth=675, outerWidth=1366, scrollWidth=675 확인. 화면 전체 캡처는 Chrome의 실제 화면 좌표로 저장했다.

첫 실제 확대 시도는 오래된 프로필 키로 확대가 적용되지 않아 실패했고, 현재 키와 전체 화면 캡처 좌표를 바로잡아 재검증했다. 확대 프로필 구현은 [Chromium의 확대 설정 검사](https://chromium.googlesource.com/chromium/src/+/HEAD/chrome/browser/profiles/host_zoom_map_browsertest.cc)를 참고했다. 최종 파일에는 성공한 측정만 담는다. 브라우저 프로필은 가상 데이터의 임시 폴더이며 개인 Chrome 프로필에 접근하지 않았다.

브라우저 → 데모 API → 가상 localStorage → 응답 렌더링과 서버 핸들러 → 모의 DB/RPC → 응답 계약을 각각 확인했다. 원격 Supabase 연결·실제 SQL 트랜잭션·실제 RLS·학교 NAT 처리량/RPC 비용·운영 함수 버전은 미검증이다. 이름 접속은 강한 본인 인증이 아닌 기존 제품 정책이다. 암호화·소유자 검사·공개 응답 최소화·파기 대상/수량/동의 확인은 유지했다. DB 마이그레이션 변경 없음.

## 증거와 재현

- [최종 9개 시나리오 결과](evidence/results.json), [실제 Chrome 확대 측정](evidence/real-zoom-results.json)
- [24명 데스크톱](evidence/teacher-24-desktop.png), [24명 모바일](evidence/teacher-24-mobile.png), [60명 데스크톱](evidence/teacher-60-desktop.png), [60명 모바일](evidence/teacher-60-mobile.png)
- [교사 실제 200%](evidence/teacher-chrome-zoom-200.png), [학생 실제 200%](evidence/student-chrome-zoom-200.png), [교사 CSS 200%](evidence/teacher-24-zoom-200.png)
- [학생 수행 가능](evidence/student-active-mobile.png), [교사 확인 완료](evidence/student-confirmed-mobile.png), [학생 빈 상태](evidence/student-empty-mobile.png), [동명 오류](evidence/duplicate-name-error-mobile.png), [교사 충돌 오류](evidence/teacher-stale-error.png), [나가기 유지](evidence/logout-stays-out-mobile.png), [파기 확인](evidence/teacher-purge.png)
- first-pass/에는 1차 전체 화면 3장과 결과 JSON을 보존했다. 원 리뷰의 제품 결함 증거는 변경하지 않았다.

로컬 서버는 수정 worktree에서 가상 데모 환경 변수로 4177번을 사용했다. Deno와 agent-browser는 기존 npm 캐시의 실행 파일, Playwright는 설치된 Chrome을 사용했다. 의존성은 기존 설치 node_modules를 연결해 재사용했다. 새 패키지 설치 없음. 외부 공용 개발일지와 pro/ux-ui-expert.md는 확인되지 않아 작업을 멈추지 않고 이 worktree의 docs/development-history.md에 이번 항목만 기록했다.

GitHub push·PR·main 병합 없음. DB 해당 없음, Edge Functions 미적용, 프런트엔드 운영 배포 미적용. 원격 반영에는 class-missions-public 서버 함수를 프런트엔드보다 먼저 적용하고 실제 시험 환경에서 확인해야 한다.

최종 코드 검토에서 교사 화면의 보존 범위를 조회한 계정으로 제한하고 오래된 조회 응답을 폐기했다. 이때 반복 초기 조회의 일회성 코드 발급 결과가 빠지는 문제가 E2E 2건에서 발견되어, 같은 페이지의 동일 교사 조회를 탭 간 잠금 앞에서 공유하도록 수정했다. 실패한 두 설정 연동 E2E 재검증이 통과했고 동일 교사 결과 공유·다른 교사 요청 분리 단위 검사를 추가했다. 실제 원격 계정 전환은 미검증이다.

최종 실행: 기존 학급 미션 9개 + 추가 회귀 6개 + 해당 앱 스크롤 1개, 총 16개 E2E 통과(29.4초). 전체 단위 최종 57개 파일·469개 통과. 타입·lint·빌드 최종 통과. git diff --check 통과. 코드·검증 자료는 로컬 수정 브랜치에 커밋하며 docs/development-history.md는 별도 로컬 기록으로 제외한다.
