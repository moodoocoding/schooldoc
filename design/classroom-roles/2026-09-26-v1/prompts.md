# 1인 1역 페이지별 이미지 시안 프롬프트

- 생성 방식: 내장 image_gen
- 용도: 화면 설계 검토용 이미지. 구현된 화면이나 실제 학생 기록이 아닙니다.
- 기준: 기존 SchoolDoc 색상·내비게이션, 붙임 HWP의 역할·요일별 업무, 이번 대화에서 정리한 기능.
- 모든 이름과 기록은 가상 예시입니다. QR은 시안용이며 실제 배포 링크가 아닙니다.

## 01. 교사용 운영 목록

출력 파일: `01-teacher-overview.png`

```text
Use case: ui-mockup.
Asset type: High-fidelity Korean SchoolDoc classroom-duty web application design proposal.
Create ONE polished, realistic, implementable application screen, not a marketing poster and not a collage. Flat straight-on screen capture, no photographed computer, no perspective, no browser address bar, no watermarks. Render Korean text very accurately, crisp modern Pretendard / Noto Sans KR sans-serif. All student names are fictional example data.
Design system from existing SchoolDoc app: cool very-light-gray #F6F8FB canvas, white panels, #0F6CBD blue primary actions, #0F172A dark navy text, #526174 secondary text, #DCE3EA hairline borders, modest 8-12px radii, restrained shadows, generous practical whitespace, consistent thin outline icons. Success muted green with a check symbol, unsubmitted neutral gray with a hollow circle, could-not-complete muted amber with x, not-applicable slate with dash. Never rely only on color.
Keep Korean labels short and legible. Avoid tiny filler text, gibberish, enormous empty space, ornamental charts, glossy 3D, gradients, cartoon characters, rankings or rewards.
Landscape desktop screen about 16:10, high resolution. Slim left sidebar 185px conceptually. Top brand small blue square "SD" and "스쿨독". Sidebar items "홈", "진행 중", "1인 1역" highlighted in pale blue, "설정"; bottom "김선생". Main area fills remaining width with 32px gutters. Page title strong 28px equivalent, body 15-16px equivalent. Top small breadcrumb "학급 운영 / 1인 1역". Use a consistent app shell across all teacher views.

Subject: Teacher entry page for monthly classroom role boards.
Main title "1인 1역", subtitle "우리 반의 역할과 실천을 한곳에서 관리해요". Primary top-right button "+ 새 역할표".
Compact filter tabs "진행 중 1" selected, "예정 1", "지난 기록 2".
Main wide active board card: badge "운영 중", title "3학년 2반 · 10월", date "2026.10.01 — 10.31", small "학생 18명 · 역할 18개". A horizontal segmented summary for "오늘 10월 13일 화요일": "완료 12", "미제출 3", "못 했어요 1", "해당 없음 2" in four restrained blocks. Do not call 16 submitted all completed. Primary "오늘 현황 보기", secondary "교실 실천판", tertiary "배포".
Below two equal compact cards: "11월 역할표" with "배정 준비 중", date "2026.11.01 — 11.30", button "배정 이어하기"; and "9월 역할표" with "운영 종료", date "2026.09.01 — 09.30", buttons "기록 보기", "복사해서 만들기".
Bottom subtle bordered helper strip "월별 역할표를 바꿔도 지난 실천 기록은 보관돼요". This page is a clean purposeful dashboard, no large hero illustration.

```

## 02. 역할과 하는 일 설정

출력 파일: `02-role-settings.png`

