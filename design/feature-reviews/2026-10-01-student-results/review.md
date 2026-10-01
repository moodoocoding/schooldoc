# 학생 결과 안내 워크플로우·휴리스틱·오류 리뷰 (codex)

- 검토일: 2026-10-01.
- 기준: 최신 로컬 main `c208afe`에서 분기한 `codex/feature-review-student-results`.
- 범위: 교사 작성/가져오기/현황/접속 정보/정정/종료·삭제, 학생 공용·개인 조회/확인/이의/답변·재확인/조회 종료, QR 배부·PDF.
- 판정: **핵심 정상 흐름은 연결되지만 수정 필요. 새 발견 SR1–SR11 중 개인정보·학급 동시 조회 문제를 먼저 해결해야 한다.**
- 제품 코드·기존 테스트·마이그레이션은 수정하지 않았다. 아래 항목은 미수정 리뷰 결과다. 기존 [구현 기록](implementation.md)의 R1–R12와 혼동하지 않도록 이번 발견에는 SR 번호를 쓴다.
- 실제 설치된 **Google Chrome 154 헤드리스**를 자동 조작했다. 로컬 데모와 가상 학생만 사용했다. 운영 Supabase, 실제 로그인 계정·학생 자료·학교 네트워크·프린터를 시험한 결과가 아니다.
- 세 디자인 프로파일와 여섯 관점은 AI 모의 검토다. 실제 전문가 6명·교사·학생의 인터뷰, 승인 또는 사용성 시험을 받지 않았다.

## 1. 워크플로우

| 단계 | 현재 경로와 작업 | 잘 연결된 부분 | 남은 문제 |
| --- | --- | --- | --- |
| 진입 | 교사 로그인 → 학생 결과 안내 목록 → 새 결과 안내 | 운영 인증 게이트와 데모 구분, 빈 목록에서 주 행동 제공 | 운영 로그인·JWT 게이트웨이는 미검증 |
| 준비 | 제목·학생 안내, 점수 항목/배점/설명/총점 종류, 명단·확인번호·점수·피드백 | 필드 오류 이동, 행 추가/삭제 되돌리기, 숫자 빈 값과 0점 구분 | 브라우저 뒤로 가기는 초안 보호를 우회함(SR7) |
| 가져오기 | XLSX/CSV/텍스트 PDF → 분석 미리보기 → 경고·미응시 가능 학생 확인 → 적용 | 배점 추정·총점 불일치 경고, 0점 학생을 교사 선택 없이 제외하지 않음, 텍스트 없는 PDF 교체 안내 | 파일 교체는 기존 입력을 덮으므로 미리보기와 되돌리기를 함께 안내해야 함 |
| 저장 | 검증 → 안내 만들기 → 학생 현황 | 소유자는 서버 인증에서 결정, 개인정보/결과는 암호화 저장 경로 | 관리자 함수 타입 검사 실패(SR10) |
| 배부 | 접속 정보 → 공용 링크+성명·확인번호 또는 학생 개인 링크/QR PDF | 확인번호 기본 마스킹, 본인에게만 전달 안내, 검색 후 선택 출력 | PNG 저장 없음(SR8), 긴 이름 출력 겹침(SR9), 재발급이 세션을 취소하지 않음(SR4) |
| 학생 조회 | 공용 로그인 또는 개인 QR 자동 인증 → 본인 결과·안내·피드백 | 공개 응답에서 확인번호·개인 토큰·정정 이력 제외, 세션의 학생 ID를 서버가 결정 | 학교 공용 IP에서 정상 학급 조회 제한(SR2) |
| 확인/이의 | 결과 읽기 → 확인 완료 또는 이의 제출 | 작성 중 이의가 있을 때 확인 전 경고, 미답변 이의 상태에서는 확인을 막음 | 이의 내용과 상태의 부분 저장 가능(SR5) |
| 답변/정정 | 교사 답변·점수/피드백 정정 → 학생 최신 결과 확인 → 재확인 | 점수 정정 사유·이력, 이미 확인한 학생은 점수 정정 후 재확인, 답변·본인 이의 표시 | 배점/항목 설정 변경은 이전 확인 기록을 유지하고 오래된 화면의 확인도 허용(SR3) |
| 조회 종료/만료 | 조회 종료 → 로그인 화면; 만료 요청은 서버 401 | 정상 종료 시 이름·번호·결과 초기화, 서버 만료 검사 | 늦은 응답이 결과를 다시 표시(SR1), 만료 오류에서 로그인 복구 미제공(SR6) |
| 안내 종료/삭제 | 안내 종료·다시 열기; 목록에서 대상·인원·이의 수 확인 후 삭제 | 닫힌 안내의 새 조회/행동 차단, 삭제 영향 수량 안내 | 운영 삭제·RLS·실제 연결된 자료는 미검증 |

