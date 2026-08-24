import { expect, test, type Page } from '@playwright/test';

/**
 * 매주 같은 시간을 한 번에 잡는다.
 *
 * 중등 교사는 화 3·4교시 물상실처럼 학기 내내 같은 시간을 쓴다. 한 학기면 같은 예약이
 * 60~70번인데, 칸을 하나씩 눌러 넣게 하면 구글 시트보다 느려서 아무도 안 쓴다.
 *
 * 반복은 넣는 방식이지 저장하는 방식이 아니다. 펼쳐서 보통 예약으로 하나씩 저장하므로
 * 한 주만 지우는 것은 그냥 그 칸을 지우는 일이다. 학교는 예외가 많다.
 */
const openPublicBoard = async (page: Page) => {
  await page.goto('/tools/special-rooms/new');
  await page.getByLabel('예약표 이름').fill('반복 확인');
  await page.getByLabel('1번 특별실 이름').fill('과학실');
  await page.getByRole('button', { name: '예약표 만들기' }).click();
  await expect(page).toHaveURL(/\/tools\/special-rooms\/[0-9a-f-]{36}$/);
  const link = await page.getByLabel('예약 링크 주소').inputValue();
  await page.goto(new URL(link).pathname);
  await expect(page.getByRole('rowheader')).toHaveCount(8);
  return new URL(link).pathname;
};

