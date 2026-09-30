# SchoolDoc 디자인 참고 사이트 조사

조사일: 2026-09-27. 서로 다른 사이트 도메인 **125개**를 개별 검색했다. 공식 검색 결과의 제품 설명·도움말·공개 이미지를 1차 선별에 사용하고, 핵심 10개는 공개 페이지 또는 공개 데모 화면을 브라우저로 열어 비교했다. 125개 제품을 모두 로그인해서 사용하거나 모든 화면을 시각 검증한 조사는 아니다.

검색 문구와 사이트별 출처는 [site-audit.json](site-audit.json)에 기록했다. 같은 사이트의 여러 페이지는 한 개로 센다. 독립 기업 수를 센 것이 아니므로, Coda와 Superhuman처럼 브랜드 관계가 있는 도메인도 목록에 포함된다. 검색 순위나 인지도는 디자인 점수가 아니다.

## 현재 서비스에 대한 판단

배포된 학생 역할 배정 화면의 전체 화면과 저장소의 홈·공통 셸 구조를 확인했다. 넓은 화면에서 실제 작업 영역은 작게 모여 있고, 반복된 상자 안에서 역할·학생·상태의 우선순위가 약하다. 현재 화면은 기능 검증 단계의 인상을 준다. 교사가 매일 쓸 서비스의 핵심인 읽기·탐색·누락 확인을 더 명료하게 만들어야 한다.

실제 교사 인터뷰나 작업 시간 측정을 하지 않았으므로, 사용성 저하의 크기나 전환율을 수치로 단정하지 않는다. 아래 디자인 판단은 AI의 모의 검토다.

## 선정 기준

1. 교사가 반복하는 목록·명단·수합 업무와 구조가 유사한가.
2. 무엇을 먼저 처리해야 하는지 한눈에 보이는가.
3. 한글 이름과 업무 제목을 충분한 크기로 읽을 수 있는가.
4. 완료·미완료·선택을 색과 텍스트로 구분하는가.
5. 학생·보호자가 모바일에서 짧고 명확하게 응답할 수 있는가.
6. 실제 SchoolDoc 기능으로 구현할 수 있는 원칙인가.

첫 세 기준을 중심으로 Linear·Airtable·flex를 주 참고 모델로 정했다. 다른 일곱 곳에서는 필요한 부분만 골랐다. 아래 '적용'은 조사 내용을 SchoolDoc에 맞게 해석한 설계 제안이며 해당 사이트의 공식 권고가 아니다.

## 핵심 참고 10개

