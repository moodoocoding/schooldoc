export const isDataCollectDemoMode = (
  import.meta.env.DEV
  && (
    import.meta.env.VITE_DATA_COLLECT_DEMO_MODE === 'true'
    // 이 워크트리의 포트 설정은 다른 작업 폴더와 충돌하지 않도록 고정돼 있다.
    // 그 파일을 바꾸지 않고 기존 E2E 데모 서버에서 새 도구도 검증한다.
    || import.meta.env.VITE_CONSENT_FORMS_DEMO_MODE === 'true'
  )
);

const DATA_COLLECT_DEVELOPER_EMAIL = 'panthea0@gmail.com';

/**
 * 자료 수합이 정식 공개되기 전, 지정한 Google 계정에만 관리자 화면을 연다.
 * 이 값은 메뉴 표시를 위한 미리보기 플래그이며 Supabase 권한 경계가 아니다.
 */
export const isDataCollectDeveloper = (user?: { email?: string | null } | null) => (
  user?.email?.trim().toLowerCase() === DATA_COLLECT_DEVELOPER_EMAIL
);

export const dataCollectOwnerId = (authenticatedId?: string) => (
  isDataCollectDemoMode ? 'demo-teacher' : authenticatedId ?? ''
);
