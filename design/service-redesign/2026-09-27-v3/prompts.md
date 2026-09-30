# PC 역할 배정 3차 생성 프롬프트

도구: 내장 image_gen 신규 생성. 입력: 승인된 2차 모바일 이미지(색·글꼴·브랜드 스타일만 참고). 홈과 모바일 파일은 수정하지 않는다.

## 기본 배정 화면

```text
Use case: ui-mockup. Create a NEW single desktop SchoolDoc role-assignment screen with a substantially rethought information hierarchy. Image1 is an approved MOBILE style reference ONLY: inherit its warm-white, charcoal typography, tiny terracotta brand mark and restrained controls. Do not render mobile phones, a homepage, or a board of multiple screens.
Deliver one highly polished commercial web-app screenshot, straight-on full frame, landscape approximately1500x940. Refined Korean sans, readable regular/medium weights, crisp typography. Warm neutral outer canvas #F5F5F1, white work area, charcoal #252824, secondary text #686D66, small text accent #B9472F, light hairlines #E4E5E0. No blue, no gradients, no decorative illustrations, no shadows, no collection of dashboard cards.

TASK AND HIERARCHY:
The user's current task is choosing a student for the selected role. The selected role and student actions must dominate the screen. Other roles are supporting navigation. Routine progress summaries are absent.
TOP APP BAR around68px: small SchoolDoc wordmark at left with tiny terracotta page mark. Beside it a quiet back link "← 1인 1역". Right small context "5학년 3반 · 9월". No global sidebar with six other tools. Far right one modest DISABLED gray "배정 확인" button. The task is incomplete. Do not add an explanatory sentence for disabled state.
Below topbar, tiny page-level label "역할 배정" at x90,y112, not the largest heading. A centered yet broad work area roughly1320px wide fills the useful canvas, from x90 to1410, y155 to810. Split into a supporting left role rail about270px and an expansive primary white detail area with48px innerpadding, separated by a fine vertical line. No enclosing thick cards or unnecessary frames.

LEFT ROLE NAVIGATION:
Semantic groups, not twelve identical high-emphasis rows.
Small muted heading "배정 중". Four rows48px each:
"도서 정리" right "1/2" — selected, restrained pale peach background and a tiny terracotta leading mark
"환경 정리" right "1/2"
"준비물 확인" right "1/2"
"기기 도우미" right "1/2".
Then28px vertical gap, small muted group heading "배정 완료". Eight compact36px plain text rows: "학급 회장", "학급 부회장", "출석 확인", "칠판 정리", "분리수거", "급식 도우미", "게시판 정리", "환기 도우미". These remain readable and clickable but have NO individual green icons, NO repeated completion badges and NO repeated2/2 numbers. One group heading communicates completion. Do not place counts in either group heading.

PRIMARY DETAIL AREA:
At x420,y185, main heading "도서 정리",32px medium charcoal. This is the visual entry point because of position, isolation and stronger contrast, not an enormous oversized font.
Underneath at y240 small useful group label "담당 학생". At y274 one modest inline selected-person chip or unboxed token, around230px wide: muted number "17", name "송도윤" at18px, an accessible-looking remove × at the end. It should visually express a currently assigned person. Do not add empty person slots or repeat the capacity here.
A hairline separator aroundy365.
Next at y410, heading "학생 추가" at18px medium. On the same toolbar right, a small filter dropdown labeled "미배정⌄" (NO number) and search field placeholder "이름 또는 번호".
Below, a beautifully aligned list of FOUR candidate rows, each64px high, spanning the detail area. Flat rows, very subtle dividing lines, no individual cards. Each row number at left, large readable name, a simple + action inside a generous44px hit area at far right:
"21" "백지호" +
"22" "남아린" +
"23" "노하준" +
"24" "전소윤" +
Candidates are all unassigned, already implied by filter, so do NOT repeat "미배정" on each row. No colored status dot per person. Four names are the only candidate names shown. Assigned students can be reached using the filter; do not draw a menu or invent additional names.
The role rail and primary work area should end at approximately the same vertical level. Preserve generous but purposeful spacing. Nothing extra under the lists. Use the available width for readable names and clearly related actions, not a small widget lost inside huge empty margins.

ABSOLUTE INFORMATION CONSTRAINTS:
Do not show a progress bar,24,total20,4people,counts on tabs,stats cards,completion percentage,or the phrases "미배정 4명", "24명 중20명 배정", "1명을 더 선택하세요", "1자리 남음", "4명을 더 배정하면", "다음 단계", "역할을 고르고", "전체24", or "가상 데이터".
No bottom instruction banner, no footer status, no explanatory onboarding copy. Do not restate capacity outside the four unfinished role rows. Do not add decorative data to fill space. The hierarchy must be selected role → current person → candidate actions, while complete roles recede. All people are synthetic. This is a serious minimal functional UI, not a poster or wireframe. Render exact legible Korean.
```
