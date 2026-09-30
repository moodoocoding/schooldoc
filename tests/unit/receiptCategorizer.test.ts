import { describe, expect, it } from 'vitest';
import {
  applyPurposePreset,
  BUDGET_PURPOSE_PRESETS,
} from '../../src/features/classBudgetReceipts/receiptCategorizer';

describe('receiptCategorizer (교사가 선택하는 사용 목적 문구)', () => {
  describe('applyPurposePreset', () => {
    it('기존 적요의 괄호 안 품목명을 보존하면서 프리셋 문구만 자연스럽게 교체한다', () => {
      const current = '학급 자치행사 다과 구입 (마이쮸, 멘토스)';
      const result = applyPurposePreset(current, 'student-reward');
      expect(result).toBe('학생 칭찬 보상 및 생활지도 물품 구입 (마이쮸, 멘토스)');
    });

    it('괄호 품목명이 없지만 fallbackItems가 전달되면 새 프리셋과 조합한다', () => {
      const current = '직접 입력한 내용';
      const result = applyPurposePreset(current, 'environment', '바구니 4개');
      expect(result).toBe('교실 환경 구성 및 학급 게시판 정비용품 구입 (바구니 4개)');
    });

    it('품목명이 전혀 없으면 프리셋 기본 문구만 적용한다', () => {
      const current = '간식 구입';
      const result = applyPurposePreset(current, 'fellowship');
      expect(result).toBe('학급 친교 및 자율활동 물품 구입');
    });

    it('배양토도 교사가 선택한 문구만 적용하고 구매 내용을 보존한다', () => {
      expect(applyPurposePreset('', 'special-activity', '고급혼합 배양토'))
        .toBe('학급 특색 교육활동 소모품 구입 (고급혼합 배양토)');
    });

    it('알 수 없는 문구 선택은 다과로 대체하지 않고 현재 입력을 유지한다', () => {
      expect(applyPurposePreset('식물 관찰 활동 재료', 'unknown', '고급혼합 배양토'))
        .toBe('식물 관찰 활동 재료');
      expect(applyPurposePreset('', 'unknown', '고급혼합 배양토')).toBe('');
    });
  });

  describe('BUDGET_PURPOSE_PRESETS 상수', () => {
    it('5대 핵심 프리셋이 정의되어 있다', () => {
      expect(BUDGET_PURPOSE_PRESETS.length).toBe(5);
      const keys = BUDGET_PURPOSE_PRESETS.map((p) => p.key);
      expect(keys).toEqual([
        'class-event',
        'student-reward',
        'environment',
        'fellowship',
        'special-activity',
      ]);
    });
  });
});
