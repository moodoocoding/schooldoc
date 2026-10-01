# 특별실 예약 기능 리뷰

- 검토일: 2026-10-01 (한국 시간). 기준 커밋: `c208afefca40bb4f15cab164fc292661e80fb9a0`.
- 브랜치: `codex/feature-review-special-rooms-20261001`.
- 전용 워크트리: `C:/Users/panth/.codex/worktrees/review-special-rooms-20261001/260812_schooldoc`.
- 전용 서버: `http://127.0.0.1:4184`, Vite 개발 환경, `--strictPort`, 특별실 데모 플래그 true. Supabase 연결 변수는 빈 값. 다른 서버를 재사용하거나 종료하지 않았다.
- 제품 파일 변경 없음. 보고서·증거·관찰 도구만 추가한다. 원격 자료 생성·제출·취소·삭제, 운영 로그인, 배포, 키 교체를 수행하지 않았다.
- 이 문서의 세 프로파일 및 여섯 관점 평가는 **한 AI가 관점을 나누어 수행한 모의 검토**다. 실제 전문가 6명·교사 인터뷰·학생 사용성 시험·전자칠판 기기 시험이나 승인이 아니다.

## 결론과 수정 순서

9교시 운영 설정은 화면과 DB에 있으나 실제 공개 함수는 8교시까지만 허용한다. 주간 조회 실패나 응답 순서 역전은 예약이 없는 것처럼 표시하며, 동시 편집은 기존 내용을 경고 없이 덮어쓸 수 있다. 이 세 항목을 먼저 해결해야 한다.

일반 데모 흐름은 예약표 생성 → 링크/비밀번호 → 예약 → 다시 조회 → 수정/취소와 QR PNG 저장까지 정상이다. 기존 단위 98개와 특별실 E2E 58개도 통과했다. **이 통과는 데모 경로와 기존 검사 범위의 결과이며 아래 결함이 수정되었다는 뜻이 아니다.**

| 우선순위 | ID | 문제 | 확인 |
| --- | --- | --- | --- |
| P1 | SR-01 | 공개 함수가 9교시 예약·반복·삭제를 거절 | H |
| P1 | SR-02 | 주 조회 실패·지연 순서 역전이 빈 표로 보임 | M |
| P1 | SR-03 | 작성 중 입력 소실과 동시 예약 덮어쓰기 | D + H |
| P2 | SR-04 | 열린 공개 화면의 휴관·종료·설정 갱신 누락 | M + C |
| P2 | SR-05 | 단일 저장 실패 후 입력 초안 소실 | D |
| P2 | SR-06 | Chrome A4 출력이 전부 빈 페이지 | D |
| P2 | SR-07 | 반복 경쟁 상황에서 남의 예약을 내 성공 수에 포함 | H |
| P2 | SR-08 | 운영 교시·토요일 설정 밖의 신규 예약 허용 | H |
| P2 | SR-09 | 학사일정 갱신 중 실패가 기존 일정을 지움 | H |
| P2 | SR-10 | 관리 상태 변경 오류·초기 조회 오류 복구 부족 | D + M + C |
| P2 | SR-11 | CSS 200% 반복 예약 대화상자 잘림 | D |
| P2 | SR-12 | 날짜·교시·저장 상태 텍스트 대비 부족 | D |
| P2 | SR-13 | 외부 교시·요일 변경 후 관리 입력이 옛 값 유지 | M |
| P2 | SR-14 | 모바일에서 짧은 학급명도 대부분 잘림 | D |
| P3 | SR-15 | 한국 시간·토요일·연도 범위 표시 불일치 | D + H |
| P3 | SR-16 | 많은 특별실과 먼 날짜 선택의 탐색 부담 | D + C |
| P3 | SR-17 | tab 역할의 방향키 탐색 미구현 | M + C |
| P3 | SR-18 | 종료 후 반복을 허용하는 데모/서버 불일치 | D + H |

P1은 예약의 성립·정합성을 직접 해치는 우선 수정 항목, P2는 일상 사용의 신뢰·복구·접근성을 해치는 항목, P3는 제한된 조건의 표시·탐색·검증 품질 개선이다. P0로 확정할 문제는 이 검토 범위에서 찾지 않았다.

## 확인 방법과 증거의 의미

- **D**: 설치된 Google Chrome 154.0.8037.58에서 실제 DOM, 클릭·입력·키보드·다운로드를 관찰한 **로컬 데모**. 가상 자료만 localStorage에 저장했다.
- **M**: 같은 실제 Chrome에서 원본 화면·저장소 코드를 실행하되, 브라우저가 받는 config를 false로 하고 Supabase 경계만 가짜 클라이언트로 대체했다. 모든 API 응답은 로컬 Playwright route에서 공급했다. 원격 모드 UI의 지연·실패·이벤트를 재현한 것이며 원격 Supabase 성공 검증이 아니다.
- **H**: 실제 Edge Function TypeScript 소스를 Node VM에서 변환·실행했다. DB·Auth·NEIS 응답과 동시 실행 순서만 모의 객체로 제공했고 네트워크는 쓰지 않았다. Deno 배포·실제 PostgreSQL 트랜잭션·RLS 검증을 대신하지 않는다.
- **C**: 기준 커밋의 소스·마이그레이션·기존 테스트를 읽은 확인. 실행하지 않은 경우 단정하지 않는다.

`browser-demo.mjs`와 `browser-boundaries.mjs`는 외부 요청을 차단하므로 캡처에서 CDN Pretendard 대신 환경의 대체 글꼴을 사용했다. 레이아웃·DOM·색 대비 관찰은 그 실제 렌더링 기준이다. 디바이스 viewport는 모바일을 모사한 Chrome이며 실제 스마트폰 소프트 키보드·터치·전자칠판 하드웨어는 미검증이다.

## 단계별 실제 사용자 워크플로우

### 교사: 예약표 준비와 운영

