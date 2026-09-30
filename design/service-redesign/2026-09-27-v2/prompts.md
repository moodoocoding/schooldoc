# 2차 시안 생성 프롬프트

## 역할 배정·모바일 작은 글씨 명도 조정

내장 image_gen 편집 모드. 각 첫 결과를 개별 입력으로 사용했다. 지정 토큰 대비 계산에서 작은 글씨 색을 더 진하게 보정할 필요를 확인했다. 이미지 자체의 접근성 인증을 의미하지 않는다.

```text
Use case: precise-object-edit. This is a final typography contrast pass on this SchoolDoc UI image. Preserve the entire composition, all Korean words, names, numbers, dimensions, all alignments and every UI state unchanged. Do not redesign or move anything.
Only deepen SMALL TEXT colors: all small terracotta/rust text should use a clearly legible dark terracotta #B9472F instead of lighter orange. All secondary gray text should use #686D66 instead of paler gray, with crisp readable glyphs. Main charcoal text remains #252824. Leave decorative orange logo, thin progress bars, selected checkbox/radio fills and pale peach selection backgrounds unchanged. Keep fine separator lines light, not dark. Do not increase font weight or font size. Nothing else changes.
```

## 홈 마무리 편집

내장 image_gen 편집 모드. 첫 홈 생성 결과의 하단 열 균형을 조정했다.

```text
Use case: precise-object-edit / ui-mockup. Edit this SchoolDoc home screenshot. Preserve the exact wordmark, sidebar, navigation, title, upper work table, all Korean text, dates, counts and top-right class summary. Preserve current charcoal/off-white/terracotta design, typography and image dimensions.
Make only these finishing changes:
1. BELOW the bottom of the upper work table and right summary (approximately y680), the two sections "바로 시작하기" and "최근 완료" should each use the FULL main content width from x270 to x1512. Spread the six existing tool icons and labels evenly across that full width, WITHOUT enclosing boxes. Stretch the recent-completed dividers and put their "24 / 24명" counts at the far right x1500. This removes the unused lower-right column while keeping exactly the same six tools and two completion rows. Keep the sections within the image, no crop.
2. Make the four small RESPONSE progress bars inside the work table a quiet neutral gray #8A8F87 rather than terracotta/green. Keep the explicit colored status dots and their Korean labels. Keep the role assignment progress on right unchanged.
3. Any terracotta SMALL TEXT or thin active indicator should be slightly deeper #B9472F to improve legibility on white. Do not add gradients, cards, heavy frames or new content.
Maintain all numbers20/24,22/24,24/24,16/24 and existing information. Refine only spacing and these accents.
```

## 교사 홈

