import { createPayloadCrypto } from './payloadCrypto.ts';

/** 이름·파일명·전달 사항은 자료 수합 전용 키로만 함수 안에서 봉인한다. */
export const dataCollectCrypto = createPayloadCrypto(
  'DATA_COLLECT_ENCRYPTION_KEY',
  '자료 수합 암호화 키가 설정되지 않았습니다.',
);

export interface DataCollectIdentity {
  label: string;
  owner: string;
}
