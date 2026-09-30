# SchoolDoc 시안 생성 프롬프트

- 일자: 2026-09-27
- 도구: 내장 `image_gen` / 신규 이미지 생성 모드
- 외부 API·CLI 사용 없음
- 입력 참조 이미지 없음. 공식 사이트 조사에서 추출한 화면 원칙을 문장으로 지정했다.
- 모든 인물·학교·업무 수치는 가상 예시다.

## 역할 배정 수정 프롬프트

첫 결과의 왼쪽 메뉴에 임의 기능이 포함돼, 홈과 같은 실제 도구 목록으로 바로잡았다. 내장 image_gen 편집 모드. 입력 1: 역할 배정 최초 결과. 입력 2: 홈 최초 결과(메뉴 스타일 참고).

```text
Use case: precise-object-edit / ui-mockup. Image 1 is the edit target, SchoolDoc student role assignment screenshot. Image 2 is ONLY a sidebar design reference from the same product. Edit Image1 while preserving its entire main assignment UI pixel-for-pixel as much as possible: all24 named students, 12role rows, counters24/20/4, selection student17, 4unassigned, fonts colors and overall landscape dimensions.
ONLY correct the left navigation to use real SchoolDoc features matching image2, and change the top-right user label to "김담임". Left sidebar: preserve brand SchoolDoc at top, "가상초등학교" and "5학년 3반". Then rows "홈" and "진행 중인 업무"; divider; section label "학급 업무"; six rows in this exact order "1인 1역" (the ONLY selected blue row), "가정통신문", "학생 결과 안내", "등록부 서명", "자료 수합", "특별실 예약". At bottom "도움말", "설정", and small avatar "김담임" matching image2. Remove invented navigation 오늘의 할 일, 주간 계획, 학급 문서, 학생 관리, 알림. Use simple elegant outline icons. Preserve the assignment workspace and footer. No other changes. Crisp exact Korean.
```

## 교사 홈

```text
Use case: ui-mockup.
Create an exceptionally polished, believable commercial Korean teacher productivity web application design for SchoolDoc. This is an original art direction informed by calm professional task lists (Linear), contextual data views (Airtable), and legible Korean people management (flex), not a copy of any other brand. Render a high-fidelity flat screenshot, pixel-sharp typography, precise grid, all interface labels in clean accurate Korean using a Pretendard/Noto Sans Korean-like sans-serif. Brand wordmark exactly "SchoolDoc", small understated blue document symbol.
Design system shared across this series: ivory-white #FCFCFD content, very pale warm-gray #F5F6F8 sidebar, white surfaces, ink navy #18243A headings, slate #687488 secondary text, blue #245DDD primary/selected actions, subtle blue #EDF3FF selections, fine #E3E7EE dividers. Amber + explicit text for unfinished, green + check + text for completed. 8px corner radius, 8px spacing rhythm, refined 1.5px outline icons. Large readable Korean, sparse decoration, carefully balanced spacing. Strong hierarchy without massive cards or giant headlines. All people, schools, and records shown are fictional examples.
Avoid: gradients, purple, 3D objects, marketing hero sections, stock photos, mascots, financial graphs, pointless charts, enormous empty gutters, a sea of equal-sized cards, excessive rounded pills, fake AI chat. No laptop or desk photo, no perspective, no external design annotations unless explicitly requested. Do not include competitor logos. Exact spelling and clean text matter.
Asset: 01 teacher home. Single edge-to-edge desktop application screenshot, landscape approximately 1600x1120, high resolution.
Composition: left sidebar 224px wide, top bar 64px high, workspace fills remaining width with 32px padding. Sidebar top SchoolDoc, class selector "가상초등학교" / "5학년 3반". Sidebar navigation "홈" selected blue, "진행 중인 업무", a divider then section "학급 업무" with "1인 1역", "가정통신문", "학생 결과 안내", "등록부 서명", "자료 수합", "특별실 예약"; help and settings at bottom, avatar and "김담임". Top bar breadcrumb "워크스페이스 / 홈", quiet search, small notification icon.
Main upper: small date "2026년 9월 28일 월요일"; main title "오늘의 업무"; helper "마감이 가까운 업무부터 확인하세요." Right aligned one blue primary "+ 새 업무".
Compact inline summary with 3 readable numbers, not giant cards: "진행 중 4건", "이번 주 마감 2건", "오늘 받은 응답 8건".
Body two columns 72/28. Left substantial active-work table titled "진행 중인 업무", tabs "전체 4", "마감 임박 2", "응답 완료 1". Columns "업무", "응답", "마감", "상태". Four roomy 90px rows:
"가을 현장체험학습 동의서" small subtype "가정통신문", "20 / 24명", "9.30 수", amber "4명 미응답".
"비상 연락망 확인" subtype "자료 수합", "22 / 24명", "10.02 금", amber "2명 미제출".
"체육대회 참가 신청" subtype "가정통신문", "24 / 24명", "10.07 수", green check "응답 완료".
"학부모 총회 등록부" subtype "등록부 서명", "16 / 24명", "10.08 목", neutral "진행 중".
Subtle mini horizontal progress bars under the response count, not heavy blocks. Row hover / arrow action understated. Table clean white and fine horizontal rules.
Right a visually quieter narrow sidebar section "우리 반", class "5학년 3반 · 24명". One meaningful callout "역할 배정" with "20 / 24명 배정", small amber "4명 미배정", compact outlined "배정 마무리 →". Below fine divider then "다가오는 마감" with two dated items "9.30 현장체험학습 동의서", "10.02 비상 연락망 확인". A small quiet helpful note "미응답 학생을 한 번에 확인할 수 있어요." No giant vacant cards.
Below table, "자주 쓰는 도구" compact horizontal strip of 6 small blue/gray outline icons and labels (same six tools), no bulky grid. Lower left small "최근 완료" with two compact plain rows, dates and green checks, filling the screen sensibly without cramming. Well-proportioned full screenshot.
```

