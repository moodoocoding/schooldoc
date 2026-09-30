# 1인 1역 v2 이미지 생성 프롬프트

생성 방식: 내장 image_gen. 모든 시안은 가상 자료입니다. 개별 링크·QR·개인 코드 제거, 월별 학생 타일, 2단계 배정을 반영합니다.

## 02 최종 보정: 상세 뒤의 대시보드 일치

최초 생성한 02를 편집 대상으로, 01 대시보드를 참고 이미지로 사용했습니다.

```text
Use case: compositing. Image 1 is the edit target: a Korean student detail drawer screenshot. Image 2 is the supporting reference: the correct underlying October dashboard. Fix ONLY the background screen behind the right-hand drawer in Image 1. Replace its incorrect "총 24명" and different student tiles with the actual October dashboard from Image 2, dimmed and cropped naturally behind the overlay. The class has 18 students and the dashboard has 3x3 tiles per page. Maintain the original drawer of Image 1 unchanged: "1번 김하늘", "게임마스터", totals 6/0/1/0, seven October log rows, teacher memo, close buttons, Korean text, size, layout. Keep the white SchoolDoc sidebar consistent. Do not redesign or modify any drawer content, do not invent additional students. Entire output is one fully opaque landscape UI screenshot.
```

## 01. 선택한 달의 학생별 대시보드

파일: `01-monthly-student-dashboard.png`

```text
Use case: ui-mockup. Create a high-fidelity Korean SchoolDoc UI design proposal. ONE flat complete application screenshot, not a poster or collage, no device photograph, no perspective, no watermarks. Fully opaque continuous pale-gray #F6F8FB canvas and white panels; no transparency, torn edges or black gaps. Crisp accurate Korean in Pretendard / Noto Sans KR. Existing SchoolDoc palette #0F6CBD blue actions, #0F172A text, #526174 secondary, #DCE3EA borders, 10px rounded corners, restrained shadows, thin line icons. All names/data fictional. Practical spacious professional UI. No rewards, rankings, photos or decorative charts.
Landscape desktop 16:10. Left slim white sidebar with blue square "SD" and "스쿨독", navigation "홈", "진행 중", highlighted "1인 1역", "설정", bottom "김선생". Main area 32px gutters, title 28px, readable labels. Only selected month October data. Never show other-month cards. No individual student link, QR, PIN or password anywhere.

Title "우리 반 1인 1역". Header controls class "3학년 2반", month selector "2026년 10월" with previous/next chevrons. Right buttons "학생 배정", blue "학생 화면 공유". Secondary small action "교실 실천판".
One compact horizontal summary titled "오늘 · 10월 13일" with "완료 12", "미제출 3", "못 했어요 1", "해당 없음 2". Filter controls "전체 18명" selected, "미제출", search field "학생 찾기".
Main content MUST be exactly a 3-column by 3-row grid of 9 student tiles, equal size. Each tile shows number + student name as strongest title; role; today's status chip; monthly cumulative text; bottom-right chevron with "상세 보기". Student names, roles, status, monthly totals:
1 김하늘 / 게임마스터 / ✓ 완료 / "누적 완료 6회 · 기록 7일"
2 이서준 / 책 깔끔이 / ○ 미제출 / "누적 완료 5회 · 기록 6일"
3 박지우 / 지구맨 / ✓ 완료 / "누적 완료 6회 · 기록 7일"
4 최도윤 / 학습 나눔이 / × 못 했어요 / "누적 완료 5회 · 기록 7일"
5 정서아 / 문을 지키는 자 / ✓ 완료 / "누적 완료 7회 · 기록 7일"
6 한유찬 / 사물함 청소부 / — 해당 없음 / "누적 완료 3회 · 기록 7일"
7 오지안 / 복도 청소기 / ✓ 완료 / "누적 완료 6회 · 기록 7일"
8 윤시우 / 당근마켓 / ✓ 완료 / "누적 완료 6회 · 기록 7일"
9 임서윤 / 칠판 지우개 / ✓ 완료 / "누적 완료 7회 · 기록 7일"
Small section label above grid "10월 학생별 누적 기록". Green check for done, neutral hollow circle unsubmitted, amber x could not, slate dash N/A. First tile blue focus border indicates clickability. Footer "1–9 / 18명" and pagination "1 2". No rows of other months, no workflow creation stepper, no big per-period cards. Grid dominates screen.

```

## 02. 타일을 눌렀을 때의 학생 상세 기록

파일: `02-student-record-detail.png`