| 단계 | 화면/행동 | 실제 확인 결과 | 막힘·수정 항목 |
| --- | --- | --- | --- |
| 1 | `/tools/special-rooms` 열기 | 빈 상태에 새 예약표 CTA 제공 | 서버 조회 실패와 초기 빈 상태는 별도 로딩 구분이 약함 |
| 2 | 새 예약표 이름·안내·학교·4~9교시·토요일·비밀번호 입력 | 가상 이름, 9교시, 토요일, 3개 실로 생성 성공. Enter로 다음 실 행 추가 | 학교 검색은 실제 API가 필요한 보조 기능이며 데모 연결 없음 안내 확인 |
| 3 | 링크 복사·예약 화면 열기·QR 이미지 저장 | 링크 주소 제공, 복사 아이콘 피드백, 실제 PNG 다운로드 확인 | 복사 실패는 성공처럼 보일 수 있음(SR-10). PNG 디코딩으로 링크를 검증한 것은 아님 |
| 4 | 주간 전체 현황과 실 탭 조회 | 이번 주 전체 예약 수는 실 선택에 영향 없이 유지. 실별 표 조회 | 현황 표는 읽기 전용. 수정은 공개 링크로 왕복. 실 위치는 공개 화면에 표시되지 않음 |
| 5 | 휴관 기간·대상 실·사유 추가 | 기존 예약 영향 수 안내, 표에서 감춤, 다른 실은 유지(기존 E2E) | 공개 원격 화면 갱신(SR-04), 휴관 해제 실패 피드백(SR-10) |
| 6 | 휴관 풀기 | 기존 예약이 그대로 복원 | 제거 요청 실패의 catch·busy 없음 |
| 7 | 교시 수/토요일 변경 | 숨는 예약을 미리 안내하고 자료는 보존. 되돌리면 다시 표시 | 외부 변경 후 설정 입력은 옛 값(SR-13), 서버 신규 쓰기 검증(SR-08) |
| 8 | 학사일정 학교 연결/갱신 | 코드와 단위 검사는 연결 후 동기화 실패를 나누어 안내 | 실제 NEIS 성공 연동 미검증. 기존 일정 삭제 후 저장 실패 위험(SR-09) |
| 9 | 예약 종료/다시 열기 | 데모 공개 표가 읽기 전용으로 바뀌고 다시 열면 예약 가능 | 실패 표시 없음(SR-10), 원격 구독 갱신(SR-04), 데모 반복 예외(SR-18) |
| 10 | 출력·보관·목록 삭제 | 특별실 전용 출력 CTA 없음. 삭제 확인에는 실/예약 수 및 되돌릴 수 없음 안내. 취소 시 보존 | 브라우저 A4 출력은 빈 PDF(SR-06). 실제 삭제는 실시하지 않음 |

### 공개 사용자: 예약과 변경

실제 화면 안내의 대상은 **가입하지 않은 교직원**이다. 학생 참여 관점은 ‘링크를 받은 비전문 사용자’의 이해 가능성을 보는 모의 기준으로만 적용했다. 교사 소유권·관리 기능을 학생에게 부여했다고 해석하지 않는다.

| 단계 | 행동 | 실제 확인 결과 | 막힘·수정 항목 |
| --- | --- | --- | --- |
| 1 | 공유 링크 열기 | 비밀번호 없는 판은 바로 표, 보호된 판은 비밀번호 폼 | 초기 실패/잘못된 링크에는 앱 재시도 버튼 없음(SR-10) |
| 2 | 틀린/맞는 비밀번호 입력 | 오류 메시지 후 맞는 값으로 정상 열림 | 비밀번호는 서버의 각 공개 요청에서도 확인(H). 잠금 화면을 통과했다고 원격 권한을 검증한 것은 아님 |
| 3 | 실·지난/다음/이번 주 선택 | 각 실 별도 일정, 주 이동, 이번 주 복귀 정상(E2E) | 먼 날짜 직접 이동 없음(SR-16); 조회 실패/레이스(SR-02) |
| 4 | 빈 칸 입력·저장 | 입력 시트에서 실·날짜·교시 확인, 즉시 표시와 저장됨 안내 | 9교시 실제 API 실패(SR-01), 실패 초안 소실(SR-05) |
| 5 | 예약을 다시 열기·취소·수정 | 기존 내용 확인 → 바꾸기, 취소 시 보존, 수정 후 재조회 정상 | 열린 시트의 동시 변경에 초안 덮어쓰기·확인 누락(SR-03) |
| 6 | 예약 지우기 | 표에서 삭제, 다른 반복 주는 유지(E2E) | 별도 삭제 후 undo 기능 없음. 동시 변경 삭제에 기대 버전도 없음(SR-03) |
| 7 | 매주 반복 예약 | 4주 중 가상 휴업일 1일을 건너뛰어 3건 생성. 이미 찬 칸/휴관은 건너뜀(E2E/H) | 경쟁 시 수량(SR-07), 200% 창(SR-11), 오류가 녹색 결과 박스로 표시되는 코드상 위험 |
| 8 | 종료·휴관 표 확인 | 데모에서는 비활성·문자 상태 구분 | 모바일 짧은 라벨 잘림(SR-14), 원격 메타 갱신(SR-04) |

지난 주에도 새 예약과 수정/취소를 할 수 있었다(D/H). 과거 기록 정정을 허용할지, 새 예약만 제한할지는 **정책 확인 사항**이다. 이 리뷰만으로 과거 기록을 지우거나 모든 과거 수정을 금지하라고 요구하지 않는다.

## 10개 휴리스틱 평가

| 휴리스틱 | 판정 | 과제 기준 판단과 근거 |
| --- | --- | --- |
| 1. 시스템 상태 가시성 | 수정 필요 | 저장 중/저장됨과 종료 배지는 좋음. 조회 실패가 빈 표, 지연 응답이 현재 표를 바꿈(SR-02), 저장 뒤 갱신 실패도 성공 표시(SR-04/10). |
| 2. 현실 세계와의 일치 | 부분 통과 | 교시×요일 시간표, 오늘·휴업일, 학급/용도 입력이 익숙함. 9교시와 토요일 범위 문구 불일치(SR-01/15), 실 위치를 공개 사용자가 볼 수 없음. |
| 3. 사용자 통제와 자유 | 수정 필요 | Esc·취소·포커스 복귀, 예약 지우기, 휴관 복원은 정상. 실패 입력을 되살릴 수 없고 조회 재시도 없음(SR-05/10). |
| 4. 일관성과 표준 | 수정 필요 | 생성·관리에서 같은 교시 설정을 제공하지만 공개 API 계약이 다름(SR-01/08). tab 역할 방향키 동작 없음(SR-17). |
| 5. 오류 예방 | 수정 필요 | 기존 예약 확인 및 숨는 수량 안내는 적절. 동시 빈 칸 편집은 경고 없이 덮어쓰기(SR-03), 일정 교체 원자성 없음(SR-09). |
| 6. 기억보다 인지 | 부분 통과 | 시트가 실/시간/기존 내용을 보여 줌. 모바일 짧은 이름도 잘려 학급을 기억하거나 하나씩 열어야 함(SR-14). |
| 7. 유연성과 효율 | 부분 통과 | Enter 입력과 2/4/8주 반복, 이번 주 복귀 지원. 실 50개와 먼 날짜에 선택 비용 큼(SR-16). |
| 8. 미적·최소한의 디자인 | 수정 필요 | 공개 표의 빈 칸은 불필요한 표식을 줄임. 관리 열이 오른쪽 설정 전체 높이에 늘어나 하단 공백 큼; 모바일 다수 실은 표를 첫 화면 밖으로 밀어냄. |
| 9. 오류 인지·진단·복구 | 수정 필요 | 비밀번호·휴관·단일 INSERT 경쟁 응답은 이해 가능한 문구(H). 관리 조회 오류는 ‘없음’으로 합쳐지고 상태 저장 실패는 UI 피드백 없음(SR-10). |
| 10. 도움말·문서 | 부분 통과 | 공유 수정 규칙, 읽기 전용 이유, 휴관 연락 필요 안내가 있음. 52주 상한, 과거 쓰기 정책, 인쇄 경로 안내가 충분하지 않음. |

## 세 프로파일의 판단·근거·남은 위험

