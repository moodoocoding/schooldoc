import { expect, test } from '@playwright/test';

test.describe('사이드바 사용자 메뉴', () => {
  test('홈 상단의 계정 버튼을 제거하고 사이드바에서 계정 상태를 보여준다', async ({ page }) => {
    await page.goto('/');

    const main = page.locator('main');
    await expect(main.getByRole('button', { name: '로그아웃' })).toHaveCount(0);
    await expect(main.getByRole('button', { name: 'Google 로그인' })).toHaveCount(0);

    const accountEntry = page.getByRole('button', { name: /^(?:사용자 메뉴:|Google 로그인)/ });
    await expect(accountEntry).toBeVisible();

    const accountLabel = await accountEntry.getAttribute('aria-label');
    if (accountLabel?.startsWith('사용자 메뉴:')) {
      await accountEntry.click();
      await expect(page.getByRole('button', { name: '프로필 및 설정' })).toBeVisible();
      await expect(page.getByRole('button', { name: '로그아웃' })).toBeVisible();

      await page.getByRole('button', { name: '프로필 및 설정' }).click();
      await expect(page.getByRole('heading', { name: '스쿨독 환경 설정' })).toBeVisible();
    }
  });

  test('모바일 메뉴에서도 알림 바로 아래에 사용자 진입점이 보인다', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await page.goto('/');
    await page.getByRole('button', { name: '사이드바 메뉴 열기' }).click();

    const notificationButton = page.getByRole('button', { name: '알림', exact: true });
    const accountEntry = page.getByRole('button', { name: /^(?:사용자 메뉴:|Google 로그인)/ });
    await expect(notificationButton).toBeVisible();
    await expect(accountEntry).toBeVisible();

    const isAccountAfterNotification = await page.locator('aside, .fixed').evaluateAll((containers) => {
      const container = containers.find((element) => element.querySelector('[aria-label="알림"]'));
      const notification = container?.querySelector('[aria-label="알림"]');
      const account = container?.querySelector('[aria-label^="사용자 메뉴:"], [aria-label="Google 로그인"]');
      if (!notification || !account) return false;
      return Boolean(notification.compareDocumentPosition(account) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(isAccountAfterNotification).toBe(true);
  });
});