```text
Use case: ui-mockup.
Asset type: High-fidelity Korean SchoolDoc classroom-duty web application design proposal.
Create ONE polished, realistic, implementable application screen, not a marketing poster and not a collage. Flat straight-on screen capture, no photographed computer, no perspective, no browser address bar, no watermarks. Render Korean text very accurately, crisp modern Pretendard / Noto Sans KR sans-serif. All student names are fictional example data.
Design system from existing SchoolDoc app: cool very-light-gray #F6F8FB canvas, white panels, #0F6CBD blue primary actions, #0F172A dark navy text, #526174 secondary text, #DCE3EA hairline borders, modest 8-12px radii, restrained shadows, generous practical whitespace, consistent thin outline icons. Success muted green with a check symbol, unsubmitted neutral gray with a hollow circle, could-not-complete muted amber with x, not-applicable slate with dash. Never rely only on color.
Keep Korean labels short and legible. Avoid tiny filler text, gibberish, enormous empty space, ornamental charts, glossy 3D, gradients, cartoon characters, rankings or rewards.
Landscape desktop screen about 16:10, high resolution. Slim left sidebar 185px conceptually. Top brand small blue square "SD" and "스쿨독". Sidebar items "홈", "진행 중", "1인 1역" highlighted in pale blue, "설정"; bottom "김선생". Main area fills remaining width with 32px gutters. Page title strong 28px equivalent, body 15-16px equivalent. Top small breadcrumb "학급 운영 / 1인 1역". Use a consistent app shell across all teacher views.

Subject: Creation wizard step 1 role template customization.
Title "우리 반 역할 만들기". Stepper "1 역할 설정" active, "2 학생 배정", "3 배포".
Top slim fields: "역할표 이름" value "3학년 2반 · 10월"; period "2026.10.01 — 10.31"; small setting "교체 주기" value "매월".
Main two-pane editor. Left pane 32% width title "우리 반 역할 18", buttons "기본 역할 불러오기", "+ 역할 추가"; short list with outline icons: "게임마스터" selected, "책 깔끔이", "학습 나눔이", "문을 지키는 자", "지구맨", "사물함 청소부"; bottom "그 외 12개".
Right wide selected role panel title "게임마스터", role-name editable field value "게임마스터", small "필요 인원" stepper value "1명".
Under "하는 일" show two roomy editable rows: row1 text "보드게임 정리하기", schedule pill "매일", timing pill "하교 전"; row2 text "보드게임 서랍장 닦기", weekday chips "월 화 수 목 금" with only 화 and 목 selected, timing "청소 시간". Clear "+ 하는 일 추가" action.
Below optional expanded preview with small label "학생에게 이렇게 보여요", date chip "화요일", two simple checklist items corresponding exactly to the two duties.
Footer actions "임시 저장" secondary, "다음: 학생 배정" blue. Show edit and delete icons only in appropriate role UI. Period of assignment and daily schedule must be visually separate concepts.

```

## 03. 학생 명단과 역할 배정

출력 파일: `03-student-assignment.png`

