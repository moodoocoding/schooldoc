import { invokeConsentAdmin, isConsentAdminUnavailable } from './consentAdminApi';
import type { ConsentRecipientRecord } from './types';

/**
 * 명단은 평문으로 오가면 안 되므로 전용 Edge Function을 통해서만 다룬다.
 * 아직 배포·설정이 안 된 환경에서도 공용 링크 수합은 그대로 쓸 수 있어야 하므로,
 * 명단 기능이 준비되지 않은 경우는 오류가 아니라 '사용 불가'로 구분해 돌려준다.
 */
export const replaceConsentRecipients = async (
  formId: string,
  recipients: Array<{ name: string; studentKey: string }>,
) => (await invokeConsentAdmin<{ saved: number }>({ action: 'replace', formId, recipients })).saved;

export const listConsentRecipients = async (formId: string) => (
  await invokeConsentAdmin<{ recipients: ConsentRecipientRecord[] }>({ action: 'list', formId })
).recipients;

export const isRecipientsUnavailable = isConsentAdminUnavailable;
