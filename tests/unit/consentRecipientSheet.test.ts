import { describe, expect, it } from 'vitest';
import {
  RECIPIENTS_PER_SHEET,
  consentPersonalLink,
  consentQrSheetFileName,
  countSubmitted,
  paginateRecipients,
} from '../../src/features/consentForms/consentRecipientSheet';
import type { ConsentRecipientRecord } from '../../src/features/consentForms/types';

const recipient = (id: string, submittedAt: string | null): ConsentRecipientRecord => ({
  id, token: `token-${id}`, name: `학생${id}`, studentKey: id, responseId: submittedAt ? `r-${id}` : null, submittedAt,
});

describe('개인 QR 배부 자료', () => {
  it('쪽당 인원만큼 나누고 마지막 쪽에 남은 인원만 담는다', () => {
    const people = Array.from({ length: RECIPIENTS_PER_SHEET + 3 }, (_, index) => index);
    const pages = paginateRecipients(people);

    expect(pages).toHaveLength(2);
    expect(pages[0]).toHaveLength(RECIPIENTS_PER_SHEET);
    expect(pages[1]).toHaveLength(3);
    expect(pages.flat()).toEqual(people);
  });

  it('명단이 비어도 빈 상태를 그릴 수 있게 한 쪽은 만든다', () => {
    expect(paginateRecipients([])).toEqual([[]]);
  });

  it('보호자마다 다른 주소를 만든다', () => {
    const link = consentPersonalLink('https://schooldoc.example.com/', 'public-token', 'recipient-token');
    expect(link).toBe('https://schooldoc.example.com/s/consent/public-token?r=recipient-token');

    const other = consentPersonalLink('https://schooldoc.example.com', 'public-token', 'another-token');
    expect(other).not.toBe(link);
  });

  it('파일 이름에서 경로 문자를 제거한다', () => {
    expect(consentQrSheetFileName('현장체험학습 동의서')).toBe('현장체험학습 동의서_개인QR.pdf');
    expect(consentQrSheetFileName('1/2학기: 안내')).toBe('1_2학기_ 안내_개인QR.pdf');
    expect(consentQrSheetFileName('   ')).toBe('가정통신문_개인QR.pdf');
  });

  it('제출한 사람만 센다', () => {
    const people = [recipient('1', '2026-08-16T00:00:00.000Z'), recipient('2', null), recipient('3', '2026-08-16T01:00:00.000Z')];
    expect(countSubmitted(people)).toBe(2);
    expect(countSubmitted([])).toBe(0);
  });
});