상태는 미조회 → 조회함 → 확인 완료, 또는 이의 접수 → 교사 답변 → 재확인 필요 → 확인 완료로 이어진다. 확인 받기가 꺼진 안내의 답변은 답변 완료로 구분한다. 상태 카드와 검색은 교사의 다음 처리 대상을 찾는 데 도움이 된다.

현재 소스에는 학생 수·결과 항목 수의 명시적인 최대치가 없다. 0명 목록, 1명 정상 흐름, 24명 대표 학급, 60명 밀도, 17명 다중 페이지 출력, 허용 길이 100자의 이름·식별값을 검토했다. **60명을 제품의 최대 인원으로 간주하지 않았다.** 60명 초과·다수 과목·누적 대량 안내의 성능과 DB 페이지 제한은 추가 확인 대상이다.

## 2. 수정 요구

P1은 우선 수정, P2는 정상 업무·복구·출력·검사 개선, P3은 낮은 우선순위의 시각 개선이다.

| ID | 우선순위 | 발견 | 증거 |
| --- | --- | --- | --- |
| SR1 | P1 | 조회 종료 후 늦은 새로고침 응답이 이전 학생 결과를 다시 표시 | 실제 Chrome 지연 응답 주입 |
| SR2 | P1 | 한 학교 IP의 24명 조회가 공용 링크 14명·개인 QR 4명 제한 | 실제 핸들러+모의 RPC |
| SR3 | P2 | 배점 변경 후 확인 완료 유지·이전 배점 화면의 확인 허용 | Chrome 데모+핸들러 probe+SQL 읽기 |
| SR4 | P1 | 개인 링크 재발급 뒤 이미 발급한 세션은 계속 조회 가능 | 실제 관리자/공개 핸들러+모의 DB |
| SR5 | P2 | 이의/답변 내용과 학생 상태를 나눠 저장해 실패 시 불일치 | 두 번째 DB 쓰기 실패 주입 |
| SR6 | P2 | 인증 만료 오류에서 결과·세션을 지우지 않고 다시 조회할 폼도 열지 않음 | 서버 401 검사+Chrome 오류 주입 |
| SR7 | P2 | 브라우저 뒤로 가기에 작성 초안 유실 | 실제 Chrome SPA 뒤로 가기 |
| SR8 | P2 | QR을 표시하지만 이미지 저장을 제공하지 않음 | Chrome 버튼 수·현재 E2E·소스 |
| SR9 | P2 | 긴 성명·식별값의 QR이 다음 카드와 겹치고 마지막 행이 잘림 | 실제 PDF 전체 렌더+DOM 측정 |
| SR10 | P2 | 관리자 Edge Function의 Deno 타입 검사 실패 | 독립 Deno check 종료 코드 1 |
| SR11 | P3 | 관리 화면의 작은 보조 문구 대비가 AA 기준 미달 | axe 4.47:1 측정 |

### SR1. 조회 종료가 늦은 결과 응답을 무효화하지 않는다

1. 가상 학생의 92/100 결과를 조회한다.
2. ‘최신 결과 확인’을 누르고 결과 응답의 반환만 1.5초 지연한다.
3. 기다리는 동안 ‘조회 종료’를 눌러 로그인 폼과 빈 이름을 확인한다.
4. 응답 도착 후 이전 이름·점수·교사 의견이 다시 나타난다.

[종료 직후](evidence/12-exit-before-late-response.png) → [이전 결과 재표시](evidence/13-private-result-restored-after-exit.png). `results.json`의 `lateResponseAfterLogout.resultRestored=true`.

