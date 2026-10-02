import { expect, type Page } from '@playwright/test';

/** 시험 문서는 가상 원본이다. 필드의 자동 임시 좌표를 실제 배치로 간주하지 않는다. */
export async function finishConsentFieldPlacement(page: Page) {
  const pageInput = page.getByLabel('쪽 번호');
  const pageCount = Number(await pageInput.getAttribute('max'));
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    await pageInput.fill(String(pageNumber));
    await expect(page.getByTestId('consent-field-canvas').locator('[data-pdf-state="ready"]')).toBeVisible();
  }
  const settings = page.getByTestId('consent-field-settings');
  const pending = settings.getByRole('button').filter({ hasText: '배치 필요' });
  let index = 0;
  while (await pending.count()) {
    await pending.first().click();
    if (!await settings.getByLabel('가로 위치', { exact: true }).isVisible()) {
      await settings.getByText('크기와 위치').click();
    }
    const x = index % 2 === 0 ? 10 : 60;
    const y = 60 + Math.floor(index / 2) * 15;
    await settings.getByLabel('가로 위치', { exact: true }).fill(String(x));
    await settings.getByLabel('세로 위치', { exact: true }).fill(String(y));
    index += 1;
    if (index > 30) throw new Error('시험 필드의 위치 확인이 끝나지 않았습니다.');
  }
  await expect(page.getByRole('button', { name: '필드 배치 완료' })).toBeEnabled();
  await page.getByRole('button', { name: '필드 배치 완료' }).click();
}

export async function confirmConsentPlacementPreview(page: Page) {
  const checkbox = page.getByRole('checkbox', { name: '원본의 입력칸과 회색 표시 위치를 확인했습니다.' });
  await expect(checkbox).toBeEnabled();
  await checkbox.check();
  await expect(page.getByRole('button', { name: '수합 만들기' })).toBeEnabled();
}
