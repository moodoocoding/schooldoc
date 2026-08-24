import { expect, test, type Page } from '@playwright/test';

/**
 * 남의 예약을 실수로 덮지 않게, 이미 잡힌 칸을 고치기 전에 한 번 확인한다.
 *
 * 누구나 남의 예약을 고치고 지울 수 있는 화면이라, 휴대폰에서 옆 칸을 잘못 눌러 남의
 * 것을 덮는 사고가 난다. 이름을 붙여 누구 것인지 보여 주는 대신(개인정보가 되고, 가입
 * 없이 쓰는 취지와도 안 맞는다) 바꾸기 전에 "이미 '6-1반'이 잡혀 있습니다. 바꿀까요?"를
 * 한 번 묻기로 했다. 자기 것을 고치러 왔어도 똑같이 묻는다 — 누구 것인지 구분할 방법이
 * 없어서 그 정도는 감수하기로 했다.
 */
const openPublicBoard = async (page: Page) => {
  await page.goto('/tools/special-rooms/new');
  await page.getByLabel('예약표 이름').fill('확인창 점검');
  await page.getByLabel('1번 특별실 이름').fill('과학실');
  await page.getByRole('button', { name: '예약표 만들기' }).click();
  await expect(page).toHaveURL(/\/tools\/special-rooms\/[0-9a-f-]{36}$/);
  const link = await page.getByLabel('예약 링크 주소').inputValue();
  await page.goto(new URL(link).pathname);
  await expect(page.getByRole('rowheader')).toHaveCount(8);
};

const bookFirstCell = async (page: Page, label: string) => {
  await page.getByRole('button', { name: /교시 예약하기$/ }).first().click();
  await page.getByRole('textbox', { name: /사용 내용$/ }).fill(label);
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByRole('button', { name: new RegExp(`${label} 고치기$`) })).toBeVisible();
};

test('빈 칸은 확인 없이 바로 입력한다', async ({ page }) => {
  await openPublicBoard(page);
  await page.getByRole('button', { name: /교시 예약하기$/ }).first().click();

  await expect(page.getByRole('button', { name: '바꾸기' })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: /사용 내용$/ })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /사용 내용$/ })).toBeFocused();
});

test('이미 잡힌 칸을 열면 입력칸 대신 확인창이 먼저 뜬다', async ({ page }) => {
  await openPublicBoard(page);
  await bookFirstCell(page, '6-1반');

  await page.getByRole('button', { name: /6-1반 고치기$/ }).click();

  await expect(page.getByText("이미 6-1반이 잡혀 있습니다. 바꿀까요?")).toBeVisible();
  await expect(page.getByRole('textbox', { name: /사용 내용$/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '예약 지우기' })).toHaveCount(0);
});

test('안전한 취소에 처음 초점이 있다', async ({ page }) => {
  // 실수로 연 것일 수 있으니, 아무 키나 눌러도 안전한 쪽이 눌리게 한다.
  await openPublicBoard(page);
  await bookFirstCell(page, '6-1반');

  await page.getByRole('button', { name: /6-1반 고치기$/ }).click();
  await expect(page.getByRole('button', { name: '취소' })).toBeFocused();
});

test('취소하면 아무 것도 바뀌지 않고 표로 돌아간다', async ({ page }) => {
  await openPublicBoard(page);
  await bookFirstCell(page, '6-1반');

  await page.getByRole('button', { name: /6-1반 고치기$/ }).click();
  await page.getByRole('button', { name: '취소' }).click();

  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /6-1반 고치기$/ })).toBeVisible();
});

test('바꾸기를 누르면 그제서야 입력칸이 나오고 원래 값이 채워져 있다', async ({ page }) => {
  await openPublicBoard(page);
  await bookFirstCell(page, '6-1반');

  await page.getByRole('button', { name: /6-1반 고치기$/ }).click();
  await page.getByRole('button', { name: '바꾸기' }).click();

  const input = page.getByRole('textbox', { name: /사용 내용$/ });
  await expect(input).toBeVisible();
  await expect(input).toHaveValue('6-1반');
  await expect(input).toBeFocused();
  await expect(page.getByRole('button', { name: '예약 지우기' })).toBeVisible();
});

test('바꾸기 뒤에 실제로 고칠 수 있다', async ({ page }) => {
  await openPublicBoard(page);
  await bookFirstCell(page, '6-1반');

  await page.getByRole('button', { name: /6-1반 고치기$/ }).click();
  await page.getByRole('button', { name: '바꾸기' }).click();
  await page.getByRole('textbox', { name: /사용 내용$/ }).fill('5-3반 과학');
  await page.getByRole('button', { name: '저장' }).click();

  await expect(page.getByRole('button', { name: /5-3반 과학 고치기$/ })).toBeVisible();
});

test('다른 칸을 열면 확인 여부가 그 칸 기준으로 다시 정해진다', async ({ page }) => {
  await openPublicBoard(page);
  await bookFirstCell(page, '6-1반');

  // 잡힌 칸 → 확인 → 바꾸기까지 눌러 입력 상태로 만든다.
  await page.getByRole('button', { name: /6-1반 고치기$/ }).click();
  await page.getByRole('button', { name: '바꾸기' }).click();
  await expect(page.getByRole('textbox', { name: /사용 내용$/ })).toBeVisible();

  // 시트를 닫고 빈 칸을 열면, 이전 칸에서 확인을 마쳤던 상태가 남아 있으면 안 된다.
  await page.getByRole('button', { name: '예약 입력 닫기' }).click();
  await page.getByRole('button', { name: /교시 예약하기$/ }).first().click();

  await expect(page.getByRole('button', { name: '바꾸기' })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: /사용 내용$/ })).toBeVisible();
});

test('빈 칸에 반복으로 잡아도 성공 메시지가 확인창에 가려지지 않는다', async ({ page }) => {
  // 반복이 성공하면 지금 연 칸도 막 채워져 `current`가 빈 값에서 값 있는 걸로 바뀐다.
  // 그때 확인창을 다시 띄우면 "N번 잡았습니다" 결과가 가려진다. 실제로 그렇게 됐었다.
  await openPublicBoard(page);
  await page.getByRole('button', { name: /교시 예약하기$/ }).first().click();
  await page.getByRole('textbox', { name: /사용 내용$/ }).fill('5-1반 과학');
  await page.getByLabel('매주 반복해서 잡기').check();
  await page.getByRole('button', { name: '4주' }).click();
  await page.getByRole('button', { name: '반복해서 잡기' }).click();

  await expect(page.getByRole('button', { name: '바꾸기' })).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('4번 잡았습니다');
});
