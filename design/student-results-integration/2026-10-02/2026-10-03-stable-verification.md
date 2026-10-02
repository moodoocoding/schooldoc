# 정식 다운로드 EXE 실제 검증 (codex)

작성 시작: 2026-10-03 KST. 아래 대기 항목은 확인 후 결과로 갱신한다.

- PR: https://github.com/moodoocoding/schooldoc/pull/53
- 포함한 가정통신문 PR: https://github.com/moodoocoding/schooldoc/pull/52 (통합 후 닫음)
- squash main: 7cc1680ee30d3416154c9473fe7fa741fbedc444
- main 파일 내용과 검증 후보 ea8b1aa72f171ca1e04447321c895e9e37a7abfb의 diff 없음.
- 후보: https://github.com/moodoocoding/schooldoc/releases/tag/portable-rc-v1.0.1-ea8b1aa72f17
- 후보 EXE: SchoolDoc_Portable_1.0.1_ea8b1aa72f17.exe, 101077789바이트.
- 후보 SHA-256: c5342266fc83ee4878b31a44c80c82f29fbf73a7817b657db5b41df5e8ab992f
- main 자동 검사: https://github.com/moodoocoding/schooldoc/actions/runs/37032935003 — verify/package/publish 모두 성공. 타입·린트(기존6경고)·548단위·306 Chrome + 전용 서버5·15desktop·Deno70/20하위 단계·학생SQL18·마감SQL5·빌드·패키지 실행15 통과.
- 운영 웹: https://schooldoc-nine.vercel.app — Production 6812954201의 동일 main SHA success 확인.
- 정식 릴리즈: https://github.com/moodoocoding/schooldoc/releases/tag/portable-v1.0.1-7cc1680ee30d — 최신 정식, draft=false/prerelease=false, 2026-10-02T16:47:08Z 게시.
- 정식 EXE: SchoolDoc_Portable_1.0.1_7cc1680ee30d.exe, 101078798바이트.
- 정식 SHA-256: 3b2b77b3cd2cd9116cf9709fa7609c051125c2a4d5fd6e41dd6fe9da11d4056c
- 다운로드 파일을 저장소 밖 `C:\Users\Public\Documents\ESTsoft\CreatorTemp\SchoolDoc 정식 검증 7cc1680\한글 공백 경로`에서 실제 실행했다. 같은 경로를 작업 디렉터리로 사용했고 자체 개발 서버는 종료했다.
- 실제 PC: Windows x64 10.0.26200. 이번 시험 전용 프로필의 가상 자료만 사용한다.

| 정식 파일의 필수 항목 | 결과 |
| --- | --- |
| GitHub 재다운로드·manifest 커밋·SHA-256/SUMS | 통과. main SHA/dirty=false/크기/패키지 검사 대상 일치 |
| 저장소 밖 한글/공백 경로, 개발 서버에 의존하지 않는 실행 | 통과. 실제 다운로드 파일로 schooldoc://app 화면 실행 |
| 정상 종료·재실행, Google 인증과 저장값 유지 | 후보 정상 종료 뒤 정식에서 기존 인증·장부·원본 유지 통과. 정식 자체 종료/재실행은 미실행 |
| 같은 EXE 로그아웃·일반 Chrome 계정 선택·재로그인 | 통과. 로그아웃 후 관리 접근 차단, 정상 Chrome 지정 계정 선택 후 같은 EXE 가상 장부 복구 |
| 영수증 장부·IndexedDB 원본 PDF 1/11쪽 | 통과. 예산50000/사용12340/잔액37660·원본1개 유지. 재업로드 없이 PDF native viewer의1쪽·11쪽 실제 표시 |
| 자료 수합 공개 Chrome 제출·교사 EXE 반영·다운로드 | 미완료. 가상나 이름 검색·대상 선택·전달사항 입력까지 확인. 파일 선택 창에서 컴퓨터 조작 도구 중단, 파일 미선택/미업로드/미제출 |
| EXE Windows 인쇄→Microsoft Print to PDF→A4 전체 렌더 | 정식 미실행. 동일 제품 b28 후보 실제 인쇄 성공은 별도 기록 |
| 학생 결과 안내 가상 본인 조회·확인·교사 반영 | 정식 미실행. ea8b 및 이전 후보 실제 결과는 별도 기록 |
| 통신문 원본·아니오 응답 의미·내보내기 | main 운영 Chrome 원본/아니오/제출 전 확인/응답 제출 통과. 정식 EXE 재조회·PDF/Excel은 미실행 |
| 특별실 가상 공개 예약·EXE 실시간 반영 | 정식 미실행. ea8b 실제 공개 예약→EXE 실시간1은 별도 기록 |
| 가상 등록부 서명 상태·이미지 재조회 | 정식 미실행. ea8b 실제 서명 완료1/PDF A4 전체 페이지는 별도 기록 |

