import { createPayloadCrypto, normalizePersonName } from './payloadCrypto.ts';

/**
 * 가정통신문 수신자 명단 보호용 키.
 * 학생 결과 안내와 키를 나눠 두어, 한쪽이 노출돼도 다른 쪽 명단은 열리지 않게 한다.
 */
export const consentCrypto = createPayloadCrypto(
  'CONSENT_FORMS_ENCRYPTION_KEY',
  '수신자 명단 암호화 키가 설정되지 않았습니다.',
);

export const normalizeRecipientName = normalizePersonName;

export interface ConsentRecipientIdentity {
  name: string;
  studentKey: string;
}
