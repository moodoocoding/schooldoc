import { describe, expect, test } from 'vitest';
import { parseReceiptText } from '../../src/features/classBudgetReceipts/receiptOcr';

describe('영수증 규칙 기반 분석', () => {
  test('한국어 영수증에서 날짜·사용처·총액을 찾는다', () => {
    const draft = parseReceiptText('상호: 중앙문구\n거래일시 2026-09-02 09:30\n공급가액 29,545\n부가세 2,955\n결제금액 32,500원', 'browser-ocr', 0.9);
    expect(draft).toMatchObject({ spentAt: '2026-09-02', merchant: '중앙문구', amount: 32500 });
    expect(draft.warnings).toContain('사용 목적은 직접 입력해야 합니다.');
  });

  test('텍스트 PDF의 영문 TOTAL도 읽는다', () => {
    const draft = parseReceiptText('CENTRAL STATIONERY\nDATE 2026-09-02\nSUBTOTAL 30,000\nTAX 2,500\nTOTAL 32,500', 'pdf-text');
    expect(draft).toMatchObject({ spentAt: '2026-09-02', merchant: 'CENTRAL STATIONERY', amount: 32500 });
  });

  test('찾지 못한 값은 임의 생성하지 않고 경고한다', () => {
    const draft = parseReceiptText('영수증\n감사합니다', 'browser-ocr', 0.5);
    expect(draft.spentAt).toBe('');
    expect(draft.amount).toBeNull();
    expect(draft.warnings).toContain('결제 금액을 찾지 못했습니다.');
  });

  test('합계 표식 없는 긴 숫자와 깨진 OCR 문자열을 금액·사용처로 확정하지 않는다', () => {
    const draft = parseReceiptText('( a Pe eB ar BT 아아아 aie a\n28018788\n승인번호 118822', 'browser-ocr', 0.4);
    expect(draft.merchant).toBe('');
    expect(draft.amount).toBeNull();
  });
});
