import { expect, test, type Page } from '@playwright/test';

/**
 * 담당 교사가 출장이나 연가로 자리를 비우면 그 특별실을 쓸 수 없다.
 *
 * 예전에는 담당자가 그날 칸을 하나씩 `출장`이라고 채우는 수밖에 없었다. 8교시면 여덟
 * 칸이고, 그것도 예약으로 보일 뿐 누구나 지울 수 있어 막은 것이 되지 못했다.
 *
 * 휴관 기간의 예약은 감추고 또 알린다. 감추는 이유는 예약이 보이면 그 사람이 그날 오기
 * 때문이고, 알리는 이유는 담당자가 그 사람들에게 따로 연락해야 하기 때문이다.
 */
const createBoard = async (page: Page) => {
  await page.goto('/tools/special-rooms/new');
  await page.getByLabel('예약표 이름').fill('휴관 확인');
  await page.getByLabel('1번 특별실 이름').fill('과학실');
  await page.getByRole('button', { name: '특별실 추가' }).click();
  await page.getByLabel('2번 특별실 이름').fill('미술실');
  await page.getByRole('button', { name: '예약표 만들기' }).click();
  await expect(page).toHaveURL(/\/tools\/special-rooms\/[0-9a-f-]{36}$/);
  return {
    manage: new URL(page.url()).pathname,
    link: new URL(await page.getByLabel('예약 링크 주소').inputValue()).pathname,
  };
};

/** 표에 보이는 이번 주 월요일. 휴관 날짜를 그날로 맞춘다. */
const mondayOfWeek = (page: Page) => page.evaluate(() => {
  const header = document.querySelector('table thead th:nth-child(2)');
  const text = header?.textContent ?? '';
  const [month, day] = (text.match(/(\d+)\/(\d+)/) ?? []).slice(1);
  const year = new Date().getFullYear();
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
});

const addClosure = async (page: Page, options: { room: string; date: string; reason: string }) => {
  await page.getByLabel('어느 특별실').selectOption({ label: options.room });
  await page.getByLabel('시작 날짜').fill(options.date);
  await page.getByLabel('사유').fill(options.reason);
  await page.getByRole('button', { name: '휴관 추가' }).click();
};

test('휴관을 걸면 그 날 그 특별실을 예약할 수 없다', async ({ page }) => {
  const { link } = await createBoard(page);
  const monday = await mondayOfWeek(page);
  await addClosure(page, { room: '과학실', date: monday, reason: '담당 교사 출장' });

  await page.goto(link);
  const closed = page.getByRole('button', { name: /1교시 휴관 · 담당 교사 출장$/ });
  await expect(closed).toBeVisible();
  await expect(closed).toBeDisabled();
});

test('다른 특별실은 그대로 예약할 수 있다', async ({ page }) => {
  // 과학실 담당이 출장이라고 미술실까지 막으면 안 된다.
  const { link } = await createBoard(page);
  const monday = await mondayOfWeek(page);
  await addClosure(page, { room: '과학실', date: monday, reason: '담당 교사 출장' });

  await page.goto(link);
  await page.getByRole('tab', { name: '미술실' }).click();
  await expect(page.getByRole('button', { name: /휴관/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /교시 예약하기$/ }).first()).toBeEnabled();
});

test('모든 특별실을 한 번에 막을 수 있다', async ({ page }) => {
  // 시험 기간처럼 전체를 막을 때 쓴다.
  const { link } = await createBoard(page);
  const monday = await mondayOfWeek(page);
  await addClosure(page, { room: '모든 특별실', date: monday, reason: '기말고사' });

  await page.goto(link);
  await expect(page.getByRole('button', { name: /휴관 · 기말고사$/ }).first()).toBeVisible();
  await page.getByRole('tab', { name: '미술실' }).click();
  await expect(page.getByRole('button', { name: /휴관 · 기말고사$/ }).first()).toBeVisible();
});

test('이미 있는 예약은 감추고, 담당자에게는 몇 건인지 알린다', async ({ page }) => {
  const { manage, link } = await createBoard(page);
  const monday = await mondayOfWeek(page);

  // 먼저 그날 예약을 하나 잡아 둔다.
  await page.goto(link);
  await page.getByRole('button', { name: /교시 예약하기$/ }).first().click();
  await page.getByRole('textbox', { name: /사용 내용$/ }).fill('6-1반');
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByRole('button', { name: /6-1반 고치기$/ })).toBeVisible();

  // 담당자가 휴관을 걸려고 하면, 누르기 전에 알려 준다.
  await page.goto(manage);
  await page.getByLabel('어느 특별실').selectOption({ label: '과학실' });
  await page.getByLabel('시작 날짜').fill(monday);
  await expect(page.getByText(/예약 1건이 있습니다/)).toBeVisible();
  await expect(page.getByText(/예약한 분들께 따로 알려 주세요/)).toBeVisible();

  await page.getByLabel('사유').fill('담당 교사 출장');
  await page.getByRole('button', { name: '휴관 추가' }).click();

  // 공개 화면에서는 그 예약이 감춰진다.
  await page.goto(link);
  await expect(page.getByRole('button', { name: /6-1반 고치기$/ })).toHaveCount(0);
});

test('휴관을 풀면 감춰졌던 예약이 그대로 돌아온다', async ({ page }) => {
  const { manage, link } = await createBoard(page);
  const monday = await mondayOfWeek(page);

  await page.goto(link);
  await page.getByRole('button', { name: /교시 예약하기$/ }).first().click();
  await page.getByRole('textbox', { name: /사용 내용$/ }).fill('6-1반');
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByRole('button', { name: /6-1반 고치기$/ })).toBeVisible();

  await page.goto(manage);
  await addClosure(page, { room: '과학실', date: monday, reason: '담당 교사 출장' });
  await page.goto(link);
  await expect(page.getByRole('button', { name: /6-1반 고치기$/ })).toHaveCount(0);

  // 휴관을 푼다. 지운 것이 아니므로 예약이 살아 있어야 한다.
  await page.goto(manage);
  await page.getByRole('button', { name: /휴관 풀기$/ }).click();
  await page.goto(link);
  await expect(page.getByRole('button', { name: /6-1반 고치기$/ })).toBeVisible();
});

test('반복 예약이 휴관인 날을 건너뛴다', async ({ page }) => {
  const { manage, link } = await createBoard(page);
  const monday = await mondayOfWeek(page);

  // 다음 주 월요일을 막는다.
  const nextMonday = await page.evaluate((day) => {
    const [year, month, date] = day.split('-').map(Number);
    const moved = new Date(year, month - 1, date + 7);
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${moved.getFullYear()}-${pad(moved.getMonth() + 1)}-${pad(moved.getDate())}`;
  }, monday);
  await page.goto(manage);
  await addClosure(page, { room: '과학실', date: nextMonday, reason: '담당 교사 출장' });

  await page.goto(link);
  await page.getByRole('button', { name: /교시 예약하기$/ }).first().click();
  await page.getByRole('textbox', { name: /사용 내용$/ }).fill('5-1반 과학');
  await page.getByLabel('매주 반복해서 잡기').check();
  await page.getByRole('button', { name: '4주' }).click();
  await page.getByRole('button', { name: '반복해서 잡기' }).click();

  await expect(page.getByRole('status')).toContainText('3번 잡았습니다');
  await expect(page.getByRole('status')).toContainText('휴업일 1번은 건너뛰었습니다');
});
