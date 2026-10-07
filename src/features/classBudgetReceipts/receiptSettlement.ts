import { activeReceiptEntries } from './receiptBookUtils';
import type { ReceiptBook } from './types';

export const RECEIPT_SETTLEMENT_HEADERS = ['사용일자', '사용업체명', '사용금액', '증빙구분', '사용내역'] as const;
export const RECEIPT_EVIDENCE_TYPE = '전산자료';

/** 화면과 Excel이 같은 확정 지출·열 순서를 사용한다. 초안과 휴지통은 제외한다. */
export const buildReceiptSettlementRows = (book: ReceiptBook) => activeReceiptEntries(book).slice().reverse().map((entry) => ({
  id: entry.id,
  spentAt: entry.spentAt,
  merchant: entry.merchant,
  amount: entry.amount,
  evidenceType: RECEIPT_EVIDENCE_TYPE,
  purpose: entry.purpose,
  evidenceFileIds: entry.evidenceFileIds,
}));
