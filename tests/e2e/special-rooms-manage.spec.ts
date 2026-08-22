import { expect, test, type Page } from '@playwright/test';

/**
 * 관리 화면에서 제목과 안내 문구를 보고 고친다.
 *
 * 예전에는 만들 때 적은 뒤로 담당자 화면 어디에도 나오지 않았다. 적었는지조차 배부한
 * 링크를 직접 열어 봐야 알 수 있었고, 오타 하나에 예약판을 새로 만들어야 했다.
 */
const createBoard = async (page: Page, options: { title: string; description?: string }) => {
  await page.goto('/tools/special-rooms/new');
  await page.getByLabel('예약판 이름').fill(options.title);
  if (options.description) await page.getByLabel('안내 문구').fill(options.description);
  await page.getByLabel('1번 특별실 이름').fill('과학실');
  await page.getByRole('button', { name: '예약판 만들기' }).click();
  await expect(page).toHaveURL(/\/tools\/special-rooms\/[0-9a-f-]{36}$/);
};

const publicLink = async (page: Page) => page.getByLabel('예약 링크 주소').inputValue();

test('안내 문구를 적지 않아도 예약판이 만들어진다', async ({ page }) => {
  await createBoard(page, { title: '안내 없는 예약판' });

  await expect(page.getByRole('heading', { name: '안내 없는 예약판' })).toBeVisible();
  await expect(page.getByLabel(/^안내 문구/)).toHaveValue('');
});

test('만든 뒤에도 제목과 안내 문구가 화면에 남아 있다', async ({ page }) => {
  await createBoard(page, { title: '컴퓨터실 예약판', description: '사용 후 정리 부탁드립니다' });

  await expect(page.getByLabel('예약판 이름')).toHaveValue('컴퓨터실 예약판');
  await expect(page.getByLabel(/^안내 문구/)).toHaveValue('사용 후 정리 부탁드립니다');
});

test('안내 문구를 고치면 공개 화면에 반영된다', async ({ page }) => {
  await createBoard(page, { title: '컴퓨터실 예약판', description: '처음 적은 안내' });
  const link = await publicLink(page);

  await page.getByLabel(/^안내 문구/).fill('고친 안내입니다');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('저장했습니다');

  await page.goto(new URL(link).pathname);
  await expect(page.getByText('고친 안내입니다')).toBeVisible();
  await expect(page.getByText('처음 적은 안내')).toHaveCount(0);
});

test('안내 문구를 지우면 공개 화면에서도 사라진다', async ({ page }) => {
  await createBoard(page, { title: '컴퓨터실 예약판', description: '지울 안내' });
  const link = await publicLink(page);

  await page.getByLabel(/^안내 문구/).fill('');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('저장했습니다');

  await page.goto(new URL(link).pathname);
  await expect(page.getByText('지울 안내')).toHaveCount(0);
});

test('제목을 고치면 머리글과 공개 화면이 함께 바뀐다', async ({ page }) => {
  await createBoard(page, { title: '옛 이름' });
  const link = await publicLink(page);

  await page.getByLabel('예약판 이름').fill('새 이름');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByRole('heading', { name: '새 이름' })).toBeVisible();

  await page.goto(new URL(link).pathname);
  await expect(page.getByRole('heading', { name: '새 이름' })).toBeVisible();
});

test('제목을 비우면 막고 그 칸으로 되돌려 보낸다', async ({ page }) => {
  await createBoard(page, { title: '컴퓨터실 예약판' });

  await page.getByLabel('예약판 이름').fill('   ');
  await page.getByRole('button', { name: '저장', exact: true }).click();

  await expect(page.getByRole('alert')).toContainText('예약판 이름');
  await expect(page.getByLabel('예약판 이름')).toBeFocused();
});

test('고친 것이 없으면 저장을 누를 수 없다', async ({ page }) => {
  await createBoard(page, { title: '컴퓨터실 예약판' });
  await expect(page.getByRole('button', { name: '저장', exact: true })).toBeDisabled();

  await page.getByLabel(/^안내 문구/).fill('무언가');
  await expect(page.getByRole('button', { name: '저장', exact: true })).toBeEnabled();
});

test('머리글이 상태와 핵심 수치를 보여 준다', async ({ page }) => {
  await createBoard(page, { title: '컴퓨터실 예약판' });

  await expect(page.getByText('예약 받는 중')).toBeVisible();
  await expect(page.getByText('특별실 1곳')).toBeVisible();
  await expect(page.getByText('이번 주 예약 0건')).toBeVisible();

  await page.getByRole('button', { name: '예약 종료' }).click();
  await expect(page.getByText('예약 종료됨')).toBeVisible();
});

test('390px에서 가로 스크롤이 생기지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await createBoard(page, { title: '컴퓨터실 예약판', description: '사용 후 정리 부탁드립니다' });

  const overflow = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(overflow.document).toBeLessThanOrEqual(overflow.viewport + 1);
});
