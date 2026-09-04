import type { User } from '@supabase/supabase-js';

export const isClassBudgetReceiptsPreviewEnabled = import.meta.env.DEV
  || import.meta.env.VITE_CLASS_BUDGET_RECEIPTS_PREVIEW === 'true';

const receiptAdminEmails = new Set([
  'panthea0@gmail.com',
  ...(import.meta.env.VITE_CLASS_BUDGET_RECEIPTS_ADMIN_EMAILS ?? '')
    .split(',')
    .map((email: string) => email.trim().toLowerCase())
    .filter(Boolean),
]);

type ReceiptAccessUser = Pick<User, 'email' | 'app_metadata'>;

export const isClassBudgetReceiptsAdmin = (user?: ReceiptAccessUser | null) => {
  if (!user) return false;
  const role = typeof user.app_metadata?.role === 'string'
    ? user.app_metadata.role.toLowerCase()
    : '';
  const email = user.email?.trim().toLowerCase() ?? '';
  return role === 'admin' || receiptAdminEmails.has(email);
};

export const canAccessClassBudgetReceipts = (
  user?: ReceiptAccessUser | null,
  previewEnabled = isClassBudgetReceiptsPreviewEnabled,
) => previewEnabled || isClassBudgetReceiptsAdmin(user);

export const classBudgetReceiptsOwnerId = (userId?: string) => userId || 'local-demo-teacher';
