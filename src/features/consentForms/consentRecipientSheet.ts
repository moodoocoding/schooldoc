import type { ConsentRecipientRecord } from './types';

/** A4 한 장에 넣을 인원. 2열 4행 배치와 맞춘 값이다. */
export const RECIPIENTS_PER_SHEET = 8;

/** 마지막 쪽이 비더라도 최소 한 쪽은 만들어 빈 상태를 그릴 수 있게 한다. */
export const paginateRecipients = <T,>(items: T[], size = RECIPIENTS_PER_SHEET) => Array.from(
  { length: Math.max(1, Math.ceil(items.length / size)) },
  (_, index) => items.slice(index * size, index * size + size),
);

/** 보호자마다 다른 주소. 공용 링크에 수신자 토큰을 붙여 누가 냈는지 이어붙인다. */
export const consentPersonalLink = (origin: string, publicToken: string, recipientToken: string) => (
  `${origin.replace(/\/+$/, '')}/s/consent/${publicToken}?r=${recipientToken}`
);

export const consentQrSheetFileName = (title: string) => (
  `${title.replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 60) || '가정통신문'}_개인QR.pdf`
);

export const countSubmitted = (recipients: ConsentRecipientRecord[]) => (
  recipients.filter((recipient) => recipient.submittedAt).length
);

export type ConsentRecipientFilter = 'all' | 'submitted' | 'pending';

/** 명단이 길어지면 목록만으로는 독촉 대상을 못 찾는다. 상태와 이름·식별값으로 추린다. */
export const filterRecipients = (
  recipients: ConsentRecipientRecord[],
  filter: ConsentRecipientFilter,
  query: string,
) => {
  const keyword = query.trim();
  return recipients.filter((recipient) => {
    if (filter === 'submitted' && !recipient.submittedAt) return false;
    if (filter === 'pending' && recipient.submittedAt) return false;
    return !keyword || recipient.name.includes(keyword) || recipient.studentKey.includes(keyword);
  });
};