```text
Use case: ui-mockup.
Asset type: High-fidelity Korean SchoolDoc classroom-duty web application design proposal.
Create ONE polished, realistic, implementable application screen, not a marketing poster and not a collage. Flat straight-on screen capture, no photographed computer, no perspective, no browser address bar, no watermarks. Render Korean text very accurately, crisp modern Pretendard / Noto Sans KR sans-serif. All student names are fictional example data.
Design system from existing SchoolDoc app: cool very-light-gray #F6F8FB canvas, white panels, #0F6CBD blue primary actions, #0F172A dark navy text, #526174 secondary text, #DCE3EA hairline borders, modest 8-12px radii, restrained shadows, generous practical whitespace, consistent thin outline icons. Success muted green with a check symbol, unsubmitted neutral gray with a hollow circle, could-not-complete muted amber with x, not-applicable slate with dash. Never rely only on color.
Keep Korean labels short and legible. Avoid tiny filler text, gibberish, enormous empty space, ornamental charts, glossy 3D, gradients, cartoon characters, rankings or rewards.
Landscape desktop screen about 16:10, high resolution. Slim left sidebar 185px conceptually. Top brand small blue square "SD" and "스쿨독". Sidebar items "홈", "진행 중", "1인 1역" highlighted in pale blue, "설정"; bottom "김선생". Main area fills remaining width with 32px gutters. Page title strong 28px equivalent, body 15-16px equivalent. Top small breadcrumb "학급 운영 / 1인 1역". Use a consistent app shell across all teacher views.

Subject: Creation wizard step 2 assigning students to classroom roles.
Title "학생에게 역할 배정하기". Stepper "1 역할 설정" checked, "2 학생 배정" active, "3 배포".
Below compact period summary "3학년 2반 · 10월" and "10.01 — 10.31". Toolbar buttons "명단 붙여넣기", "학생 추가"; right "번호순".
Main broad assignment table white panel, title "학생 18명 · 배정 완료 17명 · 미배정 1명". Table columns "번호", "이름", "이번 역할", "지난 역할". Render exactly 7 visible sample rows and footer "1–7 / 18명":
1 김하늘 | 게임마스터 | 책 깔끔이
2 이서준 | 책 깔끔이 | 지구맨
3 박지우 | 지구맨 | 학습 나눔이
4 최도윤 | 학습 나눔이 | 문을 지키는 자
5 정서아 | 문을 지키는 자 | 게임마스터
6 한유찬 | 사물함 청소부 | 칠판 지우개
7 오지안 | 역할 선택 (empty dropdown, amber outline) | 복도 청소기
Role cells are dropdowns. Small narrow right panel titled "배정 확인" contains "미배정 학생 1명" with "오지안"; "중복 배정 없음" green; "남은 자리" with "복도 청소기 · 1명". Clear subtle helper "학생 둘을 선택하면 역할을 교환할 수 있어요".
Bottom "이전" secondary, "임시 저장", disabled button "배정을 마치면 다음으로". Avoid enabling publication while someone unassigned.

```

## 04. 링크와 QR 배포

출력 파일: `04-share-distribute.png`

```text
Use case: ui-mockup.
Asset type: High-fidelity Korean SchoolDoc classroom-duty web application design proposal.
Create ONE polished, realistic, implementable application screen, not a marketing poster and not a collage. Flat straight-on screen capture, no photographed computer, no perspective, no browser address bar, no watermarks. Render Korean text very accurately, crisp modern Pretendard / Noto Sans KR sans-serif. All student names are fictional example data.
Design system from existing SchoolDoc app: cool very-light-gray #F6F8FB canvas, white panels, #0F6CBD blue primary actions, #0F172A dark navy text, #526174 secondary text, #DCE3EA hairline borders, modest 8-12px radii, restrained shadows, generous practical whitespace, consistent thin outline icons. Success muted green with a check symbol, unsubmitted neutral gray with a hollow circle, could-not-complete muted amber with x, not-applicable slate with dash. Never rely only on color.
Keep Korean labels short and legible. Avoid tiny filler text, gibberish, enormous empty space, ornamental charts, glossy 3D, gradients, cartoon characters, rankings or rewards.
Landscape desktop screen about 16:10, high resolution. Slim left sidebar 185px conceptually. Top brand small blue square "SD" and "스쿨독". Sidebar items "홈", "진행 중", "1인 1역" highlighted in pale blue, "설정"; bottom "김선생". Main area fills remaining width with 32px gutters. Page title strong 28px equivalent, body 15-16px equivalent. Top small breadcrumb "학급 운영 / 1인 1역". Use a consistent app shell across all teacher views.

Subject: Setup wizard final share/distribution page.
Title "학생들에게 역할표 배포하기". Stepper "1 역할 설정" checked, "2 학생 배정" checked, "3 배포" active.
Top small pale-green strip "18명 모두 역할이 배정되었어요".
Use three clear useful sections, not huge QR marketing panels.
Left largest panel title "학생 개인 링크", short body "자기 역할만 확인하고 실천을 기록해요". Table columns "번호", "이름", "역할", "개인 링크"; 4 fictional rows 김하늘 게임마스터, 이서준 책 깔끔이, 박지우 지구맨, 최도윤 학습 나눔이; each row small outlined "복사" and "QR". Below "개인 QR 안내장 인쇄" button.
Right top panel "교실 공용 기기" with body "교사가 열어 둔 태블릿에서 차례로 체크해요", outlined button "공용 체크 화면 열기".
Right bottom panel "교실 실천판" with body "TV와 전자칠판에 오늘 현황을 보여줘요", button "실천판 열기". Display setting "이름 표시" set to "번호 + 이름 일부".
A small sample QR preview in a corner of left panel labeled "김하늘 개인 QR" with buttons "QR 이미지 저장", "링크 복사"; QR must be clearly illustrative, include tiny but readable "시안용 QR", don't imply real working code or include an actual destination URL.
Bottom unobtrusive note "다음 달에도 같은 개인 링크를 사용해요". Primary bottom-right "운영 시작하기". No actual student secrets, PIN values, working private URLs, or real student information.

```

