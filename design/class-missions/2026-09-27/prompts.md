# 학급 미션 이미지 시안 생성 기록

두 최종 PNG는 내장 `image_gen`으로 생성했다. 실제 앱의 캡처가 아니며, 가상 학급·학생·날짜만 사용했다. 생성 이미지의 글자·수치는 기획서의 상태 정의와 맞도록 후속 정밀 편집했다.

## 교사용 전체 화면 — 최종 유효 프롬프트

```text
Use case: ui-mockup
Asset type: SchoolDoc feature planning document, representative teacher desktop screen
Create a high-fidelity full-page 1440x900 Korean teacher web-app mockup, flat screenshot without device frame.
Use the SchoolDoc visual language: near-white background #F6F8FB, charcoal #0F172A, blue #0F6CBD primary action, a small warm orange accent, left sidebar, generous whitespace, fine gray dividers.
Show 학급 도구 / 학급 미션, title 학급 미션, subtitle 학생의 완료 표시와 교사 확인을 한눈에 봅니다., and 새 미션 만들기.
Top summary: 진행 중 3개, 확인 대기 3명, 마감 임박 1개.
Selected mission: 우리 동네 안전 표지 찾기. Instruction: 안전 표지를 찾아 뜻을 알아보고, 완료했다면 표시합니다. Due 9월 30일, 완료 표시 18/24명.
Student status groups: 표시 전 6명, 완료 표시 15명, 확인 대기 3명. The pending three fictional names are 안지호, 오채린, 한예준; repeat those same names in the right-hand 확인 대기 action panel. Include 확인하기 buttons and two other missions below.
Sidebar order: SchoolDoc, 홈, 진행 업무, 학급 도구, 1인 1역, 학급 미션 (active), 가정통신문, 학생 결과 안내, 등록부 서명, 자료 수합, 특별실 예약, 설정.
Use labels/icons as well as color, realistic Korean typography, complete visible page. No photos, mascot, gradients, watermark, or unrelated UI.
```

실제 제작은 위의 레이아웃 생성 후 네 차례 정밀 편집으로 통계 수치·대기자 이름·`표시 전` 용어·안내 문구·기존 SchoolDoc 도구 메뉴를 맞췄다. 메뉴 수정 전 파일은 [drafts/teacher-dashboard-v1.png](drafts/teacher-dashboard-v1.png)로 보존했다. 최종 파일은 [teacher-dashboard.png](teacher-dashboard.png)다.

## 학생용 모바일 전체 화면 — 생성 프롬프트

```text
Use case: ui-mockup
Asset type: SchoolDoc class mission planning document, representative student mobile web screen
Create a high-fidelity flat 390x844 portrait Korean mobile web-app mockup, full screen only, no device frame.
Use a light #F6F8FB background, white cards, dark navy #0F172A text, blue #0F6CBD primary action, a small orange due-date accent, generous touch targets, and readable Korean type.
Show SchoolDoc, fictional greeting 안녕하세요, 김하늘 학생, 5학년 3반 · 오늘 할 일, summary 해야 할 일 2 / 완료 표시 1 / 교사 확인 1.
Primary mission: 우리 동네 안전 표지 찾기, instruction 안전 표지를 찾고 뜻을 알아보세요., due 9월 30일까지, large blue 완료했어요 button.
Below: 책 20분 읽기 with 완료 표시 and 완료 취소; 준비물 챙기기 with 교사 확인.
Explanatory note: 완료 표시는 내가 한 일을 알리는 기록입니다. Bottom navigation 내 미션 / 지난 기록.
Student sees only their own missions. Distinguish all states by text and icons as well as color. No other student names, rankings, reward system, file upload, photos, watermark, or gibberish.
```

최종 파일은 [student-mobile.png](student-mobile.png)다. 이미지 안의 ‘해야 할 일 2’ 중 한 건만 보이는 것은 모바일 스크롤 화면의 첫 구간을 나타낸다.
