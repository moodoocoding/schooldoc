# 격리 로컬 가정통신문 검증 재현 (codex)

Windows에서 저장소 루트를 cwd로 사용한다. 이 폴더의 검증 도구는 전용 시험이며 제품 배포 코드가 아니다. [결과와 실제/모의 구분](report.md)을 먼저 확인한다. 운영 `.env.local`/키/학생 자료를 읽지 않는다.

## 준비

프로젝트의 `npm ci` 의존성이 필요하다. 시험용 의존성은 제품 package.json과 분리한다.

```powershell
npm install --prefix design/consent-implementation/2026-10-01/.runtime --no-audit --no-fund embedded-postgres@18.4.0-beta.17 pg@8.23.1 deno@2.9.6
```

공식 PostgREST16.4 Windows 실행 파일을 `.runtime/postgrest/postgrest.exe`에 둔다. PostgreSQL libpq DLL은 local-db-server.mjs가 시험용 native/bin에서 PATH에 추가한다. 설치된 Google Chrome이 필요하며 Playwright는 `channel:chrome`, headed 모드를 사용한다. `.runtime/`은 Git에서 제외돼 DB·토큰·키·파일을 보관한다. 기존 암호화 키를 임의로 바꾸지 않는다.

## 순서

각 서버는 별도 터미널에서 시작하고 localhost만 사용한다. 다른 작업이 쓰는 포트를 종료하지 않는다.

```powershell
node design/consent-implementation/2026-10-01/local-db-server.mjs
# PostgreSQL55432 / PostgREST55433
node design/consent-implementation/2026-10-01/local-gateway.mjs
# 로컬 Auth/Storage55434 / 실제 Edge 함수55435
node node_modules/vite/bin/vite.js --config design/consent-implementation/2026-10-01/vite.verify.config.ts
# 실제 API 시험4181, consent demo=false
node design/consent-implementation/2026-10-01/launch-chrome.mjs
# 실제 Chrome CDP9229
```

서버 준비 후 다음을 순서대로 실행한다. DB 검사는 새 가상 fixture를 만들어 `.runtime/fixtures.json`에만 토큰을 보관한다. 다른 프로젝트/DB를 대상으로 실행하지 않는다.

```powershell
node design/consent-implementation/2026-10-01/fresh-migration-check.mjs
node design/consent-implementation/2026-10-01/db-verify.mjs
node design/consent-implementation/2026-10-01/chrome-verify.mjs
node design/consent-implementation/2026-10-01/chrome-extra.mjs
node design/consent-implementation/2026-10-01/io-measure.mjs
node design/consent-implementation/2026-10-01/chrome-accessibility.mjs
```

PDF 확인은 pypdf/Pillow와 Poppler가 있는 Python으로 `inspect-pdfs.py <pdftoppm.exe 절대경로>`를 실행한다. 산출 PDF/PNG/JSON에는 가상 자료만 저장한다. 마지막 페이지까지 눈으로 확인한다. `fresh-migration-check`는 시험 클러스터에 별도 DB를 생성해 이전 스키마/암호화 가상 이력 위에서 마이그레이션을 검사한다.

기존 데모 E2E는 별도 `vite.demo.config.ts` 서버4173을 시작한 뒤 저장소 검증 명령을 실행한다. API4181과 데모4173의 결과를 구분한다. native DB bootstrap은 consent와 privacy 스키마만 실제 마이그레이션을 적용하고, 다른 기능의 data_collections는 privacy 참조를 위한 최소 시험 테이블이다. Auth/Storage HTTP는 로컬 어댑터이므로 hosted Supabase 전체 스택 검사로 보고하지 않는다.

첫 DB 생성 시에만 schema/시험 키를 만든다. 시험 JWT는24시간 수명이며 재시작 시 같은 키로 갱신한다. 재시작 때는 gateway/Vite도 새 token을 읽도록 다시 시작한다. 시험 데이터가 있는 디렉터리를 자동 삭제하지 않는다.
