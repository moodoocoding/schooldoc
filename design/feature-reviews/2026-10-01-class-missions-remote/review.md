# 학급 미션 실제 원격 연동 검사

2026-10-01 08:02 KST 최종 실행 완료. 사용자 요청에 따라 운영 서버에서 가상 자료만 사용했다.

## 결과

**11개 검사 그룹 모두 통과했다. 이 중 한 그룹은 실제 PostgreSQL의 8개 SQL 계약을 검사한다.** 제품 코드·운영 설정·스키마·암호화 키 변경은 없다.

- 운영: https://schooldoc-nine.vercel.app
- Supabase: jhystopaacyfvjxhnpyd, class-missions-admin v4 / class-missions-public v3 ACTIVE
- 확인한 main: 82cd42c72c916b1aebb8ab6de362caab4b7b1632. 학급 미션 수정 c30cdea를 포함한다.
- 교사 2명의 임시 가상 계정을 관리자 API로 만들고 실제 Supabase 비밀번호 로그인·JWT 사용자 확인을 수행했다. 운영 Chrome 교사 화면에는 이 실제 세션을 사용했다. 학생은 별도의 비로그인 모바일 브라우저였다. Google 계정 선택/OAuth 화면을 자동화한 검사는 아니다.

| 검사 그룹 | 결과·근거 |
| --- | --- |
| 로그인·서버 소유자 검사 | 실제 JWT 검증, 익명 관리 요청 401, 교사별 학급 목록 격리, 상대 학급 변경 404 |
| 암호화 저장·발행 | 실제 명단/개인 코드 저장 후 암호문에 가상 이름·코드 평문 없음. 실제 미션 발행·복호화 조회 |
| RLS·DB 권한 | anon·소유자·다른 교사의 두 테이블 SELECT/INSERT/UPDATE/DELETE 및 파기 RPC 호출이 SQLSTATE 42501로 차단됨. RLS 활성화·권한 설정도 SQL로 확인 |
| 학생 식별·응답 최소화 | 동명 이름 400·개인 코드 안내, 이름과 코드가 함께 있으면 코드 우선, 고유 이름 접속, 다른 학생 명단·대상 ID 없는 공개 응답 |
| 실제 제출·동시성 | 동명 2번의 코드 제출이 정확한 학생에게 저장됨. 완료·취소, 두 학생 동시 제출·버전 2 증가·응답 유실 없음, 오래된 교사 저장 409 |
| 확인·파기 안전장치 | 대기 명단 불일치 409, 정확한 일괄 확인, 확인 후 학생 취소 400, 파기 건수 불일치 409·진행 중 미션 파기 400 |
| 공유 제어 | 공개 중지·재개, 토큰 재발급 후 기존 링크 404 |
| 실제 PostgreSQL 계약 | 아래 8개 계약 통과. 모든 시험 SQL 변경은 ROLLBACK |
| 운영 로그인/학생 브라우저 | 실제 교사 세션의 학급 조회, 독립 비로그인 390×844 학생 화면의 동명 오류·개인 코드 접속·나가기·이름 재접속 |
| 운영 충돌 복구·확인 | 학생 화면→운영 Edge→실제 SQL 제출. 교사 초안 409 뒤 제목·안내·기간·확인 옵션·대상 유지, 수동 재저장, 교사 확인→학생 새로고침 반영. 브라우저 예외·모바일 가로 넘침 없음 |
| 운영 계정 전환 | 다른 실제 시험 계정 세션으로 전환/새로고침하면 이전 교사 학급·미션 상태가 사라지고 해당 교사 학급만 표시 |

SQL 계약은 RLS/ACL·service 전용 security invoker RPC, 소유자/버전 불일치 거부, 음수 건수 거부, 삭제/재삽입 이후 감사 INSERT 제약 오류의 전체 롤백, 정상 행 교체와 보존 필드, retry→resolved·completed 감사 기록, 오래된 요청 재실행 거부, 마지막 명단 파기 시 공개 중지·토큰 변경이다. 시험용 행과 감사 기록을 트랜잭션 안에서 생성했고 최종 ROLLBACK했다. 실제 사용자 자료를 파기하지 않았다.

## 실행·정리

