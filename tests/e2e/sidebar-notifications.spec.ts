import { expect, test } from '@playwright/test';

test.describe('사이드바 알림', () => {
  test('홈 상단 대신 사이드바에서 열고 개발 중임을 정확히 알린다', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('main').getByRole('button', { name: '알림 목록' })).toHaveCount(0);
    const notificationButton = page.getByRole('button', { name: '알림', exact: true });
    await notificationButton.click();

    const dialog = page.getByRole('dialog', { name: '알림 기능을 개발하고 있습니다' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('현재는 알림을 보내거나 저장하지 않습니다.');
    await expect(dialog.getByRole('button', { name: '확인' })).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(notificationButton).toBeFocused();
  });

  test('모바일 사이드바에서 알림을 열면 메뉴를 닫고 대화상자만 보여준다', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await page.goto('/');
    await page.getByRole('button', { name: '사이드바 메뉴 열기' }).click();
    await page.getByRole('button', { name: '알림', exact: true }).click();

    await expect(page.getByRole('dialog', { name: '알림 기능을 개발하고 있습니다' })).toBeVisible();
    await expect(page.getByRole('navigation')).toHaveCount(0);

    const widths = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
    }));
    expect(widths.document).toBeLessThanOrEqual(widths.viewport + 1);
  });
});
