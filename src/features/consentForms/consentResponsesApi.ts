import { invokeConsentAdmin } from './consentAdminApi';
import type { ConsentResponseRecord } from './types';

/**
 * 응답 본문은 암호문으로 저장되므로 교사도 DB에서 직접 읽지 않는다.
 * 소유자를 확인한 관리 함수가 복호해서 돌려준다. 서명은 비공개 버킷에 그대로 두고
 * 짧은 열람 주소만 함께 실려 온다.
 */
export const listConsentResponses = async (formId: string) => (
  await invokeConsentAdmin<{ responses: ConsentResponseRecord[] }>({ action: 'responses', formId })
).responses;
