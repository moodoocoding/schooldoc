# 1인 1역 배포 및 운영 안내

## 저장과 접근

- `classroom_role_boards`: 교사 계정당 학급 하나. 공통 명단·역할 목록·배정 기간 스냅샷을 AES-GCM 암호화 저장한다.
- `classroom_role_records`: 학생 식별자·배정 기간·날짜별 상태와 마지막 입력 출처. 실명은 암호화된 스냅샷에만 저장한다.
- `classroom-roles-admin`: JWT 게이트웨이 검사 대신 함수 안의 `auth.getUser()`와 owner 필터로 매 요청 검증한다. 기존 함수의 인증 설정은 바꾸지 않는다.
- `classroom-roles-public`: 공용 토큰, 요청 제한, 날짜·배정·공개 상태를 검증한다. 로그인 없는 자기보고 방식이다.
- 공유 명단 설정은 스쿨독 설정 → 학급 학생 명단. 확정한 배정은 수정하지 않고 다음 기간을 만들어 교체한다. 이름·역할 수정은 다음 배정부터 적용한다.
- 공개 링크는 비밀번호가 없다. 학급 안에서만 공유한다. 전자칠판 이름 가리기는 표시 옵션이며 이름 선택 화면에는 실제 명단이 보인다.
- 진행 중인 학급/기간은 자동 파기하지 않는다. 이 첫 버전은 보관 기간 만료 자동 파기·생활기록부 자동 문장·순위·개별 학생 QR을 제공하지 않는다.

## 순서

1. `npx supabase login` 후 기존 프로젝트에 접근 가능한지 확인한다. 토큰은 채팅이나 Git에 기록하지 않는다.
2. 기존 운영 프로젝트 ID를 확인하여 `npx supabase link --project-ref <기존 프로젝트 ID>`로 연결한다. 새로운 프로젝트로 우회하지 않는다.
3. `npx supabase migration list --linked`로 원격/로컬 이력을 비교한다. 누락이나 번호 충돌을 해결한 뒤 진행한다.
4. secrets 목록에서 `CLASSROOM_ROLES_ENCRYPTION_KEY` 존재 여부를 확인한다. 없을 때만 암호학적으로 생성한 32바이트(64자리 hex) 값을 등록한다. 이미 있으면 덮어쓰거나 재생성하지 않는다. 키를 브라우저의 `VITE_` 변수에 넣지 않는다.
5. 새 `202609270001_classroom_roles.sql`을 적용한다. 기존 마이그레이션을 수정하지 않는다.
6. `npx supabase functions deploy classroom-roles-admin`와 `npx supabase functions deploy classroom-roles-public`만 배포한다.
7. 가상 시험 계정/자료로 서버의 교사 소유권 분리·공개 입력·기록 조회를 확인한다. 데모 E2E 통과는 이 단계를 대신하지 않는다.
8. 기능 브랜치 PR의 검사 결과와 변경 범위를 확인한 후 main에 통합한다. Git 연동 프런트엔드 배포가 성공했는지 확인한다.
9. 운영 주소에서 교사 로그인 → 명단 → 배정 → 학생 공통 링크 → 제출 → 교사 확인을 실제로 점검한다.

## 검사 명령

```text
npm ci
npm run typecheck
npm run lint
npm test
npm run test:e2e -- tests/e2e/classroom-roles.spec.ts tests/e2e/app-shell-scroll.spec.ts
npm run build
npx deno check --no-config supabase/functions/classroom-roles-admin/index.ts supabase/functions/classroom-roles-public/index.ts
npx deno test --no-config --allow-env tests/server/classroomRoles.test.ts
npx deno test --no-config --allow-read --allow-env --allow-sys tests/server/classroomRolesSql.test.ts
```

SQL 검사는 PGlite 0.5.8의 메모리 PostgreSQL에 새 스키마만 적용하며 원격 자료를 읽거나 변경하지 않는다. [PGlite API](https://pglite.dev/docs/api)의 `exec`, `query`, `close`를 사용한다.

## 개발 데모

`VITE_CLASSROOM_ROLES_DEMO_MODE=true`는 Vite 개발 모드에서만 작동한다. 가상 명단으로 테스트한다. localStorage에 저장되므로 다른 브라우저/기기로 동기화되지 않는다. 프로덕션 빌드에서는 이 플래그로 인증을 우회할 수 없다.