## 학생 역할 배정

```text
Use case: ui-mockup.
Create an exceptionally polished, believable commercial Korean teacher productivity web application design for SchoolDoc. This is an original art direction informed by calm professional task lists (Linear), contextual data views (Airtable), and legible Korean people management (flex), not a copy of any other brand. Render a high-fidelity flat screenshot, pixel-sharp typography, precise grid, all interface labels in clean accurate Korean using a Pretendard/Noto Sans Korean-like sans-serif. Brand wordmark exactly "SchoolDoc", small understated blue document symbol.
Design system shared across this series: ivory-white #FCFCFD content, very pale warm-gray #F5F6F8 sidebar, white surfaces, ink navy #18243A headings, slate #687488 secondary text, blue #245DDD primary/selected actions, subtle blue #EDF3FF selections, fine #E3E7EE dividers. Amber + explicit text for unfinished, green + check + text for completed. 8px corner radius, 8px spacing rhythm, refined 1.5px outline icons. Large readable Korean, sparse decoration, carefully balanced spacing. Strong hierarchy without massive cards or giant headlines. All people, schools, and records shown are fictional examples.
Avoid: gradients, purple, 3D objects, marketing hero sections, stock photos, mascots, financial graphs, pointless charts, enormous empty gutters, a sea of equal-sized cards, excessive rounded pills, fake AI chat. No laptop or desk photo, no perspective, no external design annotations unless explicitly requested. Do not include competitor logos. Exact spelling and clean text matter.
Asset: 02 role assignment. Single edge-to-edge desktop app screenshot, landscape approximately 1600x1120, high resolution. Same 224px sidebar and 64px topbar as home. Sidebar "1인 1역" selected; includes SchoolDoc, class "가상초등학교 / 5학년 3반", home and task navigation. Main content begins right of sidebar with 32px padding and occupies all available width.
Top breadcrumb "학급 업무 / 1인 1역". Title "학생 역할 배정". Small date "2026.09.01 — 09.30". Upper right compact stepper "1 명단 확인 ✓" then blue "2 역할 배정". Under title compact counters "전체 24명", "배정 20명", amber "미배정 4명". Clean blue text action "미배정 학생 보기".
Main balanced split: left role list approximately 300px, right student grid approximately 850px. Headings "역할 12개" and "학생 선택". No huge instruction cards.
Left exactly 12 evenly spaced single rows, around 44px height. Each shows role name and capacity plus clear completion text:
1 "학급 회장" "2/2" green check
2 "학급 부회장" "2/2" green check
3 "출석 확인" "2/2" green check
4 "칠판 정리" "2/2" green check
5 "분리수거" "2/2" green check
6 "급식 도우미" "2/2" green check
7 "게시판 정리" "2/2" green check
8 "환기 도우미" "2/2" green check
9 "도서 정리" "1/2" "1자리 남음" SELECTED soft-blue row with blue left rule
10 "환경 정리" "1/2" "1자리 남음"
11 "준비물 확인" "1/2" "1자리 남음"
12 "기기 도우미" "1/2" "1자리 남음"
Right above grid selected-role context "도서 정리" followed by "1명을 더 선택하세요", search "이름 또는 번호 검색", compact filters "전체 24" selected / "미배정 4".
Grid of exactly 24 legible student tiles, 4 columns x 6 rows. Each tile uses a small number, larger Korean fictional name, small current-role label, a checkbox at top right. Tiles are compact but roomy, consistent, not over-decorated. Use numbered synthetic records:
01 김하온 학급 회장; 02 박서우 학급 회장; 03 이도겸 학급 부회장; 04 최나린 학급 부회장;
05 정이안 출석 확인; 06 강소율 출석 확인; 07 윤도하 칠판 정리; 08 장하린 칠판 정리;
09 임시온 분리수거; 10 오서준 분리수거; 11 한다온 급식 도우미; 12 신유나 급식 도우미;
13 서지안 게시판 정리; 14 권이든 게시판 정리; 15 황서진 환기 도우미; 16 안예린 환기 도우미;
17 송도윤 도서 정리; 18 홍채아 환경 정리; 19 문유준 준비물 확인; 20 유라온 기기 도우미;
21 백지호 미배정; 22 남아린 미배정; 23 노하준 미배정; 24 전소윤 미배정.
Student17 is currently assigned to selected role: blue selected border, pale blue surface, checked box. Other assigned students quiet white, dark readable names, small gray role text, unchecked. Last four unassigned students have amber text "미배정", subtle amber indicator but not screaming yellow backgrounds. Colors supplement text. No student hidden, no ellipsized names.
List/grid bottoms should be balanced, no giant blank column. Bottom full-width bar with "4명을 더 배정하면 확인할 수 있어요.", outlined "이전", disabled gray button "배정 확인". This is incomplete state; final button clearly disabled. Add small unobtrusive caption "가상 학급 데이터" at bottom. Finish with real-product precision.
```

