import { describe, expect, it } from 'vitest';
import { getConsentPublicOrigin } from '../../src/features/consentForms/consentFormsConfig';

describe('getConsentPublicOrigin', () => {
  it('uses the production app for localhost share links', () => {
    expect(getConsentPublicOrigin('http://127.0.0.1:5176', '127.0.0.1'))
      .toBe('https://schooldoc-nine.vercel.app');
    expect(getConsentPublicOrigin('http://localhost:5176', 'localhost'))
      .toBe('https://schooldoc-nine.vercel.app');
  });

  it('keeps the current origin on a deployed domain', () => {
    expect(getConsentPublicOrigin('https://schooldoc.example.com/', 'schooldoc.example.com'))
      .toBe('https://schooldoc.example.com');
  });
});
