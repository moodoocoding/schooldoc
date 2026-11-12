# Neis Helper·학교 문서 통합 검증 (codex)

## 통합 범위

- 사용자 요청으로 Neis Helper와 기존 운영의 학교 문서 작성 기능을 함께 보존한다.
- 학교 문서 전용 소스·서식·글꼴·라이선스·시험 자료 119개를 기존 운영 통합본과 SHA-256으로 대조해 일치를 확인했다. 원본 작업 폴더는 수정하지 않았다.
- 두 기능의 메뉴·라우트·관리자 표시·공통 회귀 검사를 병합했다. 학교 문서의 HWP/HWPX 가져오기, rhwp worker, 7개 운영계획 참고 유형, HWPX 저장 및 `school-plan` 서버 코드를 포함한다.
- 권한은 기존 관리자 미리보기 범위를 유지한다. 분실물 미구현 카드 제외도 기존 운영 동작을 보존한다.
- 개발·운영 설명은 `DEVELOPMENT.md`에 보존했다. 별도 QR 생성기 작업은 포함하지 않는다.

## 로컬 검사

| 명령 | 결과·한계 |
| --- | --- |
| `npm ci` | 통과. 잠금 파일 설치. 기존 의존성 감사 경고 16건은 이 통합 작업에서 일괄 변경하지 않음. |
| `npm run typecheck` | 통과 |
| `npm run lint` | 통과, 기존 경고 4건 |
| `npm test` | 79개 파일, 642개 검사 통과 |
| `npm run test:desktop` | 15개 통과. 제한 환경에서 로컬 콜백 연결이 진행되지 않아 종료 후 로컬 포트 접근이 가능한 환경에서 재실행. 가상 인증·릴리즈 API 검사임. |
| `npm run build` | 통과. 큰 번들과 Excel 모듈의 정적/동적 import 혼용 경고 유지. |
| `npm exec --yes --package=deno@2.9.6 -- deno check --no-config --no-lock supabase/functions/neis-helper/index.ts supabase/functions/school-plan/index.ts` | 두 서버 진입점 통과 |
| `npm run test:e2e -- tests/e2e/neis-subject.spec.ts tests/e2e/school-plan.spec.ts tests/e2e/admin-tool-visibility.spec.ts tests/e2e/app-shell-scroll.spec.ts` | 69개 통과. 독립 데모 서버, 가상 인증·AI·RPC 응답. 실제 PDF/XLSX/HWP/HWPX 처리·다운로드와 오류 복구·접근 권한을 검사. 운영 인증 검증과 구분. |

## 배포·병합 구분

DB 변경은 없다. `neis-helper` v2와 `school-plan` v2, 두 기능을 포함한 웹은 앞선 운영 배포 상태이며 이 문서 작성 시점의 새 main 배포를 뜻하지 않는다. 앞선 Neis 실사용 검증은 [운영 검증 기록](production-verification.md), 학교 문서 실사용 검증은 `DEVELOPMENT.md`의 해당 절에 기록했다.

최종 PR의 통합 head에 대한 CI·후보 EXE 게시 및 실사용 검증 후 squash 병합한다. 병합 여부와 새 main SHA의 정식 EXE·웹 배포 상태는 [PR #59](https://github.com/moodoocoding/schooldoc/pull/59)의 검증·배포 기록을 기준으로 확인한다. 이 문서의 로컬 검사 통과는 후보 EXE의 실제 Google 인증·운영 업무 검증을 대신하지 않는다.
