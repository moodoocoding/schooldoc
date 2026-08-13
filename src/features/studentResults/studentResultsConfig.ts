export const isStudentResultsDemoMode = (
  import.meta.env.DEV
  && import.meta.env.VITE_STUDENT_RESULTS_DEMO_MODE === 'true'
);

export const studentResultsOwnerId = (userId?: string) => (
  userId ?? (isStudentResultsDemoMode ? 'local-demo-teacher' : '')
);
