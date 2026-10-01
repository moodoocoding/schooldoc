# 학생 결과 안내 서버 수정 검증 및 SR2 승인 대기 (codex)

날짜: 2026-10-01. 브랜치: `codex/fix-student-results-review`.
아래 검사는 가상 학생·시험 키·로컬 메모리 DB로 실행했다. 실제 Supabase와 학교 네트워크에는 요청하지 않았다.

## 반영한 서버 수정

- SR3: 제목·안내·열의 표시 의미 변경 시 학생 버전 모두 갱신, 완료 확인 무효화. 확인이 닫힌 상태에는 새 확인을 요구하지 않으며 상태를 `viewed`로 돌린다.
- SR4: 개인 토큰 교체와 해당 학생 세션 전체 폐기 원자화. 개인 링크 검증/세션 발급도 같은 잠금 순서를 적용한다.
- SR5: 이의·답변의 암호문과 학생 상태를 각각 하나의 RPC로 저장하고, 소유자/세션을 트랜잭션 안에서 재검사한다.
- SR10: 관리자 수정 이력 암호문의 string 타입 좁히기를 추가해 Deno 타입 오류 해결.
- SR2 일부: 안내·성명 HMAC별 실패 10회/분 원자 제한을 추가했고, 정상 인증은 이 실패 횟수에 포함하지 않는다. **기존 학교 IP 공용 인증 10회·개인 인증 20회 제한은 아직 유지된다.**
- 응답 중간에 바뀐 안내와 학생 버전이 혼합되지 않도록 전후 버전 검사·재조회(최대 3회), `RESULT_CHANGED` 응답을 적용했다.
- 만료/종료/개인 링크 오류의 명시적 API 코드를 추가했다. 새 버전 없는 결과 확인은 409로 거부한다.

## 검증 결과

| 검사 | 결과 | 확인 범위 |
| --- | --- | --- |
| Deno 공개·관리 함수 타입 검사 | 통과 | 실제 Edge Function 소스 두 파일 |
| `tests/server/studentResults.test.ts` | 18개 통과 | 실제 HTTP 핸들러+모의 Auth/PostgREST/RPC, 비밀 필드 제외, 소유자, 실패 시 중단, 재발급, 오류 코드, 버전 충돌 |
| `tests/server/studentResults.sql.mjs` | 15개 통과 | PGlite 0.5.8+pgcrypto 실제 SQL, 기존 4개+새 마이그레이션 적용, RLS/함수 실행 권한/롤백 |
| 같은 IP 60명 공개 HTTP 인증 | **미해결** | IP 한도 변경 실행이 자동 승인 검토에서 두 번 거절됨 |
| 운영 Supabase / 다중 PostgreSQL 연결 | 미실행 | 원격 쓰기·배포 요청 없음, PGlite는 단일 연결 |

SQL 검사에서 공용 60명/개인 60명 인증 RPC 성공, 정상 인증의 실패 쿼터 0, 같은 학생 15개 오답 요청의 10회 실패+5회 제한, 다른 학생 쿼터 분리, 다음 분 재인증을 확인했다.
`Promise.all`로 제출한 요청은 단일 PGlite 연결에서 순차 처리된다. 여러 PostgreSQL 연결의 실제 잠금 대기·부하를 측정했다고 해석하면 안 된다.

토큰 교체 뒤 세션 삭제에 강제 실패를 넣어 토큰과 세션이 모두 원래 상태로 롤백됨을 확인했다.
이의 내용 쓰기 뒤 학생 상태, 교사 답변 쓰기 뒤 학생 상태에도 각각 실패 트리거를 넣어 두 저장이 모두 롤백됨을 확인했다.
익명·authenticated의 새 RPC 실행 권한은 없고 service_role에만 있으며, 실제 RLS에서 다른 교사는 학생 행을 읽지 못한다.

## 재현 명령

정식 회귀 소스는 [HTTP 계약 검사](../../../tests/server/studentResults.test.ts)와 [SQL 검사](../../../tests/server/studentResults.sql.mjs)에 있다. 임시 실행기의 설치는 프로젝트 의존성에 추가하지 않았다.

