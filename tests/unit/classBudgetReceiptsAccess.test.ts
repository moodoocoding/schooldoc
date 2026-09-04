import { describe, expect, test } from 'vitest';
import {
  canAccessClassBudgetReceipts,
  isClassBudgetReceiptsAdmin,
} from '../../src/features/classBudgetReceipts/classBudgetReceiptsConfig';

const user = (email: string, role?: string) => ({
  email,
  app_metadata: role ? { role } : {},
});

describe('학급 운영비 영수증 관리자 미리보기', () => {
  test('지정된 관리자 이메일은 운영에서도 접근할 수 있다', () => {
    expect(isClassBudgetReceiptsAdmin(user('PANTHEA0@gmail.com'))).toBe(true);
    expect(canAccessClassBudgetReceipts(user('panthea0@gmail.com'), false)).toBe(true);
  });

  test('관리자 역할이 있는 계정도 접근할 수 있다', () => {
    expect(isClassBudgetReceiptsAdmin(user('teacher@example.com', 'ADMIN'))).toBe(true);
  });

  test('일반 교사는 운영 미리보기에서 차단한다', () => {
    expect(canAccessClassBudgetReceipts(user('teacher@example.com'), false)).toBe(false);
  });

  test('개발 환경 미리보기는 기존처럼 모든 계정에 연다', () => {
    expect(canAccessClassBudgetReceipts(null, true)).toBe(true);
  });
});