[웹디자이너](../../../pro/web-designer.md), [UX 디자이너](../../../pro/ux-designer.md), [UI 디자이너](../../../pro/ui-designer.md)를 기준으로 적용했다. 이번 작업은 리뷰만 수행하므로 제품 1·2차 개발을 했다고 주장하지 않는다. ‘전/후’는 구현 전후가 아니라 소스 기반 가설과 실제 검증 후 판단이다.

| 프로파일 | 검증 전 가설 | 검증 후 판정·근거 | 남은 위험 |
| --- | --- | --- | --- |
| 웹디자인 | 표를 먼저 두고 설정을 오른쪽으로 둔 구성은 자주 보는 현황에 맞음 | **수정 필요**. [교사 전체](evidence/03-teacher-representative.png)에서 24건/3개 실 기준 좌측 카드가 1,711px 페이지의 오른쪽 설정 높이에 맞춰 늘어나 큰 공백. [모바일](evidence/31-short-labels-mobile.png)은 54개 칸의 6학년1반이 대부분 잘림. | 대체 글꼴, 실제 학교 수량 분포·장기 교사 사용 미검증. |
| UX | 공유 시트 정책과 반복 예약은 자주 쓰는 교직원에게 효율적 | **수정 필요**. 정상 수정/취소는 명확하나 저장 실패 초안 소실, 동시 입력 덮어쓰기, 주 조회 실패를 빈 표로 표현. [오류 전체](evidence/21-week-load-error.png). | 실제 교사별 예약 소유·과거 기록 정책은 합의 미검증. |
| UI | semantic table, 접근 가능한 칸 이름, focus hook으로 기본 조작 가능 | **수정 필요**. Tab/Shift+Tab, Esc·포커스 복귀 정상(D/E2E). Axe public 19개·teacher 16개 대비 노드 위반. CSS200 dialog top -27.5/bottom 927.5. [전체](evidence/10-repeat-css200.png), [900px viewport](evidence/10-repeat-css200-viewport.png). | 실제 화면 확대·모바일 키보드·스크린리더·테마별 대비 미검증. |

## 여섯 독립 AI 모의 관점

각 관점은 서로 다른 질문으로 따로 평가했다. 아래는 실제 전문가 평가가 아니다.

| 관점 | 판정 | 전체 화면·대표 자료의 근거 | 수정 요구 |
| --- | --- | --- | --- |
| 웹 ① 정보 위계 | 수정 필요 | 교사 현황을 먼저 배치한 것은 적절. 공개 주 선택 바로 아래에 오류 없는 빈 표가 나타나 ‘비어 있음’과 ‘조회 실패’를 구별할 수 없음(21/22 캡처). | 상태/조회 성공을 표보다 선행 정보로 표시, 실패 시 해당 주 쓰기 잠금. |
| 웹 ② 화면 밀도 | 수정 필요 | 3개 실은 무난. 50개 실 모바일은 탭 나열만 길어 표 top가 1,447px로 첫 화면보다 아래(30 캡처). 관리 오른쪽 설정 때문에 좌측 카드가 늘어남(03). | 다수 실 선택을 검색/콤보 등으로 압축, 관리 카드 align-start와 설정 정보 분리. |
| UX ③ 참여자/학생 관점 | 수정 필요 | 회원가입 없는 단일 과제는 쉽지만 6학년1반을 알아보기 위해 각 칸을 열어야 함(31). 실패한 초안은 다시 입력해야 함(06). | 모바일 예약 내용을 인지 가능한 형태로 보여 주고 실패 초안·다시 시도 제공. |
| UX ④ 교사/교실 전자칠판 관점 | 수정 필요 | [1920×1080](evidence/12-electronic-board.png)에서 선택 실 주간 개요는 명확. 모든 실을 한눈에 보는 비교/출력 경로 없음. 원격 종료/휴관이 열린 화면에 반영되지 않음(23/24). | 갱신 시각·재조회, 실 간 비교/요약과 읽을 수 있는 A4 출력. 실제 전자칠판 사용성은 후속 시험. |
| UI ⑤ 접근성 | 수정 필요 | 기본 focus/Esc 정상, 의미 있는 버튼 이름 존재. 대비 부족과 tab 방향키 미지원. 닫기 40px, 휴관 풀기 36px 등은 프로파일 44px 목표보다 작음. | 대비·텍스트 크기 조정, tab 동작 또는 역할 변경, 터치 영역과 확인 단계 focus 재확인. |
| UI ⑥ 반응형/상태 표현 | 수정 필요 | 모바일·교사 CSS200 문서 가로 넘침 0. 미예약/예약/휴관/종료는 텍스트로 구분. CSS200 반복 modal은 높이 955px로 잘림. 반복 실패도 녹색 role=status를 사용(코드). | 의도적인 modal 내부 스크롤, 성공/실패 구분, 좁은·낮은 화면과 입력 키보드 회귀검사. |

## 수정 에이전트용 문제 상세

### SR-01 · P1 · 9교시가 실제 공개 API에서 동작하지 않음