const openFirstEmptyCell = async (page: Page) => {
  await page.getByRole('button', { name: /교시 예약하기$/ }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
};

test('빈 칸에는 매주 반복 선택이 있다', async ({ page }) => {
  await openPublicBoard(page);
  await openFirstEmptyCell(page);

  await expect(page.getByLabel('매주 반복해서 잡기')).toBeVisible();
});

test('반복 체크를 켜면 저장 버튼이 사라지고 반복해서 잡기만 남는다', async ({ page }) => {
  // 저장과 반복해서 잡기가 함께 보이면 반복을 다 골라 놓고도 저장을 눌러 이 하루만
  // 조용히 저장해 버리는 실수가 난다. 실행 버튼은 그 순간 하나여야 한다.
  await openPublicBoard(page);
  await openFirstEmptyCell(page);
  await page.getByRole('textbox', { name: /사용 내용$/ }).fill('6-1반');

  await expect(page.getByRole('button', { name: '저장' })).toBeVisible();

  await page.getByLabel('매주 반복해서 잡기').check();
  await expect(page.getByRole('button', { name: '저장' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '반복해서 잡기' })).toBeVisible();

  await page.getByLabel('매주 반복해서 잡기').uncheck();
  await expect(page.getByRole('button', { name: '저장' })).toBeVisible();
});

test('반복 체크가 켜져 있으면 엔터도 저장이 아니라 반복해서 잡기를 실행한다', async ({ page }) => {
  await openPublicBoard(page);
  await openFirstEmptyCell(page);
  await page.getByRole('textbox', { name: /사용 내용$/ }).fill('6-1반');
  await page.getByLabel('매주 반복해서 잡기').check();
  await page.getByRole('button', { name: '4주' }).click();

  await page.getByRole('textbox', { name: /사용 내용$/ }).press('Enter');

  await expect(page.getByRole('status')).toContainText('4번 잡았습니다');
});

test('이미 잡힌 칸을 고칠 때는 반복을 권하지 않는다', async ({ page }) => {
  // 남의 예약을 학기 내내 덮어 버리는 사고를 막는다.
  await openPublicBoard(page);
  await openFirstEmptyCell(page);
  await page.getByRole('textbox', { name: /사용 내용$/ }).fill('6-1반');
  await page.getByRole('button', { name: '저장' }).click();

  await page.getByRole('button', { name: /6-1반 고치기$/ }).click();
  await page.getByRole('button', { name: '바꾸기' }).click();
  await expect(page.getByLabel('매주 반복해서 잡기')).toHaveCount(0);
});

test('빠른 선택을 누르면 몇 번 잡히는지 미리 알려 준다', async ({ page }) => {
  await openPublicBoard(page);
  await openFirstEmptyCell(page);
  await page.getByLabel('매주 반복해서 잡기').check();

  await page.getByRole('button', { name: '4주' }).click();
  await expect(page.getByText(/매주 .* 4번 잡습니다/)).toBeVisible();

  await page.getByRole('button', { name: '2주' }).click();
  await expect(page.getByText(/2번 잡습니다/)).toBeVisible();
});

test('4주 반복을 넣으면 다음 주에도 같은 자리에 잡힌다', async ({ page }) => {
  await openPublicBoard(page);
  await openFirstEmptyCell(page);
  await page.getByRole('textbox', { name: /사용 내용$/ }).fill('5-1반 과학');
  await page.getByLabel('매주 반복해서 잡기').check();
  await page.getByRole('button', { name: '4주' }).click();
  await page.getByRole('button', { name: '반복해서 잡기' }).click();

  await expect(page.getByRole('status')).toContainText('4번 잡았습니다');

  // 결과를 보여 주려고 시트는 열린 채로 둔다. 표를 보려면 닫아야 한다.
  await page.getByRole('button', { name: '예약 입력 닫기' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // 이번 주에 보이고,
  await expect(page.getByRole('button', { name: /5-1반 과학 고치기$/ })).toBeVisible();
  // 다음 주에도 보인다.
  await page.getByRole('button', { name: '다음 주' }).click();
  await expect(page.getByRole('button', { name: /5-1반 과학 고치기$/ })).toBeVisible();
});

test('반복으로 넣은 한 주만 지워도 나머지는 남는다', async ({ page }) => {
  // 시험 기간 2주를 빼거나 비 와서 하루를 옮기는 일이 매주 있다.
  await openPublicBoard(page);
  await openFirstEmptyCell(page);
  await page.getByRole('textbox', { name: /사용 내용$/ }).fill('5-1반 과학');
  await page.getByLabel('매주 반복해서 잡기').check();
  await page.getByRole('button', { name: '4주' }).click();
  await page.getByRole('button', { name: '반복해서 잡기' }).click();
  await expect(page.getByRole('status')).toContainText('4번 잡았습니다');
  await page.getByRole('button', { name: '예약 입력 닫기' }).click();

  // 다음 주 것만 지운다.
  await page.getByRole('button', { name: '다음 주' }).click();
  await page.getByRole('button', { name: /5-1반 과학 고치기$/ }).click();
  await page.getByRole('button', { name: '바꾸기' }).click();
  await page.getByRole('button', { name: '예약 지우기' }).click();
  await expect(page.getByRole('button', { name: /5-1반 과학 고치기$/ })).toHaveCount(0);

  // 그 다음 주는 그대로 있다.
  await page.getByRole('button', { name: '다음 주' }).click();
  await expect(page.getByRole('button', { name: /5-1반 과학 고치기$/ })).toBeVisible();
});

test('이미 예약이 있는 주는 덮지 않고 건너뛴다', async ({ page }) => {
  await openPublicBoard(page);

  // 다음 주 첫 칸을 남이 먼저 잡아 둔다.
  await page.getByRole('button', { name: '다음 주' }).click();
  await openFirstEmptyCell(page);
  await page.getByRole('textbox', { name: /사용 내용$/ }).fill('먼저 잡은 예약');
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByRole('button', { name: /먼저 잡은 예약 고치기$/ })).toBeVisible();

  // 이번 주부터 4주 반복을 넣는다.
  await page.getByRole('button', { name: '이번 주' }).click();
  await openFirstEmptyCell(page);
  await page.getByRole('textbox', { name: /사용 내용$/ }).fill('5-1반 과학');
  await page.getByLabel('매주 반복해서 잡기').check();
  await page.getByRole('button', { name: '4주' }).click();
  await page.getByRole('button', { name: '반복해서 잡기' }).click();

  await expect(page.getByRole('status')).toContainText('3번 잡았습니다');
  await expect(page.getByRole('status')).toContainText('이미 예약이 있는 1번은 그대로 두었습니다');

  await page.getByRole('button', { name: '예약 입력 닫기' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // 남의 예약은 그대로다.
  await page.getByRole('button', { name: '다음 주' }).click();
  await expect(page.getByRole('button', { name: /먼저 잡은 예약 고치기$/ })).toBeVisible();
});

test('내용을 적지 않으면 반복해서 잡을 수 없다', async ({ page }) => {
  await openPublicBoard(page);
  await openFirstEmptyCell(page);
  await page.getByLabel('매주 반복해서 잡기').check();

  await expect(page.getByRole('button', { name: '반복해서 잡기' })).toBeDisabled();
  await page.getByRole('textbox', { name: /사용 내용$/ }).fill('5-1반');
  await expect(page.getByRole('button', { name: '반복해서 잡기' })).toBeEnabled();
});
