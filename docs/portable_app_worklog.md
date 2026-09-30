# 📋 스쿨독(SchoolDoc) 연구대회 출품용 윈도우 포터블(.exe) 패키징 작업일지

* **작업 일시:** 2026-09-30
* **작업 브랜치:** `feature/portable-app`
* **목적:** 연구대회 심사위원 및 교원 현장 사용을 위한 단일 실행 무설치 파일(`스쿨독_포터블_1.0.0.exe`) 제작 및 기존 웹(Vercel) 배포와의 안전한 병행 체계 구축

---

## 1. 아키텍처 및 버전 관리 전략

* **브랜치 분리 전략:** 기존 상용 Vercel 웹 서비스의 안정성을 100% 보장하기 위해 `main` 브랜치와 분리된 `feature/portable-app` 브랜치에서 패키징 작업을 수행함.
* **패키징 엔진:** **Electron (v44.4.5) + electron-builder (v26.15.3)**
  * Chromium 기반 런타임으로 Supabase 통신, PDF 렌더링, 엑셀 파싱 등 기존 스쿨독의 10대 핵심 기능이 웹과 완벽히 동일하게 구동됨.
  * Windows 단일 실행 무설치 포터블(`portable`) 타겟 빌드로 학교 행정 PC의 관리자 설치 권한 문제 해결.
* **Vite 빌드 호환성:** 로컬 `file://` 프로토콜 기반 구동 시 CSS/JS 및 웹 폰트 자산 경로 무결성을 위해 `base: './'` 상대경로 옵션 적용.

---

## 2. 작업 진행 상세 내역

| 단계 | 항목 | 상태 | 세부 내용 |
| :---: | :--- | :---: | :--- |
| **01** | 브랜치 분리 | ✅ 완료 | `feature/portable-app` 생성 및 체크아웃 |
| **02** | 패키징 의존성 설치 | ✅ 완료 | `electron`, `electron-builder`, `cross-env` 개발 의존성 설치 |
| **03** | 일렉트론 메인 프로세스 구성 | ✅ 완료 | `electron/main.cjs` 윈도우 프레임(1360x860), 외부 링크 브라우저 위임 처리 |
| **04** | package.json 빌드 스크립트 등록 | ✅ 완료 | `"electron:build:portable": "npm run build && electron-builder --win portable"` |
| **05** | 프로덕션 포터블 빌드 검증 | ✅ 완료 | `release/스쿨독_포터블_1.0.0.exe` (118MB) 생성 성공 |
| **06** | 깃허브 원격 브랜치 푸시 | ✅ 완료 | `origin/feature/portable-app` 동기화 |
| **07** | 구글 OAuth 로컬 루프백 탑재 | ✅ 완료 | SchoolBoard 검증 패턴 이식: `preload.cjs`, 로컬 루프백 서버, 브라우저 구글 로그인 및 Supabase 세션 교환 완비 |
| **08** | 데스크톱 HashRouter 지원 | ✅ 완료 | `file://` 환경에서 메뉴/카드(학급 미션, 1인 1역 등) 클릭 시 세부 화면으로 즉시 전환되도록 라우터 분기 적용 |
| **09** | 프로필 클라우드 동기화 & 직접 입력 | ✅ 완료 | `profileSettings.ts` Supabase User Metadata 연동으로 웹과 앱 간 실시간 프로필 동기화 및 NEIS/직접입력 토글 제공 |
| **10** | 웹 최신 기능 병합 (학급 미션 이름 입력) | ✅ 완료 | 깃허브 `origin/main`의 최신 기능(학급 미션 학생 코드 대신 이름 입력 지원)을 포터블 앱 브랜치로 무결 병합 |

---

## 3. 산출물 및 사용 방법

* **깃허브 공식 릴리즈 다운로드 링크:**
  * [https://github.com/moodoocoding/schooldoc/releases/tag/v1.0.0-portable](https://github.com/moodoocoding/schooldoc/releases/tag/v1.0.0-portable)
* **생성된 포터블 실행 파일:**
  * 파일명: `스쿨독_포터블_1.0.0.exe` (약 118.7 MB)
  * 특징: 별도 인스톨러 없이 더블 클릭 즉시 실행 (학교 PC 권한 제약 없음)
* **재빌드 명령어:**
  ```bash
  npm run electron:build:portable
  ```
