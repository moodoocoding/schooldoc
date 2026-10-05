import type { User } from '@supabase/supabase-js';

type ReceiptAccessUser = Pick<User, 'id' | 'is_anonymous'>;

// 운영·개발 환경 모두 로그인한 교사의 계정으로만 장부를 연다.
// 실제 API 인증은 서버가 Supabase에서 다시 검증한다.
export const canAccessClassBudgetReceipts = (user?: ReceiptAccessUser | null) =>
  Boolean(user?.id && !user.is_anonymous);

export const classBudgetReceiptsOwnerId = (userId?: string) => userId || 'local-demo-teacher';
