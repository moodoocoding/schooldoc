# 네 기능 통합 검증 (codex)

## 통합 범위

가정통신문 수합, 등록부 서명, 자료 수합, 특별실 예약의 기능 수정·테스트·검증 보고서와 기능별 일지를 통합한다. 기능 브랜치는 따로 GitHub에 보존한다. 공통 CSS·보관 설정·진행 업무·DB 집계와 서버 변경을 함께 검증하고 main 자동 배포의 순서를 조정하기 위해 통합 PR을 사용한다.

| 기능 | 최종 인계 커밋 | 보고서 |
| --- | --- | --- |
| 가정통신문 | 776cc7ba0d40aedc77925201c5d8e633939b017e | [수정 보고서](../../consent-implementation/2026-10-01/report.md) |
| 등록부 | 9e8c397fd19c814c002404d158e8c30935c388b1 | [수정 보고서](../2026-10-01-registry/fixes.md) |
| 자료 수합 | e5a63a66bd7152d9ed5ada82775c37929350f42e | [수정 보고서](../2026-10-01-data-collect-fix/verification.md) |
| 특별실 | c48f6616bbb34211f7183c168de79d542aa15a5a | [수정 보고서](../2026-10-01-special-rooms/implementation.md) |

DEVELOPMENT.md와 src/index.css의 추가 부분 충돌은 양쪽 기능 규칙을 모두 유지해 해결했다. 보관 설정과 진행 업무의 자동 병합도 각 기능 연결이 남았는지 확인했다. 기존 공유 main의 영수증 미커밋 변경은 통합에 포함하지 않았다.

## 실행한 검증

| 실제 명령/검사 | 결과·한계 |
| --- | --- |
| `npm run typecheck` | 통과. [로그](typecheck.txt) |
| `npm run lint` | 오류 0, 기존 경고 6개. [로그](lint.txt) |
| `npm test` | 63파일·501개 통과. [로그](unit.txt) |
| `npm run build` | 통과, 기존 500kB 초과 번들 경고. [로그](build.txt) |
| `PLAYWRIGHT_TEST_PORT=4281 npm run test:e2e -- tests/e2e/consent-forms.spec.ts tests/e2e/registry-sign.spec.ts tests/e2e/registry-accessibility.spec.ts tests/e2e/registry-optimization.spec.ts tests/e2e/data-collect.spec.ts tests/e2e/data-collect-fix.spec.ts tests/e2e/data-collect-list.spec.ts tests/e2e/special-rooms.spec.ts tests/e2e/special-rooms-week-grid.spec.ts tests/e2e/special-rooms-regressions.spec.ts tests/e2e/active-work.spec.ts tests/e2e/app-shell-scroll.spec.ts --workers=2` | 실제 설치 Google Chrome 데모/모의 API 86개 통과, 모의 API 클라이언트 환경 부재 3개 실패. 환경 보완 후 해당 3개 재검사 통과하여 89개 모두 최종 통과. [전체 로그](chrome-e2e.txt), [3개 재검사](chrome-api-recheck.txt) |
| `npx deno check --node-modules-dir=none` + 배포 대상 9개 entrypoint | 모두 통과. 프런트 의존성을 바꾸지 않고 Deno cache 사용. [로그](edge-check.txt) |
| `npx deno test --node-modules-dir=none --no-check --allow-read --allow-env --allow-sys tests/server/registryPublic.test.ts tests/server/specialRooms.test.ts tests/server/specialRoomsSql.test.ts` | 11개/SQL 10단계 통과. 모의 DB/Storage 계약과 PGlite SQL이며 실제 Supabase 검사와 구분. [로그](edge-test.txt) |
| `REGISTRY_PG_RUNTIME=<isolated runtime> node design/feature-reviews/2026-10-02-integration/migrations.mjs` | 실제 PGlite+pgcrypto에서 32개 마이그레이션 전체 적용 통과. 현재 자료 수합 기준 집계와 비공개 제출 RPC 권한 확인. [결과](migrations.json) |
| `npx supabase migration list --linked`, `npx supabase db push --dry-run --linked` | 원격 기존 28개 이력 일치, 추가 4개만 적용 예정. 이 단계에서는 미적용 |
| 원격 `pg_policies`, Realtime 함수, `get_active_work_summary()` 조회 | Realtime 기존 정책 없음, 필요한 send/topic 함수 존재, 자료 수합 집계 치환의 기존 정의 일치. 업무 데이터는 조회하지 않음 |

## 브라우저 시험 환경 보완

첫 시도에서 공유 node_modules 경로가 Vite fs.allow 밖이라 PDF worker 403이 발생했다. [첫 시도 로그](chrome-environment-attempt.txt)를 남기고 취소했다. [시험용 Vite 설정](vite.integration.config.mts)에 작업 폴더와 의존성 실경로만 허용해 PDF 검사를 재실행했다. 모의 API 3개는 설정된 Supabase client가 필요하므로 `.invalid` 예약 도메인과 가상 anon key를 시험 설정에 명시했다. 제품 Vite 설정·기존 키·운영 인증 정책은 바꾸지 않았다. [홈 전체 화면](local-home.png)을 실제 Chrome으로 확인했고 콘솔 page error는 없었다.

## 남은 검증·개선과 배포 경계

- 가정통신문의 긴 QR 이름과 긴 목록 공유 영역 배치는 후속 UI 개선으로 남아 있다.
- 실제 Supabase 로그인·소유자 간 격리·Storage 제출/재시도/파기·서버 PDF·다중 연결 잠금·학교 부하·교실 장비·물리 프린터 검증은 이 로컬 통합 검사로 확인하지 않았다.
- 특별실 알림 전용 새 서명키는 준비되지 않았다. 기존 키는 유지하고 수동/복귀/보이는 탭의 5분 조건부 확인으로 배포하며 빠른 private 알림 활성화는 별도 신뢰·권한 검증이 남는다.
- 배포 대상 DB: 202610010200_registry_io_and_atomic_submission.sql, 202610010300_data_collect_submission_and_queries.sql, 202610010600_special_room_scoped_sync.sql, 202610011000_consent_integrity_io.sql.
- Edge 대상: consent-forms-admin/public, registry-public/participants/pdf, data-collect-admin/public, special-rooms-admin/public. 기존 원격 verify_jwt 설정을 유지한다.
- main은 Vercel 자동 운영 배포 브랜치다. 원격 DB→지정 Edge Functions→main 병합/프런트 순서로 진행한다. 운영 쓰기 시험·파기는 자동 실행하지 않는다. 배포 결과와 읽기·거부 경로 확인은 별도 release 기록에 실제 결과만 추가한다.