```text
Use case: ui-mockup.
Create a meticulously art-directed screenshot of a Korean commercial SaaS product called SchoolDoc. This should feel like a bespoke product by an excellent design studio: precise, restrained, editorial, quietly confident, with beautiful typography. It must not look like a generic admin dashboard kit.
Art direction: warm paper white #FBFAF8, true charcoal #252824, warm-gray secondary #72756F, hairline #E7E6E1, one muted but clear vermilion #D85C3D accent occupying less than 3% of the image. Main workspace white, narrow navigation on warm off-white. No blue anywhere. Typography is refined Korean sans like Pretendard, regular400 for content, medium500 for headings/names, semibold600 used very sparingly. No chunky bold navy fonts. Spacious typography, exact baseline alignments, elegant open composition. Page title around30px at weight500; rows16px; metadata13px. Pixel-perfect 8px spacing rhythm.
Design with typography, alignment and white space. NO enclosing cards around sections. NO card grids. NO individual student tile borders. NO shadows. NO gradients. NO pill badges. NO pastel status boxes. NO large colored icons. Use very few delicate monochrome icons. Buttons modest radius6, separators faint, all text sharp. No illustrations, cartoon avatars, gimmicks, giant stat numbers, graphs, marketing banners, laptop/device photography. Genuine functional application, full frame flat screenshot at approximately1600x1050, no browser chrome or external frame.
Brand: "SchoolDoc" small charcoal wordmark with a tiny vermilion abstract folded-page mark. Navigation fixed approx190px. Top of sidebar wordmark, then small class context "가상초등학교" and "5학년 3반". Main nav compact flat text rows: "홈", "진행 업무". Small section label "학급 도구". Exact tools: "1인 1역", "가정통신문", "학생 결과 안내", "등록부 서명", "자료 수합", "특별실 예약". Active item has faint peach tint and tiny vermilion vertical dash, not a big saturated shape. Bottom plain "도움말", "설정", and a small typographic circle "김" with "김담임". Sidebar is deliberately quiet and never boxed into separate panels. Header on main workspace only, hairline bottom, breadcrumb left, tiny search glyph and profile right. Most layout division comes from spacing, not rectangles. All information is fictional. Render Korean accurately.
Input image1 is a STYLE REFERENCE from the new SchoolDoc role assignment design. Create a NEW companion screen with the exact same visual language, navigation, wordmark, colors, font weights, header height and sidebar proportions. Do not copy the role assignment content. Do not drift back into boxed dashboard cards. Same approximate1600x1050 full screenshot.
SCREEN: teacher home. Left nav selects "홈". Exact same navigation labels as reference; no extra invented tools. Main header breadcrumb "워크스페이스 / 홈".
Composition: a beautifully typeset open workspace. Top left small date "2026년 9월 28일 월요일", title "오늘의 업무" weight500, short subtitle "마감이 가까운 업무부터 확인하세요." To upper right a modest solid CHARCOAL button "+ 새 업무" with small6px corners. Accent vermilion used sparsely for urgency dots and selected nav mark, not all icons.
Below title a single plain text summary line "진행 중 4건   ·   이번 주 마감 2건   ·   오늘 받은 응답 8건". No large blue numbers and no statistic cards.
Main left roughly75%, right25% separated only by white space and a faint vertical hairline. Generous44px gutter. Left heading "진행 중인 업무" small18px medium. Right of heading quiet tabs "전체 4", "마감 임박 2", "응답 완료 1", selected underline charcoal. There is NO enclosing card. A large clean table, four rows approx90px high, ample baseline spacing, very light horizontal rules. Columns "업무", "응답", "마감", "상태". Title18px regular/medium, category13px gray; count small and precise with a very short fine gray progress indicator; date regular; status as plain text with small dot, NEVER colored pill badge.
Rows exact:
"가을 현장체험학습 동의서", small "가정통신문"; "20 / 24명"; "9.30 수"; small muted rust dot "4명 미응답".
"비상 연락망 확인", small "자료 수합"; "22 / 24명"; "10.02 금"; small muted rust dot "2명 미제출".
"체육대회 참가 신청", small "가정통신문"; "24 / 24명"; "10.07 수"; subtle darkgreen check and "응답 완료".
"학부모 총회 등록부", small "등록부 서명"; "16 / 24명"; "10.08 목"; small gray dot "진행 중".
Use tiny row arrow at far right, no big icons in every row. A fine vermilion 2px line at left of only the first urgent row is permitted, not largecolored background.
Right rail heading "우리 반", line "5학년 3반 · 24명". Unboxed compact role assignment overview "역할 배정" and "20 / 24명", slender20/24line, label "4명 미배정", understated text action "배정 마무리 ↗".
Below, separated by generous40px white space: "다가오는 마감" with two editorial-style date rows. Each date a legible short "9.30" / "10.02" and smaller weekday plus task name, no calendar card background.
Below main table, well-aligned open section "바로 시작하기", six compact monochrome glyphs and labels in one strip with ample space: "1인 1역", "가정통신문", "학생 결과 안내", "등록부 서명", "자료 수합", "특별실 예약". No toolbar container or six cards.
Bottom section "최근 완료" with two thin text rows, date, task, completion; not another card. "9.25 금 | 2학기 상담 희망 조사 | 24 / 24명" and "9.22 화 | 방과후학교 신청서 | 24 / 24명". At bottomsmall muted "가상 학급 데이터".
Page should feel like a carefully composed product, not a report or decorative landing page. Do not fill breathing room with random notices. The screen is commercial everyday work software with purposeful hierarchy.
```

