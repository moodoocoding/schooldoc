# 로컬 변경 분류 (codex)

분류 기준일: 2026-10-01, 한국 시간. GitHub에서 `git fetch origin`으로 확인한 `origin/main`은 `4adf57187f03ff30cad29d66242475c3400c4349`이다.
로컬 브랜치는 `codex/classroom-role-status-visuals`, 분류 시 HEAD는 `c577550dcc1065b542e3c06220c2814e9414f2ec`이다.

분류 전 미커밋 파일은 **152개**다. 추적 파일 수정 26개와 미추적 파일 126개를 실제 파일 단위로 센 값이다. 앞서 안내한 65개는 폴더를 접어 표시한 Git 상태 항목 수였으며, 확인 중 동의서·영수증 커밋이 추가되어 당시 상태와도 달라졌다. 이 보고서 파일은 152개 집계에 포함하지 않았다.

중간에 GitHub로 올린 작업은 실제로 main에 반영돼 있다. 별도 작업 트리에서 PR을 병합하면서 이 오래된 작업 폴더에는 반영 당시의 파일이 수정 또는 미추적 상태로 남았다. 따라서 '미커밋' 표시만으로 '아직 GitHub에 없는 개발'이라고 볼 수 없다.

| 분류 | 파일 수 | 권장 처리 |
| --- | ---: | --- |
| 이미 main과 동일 | 70 | 최신 main으로 정리할 때 중복 변경으로 처리 |
| 과거 main 버전이 남은 파일 | 10 | 최신 main을 기준으로 정리 |
| 과거 동작과 새 변경이 섞인 1인 1역 파일 | 2 | 최신 main을 기준으로 정리 |
| main에 없는 미커밋 코드 수정 | 1 | 별도 검증 후 반영 후보 |
| main과 내용이 다른 검토 문서·화면 캡처 | 4 | 검증 자료로 보존 |
| main에 없는 디자인·복구 자료 | 65 | 디자인 자료로 보존 |

## 기능 개발 완료·main 통합 대기인 로컬 커밋

미커밋 152개와 별개다. 사용자가 이 작업 흐름에서 로컬 커밋은 기능 개발 완료를 뜻한다고 확인했다. 따라서 아래 두 기능은 개발 완료 상태이며, 남은 단계는 GitHub main 통합과 배포다. 분류 시 두 커밋은 main의 조상이 아니며 관련 새 파일·변경도 main에 없었다. 로컬 브랜치에는 원격 추적 브랜치가 설정돼 있지 않았다. 기능 개발 완료와 원격 통합·배포 상태를 별도로 기록한다.

| 로컬 커밋 | 개발 완료된 기능 | 남은 단계 |
| --- | --- | --- |
| `32a0106` | 가정통신문 수신자에 저장한 학급 명단 불러오기 | GitHub main 통합·배포 |
| `c577550` | 영수증 장부 Excel·영수증 첨부 PDF 내보내기 | GitHub main 통합·배포 |