## 학부모 모바일 응답

```text
Use case: ui-mockup.
Create an exceptionally polished, believable commercial Korean teacher productivity web application design for SchoolDoc. This is an original art direction informed by calm professional task lists (Linear), contextual data views (Airtable), and legible Korean people management (flex), not a copy of any other brand. Render a high-fidelity flat screenshot, pixel-sharp typography, precise grid, all interface labels in clean accurate Korean using a Pretendard/Noto Sans Korean-like sans-serif. Brand wordmark exactly "SchoolDoc", small understated blue document symbol.
Design system shared across this series: ivory-white #FCFCFD content, very pale warm-gray #F5F6F8 sidebar, white surfaces, ink navy #18243A headings, slate #687488 secondary text, blue #245DDD primary/selected actions, subtle blue #EDF3FF selections, fine #E3E7EE dividers. Amber + explicit text for unfinished, green + check + text for completed. 8px corner radius, 8px spacing rhythm, refined 1.5px outline icons. Large readable Korean, sparse decoration, carefully balanced spacing. Strong hierarchy without massive cards or giant headlines. All people, schools, and records shown are fictional examples.
Avoid: gradients, purple, 3D objects, marketing hero sections, stock photos, mascots, financial graphs, pointless charts, enormous empty gutters, a sea of equal-sized cards, excessive rounded pills, fake AI chat. No laptop or desk photo, no perspective, no external design annotations unless explicitly requested. Do not include competitor logos. Exact spelling and clean text matter.
Asset: 03 parent mobile response flow concept board, landscape approximately 1800x1150, high resolution. Three equally sized tall mobile UI panels side by side on a very pale gray neutral presentation background, generous small gutters, straight-on flat rectangles with modest rounded device-outline corners, no 3D phone hardware. Each panel depicts full mobile viewport roughly390x844 logical pixels, headers and bottom actions completely visible. Outside each panel a small tasteful label: "01 원본 확인", "02 크게 입력", "03 제출 전 확인". Small board title "학부모가 헤매지 않는 응답 흐름". Same exact SchoolDoc blue/white system. Large readable Korean.
Mobile1: white header small SchoolDoc then "가상초등학교". Heading "가을 현장체험학습 안내". Subheading "5학년 3반 · 10월 8일 목요일".
Show an entire ONE-PAGE short school notice, as a real white document inside a light-gray canvas. All page boundaries visible. Header "가정통신문", document title "가을 현장체험학습 안내", a short greeting, three short detail rows "일시 2026.10.08 목요일", "장소 생태 체험관", "대상 5학년 학생". Below a short table WITH INPUTS ON THE ORIGINAL DOCUMENT, not a separate detached form: "학생 이름 김하온", row "참가 여부" and two options "참가합니다" / "참가하지 않습니다", next "보호자 이름 김보호자". Use blue outline highlighting the ORIGINAL response row, with small contextual "크게 입력" button beside it. Notice footer "가상초등학교장". "1 / 1쪽" below document, and concise "문서의 응답 칸을 눌러 작성하세요." Bottom primary "응답 확인" but muted if incomplete. All page content has rendered; do not show a fake multi-page document whose pages were skipped.
Mobile2: white header SchoolDoc, back link "← 원본으로 돌아가기". Heading "참가 여부". Helper "둘 중 하나를 선택해 주세요." Two large radio choice rows, each at least44px tall: "참가합니다" unselected, "참가하지 않습니다" SELECTED blue radio and soft-blue background. Below separated label "보호자 이름" input "김보호자". At top a small source context "현장체험학습 안내 · 1쪽". This is focused magnified editing of the source document fields, preserving values when going back. Bottom primary "작성 내용 확인". No language suggesting selecting yes is compulsory.
Mobile3: white header SchoolDoc and back action. Heading "제출 전 확인". Helper "입력한 내용이 맞는지 확인해 주세요." A clean summary with lines: "문서 가을 현장체험학습 안내", "학생 김하온", "참가 여부 참가하지 않습니다", "보호자 이름 김보호자". Selected negative participation response must remain unchanged. Below small outlined "원본 문서 보기". A quiet plain section "수정이 필요하면 이전 화면으로 돌아갈 수 있어요." Bottom white action area with secondary "내용 수정" and dominant blue "응답 제출". Do not call final button consent/agree; it submits either valid choice. No payment, no identity promises, no cloud storage guarantees, no fake success confirmation. Very calm professional parent-friendly visual. Board footer discreet "가상 문서와 가상 인물로 만든 디자인 시안".
```