## 학부모 모바일

```text
Use case: ui-mockup.
Create a meticulously art-directed screenshot of a Korean commercial SaaS product called SchoolDoc. This should feel like a bespoke product by an excellent design studio: precise, restrained, editorial, quietly confident, with beautiful typography. It must not look like a generic admin dashboard kit.
Art direction: warm paper white #FBFAF8, true charcoal #252824, warm-gray secondary #72756F, hairline #E7E6E1, one muted but clear vermilion #D85C3D accent occupying less than 3% of the image. Main workspace white, narrow navigation on warm off-white. No blue anywhere. Typography is refined Korean sans like Pretendard, regular400 for content, medium500 for headings/names, semibold600 used very sparingly. No chunky bold navy fonts. Spacious typography, exact baseline alignments, elegant open composition. Page title around30px at weight500; rows16px; metadata13px. Pixel-perfect 8px spacing rhythm.
Design with typography, alignment and white space. NO enclosing cards around sections. NO card grids. NO individual student tile borders. NO shadows. NO gradients. NO pill badges. NO pastel status boxes. NO large colored icons. Use very few delicate monochrome icons. Buttons modest radius6, separators faint, all text sharp. No illustrations, cartoon avatars, gimmicks, giant stat numbers, graphs, marketing banners, laptop/device photography. Genuine functional application, full frame flat screenshot at approximately1600x1050, no browser chrome or external frame.
Brand: "SchoolDoc" small charcoal wordmark with a tiny vermilion abstract folded-page mark. Navigation fixed approx190px. Top of sidebar wordmark, then small class context "가상초등학교" and "5학년 3반". Main nav compact flat text rows: "홈", "진행 업무". Small section label "학급 도구". Exact tools: "1인 1역", "가정통신문", "학생 결과 안내", "등록부 서명", "자료 수합", "특별실 예약". Active item has faint peach tint and tiny vermilion vertical dash, not a big saturated shape. Bottom plain "도움말", "설정", and a small typographic circle "김" with "김담임". Sidebar is deliberately quiet and never boxed into separate panels. Header on main workspace only, hairline bottom, breadcrumb left, tiny search glyph and profile right. Most layout division comes from spacing, not rectangles. All information is fictional. Render Korean accurately.
Input image1 is a STYLE REFERENCE: SchoolDoc role assignment master. Create a NEW MOBILE concept image for its parent response experience. Inherit the charcoal, warm paper, very restrained vermilion, precise regular/medium Korean type. Do NOT include desktop sidebar or teacher tools.
Composition: landscape board approximately1800x1120 containing three flat mobile interface screenshots, each390x844 logical pixels, equally sized. Background warm gray #EDEDE9, phones/screens white with only a fine1px border and very subtle10px rounded corners. No heavy mockup frame, no shadows, no3D phones, no huge board title. Outside top of each panel small vermilion number and charcoal label: "01 원본 확인", "02 크게 입력", "03 제출 전 확인". This is a refined product design review board. Crisp Korean text and thoughtful whitespace.
Mobile header on every panel: small charcoal SchoolDoc wordmark and tiny vermilion mark, small gray school label "가상초등학교". NO hamburger menu, cartoon, search, generic navigation icons. Statusbar okay small.
Panel1: title "가을 현장체험학습 안내" medium24px, subtitle "5학년 3반 · 10월 8일 목요일". Below, a compact full ONE-PAGE original school notice with every page edge visible, high fidelity as a white PDF on a very light neutral canvas. PDF has title "가정통신문", short heading "가을 현장체험학습 안내", just two short greeting lines, a three-row factual table "일시 2026.10.08 목요일", "장소 생태 체험관", "대상 5학년 학생". Original response area at bottom of document contains rows "학생 이름 김하온", "참가 여부" with radio options "참가합니다" and "참가하지 않습니다", and "보호자 이름 김보호자". Original "참가 여부" row is outlined in muted vermilion and a small contextual "크게 입력" button appears NEXT TO its original location. A very short notice footer "가상초등학교장". The entire one-page original is rendered. Footerbelowdoc "1 / 1쪽"; instruction "응답 칸을 눌러 작성하세요." At screen bottom a disabled gray fullwidth button "응답 확인". Do not replace the PDF with a detached modern form.
Panel2: header, backlink "← 원본으로 돌아가기", small source label "현장체험학습 안내 · 1쪽". Title "참가 여부" medium26px, helper "둘 중 하나를 선택해 주세요." Two spacious unboxed radio rows separated with a thin line. First "참가합니다" unselected. Second "참가하지 않습니다" selected with a vermilion checked radio; small subtle peach row highlight, NO thick surrounding cards. Clear full-row large touch target. Below32px gap, label "보호자 이름", single understated input with thin border and value "김보호자". At bottom CHARCOAL primary "작성 내용 확인" with white text,6pxcorners. This is an enlarged editor for the source fields, with clear return to original and preserved values.
Panel3: header, back "← 내용 수정". Title "제출 전 확인", short helper "입력한 내용이 맞는지 확인해 주세요." OPEN SUMMARY LIST, no enclosing rounded card. Four roomy rows with very fine dividers: "문서" → "가을 현장체험학습 안내"; "학생" → "김하온"; "참가 여부" → "참가하지 않습니다"; "보호자 이름" → "김보호자". Values align consistently and remain legible. Small plain underlined "원본 문서 보기" below. Large quiet whitespace, no warning/info cards. At bottom secondary text "내용 수정" and fullwidth charcoal primary "응답 제출", emphasis clearly on primary. Negative participation response is a valid answer and must NOT change to consent/agree. Do not claim submitted already.
Tiny board footer "가상 문서와 가상 인물로 만든 디자인 시안". Elegant authentic mobile app typography, no oversized heavy headings, no blue buttons, no unnecessary boxes.
```


