import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';

const resetDemo = async (page: Page, path: string) => {
  await page.goto(path);
  await page.evaluate(() => {
    localStorage.removeItem('schooldoc_registry_v1');
    sessionStorage.clear();
  });
  await page.reload();
};

const expectNoHorizontalOverflow = async (page: Page) => {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
};

const expectNoAxeViolations = async (page: Page, include: string) => {
  const results = await new AxeBuilder({ page })
    .include(include)
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations, results.violations.map((violation) => (
    `${violation.id}: ${violation.help} (${violation.nodes.length})`
  )).join('\n')).toEqual([]);
};

test('360·768·1440px 등록부 화면에 넘침과 주요 접근성 위반이 없다', async ({ page }, testInfo: TestInfo) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetDemo(page, '/tools/registry-sign');
  await expect(page.getByRole('heading', { name: '등록부 서명' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectNoAxeViolations(page, 'main');
  await testInfo.attach('registry-list-360', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.getByRole('button', { name: /2026 교직원 디지털 역량 강화 연수 등록부 열기/ }).click();
  await expect(page.getByRole('heading', { name: '참석자 명단' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectNoAxeViolations(page, 'main');
  await testInfo.attach('registry-manage-768', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await expectNoHorizontalOverflow(page);
  await expectNoAxeViolations(page, 'main');
  await testInfo.attach('registry-manage-1440', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });

  await page.setViewportSize({ width: 360, height: 800 });
  await resetDemo(page, '/s/registry/demo-digital-training-2026');
  await expect(page.getByRole('heading', { name: '내 이름 찾기' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectNoAxeViolations(page, 'main');
  await testInfo.attach('registry-public-360', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
});

test('서명 대화상자가 키보드 포커스를 고정하고 닫은 뒤 선택 버튼으로 돌려보낸다', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await resetDemo(page, '/s/registry/demo-digital-training-2026');
  await page.getByLabel('이름 또는 소속 검색').fill('김하늘');
  const participantButton = page.getByRole('button', { name: /김\*늘.*선택/ });
  await participantButton.focus();
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog', { name: '김하늘님 서명' });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('button', { name: '서명 창 닫기' })).toBeFocused();
  await expectNoAxeViolations(page, '[role="dialog"]');

  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }

  const drawTab = page.getByRole('tab', { name: '직접 서명' });
  await drawTab.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: '사진 촬영' })).toBeFocused();
  await expect(page.getByRole('tabpanel', { name: '사진 촬영' })).toBeVisible();
  await page.keyboard.press('Home');
  await expect(drawTab).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(participantButton).toBeFocused();
});

test('삭제 확인창은 안전한 취소 버튼에 초점을 두고 Escape 후 원래 버튼으로 복귀한다', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await resetDemo(page, '/tools/registry-sign');
  const deleteButton = page.getByRole('button', { name: /2026 교직원 디지털 역량 강화 연수 삭제/ });
  await deleteButton.focus();
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('alertdialog', { name: '등록부를 삭제할까요?' });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('button', { name: '취소' })).toBeFocused();
  await expectNoAxeViolations(page, '[role="alertdialog"]');

  for (let index = 0; index < 6; index += 1) {
    await page.keyboard.press(index % 2 === 0 ? 'Tab' : 'Shift+Tab');
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(deleteButton).toBeFocused();
});