- `node --check tests/integration/classMissions.smoke.mjs`: 통과.
- `node_modules/.bin/oxlint.cmd tests/integration/classMissions.smoke.mjs`: 통과.
- `node tests/integration/classMissions.smoke.mjs`: 최종 11개 검사 그룹 통과. 대상·쓰기 허용 확인 환경 변수와 기존 API 키 JSON을 부모 프로세스 메모리로 전달했다. 키·비밀번호·세션·개인 코드는 출력하거나 파일에 저장하지 않았다.
- 검사 도구 안에서 `supabase db query --linked --project-ref <대상> --output json --file <가상 SQL 파일>` 실행: 8개 계약 통과. SQL 파일은 실행 후 삭제했다.
- 매 실행마다 정확한 가상 계정 ID·metadata를 확인해 정리했다. 가상 계정 2개와 미션 학급 2개씩, 4번의 실행에서 계정 총 8개 모두 삭제했다. 계정 부재·미션/역할 연관 행 부재와 정리 완료를 확인했다.
- 처음 3번은 검사 도구의 선택자/순서 문제로 중단했다. 첫 시도는 나가기 후 코드 입력 방식을 유지한다고 잘못 예상했고, 다음 시도들은 입력 이후 textarea 라벨 문자열이 변해 `getByLabel(..., exact:true)`가 찾지 못했다. 전체 화면에서는 입력 값이 남아 있는 것을 확인했다. 실제 UI에 맞는 이름 입력과 textbox 접근성 선택자로 고친 뒤 전체를 재실행해 통과했다. 제품 코드는 수정하지 않았다.

## 증거와 한계

- [최종 실행 결과](evidence/results.json), [교사 전체 화면](evidence/teacher-desktop.png), [학생 모바일 전체 화면](evidence/student-confirmed-mobile.png)
- 초기 중단/정리 결과는 [첫 시도](attempts/attempt-1.json), [두 번째 시도](attempts/attempt-2.json), [세 번째 시도](attempts/attempt-3.json)에 보존했다. 캡처의 교사·학생·미션은 모두 가상 자료다.
- Google 대화형 OAuth, 실제 교사 인터뷰·학생 사용성 시험, 학교 NAT 부하/비용·실물 기기·스크린리더 검사는 포함하지 않았다.
- 실제 90일 경과 자료의 API 파기는 실행하지 않았다. 서버의 진행 중/건수 거부와 실제 파기 SQL의 원자성·롤백·감사 기록·링크 회수는 구분해서 확인했다.
- 이번 기록은 실제 원격 검사의 재실행 도구와 증거를 게시하기 위한 자료다. 제품 코드·설정·DB 변경은 없으며 전체 단위·타입·빌드는 이번 게시 작업에서 다시 실행하지 않았다. 기존 제품 수정의 검증·배포는 [PR #39](https://github.com/moodoocoding/schooldoc/pull/39)를 참조한다.
- 최종 원격 SQL 집계에서 이번 네 번의 실행 metadata와 일치하는 잔여 시험 계정은 0개였다. PR #39 검증 본문에 최종 실행 결과를 반영했다.

## 재실행

[Node 검사 도구](../../../tests/integration/classMissions.smoke.mjs)와 [SQL 계약](../../../tests/integration/classMissions.transactions.sql)을 함께 사용한다. 일반 `npm test`에는 포함되지 않는다. Supabase CLI 2.118.0의 `db query` 지원과 로그인된 CLI, 설치된 프로젝트 의존성 및 Chrome이 필요하다.

| 환경 변수 | 의미 |
| --- | --- |
| `MISSIONS_SMOKE_PROJECT` | 시험을 허용한 Supabase 프로젝트 ref |
| `MISSIONS_SMOKE_ALLOW_WRITE` | 위 ref와 정확히 같아야 실행됨. 가상 계정·학급 생성과 정리에 대한 명시적 허용 |
| `MISSIONS_SMOKE_ORIGIN` | 해당 Supabase에 연결된 프런트엔드 origin |
| `MISSIONS_SMOKE_KEYS` | `supabase projects api-keys --project-ref <대상> --output json` 결과. anon/service_role 키를 부모 프로세스 환경으로만 전달하며 파일·로그에 기록하지 않음 |
| `MISSIONS_SMOKE_SUPABASE_CLI` | `execFile`로 실행할 Supabase 네이티브 실행 파일의 절대 경로 |
| `MISSIONS_SMOKE_OUTPUT` | 기본값 `test-results/missions-remote`. 결과·가상 자료 캡처와 정리 실패 시 복구용 ID 기록을 남기는 위치 |

프로젝트 루트에서 `node tests/integration/classMissions.smoke.mjs`를 실행한다. 실행 종료 후 부모 프로세스의 키 환경 변수도 삭제한다. SQL은 이번 실행의 가상 소유자 metadata를 확인한 뒤 롤백하며, 마지막에 정확한 가상 사용자 ID와 연관 행의 삭제를 확인한다. 정리가 실패하면 종료 코드가 실패로 남고 출력 폴더의 `cleanup.local.json`을 보존한다. 해당 파일은 정리 대상 확인에만 사용하고 저장소에 게시하지 않는다.
