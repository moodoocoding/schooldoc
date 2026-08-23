import { expect, test, type Page } from '@playwright/test';

/**
 * 한 주가 통째로 보여야 한다.
 *
 * 교사의 과업은 "오늘 잡기"가 아니라 "이번 주 아무 때나 빈 자리 찾기"다. 오늘이 찼으면
 * 다른 날을 잡으므로 5일이 함께 보여야 한다. 예전에는 `min-w-[720px]` 때문에 375px
 * 화면에서 5일 중 2일만 보이고 나머지는 가로 스크롤 뒤에 숨어 있었다.
 */
const openBoard = async (page: Page) => {
  await page.goto('/tools/special-rooms/new');
  await page.getByLabel('예약판 이름').fill('주간 표 확인');
  await page.getByLabel('1번 특별실 이름').fill('과학실');
  await page.getByRole('button', { name: '예약판 만들기' }).click();
  await expect(page).toHaveURL(/\/tools\/special-rooms\/[0-9a-f-]{36}$/);
  const link = await page.getByLabel('예약 링크 주소').inputValue();
  await page.goto(new URL(link).pathname);
  await expect(page.getByRole('rowheader')).toHaveCount(8);
};

const weekFit = (page: Page) => page.evaluate(() => {
  const table = document.querySelector('table');
  if (!table) return null;
  const days = [...table.querySelectorAll('thead th')].slice(1);
  const inside = days.filter((th) => {
    const r = th.getBoundingClientRect();
    return r.left >= -1 && r.right <= window.innerWidth + 1 && r.width > 0;
  }).length;
  const scroller = table.parentElement as HTMLElement;
  return {
    days: days.length,
    inside,
    horizontal: scroller.scrollWidth - scroller.clientWidth,
    documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
});

test('375px에서 5일이 모두 보이고 가로 스크롤이 없다', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openBoard(page);

  const fit = await weekFit(page);
  expect(fit?.days).toBe(5);
  expect(fit?.inside, '요일 다섯 칸이 모두 화면 안에 있어야 한다').toBe(5);
  expect(fit?.horizontal, '표 안에서 옆으로 밀 것이 없어야 한다').toBe(0);
  expect(fit?.documentOverflow).toBe(0);
});

test('320px처럼 더 좁은 화면에서도 문서가 가로로 넘치지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await openBoard(page);

  const fit = await weekFit(page);
  expect(fit?.documentOverflow).toBe(0);
});

test('데스크톱에서도 5일이 그대로 보인다', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openBoard(page);

  const fit = await weekFit(page);
  expect(fit?.inside).toBe(5);
  expect(fit?.horizontal).toBe(0);
});

test('칸을 누르면 시트가 열려 어디를 잡는지 알려 준다', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openBoard(page);

  await page.getByRole('button', { name: /교시 예약하기$/ }).first().click();

  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  // 표를 떠나서도 어느 방 어느 시간인지 알아야 한다.
  await expect(sheet).toContainText('1교시');
  await expect(sheet).toContainText('과학실');
  await expect(page.getByRole('textbox', { name: /사용 내용$/ })).toBeFocused();
});

test('시트에서 적어 저장하면 표에 반영되고 시트가 닫힌다', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openBoard(page);

  await page.getByRole('button', { name: /교시 예약하기$/ }).first().click();
  await page.getByRole('textbox', { name: /사용 내용$/ }).fill('6-1반');
  await page.getByRole('button', { name: '저장' }).click();

  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /6-1반 고치기$/ })).toBeVisible();
});

test('예약 지우기 버튼으로 지운다', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openBoard(page);

  await page.getByRole('button', { name: /교시 예약하기$/ }).first().click();
  await page.getByRole('textbox', { name: /사용 내용$/ }).fill('6-1반');
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByRole('button', { name: /6-1반 고치기$/ })).toBeVisible();

  // 비우고 저장하는 것 말고, 지우려고 온 사람을 위한 길이 따로 있어야 한다.
  await page.getByRole('button', { name: /6-1반 고치기$/ }).click();
  await page.getByRole('button', { name: '예약 지우기' }).click();
  await expect(page.getByRole('button', { name: /6-1반 고치기$/ })).toHaveCount(0);
});

test('Escape로 시트를 닫으면 아무것도 저장되지 않고 원래 칸으로 돌아온다', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openBoard(page);

  const cell = page.getByRole('button', { name: /교시 예약하기$/ }).first();
  await cell.click();
  await page.getByRole('textbox', { name: /사용 내용$/ }).fill('실수로 적음');
  await page.keyboard.press('Escape');

  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /실수로 적음/ })).toHaveCount(0);
  await expect(cell).toBeFocused();
});

test('긴 이름은 칸에서 잘리지만 시트에서는 전부 읽힌다', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openBoard(page);

  const long = '6학년 1반 과학 실험 안전교육';
  await page.getByRole('button', { name: /교시 예약하기$/ }).first().click();
  await page.getByRole('textbox', { name: /사용 내용$/ }).fill(long);
  await page.getByRole('button', { name: '저장' }).click();

  const cell = page.getByRole('button', { name: new RegExp(`${long} 고치기$`) });
  await expect(cell).toBeVisible();

  // 칸에서는 한 줄로 자른다. 글자 중간이 잘려 보이면 안 된다.
  const clipped = await cell.locator('span').first().evaluate((el) => ({
    boxHeight: Math.round(el.getBoundingClientRect().height),
    lineHeight: Math.round(parseFloat(getComputedStyle(el).lineHeight)),
  }));
  expect(clipped.boxHeight, '칩이 한 줄 높이여야 한다').toBeLessThanOrEqual(clipped.lineHeight + 10);

  await cell.click();
  await expect(page.getByRole('textbox', { name: /사용 내용$/ })).toHaveValue(long);
});
