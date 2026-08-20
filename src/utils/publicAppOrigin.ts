/**
 * 인쇄물과 QR에 실을 공개 주소를 정한다.
 *
 * 접속한 주소를 그대로 쓰면 로컬에서 만든 QR이 127.0.0.1을 가리켜, 인쇄해 나눠 준 뒤에야
 * 열리지 않는다는 것을 알게 된다. 가정통신문에서 실제로 겪은 문제라 학생 결과 안내도 같은
 * 규칙을 쓰도록 여기로 옮겼다.
 */
const DEFAULT_PUBLIC_APP_ORIGIN = 'https://schooldoc-nine.vercel.app';

export const getPublicAppOrigin = (
  origin = window.location.origin,
  hostname = window.location.hostname,
) => {
  const configuredOrigin = import.meta.env.VITE_PUBLIC_APP_URL?.trim().replace(/\/+$/, '');
  if (configuredOrigin) return configuredOrigin;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return DEFAULT_PUBLIC_APP_ORIGIN;
  return origin.replace(/\/+$/, '');
};