```text
Use case: ui-mockup. Create a high-fidelity Korean SchoolDoc UI design proposal. ONE flat complete application screenshot, not a poster or collage, no device photograph, no perspective, no watermarks. Fully opaque continuous pale-gray #F6F8FB canvas and white panels; no transparency, torn edges or black gaps. Crisp accurate Korean in Pretendard / Noto Sans KR. Existing SchoolDoc palette #0F6CBD blue actions, #0F172A text, #526174 secondary, #DCE3EA borders, 10px rounded corners, restrained shadows, thin line icons. All names/data fictional. Practical spacious professional UI. No rewards, rankings, photos or decorative charts.
Landscape desktop 16:10. Left slim white sidebar with blue square "SD" and "스쿨독", navigation "홈", "진행 중", highlighted "1인 1역", "설정", bottom "김선생". Main area 32px gutters, title 28px, readable labels. Only selected month October data. Never show other-month cards. No individual student link, QR, PIN or password anywhere.

Show student detail in a wide white drawer occupying right 58% of screen. Behind drawer, dimmed October student-tile dashboard showing a 3-column tile grid on left, NOT different-month boards. Drawer header small "2026년 10월", title "1번 김하늘", role chip "게임마스터", close X.
Four compact totals "완료 6", "못 했어요 0", "해당 없음 1", "미제출 0".
Role-description strip titled "맡은 일": "보드게임 정리하기 · 매일", "서랍장 닦기 · 화·목".
Main detail table titled "10월 날짜별 기록", columns "날짜", "상태", "입력 경로", and tiny edit action. Render seven rows exactly:
10.13 화 | ✓ 완료 | 학생 입력
10.12 월 | ✓ 완료 | 학생 입력
10.08 목 | ✓ 완료 | 학생 입력
10.07 수 | ✓ 완료 | 학생 입력
10.06 화 | ✓ 완료 | 학생 입력
10.02 금 | — 해당 없음 | 교사 수정
10.01 목 | ✓ 완료 | 학생 입력
Small pencil button "수정" per row. Light-blue selected today row. Below teacher-only note box labeled "교사 메모", placeholder "필요한 내용을 남겨 주세요". Small hint "학생 화면에는 표시되지 않아요". Footer "기록 인쇄" secondary, "닫기". No student ranking, no individual QR, no authenticated-identity claim. All records shown belong to October and to 김하늘 only.

```

## 03. 1단계 · 학생 명단 받기

파일: `03-step1-student-roster.png`

```text
Use case: ui-mockup. Create a high-fidelity Korean SchoolDoc UI design proposal. ONE flat complete application screenshot, not a poster or collage, no device photograph, no perspective, no watermarks. Fully opaque continuous pale-gray #F6F8FB canvas and white panels; no transparency, torn edges or black gaps. Crisp accurate Korean in Pretendard / Noto Sans KR. Existing SchoolDoc palette #0F6CBD blue actions, #0F172A text, #526174 secondary, #DCE3EA borders, 10px rounded corners, restrained shadows, thin line icons. All names/data fictional. Practical spacious professional UI. No rewards, rankings, photos or decorative charts.
Landscape desktop 16:10. Left slim white sidebar with blue square "SD" and "스쿨독", navigation "홈", "진행 중", highlighted "1인 1역", "설정", bottom "김선생". Main area 32px gutters, title 28px, readable labels. Only selected month October data. Never show other-month cards. No individual student link, QR, PIN or password anywhere.

Title "10월 학생 배정". EXACTLY TWO wizard steps: active "1 학생 명단" and inactive "2 학생별 역할". Do not add roles-creation, review or distribution as step 3.
Top slim summary "3학년 2반 · 2026년 10월".
Prominent gentle-blue info strip with check icon "설정에 저장된 학생 명단 18명을 자동으로 불러왔어요". No separate import click required. Right small text button "설정의 명단 보기".
White panel title "학생 명단 18명". Toolbar "명단 붙여넣기", "+ 학생 추가". Neat editable table columns "번호", "이름", "관리". Six visible sample rows with rectangular editable fields:
1 김하늘, 2 이서준, 3 박지우, 4 최도윤, 5 정서아, 6 한유찬.
Each row small delete icon only. Footer "1–6 / 18명" and pagination "1 2 3". Tiny hint "번호와 이름을 확인해 주세요".
Compact calm callout below table "설정에 명단이 없으면 붙여넣기 또는 직접 입력으로 시작해요".
Bottom left "취소"; bottom right blue primary "다음: 학생별 역할 설정".
No role dropdowns, role templates, schedules, QR, or per-student performance on this step. Focus solely roster auto-population and editing.

```