## 조작 중단과 재개 기준

Chrome에서 가상 PDF를 선택하려는 정상 파일 선택 창을 연 뒤, Windows 컴퓨터 조작 도구가 현재 브라우저 URL을 충분히 확신할 수 없어 안전 정책 적용을 보장할 수 없다는 이유로 이 턴의 조작을 중단했다. 이후 브라우저/EXE 입력을 재시도하거나 다른 방식으로 우회하지 않았다. 제품의 제출 오류로 단정하지 않는다. 정식 릴리즈는 게시됐지만 **정식 다운로드 EXE 필수 사용 흐름 검증 완료 상태는 아니다**.

재개 시 현재 main/release SHA와 파일 체크섬을 다시 확인하고 정상 컴퓨터 도구의 접근 가능 여부를 확인한다. 정식 자체 종료/재실행→위 표의 미완료 실제 흐름→각 시험 업무 정상 종료와 이번 가상 자료만 정리→추가 결과 기록을 이어간다. 기존 실제 업무 상세·개인정보는 열거나 변경하지 않는다. 시험 자료의 최종 정리도 도구 중단으로 미실행이다.

최신 후보에서는 Google 로그아웃/재로그인·영수증 저장 PDF·가상 학생 82점/확인1·가상 특별실 예약 실시간1·가상 등록부 서명 완료1을 실제 확인했다. 상세 마감 복구/통신문 모바일/인쇄/Excel은 동일 제품 소스의 b28 게시 후보 실제 검증이며 각 버전을 구분해 저장소 기록에 남겼다.

실물 프린터, AI 영수증 인식 정확도, 각 기능의 모든 원격 오류·동시성, 현장 교사/전자칠판 사용성 시험은 미검증이다. 1인1역·학급미션·진행업무·설정은 데모 E2E·서버 계약·패키지 이동 검사이며 모든 실제 원격 업무를 시험했다고 보고하지 않는다.

시험 자료 정리: 학생 안내 196c1452-c99e-4b8a-9349-9dbf1cb62100, 통신문 공개 token d48c4796-810a-4f54-b569-942cf6cbf2e5(이번 운영 추가 응답 제출 성공, 교사 총수 재조회 미실행), 특별실94567046-530f-4404-8c92-a71ef7ad4bbe, 등록부c1c879fc-c8ee-4c4e-a316-e6de641d2820는 아직 수합/조회 중이며 정식 확인 뒤 이번 항목만 UI로 종료·삭제한다. 자료 수합4bddab1c-e4d8-4b09-99f8-cdee0b9dc0aa는 기한2026-10-03 23:59/수합 중/기존 가상가 제출1, 가상나 미제출 상태다. f630f461-beef-4577-97e0-be9b81822a43는 종료 상태이고 즉시 삭제 UI가 없어 보관 기간 전 파기를 우회하지 않는다. 전용 시험 프로필의 가상 장부 receipt-book-ebec3bf0-2c6d-497e-973c-4c69b7cf8c11도 보존했다. EXE 창과 파일 선택 상태를 자동 조작하지 않았다. 이전 기본 프로필의 다른 세션과 공유하는 가상 장부도 미정리로 남긴다.
