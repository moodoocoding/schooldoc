import { expect, test } from '@playwright/test';
// 실제 Chrome UI에서 데모 권한 상태와 입력 수명 주기를 확인한다. 원격 인증 검사가 아니다.
test('보호 예약표의 오답과 접근 변경 뒤 재입력을 처리한다', async ({
  page,
}) => {
  await page.goto('/tools/special-rooms/new');
  await page.getByLabel('예약표 이름').fill('가상 보호 예약표');
  await page.getByLabel('1번 특별실 이름').fill('과학실');
  await page.getByLabel('공개 비밀번호').fill('synthetic-password');
  await page.getByRole('button', { name: '예약표 만들기' }).click();
  const link = await page.getByLabel('예약 링크 주소').inputValue();
  await page.goto(link);
  await expect(page.getByRole('table')).toHaveCount(0);
  await page.getByLabel('비밀번호', { exact: true }).fill('wrong');
  await page.getByRole('button', { name: '열기', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(
    '비밀번호가 맞지 않습니다',
  );
  await expect(page.getByRole('table')).toHaveCount(0);
  await page.getByLabel('비밀번호', { exact: true }).fill('synthetic-password');
  await page.getByRole('button', { name: '열기', exact: true }).click();
  await page.getByRole('table').waitFor();
  await page
    .getByRole('button', { name: /교시 예약하기$/ })
    .first()
    .click();
  await page
    .getByRole('textbox', { name: /사용 내용$/ })
    .fill('폐기되어야 할 가상 초안');
  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    const boards = JSON.parse(
      localStorage.getItem('schooldoc_special_rooms_v1')!,
    );
    boards[0].password = 'new-synthetic-password';
    boards[0].accessEpoch = 2;
    localStorage.setItem('schooldoc_special_rooms_v1', JSON.stringify(boards));
    window.dispatchEvent(new Event('schooldoc-special-rooms-change'));
  });
  await expect(page.getByRole('table')).toHaveCount(0);
  await expect(page.getByRole('alert')).toBeVisible();
  await page
    .getByLabel('비밀번호', { exact: true })
    .fill('new-synthetic-password');
  await page.getByRole('button', { name: '열기', exact: true }).click();
  await page
    .getByRole('button', { name: /교시 예약하기$/ })
    .first()
    .click();
  await expect(page.getByRole('textbox', { name: /사용 내용$/ })).toHaveValue(
    '',
  );
});
test('주를 옮겼다가 돌아오면 초안을 유지하고 52주 초과를 안내한다', async ({
  page,
}) => {
  await page.goto('/tools/special-rooms/new');
  await page.getByLabel('예약표 이름').fill('가상 초안과 범위');
  await page.getByLabel('1번 특별실 이름').fill('과학실');
  await page.getByRole('button', { name: '예약표 만들기' }).click();
  await page.goto(await page.getByLabel('예약 링크 주소').inputValue());
  await page.getByLabel('예약 날짜로 이동').fill('2026-10-05');
  await page.getByRole('button', { name: '10/5 1교시 예약하기' }).click();
  await page
    .getByRole('textbox', { name: /사용 내용$/ })
    .fill('탭 메모리 가상 초안');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '다음 주', exact: true }).click();
  await expect(
    page.getByRole('columnheader', { name: '월 10/12' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '지난 주', exact: true }).click();
  await page.getByRole('button', { name: '10/5 1교시 예약하기' }).click();
  await expect(page.getByRole('textbox', { name: /사용 내용$/ })).toHaveValue(
    '탭 메모리 가상 초안',
  );
  await page.getByLabel('매주 반복해서 잡기').check();
  await page.locator('input[type=date]').last().fill('2027-10-04');
  await expect(page.getByRole('alert')).toContainText('52주');
  await expect(
    page.getByRole('button', { name: '반복해서 잡기', exact: true }),
  ).toBeDisabled();
});
