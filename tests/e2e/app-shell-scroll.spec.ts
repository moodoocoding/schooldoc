import { expect, test, type Page } from '@playwright/test';

/**
 * 어느 화면이든 맨 아래까지 내렸을 때 빈 바닥이 드러나면 안 된다.
 *
 * 앱 껍데기를 100vh로 못 박은 채 안쪽 판이 스크롤을 맡고 있으면, 문서가 조금이라도
 * 밀리는 순간 껍데기 아래로 `body`의 흰 배경이 나온다. 학생 결과와 특별실 화면에서
 * 실제로 194px짜리 흰 여백이 생겼다. 원인은 화면마다 다를 수 있으니 클래스 이름 대신
 * 증상을 직접 잰다. `tests/unit/scrollContainersAreDeliberate.test.ts`가 알려진
 * 원인을 막고, 여기서는 결과를 막는다.
 *
 * 좁은 창에서 재는 이유는 표가 가로로 넘쳐야 문제가 드러나기 때문이다.
 */
const SHELL_ROUTES = [
  ['등록부', '/tools/registry'],
  ['학생 결과 안내', '/tools/student-results/new'],
  ['가정통신문 동의서', '/tools/consent-forms'],
  ['특별실 예약', '/tools/special-rooms/new'],
  ['자료 수합', '/tools/data-collect'],
  ['학급 운영비 영수증', '/tools/receipts/new'],
] as const;

const measureBottom = async (page: Page) => page.evaluate(() => {
  window.scrollTo(0, document.documentElement.scrollHeight);
  const shell = document.getElementById('root')?.firstElementChild;
  const bottom = shell ? shell.getBoundingClientRect().bottom : 0;
  return {
    // 껍데기 바닥이 창 바닥에 닿아 있어야 한다. 모자란 만큼이 흰 여백이다.
    gap: Math.round(window.innerHeight - bottom),
    scrollY: Math.round(window.scrollY),
    innerHeight: window.innerHeight,
  };
});

test.describe('앱 껍데기 스크롤', () => {
  test.use({ viewport: { width: 900, height: 700 } });

  for (const [label, path] of SHELL_ROUTES) {
    test(`${label} 화면을 맨 아래까지 내려도 빈 바닥이 없다`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      const measured = await measureBottom(page);
      expect(measured.gap, `${label}: 껍데기 아래에 ${measured.gap}px가 비었다`).toBeLessThanOrEqual(1);
    });
  }

  test('세로 스크롤을 맡는 곳은 문서 하나뿐이다', async ({ page }) => {
    await page.goto('/tools/student-results/new');
    await page.waitForLoadState('networkidle');

    const nested = await page.evaluate(() => {
      const shell = document.getElementById('root')?.firstElementChild;
      if (!shell) return ['껍데기를 찾지 못했다'];
      // 사이드바 메뉴처럼 제 안을 굴리도록 만든 것은 세로 축을 직접 적어 뒀다.
      return [...shell.querySelectorAll('main, main *')]
        .filter((element) => {
          const style = getComputedStyle(element);
          const scrolls = style.overflowY === 'auto' || style.overflowY === 'scroll';
          const declared = element.className.toString().includes('overflow-y');
          return scrolls && !declared && element.scrollHeight > element.clientHeight + 1;
        })
        .map((element) => `${element.tagName}.${element.className.toString().slice(0, 60)}`);
    });

    expect(nested, '적지도 않은 세로 스크롤이 생겼다').toEqual([]);
  });

  test('사이드바는 내려도 따라 붙는다', async ({ page }) => {
    await page.goto('/tools/student-results/new');
    await page.waitForLoadState('networkidle');

    const sidebarTop = await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
      const aside = document.querySelector('aside');
      return aside ? Math.round(aside.getBoundingClientRect().top) : null;
    });

    expect(sidebarTop).toBe(0);
  });
});
