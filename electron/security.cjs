const path = require('node:path');

const APP_ORIGIN = 'schooldoc://app';

function isAppUrl(value) {
  try { const url = new URL(value); return url.protocol === 'schooldoc:' && url.host === 'app'; }
  catch { return false; }
}

function isExternalUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}

function assetPath(root, value) {
  if (!isAppUrl(value)) return null;
  try {
    const pathname = decodeURIComponent(new URL(value).pathname);
    if (pathname.includes('\\') || pathname.includes('\0')) return null;
    const file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    const relative = path.relative(root, file);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null;
    return file;
  } catch { return null; }
}

function assertAuthUrl(value, supabaseUrl, redirectUrl) {
  const url = new URL(value);
  if (url.origin !== new URL(supabaseUrl).origin || url.pathname !== '/auth/v1/authorize'
    || url.searchParams.get('provider') !== 'google'
    || url.searchParams.get('redirect_to') !== redirectUrl
    || url.searchParams.get('code_challenge_method')?.toLowerCase() !== 's256'
    || !/^[A-Za-z0-9_-]{43}$/.test(url.searchParams.get('code_challenge') ?? '')
    || url.username || url.password) throw new Error('LOGIN_URL_INVALID');
  return url.toString();
}

module.exports = { APP_ORIGIN, isAppUrl, isExternalUrl, assetPath, assertAuthUrl };
