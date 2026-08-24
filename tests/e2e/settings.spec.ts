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

  test('전자 서명과 도장 등록은 개발 중임을 명확히 알린다', async ({ page }) => {
    await page.goto('/');
    await page.locator('button[title="설정"]').click();
    await page.getByRole('button', { name: '전자 서명 & 도장' }).click();

    await expect(page.getByRole('heading', { name: '전자서명 및 도장 등록' })).toBeVisible();
    await expect(page.getByText('현재는 다른 기능에 연결되지 않습니다.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'PNG 이미지 업로드 · 개발 중' })).toBeDisabled();
    await expect(page.getByRole('button', { name: '캔버스 서명 작성 · 개발 중' })).toBeDisabled();
  });

  test('개인정보 설정은 자동 삭제가 아닌 종료 후 확인 파기 흐름을 안내한다', async ({ page }) => {
    await page.goto('/');
    await page.locator('button[title="설정"]').click();
    await page.getByRole('button', { name: '알림 & 개인정보 보안' }).click();

    await expect(page.getByRole('heading', { name: '개인정보 보관 및 파기 정책' })).toBeVisible();
    await expect(page.getByText('교사 확인 후 파기', { exact: true })).toBeVisible();
    await expect(page.getByText(/진행 중인 업무는 지우지 않습니다/)).toBeVisible();
    await expect(page.getByText('파기 예정 자료', { exact: true })).toBeVisible();
    await expect(page.getByText(/자동.*파기/)).toHaveCount(0);
  });

  test('종료 후 보관기간이 지난 수합은 확인을 거쳐 영구 파기한다', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('schooldoc:consent-forms:drafts', JSON.stringify([{
        id: 'expired-consent',
        title: '지난 동의서',
        fileName: '동의서.pdf',
        fieldCount: 1,
        recipientMode: 'open',
        recipientCount: 0,
        createdAt: '2025-01-01T00:00:00.000Z',
        closedAt: '2025-02-01T00:00:00.000Z',
        description: '',
        fields: [],
        publicToken: 'expired-token',
        deadline: '',
        passwordEnabled: false,
        passwordHash: '',
        allowResubmission: false,
        responseCount: 2,
        status: 'closed',
        retentionMonths: 1,
        sourcePdfDataUrl: 'data:application/pdf;base64,AAAA',
      }]));
    });
    await page.goto('/');
    await page.locator('button[title="설정"]').click();
    await page.getByRole('button', { name: '알림 & 개인정보 보안' }).click();

    await expect(page.getByText('지난 동의서')).toBeVisible();
    await expect(page.getByText('파기 확인 필요', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '영구 파기' }).click();
    const confirm = page.getByRole('alertdialog');
    await expect(confirm).toContainText('복구할 수 없습니다');
    await confirm.getByRole('button', { name: '영구 파기' }).click();

    await expect(page.getByText('지난 동의서')).toHaveCount(0);
    await expect(page.getByRole('status')).toContainText('영구 파기했습니다');
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('schooldoc:consent-forms:drafts') ?? '[]').length)).toBe(0);
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
