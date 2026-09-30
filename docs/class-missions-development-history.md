# 학급 미션 개발 기록

학급 미션 리뷰·수정·검증·배포의 Codex 작업일지다. 각 항목의 미실행·미배포 표기는 그 작업을 마쳤을 당시의 상태이며, 후속 항목에서 실제 반영 결과를 이어 기록한다. 다른 기능의 작업일지나 개인 백업은 포함하지 않는다.

## 2026-10-01 리뷰 F1~F9 수정 (codex)

- 리뷰 기준 `7173d3e`에서 전용 worktree와 `codex/class-missions-review-fixes` 브랜치를 만들었다. 공유 checkout의 사용자 변경은 유지했다.
- 동명이인 임의 선택 차단·개인 코드 안내, 나가기 후 늦은 응답 폐기, 교사 저장 충돌 후 작성 입력 보존·수동 재시도·Promise 처리를 수정했다. 학교 공용 IP와 학급·학생·실패 입력의 요청 제한을 구분했다.
- 학생의 현재 미션과 교사의 현황을 우선 배치하고 QR 바로가기·문구 대비·포커스·시작 전 상태를 개선했다. 세 프로파일과 여섯 AI 모의 관점 평가 후 2차 수정과 전체 화면 재검증을 수행했다. 실제 전문가·교사 인터뷰나 사용성 시험은 아니다.
- 로컬 수정 커밋: `9ca1bc9`, `fix(missions): 학생 식별과 충돌 복구 및 교실 참여 개선`.

| 검사·명령 | 결과 | 범위·한계 |
| --- | --- | --- |
| `npm run typecheck` | 통과 | 프로젝트 참조 타입 검사 |
| `npm run lint` | 통과 | 오류 0, 기존 경고 7건 |
| `npm test` | 통과 | 57개 파일·469개 단위 검사 |
| `deno test --cached-only --allow-env --node-modules-dir=manual tests/server/classMissions.test.ts tests/server/classMissionsRegression.test.ts` | 통과 | 15개 서버 모의 계약·회귀 검사 |
| `deno check --cached-only --node-modules-dir=manual supabase/functions/class-missions-admin/index.ts supabase/functions/class-missions-public/index.ts` | 통과 | 서버 함수 타입 검사 |
| 관련 `npm run test:e2e` | 통과 | Chrome 데모 서버의 기존 9개·회귀 6개·학급 미션 스크롤 1개. 원격 Supabase 검사가 아님 |
| `npm run build` | 통과 | 큰 번들 경고 존재 |
| 수정 리뷰의 `verify.mjs`·`real-zoom.mjs` | 통과 | 9개 브라우저 시나리오, 전체 화면·axe·QR PNG·Excel 재읽기·실제 Chrome 200% 확대 |

상세 명령·결과·전체 화면·모의 검토는 [수정 리뷰](../design/feature-reviews/2026-10-01-class-missions-fixes/review.md)에 보존했다. 당시 실제 Auth·RLS·SQL·학교 부하·실물 기기·스크린리더·실제 사용자 시험은 미실행이었고, GitHub push·main 병합·운영 배포 전이었다. 당시 작업일지는 제품 수정 커밋에서 제외했다.

## 2026-10-01 GitHub 게시·main 통합·운영 배포 (codex)