내장 image_gen. 역할 배정은 참조 이미지 없는 신규 생성으로 디자인을 다시 잡고, 나머지 화면은 이 결과를 스타일 참조로 사용한다. 이전 시안 이미지를 편집 기준으로 삼지 않는다.

## 역할 배정

```text
Use case: ui-mockup.
Create a meticulously art-directed screenshot of a Korean commercial SaaS product called SchoolDoc. This should feel like a bespoke product by an excellent design studio: precise, restrained, editorial, quietly confident, with beautiful typography. It must not look like a generic admin dashboard kit.
Art direction: warm paper white #FBFAF8, true charcoal #252824, warm-gray secondary #72756F, hairline #E7E6E1, one muted but clear vermilion #D85C3D accent occupying less than 3% of the image. Main workspace white, narrow navigation on warm off-white. No blue anywhere. Typography is refined Korean sans like Pretendard, regular400 for content, medium500 for headings/names, semibold600 used very sparingly. No chunky bold navy fonts. Spacious typography, exact baseline alignments, elegant open composition. Page title around30px at weight500; rows16px; metadata13px. Pixel-perfect 8px spacing rhythm.
Design with typography, alignment and white space. NO enclosing cards around sections. NO card grids. NO individual student tile borders. NO shadows. NO gradients. NO pill badges. NO pastel status boxes. NO large colored icons. Use very few delicate monochrome icons. Buttons modest radius6, separators faint, all text sharp. No illustrations, cartoon avatars, gimmicks, giant stat numbers, graphs, marketing banners, laptop/device photography. Genuine functional application, full frame flat screenshot at approximately1600x1050, no browser chrome or external frame.
Brand: "SchoolDoc" small charcoal wordmark with a tiny vermilion abstract folded-page mark. Navigation fixed approx190px. Top of sidebar wordmark, then small class context "가상초등학교" and "5학년 3반". Main nav compact flat text rows: "홈", "진행 업무". Small section label "학급 도구". Exact tools: "1인 1역", "가정통신문", "학생 결과 안내", "등록부 서명", "자료 수합", "특별실 예약". Active item has faint peach tint and tiny vermilion vertical dash, not a big saturated shape. Bottom plain "도움말", "설정", and a small typographic circle "김" with "김담임". Sidebar is deliberately quiet and never boxed into separate panels. Header on main workspace only, hairline bottom, breadcrumb left, tiny search glyph and profile right. Most layout division comes from spacing, not rectangles. All information is fictional. Render Korean accurately.
SCREEN: student role assignment, the defining design master for a three-screen product series. Sidebar selects "1인 1역".
The entire main work area occupies the screen from x190 with 44px padding, natural responsive breadth. Top breadcrumb "학급 도구 / 1인 1역". Below it a small eyebrow "2026년 9월 · 5학년 3반". The single main title is "학생 역할 배정". To the right understated stepper "01 명단 확인" check, "02 역할 배정" charcoal active with tiny vermilion dot. No numbered bubbles. Under title concise sentence "역할을 고르고, 맡을 학생을 선택하세요." Rightmost text link "명단 수정 ↗".
Below title a thin horizontal progress line split subtly 20 of24, then compact inline sentence "24명 중 20명 배정" and right "미배정 4명". Not three statistic cards, not giant counters.
Main content starts about y270. The content is an OPEN TWO-PANE WORKSPACE, no rounded panel backgrounds. Left role rail approximately240px wide. Vertical hairline separates it from student area. Role rail heading "역할" with small "12". Twelve rows, 43px height, title left, fraction right:
학급 회장 2/2, 학급 부회장 2/2, 출석 확인 2/2, 칠판 정리 2/2, 분리수거 2/2, 급식 도우미 2/2, 게시판 정리 2/2, 환기 도우미 2/2, 도서 정리 1/2, 환경 정리 1/2, 준비물 확인 1/2, 기기 도우미 1/2.
Do not put green icons on every row. Completed capacities are quiet gray; partial capacities muted rust with small text "1자리". Selected "도서 정리" has a flat subtle peach highlight spanning just its row and a thin vermilion edge. All other rows unboxed. Tiny count label "20명 배정 · 4자리 남음" below the twelve rows.
Student pane around820px wide. Heading "도서 정리" medium22px, small subtitle "정원 2명 · 1명을 더 선택하세요". To right a compact understated search field with small search icon "이름 또는 번호", and text filter "전체 24" underlined active / "미배정 4". One fine horizontal separator beneath headings.
Student area is TWO UNBOXED LIST COLUMNS OF 12 ROWS EACH, NOT a tile/card grid. Columns separated by ample gutter and an extremely faint vertical rule. Row height43px, each row has a small checkbox, muted 2-digit student number, regular16px student name, and 13px current-role text aligned right. Only hairline row separators, no rounded rectangles. Names are visually more prominent than roles, without becoming heavy bold.
Left column12students:
01 김하온 학급 회장
02 박서우 학급 회장
03 이도겸 학급 부회장
04 최나린 학급 부회장
05 정이안 출석 확인
06 강소율 출석 확인
07 윤도하 칠판 정리
08 장하린 칠판 정리
09 임시온 분리수거
10 오서준 분리수거
11 한다온 급식 도우미
12 신유나 급식 도우미
Right column12students:
13 서지안 게시판 정리
14 권이든 게시판 정리
15 황서진 환기 도우미
16 안예린 환기 도우미
17 송도윤 도서 정리
18 홍채아 환경 정리
19 문유준 준비물 확인
20 유라온 기기 도우미
21 백지호 미배정
22 남아린 미배정
23 노하준 미배정
24 전소윤 미배정.
Only student17 has a vermilion checked checkbox and very pale peach row highlight, no border around it. Others assigned remain readable charcoal, not disabled or faded away. Students21-24 have small muted terracotta dot and text "미배정". No standalone alert banners.
At bottom of workspace, aligned below both role rail and roster, a quiet footer horizontal rule then sentence "4명을 더 배정하면 다음 단계로 갈 수 있어요." Right buttons understated outline "이전" and clearly disabled medium-gray "배정 확인". No box enclosing footer. Full viewport must include all24students and all12roles, balanced pane endings, no gigantic empty footer.
This must look substantially more sophisticated and lighter than a blue card-based admin template, through exact typesetting and the absence of unnecessary containers.
```
