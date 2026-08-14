export const isConsentFormsDemoMode = (
  import.meta.env.DEV
  && import.meta.env.VITE_CONSENT_FORMS_DEMO_MODE === 'true'
);

const DEFAULT_PUBLIC_APP_ORIGIN = 'https://schooldoc-nine.vercel.app';

export const getConsentPublicOrigin = (
  origin = window.location.origin,
  hostname = window.location.hostname,
) => {
  const configuredOrigin = import.meta.env.VITE_PUBLIC_APP_URL?.trim().replace(/\/+$/, '');
  if (configuredOrigin) return configuredOrigin;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return DEFAULT_PUBLIC_APP_ORIGIN;
  return origin.replace(/\/+$/, '');
};