영수증 화면에는 main의 에듀파인 사용 목적 변경(#36)이 따로 있다. 해당 로컬 커밋을 반영할 때 최신 화면과 합쳐야 한다. README·DEVELOPMENT도 커밋에 함께 들어 있으므로 기능 파일만 보고 단순 적용하지 않는다.

## main에 없는 미커밋 코드 1건

`src/features/activeWork/useActiveWork.ts:32`에 구독 등록의 `try/catch`가 추가돼 있다. 한 도구의 구독 등록이 동기 예외를 내도 다른 도구 초기화가 계속되게 하는 변경이다. 현재 main에는 없고, main 이력에도 동일한 파일 버전이 없다. 분류상 독립적인 개선 후보이며 이 작업에서는 코드를 수정하거나 테스트하지 않았다.

## 1인 1역의 남은 차이 2건

- `RoleAssignmentPage.tsx`: 로컬은 `useSearchParams`를 없애고 항상 1단계에서 시작한다. main은 일반 배정의 `?step=roles` 바로가기를 유지하고, 역할 교체만 날짜·명단 1단계부터 시작한다. 역할 교체 요청은 PR #34에서 이미 반영됐다.
- `tests/e2e/classroom-roles.spec.ts`: 로컬 테스트 제목은 모두 main에도 있다. main에 추가된 게시판 안내문 4개와 실천판 3개 테스트가 로컬에 없고, 학생 화면·QR·테스트 명단 생성 일부도 과거 동작을 가정한다. 로컬 전체 파일을 main 위에 덮으면 최신 검증을 잃는다.

## 과거 버전의 근거

Git blob 해시를 main의 파일 이력과 비교했다.

| 파일 | 로컬 내용과 같은 과거 커밋 |
| --- | --- |
| `README.md` | `a32219d` feat: add class missions with retention and teacher review |
| `src/features/classroomRoles/ClassroomRolesWorkspace.tsx` | `7ed5ef4` Polish classroom role assignment hierarchy and controls (#24) |
| `src/index.css` | `5b99ed2` Improve mobile classroom role assignment flow (#25) |
| `supabase/functions/_shared/classroomRoles.ts` | `fe4c552` Allow classroom role period edits and calendar exclusions (#26) |
| `tests/e2e/app-shell-scroll.spec.ts` | `a32219d` feat: add class missions with retention and teacher review |
| `src/features/classMissions/PublicClassMissionsPage.tsx` | `a32219d` feat: add class missions with retention and teacher review |
| `src/features/classMissions/missionApi.ts` | `a32219d` feat: add class missions with retention and teacher review |
| `supabase/functions/_shared/classMissionsServer.ts` | `a32219d` feat: add class missions with retention and teacher review |
| `tests/e2e/class-missions.spec.ts` | `a32219d` feat: add class missions with retention and teacher review |
| `tests/server/classMissions.test.ts` | `a32219d` feat: add class missions with retention and teacher review |

과거 코드에는 1인 1역 인쇄 안내문 추가 전 화면·CSS·스크롤 검사, 최근 주간 실천판 서버 규칙 적용 전 코드, 학생 이름으로 참여하는 변경 전 학급 미션 코드가 포함된다.

## 검토 자료 차이 4건

- `2026-09-27-roster-grid-review.md`: 본문은 거의 같고 마지막 테스트 집계가 다르다(main 단위 413개·관련 브라우저 43개, 로컬 단위 427개·관련 브라우저 38개+명단 5개). 숫자를 합치거나 최신 결과로 추정하지 않는다.
- `2026-09-28-rotation-date-review.md`: 로컬은 화면 크기·검사 결과를 더 상세히 쓴 원본이며 main에는 PR #34의 간결한 검토본이 있다.
- `roster-grid-desktop.png`, `roster-grid-mobile.png`: main의 캡처와 파일 해시가 다르다. 대체 화면 증거로 분류하며 이 작업에서는 화면 시각 비교를 하지 않았다.

## 다음 정리 순서

1. 진행 중인 다른 작업과 겹치지 않는 시점에 현재 변경·미추적 자료·로컬 커밋을 복구 가능한 형태로 보관한다.
2. 개발 완료된 동의서·영수증 로컬 커밋 2건은 최신 main과의 통합 검증 후 반영한다. 구독 오류 방어 처리 1건은 별도의 미커밋 수정으로 검토·검증한다.
3. 디자인·복구 자료는 보관 위치를 정한 뒤 옮기거나 별도 자료 커밋으로 관리한다.
4. 동일 파일과 과거 버전이 남은 작업 폴더를 최신 main으로 맞춘다.

이번 요청에서는 분류와 보고서 작성만 수행했다. 기존 소스·Git 인덱스·브랜치·원격 main을 변경하거나 파일을 삭제하지 않았다. 기능 테스트와 배포 검증은 분류의 범위가 아니므로 실행하지 않았다.

## 전체 파일 목록


### 이미 main과 동일 (70개)

Git이 저장할 때 사용하는 줄바꿈 정규화를 적용한 blob 해시가 origin/main과 같다. 이 작업 폴더의 오래된 HEAD 때문에 수정 또는 미추적으로 보인다.

- `.env.example`
- `DEVELOPMENT.md`
- `playwright.config.ts`
- `src/App.tsx`
- `src/components/SettingsPage.tsx`
- `src/features/activeWork/ActiveWorkPage.tsx`
- `src/features/activeWork/activeWorkProviders.ts`
- `src/features/activeWork/types.ts`
- `src/features/classroomRoles/RoleConfigurationPages.tsx`
- `src/features/classroomRoles/RoleStudentPicker.tsx`
- `src/features/settings/PrivacyRetentionPanel.tsx`
- `src/features/settings/privacyRetention.ts`
- `src/features/settings/privacyRetentionSettings.ts`
- `supabase/config.toml`
- `tests/e2e/class-roster-import.spec.ts`
- `tests/integration/classroomRoles.smoke.mjs`
- `tests/server/classroomRoles.test.ts`
- `tests/unit/privacyRetention.test.ts`
- `design/class-missions/2026-09-27/README.md`
- `design/class-missions/2026-09-27/drafts/teacher-dashboard-v1.png`
- `design/class-missions/2026-09-27/implementation-review.md`
- `design/class-missions/2026-09-27/prompts.md`
- `design/class-missions/2026-09-27/student-mobile.png`
- `design/class-missions/2026-09-27/teacher-dashboard.png`
- `design/class-missions/2026-09-27/verification/settings-mission-purge-desktop.png`
- `design/class-missions/2026-09-27/verification/settings-mission-purge-mobile.png`
- `design/class-missions/2026-09-27/verification/settings-mission-purge-zoom-200.png`
- `design/class-missions/2026-09-27/verification/student-mobile.png`
- `design/class-missions/2026-09-27/verification/teacher-24-desktop.png`
- `design/class-missions/2026-09-27/verification/teacher-60-desktop.png`
- `design/class-missions/2026-09-27/verification/teacher-60-mobile.png`
- `design/class-missions/2026-09-27/verification/teacher-60-narrow-desktop.png`
- `design/class-missions/2026-09-27/verification/teacher-60-zoom-200.png`
- `design/class-missions/2026-09-27/verification/teacher-empty-desktop.png`
- `design/class-missions/2026-09-27/verification/teacher-purge-review-desktop.png`
- `design/class-missions/2026-09-27/verification/teacher-purge-review-mobile.png`
- `design/class-missions/2026-09-27/verification/teacher-purge-review-zoom-200.png`
- `design/classroom-roles/2026-09-27-operation-calendar-review.md`
- `design/classroom-roles/2026-09-27-review-dialog-compact.md`
- `design/classroom-roles/verification/operation-settings-desktop.png`
- `design/classroom-roles/verification/operation-settings-mobile.png`
- `design/service-redesign/implementation-2026-09-27-card-usability/expert-discussion-alignment.md`
- `design/service-redesign/implementation-2026-09-27-card-usability/role-assignment-1024.png`
- `design/service-redesign/implementation-2026-09-27-card-usability/role-assignment-60-roles.png`
- `design/service-redesign/implementation-2026-09-27-card-usability/role-assignment-desktop.png`
- `design/service-redesign/implementation-2026-09-27-card-usability/role-assignment-midnight-large.png`
- `design/service-redesign/implementation-2026-09-27-mobile-ux/README.md`
- `design/service-redesign/implementation-2026-09-27-mobile-ux/assignment-complete-mobile.png`
- `design/service-redesign/implementation-2026-09-27-mobile-ux/assignment-long-role-mobile.png`
- `design/service-redesign/implementation-2026-09-27-mobile-ux/assignment-midnight-mobile.png`
- `design/service-redesign/implementation-2026-09-27-mobile-ux/assignment-mobile.png`
- `design/service-redesign/implementation-2026-09-27-mobile-ux/roster-mobile.png`
- `design/service-redesign/implementation-2026-09-27-mobile-ux/zoom-200-mobile.png`
- `design/settings-profile-label-review.md`
- `src/features/classMissions/ClassMissionsWorkspace.tsx`
- `src/features/classMissions/missionExportExcel.ts`
- `src/features/classroomRoles/RoleExcludedDatesCalendar.tsx`
- `supabase/functions/_shared/classMissions.ts`
- `supabase/functions/class-missions-admin/index.ts`
- `supabase/functions/class-missions-public/index.ts`
- `supabase/migrations/202609270100_class_missions.sql`
- `supabase/migrations/202609270101_class_mission_purge.sql`
- `supabase/migrations/202609280100_class_mission_purge_row_replacement.sql`
- `tests/e2e/classroom-roles-operation-settings.spec.ts`
- `tests/e2e/classroom-roles-review-dialog.spec.ts`
- `tests/e2e/classroom-roles-roster-grid.spec.ts`
- `tests/e2e/role-assignment-design.spec.ts`
- `tests/unit/classMissionExcel.test.ts`
- `tests/unit/classMissions.test.ts`
- `tests/unit/classroomRolesPeriodEditing.test.ts`

### 과거 main 버전이 남은 파일 (10개)

현재 main과는 다르지만 로컬 파일의 blob 해시가 main의 과거 이력에 존재한다. 새 기능의 누락이 아니라 이후 변경을 아직 가져오지 않은 상태다.

- `README.md`
- `src/features/classroomRoles/ClassroomRolesWorkspace.tsx`
- `src/index.css`
- `supabase/functions/_shared/classroomRoles.ts`
- `tests/e2e/app-shell-scroll.spec.ts`
- `src/features/classMissions/PublicClassMissionsPage.tsx`
- `src/features/classMissions/missionApi.ts`
- `supabase/functions/_shared/classMissionsServer.ts`
- `tests/e2e/class-missions.spec.ts`
- `tests/server/classMissions.test.ts`

### 과거 동작과 새 변경이 섞인 1인 1역 파일 (2개)

날짜 선택 등 요청한 변경은 main에 이미 있다. 아래 로컬 차이는 새 기능으로 병합할 대상이 아니라 최신 진입 동작과 테스트를 되돌리는 차이다.

- `src/features/classroomRoles/RoleAssignmentPage.tsx`
- `tests/e2e/classroom-roles.spec.ts`

### main에 없는 미커밋 코드 수정 (1개)

진행 업무의 구독 등록을 try/catch로 감싸 한 도구의 동기 예외가 다른 도구 렌더링을 막지 않게 하는 변경이다. 별도 검토·검증 후 최신 main 기반으로 반영할 후보다.

- `src/features/activeWork/useActiveWork.ts`

### main과 내용이 다른 검토 문서·화면 캡처 (4개)

배포 코드 변경이 아닌 로컬 검증 기록과 화면 증거의 차이다. 기능은 main에 이미 반영됐으며 원본 자료로 보존할 수 있다.

- `design/classroom-roles/2026-09-27-roster-grid-review.md`
- `design/classroom-roles/2026-09-28-rotation-date-review.md`
- `design/classroom-roles/verification/roster-grid-desktop.png`
- `design/classroom-roles/verification/roster-grid-mobile.png`

### main에 없는 디자인·복구 자료 (65개)

초기 시안, 프롬프트, 캡처, ZIP 및 복구용 코드 사본이다. 모두 design/ 아래에 있고 앱에서 실행하는 소스 경로에는 없다. 자료 보관 대상으로 분류한다.

- `design/classroom-roles/2026-09-26-v1/01-teacher-overview.png`
- `design/classroom-roles/2026-09-26-v1/02-role-settings.png`
- `design/classroom-roles/2026-09-26-v1/03-student-assignment.png`
- `design/classroom-roles/2026-09-26-v1/04-share-distribute.png`
- `design/classroom-roles/2026-09-26-v1/05-teacher-records.png`
- `design/classroom-roles/2026-09-26-v1/06-student-mobile.png`
- `design/classroom-roles/2026-09-26-v1/07-classroom-kiosk.png`
- `design/classroom-roles/2026-09-26-v1/08-classroom-board.png`
- `design/classroom-roles/2026-09-26-v1/09-next-period.png`
- `design/classroom-roles/2026-09-26-v1/README.md`
- `design/classroom-roles/2026-09-26-v1/prompts.md`
- `design/classroom-roles/2026-09-26-v1/refinement-prompts.md`
- `design/classroom-roles/2026-09-26-v2/01-monthly-student-dashboard.png`
- `design/classroom-roles/2026-09-26-v2/02-student-record-detail.png`
- `design/classroom-roles/2026-09-26-v2/03-step1-student-roster.png`
- `design/classroom-roles/2026-09-26-v2/04-step2-role-assignment.png`
- `design/classroom-roles/2026-09-26-v2/05-shared-student-link.png`
- `design/classroom-roles/2026-09-26-v2/06-shared-name-selection.png`
- `design/classroom-roles/2026-09-26-v2/07-shared-role-check.png`
- `design/classroom-roles/2026-09-26-v2/README.md`
- `design/classroom-roles/2026-09-26-v2/prompts.md`
- `design/classroom-roles/classroom-roles-mockups-v1.zip`
- `design/classroom-roles/classroom-roles-mockups-v2.zip`
- `design/service-redesign/2026-09-27-v2/01-teacher-home.png`
- `design/service-redesign/2026-09-27-v2/02-role-assignment.png`
- `design/service-redesign/2026-09-27-v2/03-parent-mobile.png`
- `design/service-redesign/2026-09-27-v2/README.md`
- `design/service-redesign/2026-09-27-v2/drafts/02-role-assignment-before-contrast.png`
- `design/service-redesign/2026-09-27-v2/drafts/03-parent-mobile-before-contrast.png`
- `design/service-redesign/2026-09-27-v2/prompts.md`
- `design/service-redesign/2026-09-27-v2/review-after.md`
- `design/service-redesign/2026-09-27-v2/review-before.md`
- `design/service-redesign/2026-09-27-v3/01-role-assignment.png`
- `design/service-redesign/2026-09-27-v3/README.md`
- `design/service-redesign/2026-09-27-v3/decision-before.md`
- `design/service-redesign/2026-09-27-v3/paper-review.md`
- `design/service-redesign/2026-09-27-v3/prompts.md`
- `design/service-redesign/2026-09-27-v3/review-after.md`
- `design/service-redesign/2026-09-27/01-teacher-home.png`
- `design/service-redesign/2026-09-27/02-role-assignment.png`
- `design/service-redesign/2026-09-27/03-parent-mobile.png`
- `design/service-redesign/2026-09-27/README.md`
- `design/service-redesign/2026-09-27/prompts.md`
- `design/service-redesign/2026-09-27/research.md`
- `design/service-redesign/2026-09-27/review.md`
- `design/service-redesign/2026-09-27/site-audit.json`
- `design/service-redesign/checkpoints/2026-09-27-before-card-usability-update/README.md`
- `design/service-redesign/checkpoints/2026-09-27-before-card-usability-update/SHA256.txt`
- `design/service-redesign/checkpoints/2026-09-27-before-card-usability-update/src/App.tsx`
- `design/service-redesign/checkpoints/2026-09-27-before-card-usability-update/src/features/classroomRoles/ClassroomRolesWorkspace.tsx`
- `design/service-redesign/checkpoints/2026-09-27-before-card-usability-update/src/features/classroomRoles/RoleAssignmentPage.tsx`
- `design/service-redesign/checkpoints/2026-09-27-before-card-usability-update/src/features/classroomRoles/RoleStudentPicker.tsx`
- `design/service-redesign/checkpoints/2026-09-27-before-card-usability-update/src/index.css`
- `design/service-redesign/checkpoints/2026-09-27-before-card-usability-update/tests/e2e/classroom-roles.spec.ts`
- `design/service-redesign/checkpoints/2026-09-27-before-card-usability-update/tests/e2e/role-assignment-design.spec.ts`
- `design/service-redesign/design-improvement-plan.md`
- `design/service-redesign/implementation-2026-09-27-card-usability/README.md`
- `design/service-redesign/implementation-2026-09-27/README.md`
- `design/service-redesign/implementation-2026-09-27/classroom-roles-home.png`
- `design/service-redesign/implementation-2026-09-27/participant-mobile.png`
- `design/service-redesign/implementation-2026-09-27/role-assignment-desktop.png`
- `design/service-redesign/implementation-2026-09-27/role-assignment-midnight-large.png`
- `design/service-redesign/implementation-2026-09-27/role-assignment-mobile.png`
- `design/service-redesign/schooldoc-design-2026-09-27.zip`
- `design/service-redesign/schooldoc-design-v2-images.zip`
