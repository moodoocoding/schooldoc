import { createPayloadCrypto } from './payloadCrypto.ts';

/**
 * 등록부 참석자의 항목 값(소속·직위 등)을 봉인한다.
 *
 * 이름은 평문으로 둔다. 참석자가 행사장에서 두 글자만 넣어 자기를 찾는 흐름을 지켜야 하고,
 * 암호문에는 부분 검색이 통하지 않기 때문이다. 대신 이름 옆에 붙어 신원을 좁히는 항목 값은
 * 서버만 풀 수 있게 한다.
 *
 * 키를 잃으면 이미 저장된 항목 값을 두 번 다시 읽을 수 없다. 키 교체는 재암호화를 함께
 * 해야 한다.
 */
export const registryCrypto = createPayloadCrypto(
  'REGISTRY_ENCRYPTION_KEY',
  'Registry field value encryption is not configured.',
);

export type RegistryFieldValues = Record<string, string>;
