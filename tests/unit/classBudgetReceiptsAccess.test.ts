import { describe, expect, test } from 'vitest';
import {
  canAccessClassBudgetReceipts,
  classBudgetReceiptsOwnerId,
} from '../../src/features/classBudgetReceipts/classBudgetReceiptsConfig';

describe('학급 운영비 영수증 로그인 교사 접근', () => {
  test('관리자 역할·이메일 허용 목록 없이 로그인 계정에 연다', () => {
    expect(canAccessClassBudgetReceipts({ id: 'ordinary-teacher', is_anonymous: false })).toBe(true);
    expect(canAccessClassBudgetReceipts({ id: 'another-teacher' })).toBe(true);
  });

  test('로그아웃·익명 로그인·사용자 ID 누락을 차단한다', () => {
    expect(canAccessClassBudgetReceipts(null)).toBe(false);
    expect(canAccessClassBudgetReceipts()).toBe(false);
    expect(canAccessClassBudgetReceipts({ id: '', is_anonymous: false })).toBe(false);
    expect(canAccessClassBudgetReceipts({ id: 'guest', is_anonymous: true })).toBe(false);
  });

  test('계정 ID를 장부·원본 저장 공간 구분자로 그대로 사용한다', () => {
    expect(classBudgetReceiptsOwnerId('teacher-a')).toBe('teacher-a');
    expect(classBudgetReceiptsOwnerId('teacher-b')).toBe('teacher-b');
  });
});