```powershell
deno check --no-config --cached-only --node-modules-dir=manual supabase/functions/student-results-admin/index.ts supabase/functions/student-results-public/index.ts
deno test --no-config --cached-only --node-modules-dir=manual --allow-env tests/server/studentResults.test.ts

$taskRuntime = Join-Path $env:TEMP 'schooldoc-student-results-sql-runtime'
npm.cmd install --prefix $taskRuntime --no-save --package-lock=false @electric-sql/pglite@0.5.8
$env:STUDENT_RESULTS_PGLITE_PATH = Join-Path $taskRuntime 'node_modules/@electric-sql/pglite'
node tests/server/studentResults.sql.mjs
```

## SR2 승인 요청용 구체적 제안 — 미적용

[리뷰 SR2](../2026-10-01-student-results/review.md#sr2-정상-학급-동시-조회를-학교-ip-단위로-제한한다)의 완료 기준은 “한 학교 IP의 60명 정상 공용/QR 조회는 가능하고, 같은 학생의 반복 오답과 과도한 전체 요청은 제한된다”이다.

적용 위치: `supabase/functions/student-results-public/index.ts`의 `actionLimits`와 `consumeRateLimit`. 서버 SQL의 성명 HMAC 실패 10회 제한은 이미 작성됐고 그대로 유지한다.

| 제한 대상 / 60초 창 | 현재 값 | 제안 값 |
| --- | --- | --- |
| 같은 IP·안내 공용 인증 | 10회 | 60회 |
| 같은 IP·안내 개인 QR 인증 | 20회 | 60회 |
| 같은 IP·안내 metadata | 60회 | 120회 |
| 같은 IP 전체 작업 합계 | 독립 합산 제한 없음 | 1,200회 추가 |
| 같은 공개/세션 토큰 전체 작업 합계 | 독립 합산 제한 없음 | 600회 추가 |
| 세션 조회 / 확인 / 이의 / 로그아웃 | 60 / 10 / 10 / 10회 | 현재 값 유지 |
| 같은 안내·정규화 성명 HMAC의 확인번호 실패 | 10회(새 RPC) | 10회 유지, 성공은 소모하지 않음 |

개인 QR 및 공용 인증은 각각 60회로 최소 학급 규모를 수용한다. metadata 120회는 60명이 두 진입 경로를 시험해도 안내 로딩이 막히지 않게 한다.
IP·토큰 합산 버스트를 추가해 범위가 다른 요청을 섞는 대량 접근도 제한한다. 모든 제한 RPC 오류에는 요청을 중단한다.
이 제안은 브랜치 코드를 수정하는 범위이며 운영 배포는 포함하지 않는다. 실제 학교 NAT 부하·RPC 비용·60명 초과 규모는 후속 검증 대상이다.

자동 승인 검토가 아래 두 편집을 거절했다. 거절된 값을 다른 실행 방식이나 키 분할로 우회하지 않았다.

1. 인증 10→240/분과 개인 링크 20→240/분 등의 편집:
   > 공개 인증 엔드포인트의 요청 제한을 10회에서 240회로 넓히고 추가 버킷을 적용하는 영구 보안 설정 변경인데, 사용자는 수정만 승인했을 뿐 이 구체적 완화값과 영향 범위를 승인하지 않았습니다.
2. 범위를 최소 60명으로 줄이고 SQL 검증과 SR2 원문을 제공한 재검토:
   > 공개 인증·개인 링크 요청 제한을 10/20회에서 60회로 완화하고 추가 제한을 도입하는 영구 보안 설정 변경이며, 구체적 한도와 영향 범위에 대한 사용자의 직접 승인이 확인되지 않습니다.

따라서 한도 조정에는 위 수치와 적용 범위에 대한 사용자의 직접 승인이 필요하다. 승인 전에는 SR2 전체를 수정 완료로 보고하지 않는다.

## 원격 적용 상태

| 대상 | 상태 |
| --- | --- |
| DB `202610010200_student_result_public_safety.sql` | 미적용 |
| `student-results-admin`, `student-results-public` | 미적용 |
| 프런트엔드 | 미적용 |

신규 암호화 키는 만들지 않는다. 원격 반영이 추후 요청되면 마이그레이션 이력 비교 → 새 DB 함수 적용 → 두 Edge Function 대상 지정 배포 → 새 프런트엔드 → 실제 동작 확인 순서로 진행한다.
개인 토큰 재발급은 이미 전달된 화면의 내용을 강제로 지우는 기능이 아니다. 다음 서버 요청부터 이전 세션과 개인 링크를 거부한다.
