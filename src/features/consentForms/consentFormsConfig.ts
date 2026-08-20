export const isConsentFormsDemoMode = (
  import.meta.env.DEV
  && import.meta.env.VITE_CONSENT_FORMS_DEMO_MODE === 'true'
);

// 학생 결과 안내와 같은 규칙을 쓴다. 구현은 utils/publicAppOrigin.ts에 있다.
export { getPublicAppOrigin as getConsentPublicOrigin } from '../../utils/publicAppOrigin';