## 05. 교사용 실천 기록표

출력 파일: `05-teacher-records.png`

```text
Use case: ui-mockup.
Asset type: High-fidelity Korean SchoolDoc classroom-duty web application design proposal.
Create ONE polished, realistic, implementable application screen, not a marketing poster and not a collage. Flat straight-on screen capture, no photographed computer, no perspective, no browser address bar, no watermarks. Render Korean text very accurately, crisp modern Pretendard / Noto Sans KR sans-serif. All student names are fictional example data.
Design system from existing SchoolDoc app: cool very-light-gray #F6F8FB canvas, white panels, #0F6CBD blue primary actions, #0F172A dark navy text, #526174 secondary text, #DCE3EA hairline borders, modest 8-12px radii, restrained shadows, generous practical whitespace, consistent thin outline icons. Success muted green with a check symbol, unsubmitted neutral gray with a hollow circle, could-not-complete muted amber with x, not-applicable slate with dash. Never rely only on color.
Keep Korean labels short and legible. Avoid tiny filler text, gibberish, enormous empty space, ornamental charts, glossy 3D, gradients, cartoon characters, rankings or rewards.
Landscape desktop screen about 16:10, high resolution. Slim left sidebar 185px conceptually. Top brand small blue square "SD" and "스쿨독". Sidebar items "홈", "진행 중", "1인 1역" highlighted in pale blue, "설정"; bottom "김선생". Main area fills remaining width with 32px gutters. Page title strong 28px equivalent, body 15-16px equivalent. Top small breadcrumb "학급 운영 / 1인 1역". Use a consistent app shell across all teacher views.

Subject: Teacher operational weekly record grid, real work screen.
Title "3학년 2반 · 10월". Top actions "배포", "교실 실천판", blue "다음 기간 만들기".
Tabs "오늘 현황", "실천 기록" selected, "역할·학생 설정".
Below one-row compact controls: period "2026년 10월", segmented "주간" selected and "월간", date range "10.12 — 10.16", right actions "휴업일 설정", "인쇄", "Excel".
At top slim summary pills for selected today "10월 13일": "완료 12", "미제출 3", "못 했어요 1", "해당 없음 2".
Broad main weekly table columns "학생", "역할", "12 월", "13 화" highlighted as today, "14 수", "15 목", "16 금". Exactly 6 example rows:
김하늘 | 게임마스터 | green check | green check | pale blank | pale blank | pale blank
이서준 | 책 깔끔이 | green check | hollow circle | pale blank | pale blank | pale blank
박지우 | 지구맨 | green check | green check | pale blank | pale blank | pale blank
최도윤 | 학습 나눔이 | green check | amber x | pale blank | pale blank | pale blank
정서아 | 문을 지키는 자 | green check | green check | pale blank | pale blank | pale blank
한유찬 | 사물함 청소부 | gray dash | gray dash | pale blank | pale blank | pale blank
Footer legend "✓ 완료   ○ 미제출   × 못 했어요   — 해당 없음", extra label "미래 날짜는 기록 전".
On right narrow details pane for selected amber cell: title "최도윤 · 10월 13일", "학습 나눔이", status "못 했어요", caption "학생이 직접 제출한 기록", button "기록 수정", smaller "교사 확인" optional unselected checkbox. No rankings, no completion percentages per student.

```