- 사용자 요청에 따라 수정 브랜치를 push하고 [PR #39](https://github.com/moodoocoding/schooldoc/pull/39)를 만들었다. Vercel 미리보기 성공 후 squash로 main에 병합했다.
- main 수정 커밋: [`c30cdeac6365721ed9f1c6036a5a66e1736fc257`](https://github.com/moodoocoding/schooldoc/commit/c30cdeac6365721ed9f1c6036a5a66e1736fc257), `fix(missions): 학생 식별과 충돌 복구 및 교실 참여 개선 (#39)`. 로컬 수정 소스와 squash 결과의 파일 내용이 같은지 확인했다.
- DB 마이그레이션·새 secret은 해당 없음. 기존 암호화 키와 JWT 검증 설정을 유지했다.
- Edge Functions 적용 확인: 운영 `jhystopaacyfvjxhnpyd`에 소스 `9ca1bc9`의 `class-missions-public` v3 → `class-missions-admin` v4 순서로 배포했다. ACTIVE와 가상 공개 토큰 404·비로그인 관리 요청 401을 확인했다.
- 프런트엔드 적용 확인: main `c30cdea`의 Vercel Production 배포 `ESSCoq7nVDb8xwRMyDQP5WrjZtxr` 성공. [운영 사이트](https://schooldoc-nine.vercel.app)의 첫 화면·교사 로그인 안내·390×844 학생 화면·가상 링크 오류·입력 유지·개인 코드 전환을 새 Chrome 세션에서 확인했다. 브라우저 예외 없음. GitHub Pages 자동 배포도 성공했다.
- 코드 추가 변경이 없어 기존 최종 검사 결과를 유지했다. 당시 원격 검사는 함수 메타데이터·안전한 오류 응답·배포 상태·비로그인 브라우저에 한정했으며 실제 계정·RLS·SQL·학교 부하는 미실행이었다.
- 이후 다른 기능의 PR #40으로 main이 `82cd42c`까지 진행됐다. `c30cdea`가 포함되고 학급 미션 파일 내용이 유지되는지 확인했다. 다른 기능의 변경을 이 작업에 섞지 않았다.

## 2026-10-01 실제 계정·RLS·SQL 검사 (codex)

- 사용자 요청에 따라 main `82cd42c`(`c30cdea` 포함), 운영 미션 공개 v3·관리 v4에서 실제 Supabase Auth·Edge·PostgreSQL과 Chrome을 검사했다. 가상 교사 2명의 실제 비밀번호 로그인/JWT와 독립 비로그인 학생 모바일 세션을 사용했다. Google 대화형 OAuth 화면은 검사하지 않았다.
- 08:02 KST 최종 실행의 11개 검사 그룹이 모두 통과했다. JWT·계정 격리·암호화·SQLSTATE 42501 접근 차단·동명 코드 구분·실제 동시 제출·409 버전 충돌·교사 확인·파기 거부·공개 링크·운영 브라우저 입력 보존/수동 재저장·계정 전환을 확인했다.
- 그중 SQL 그룹은 실제 PostgreSQL의 8개 권한·원자성·행 교체·감사·재실행·공개 회수 계약을 확인했다. 시험용 소유자 metadata를 검증하고 모든 SQL 변경을 ROLLBACK했다. 실제 사용자 자료를 파기하지 않았다.
- 초기 3회는 검사 도구의 나가기 후 입력 방식과 textarea 선택자 문제로 중단했다. 실제 전체 화면에서 입력 보존을 확인하고 검사 도구를 바로잡은 뒤 제품 변경 없이 전체 재실행했다. 성공으로 덮지 않고 초기 결과도 보존했다.
- 네 번의 실행에서 만든 가상 계정 총 8개와 연관 미션·역할 자료를 모두 정리했다. 정확한 계정 ID·metadata와 연관 행 부재를 확인했으며 최종 원격 SQL 집계의 잔여 시험 계정은 0개였다.
- [원격 검사 보고서](../design/feature-reviews/2026-10-01-class-missions-remote/review.md), [최종 결과](../design/feature-reviews/2026-10-01-class-missions-remote/evidence/results.json), [교사 전체 화면](../design/feature-reviews/2026-10-01-class-missions-remote/evidence/teacher-desktop.png), [학생 모바일 전체 화면](../design/feature-reviews/2026-10-01-class-missions-remote/evidence/student-confirmed-mobile.png)에 근거를 보존했다.
- [Node 재실행 도구](../tests/integration/classMissions.smoke.mjs)와 [SQL 계약](../tests/integration/classMissions.transactions.sql)은 명시적 프로젝트 쓰기 허용을 요구하며 일반 `npm test`에는 포함되지 않는다. 키·암호·세션·개인 코드는 파일·로그·저장소에 남기지 않았다.
- 새 제품 코드·설정·키·스키마 변경과 추가 배포는 해당 없음. 이 시점에는 검사 도구·보고서가 로컬 파일이었고 PR #39 본문에 실제 원격 검사 결과를 갱신했다.
- 남은 검증 범위: Google 대화형 OAuth·학교 NAT 부하/비용·실물 기기·스크린리더·실제 사용자 시험. 실제 90일 경과 사용자 자료의 API 파기는 수행하지 않았다. 서버의 파기 거부와 가상 SQL 계약 검증을 구분한다.

## 2026-10-01 원격 검사 자료와 작업일지 게시 (codex)

- 사용자 요청에 따라 위 기록을 GitHub에 게시할 수 있는 학급 미션 전용 작업일지로 정리했다. 외부 공용 개발일지가 없고 공유 `docs`에는 다른 기능의 기록과 개인 백업이 있어, 기존 파일을 덮어쓰지 않고 이 파일을 별도로 추가했다. 과거 이력을 추측해 만들지 않았다.
- 최신 main에서 검사 자료 전용 브랜치를 만들었다. 9개 파일의 상대 링크·JSON 결과·가상 계정 정리 기록·비밀값 패턴·개인 PC 경로 제외와 `git diff --cached --check`를 확인했다. `node --check`와 대상 oxlint 재검사도 통과했다.
- 검사 자료 커밋 `48afdef`, `test(missions): 실제 로그인과 권한·SQL 원격 검사 기록`을 push했다. [PR #41](https://github.com/moodoocoding/schooldoc/pull/41)의 Vercel 미리보기 성공과 9개 변경 파일을 확인한 뒤 squash로 main에 통합했다.
- 검사 자료 main 커밋: [`c947015b47dd499450d9883f81a4b74a4d69fc08`](https://github.com/moodoocoding/schooldoc/commit/c947015b47dd499450d9883f81a4b74a4d69fc08), `test(missions): 실제 로그인과 권한·SQL 원격 검사 기록 (#41)`.
- 이 작업일지는 `codex/class-missions-work-log` 브랜치의 독립 `docs(missions)` 커밋·PR로 게시한다. 최종 push·main 통합 결과는 이 파일의 GitHub 변경 이력과 연결된 PR에 기록한다.
- 게시 작업에서는 제품 코드·빌드 설정을 바꾸지 않아 전체 단위·타입·빌드와 원격 쓰기 검사를 재실행하지 않았다. 기존 원격 검사와 이번 파일 게시 검증을 구분했다. DB·Edge Functions의 추가 적용은 해당 없음이며 프런트엔드의 추가 기능 배포도 필요하지 않다.
