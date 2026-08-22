import { expect, test } from '@playwright/test';

const createBoard = async (page: import('@playwright/test').Page, title: string) => {
  await page.goto('/tools/special-rooms/new');
  await page.evaluate(() => localStorage.removeItem('schooldoc_special_rooms_v1'));
  await page.reload();
  await page.getByLabel('예약판 이름').fill(title);
  await page.getByLabel('1번 특별실 이름').fill('과학실');
  await page.getByLabel('1번 특별실 위치').fill('본관 3층');
  await page.getByRole('button', { name: '특별실 추가' }).click();
  await page.getByLabel('2번 특별실 이름').fill('음악실');
  await page.getByRole('button', { name: '예약판 만들기' }).click();
  await expect(page).toHaveURL(/\/tools\/special-rooms\/[0-9a-f-]+$/);
  return page.getByLabel('예약 링크 주소').inputValue();
};

test('예약판을 만들고 링크로 들어가 시간표에서 예약한다', async ({ page }) => {
  const link = await createBoard(page, '2학기 특별실 예약');
  expect(link).toContain('/s/rooms/');

  await page.goto(link);
  await expect(page.getByRole('heading', { name: '2학기 특별실 예약' })).toBeVisible();

  // 월~금 다섯 날 × 1~8교시 표가 나온다.
  await expect(page.getByRole('columnheader', { name: /월/ })).toBeVisible();
  await expect(page.getByRole('rowheader', { name: '8교시' })).toBeVisible();
  await expect(page.getByRole('rowheader')).toHaveCount(8);

  // 빈 칸을 눌러 그 자리에서 입력한다.
  const cells = page.getByRole('button', { name: /교시 예약하기$/ });
  const firstCell = cells.first();
  const cellName = await firstCell.getAttribute('aria-label');
  await firstCell.click();
  await page.getByRole('textbox', { name: /사용 내용$/ }).fill('6-1반');
  await page.keyboard.press('Enter');

  await expect(page.getByRole('button', { name: /6-1반 고치기$/ })).toBeVisible();
  expect(cellName).toContain('1교시');
});

test('같은 칸을 다시 눌러 내용을 고치고, 비우면 예약이 취소된다', async ({ page }) => {
  const link = await createBoard(page, '고치기 확인');
  await page.goto(link);

  await page.getByRole('button', { name: /교시 예약하기$/ }).first().click();
  await page.getByRole('textbox', { name: /사용 내용$/ }).fill('6-1반');
  await page.keyboard.press('Enter');

  const booked = page.getByRole('button', { name: /6-1반 고치기$/ });
  await expect(booked).toBeVisible();

  // 고치기
  await booked.click();
  await page.getByRole('textbox', { name: /사용 내용$/ }).fill('5-3반 과학');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /5-3반 과학 고치기$/ })).toBeVisible();

  // 비우면 취소된다. 별도 삭제 버튼 없이 시트처럼 동작한다.
  await page.getByRole('button', { name: /5-3반 과학 고치기$/ }).click();
  await page.getByRole('textbox', { name: /사용 내용$/ }).fill('');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /5-3반 과학 고치기$/ })).toHaveCount(0);
});

test('특별실마다 예약이 따로 관리된다', async ({ page }) => {
  const link = await createBoard(page, '특별실 구분 확인');
  await page.goto(link);

  // 과학실 1교시를 잡는다.
  await page.getByRole('button', { name: /교시 예약하기$/ }).first().click();
  await page.getByRole('textbox', { name: /사용 내용$/ }).fill('과학실 수업');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /과학실 수업 고치기$/ })).toBeVisible();

  // 음악실로 바꾸면 그 칸은 비어 있어야 한다.
  await page.getByRole('tab', { name: '음악실' }).click();
  await expect(page.getByRole('button', { name: /과학실 수업 고치기$/ })).toHaveCount(0);
});

test('주를 넘기면 다른 주가 나오고 이번 주로 돌아온다', async ({ page }) => {
  const link = await createBoard(page, '주 이동 확인');
  await page.goto(link);

  const thisWeek = await page.getByRole('columnheader', { name: /월/ }).textContent();
  await page.getByRole('button', { name: '다음 주' }).click();
  const nextWeek = await page.getByRole('columnheader', { name: /월/ }).textContent();
  expect(nextWeek).not.toBe(thisWeek);

  await page.getByRole('button', { name: '이번 주' }).click();
  await expect(page.getByRole('columnheader', { name: /월/ })).toHaveText(thisWeek!);
});

test('예약을 종료하면 보기만 되고 칸을 누를 수 없다', async ({ page }) => {
  const link = await createBoard(page, '종료 확인');
  await page.goto(link);
  await page.getByRole('button', { name: /교시 예약하기$/ }).first().click();
  await page.getByRole('textbox', { name: /사용 내용$/ }).fill('6-1반');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /6-1반 고치기$/ })).toBeVisible();

  await page.goBack();
  await page.getByRole('button', { name: '예약 종료' }).click();
  await page.goto(link);

  await expect(page.getByText('예약이 종료되어 보기만 할 수 있습니다')).toBeVisible();
  await expect(page.getByRole('button', { name: /6-1반 고치기$/ })).toBeDisabled();
});

test('예약 링크 QR을 이미지로 저장한다', async ({ page }) => {
  // QR을 그렸다면 언제나 이미지로 받을 수 있어야 한다는 제품 원칙.
  await createBoard(page, 'QR 저장 확인');
  const saveButton = page.getByRole('button', { name: 'QR 이미지 저장' });
  await expect(saveButton).toBeVisible();

  const download = await Promise.all([
    page.waitForEvent('download'),
    saveButton.click(),
  ]).then(([event]) => event);

  expect(download.suggestedFilename()).toBe('QR 저장 확인_예약QR.png');
  const { statSync } = await import('node:fs');
  expect(statSync((await download.path())!).size).toBeGreaterThan(1000);
});
