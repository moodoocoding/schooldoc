import { describe, expect, it } from 'vitest';
import {
  applyPurposePreset,
  BUDGET_PURPOSE_PRESETS,
  recommendPresetKey,
  suggestReceiptPurpose,
} from '../../src/features/classBudgetReceipts/receiptCategorizer';

describe('receiptCategorizer (에듀파인 정산용 적요 템플릿)', () => {
  describe('recommendPresetKey', () => {
    it('과자, 간식, 음료 품목은 학급 행사 간식 프리셋으로 추천한다', () => {
      expect(recommendPresetKey('몽쉘 초코파이 1박스', '이마트')).toBe('class-event');
      expect(recommendPresetKey('하리보 골드베렌 젤리', '쿠팡')).toBe('class-event');
      expect(recommendPresetKey('제주감귤 주스', '홈플러스')).toBe('class-event');
    });

    it('칭찬 스티커, 도장 등은 칭찬 보상 물품 프리셋으로 추천한다', () => {
      expect(recommendPresetKey('참 잘했어요 칭찬 도장 세트', '알파문구')).toBe('student-reward');
      expect(recommendPresetKey('캐릭터 칭찬 스티커 10장', '네이버스토어')).toBe('student-reward');
      expect(recommendPresetKey('학급 추첨 뽑기판', '쿠팡')).toBe('student-reward');
    });

    it('게시판, 이름표, 청소용품 등은 교실 환경 정비 프리셋으로 추천한다', () => {
      expect(recommendPresetKey('학급 게시판 테두리 보더 및 판자석', '알파문구')).toBe('environment');
      expect(recommendPresetKey('학생 책상 네임스티커 라벨지', '드림디포')).toBe('environment');
      expect(recommendPresetKey('물티슈 100매 10개입', '다이소')).toBe('environment');
    });

    it('보드게임, 실내놀이 도구는 학급 친교 활동 프리셋으로 추천한다', () => {
      expect(recommendPresetKey('할리갈리 딜럭스 보드게임', '쿠팡')).toBe('fellowship');
      expect(recommendPresetKey('루미큐브 클래식', '네이버쇼핑')).toBe('fellowship');
      expect(recommendPresetKey('원목 젠가 게임', '이마트')).toBe('fellowship');
    });

    it('만들기 키트, 학급 문집 제본 등은 학급 특색 활동 프리셋으로 추천한다', () => {
      expect(recommendPresetKey('DIY 천연비누 만들기 키트', '사이언스몰')).toBe('special-activity');
      expect(recommendPresetKey('학급 문집 제본 및 표지 출력', '킨코스')).toBe('special-activity');
    });
  });

  describe('suggestReceiptPurpose', () => {
    it('품목명이 있으면 정산용 문장 뒤에 괄호로 품목명을 병기한다', () => {
      expect(suggestReceiptPurpose('몽쉘 및 포카칩', '이마트'))
        .toBe('학급 자치행사 다과 구입 (몽쉘 및 포카칩)');
      expect(suggestReceiptPurpose('칭찬 도장 3종', '알파문구'))
        .toBe('학생 칭찬 보상 및 생활지도 물품 구입 (칭찬 도장 3종)');
      expect(suggestReceiptPurpose('게시판 보더 테이프', '알파문구'))
        .toBe('교실 환경 구성 및 학급 게시판 정비용품 구입 (게시판 보더 테이프)');
    });

    it('품목명이 없고 상호명만 있으면 상호명을 괄호로 병기한다', () => {
      expect(suggestReceiptPurpose('', '파리바게뜨'))
        .toBe('학급 자치행사 다과 구입 (파리바게뜨)');
      expect(suggestReceiptPurpose('', '다이소'))
        .toBe('교실 환경 구성 및 학급 게시판 정비용품 구입 (다이소)');
    });

    it('둘 다 없으면 빈 문자열을 반환한다', () => {
      expect(suggestReceiptPurpose('', '')).toBe('');
    });
  });

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
