export const isClassBudgetReceiptsPreviewEnabled = import.meta.env.DEV
  || import.meta.env.VITE_CLASS_BUDGET_RECEIPTS_PREVIEW === 'true';

export const classBudgetReceiptsOwnerId = (userId?: string) => userId || 'local-demo-teacher';
