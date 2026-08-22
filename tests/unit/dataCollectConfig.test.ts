import { describe, expect, it } from 'vitest';
import { isDataCollectDeveloper } from '../../src/features/dataCollect/dataCollectConfig';

describe('자료 수합 개발자 미리보기 계정', () => {
  it('지정된 Google 계정만 허용한다', () => {
    expect(isDataCollectDeveloper({ email: 'panthea0@gmail.com' })).toBe(true);
    expect(isDataCollectDeveloper({ email: 'PANTHEA0@GMAIL.COM ' })).toBe(true);
    expect(isDataCollectDeveloper({ email: 'other@example.com' })).toBe(false);
    expect(isDataCollectDeveloper(null)).toBe(false);
    expect(isDataCollectDeveloper()).toBe(false);
  });
});