## 04. 2단계 · 학생별 역할 설정

파일: `04-step2-role-assignment.png`

```text
Use case: ui-mockup. Create a high-fidelity Korean SchoolDoc UI design proposal. ONE flat complete application screenshot, not a poster or collage, no device photograph, no perspective, no watermarks. Fully opaque continuous pale-gray #F6F8FB canvas and white panels; no transparency, torn edges or black gaps. Crisp accurate Korean in Pretendard / Noto Sans KR. Existing SchoolDoc palette #0F6CBD blue actions, #0F172A text, #526174 secondary, #DCE3EA borders, 10px rounded corners, restrained shadows, thin line icons. All names/data fictional. Practical spacious professional UI. No rewards, rankings, photos or decorative charts.
Landscape desktop 16:10. Left slim white sidebar with blue square "SD" and "스쿨독", navigation "홈", "진행 중", highlighted "1인 1역", "설정", bottom "김선생". Main area 32px gutters, title 28px, readable labels. Only selected month October data. Never show other-month cards. No individual student link, QR, PIN or password anywhere.

Title "10월 학생 배정". EXACTLY TWO steps: completed "1 학생 명단", active "2 학생별 역할".
Top summary "3학년 2반 · 2026년 10월". Prominent compact counters "전체 학생 18명", "배정 완료 17명", amber "미배정 1명", blue "남은 역할 1개".
Main white table 70% width columns "번호", "학생", "이번 달 역할". Seven visible rows:
1 김하늘 / 게임마스터 dropdown
2 이서준 / 책 깔끔이 dropdown
3 박지우 / 지구맨 dropdown
4 최도윤 / 학습 나눔이 dropdown
5 정서아 / 문을 지키는 자 dropdown
6 한유찬 / 사물함 청소부 dropdown
7 오지안 / empty dropdown "역할을 선택해 주세요" amber outlined
Footer "1–7 / 18명".
Right 30% sidebar panel title "남은 역할 1개". One large selectable role chip "복도 청소기" with subtext "1명 배정 가능". Clear action hint "오지안에게 배정할 역할을 선택해 주세요". Below note "배정하면 남은 역할 수가 줄어들어요". Unassigned student named in small amber row.
Bottom left "이전: 학생 명단", right "임시 저장" secondary and visibly disabled "배정 완료". Small helper "미배정 학생 1명을 확인해 주세요".
No third step. No nested role builder, task schedules, individual links or QR. The role pool is an existing illustrative list, not a new complicated creation form.

```

## 05. 모든 학생에게 같은 화면 배포

파일: `05-shared-student-link.png`

```text
Use case: ui-mockup. Create a high-fidelity Korean SchoolDoc UI design proposal. ONE flat complete application screenshot, not a poster or collage, no device photograph, no perspective, no watermarks. Fully opaque continuous pale-gray #F6F8FB canvas and white panels; no transparency, torn edges or black gaps. Crisp accurate Korean in Pretendard / Noto Sans KR. Existing SchoolDoc palette #0F6CBD blue actions, #0F172A text, #526174 secondary, #DCE3EA borders, 10px rounded corners, restrained shadows, thin line icons. All names/data fictional. Practical spacious professional UI. No rewards, rankings, photos or decorative charts.
Landscape desktop 16:10. Left slim white sidebar with blue square "SD" and "스쿨독", navigation "홈", "진행 중", highlighted "1인 1역", "설정", bottom "김선생". Main area 32px gutters, title 28px, readable labels. Only selected month October data. Never show other-month cards. No individual student link, QR, PIN or password anywhere.

Title "학생 화면 공유". Subtitle "우리 반 모든 학생이 같은 화면을 사용해요". Class and period "3학년 2반 · 2026년 10월". This is a share page opened from dashboard, NOT wizard step 3. Do not render a creation stepper.
One dominant white panel header "우리 반 공통 링크". URL input displaying reserved illustrative example "schooldoc.example/s/classroom", small clear caption "시안용 예시 주소". Adjacent blue button "링크 복사" and outlined button "학생 화면 열기".
Below horizontal three-part simple user flow with small numbered circles: "1 같은 링크 열기" -> "2 내 이름 선택" -> "3 했어요 / 못했어요".
Below two medium equal panels:
"학생 기기에서" with tablet/phone line icon and short "같은 링크를 학급에 공유해요".
"교실 공용 기기에서" with desktop line icon and short "공통 화면을 열어 두고 차례로 체크해요", button "공용 화면 열기".
Bottom pale-blue information "다음 달에도 같은 학급 링크를 사용해요".
Bottom navigation "대시보드로 돌아가기".
Absolutely no QR anywhere, no individual link table, no student-list management, no PIN or login, no secret token field, no separate personalized links. Plenty of clean whitespace but practical balanced screen.

```

