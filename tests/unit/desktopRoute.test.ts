import { describe, expect, test } from 'vitest';
import { appRoute } from '../../src/utils/desktop';
import { getPublicAppOrigin } from '../../src/utils/publicAppOrigin';

describe('포터블 경로와 배부 주소', () => {
  test('HashRouter에서 미션 검색값과 저장 전 이동 경로를 읽는다', () => {
    const route = appRoute(new URL('schooldoc://app/#/tools/class-missions?board=board1&mission=mission1'));
    expect(route.pathname).toBe('/tools/class-missions');
    expect(route.searchParams.get('board')).toBe('board1');
    expect(route.searchParams.get('mission')).toBe('mission1');
    expect(appRoute(new URL('schooldoc://app/#/tools/classroom-roles/assign')).pathname)
      .not.toBe(appRoute(new URL('schooldoc://app/#/tools/classroom-roles/records')).pathname);
  });
  test('웹과 EXE에서 학생에게 배부할 주소는 웹 주소다', () => {
    expect(getPublicAppOrigin('schooldoc://app', 'app')).toBe('https://schooldoc-nine.vercel.app');
    expect(getPublicAppOrigin('null', '')).toBe('https://schooldoc-nine.vercel.app');
    const web = new URL('https://school.example/tools/class-missions?board=a');
    expect(appRoute(web)).toBe(web);
    expect(getPublicAppOrigin(web.origin, web.hostname)).toBe('https://school.example');
  });
});
