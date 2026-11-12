# Neis Helper 참고 프로젝트 비교 (codex)

확인일: 2026-11-12 KST. GitHub 저장소 검색과 README·실제 소스의 정적 검토 결과다.
외부 앱을 실행하거나 같은 학생 자료로 생성 품질·속도를 시험하지 않았다.
스타 수는 GitHub REST 저장소 응답의 `stargazers_count`를 조회했다.
검색어는 성적처리·평어·생활기록부·생기부·세특·행동특성·누가기록·학교스포츠클럽·NEIS이며 이름·설명과 README를 검색했다.
검색으로 발견한 관련 후보의 비교이지 GitHub 전체의 완전한 순위가 아니다.

## 관련 후보 — 스타 내림차순

| 저장소 | 스타 | 확인한 기능과 범위 |
| --- | ---: | --- |
| [neis-counter](https://github.com/hjh010501/neis-counter) | 148 | NEIS 글자·바이트 계산 보조 도구. 기록 생성기는 아니다. |
| [EduKit-BE](https://github.com/Team-bbangbbangs/EduKit-BE) | 9 | 중·고등 교사용 LLM 생활기록부 작성·관리. 같은 서비스의 [FE](https://github.com/Team-bbangbbangs/Edukit-FE)는 6스타. |
| [school-life-record](https://github.com/tigerjk9/school-life-record) | 7 | NEIS Excel을 받아 세특·창체·봉사·행특을 점검하고 수정안을 제공한다. |
| [korean-school-records-toolkit](https://github.com/blueshadow62/korean-school-records-toolkit) | 6 | Codex·Claude Code에서 근거 기반 세특·창체·행특 초안과 바이트 계산. 일반 교사용 독립 웹앱은 아니다. |
| [School-Record-App](https://github.com/itmir913/School-Record-App) | 2 | 학생×활동 격자 작성, 영역별 합산·바이트, 자동 저장·이력·스냅샷, 나이스 양식 Excel 출력. |
| [school-report-with-solar](https://github.com/techkwon/school-report-with-solar) | 2 | 세특·행동특성·자율·진로·동아리, 개별 생성 3종 문안, CSV 일괄 처리. |
| [sgbcheck2](https://github.com/myeonghanlee/sgbcheck2) | 2 | Excel 학생부의 동일·유사 문장 점검과 색상 표시 내보내기. |
| [behavior_dev](https://github.com/davidlee11/behavior_dev) | 2 | 행동특성 및 종합의견 작성 도우미. README가 짧아 상세 비교는 보류했다. |
| [NeisAutoInputV4](https://github.com/cyeons/NeisAutoInputV4) | 1 | 초등 성취기준 기반 평어, 학생 특성 기반 행동발달, Windows 붙여넣기 자동화. |
| [EduNote](https://github.com/codersongpro/edunote) | 0 | 요청한 네 영역의 전용 생성 화면과 검토·수정·복사·CSV 저장. |
| [neis-sportsclub](https://github.com/Dark83Duck/neis-sportsclub) | 0 | 스포츠클럽 참가자 선택·활동시간 일괄 적용 확장 프로그램. 특기사항 문장 생성기는 아니다. |

급식·시간표 NEIS API, 프로그래밍 연습용 성적 산출기, 대입 서류 평가 서비스는 목적이 달라 비교에서 제외했다.

## 기능과 간결성 판단

**네 영역의 전용 AI 작성 기능을 한 제품에서 제공한다는 기준에서는 EduNote가 가장 가깝다.**
다른 후보가 더 단순한 부분은 확인했으나, 네 영역 전체의 기능과 간결성을 동시에 넘어선다고 판단할 근거는 부족하다.

### EduNote

- [세특 화면](https://github.com/codersongpro/edunote/blob/main/src/renderer/components/SubjectGenerator.tsx): 인원 → 과제 → 개별 평가 → 결과의 네 단계. 전체·선택 생성, 과목별 관리, 원본 자료 가져오기, 바이트, 중복 검사, 생성 이력, 실패 항목 재시도, 검토 완료·최종본 고정, 최종본 CSV가 구현되어 있다.
- [행동특성](https://github.com/codersongpro/edunote/blob/main/src/renderer/components/OpinionGenerator.tsx)과 [스포츠클럽](https://github.com/codersongpro/edunote/blob/main/src/renderer/components/SportsClubGenerator.tsx)은 세 단계이며 특성·관찰 내용, 선택·전체 생성, 결과 수정·복사·CSV·바이트·이력을 제공한다.
- [창체 화면](https://github.com/codersongpro/edunote/blob/main/src/renderer/components/CreativeActivityGenerator.tsx)은 인원 → 활동 → 개별 기록 → 결과의 네 단계. 활동 유형·연간 지도 계획·학생별 관찰 내용을 종합한다.
- 창체 생성 화면과 [상태 모델](https://github.com/codersongpro/edunote/blob/main/src/renderer/types.ts)에는 날짜·시간·참여 학생별 누가기록을 행 단위로 쌓는 전용 구조가 확인되지 않았다. 활동별 추가 관찰 내용과 날짜별 누가기록 관리는 구분해야 한다.
- [검토 규칙](https://github.com/codersongpro/edunote/blob/main/src/renderer/lib/recordRules.ts)은 바이트 초과·주의 표현·다른 학생 이름 등을 코드로 점검한다. 모든 기재요령을 보장하는 것은 아니다.
- 간결성은 보통으로 판단한다. 기능별 3~4단계와 별도 설정·결과 조작이 있어, 공통 명단과 편집기를 쓰는 네 기능 전용 화면으로 단순화할 여지가 있다. 실제 클릭 수·작업 시간 비교를 한 결론은 아니다.

### 더 단순한 대안의 장점과 한계

| 후보 | 참고할 장점 | EduNote 대신 채택하기 어려운 점 |
| --- | --- | --- |
| NeisAutoInputV4 | 초등 평어·행동발달에 집중. 학생 특성 선택과 결과 적용 흐름이 명확하다. | 전용 생성 기능은 두 영역. [자동 입력](https://github.com/cyeons/NeisAutoInputV4/blob/main/neis_v4/automation/runner.py)은 Ctrl+V·Tab 반복이며 NEIS API나 학생 대조·저장 확인 기능이 아니다. |
| School-Record-App | [학생×활동 격자](https://github.com/itmir913/School-Record-App/blob/master/src/sections/RecordSection.vue)에서 연속 작성·자동 저장·합산. 학급 전체 기록 편집 방식의 참고 가치가 높다. | 검토한 문서와 작성 화면은 직접 입력·취합 중심. 네 영역의 전용 AI 생성 도구와 동일한 대체재로 볼 수 없다. |
| school-report-with-solar | [개별 화면](https://github.com/techkwon/school-report-with-solar/blob/main/src/components/SingleMode.tsx)에 활동명·키워드·상세 입력과 세 문안, [일괄 화면](https://github.com/techkwon/school-report-with-solar/blob/main/src/components/MultiMode.tsx)에 CSV 처리. | 스포츠클럽 전용 유형 미확인. [분량 표시](https://github.com/techkwon/school-report-with-solar/blob/main/src/components/CharacterCounter.tsx)는 글자 수다. CSV 입력을 쉼표로 단순 분리하므로 쉼표·줄바꿈을 포함한 기록의 처리는 추가 검증이 필요하다. |
| EduKit | 학생과 작성 기록을 관리하는 서비스 구조. | [지원 유형](https://github.com/Team-bbangbbangs/EduKit-BE/blob/develop/edukit-core/src/main/java/com/edukit/core/studentrecord/db/enums/StudentRecordType.java)은 세특·행특·진로·자율·동아리. 학교스포츠클럽 전용 유형 미확인. 높은 스타만으로 더 간결하다고 판단할 수 없다. |
| school-life-record | 완성한 기록을 검사하고 수정 전후를 비교하는 후처리 흐름. | 기록 생성·누가기록 관리의 대체재가 아니다. |
| korean-school-records-toolkit | 관찰 근거를 우선하고 분량을 코드로 계산하는 작업 원칙. | 코딩 에이전트용 스킬이므로 교사용 화면의 간결성 비교 대상은 아니다. |

## Neis Helper에 적합한 방향

EduNote의 네 영역과 검토 기능을 참고하되, 화면은 공통 명단과 하나의 학생별 편집 흐름으로 줄이는 방향이 적절하다.
관찰 기록 → 초안 작성 → 교사 수정·확정 → 복사·Excel 출력으로 통일하고,
창체에는 날짜·영역·활동·참여 학생·관찰 내용을 누적하는 기록표를 별도로 둔다.
이것은 비교를 바탕으로 한 제안이며 네 실제 기능은 아직 구현하지 않았다. 외부 프로젝트 코드를 복사하지 않았다.