## 06. 학생 공통 화면 · 이름 선택

파일: `06-shared-name-selection.png`

```text
Use case: ui-mockup. Create a high-fidelity Korean SchoolDoc UI design proposal. ONE flat complete application screenshot, not a poster or collage, no device photograph, no perspective, no watermarks. Fully opaque continuous pale-gray #F6F8FB canvas and white panels; no transparency, torn edges or black gaps. Crisp accurate Korean in Pretendard / Noto Sans KR. Existing SchoolDoc palette #0F6CBD blue actions, #0F172A text, #526174 secondary, #DCE3EA borders, 10px rounded corners, restrained shadows, thin line icons. All names/data fictional. Practical spacious professional UI. No rewards, rankings, photos or decorative charts.
Portrait mobile screen approximately 9:16, edge-to-edge app UI without physical phone frame. Large comfortable touch targets, Korean elementary-student reading level, blue and soft green accents, no teacher sidebar. Top small blue square "SD" and "스쿨독", "3학년 2반". Every student uses the SAME shared URL. No individual QR, individual link, login, password or personal code. Names are selection targets, not verified identities. Do not display any other student's private cumulative record.

Top date "10월 13일 화요일". Main large heading "내 이름을 눌러 주세요". Small subtitle "이름을 고르고 오늘 역할을 체크해요".
Search field "번호 또는 이름 찾기".
Exactly 3 columns by 3 rows of large touchable name buttons, enough comfortable width and height:
1 김하늘, 2 이서준, 3 박지우,
4 최도윤, 5 정서아, 6 한유찬,
7 오지안, 8 윤시우, 9 임서윤.
Each tile small number above large name, small outline person icon optional. First tile has subtle blue focus ring. Names not roles dominate. No completion counts, no grades, no cumulative performance exposed. Footer pagination "1 / 2" with large "다음 →".
Below small neutral information "내 이름을 선택하면 오늘 역할이 보여요".
Do not show private QR, personal code, password, login, identity-verification prompt, or student personal-history link. All nine tiles fit within the screen.

```

## 07. 학생 공통 화면 · 역할 체크

파일: `07-shared-role-check.png`

```text
Use case: ui-mockup. Create a high-fidelity Korean SchoolDoc UI design proposal. ONE flat complete application screenshot, not a poster or collage, no device photograph, no perspective, no watermarks. Fully opaque continuous pale-gray #F6F8FB canvas and white panels; no transparency, torn edges or black gaps. Crisp accurate Korean in Pretendard / Noto Sans KR. Existing SchoolDoc palette #0F6CBD blue actions, #0F172A text, #526174 secondary, #DCE3EA borders, 10px rounded corners, restrained shadows, thin line icons. All names/data fictional. Practical spacious professional UI. No rewards, rankings, photos or decorative charts.
Portrait mobile screen approximately 9:16, edge-to-edge app UI without physical phone frame. Large comfortable touch targets, Korean elementary-student reading level, blue and soft green accents, no teacher sidebar. Top small blue square "SD" and "스쿨독", "3학년 2반". Every student uses the SAME shared URL. No individual QR, individual link, login, password or personal code. Names are selection targets, not verified identities. Do not display any other student's private cumulative record.

This is the common classroom screen AFTER choosing a name. Top navigation arrow "이름 다시 선택". Date "10월 13일 화요일". Main large identity heading "1번 김하늘".
White central role panel with simple boardgame outline icon, title "게임마스터". Section "오늘 할 일" with just TWO plain informational bullet rows, no checkboxes:
"보드게임 정리하기" small "매일 · 하교 전"
"보드게임 서랍장 닦기" small "화·목 · 청소 시간"
Below question "오늘 역할을 했나요?".
Two very large stacked direct-action buttons. First selected green "✓ 했어요". Second neutral outline "못했어요". Exactly these two choices. No extra Submit button, no extra task checkboxes, no photo evidence, no personal QR.
Below a gentle-green success confirmation "오늘 기록이 저장되었어요" showing the after-click state. Small text "잘못 눌렀다면 다시 선택해 주세요".
Bottom wide blue navigation "이름 선택으로 돌아가기". Small note "다음 친구도 같은 화면에서 체크해요".
No personal history navigation, passwords, PINs, QR, login or third choice. Text large and correct; no clutter or ornament.

```
