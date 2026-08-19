import { describe, expect, test } from 'vitest';
import { getConsentPublicOrigin } from '../../src/features/consentForms/consentFormsConfig';
import { getStudentResultsPublicOrigin } from '../../src/features/studentResults/studentResultsConfig';
import { getPublicAppOrigin } from '../../src/utils/publicAppOrigin';

/**
 * 인쇄해서 나눠 준 QR은 고칠 수 없다. 로컬에서 만든 자료가 127.0.0.1을 가리키면
 * 배부한 뒤에야 알게 되므로, 두 기능이 같은 규칙을 쓰는지 여기서 고정한다.
 */
describe('배부물에 실을 공개 주소', () => {
  test('로컬에서 만들어도 배포된 주소를 가리킨다', () => {
    expect(getPublicAppOrigin('http://127.0.0.1:5176', '127.0.0.1'))
      .toBe('https://schooldoc-nine.vercel.app');
    expect(getPublicAppOrigin('http://localhost:4173', 'localhost'))
      .toBe('https://schooldoc-nine.vercel.app');
  });

  test('배포된 도메인에서는 접속한 주소를 그대로 쓰고 끝의 빗금은 뗀다', () => {
    expect(getPublicAppOrigin('https://schooldoc.example.com/', 'schooldoc.example.com'))
      .toBe('https://schooldoc.example.com');
  });

  test('가정통신문과 학생 결과 안내가 같은 규칙을 쓴다', () => {
    const cases: [string, string][] = [
      ['http://127.0.0.1:5176', '127.0.0.1'],
      ['http://localhost:4173', 'localhost'],
      ['https://schooldoc.example.com/', 'schooldoc.example.com'],
    ];
    cases.forEach(([origin, hostname]) => {
      expect(getStudentResultsPublicOrigin(origin, hostname))
        .toBe(getConsentPublicOrigin(origin, hostname));
    });
  });
});
