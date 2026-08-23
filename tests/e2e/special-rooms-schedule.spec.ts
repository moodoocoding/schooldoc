import { expect, test, type Page } from '@playwright/test';

/**
 * 학교마다 하루가 다르다.
 *
 * 초등은 6교시가 끝인데 7·8교시 두 줄이 늘 비었고, 고등은 방과후와 토요일을 잡을 자리가
 * 아예 없었다. 예약표마다 정하게 하고, 나중에도 바꿀 수 있게 한다.
 *
 * 줄이면 그 너머 예약이 표에서 사라진다. 지우지는 않고 감추기만 하되 몇 건인지 미리 알린다.
 */
const createBoard = async (
  page: Page, options: { title: string; periodCount?: number; saturday?: boolean },
) => {
  await page.goto('/tools/special-rooms/new');
  await page.getByLabel('예약표 이름').fill(options.title);
  if (options.periodCount) await page.getByLabel('하루 교시 수').selectOption(String(options.periodCount));
  if (options.saturday) await page.getByLabel('토요일도 예약받기').check();
  await page.getByLabel('1번 특별실 이름').fill('과학실');
  await page.getByRole('button', { name: '예약표 만들기' }).click();
  await expect(page).toHaveURL(/\/tools\/special-rooms\/[0-9a-f-]{36}$/);
};

const publicLink = (page: Page) => page.getByLabel('예약 링크 주소').inputValue();

test('6교시 학교는 표에 여섯 줄만 나온다', async ({ page }) => {
  await createBoard(page, { title: '한빛초 특별실', periodCount: 6 });

  await expect(page.getByRole('rowheader')).toHaveCount(6);
  await expect(page.getByRole('rowheader', { name: '6교시' })).toBeVisible();
  await expect(page.getByRole('rowheader', { name: '7교시' })).toHaveCount(0);
});

test('9교시까지 쓰는 학교는 방과후 자리가 생긴다', async ({ page }) => {
  await createBoard(page, { title: '한빛고 특별실', periodCount: 9 });

  await expect(page.getByRole('rowheader')).toHaveCount(9);
  await expect(page.getByRole('rowheader', { name: '9교시' })).toBeVisible();
});

test('토요일을 켜면 여섯 요일이 나오고 공개 화면에서 잡을 수 있다', async ({ page }) => {
  await createBoard(page, { title: '한빛고 특별실', saturday: true });
  await expect(page.getByRole('columnheader', { name: /토/ })).toBeVisible();

  const link = await publicLink(page);
  await page.goto(new URL(link).pathname);
  await expect(page.getByRole('columnheader', { name: /토/ })).toBeVisible();

  // 토요일 칸을 실제로 잡을 수 있어야 한다. 보이기만 해서는 의미가 없다.
  const saturdayCells = page.getByRole('button', { name: /교시 예약하기$/ });
  await saturdayCells.last().click();
  await page.getByRole('textbox', { name: /사용 내용$/ }).fill('모의면접');
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByRole('button', { name: /모의면접 고치기$/ })).toBeVisible();
});

test('토요일을 켜지 않으면 다섯 요일만 나온다', async ({ page }) => {
  await createBoard(page, { title: '한빛중 특별실' });
  await expect(page.getByRole('columnheader', { name: /토/ })).toHaveCount(0);
});

test('교시를 줄이면 가려지는 예약을 저장 전에 숫자로 알린다', async ({ page }) => {
  await createBoard(page, { title: '한빛중 특별실', periodCount: 8 });
  const link = await publicLink(page);
  const manage = page.url();

  // 8교시에 예약을 하나 잡아 둔다.
  await page.goto(new URL(link).pathname);
  await page.getByRole('button', { name: /8교시 예약하기$/ }).first().click();
  await page.getByRole('textbox', { name: /사용 내용$/ }).fill('방과후');
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByRole('button', { name: /방과후 고치기$/ })).toBeVisible();

  await page.goto(new URL(manage).pathname);
  await page.getByLabel('하루 교시 수').selectOption('6');

  // 누르기 전에 알려야 한다. 누른 뒤에 알리면 늦다.
  await expect(page.getByText(/8교시 예약 1건/)).toBeVisible();
  await expect(page.getByText(/지워지는 것은 아니라/)).toBeVisible();
});

test('줄여도 예약은 지워지지 않고 되돌리면 다시 나온다', async ({ page }) => {
  await createBoard(page, { title: '한빛중 특별실', periodCount: 8 });
  const link = await publicLink(page);
  const manage = page.url();

  await page.goto(new URL(link).pathname);
  await page.getByRole('button', { name: /8교시 예약하기$/ }).first().click();
  await page.getByRole('textbox', { name: /사용 내용$/ }).fill('방과후');
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByRole('button', { name: /방과후 고치기$/ })).toBeVisible();

  // 6교시로 줄인다.
  await page.goto(new URL(manage).pathname);
  await page.getByLabel('하루 교시 수').selectOption('6');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('저장했습니다');
  await expect(page.getByRole('rowheader')).toHaveCount(6);

  await page.goto(new URL(link).pathname);
  await expect(page.getByRole('button', { name: /방과후 고치기$/ })).toHaveCount(0);

  // 다시 8교시로 되돌리면 그대로 나타난다.
  await page.goto(new URL(manage).pathname);
  await page.getByLabel('하루 교시 수').selectOption('8');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('저장했습니다');

  await page.goto(new URL(link).pathname);
  await expect(page.getByRole('button', { name: /방과후 고치기$/ })).toBeVisible();
});

test('늘릴 때는 아무것도 알리지 않는다', async ({ page }) => {
  await createBoard(page, { title: '한빛중 특별실', periodCount: 6 });
  await page.getByLabel('하루 교시 수').selectOption('9');

  await expect(page.getByText(/보이지 않게 됩니다/)).toHaveCount(0);
});

test('토요일까지 넣어도 375px에서 가로로 넘치지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await createBoard(page, { title: '한빛고 특별실', saturday: true });
  const link = await publicLink(page);
  await page.goto(new URL(link).pathname);

  const fit = await page.evaluate(() => {
    const table = document.querySelector('table');
    if (!table) return null;
    const days = [...table.querySelectorAll('thead th')].slice(1);
    const inside = days.filter((th) => {
      const r = th.getBoundingClientRect();
      return r.left >= -1 && r.right <= window.innerWidth + 1 && r.width > 0;
    }).length;
    return {
      days: days.length,
      inside,
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

  expect(fit?.days).toBe(6);
  expect(fit?.inside, '여섯 요일이 모두 화면 안에 있어야 한다').toBe(6);
  expect(fit?.documentOverflow).toBe(0);
});
