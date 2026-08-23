import { expect, test } from '@playwright/test';

const openDisplaySettings = async (page: import('@playwright/test').Page) => {
  await page.goto('/');
  await page.locator('button[title="설정"]').click();
  await page.getByRole('button', { name: '화면 및 가독성' }).click();
};

test.describe('환경 설정', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      if (window.sessionStorage.getItem('settings-test-initialized')) return;
      window.localStorage.removeItem('schooldoc_appearance_v1');
      window.sessionStorage.setItem('settings-test-initialized', 'true');
    });
  });

  test('20개 색상 테마를 즉시 적용하고 다시 열어도 유지한다', async ({ page }) => {
    await openDisplaySettings(page);

    await expect(page.getByRole('radio')).toHaveCount(20);
    await page.getByText('오션 틸', { exact: true }).click();

    await expect(page.locator('html')).toHaveAttribute('data-schooldoc-theme', 'ocean-teal');
    await expect.poll(() => page.locator('.schooldoc-admin-shell').evaluate((element) => (
      getComputedStyle(element).backgroundColor
    ))).toBe('rgb(240, 247, 246)');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-schooldoc-theme', 'ocean-teal');
  });

  test('글자 크게가 실제 글자 크기를 키우고 다시 열어도 유지한다', async ({ page }) => {
    await openDisplaySettings(page);
    const heading = page.getByRole('heading', { name: '화면 테마 및 가독성 설정' });
    const normalSize = await heading.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));

    await page.getByRole('button', { name: '크게' }).click();
    const largeSize = await heading.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));

    expect(largeSize).toBeGreaterThan(normalSize);
    await expect(page.locator('html')).toHaveAttribute('data-schooldoc-font-size', 'large');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-schooldoc-font-size', 'large');
  });

  test('좁은 화면에서도 가로로 넘치지 않는다', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await page.goto('/');
    await page.getByRole('button', { name: '사이드바 메뉴 열기' }).click();
    await page.getByRole('button', { name: '설정' }).click();
    await page.getByRole('button', { name: '화면 및 가독성' }).click();

    const widths = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
    }));
    expect(widths.document).toBeLessThanOrEqual(widths.viewport + 1);
  });
});