- 코드: [public/index.ts:101](../../../supabase/functions/special-rooms-public/index.ts#L101)~107 `readPeriod`가 >8을 거절. 적용 위치 241. 화면 [types.ts:8](../../../src/features/specialRooms/types.ts#L8) ALL_PERIODS 1~9, DB [202608230001…:24](../../../supabase/migrations/202608230001_special_room_period_and_saturday.sql#L24) 1~9 제약과 불일치.
- 재현: `node design/feature-reviews/2026-10-01-special-rooms/server-mock.mjs`. period=9로 setBooking, setRepeat, clearBooking 요청.
- 확인: **H**, 세 요청 모두 400 ‘교시는 1교시부터 8교시까지입니다.’. D에서는 9교시 행이 나오고 저장됨. [server-mock.json](evidence/server-mock.json).
- 영향: 9교시 방과후 신규 예약 불가. 이미 존재하는 9교시 예약의 변경/삭제도 불가. 데모 E2E가 이 계약 차이를 놓침.
- 수정 요구: 공유 교시 규칙을 사용하여 9를 지원. 운영 교시 검사(SR-08)와 신규/기존 수정 의미를 구분. 서버부터 반영할 수 있게 배포 호환성 검토.
- 완료 기준: 실제 함수 하니스에서 1/8/9 정상 및 0/10 거절, 9교시 생성·수정·반복·취소 일관. 원격 확인은 후속 승인된 시험 환경에서 별도 실시.

### SR-02 · P1 · 주 조회 오류와 응답 순서 역전이 빈 예약표로 보임

- 코드: [PublicSpecialRoomsPage.tsx:44](../../../src/features/specialRooms/PublicSpecialRoomsPage.tsx#L44)~89 load는 요청 세대/취소/active guard 없음; 82에서 무조건 setBoard. 85 error는 board가 있으면 렌더되지 않음(133~139). 주 이동 때 loading도 다시 켜지지 않음.
- 재현: `node …/browser-network-mock.mjs`. 정상 9/28 주 → week 503 상태에서 다음 주. 이어 10/5 응답 450ms, 10/12 응답 60ms로 다음 주를 두 번 선택.
- 확인: **M**. 503에도 alerts=0, 새 날짜의 빈 칸들이 활성화. 빠른 10/12 응답 후 늦은 10/5 자료가 반영되어 10/12 예약 칸이 0개. [21 오류](evidence/21-week-load-error.png), [22 순서 역전](evidence/22-week-response-race.png), [기록](evidence/browser-network-mock.json).
- 영향: 이미 예약된 주를 빈 주로 오인하고 타 예약을 덮거나 중복 의사를 갖게 됨. 로딩·빈 상태 구분이 사라짐.
- 수정 요구: 요청 generation/AbortController, 현재 주와 응답 범위 매칭, 주별 loading/error/retry 상태 및 조회 확인 전 편집 잠금. 이전 자료는 날짜를 유지한 ‘이전 조회 결과’로 표시하거나 명확히 비우되 성공한 빈 표와 구별.
- 완료 기준: 503/지연/연속 주 이동에서 오류가 표시되고 올바른 주 자료만 반영. 실패 후 재시도에 입력/현재 실·주 유지. 순서를 뒤집은 응답 테스트에서 마지막 선택 주의 예약이 남아야 함.

### SR-03 · P1 · 동시 편집이 초안을 지우고 확인 없이 타 예약을 덮음

- 코드: [BookingSheet.tsx:83](../../../src/features/specialRooms/BookingSheet.tsx#L83) current 변경 시 setDraft; 확인 여부는 cellName만 의존(88). [public/index.ts:251](../../../supabase/functions/special-rooms-public/index.ts#L251)~259 기존 행이면 기대 내용/버전 없이 update. clearBooking 342~346도 기대 버전 없음.
- 재현: D에서 10/1 8교시 빈 칸을 열고 ‘먼저 작성중’ 입력 → 다른 페이지가 그 칸에 ‘다른 교사 예약’ 저장 → 시트의 초안이 타 예약으로 변경됨 → 새 내용을 입력해 저장. H에서는 existing이 존재하는 setBooking 요청.
- 확인: **D + H**. 재확인 문구 0, 초안 ‘다른 교사 예약’, 경고 없이 ‘경고없이 덮어쓴 예약’ 저장. H 200 updated=true. [browser-demo.json](evidence/browser-demo.json), [server-mock.json](evidence/server-mock.json).
- 영향: 자기 초안과 다른 교사의 예약을 잃음. 단일 INSERT 유니크 충돌 409는 정상(H)이지만 서버가 기존 행을 읽은 시점부터는 덮어쓰므로 모든 동시 경쟁을 보호하지 못함.
- 수정 요구: 기존 공유 수정 정책을 유지하되 사용자가 본 label/version/updatedAt을 쓰기·취소 조건에 포함. 충돌 때 현재 예약·작성 초안을 둘 다 보존하고 명시적으로 다시 확인. 반복 성공으로 자기 칸이 채워지는 경우와 외부 변경을 구분.
- 완료 기준: 두 사용자 빈 칸 동시 작성 및 기존 칸 수정/취소에서 타 값 변경을 무조건 알리고 초안 보존. 공유 사용자가 명시 확인하면 수정은 계속 가능. 마지막 저장이 항상 승리하는 서버 경로는 제거.

### SR-04 · P2 · 열린 공개 원격 화면에 휴관·종료·운영 설정이 갱신되지 않음

- 코드: [PublicSpecialRoomsPage.tsx:98](../../../src/features/specialRooms/PublicSpecialRoomsPage.tsx#L98)~106 loadWeek는 bookings/schoolDays만 갱신. 구독은 127에서 이것만 부름. [specialRoomsRepository.ts:318](../../../src/features/specialRooms/specialRoomsRepository.ts#L318)~329는 bookings 테이블만 구독. board/closures의 realtime publication도 이 기능 마이그레이션에 없음.
- 재현: M에서 metadata 정상 로드 후 서버 fixture status=closed 또는 closure 추가. 예약 변경 이벤트를 강제로 전달해도 갱신되는 것은 week뿐.
- 확인: **M + C**. 종료 안내 0, 30칸 enabled. 휴관 버튼 0, 첫 칸 disabled=false. [23 종료](evidence/23-stale-status.png), [24 휴관](evidence/24-stale-closure.png).
- 영향: 다른 기기의 교사가 휴관/종료했는데도 열린 사용자는 예약 가능한 상태로 봄. 서버는 재검증해 쓰기를 막는 정상 보호(H)가 있지만 사용자는 뒤늦게 실패를 경험.
- 수정 요구: board/closures/운영 모양 변화도 반영하는 갱신 설계와 수동 새로고침 제공. 예약만 바뀐 경우의 가벼운 조회 최적화는 유지하되 메타 변경을 놓치지 말 것. 갱신 실패 catch와 오류 상태 필요(118의 void loadWeek는 rejection을 방치).
- 완료 기준: 이미 열린 익명 화면에서 종료·재개·휴관·해제·교시/요일 변경을 정해진 시간 내 확인. 공개 익명 사용자의 realtime 수신 권한은 owner-read RLS와 맞는지 승인된 원격 환경에서 별도 검증(현재는 미검증). 새로고침 없이 상태·동작 일치.

### SR-05 · P2 · 단일 저장 실패 시 입력 초안이 사라짐

- 코드: [SpecialRoomWeekGrid.tsx:84](../../../src/features/specialRooms/SpecialRoomWeekGrid.tsx#L84)~94 commit은 요청 결과 전에 setEditing(null). [PublicSpecialRoomsPage.tsx:209](../../../src/features/specialRooms/PublicSpecialRoomsPage.tsx#L209)~213은 booking 배열만 복원.
- 재현: D에서 10/1 9교시 시트에 ‘실패시 보존할 가상 입력’ → localStorage setItem 실패 주입 → 저장 → 다시 같은 칸 열기.
- 확인: **D**. alert ‘가상 저장 실패’, 기존 배열 롤백 정상, 다시 연 draft는 빈 문자열. [06](evidence/06-save-failure.png), [기록](evidence/browser-demo.json).
- 영향: 일시적 실패마다 입력을 재작성해야 함. 사용자는 성공했는지 확인한 뒤 다시 타이핑해야 함.
- 수정 요구: 셀·실·주에 연결한 초안을 요청 완료까지 유지. 실패하면 시트/재시도에서 해당 값 복원. 네트워크 조회 충돌이 초안을 바꾸지 않게 SR-03과 함께 설계.
- 완료 기준: 생성·수정·취소 실패에서 저장 전 예약과 작성 값 유지. 복구 후 재시도가 한 번만 저장되고 상태 안내가 맞음.

### SR-06 · P2 · 특별실 브라우저 출력이 전부 빈 페이지

- 코드: [src/index.css:525](../../../src/index.css#L525)~542 print에서 body * visibility:hidden, 특별실용 visible root 없음. 관리 페이지 전체에도 출력 버튼/프린트 뷰 없음.
- 재현: D의 대표 자료를 Chrome page.pdf A4 portrait/printBackground=true로 출력. Poppler로 전체 페이지 PNG 렌더.
- 확인: **D**. 공개 PDF 1쪽, 교사 PDF 3쪽, 전 페이지 추출 텍스트 0 및 nonwhite pixel 0. [public-a4.pdf](evidence/public-a4.pdf), [teacher-a4.pdf](evidence/teacher-a4.pdf), [PDF 검사](evidence/pdf-inspection.json), [공개 렌더](evidence/public-print-1.png), [교사 1](evidence/teacher-print-1.png), [2](evidence/teacher-print-2.png), [3](evidence/teacher-print-3.png).
- 영향: 교실/특별실 게시·서류 보관용 주간 현황을 출력할 수 없음. 표 잘림 이전에 콘텐츠가 모두 숨겨짐.
- 수정 요구: 선택 주·실·운영 일수·휴관·예약을 담은 특별실 print root와 발견 가능한 출력 기능. QR PNG 기능은 유지. 화면과 출력의 날짜·내용 구조 일치.
- 완료 기준: 화면과 동일 가상 예약/휴관이 A4에 보이고 텍스트·표 겹침/절단 없음. 여러 실·9교시·토요일·긴 이름에서 PDF 모든 페이지 시각 검증. 프린트 CSS 변경은 다른 기능 출력에도 회귀 확인.

### SR-07 · P2 · 반복 예약 경쟁 후 잘못된 성공 수량

- 코드: [public/index.ts:316](../../../supabase/functions/special-rooms-public/index.ts#L316)~339. created를 삽입 전에 확정; unique 실패 후 재조회/left 재삽입하지만 created/skippedTaken을 보정하지 않음.
- 재현: H에서 4주 반복의 최초 multi-row INSERT 직전에 첫 날짜를 타 교사가 차지하게 함. unique 충돌을 반환한 후 서버의 재조회·재삽입 실행.
- 확인: **H**. 결과 created는 4일/skippedTaken=[], 실제 mock DB는 타 예약 1개+본인 3개. [server-mock.json](evidence/server-mock.json)의 ‘반복 INSERT 경쟁 후 잘못된 성공 수량’.
- 영향: 사용자에게 ‘4번 잡았습니다’라고 알리지만 1주는 다른 사람의 예약. 예약 완료를 잘못 판단.
- 수정 요구: 원자적 충돌 건너뛰기·실제 inserted row 반환 방식으로 created/skip 결과 계산. 재시도에서도 다시 경쟁한 항목을 정확히 반영.
- 완료 기준: 반복 중 1개/여러 개 경쟁, 두 번째 재시도 경쟁에서도 각 날짜 실제 결과와 응답 수량이 일치. 실제 DB의 multi-row INSERT 원자성·unique 제약은 후속 시험으로 확인.

### SR-08 · P2 · 운영 모양 밖에 새 예약을 넣을 수 있음

- 코드: [public/index.ts:241](../../../supabase/functions/special-rooms-public/index.ts#L241) 이후 readPeriod는 1~8 범위만 검사. board.period_count/include_saturday와 날짜 요일을 검증하지 않음. setRepeat도 동일.
- 재현: H의 period_count=4 판에 period=8; include_saturday=false 판에 2026-10-03 토요일. 직접 요청한 일요일도 허용.
- 확인: **H**. 모두 200, 화면에 없는 예약이 생성됨. [server-mock.json](evidence/server-mock.json).
- 영향: 예전 탭/오래된 화면/직접 API 요청으로 교사가 받지 않도록 설정한 시간에도 신규 예약 가능. 예약 수와 보이는 표 불일치.
- 수정 요구: 신규·반복 쓰기는 예약표 운영 교시/요일과 일치시킬 것. 이미 보관한 숨은 예약은 그대로 유지하고 읽기·정정·삭제 정책은 분리. 일요일/과거 기록은 제품 정책을 확정하여 일관 적용.
- 완료 기준: 운영 모양 변경 전 열린 화면에서도 현재 모양 밖의 신규 쓰기가 설명 있는 오류로 거절. 기존 숨은 자료는 재확장하면 복원. 9교시 지원과 함께 검사.

### SR-09 · P2 · 학사일정 교체 실패가 기존 휴업일 자료를 삭제

- 코드: [special-rooms-admin/index.ts:146](../../../supabase/functions/special-rooms-admin/index.ts#L146)~154. 기간 delete와 upsert가 별도 DB 요청.
- 재현: H에서 기존 10/1 휴업일을 두고 NEIS 정상 응답 후 upsert만 실패시키기.
- 확인: **H**. 500 응답과 동시에 mock days=[]; delete가 이미 반영되어 rollback 없음. [server-mock.json](evidence/server-mock.json).
- 영향: 재조회 실패인데 이전 휴업일이 사라짐. 반복 예약이 실제 휴업일을 건너뛰지 못할 수 있음.
- 수정 요구: 기간 교체를 DB 트랜잭션/RPC로 원자 처리. NEIS 성공·응답 검증 전 기존 자료를 건드리지 않기. 새 마이그레이션으로 구현하고 기존 이력은 수정하지 않기.
- 완료 기준: NEIS 오류·빈 정상 결과·DB 저장 오류의 의미를 구분. DB 저장 실패면 이전 기간 자료 유지. 원격 RLS/DB 트랜잭션 검증은 승인된 환경에서 후속 실시.

### SR-10 · P2 · 관리 동작 실패와 초기 조회 오류의 복구 부족

- 코드: [SpecialRoomsManagePage.tsx:45](../../../src/features/specialRooms/SpecialRoomsManagePage.tsx#L45) getBoard 예외를 null로 합침; 137 setBoardStatus를 void 호출. [ClosureCard.tsx:82](../../../src/features/specialRooms/ClosureCard.tsx#L82) onRemove도 catch/busy 없음. 관리 197 clipboard.writeText를 기다리지 않고 성공 피드백. 공개 133~139 초기 오류에 retry 없음.
- 재현: D의 상태 저장에 setItem 실패 주입 → 예약 다시 열기. M의 관리 DB 조회 500 및 공개 initial week 503.
- 확인: **D + M**. 상태 요청 pageerror ‘가상 상태 저장 실패’, UI alerts=[]; 관리 조회는 ‘예약표를 찾을 수 없습니다.’, retry=0; 공개도 오류 문구만 있고 버튼0. [14](evidence/14-status-failure.png), [20](evidence/20-initial-load-error.png), [27](evidence/27-teacher-load-error.png). 휴관 해제/복사 실패는 **C만 확인**.
- 영향: 사용자가 저장했는지 모르고 반복 클릭하거나 없는 예약표로 오인. 복사 거절에도 성공 아이콘.
- 수정 요구: 동작별 pending/error/catch, 성공 확인 뒤 피드백. 조회 없음/권한 없음/연결 실패를 구분하되 개인정보 누출 없이 재조회 제공. 기존 데이터·입력 유지.
- 완료 기준: 상태·휴관 해제·클립보드 각각 실패 시 적절한 메시지·재시도, unhandled rejection 없음. 초기 조회 retry가 현재 URL/권한 상태를 다시 확인. 한 클릭당 한 요청.

### SR-11 · P2 · CSS 200%에서 반복 예약 창이 화면 높이를 넘음

- 코드: [BookingSheet.tsx:119](../../../src/features/specialRooms/BookingSheet.tsx#L119)~125 fixed modal, max-height/overflow-y 없음. useDialogFocus는 body 스크롤을 잠금.
- 재현: D 1366×900, document.documentElement.style.zoom='2', 빈 칸 → 매주 반복 체크. 390×568은 정상 높이도 함께 비교.
- 확인: **D**. dialog height955, top -27.5/bottom927.5, viewport900, overflow visible. [전체 캡처](evidence/10-repeat-css200.png), [viewport 잘림](evidence/10-repeat-css200-viewport.png), [측정](evidence/browser-demo.json). 390×568에서는 height477.5로 통과했으므로 모든 작은 화면이 실패한다고 하지 않음.
- 영향: 확대 사용자에게 상단·하단 컨트롤 일부가 화면 밖이고 문서 스크롤로 복구 불가. 실제 모바일 키보드가 나타났을 때의 위험도 남음.
- 수정 요구: 의도적 modal 내부 스크롤 및 viewport 기준 max-height. 고정 footer 필요 여부 판단. scrollContainersAreDeliberate의 대화상자 예외 지침 적용.
- 완료 기준: 200%·낮은 viewport·키보드 표시에서 제목·필드·실행·닫기 모두 스크롤/키보드로 도달. 초점 trapping/복귀와 문서 단일 세로 스크롤 유지.

### SR-12 · P2 · 핵심 시간표 텍스트 대비 부족

- 코드: [src/index.css:70](../../../src/index.css#L70)~72, today 색 79 및 [SpecialRoomWeekGrid.tsx:126](../../../src/features/specialRooms/SpecialRoomWeekGrid.tsx#L126) 이후 날짜/교시/오늘; 공개 277 저장 상태.
- 재현: D 대표 데스크톱에서 AxeBuilder analyze.
- 확인: **D**. public color-contrast 규칙 19개 노드: 날짜/교시 3.31:1, 저장 상태3.78:1, ‘오늘’흰색3.89:1, 안내4.44:1. teacher16개 노드. 상세 selector/html/비율은 [browser-demo.json](evidence/browser-demo.json).
- 영향: 시간 선택과 저장 여부라는 핵심 정보가 저시력·멀리 보는 화면에서 약해짐. 작은 10~12px 텍스트도 확인됨.
- 수정 요구: 공통 planner/theme 텍스트 토큰과 배경 대비 조정, 모바일 날짜/교시 크기 검토. 예약 칩과 오늘/휴업일 색 의미는 유지.
- 완료 기준: 검토한 두 화면의 실제 텍스트 대비 위반 해소. 테마별·모바일·실제 전자칠판 가독성 추가 점검. 자동 검사만으로 시각 검토를 대신하지 말 것.

### SR-13 · P2 · 운영 설정 외부 갱신 후 입력이 옛 값을 유지

- 코드: [BoardInfoCard.tsx:44](../../../src/features/specialRooms/BoardInfoCard.tsx#L44)~55 effect가 periodCount/includeSaturday를 읽지만 dependencies는 title/description뿐.
- 재현: M에서 교사 화면6교시/토요일off 상태를 열고 DB fixture만4교시/토요일on으로 변경 → getBoard 갱신 이벤트.
- 확인: **M**. 표4행+토요일열1, 입력 ‘6’/체크false. 저장 버튼도 옛 값과 현재 board의 차이로 활성화. [26](evidence/26-stale-board-info.png), [기록](evidence/browser-network-mock.json).
- 영향: 저장한 설정과 편집 입력이 충돌하고 다음 제목 변경 저장 때 새 운영 모양을 옛 것으로 되돌릴 수 있음.
- 수정 요구: effect dependency에 운영 모양도 포함. unsaved draft 보존 규칙과 외부 값 변경 알림을 같이 적용.
- 완료 기준: 손대지 않은 입력은 모든 서버 필드 변경을 따라감. 작성 중에는 초안 유지·충돌 안내. 제목만 고치는 저장이 다른 기기 운영 변경을 되돌리지 않음.

### SR-14 · P2 · 모바일에서 짧은 학급명도 인지하기 어려움

- 코드: [SpecialRoomWeekGrid.tsx:230](../../../src/features/specialRooms/SpecialRoomWeekGrid.tsx#L230) mobile 예약 label이 10px·단일행·truncate. 6개 요일의 좁은 칸.
- 재현: D 390×844, 토요일 포함9교시54칸에 ‘6학년1반’, 특별실3개.
- 확인: **D**. clientWidth41px/scrollWidth49px로 짧은 학급명도 ‘6학…’ 정도로 줄어 모든 칸의 구별이 사라짐. [31 전체](evidence/31-short-labels-mobile.png), [browser-boundaries.json](evidence/browser-boundaries.json). 긴 이름 시트를 열면 전체 내용 확인은 정상(E2E).
- 영향: 어떤 학급이 예약했는지 주간표만으로 훑지 못하고 한 칸씩 열어야 함. 종료/휴관의 disabled 칸은 상세 열기 경로도 제한.
- 수정 요구: 최소한 일반 짧은 학급명이 읽히는 텍스트/2행 또는 대체 모바일 개요. 한 주 전체를 보는 장점은 유지하고 개별 내용 조회도 제공.
- 완료 기준: 5/6요일·390/320px에서 6학년1반, 6-1반, 긴 용도와 휴관/종료를 실제 전체 화면으로 평가. 필요한 내용을 알아보려는 반복 클릭을 줄임.

### SR-15 · P3 · 날짜·한국 시간·토요일 범위 문구 불일치

- 코드: [specialRoomWeek.ts:39](../../../src/features/specialRooms/specialRoomWeek.ts#L39) toDateKey는 기기 로컬 시간. 73 formatWeekRange는 항상 +4일. [public/index.ts:146](../../../supabase/functions/special-rooms-public/index.ts#L146)는 today를 UTC로 만들고 학기말 기준에 사용.
- 재현: D 10/1 토요일on 표의 마지막 열10/3, 주 범위는10/2까지. 2027-01-01에는 ‘2026년12월28일~1월1일’, 토요일1/2가 빠짐. 동일 순간 2026-10-04T00:00Z를 서울/LA context로 열기. H에서는 KST 10/2 01시 metadata.
- 확인: **D + H**. 토요일 range mismatch는 [03](evidence/03-teacher-representative.png), [32](evidence/32-year-boundary.png). 일요일 서울은 다음 월요일 표시(의도된 정상), LA는 전 주 토요일 기준. H today UTC10/1로 오늘 시작한 방학10/2를 ‘다음 방학’으로 잡고 termEnd10/1을 반환. [경계 기록](evidence/browser-boundaries.json), [server 기록](evidence/server-mock.json).
- 영향: 주 범위·실제 열·학기말 반복 기본값이 달라 혼동. 해외/다른 시간대 기기의 학교 날짜가 다름.
- 수정 요구: 학교 날짜의 Asia/Seoul 기준을 확정해 클라이언트/서버 공통화. range에 includeSaturday와 연도 경계 반영. 기존 일정 날짜를 재해석해 이동시키지 않기.
- 완료 기준: 한국 자정 전후, 기기 다른 시간대, 일요일 정책, 월/연말, 토요일on/off에서 range·오늘·반복 학기말이 일치. 과거 쓰기 정책은 별도 결정.

### SR-16 · P3 · 많은 특별실과 장기 날짜 탐색의 비용

- 코드: 공개 [PublicSpecialRoomsPage.tsx:235](../../../src/features/specialRooms/PublicSpecialRoomsPage.tsx#L235)~252가 모든 실을 wrapping tab으로 렌더. 주 이동은 ±1주/이번 주만(264~273). 반복은 [specialRoomsRepeat.ts:27](../../../src/features/specialRooms/specialRoomsRepeat.ts#L27) 52주까지 자름.
- 재현: D DB가 허용하는 최대50개 실,390px. 다음 학년도 특정일로 가려면 주 단위 클릭만 가능(C). 마지막 날짜를52주 이후로 고르면52회까지만 미리보기.
- 확인: **D + C**. [30 전체](evidence/30-max-rooms-mobile.png), [경계 측정](evidence/browser-boundaries.json). 단위 검사는52주 상한 통과, 상한은 코드 주석에만 명확. 다음 학년도 휴업일의 NEIS 연동은 실제 미검증.
- 영향: 표가 첫 화면 밖으로 밀리고 원하는 실·먼 날짜 찾기가 비효율. 사용자 의도보다 반복 마지막 날짜가 앞당겨짐을 이해하기 어려움.
- 수정 요구: 다수 실 검색/접근 가능한 선택기, 직접 날짜/주 선택, 반복 최대 기간을 명시·검증. 화면을 여러 세로 스크롤 컨테이너로 나누지 않기.
- 완료 기준: 1/3/50실, 1주/학기/52주 초과 일정에서 과제·읽기 비용을 별도 측정. 실제 교사 사용성 시험은 후속.

### SR-17 · P3 · tab 역할의 방향키 조작이 없음

- 코드: 공개 [PublicSpecialRoomsPage.tsx:238](../../../src/features/specialRooms/PublicSpecialRoomsPage.tsx#L238)~243 및 관리166~168의 role=tab/aria-selected. 방향키/roving tabindex/tabpanel 관계 없음.
- 재현: M의 첫 특별실 tab에 focus → ArrowRight.
- 확인: **M + C**. 선택·focus 모두 가상 과학실 유지. Tab로 각 버튼에 접근하여 Enter로 실 선택은 가능. [기록](evidence/browser-network-mock.json).
- 영향: 보조기술에 tab으로 안내되지만 예상 조작과 다름. 다수 실에서는 모든 tab이 순차 Tab 대상.
- 수정 요구: 완전한 tab 키보드 패턴을 구현하거나 단순 버튼 선택에 맞는 역할·pressed 표현 사용. 선택·표 연결을 명확히.
- 완료 기준: 선언한 역할에 맞는 키보드 탐색, 선택 유지와 초점 이동, 접근 가능한 표/패널명 확인.

### SR-18 · P3 · 데모가 종료 후 반복 예약을 허용

- 코드: [specialRoomsStore.ts:193](../../../src/features/specialRooms/specialRoomsStore.ts#L193) 이후 setRepeat에 board.status/label/room/period 재검증 없음. 단일 setBooking/clearBooking에는 status 검사 존재. 실제 함수221은 종료를 차단.
- 재현: D에서 반복 시트를 열고2주 선택 → 다른 교사 페이지에서 종료 → 열린 시트의 반복 실행.
- 확인: **D + H**. 종료 안내와 ‘2번 잡았습니다’가 동시에 보이며 데모에 생성. H 같은 종료판 setBooking은409. [browser-demo.json](evidence/browser-demo.json), [server-mock.json](evidence/server-mock.json).
- 영향: 데모/기존 E2E가 운영 규칙을 과대평가. 운영 서버가 종료를 허용한다는 뜻은 아님.
- 수정 요구: 데모 저장소도 종료·휴관·운영 모양 규칙을 공통 재사용. 시트가 열린 도중 종료/휴관 시 실행 상태도 맞추기.
- 완료 기준: 종료된 열린 시트와 직접 데모 호출 모두 거절. 운영 함수와 동일 가상 요청 계약 검사가 존재.

## 권한·개인정보·운영 조건

- 교사 목록/생성/관리 UI는 SpecialRoomsAuthGate로 로그인 또는 개발 데모를 구분한다. 특정 이메일 allowlist는 없다(C).
- DB board/rooms/closures는 소유자 RLS, bookings/schoolDays는 소유자 읽기만 허용하는 migration을 확인했다. 관리 NEIS 함수는 JWT getUser와 owner_id를 검사한다. H에서 미인증401/다른 교사403 확인. **실제 RLS 적용 상태는 확인하지 않았다.**
- 공개 함수는 token 형식/보드 존재/비밀번호/방의 board 소속/종료/휴관을 재검증한다. H의 잘못된 비밀번호401, 다른 판의 방404, 종료·휴관409 정상. 제한 RPC 실패는 저장 전에500으로 중단.
- 링크를 아는 사용자끼리 타 예약을 수정/삭제하는 것은 명시된 공유 시트 정책이다. 소유자 없는 예약을 ‘인증 우회’로 분류하지 않았다. SR-03은 이 정책을 바꾸지 않고 동시 변경 확인을 요구한다.
- metadata는 비밀번호 전에 title/rooms/locations/closures/reasons를 반환한다(C). 예약 라벨은 password 확인 뒤 week로 반환한다. 휴관 사유에 개인 사정을 자세히 입력하는 경우의 공개 범위는 후속 운영 안내로 확인할 필요가 있다.
- 실제 학생/학부모/교사 자료·비밀키·로그인 토큰은 사용하거나 기록하지 않았다. 모의 UUID·이메일·비밀번호는 시험 자료이며 외부로 보내지 않았다.
- 공개 realtime 권한, DB unique 경쟁·closure 생성과 쓰기 사이의 원자성, 실제 부하/rate limit, NEIS 공휴일 정확성, 기존 배포된 함수 버전은 미검증이다.
- 생성 폼은 관리 폼의100/500자 상한, DB의 실 이름/위치60자·최대50실을 모두 앞단에서 제한하지 않는다(C). 기존 원격 validation 오류가 사용자에게 DB 문자열로 보일 가능성은 후속 재현 대상으로 남긴다.
- 학교 연결 해제는 코드상 board의 학교 코드만 지우며 받아 둔 schoolDays 삭제 호출은 없다(C). 다른 학교 연결 후 sync 실패/해제 시 이전 휴업일이 남는지 실제 mock/원격 후속 확인 대상이다.

## 정상 확인된 흐름

- 빈 상태 CTA, 제목·안내 없는 경우 생성, Enter 실 행 추가, 프로필 학교 자동 제안(E2E), 4~9교시 행·토요일 표시.
- 링크 발급, 틀린 비밀번호 복구, 맞는 비밀번호 후 표 조회, QR PNG 실제 다운로드(파일 서명 `89504e470d0a1a0a`; QR 링크 디코딩은 미실시).
- 예약 생성·reload 후 조회·기존 예약 확인·취소 보존·변경·예약 지우기, 실별 일정 분리와 주 이동.
- 휴관 기존 예약 감춤/복원, 다른 실 유지, 전체 실 휴관, 반복의 기존 예약·휴관/휴업일 건너뛰기.
- 줄인 교시/토요일 예약을 삭제하지 않음, 확대하면 복원, 저장 전 숨는 수량 안내.
- Tab/Shift+Tab, Esc 닫기와 원래 칸 focus 복귀. 390px 공개·교사 CSS200 문서 가로 넘침0. CSS200 modal은 별도 결함.
- 삭제 확인에 수량/복구 불가/공유 링크 종료 안내. 취소 후 판 보존.
- 날짜 유틸 단위 검사에서 월말/연말·토요일·일요일 다음 주 정책, 반복52주 한도 정상. 정책 정확성과 화면 문구는 별개.

## 실행과 재현

워크트리 루트에서 Node/npm 의존성을 준비한다. 이 검토는 기존 checkout의 node_modules를 전용 워크트리에서 junction으로 참조했다. 소스 파일은 공유 checkout에서 수정하지 않았다.

PowerShell 전용 데모 서버:

~~~powershell
$env:VITE_SPECIAL_ROOMS_DEMO_MODE='true'
$env:VITE_PUBLIC_APP_URL='http://127.0.0.1:4184'
$env:VITE_SUPABASE_URL=''
$env:VITE_SUPABASE_ANON_KEY=''
node node_modules/vite/bin/vite.js --host=127.0.0.1 --port=4184 --strictPort
~~~

Chrome 관찰 도구(각각 새 browser/context, 기존 사용자 profile 사용 안 함):

~~~powershell
node design/feature-reviews/2026-10-01-special-rooms/browser-demo.mjs
node design/feature-reviews/2026-10-01-special-rooms/browser-network-mock.mjs
node design/feature-reviews/2026-10-01-special-rooms/browser-boundaries.mjs
node design/feature-reviews/2026-10-01-special-rooms/server-mock.mjs
~~~

이 도구들은 **기준 코드의 현상을 기록하는 관찰 도구**다. 특히 server-mock의 assert는 현재 결함 응답400/잘못된200도 기대한다. exit0은 재현이 성공했다는 뜻이며 수정 성공·제품 승인으로 쓰면 안 된다. 수정 후에는 완료 기준의 기대값으로 독립 검사를 추가해야 한다.

| 검사 | 결과 | 증거·한계 |
| --- | --- | --- |
| agent-browser 전용 세션 최초 데모 검증 | 통과 | 설치 Chrome으로 목록 열림, key elements, 빈 상태, 오류 없는 초기 페이지. [00](evidence/00-server-empty.png) |
| 특별실 단위7파일 | 98개 통과 | [unit-tests.txt](evidence/unit-tests.txt). `npm test -- tests/unit/specialRoomWeek.test.ts …specialRoomsBoardInfo.test.ts` |
| 특별실 E2E7파일 | 58개 통과 | [special-e2e.txt](evidence/special-e2e.txt). `PLAYWRIGHT_TEST_PORT=4184`, 직접 Playwright CLI로 명시7파일 실행, 실제 Chrome |
| browser-demo | 최종 실행 완료 | [JSON](evidence/browser-demo.json), [실행](evidence/browser-demo-run.txt). 오류 주입 pageerror1개는 결함 증거 |
| browser-network-mock | 실행 완료 | [JSON](evidence/browser-network-mock.json), [실행](evidence/browser-network-mock.txt). 주 조회 실패 pageerror1개 의도 주입, 원격 아님 |
| browser-boundaries | 실행 완료 | [JSON](evidence/browser-boundaries.json), [실행](evidence/browser-boundaries.txt). 기기 timezone·최대실 가상 fixture |
| 실제 함수 server-mock | 관찰20건 완료 | [JSON](evidence/server-mock.json), DB/Auth/NEIS 가짜, 실제 PostgreSQL/Deno 런타임 아님 |
| Axe | 실패 발견 | public19/teacher16 color-contrast 노드. 전체 앱 접근성 승인 아님 |
| Chrome PDF + Poppler/Python | 빈 출력 결함 확인 | [검사](evidence/pdf-inspection.json), 4쪽 전부 흰색. OS 인쇄 대화상자를 사용한 것은 아님 |
| syntax/doc links/git diff | 확인 | 관찰 mjs 문법·보고서 링크/코드 위치·git diff --check, 제품 diff 없음 |

최초 npm wrapper로 `npm run test:e2e -- special-rooms …`를 호출했을 때 출력과 달리254개 전체 테스트가 선택되었다. 관계없는 기능의 데모 환경이 설정되어 있지 않아 실패가 발생했고 **해당 전용 검사 프로세스를 중단**했다. 이를 특별실 실패나 전체 E2E 결과로 사용하지 않았다. 이후 직접 `node node_modules/@playwright/test/cli.js test`에7파일을 명시하고 `--list`로58개 범위를 확인한 뒤 실행해58개 통과를 확인했다. 기존 테스트 파일은 변경하지 않았다.

관찰 스크립트 초기 작성 중 ‘휴관 걸기/검색/role=dialog’가 실제 ‘휴관 추가/찾기/alertdialog’와 달라 timeout이 발생했다. 제품 수정 없이 관찰 선택자만 바로잡았다. 위 JSON·캡처는 최종 완료 실행의 자료다.

미실행: `npm run typecheck`/`npm run lint`/`npm run build`/전체 단위·전체 E2E는 제품·타입·빌드 설정 변경이 없는 리뷰 문서 작업이므로 실행하지 않았다. 관련 기능 검사와 관찰 도구 문법을 실행했다. 원격 통합·운영 로그인·Supabase migration list/deploy·Vercel 배포는 요청 범위에서 제외되어 실행하지 않았다. 로컬 데모 성공을 운영 반영/검증으로 보고하지 않는다.

외부 공용 개발일지 `../schooldoc-docs/development-history.md` 및 기존 공유 checkout 옆 후보 파일, `pro/ux-ui-expert.md`는 이 환경에서 찾지 못했다. 읽었다고 주장하거나 이력을 만들어 적지 않았다. 이번 기록은 요청된 [독립 개발일지](../../../docs/feature-review-special-rooms-2026-10-01.md)에만 남긴다.

## 수정 후 인수 검사 묶음

1. 서버 계약: 9교시·현재 운영 일수/교시·종료/휴관·비밀번호/방 소속·제한 실패·동시 생성/수정/삭제·반복 경쟁 실제 결과.
2. 공개 흐름: 초기 로딩/빈/오류·주 이동 지연 역전·초안 보존/다시 시도·메타 변화·조회 최신 여부.
3. 교사 흐름: 외부 운영 모양 변경, 상태/휴관 해제 실패, 학교 기간 교체 원자성, 공유/출력.
4. 전체 화면: 교사1366/전자칠판1920, 공개390/320, CSS200, 낮은 높이와 모바일 키보드, 0/대표/최대 자료, 짧은/긴 이름, 예약/미예약/휴관/종료.
5. 접근성·출력: 실제 키보드/tab 의미·Axe·색 대비·A4 전 페이지 잘림/겹침/내용 일치·QR PNG.
6. 승인된 시험 환경의 실제 Supabase 권한/RLS/경쟁·NEIS 및 배포 후 기능 확인은 로컬 수정과 구분해 후속 실행.

GitHub 반영·main 병합·DB/Edge/프런트 운영 배포: 모두 **미수행**. 이 결과는 로컬 리뷰·증거 인수 자료다.
