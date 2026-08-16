/**
 * 개인정보를 담은 payload를 봉인·해제하는 공용 도구.
 * 기능마다 별도의 비밀 키를 쓰되 방식은 같게 두려고 분리했다.
 *
 * - 본문은 AES-GCM으로 암호화해 소유자 확인을 거친 함수만 풀 수 있게 한다.
 * - 이름은 조회가 필요하므로 결정적 HMAC 색인을 따로 만든다.
 */
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const bytesToBase64Url = (bytes: Uint8Array) => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
};

const base64UrlToBytes = (value: string) => {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

export const normalizePersonName = (value: string) => (
  value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ko-KR')
);

export const createPayloadCrypto = (secretEnvName: string, missingMessage: string) => {
  const secretBytes = () => {
    const secret = Deno.env.get(secretEnvName);
    if (!secret || !/^[0-9a-f]{64}$/i.test(secret)) throw new Error(missingMessage);
    return Uint8Array.from(secret.match(/.{2}/g) ?? [], (part) => Number.parseInt(part, 16));
  };

  const encryptionKey = () => crypto.subtle.importKey('raw', secretBytes(), 'AES-GCM', false, ['encrypt', 'decrypt']);
  const hmacKey = () => crypto.subtle.importKey('raw', secretBytes(), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);

  return {
    isConfigured: () => {
      try {
        secretBytes();
        return true;
      } catch {
        return false;
      }
    },
    nameLookup: async (name: string) => {
      const signature = await crypto.subtle.sign('HMAC', await hmacKey(), encoder.encode(normalizePersonName(name)));
      return bytesToBase64Url(new Uint8Array(signature));
    },
    encryptPayload: async (value: unknown) => {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await encryptionKey(), encoder.encode(JSON.stringify(value)));
      return `${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(encrypted))}`;
    },
    decryptPayload: async <T>(value: string): Promise<T> => {
      const [ivValue, encryptedValue] = value.split('.');
      if (!ivValue || !encryptedValue) throw new Error('Encrypted payload is invalid.');
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: base64UrlToBytes(ivValue) },
        await encryptionKey(),
        base64UrlToBytes(encryptedValue),
      );
      return JSON.parse(decoder.decode(decrypted)) as T;
    },
  };
};
