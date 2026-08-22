import { expect, test } from '@playwright/test';

/**
 * 목록을 적어 내려가다 누른 엔터가 폼을 보내면 안 된다.
 *
 * 특별실 이름을 적다 무심코 엔터를 치면 줄이 늘어나는 대신 `예약판 만들기`가 실행돼
 * 다 적기도 전에 예약판이 만들어졌다. 학생 결과 화면도 같았다. HTML 폼의 기본 동작이라
 * 새 화면에서도 되풀이되기 쉬우므로 실제 키 입력으로 잰다.
 *
 * 합성 이벤트로는 잡히지 않는다. 브라우저는 사람이 실제로 누른 엔터에만 폼을 보낸다.
 */
test('특별실 이름 칸의 엔터는 줄을 더하고 예약판을 만들지 않는다', async ({ page }) => {
  await page.goto('/tools/special-rooms/new');
  await page.getByLabel('예약판 이름').fill('2학기 특별실 예약');
  await page.getByLabel('1번 특별실 이름').fill('과학실');
  await page.getByLabel('1번 특별실 이름').press('Enter');

  await expect(page.getByLabel('2번 특별실 이름')).toBeVisible();
  await expect(page.getByLabel('2번 특별실 이름')).toBeFocused();
  await expect(page).toHaveURL(/\/tools\/special-rooms\/new$/);

  // 이어 적을 수 있어야 한다.
  await page.keyboard.type('음악실');
  await expect(page.getByLabel('2번 특별실 이름')).toHaveValue('음악실');
});

test('특별실 위치 칸의 엔터도 같다', async ({ page }) => {
  await page.goto('/tools/special-rooms/new');
  await page.getByLabel('예약판 이름').fill('2학기 특별실 예약');
  await page.getByLabel('1번 특별실 이름').fill('과학실');
  await page.getByLabel('1번 특별실 위치').press('Enter');

  await expect(page.getByLabel('2번 특별실 이름')).toBeVisible();
  await expect(page).toHaveURL(/\/tools\/special-rooms\/new$/);
});

test('빈 줄에서 누른 엔터는 빈 줄을 쌓지 않고 폼도 보내지 않는다', async ({ page }) => {
  await page.goto('/tools/special-rooms/new');
  await page.getByLabel('예약판 이름').fill('2학기 특별실 예약');
  await page.getByLabel('1번 특별실 이름').press('Enter');
  await page.getByLabel('1번 특별실 이름').press('Enter');

  await expect(page.locator('input[aria-label$="특별실 이름"]')).toHaveCount(1);
  await expect(page).toHaveURL(/\/tools\/special-rooms\/new$/);
  // 머문 것만 봐서는 모자란다. 고치기 전에도 검증 오류에 막혀 같은 자리에 머물렀다.
  // 엔터가 아예 폼을 보내지 않아야 하므로 오류도 뜨지 않아야 한다.
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('학생 성명 칸의 엔터는 학생을 더하고 결과 안내를 만들지 않는다', async ({ page }) => {
  await page.goto('/tools/student-results/new');
  await page.getByLabel('제목').first().fill('2학기 수행평가 결과');
  await page.getByLabel('1번 학생 성명').fill('김별');
  await page.getByLabel('1번 학생 성명').press('Enter');

  await expect(page.getByLabel('2번 학생 성명')).toBeVisible();
  await expect(page.getByLabel('2번 학생 성명')).toBeFocused();
  await expect(page).toHaveURL(/\/tools\/student-results\/new$/);
  // 제출됐다면 검증 오류가 떴을 것이다.
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('학생 확인번호와 점수 칸의 엔터도 폼을 보내지 않는다', async ({ page }) => {
  await page.goto('/tools/student-results/new');
  await page.getByLabel('제목').first().fill('2학기 수행평가 결과');
  await page.getByLabel('1번 학생 성명').fill('김별');
  await page.getByLabel('1번 학생 확인번호').fill('2590');
  await page.getByLabel('1번 학생 확인번호').press('Enter');

  await expect(page).toHaveURL(/\/tools\/student-results\/new$/);
  await expect(page.getByLabel('2번 학생 성명')).toBeVisible();
});

test('항목명 칸의 엔터는 항목을 더한다', async ({ page }) => {
  await page.goto('/tools/student-results/new');
  await page.getByLabel('제목').first().fill('2학기 수행평가 결과');
  await page.getByLabel('1번 항목명').fill('발표');
  await page.getByLabel('1번 항목명').press('Enter');

  await expect(page.getByLabel('2번 항목명')).toBeVisible();
  await expect(page).toHaveURL(/\/tools\/student-results\/new$/);
});
