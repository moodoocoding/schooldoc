# 네 기능 운영 적용 확인 (codex)

2026-10-02 KST에 가정통신문 수합·등록부 서명·자료 수합·특별실 예약의 통합을 완료했다. [PR #45](https://github.com/moodoocoding/schooldoc/pull/45)를 squash 병합했고 main 커밋은 `fdc2e19ffbf4c1f923998fbb4b5616b90f28e866`이다. 제목은 `fix(shared): 수합·서명·예약 검토 수정과 DB 조회 최적화 통합`이다. 기존 기능 브랜치와 인계 커밋은 [통합 보고서](report.md)에 보존했다.

## 적용 결과

| 대상 | 상태 | 확인 근거 |
| --- | --- | --- |
| Supabase DB | 적용 확인 | jhystopaacyfvjxhnpyd에 신규 5개 적용. 전체 33개 local/remote 이력 일치와 실제 현재 응답·ready 집계 및 직접 제출 RPC 권한 확인. [이력](remote-migrations.txt), [메타데이터](remote-summary.txt) |
| 지정 Edge Functions | 적용 확인 | consent-forms-admin/public, registry-public/participants/pdf, data-collect-admin/public, special-rooms-admin/public 아홉 개 ACTIVE. 기존 verify_jwt 설정 유지. [버전](edge-versions.json), [배포 로그](edge-deploy.txt) |
| 프런트엔드 | 적용 확인 | main 자동 배포 `dpl_FkSNmp6MtwTk7bdCH3XK6KKcxLR8`, READY와 위 main SHA 일치. [배포 메타데이터](production-deployment.json), [운영 사이트](https://schooldoc-nine.vercel.app) |

기존 키를 유지했고 DB→지정 Edge Functions→main/프런트 순서로 반영했다. 운영 업무 생성·제출·파일 삭제·파기는 실행하지 않았다.

## 실제 Chrome 운영 확인

설치된 Google Chrome을 agent-browser로 열어 홈의 주요 도구·로그인·빈 페이지 및 page error를 확인했다. 이후 Playwright `channel: chrome`으로 아래를 데스크톱 1440×1000, 모바일 390×844에서 각각 실행했다. 데모와 모의 API를 사용하지 않았다.

- 홈 2회: 주요 도구 표시·HTML 200·가로 넘침 없음.
- 네 기능 로그인 전 탐색 8회: 홈의 시작 버튼으로 실제 관리 경로 이동 후 Google 로그인 안내 확인. OAuth 로그인 완료 검사는 아니다.
- 존재하지 않는 가상 공개 링크 8회: 운영 Supabase의 실제 404와 사용자용 오류 표시 확인. 자료 수합·특별실은 두 화면 크기에서 재시도 요청 4회도 확인.
- 18개 화면 모두 page error 0, 오류 overlay 0, 수평 스크롤 넘침 0. 초기 all-zero UUID는 규칙에 맞지 않아 400이었으며, 유효한 형식의 가상 UUID로 바꿔 404 경로를 확인했다. 제품 결함이나 성공한 원격 제출로 기록하지 않는다.

[재현 도구](production-browser.mjs), [결과](production-browser.json). agent-browser의 홈 snapshot에는 준비된 일곱 주요 도구와 Google 로그인이 표시됐고 오류 목록은 비어 있었다. 홈 데스크톱/모바일·대표 로그인 안내·네 공개 오류 상태의 전체 캡처를 직접 열어 글자 겹침·잘림·핵심 상태가 식별되는지 확인했다.

대표 캡처: [홈 데스크톱](production-home-desktop.png), [홈 모바일](production-home-mobile.png), [로그인 안내 모바일](production-consent-auth-mobile.png), [가정통신문 오류](production-consent-public-error-mobile.png), [등록부 오류](production-registry-public-error-mobile.png), [자료 수합 재시도](production-data-public-error-mobile.png), [특별실 재시도](production-rooms-public-error-mobile.png).

## 검증 범위와 후속 작업

통합 코드의 타입·린트·빌드, 단위 501개, 실제 Chrome 데모/모의 API 고유 90개와 Deno/로컬 SQL 검사를 통과했다. 원격 API·익명 RLS 읽기/거부 17개와 운영 Chrome 18개 화면·재시도 4개는 각각 구분한다. 자세한 명령·첫 실패 및 재검사·기능별 AI 모의 디자인 검토는 [통합 보고서](report.md)를 따른다.

실제 Google OAuth 완료·로그인 후 소유자 간 쓰기 격리·Storage 제출/복구/파기·서버 PDF·다중 연결 잠금 및 학교 부하는 미검증이다. 특별실 빠른 private 알림용 새 신뢰 서명키가 없어 기존 수동/복귀/5분 조건부 확인을 사용한다. 원격 Realtime 신뢰·권한 검증은 남는다. 가정통신문 긴 QR 이름과 긴 목록 공유 영역은 후속 UI 개선 대상이다.

외부 공유 개발일지는 이 checkout에서 없어 저장소 [개발일지](../../../docs/development-history.md)에 완료 기록을 추가했다. 실제 전문가·교사 사용성 시험을 받았다고 주장하지 않는다. 원래 공유 checkout의 영수증 미커밋 수정은 보존했다.