[PublicStudentResultPage.tsx:102](../../../src/features/studentResults/PublicStudentResultPage.tsx#L102)의 refresh는 await 후 현재 조회 세션인지 확인하지 않고 setResult 한다. [128행](../../../src/features/studentResults/PublicStudentResultPage.tsx#L128)의 종료는 상태를 지우지만 진행 중 요청을 무효화하지 않는다. 확인·이의 요청에도 같은 응답 검증이 없다. **이번에 실제로 재현한 것은 새로고침 응답**이다. 세션 토큰 자체가 복구되었다고 확인한 것은 아니다.

수정 요구: 조회 세대/현재 세션 검증을 인증·갱신·확인·이의 전체에 적용하고 종료·토큰 전환·unmount 시 무효화한다. 완료 기준은 늦은 성공/실패 응답에도 결과·이름·안내·오류가 이전 학생 상태로 돌아가지 않는 것이다. 새로운 학생이 곧바로 조회한 경우도 검증한다.

### SR2. 정상 학급 동시 조회를 학교 IP 단위로 제한한다

공개 함수는 `ip:scope:action`을 요청 키로 쓰며 authenticate는 60초당 10회, personal은 20회다. 두 로그인 모두 scope가 학급 공용 토큰이므로 학생 이름·서로 다른 개인 QR을 바꿔도 같은 IP의 버킷을 공유한다.

24명의 서로 다른 가상 학생을 같은 IP·같은 안내에서 인증한 probe 결과: 공용 10×200/14×429, 개인 QR 20×200/4×429. [서버 결과](evidence/server-results.json)의 commonSchoolIp/personalSchoolIp. 네트워크 요청은 모두 모의 처리했으며 실제 학교 NAT에서 측정한 결과가 아니다. SQL 요청 수 증가 규칙을 같은 한 분 창으로 모의한 것이다.

근거: [공개 함수 32행](../../../supabase/functions/student-results-public/index.ts#L32), [74행](../../../supabase/functions/student-results-public/index.ts#L74), [요청 제한 SQL](../../../supabase/migrations/202608130002_student_results.sql#L138).

수정 요구: 정상 한 학급의 공용 IP 사용을 수용하고 무차별 확인번호 시도 제한을 학생/자격증명 단위와 별도로 설계한다. IP 제한을 단순히 없애지 않는다. 완료 기준: 한 학교 IP의 60명 정상 공용/QR 조회는 가능하고, 같은 학생의 반복 오답과 과도한 전체 요청은 제한된다.

### SR3. 배점 변경이 확인의 의미를 바꿔도 확인 기록·버전은 유지된다

- 학생 A가 92/100을 화면에 둔다. 학생 B는 변경 전에 확인을 마친다.
- 교사가 동일 항목 배점을 200으로 변경한다.
- A의 recipient.updatedAt은 같고 B의 status도 confirmed다.
- A가 이전 화면에서 ‘내용 확인 완료’를 누르면 92/200이 **확인 완료**로 반환된다.

[이전 배점 화면](evidence/14-student-old-max-score.png), [새 배점 확인 완료](evidence/15-new-max-marked-confirmed-from-old-view.png). Chrome parentSettingsVersion과 서버 parentVersion probe에서 재현했다.

[로컬 설정 갱신 193행](../../../src/features/studentResults/studentResultsStore.ts#L193) 및 [설정 RPC 145행](../../../supabase/migrations/202610010100_student_result_corrections.sql#L145)은 항목/배점을 바꾸면서 confirmed를 재확인으로 전환하지 않는다. 공개 [confirm 317행](../../../supabase/functions/student-results-public/index.ts#L317)은 recipient.updated_at만 확인한다. 설정 RPC의 원격 실행 자체는 미검증이다.

수정 요구: 학생이 실제로 본 **결과 내용의 버전**을 검증하고 배점·항목 의미·결과 안내의 변경에 영향을 받는 확인 완료 상태를 재확인으로 바꾼다. 다른 학생의 단순 조회로 모든 확인이 충돌하지 않도록 활동 시각과 내용 버전을 구분한다. 완료 기준: 이전 화면 확인은 거부되고 최신 내용 읽기 후에만 확인되며, 기존 확인 기록의 변경 의미가 이력에 남는다.

### SR4. 재발급은 이전 링크의 이미 발급된 세션을 취소하지 않는다

접속 정보와 확인 창은 이전 개인 링크·QR을 즉시 사용할 수 없다고 안내한다. 실제 핸들러의 regenerate는 personal_token만 갱신한다.

개인 QR 인증 → 세션 발급 → 교사가 재발급 → 이전 QR의 새 인증 401 → **기존 세션의 session 요청 200**을 재현했다. [서버 regenerateSession](evidence/server-results.json). 저장소의 세션 기본 만료는 [12시간](../../../supabase/migrations/202608130002_student_results.sql#L60)이고 함수는 만료 시각만 검사한다. 운영 DB가 동일한 기본값을 적용했는지는 확인하지 않았다.

근거: [관리자 함수 262행](../../../supabase/functions/student-results-admin/index.ts#L262), [공개 세션 검사 207행](../../../supabase/functions/student-results-public/index.ts#L207), [교사 안내 282행](../../../src/features/studentResults/StudentResultsManagePage.tsx#L282).

수정 요구: 유출 대응을 위해 재발급할 때 해당 학생의 기존 세션을 원자적으로 폐기하거나 세션 발급 당시 토큰 세대와 현재 세대를 검증한다. 완료 기준: 이전 세션의 조회·확인·이의는 거부하고 새 QR 인증은 정상 동작하며, 다른 학생 세션에는 영향이 없다.

### SR5. 이의·답변 저장의 부분 실패로 내용과 상태가 달라진다

실제 서버 핸들러에 두 번째 recipient PATCH 실패를 주입했다.

- 학생 이의: message_ciphertext 저장 성공 → 상태 저장 실패 → 응답 500, DB 모의 저장 상태는 메시지 존재+viewed.
- 교사 답변: reply_ciphertext 저장 성공 → 상태 저장 실패 → 응답 500, 답변 존재+disputed.

[partialDispute/partialReply](evidence/server-results.json). [공개 함수 346행](../../../supabase/functions/student-results-public/index.ts#L346), [관리자 함수 250행](../../../supabase/functions/student-results-admin/index.ts#L250). 각각 별개의 DB 쓰기이며 SQL 롤백으로 묶여 있지 않다. 정상 점수/설정 정정에는 이미 별도 원자적 RPC가 있으므로 그 구조를 재사용할 수 있다.

수정 요구: 내용·상태·확인 시각을 같은 소유자/세션 검사와 트랜잭션으로 저장하고 동시 이의·답변 및 재시도를 보호한다. 완료 기준: 어느 단계에서 실패해도 이전 내용·상태가 함께 유지되고, 성공할 때만 교사 집계·학생 대기/재확인 상태가 함께 바뀐다. 기존 암호화와 기존 제출 의미를 유지한다.

### SR6. 만료 오류에서 재인증 흐름으로 돌아가지 않는다

서버의 실제 세션 만료 401을 probe로 확인한 뒤 같은 오류 문구를 Chrome API 경계에 주입했다. ‘최신 결과 확인’ 뒤 ‘학생 인증이 만료되었습니다. 다시 확인해 주세요.’가 나타나지만 점수·이름·결과 화면은 남고 로그인 폼은 없다. 수동 ‘조회 종료’로는 복구된다. [캡처](evidence/23-expired-session-keeps-private-result.png).

[refresh 118행](../../../src/features/studentResults/PublicStudentResultPage.tsx#L118)은 오류에 ‘종료’가 있을 때만 결과를 지운다. invoke가 HTTP 오류의 상태/코드를 화면에 보존하지 않아 만료를 구조적으로 처리하기 어렵다. 실제 운영에서 세션이 만료될 때까지 기다린 시험은 아니다.

수정 요구: 인증 만료 오류를 구분해 개인 결과·세션·이전 오류를 정리하고 안전한 재조회 폼/명확한 버튼을 제공한다. 완료 기준: 공용/개인 QR·확인·이의·갱신 어느 요청에서 만료되어도 이전 세션으로 반복 시도하지 않으며 SR1 응답 무효화가 함께 적용된다.

### SR7. 작성 중 브라우저 뒤로 가기에 초안이 사라진다

목록 → 새 결과 안내 → 제목 입력 → 브라우저 뒤로 가기 → 새 결과 안내 재진입 시 제목이 빈 값이다. 확인 대화상자는 0개였다. [입력 전후 증거](evidence/16-create-draft-before-back.png), [재진입](evidence/17-create-draft-lost-after-back.png).

[작성 화면 288행](../../../src/features/studentResults/StudentResultsCreatePage.tsx#L288)의 beforeunload는 문서를 벗어날 때만 작동하고 자체 목록 버튼만 leave를 호출한다. SPA history 이동은 이를 거치지 않는다.

수정 요구: 브라우저 뒤로/앞으로·앱 내부 이동을 동일한 초안 보호로 처리하거나 복원 가능한 임시 초안을 둔다. 완료 기준: 취소하면 파일 분석·학생·점수·확인 옵션이 유지되고 나가기 선택 후에만 지워진다.

### SR8. QR 이미지 저장 기능이 없다

17명 출력 화면은 17개의 QR과 PDF 다운로드만 제공했고 이미지 저장 버튼은 0개다. [출력 화면](evidence/18-qr-preview-17.png). 현재 E2E의 [88행](../../../tests/e2e/student-results.spec.ts#L88)은 이미지 저장 버튼이 0개일 것을 기대하므로 테스트 통과가 요구 충족을 뜻하지 않는다.

[QrPrintPage](../../../src/features/studentResults/StudentResultsQrPrintPage.tsx)는 SVG QR과 PDF 저장만 구현했다. AGENTS.md의 ‘QR 코드를 표시하면 이미지 저장 기능을 함께 제공한다’에 맞지 않는다.

수정 요구: 학생 식별이 가능한 개인 QR PNG 저장을 제공하고 필요하면 선택 학생 일괄 저장을 추가한다. 완료 기준: 실제 내려받은 PNG의 크기·파일명·본인 URL을 확인하고 PDF/화면 캡처로 대체하지 않는다. 기존 테스트의 ‘없음’ 기대를 실제 다운로드 검증으로 바꾼다.

### SR9. 허용 길이의 긴 이름·식별값이 카드/QR을 겹치게 한다

서버가 허용하는 100자 이름+100자 서로 다른 식별값, 학생 8명을 생성했다. 고정 카드 높이 220.125px, 이름 높이 123.203125px, QR 높이 116px로 8개 모두 QR 하단이 카드 밖으로 나왔다. 실제 내려받은 [PDF](evidence/qr-long.pdf)를 [전체 렌더](evidence/qr-long-page-1.png)로 확인했다. 위 행 QR이 다음 학생 이름 위에 겹치고 마지막 행은 페이지 밖으로 잘린다.

[고정 4행 카드 137행](../../../src/features/studentResults/StudentResultsQrPrintPage.tsx#L137), [긴 이름 146행](../../../src/features/studentResults/StudentResultsQrPrintPage.tsx#L146). 정상 17명은 [1쪽](evidence/qr-17-page-1.png)/[2쪽](evidence/qr-17-page-2.png)/[3쪽](evidence/qr-17-page-3.png) 모두 제목·QR·카드가 정상이다.

수정 요구: 이름/식별 영역과 QR의 최소 공간을 분리하고 긴 경우 줄 수·글꼴·페이지당 학생 수를 조절한다. 허용 입력을 출력 단계에서 조용히 자르지 않는다. 완료 기준: 정상·긴 데이터의 미리보기와 실제 PDF 모든 페이지에서 이름을 식별하고 QR 겹침·하단 잘림이 없다.

### SR10. 관리자 서버 함수의 타입 검사가 실패한다

독립 실행한 Deno check가 TS2345/종료 코드 1로 실패했다.

> Argument of type '{}' is not assignable to parameter of type 'string'.

[진단 기록](evidence/admin-typecheck.txt), [관리자 70행](../../../supabase/functions/student-results-admin/index.ts#L70). `loadEvents(rows: Array<Record<string, unknown>>)`의 row.revision_ciphertext는 unknown인데 truthy 검사만 거쳐 복호화 함수의 string 인자로 전달한다.

수정 요구: 저장 행 타입 또는 런타임 문자열 검증으로 암호문 타입을 확정한다. 완료 기준: 공개·관리자 양쪽 Deno check 통과, 정상·없는·잘못된 이력 값의 안전한 처리 검증. 프런트엔드 typecheck/build 통과가 서버 타입 통과를 보장하지 않는다. 이번 모의 서버 실행은 이 문제와 구분하기 위해 `--no-check`를 명시했다.

### SR11. 작은 보조 문구의 대비가 부족하다

교사 60명 모바일 axe 검사에서 ‘보호된 학생 데이터’ 문구의 #64748B / #F6F8FB 대비가 4.47:1로 측정돼 작은 글자 기준 4.5:1에 미달했다. [JSON 근거](evidence/results.json)의 density60AndAxe.teacherAxe, [관리자 219행](../../../src/features/studentResults/StudentResultsManagePage.tsx#L219). 학생 정상 모바일 화면의 동일 기준 자동 검사 위반은 0개였다.

수정 요구: 배경별 보조 글자 토큰을 조금 더 진하게 조정하고 실제 상태 배경에 다시 검사한다. 완료 기준: 해당 노드 자동 대비 통과와 전체 화면의 정보 위계 유지. 자동 검사 0개가 모든 보조기술·사용성을 보장하는 것은 아니다.

## 3. 작업에 따른 10개 휴리스틱 평가

| 기준 | 판정 | 근거와 조치 |
| --- | --- | --- |
| 상태의 가시성 | 수정 필요 | 조회/이의/재확인/답변 완료를 숫자·문구로 구분한다. 부분 저장과 배점 변경이 상태의 신뢰성을 훼손(SR3/5) |
| 실제 업무와의 일치 | 수정 필요 | 준비→배부→개별 조회→응대 흐름과 총점 종류는 적절하다. 학급 동시 조회 제한과 배점 변경 확인 기록이 업무에 맞지 않음(SR2/3) |
| 사용자 통제와 자유 | 수정 필요 | 이의 초안 경고·입력 되돌리기·명시적 종료가 있다. 종료 뒤 응답과 SPA 이동 보호가 부족(SR1/7) |
| 일관성과 표준 | 수정 필요 | 관리 탭/상태 용어가 일관되고 키보드 탭 이동이 된다. QR 저장 요구와 현재 테스트의 기대가 충돌(SR8) |
| 오류 예방 | 수정 필요 | 점수 범위·필수 값·미응시 후보 확인은 좋다. 설정 변경 버전·부분 쓰기·세션 재발급 검증 필요(SR3/4/5) |
| 기억보다 인지 | 대체로 적합 | 학생 안내·본인 이의·교사 답변을 함께 볼 수 있고 교사 현황/접속 정보를 분리한다. 모바일 가로 표의 오른쪽 행동은 스크롤이 필요 |
| 효율과 유연성 | 수정 필요 | 파일 가져오기·검색·선택 QR 출력·Ctrl+Z는 효율적이다. 정상 학급 규모가 로그인 제한에 걸림(SR2) |
| 간결한 정보 구조 | 대체로 적합 | 제목/안내→결과→피드백→행동 순서가 명확하고 현황에 확인번호를 노출하지 않는다. 60명 긴 표·좁은 화면 행동 위치는 개선 여지 |
| 오류 인지와 복구 | 수정 필요 | PDF 대체 안내·점수 오류 필드 이동은 적절하다. 만료 재인증·부분 저장 복구가 부족(SR5/6) |
| 도움말과 안내 | 수정 필요 | 개인 링크 본인 전달, 출력 페이지 수, 삭제 영향 수량을 설명한다. 재발급 안내가 기존 세션 지속을 설명하지 못함(SR4) |

## 4. 세 프로파일와 여섯 독립 모의 관점

[웹디자인](../../../pro/web-designer.md), [UX](../../../pro/ux-designer.md), [UI](../../../pro/ui-designer.md) 프로파일를 적용했다. UX 프로파일의 역할 배정 예시는 이 기능의 결과 준비·배부·응대로 해석했다. pro/ux-ui-expert.md와 외부 공유 개발일지는 이 checkout에 없다.

화면 구현을 새로 하지 않은 리뷰이므로 아래의 ‘수정 요구’는 후속 개발의 입력이다. 이번에 1차·2차 제품 개발을 수행했다는 뜻이 아니다.

| 독립 모의 관점 | 판정·근거 | 수정 요구·남은 위험 |
| --- | --- | --- |
| 웹디자인·정보 위계 | 대체로 적합: 전체 PC 화면에서 제목·상태 카드·현황, 학생 화면에서 안내→점수→피드백→행동이 읽힘 | SR11 대비 개선. 데이터 오류가 있으면 명확한 위계만으로 상태 신뢰를 보장하지 못함 |
| 웹디자인·화면 밀도 | 수정 필요: 24명 표의 열 균형은 유지, 60명은 길지만 문서 스크롤. 모바일은 요약 2열과 가로 표로 배치 | SR9 출력 밀도 조절. 모바일 표의 답변/정정은 오른쪽으로 이동해야 함. 다수 과목·60명 초과 미검증 |
| UX·학생 사용 흐름 | 수정 필요: 안내·이의 초안 보호·답변·점수 정정 재확인은 정상 | SR1/3/6 우선 복구. 실제 학생 인터뷰·장시간 대기 시험 미실시 |
| UX·교실 배부/전자칠판 흐름 | 수정 필요: 본인용 QR 배부 17명 8/8/1은 정상 | SR2/4/8. 성적 전체를 전자칠판에 공개하는 경로는 제공/시험하지 않음. 교실은 개별 배부를 중심으로 평가. 실제 동시 교실·QR 카메라·프린터 미검증 |
| UI·접근성 | 수정 필요: 탭 방향키와 접근 가능한 필드 이름, 학생 axe 0개, 이의 경고 대화상자가 확인됨 | SR11. 실제 화면낭독기·키보드만으로 모든 과제 수행은 미검증 |
| UI·반응형/상태 표현 | 수정 필요: 390px 학생/교사 문서 너비는 뷰포트와 동일, 6가지 상태를 색+문구로 구분, CSS 200% 전체 캡처 확보 | SR3/5/9. CSS zoom은 실제 브라우저 200%나 물리 기기 시험을 대체하지 않음 |

전체 화면 증거: [PC 24명](evidence/03-teacher-desktop-24.png), [모바일 24명](evidence/06-teacher-mobile-24.png), [접속 정보](evidence/04-teacher-access-desktop-24.png), [학생 모바일](evidence/07-student-mobile-viewed.png), [60명 PC](evidence/20-teacher-desktop-60.png), [60명 모바일](evidence/21-teacher-mobile-60.png), [CSS 200%](evidence/22-teacher-css-200-percent.png), [종료 상태](evidence/25-public-closed.png), [없는 안내](evidence/26-public-missing.png). 작은 영역만의 캡처나 자동 검사로 시각 검토를 대체하지 않았다.

## 5. 검증과 재현 방법

| 검사 | 결과 | 의미·한계 |
| --- | --- | --- |
| npm run typecheck | 통과 | 프런트엔드 타입 |
| npm run lint | 오류 0·기존 경고 7개 | 미션 리뷰 도구 1개, 다른 기능/공통 화면 6개. 새 자료 작성 후 재검사 결과도 동일 |
| npm test -- tests/unit/studentResults.test.ts tests/unit/studentResultsHistory.test.ts tests/unit/studentResultsLoadState.test.ts | 3파일 30개 통과 | 관련 로직 |
| PLAYWRIGHT_TEST_PORT=4177 npm run test:e2e -- tests/e2e/student-results.spec.ts --workers=1 --max-failures=3 | 최종 12개 통과 | 실제 Chrome, 로컬 데모 |
| PLAYWRIGHT_TEST_PORT=4177 npm run test:e2e -- tests/e2e/app-shell-scroll.spec.ts --grep '학생 결과' --workers=1 | 1개 통과 | 목록의 앱 문서 스크롤 |
| 공개 함수 Deno check --no-config --cached-only --node-modules-dir=manual | 통과 | Edge Function 타입 |
| 관리자 함수 같은 Deno check | **실패: TS2345 1개** | SR10, 프런트엔드 성공과 구분 |
| 추가 server-probes.test.ts | 9개 관찰 검사 통과 | 실제 핸들러, 모든 DB/Auth/RPC 모의, 네트워크 없음, --no-check |
| 추가 verify.mjs | 12개 시나리오 완료·pageerror 0 | 정상 흐름과 결함 재현을 함께 기록, 결함을 고쳤다는 뜻 아님 |
| axe WCAG A/AA/2.1 AA | 학생 위반 0, 교사 대비 1노드 | 자동 검사 범위 |
| QR PDF | 정상 17명 A4 3쪽 확인, 긴 8명 겹침 확인 | 실제 앱 다운로드→Poppler 전 쪽 렌더. 물리 출력/QR 스캔 미실행 |
| npm run build | 통과 | PDF worker 자산 생성 확인, 기존 큰 번들/플러그인 시간 경고 |
| 전체 단위·전체 E2E·운영 Supabase 통합·SQL/RLS 런타임 | 미실행 | 제품 변경 없는 기능 리뷰로 범위를 제한. 원격 시험 환경/자료를 사용하지 않았음 |

최초 E2E는 10통과/2실패였다. 원인은 worktree의 node_modules junction이 가리키는 외부 경로를 Vite가 허용하지 않아 PDF worker에 403을 반환한 **검증 환경 문제**였다. [초기 진단](evidence/environment-initial.json)과 [초기 화면](evidence/01-pdf-import-error.png)을 보존했다. 검증 전용 serve.mjs에서 실경로를 허용한 뒤 PDF 2개를 포함한 12개가 모두 통과했으므로 PDF 제품 결함으로 집계하지 않았다. 제품 Vite 설정을 수정하지 않았다.

로컬 재현 예시(설치된 npm 의존성·Chrome·Deno 필요):

~~~powershell
node design/feature-reviews/2026-10-01-student-results/serve.mjs
# 별도 터미널
node design/feature-reviews/2026-10-01-student-results/verify.mjs
$env:PLAYWRIGHT_TEST_PORT='4177'
npm.cmd run test:e2e -- tests/e2e/student-results.spec.ts --workers=1
deno test --no-config --no-check --cached-only --node-modules-dir=manual --allow-env --allow-read --allow-write=design/feature-reviews/2026-10-01-student-results/evidence design/feature-reviews/2026-10-01-student-results/server-probes.test.ts
deno check --no-config --cached-only --node-modules-dir=manual supabase/functions/student-results-admin/index.ts
~~~

verify.mjs는 127.0.0.1 데모 origin만 허용하고 가상 이벤트만 만든다. 지연·만료 응답은 페이지별 Vite 모듈 응답에 주입하며 제품 파일을 바꾸지 않는다. probes는 .invalid 주소의 fetch를 전부 모의하고 실제 네트워크 권한을 부여하지 않는다. 관찰 검사 일부는 **현재 결함이 재현됨을 기대**하므로 후속 수정 시 정상 회귀 테스트로 재작성해야 한다.

## 6. 인계·원격 적용

우선 순서: SR1/2/4 개인정보·학급 조회 → SR3/5/6 결과 확인·실패 복구 → SR7/8/9 초안·배부 → SR10 서버 타입, SR11 대비. 서로 연관된 SR1/6과 SR3/5는 같은 흐름으로 검증한다.

후속 수정자는 독립 브랜치/워크트리에서 기존 암호화·교사 소유자·학생 세션 검사를 유지하고, DB 수정은 새 마이그레이션으로 추가한다. 세 프로파일와 여섯 모의 관점의 구현 전후 판단, 실제 Chrome 전체 화면, 정상·실패·경계 PDF 재검증을 기록한다. 원격 배포가 따로 요청되면 secrets/마이그레이션/해당 공개·관리자 함수/프런트엔드의 호환성을 각각 확인한다.

이번 리뷰의 DB·Edge Functions·프런트엔드 운영 배포는 **해당 없음**이다. 운영의 실제 RLS·암호화 키·기기 간 Realtime·JWT 설정은 미검증이며, 저장소 설정만으로 현재 운영 배포의 성공/실패를 단정하지 않았다. GitHub 게시와 main 병합·운영 적용은 다른 작업이다.

개발일지는 현재 저장소의 [docs/development-history.md](../../../docs/development-history.md)에 별도 문서 변경으로 기록한다. 요청한 다음 검토 대상은 **가정통신문 수합**이다.
