import { describe, expect, it } from 'vitest';
import { parseConsentRecipientRows } from '../../src/features/consentForms/consentRecipientImport';

describe('가정통신문 수신자 명단 파싱', () => {
  it('제목 행 뒤의 헤더를 찾아 열 순서와 무관하게 이름과 식별값을 매핑한다', () => {
    const result = parseConsentRecipientRows([
      ['2026학년도 현장체험학습 대상자 명단'],
      [],
      ['연번', '학번', '비고', '성명'],
      [1, '30201', '', '김하늘'],
      [2, '30202', '', '이도윤'],
    ]);

    expect(result.recipients).toEqual([
      { name: '김하늘', identifier: '30201' },
      { name: '이도윤', identifier: '30202' },
    ]);
    expect(result.mappingLabel).toContain('성명 → 이름');
  });

  it('학년, 반, 번호처럼 여러 식별 열을 순서대로 합친다', () => {
    const result = parseConsentRecipientRows([
      ['학생 이름', '학년', '반', '번호'],
      ['박서연', 3, 2, 7],
    ]);

    expect(result.recipients).toEqual([{ name: '박서연', identifier: '3 · 2 · 7' }]);
  });

  it('반복 헤더와 중복 행은 수신자에서 제외한다', () => {
    const result = parseConsentRecipientRows([
      ['이름', '학번'],
      ['김하늘', '30101'],
      ['이름', '학번'],
      ['김하늘', '30101'],
    ]);

    expect(result.recipients).toEqual([{ name: '김하늘', identifier: '30101' }]);
  });

  it('성명 헤더를 찾지 못하면 무관한 첫 열이 아니라 이름 형태가 많은 열을 선택한다', () => {
    const result = parseConsentRecipientRows([
      [1, '30201', '김하늘'],
      [2, '30202', '이도윤'],
      [3, '30203', '박서연'],
    ]);

    expect(result.recipients.map((recipient) => recipient.name)).toEqual(['김하늘', '이도윤', '박서연']);
    expect(result.warnings).toHaveLength(1);
  });
});
