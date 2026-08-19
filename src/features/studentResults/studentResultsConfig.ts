export const isStudentResultsDemoMode = (
  import.meta.env.DEV
  && import.meta.env.VITE_STUDENT_RESULTS_DEMO_MODE === 'true'
);

export const studentResultsOwnerId = (userId?: string) => (
  userId ?? (isStudentResultsDemoMode ? 'local-demo-teacher' : '')
);

// 가정통신문과 같은 규칙을 쓴다. 구현은 utils/publicAppOrigin.ts에 있다.
export { getPublicAppOrigin as getStudentResultsPublicOrigin } from '../../utils/publicAppOrigin';
