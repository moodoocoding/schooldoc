import { invokeConsentAdmin } from './consentAdminApi';

/**
 * 복제는 원본 PDF 복사와 명단 삽입이 필요해 서버에서 수행한다.
 * 명단은 같은 키로 봉인돼 있어 복호 없이 암호문을 그대로 옮긴다.
 */
export const duplicateConsentForm = async (formId: string) => (
  invokeConsentAdmin<{ id: string; title: string; recipientCount: number }>({ action: 'duplicate', formId })
);
