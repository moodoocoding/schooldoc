import { describe, expect, test } from 'vitest';
import { studentResultsQrPageSize } from '../../src/features/studentResults/studentResultsQrLayout';

describe('학생 결과 QR의 A4 카드 밀도', () => {
  test('일반 카드 8명을 한 쪽에 유지한다', () => {
    expect(studentResultsQrPageSize(925, 218)).toBe(8);
  });
  test('긴 이름과 식별값은 카드 높이를 보존하며 4명으로 줄인다', () => {
    expect(studentResultsQrPageSize(925, 380)).toBe(4);
  });
  test('머리글까지 길면 2명으로 줄인다', () => {
    expect(studentResultsQrPageSize(620, 380)).toBe(2);
  });
  test('행 사이 간격을 포함해서 한 쪽에 맞춘다', () => {
    expect(studentResultsQrPageSize(800, 194)).toBe(6);
  });
  test('내용이 A4보다 크면 조용히 잘라 내지 않고 중단한다', () => {
    expect(() => studentResultsQrPageSize(300, 380)).toThrow('한 페이지보다');
    expect(() => studentResultsQrPageSize(925, 0)).toThrow();
    expect(() => studentResultsQrPageSize(Number.NaN, 200)).toThrow();
  });
});