## 06. 학생 개인 실천 체크

출력 파일: `06-student-mobile.png`

```text
Use case: ui-mockup.
Asset type: High-fidelity Korean SchoolDoc classroom-duty web application design proposal.
Create ONE polished, realistic, implementable application screen, not a marketing poster and not a collage. Flat straight-on screen capture, no photographed computer, no perspective, no browser address bar, no watermarks. Render Korean text very accurately, crisp modern Pretendard / Noto Sans KR sans-serif. All student names are fictional example data.
Design system from existing SchoolDoc app: cool very-light-gray #F6F8FB canvas, white panels, #0F6CBD blue primary actions, #0F172A dark navy text, #526174 secondary text, #DCE3EA hairline borders, modest 8-12px radii, restrained shadows, generous practical whitespace, consistent thin outline icons. Success muted green with a check symbol, unsubmitted neutral gray with a hollow circle, could-not-complete muted amber with x, not-applicable slate with dash. Never rely only on color.
Keep Korean labels short and legible. Avoid tiny filler text, gibberish, enormous empty space, ornamental charts, glossy 3D, gradients, cartoon characters, rankings or rewards.

Subject: ONE mobile student self-report screen. Portrait phone UI filling the image, roughly 9:16 ratio, not a physical phone and no surrounding device scene. No teacher sidebar. Large accessible labels, child-friendly calm interface using same blue and soft green.
Top compact brand "SD 스쿨독"; small class "3학년 2반"; top-right "내 기록". Date "10월 13일 화요일".
Friendly main greeting "하늘아, 오늘의 역할을 확인해 봐!" and identity small "1번 김하늘".
Central white role card with small simple boardgame line icon in blue-soft circle, large title "게임마스터", small assignment period "10월 1일 — 10월 31일".
Section title "오늘 할 일". Two comfortably spaced outlined checklist rows:
"보드게임 정리하기" with secondary "하교 전 · 매일"
"보드게임 서랍장 닦기" with secondary "청소 시간 · 화·목"
Both task checkboxes visibly checked. These are reminders, final role-level submission is separate.
Below divider title "오늘은 어땠나요?". Three stacked full-width big radio-option buttons: green-soft selected "✓ 다 했어요", neutral "아직 못 했어요", neutral "오늘은 할 일이 없었어요".
Large blue bottom action "오늘 기록 제출하기".
Small secondary helper "제출한 뒤에도 오늘 기록은 바꿀 수 있어요".
Maintain generous readable whitespace but fit all key controls without cropping, no gamification, no photos, no login fields, no classmates' records.

```

## 07. 교실 공용 기기 체크

출력 파일: `07-classroom-kiosk.png`

