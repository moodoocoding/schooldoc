# SchoolDoc

## [Windows EXE 다운로드 — 최신 릴리즈](https://github.com/moodoocoding/schooldoc/releases/latest)

설치 없이 사용하는 Windows x64 버전입니다. 최신 릴리즈의 **Assets**에서
`SchoolDoc_Portable_`로 시작하는 `.exe` 파일을 내려받아 실행하세요.

[웹에서 바로 사용하기](https://schooldoc-nine.vercel.app) · [전체 릴리즈 보기](https://github.com/moodoocoding/schooldoc/releases)

교사의 반복적인 학교 업무를 더 간단하고 안전하게 처리하는 웹 애플리케이션입니다.

SchoolDoc은 교사용 관리 화면과 학생·학부모·참여자용 공개 화면을 분리합니다. 교사는 업무를
만들고 링크나 QR 코드를 공유하며, 참여자는 별도의 회원가입 없이 필요한 응답만 제출할 수
있습니다. 수합 결과는 한곳에서 확인하고 Excel 또는 PDF로 정리할 수 있습니다.

## 주요 기능

| 기능 | 설명 |
| --- | --- |
| 등록부 서명 | 참석자 명단을 만들거나 Excel로 가져오고, 공개 링크에서 서명을 받은 뒤 PDF로 출력합니다. |
| 학생 결과 안내 | 학생별 결과를 안전하게 안내하고 확인·이의 제기·교사 답변을 관리합니다. |
| 가정통신문 수합 | 원본 PDF에 응답 위치를 지정하고 보호자 응답과 서명을 온라인으로 받습니다. |
| 자료 수합 | 명단 기반 또는 공개 방식으로 파일과 응답을 받고 제출 현황을 관리합니다. |
| 특별실 예약 | 특별실별 주간 일정을 공개하고 예약과 휴관 정보를 관리합니다. |
| 1인 1역 | 학급 역할을 배정하고 학생 실천을 기록합니다. 담당 학생과 QR을 함께 담은 20칸 A4 게시판 안내문을 인쇄할 수 있습니다. |
| 학급 미션 | 설정의 학급·학생 명단을 가져와 미션을 발행합니다. 학생은 QR에 접속해 이름으로 본인 미션을 확인하고, 교사는 현황·확인 대기자·종료 후 90일 보관과 파기를 관리합니다. |
| 진행 업무 | 여러 도구에서 진행 중인 업무를 한 화면에 모아 보여 줍니다. |
| 학급 운영비 영수증 | 로그인한 교사가 개인 장부에서 영수증 등록·검토와 정산내역을 확인하고, 예산 관리·Excel 정산내역·영수증 첨부 PDF 다운로드를 사용할 수 있습니다. 장부와 원본은 현재 브라우저에 저장됩니다. |

## 기본 사용 흐름

1. 교사가 Google 계정으로 로그인합니다.
2. 필요한 도구에서 새 업무를 만듭니다.
3. 생성된 링크나 QR 코드를 학생·학부모·참여자에게 공유합니다.
4. 제출 현황을 확인하고 결과를 Excel, PDF 또는 인쇄물로 정리합니다.

공개 링크는 로그인 없이 사용할 수 있으며, 관리 데이터는 로그인한 사용자별로 분리됩니다.

## 기술 구성

- React 19, TypeScript, Vite
- Tailwind CSS
- Supabase Database, Storage, Auth, Edge Functions
- Vitest, Playwright
- Vercel

## 로컬에서 실행하기

### 준비 사항

- Node.js와 npm
- 기능 연동이 필요한 경우 Supabase 프로젝트

저장소를 복제하고 의존성을 설치합니다.

```bash
git clone https://github.com/moodoocoding/schooldoc.git
cd schooldoc
npm install
```

환경 변수 예시를 복사해 `.env.local`을 만듭니다.

```bash
cp .env.example .env.local
```

최소 연결 정보는 다음과 같습니다.

```dotenv
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

개발 서버를 시작합니다.

```bash
npm run dev
```

Supabase 연결 정보가 없어도 화면은 열 수 있지만, 로그인과 서버 데이터가 필요한 기능은
동작하지 않습니다.

## 검사와 빌드

```bash
npm run typecheck  # TypeScript 검사
npm run lint       # 정적 분석
npm test           # 단위 테스트
npm run test:e2e   # 브라우저 E2E 테스트
npm run build      # 프로덕션 빌드
```

## Windows 포터블

Windows x64에서 `npm run electron:build:portable`로 무설치 EXE를 만들고
`npm run test:portable`로 실제 패키지를 검사할 수 있습니다. 공개 Supabase 연결 설정과
Google 로그인 콜백 설정이 필요합니다. [빌드·검증·릴리즈 절차](docs/portable-release.md)를 참고하세요.

## 프로젝트 구조

```text
schooldoc/
├─ src/
│  ├─ auth/          # 교사용 인증
│  ├─ components/    # 공통 화면 구성 요소
│  ├─ features/      # 업무 도구별 기능
│  └─ utils/         # 공통 유틸리티
├─ supabase/
│  ├─ functions/     # Edge Functions
│  └─ migrations/    # 데이터베이스 마이그레이션
├─ tests/
│  ├─ unit/          # 단위 테스트
│  ├─ integration/   # 원격 연동 테스트
│  └─ e2e/           # 사용자 흐름 테스트
├─ public/           # 정적 파일
└─ design/           # 디자인 검토 자료
```

## 개발 문서

보안 키, Supabase 배포 순서, 마이그레이션 관리, 기능별 구현 원칙처럼 개발자와 운영자에게
필요한 세부 내용은 [DEVELOPMENT.md](DEVELOPMENT.md)에 정리되어 있습니다.