| 역할 | 사이트와 확인 자료 | 관찰과 SchoolDoc 적용 | 적용하지 않을 부분 / 확인 한계 |
| --- | --- | --- | --- |
| 주 모델 · 업무 위계 | [Linear 디자인 개편](https://linear.app/now/behind-the-latest-design-refresh), [UI 개편 기록](https://linear.app/changelog/2026-03-12-ui-refresh) | 공개 글과 전후 화면을 확인했다. 탐색의 시각적 무게를 낮추고 위치·보기 도구를 일관되게 배치한다. 업무 제목 → 상태 → 다음 행동 순으로 읽히게 한다. | 개발자 이슈 용어와 복잡한 조직 체계는 가져오지 않는다. 로그인 제품 사용은 하지 않았다. |
| 주 모델 · 명단 구조 | [Airtable Interface Designer](https://www.airtable.com/guides/collaborate/interface-designer-dashboards) | 공식 가이드와 공개 예시를 확인했다. 요약·필터·상세 정보가 연결되는 구조를 참고해 역할 선택 옆에서 학생을 배정한다. | 차트와 자유로운 대시보드 설정은 일상 학급 업무에 과하다. 전체 편집기를 사용한 검증은 아니다. |
| 주 모델 · 한글 업무 화면 | [flex 인사 관리](https://flex.team/landing/service/personnel-management) | 공개 인사 정보 화면 이미지를 확인했다. 사람 정보의 이름·부가 정보·탭 위계를 참고한다. 학생 이름을 크게, 현재 역할을 보조 텍스트로 둔다. | 검정 배경 AI 마케팅, 인사·급여 기능은 가져오지 않는다. |
| 보조 · 오늘 할 일 | [Todoist 작업 관리](https://www.todoist.com/task-management) | 공개 오늘 목록 화면을 확인했다. 짧은 작업 제목과 우선순위 중심으로 홈을 구성한다. | 프로젝트 관리의 세부 기능은 확장하지 않는다. |
| 보조 · 가벼운 응답 | [Tally](https://tally.so/), [기능 안내](https://tally.so/help/features) | 공개 폼 예시를 확인했다. 문서를 읽듯 입력하고 한 단계의 행동에 집중하는 방식이 적합하다. | SchoolDoc의 원본 PDF 위 입력을 일반 설문 페이지로 대체하지 않는다. |
| 보조 · 입력과 검토 | [Fillout](https://www.fillout.com/), [시작 안내](https://www.fillout.com/help/getting-started) | 공개 폼·제품 이미지를 확인했다. 명료한 필드 그룹, 선택 상태, 다음 행동을 참고한다. | 폼 제작기를 보호자에게 노출하지 않는다. 홈페이지의 애니메이션 도시는 채택하지 않는다. |
| 보조 · 상태와 숫자 | [Mercury 공개 데모](https://demo.mercury.com/dashboard) | 공개 가상 대시보드를 직접 열었다. 숫자·라벨·행동의 절제된 구분, 얇은 경계와 낮은 색 밀도를 참고한다. | 금융 그래프와 초광폭 화면의 넓은 외곽 공백은 적용하지 않는다. 금융 작업은 수행하지 않았다. |
| 보조 · 쉬운 한글 | [토스 UX Writer 인터뷰](https://toss.im/tossfeed/article/uxwriter-interview) | 공식 글의 UX writing 설명과 페이지를 확인했다. 어려운 상태명 대신 '4명 미배정', '응답 제출'처럼 행동을 설명한다. | 실제 금융 앱 UI를 직접 검토한 것은 아니다. 2021년 자료이므로 현재 앱 전체의 증거로 쓰지 않는다. |
| 보조 · 학교 맥락 | [ClassDojo 교사용 안내](https://www.classdojo.com/teachers/) | 공개 교사용 페이지와 기능 소개를 확인했다. 학교·학급 맥락과 교사·보호자의 역할 구분을 참고한다. | 캐릭터·놀이 중심 장식은 교사용 업무 화면에 가져오지 않는다. |
| 보조 · 일정 | [Cal.com](https://cal.com/) | 공개 예약 예시를 확인했다. 날짜와 가능한 선택지를 가까이 두는 방식은 특별실 예약의 후속 확장에 유효하다. | 이번 세 시안에 예약 화면을 억지로 넣지 않는다. 예약을 제출하지 않았다. |

## 디자인으로 옮긴 결정

| 현 문제 | 시안 결정 | 근거 모델 |
| --- | --- | --- |
| 첫 화면에서 할 일을 고르기 어려움 | 도구 소개보다 진행 업무·미응답·다가오는 마감 우선 | Linear, Todoist |
| 넓은 화면의 무기능 공백 | 이름이 보이는 왼쪽 탐색, 넓은 작업 본문, 필요한 요약만 보조 열로 구성 | flex, Airtable |
| 역할·학생·배정 상태가 같은 강도로 표시됨 | 역할은 행 목록, 학생은 명단 타일, 선택·미배정은 텍스트와 색으로 구분 | Airtable, flex |
| 핵심 숫자를 읽어도 다음 행동이 불명확 | '미배정 4명'과 바로 연결되는 필터·마무리 행동 | Linear, Mercury |
| 보호자의 원본 확인과 응답이 끊길 위험 | 원본 위 입력 → 크게 입력 → 제출 전 확인, 원본 복귀 경로 유지 | Tally, Fillout의 입력 원칙을 원본 PDF 흐름에 맞춰 변형 |
| 설명이 장황하거나 내부 용어처럼 느껴짐 | 짧은 한글 행동 문장과 명확한 버튼 이름 | 토스 UX writing 원칙 |

## 125개 검색 목록

아래 표는 1차 검색 목록이다. 사이트 링크는 검색에서 확인한 공식 도메인의 대표 자료다. 최종 후보 외 사이트의 화면 품질 점수나 실제 사용성 검증을 의미하지 않는다.

| 분야 | 수 | 탐색 관점 |
| --- | ---: | --- |
| 업무 관리 | 20 | 작업 우선순위, 목록 밀도, 전역 탐색 |
| 데이터·관리 도구 | 15 | 명단·표·필터, 요약과 상세 연결 |
| 폼·문서·서명 | 15 | 입력 부담, 문서와 응답 관계, 제출 전 확인 |
| 교육 | 20 | 교사와 보호자 역할, 학급 맥락, 안내 어조 |
| 국내 서비스 | 15 | 한글 가독성, 업무 용어, 사람·조직 정보 구조 |
| 예약·일정 | 10 | 날짜·시간 선택, 가능한 상태의 표현 |
| 재무·고객 업무 | 15 | 누락·진행·완료 상태, 요약과 원자료 |
| 디자인·지식 | 15 | 편집 화면의 위계, 도구 노출, 정보 탐색 |
| 합계 | **125** | 중복 도메인 제거 |

### 업무 관리

탐색 관점: 작업 우선순위, 목록 밀도, 전역 탐색.

| 번호 | 사이트 | 검색으로 확인한 대표 공식 자료 |
| ---: | --- | --- |
| 1 | Linear · linear.app | [Features – Linear](https://linear.app/features) |
| 2 | Notion · notion.com | [Notion features—Capture, find, automate · Notion](https://www.notion.com/product/features) |
| 3 | Asana · asana.com | [Asana Work Management - Features, Uses & Product • Asana](https://asana.com/product) |
| 4 | ClickUp · clickup.com | [ClickUp™ Product Features](https://clickup.com/features) |
| 5 | monday.com · monday.com | [Introduction to monday.com – Support](https://support.monday.com/hc/en-us/articles/115005310945-Introduction-to-monday-com) |
| 6 | Trello · trello.com | [Which Trello Plan Is Best for You? Our Pricing Guide Can Help](https://trello.com/pricing) |
| 7 | Basecamp · basecamp.com | [Basecamp — Features, benefits, benefits, and benefits](https://basecamp.com/features) |
| 8 | Todoist · todoist.com | [Simplify Task Management with Todoist](https://www.todoist.com/task-management) |
| 9 | TickTick · ticktick.com | [Features - TickTick](https://ticktick.com/features) |
| 10 | Teamwork · teamwork.com | [Every Feature Built for Client Work · Teamwork.com](https://www.teamwork.com/product/) |
| 11 | Wrike · wrike.com | [Project Management Software Features by Wrike](https://www.wrike.com/features/) |
| 12 | Smartsheet · smartsheet.com | [Features · Smartsheet](https://www.smartsheet.com/platform/features) |
| 13 | Hive · hive.com | [Top Project Management Features · Hive for Teams](https://hive.com/features) |
| 14 | nTask · ntaskmanager.com | [Product Features - nTask](https://www.ntaskmanager.com/product/) |
| 15 | MeisterTask · meistertask.com | [Your centralized platform for projects and tasks · MeisterTask](https://www.meistertask.com/pages/features/projects-tasks) |
| 16 | Zenkit · zenkit.com | [Features · Zenkit](https://zenkit.com/en/features/) |
| 17 | Coda · coda.io | [Coda AI features – Coda](https://help.coda.io/hc/en-us/articles/39555802361613-Coda-AI-features) |
| 18 | Quip · quip.com | [Quip - Overview](https://quip.com/about/product) |
| 19 | Craft · craft.do | [Product fact sheet · Free Template · Craft](https://www.craft.do/templates/product-fact-sheet) |
| 20 | Any.do · any.do | [Organize your life in seconds](https://www.any.do/personal) |

### 데이터·관리 도구

탐색 관점: 명단·표·필터, 요약과 상세 연결.

| 번호 | 사이트 | 검색으로 확인한 대표 공식 자료 |
| ---: | --- | --- |
| 21 | Airtable · airtable.com | [Best Product Management Software for Product Roadmaps & Workflows · Airtable](https://www.airtable.com/solutions/product) |
| 22 | SmartSuite · smartsuite.com | [Hundreds of Customer Inspired Features · SmartSuite](https://www.smartsuite.com/features) |
| 23 | Fibery · fibery.io | [Product Matrix Template — Fibery](https://fibery.io/product-matrix-template) |
| 24 | Budibase · budibase.com | [Build internal tools in minutes · Budibase](https://budibase.com/product/apps) |
| 25 | Appsmith · appsmith.com | [Appsmith · Open-Source Low-Code Application Platform](https://www.appsmith.com/) |
| 26 | Retool · retool.com | [Retool Docs](https://docs.retool.com/) |
| 27 | Baserow · baserow.io | [Baserow AI Features · No-Code AI for Databases, Documents & Automation](https://baserow.io/product/baserow-ai) |
| 28 | NocoDB · nocodb.com | [Welcome](https://nocodb.com/docs/product) |
| 29 | Stacker · stackerhq.com | [Key Features · Stacker](https://docs.stackerhq.com/stacker-classic/getting-started-quick-guide/key-features) |
| 30 | Softr · softr.io | [Build Custom Product Tools Without Code · Softr](https://www.softr.io/solutions/product) |
| 31 | Glide · glideapps.com | [Build and Deploy Custom, AI-Powered Business Apps · Glide](https://www.glideapps.com/classic/ai) |
| 32 | Appian · appian.com | [Appian Platform for AI Process Automation](https://appian.com/products/platform/overview) |
| 33 | Kissflow · kissflow.com | [Kissflow · Build Custom Enterprise Apps Fast with AI & Low-Code](https://kissflow.com/) |
| 34 | Nintex · nintex.com | [Nintex K2 product feature comparison](https://help.nintex.com/en-US/platform/K2Support/ProductFeatureComparison.htm) |
| 35 | Pipefy · pipefy.com | [Product Overview · Pipefy](https://www.pipefy.com/product-overview/) |

### 폼·문서·서명

탐색 관점: 입력 부담, 문서와 응답 관계, 제출 전 확인.

| 번호 | 사이트 | 검색으로 확인한 대표 공식 자료 |
| ---: | --- | --- |
| 36 | Typeform · typeform.com | [Online Form Builder : Create Free Forms · Typeform](https://www.typeform.com/forms?content_language=English&facet3=pdf) |
| 37 | Tally · tally.so | [Every Feature, Explained · Free Form Builder · Tally](https://tally.so/help/features) |
| 38 | Fillout · fillout.com | [Fillout · Forms that do it all](https://www.fillout.com/) |
| 39 | Jotform · jotform.com | [PDF Editor to Fill In Forms · Jotform](https://www.jotform.com/features/pdf-editor-to-fill-in-forms/) |
| 40 | Formstack · formstack.com | [Formstack Documents Features · Templates & Data Routing](https://www.formstack.com/documents/features) |
| 41 | Formsite · formsite.com | [Website Form Custom Features & Capabilities · Formsite](https://www.formsite.com/features/) |
| 42 | Paperform · paperform.co | [Features · Paperform Help Center · Paperform](https://paperform.co/help/collections/features/) |
| 43 | Cognito Forms · cognitoforms.com | [Document Generation Templates - Cognito Forms](https://www.cognitoforms.com/templates/document-generation) |
| 44 | Wufoo · wufoo.com | [Online Form Creation and Reporting Features · Wufoo](https://www.wufoo.com/features/) |
| 45 | involve.me · involve.me | [involve.me Form Builder Grounding Page · involve.me](https://www.involve.me/grounding-pages/form-builder-tool) |
| 46 | Docusign · docusign.com | [Create Mobile-Friendly, Fillable Web Forms · Docusign](https://www.docusign.com/products/web-forms) |
| 47 | PandaDoc · pandadoc.com | [Creating documents, templates, content library items, and forms · Help Center](https://support.pandadoc.com/en/collections/10117354-creating-documents-templates-content-library-items-and-forms) |
| 48 | SignWell · signwell.com | [Sign Documents Online for Free - SignWell](https://www.signwell.com/sign-documents-online/) |
| 49 | Dropbox Sign · sign.dropbox.com | [eSignature Features & Benefits](https://sign.dropbox.com/features) |
| 50 | Smallpdf · smallpdf.com | [Annotate PDF Online · Highlight, Add Text, & Mark Up PDFs](https://smallpdf.com/pdf-annotator) |

### 교육

탐색 관점: 교사와 보호자 역할, 학급 맥락, 안내 어조.

| 번호 | 사이트 | 검색으로 확인한 대표 공식 자료 |
| ---: | --- | --- |
| 51 | ClassDojo · classdojo.com | [One app to bring your whole classroom together · ClassDojo](https://www.classdojo.com/teachers/) |
| 52 | Seesaw · seesaw.com | [Seesaw for Teachers - Seesaw · Elementary Learning Experience Platform](https://seesaw.com/teachers/) |
| 53 | Google for Education · edu.google.com | [Classroom Management Tools & Resources - Google for Education](https://edu.google.com/workspace-for-education/products/classroom/) |
| 54 | Edsby · edsby.com | [Edsby Features: K-12 Education Platform Overview · edsby](https://www.edsby.com/features/) |
| 55 | Toddle · toddleapp.com | [Toddle · Curriculum planning for public schools & districts](https://www.toddleapp.com/us-publicschools/) |
| 56 | ManageBac · managebac.com | [Getting Started with ManageBac+ as a Teacher or Advisor – ManageBac+ Help Centre](https://help.managebac.com/hc/en-us/articles/360045390112-Getting-Started-with-ManageBac-as-a-Teacher-or-Advisor) |
| 57 | PowerSchool · powerschool.com | [Why PowerSchool](https://pages.powerschool.com/rs/387-SBG-541/images/Classroom-Buying-Guide-Ebook-072325.pdf?version=0) |
| 58 | Canvas · instructure.com | [Canvas by Instructure: World Leading LMS for Teaching & Learning](https://www.instructure.com/canvas) |
| 59 | SchoolStatus · schoolstatus.com | [Solutions for K-12 Educators · SchoolStatus](https://www.schoolstatus.com/who-its-for/educators-staff) |
| 60 | ParentSquare · parentsquare.com | [Classroom Communication Platform for Schools · ParentSquare](https://www.parentsquare.com/platform/classroom-communications/) |
| 61 | Classtime · classtime.com | [Media Kit - Classtime](https://www.classtime.com/press/media-kit/) |
| 62 | Classkick · classkick.com | [Teachers](https://classkick.com/teachers) |
| 63 | Nearpod · nearpod.com | [Frequently asked questions · Nearpod](https://nearpod.com/frequently-asked-questions) |
| 64 | SchoolAI · schoolai.com | [Smart classrooms, stronger districts: New features for the 2026-2027 school year · SchoolAI](https://schoolai.com/blog/new-features-2026-2027) |
| 65 | MagicSchool · magicschool.ai | [AI Tools for Teachers · MagicSchool](https://www.magicschool.ai/magic-tools) |
| 66 | Brisk Teaching · briskteaching.com | [What is Brisk Teaching? – Brisk Teaching](https://help.briskteaching.com/hc/en-us/articles/38789659161364-What-is-Brisk-Teaching) |
| 67 | Kami · kamiapp.com | [Kami App features Guide for Teachers and Schools](https://www.kamiapp.com/products/kami-app/features/) |
| 68 | Book Creator · bookcreator.com | [Teacher Librarians - Book Creator app](https://bookcreator.com/teachers/teacher-librarians/) |
| 69 | Padlet · padlet.com | [Pricing - Padlet](https://padlet.com/site/subscriptions) |
| 70 | Wayground · wayground.com | [Live Session Modes on Wayground :](https://help.wayground.com/support/solutions/articles/158000404918-live-session-modes-on-wayground) |

### 국내 서비스

탐색 관점: 한글 가독성, 업무 용어, 사람·조직 정보 구조.

| 번호 | 사이트 | 검색으로 확인한 대표 공식 자료 |
| ---: | --- | --- |
| 71 | 토스 · toss.im | [토스 기업 문화 – 토스 팀의 핵심 가치 - 금융이 알고 싶을 때, 토스피드](https://toss.im/tossfeed/article/toss-core-values) |
| 72 | 당근 · daangn.com | [당근 서비스](https://about.daangn.com/service/) |
| 73 | flex · flex.team | [홈 · flex 헬프센터](https://guide.flex.team/ko/) |
| 74 | Shiftee · shiftee.io | [통합 인력관리 솔루션 · 시프티](https://shiftee.io/ko) |
| 75 | Greeting · greetinghr.com | [그리팅 서비스 소개](https://guide.greetinghr.com/ko/articles/introduce-e95e1131) |
| 76 | 원티드 · wanted.co.kr | [면접 제안 서비스는 무엇인가요? – 원티드 고객센터](https://help.wanted.co.kr/hc/ko/articles/360035972771-%EB%A9%B4%EC%A0%91-%EC%A0%9C%EC%95%88-%EC%84%9C%EB%B9%84%EC%8A%A4%EB%8A%94-%EB%AC%B4%EC%97%87%EC%9D%B8%EA%B0%80%EC%9A%94) |
| 77 | Dooray! · dooray.com | [화상회의 : 올인원 협업툴 Dooray!](https://dooray.com/main/service/meeting/) |
| 78 | 플로우 · flow.team | [플로우 업무 2.0 맛보기! (New)](https://support.flow.team/ko/flow/task-custom) |
| 79 | 잔디 · jandi.com | [잔디 화면 구성](https://support.jandi.com/ko/articles/start-jandi-page-ab85b112) |
| 80 | 채널톡 · channel.io | [2026.06.30 대규모 업데이트](https://docs.channel.io/updates/ko/articles/20260630-%EB%8C%80%EA%B7%9C%EB%AA%A8-%EC%97%85%EB%8D%B0%EC%9D%B4%ED%8A%B8-459c53d0) |
| 81 | 클래스팅 · classting.com | [클래스팅 이용 가이드](https://resources.classting.com/) |
| 82 | 하이클래스 · hiclass.net | [HiClass](https://el.hiclass.net/) |
| 83 | 키즈노트 · kidsnote.com | [키즈노트 - 영유아 교육 기관 NO.1 커뮤니케이션 플랫폼](https://www.kidsnote.com/) |
| 84 | 클래스카드 · classcard.net | [클래스카드 · 영어쌤 1/3이 선택한 스마트 단어장!](https://www.classcard.net/Home/service) |
| 85 | 워크메이트 · foreducator.com | [Foreducator · 생기부·학급관리·시간표·교사 커뮤니티](https://www.foreducator.com/) |

### 예약·일정

탐색 관점: 날짜·시간 선택, 가능한 상태의 표현.

| 번호 | 사이트 | 검색으로 확인한 대표 공식 자료 |
| ---: | --- | --- |
| 86 | Calendly · calendly.com | [How to book meetings in real time · Calendly Help](https://calendly.com/help/how-to-book-meetings-in-real-time) |
| 87 | Cal.com · cal.com | [Cal.com · Scheduling Software for Online Bookings](https://cal.com/) |
| 88 | SavvyCal · savvycal.com | [Features · SavvyCal](https://savvycal.com/features) |
| 89 | TidyCal · tidycal.com | [Availability Schedules in TidyCal - TidyCal FAQ](https://help.tidycal.com/article/720-global-availability-in-tidycal) |
| 90 | YouCanBookMe · youcanbook.me | [Powerful Online Scheduling Software · YouCanBookMe](https://youcanbook.me/features) |
| 91 | Doodle · doodle.com | [Create Your Agenda and Organize Appointments · Doodle](https://doodle.com/en/agenda/) |
| 92 | SimplyBook.me · simplybook.me | [FAQ - The Appointment Booking Scheduler, SimplyBook.me](https://simplybook.me/en/faq/index/) |
| 93 | Setmore · setmore.com | [Calendar Settings · Support - Setmore: Free Online Appointment Scheduling Software](https://support.setmore.com/en/collections/11660154-calendar-settings) |
| 94 | Appointlet · appointlet.com | [Appointlet: Online Appointment Scheduling Software](https://www.appointlet.com/) |
| 95 | Acuity Scheduling · acuityscheduling.com | [Acuity Scheduling Features - Acuity Scheduling](https://www.acuityscheduling.com/features) |

### 재무·고객 업무

탐색 관점: 누락·진행·완료 상태, 요약과 원자료.

| 번호 | 사이트 | 검색으로 확인한 대표 공식 자료 |
| ---: | --- | --- |
| 96 | Stripe · stripe.com | [Stripe Products and Features · Stripe](https://stripe.com/products) |
| 97 | Ramp · ramp.com | [Ramp Products and Platform Features · Cards, Expenses, AP & More](https://ramp.com/products) |
| 98 | Mercury · mercury.com | [March 2026 product updates · Mercury](https://mercury.com/blog/march-2026-product-updates) |
| 99 | Brex · brex.com | [Brex dashboard and app](https://www.brex.com/support/brex-dashboard-and-app) |
| 100 | Spendesk · spendesk.com | [Understand the Controller view's dashboard · Spendesk Help Center](https://helpcenter.spendesk.com/en/articles/3999723-understand-the-controller-view-s-dashboard) |
| 101 | Expensify · expensify.com | [All Expensify Product Features · Expensify](https://use.expensify.com/all-products) |
| 102 | Xero · xero.com | [Your Xero homepage – Xero Central](https://central.xero.com/0/article/Your-Xero-dashboard) |
| 103 | FreshBooks · freshbooks.com | [How do I use my dashboard? – FreshBooks](https://support.freshbooks.com/hc/en-us/articles/115015407988-How-do-I-use-my-dashboard) |
| 104 | QuickBooks · quickbooks.intuit.com | [View your business dashboard details](https://quickbooks.intuit.com/learn-support/en-us/help-article/product-setup/business-dashboard-details-quickbooks-online-app/L46DORrt9_US_en_US) |
| 105 | Wave · waveapps.com | [Overview of your business Dashboard (new Dashboard experience) – Help Center](https://support.waveapps.com/hc/en-us/articles/48497863638548-Overview-of-your-business-Dashboard-new-Dashboard-experience) |
| 106 | Intercom · intercom.com | [Real-time Dashboard · Intercom Help](https://www.intercom.com/help/en/articles/5784131-real-time-dashboard) |
| 107 | Front · front.com | [Product Tour · Front](https://front.com/product-tour) |
| 108 | Zendesk · zendesk.com | [Overview of the Zendesk Knowledge dashboard – Zendesk help](https://support.zendesk.com/hc/en-us/articles/4408823886874-Overview-of-the-Zendesk-Knowledge-dashboard) |
| 109 | Help Scout · helpscout.com | [What is Self Service? - Help Scout Support](https://docs.helpscout.com/article/1755-what-is-self-service) |
| 110 | Crisp · crisp.chat | [Getting started with the Crisp Analytics · Crisp Knowledge Base](https://help.crisp.chat/en/article/getting-started-with-the-crisp-analytics-fwul5i/) |

### 디자인·지식

탐색 관점: 편집 화면의 위계, 도구 노출, 정보 탐색.

| 번호 | 사이트 | 검색으로 확인한 대표 공식 자료 |
| ---: | --- | --- |
| 111 | Figma · figma.com | [Figma: The collaborative canvas for design, code, and AI](https://www.figma.com/) |
| 112 | Framer · framer.com | [Framer Help: What is a workspace?](https://www.framer.com/help/articles/what-is-a-workspace-and-why-is-it-useful/) |
| 113 | Webflow · webflow.com | [Plans & pricing · Webflow](https://webflow.com/pricing) |
| 114 | Canva · canva.com | [Boost productivity and collaboration · Canva Premium features](https://www.canva.com/business/features/productivity/) |
| 115 | Miro · miro.com | [The Best Miro Features To Get Started With](https://miro.com/features/) |
| 116 | Mural · mural.co | [Features · Mural](https://www.mural.co/features) |
| 117 | Whimsical · whimsical.com | [Whimsical — The whiteboard for product builders](https://whimsical.com/) |
| 118 | Excalidraw · excalidraw.com | [Excalidraw+ for teams · Collaborative workspace made simple](https://plus.excalidraw.com/excalidraw-for-teams) |
| 119 | Pitch · pitch.com | [Getting started with Pitch · Pitch · Help Center](https://help.pitch.com/en/articles/8038180-getting-started-with-pitch) |
| 120 | Gamma · gamma.app | [How do collaboration and sharing settings work in Gamma? · Gamma Help Center](https://help.gamma.app/en/articles/11047226-how-do-collaboration-and-sharing-settings-work-in-gamma) |
| 121 | Slab · slab.com | [Features - Slab](https://slab.com/features/) |
| 122 | Slite · slite.com | [Workspace Settings · Slite Help Center](https://slite.com/help/udZ9hefNXMiDcv/Workspace-Settings) |
| 123 | Superhuman · superhuman.com | [Create and manage your Superhuman Docs workspace – Superhuman Help Center](https://help.superhuman.com/hc/en-us/articles/46210170813197-Create-and-manage-your-Superhuman-Docs-workspace) |
| 124 | Readwise · readwise.io | [What is Readwise Reader? - Readwise Docs](https://docs.readwise.io/reader/docs) |
| 125 | Raindrop · raindrop.io | [Raindrop.io — All-in-one bookmark manager](https://raindrop.io/) |

## 범위와 한계

- 공개 웹 자료를 통한 디자인 탐색이다. 유료 제품 구독, 계정 생성, 실제 제출, 사용자 데이터 수집은 하지 않았다.
- 125개 검색 결과에는 제품 소개·도움말·공개 가이드가 섞여 있다. 이를 125개 제품의 전체 화면 분석으로 표현하지 않는다.
- 페이지 일부는 언어·브라우저·시점에 따라 달라진다. 공개 마케팅 페이지를 로그인 제품의 전체 품질로 일반화하지 않는다.
- 상표·고유 아이콘·실제 화면을 복제하지 않고 화면 구조·밀도·문장·상태 표현의 원칙을 추출했다.
- 현재 실제 화면의 학생 정보는 시안에 전사하지 않았다. 시안은 별도의 가상 명단이다.

