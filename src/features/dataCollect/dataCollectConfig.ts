export const isDataCollectDemoMode = (
  import.meta.env.DEV
  && (
    import.meta.env.VITE_DATA_COLLECT_DEMO_MODE === 'true'
    // 이 워크트리의 포트 설정은 다른 작업 폴더와 충돌하지 않도록 고정돼 있다.
    // 그 파일을 바꾸지 않고 기존 E2E 데모 서버에서 새 도구도 검증한다.
    || import.meta.env.VITE_CONSENT_FORMS_DEMO_MODE === 'true'
  )
);

export const dataCollectOwnerId = (authenticatedId?: string) => (
  isDataCollectDemoMode ? 'demo-teacher' : authenticatedId ?? ''
);