```text
Use case: ui-mockup.
Asset type: High-fidelity Korean SchoolDoc classroom-duty web application design proposal.
Create ONE polished, realistic, implementable application screen, not a marketing poster and not a collage. Flat straight-on screen capture, no photographed computer, no perspective, no browser address bar, no watermarks. Render Korean text very accurately, crisp modern Pretendard / Noto Sans KR sans-serif. All student names are fictional example data.
Design system from existing SchoolDoc app: cool very-light-gray #F6F8FB canvas, white panels, #0F6CBD blue primary actions, #0F172A dark navy text, #526174 secondary text, #DCE3EA hairline borders, modest 8-12px radii, restrained shadows, generous practical whitespace, consistent thin outline icons. Success muted green with a check symbol, unsubmitted neutral gray with a hollow circle, could-not-complete muted amber with x, not-applicable slate with dash. Never rely only on color.
Keep Korean labels short and legible. Avoid tiny filler text, gibberish, enormous empty space, ornamental charts, glossy 3D, gradients, cartoon characters, rankings or rewards.

Subject: ONE landscape shared classroom tablet kiosk UI, approximately 4:3 ratio. Front-on screen itself with no physical device, no teacher sidebar. Teacher has already opened classroom session. Optimized large touch targets for elementary students.
Top left "SD 스쿨독"; top right small lock icon "교사용 메뉴".
Main title "내 이름을 찾아 눌러 주세요", subtitle "3학년 2반 · 10월 13일 화요일".
Small quiet guidance "내 역할을 확인하고 오늘의 실천을 기록해요".
Centered white search input with icon, placeholder "번호 또는 이름 찾기".
Main 4-column by 3-row grid with exactly 12 generous rectangular student buttons, no role status or rankings on the selection screen. Each button shows small student number and large name, with tiny generic outline person circle:
1 김하늘, 2 이서준, 3 박지우, 4 최도윤,
5 정서아, 6 한유찬, 7 오지안, 8 윤시우,
9 임서윤, 10 장도하, 11 송하린, 12 조예준.
Bottom pagination "1 / 2" and large "다음 학생 →". Small centered footer "내 이름을 선택한 뒤 개인 코드로 확인해요".
Show an in-place highlighted focus border around first student's tile to communicate next action but no modal overlay. Minimal cognitive load, consistent large typography. Don't display any private code value or other student completion history.

```

## 08. 교실 TV·전자칠판 실천판

출력 파일: `08-classroom-board.png`

```text
Use case: ui-mockup.
Asset type: High-fidelity Korean SchoolDoc classroom-duty web application design proposal.
Create ONE polished, realistic, implementable application screen, not a marketing poster and not a collage. Flat straight-on screen capture, no photographed computer, no perspective, no browser address bar, no watermarks. Render Korean text very accurately, crisp modern Pretendard / Noto Sans KR sans-serif. All student names are fictional example data.
Design system from existing SchoolDoc app: cool very-light-gray #F6F8FB canvas, white panels, #0F6CBD blue primary actions, #0F172A dark navy text, #526174 secondary text, #DCE3EA hairline borders, modest 8-12px radii, restrained shadows, generous practical whitespace, consistent thin outline icons. Success muted green with a check symbol, unsubmitted neutral gray with a hollow circle, could-not-complete muted amber with x, not-applicable slate with dash. Never rely only on color.
Keep Korean labels short and legible. Avoid tiny filler text, gibberish, enormous empty space, ornamental charts, glossy 3D, gradients, cartoon characters, rankings or rewards.

Subject: ONE full-screen classroom display board UI in wide 16:9 high resolution. No teacher sidebar, no browser chrome, no editing controls, no phone. Attractive calm wall-board aesthetic made of clean white digital cards on #F6F8FB, large readable Korean.
Header left compact "스스로, 함께 가꾸는 우리 반" and large "오늘의 1인 1역"; right "3학년 2반" and "10월 13일 화요일". Small "자동 새로고침 켜짐".
Top slim counts exactly "완료 12명", "미제출 3명", "못 했어요 1명", "해당 없음 2명".
Main six-column by three-row grid, exactly 18 equally sized role cards. Every card large role name, masked fictional student e.g. "1번 김○늘", and status symbol plus text.
Rows in order:
1 게임마스터 / 1번 김○늘 / ✓ 완료
2 책 깔끔이 / 2번 이○준 / ○ 미제출
3 지구맨 / 3번 박○우 / ✓ 완료
4 학습 나눔이 / 4번 최○윤 / × 못 했어요
5 문을 지키는 자 / 5번 정○아 / ✓ 완료
6 사물함 청소부 / 6번 한○찬 / — 해당 없음
7 복도 청소기 / 7번 오○안 / ✓ 완료
8 당근마켓 / 8번 윤○우 / ✓ 완료
9 칠판 지우개 / 9번 임○윤 / ✓ 완료
10 매의 눈 / 10번 장○하 / ○ 미제출
11 앞 빗자루 / 11번 송○린 / ✓ 완료
12 뒷 빗자루 / 12번 조○준 / ✓ 완료
13 쓰레기통 청소요정 / 13번 문○아 / ✓ 완료
14 책상줄 관리자 / 14번 배○후 / ✓ 완료
15 어린이 경찰관 / 15번 백○은 / ○ 미제출
16 피카츄 / 16번 신○재 / ✓ 완료
17 겨울왕국 / 17번 안○빈 / — 해당 없음
18 준비물 도우미 / 18번 강○원 / ✓ 완료
Every status label is calm small badge rather than a punitive large red cross. Names are masked consistently. No private notes or absence reasons. Bottom small legend "✓ 완료   ○ 미제출   × 못 했어요   — 해당 없음". Fit all 18 cards comfortably, equal hierarchy, no trophy or progress race.

```

## 09. 다음 기간 역할 교체

출력 파일: `09-next-period.png`

```text
Use case: ui-mockup.
Asset type: High-fidelity Korean SchoolDoc classroom-duty web application design proposal.
Create ONE polished, realistic, implementable application screen, not a marketing poster and not a collage. Flat straight-on screen capture, no photographed computer, no perspective, no browser address bar, no watermarks. Render Korean text very accurately, crisp modern Pretendard / Noto Sans KR sans-serif. All student names are fictional example data.
Design system from existing SchoolDoc app: cool very-light-gray #F6F8FB canvas, white panels, #0F6CBD blue primary actions, #0F172A dark navy text, #526174 secondary text, #DCE3EA hairline borders, modest 8-12px radii, restrained shadows, generous practical whitespace, consistent thin outline icons. Success muted green with a check symbol, unsubmitted neutral gray with a hollow circle, could-not-complete muted amber with x, not-applicable slate with dash. Never rely only on color.
Keep Korean labels short and legible. Avoid tiny filler text, gibberish, enormous empty space, ornamental charts, glossy 3D, gradients, cartoon characters, rankings or rewards.
Landscape desktop screen about 16:10, high resolution. Slim left sidebar 185px conceptually. Top brand small blue square "SD" and "스쿨독". Sidebar items "홈", "진행 중", "1인 1역" highlighted in pale blue, "설정"; bottom "김선생". Main area fills remaining width with 32px gutters. Page title strong 28px equivalent, body 15-16px equivalent. Top small breadcrumb "학급 운영 / 1인 1역". Use a consistent app shell across all teacher views.

Subject: Teacher copies October classroom role board to November and revises assignments while preserving previous records.
Title "다음 기간 역할 바꾸기". Subtitle "10월의 역할과 학생 명단을 가져왔어요".
Top two tidy fields: "새 역할표 이름" value "3학년 2반 · 11월"; "운영 기간" value "2026.11.01 — 11.30".
A thin blue information strip with archive icon: "10월 역할표와 실천 기록은 그대로 보관돼요".
Main panel heading "다음 역할 배정", toolbar "이전 배정 유지", "역할 순환" selected outline blue button. Subtitle "순환 결과를 확인하고 필요한 역할을 직접 바꿔 주세요".
Broad table columns "학생", "10월 역할", arrow, "11월 역할"; six visible sample rows:
김하늘 | 게임마스터 | → | 책 깔끔이
이서준 | 책 깔끔이 | → | 지구맨
박지우 | 지구맨 | → | 학습 나눔이
최도윤 | 학습 나눔이 | → | 문을 지키는 자
정서아 | 문을 지키는 자 | → | 사물함 청소부
한유찬 | 사물함 청소부 | → | 게임마스터
New roles are editable dropdowns, old roles muted text. Footer table "18명 모두 배정됨".
Below small panel "학생 개인 링크 유지" with checked toggle and explanation "기존 링크에서 새 역할을 확인할 수 있어요".
Bottom secondary "임시 저장", primary "11월 1일부터 운영 예약". Date-bound activation, not immediate reassignment. No destructive reset or deletion button.

```

