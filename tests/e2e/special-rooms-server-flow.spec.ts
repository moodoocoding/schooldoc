import { expect, test } from '@playwright/test';
// 실제 Chrome→HTTP Edge 처리기→PostgreSQL 경로. API 응답을 모킹하지 않는다.
// SPECIAL_ROOMS_SQL_URL=http://127.0.0.1:4196 PLAYWRIGHT_TEST_PORT=4195
const api = process.env.SPECIAL_ROOMS_SQL_URL;
test.skip(
  !api,
  '로컬 SQL HTTP 서버와 비데모 Vite를 명시적으로 시작한 경우만 실행한다.',
);
const token = '40000000-0000-4000-8000-000000000001';
const control = (data: unknown) =>
  fetch(api + '/control', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
const metrics = async () => await (await fetch(api + '/metrics')).json();
test.beforeEach(async () => {
  await control({ action: 'reset' });
  await control({ action: 'config', periodCount: 9, includeSaturday: true });
  await control({ action: 'status', status: 'open' });
});
test('실제 HTTP·SQL 경로에서 9교시를 저장하고 성공 후 재조회하지 않는다', async ({
  page,
}) => {
  await page.goto('/s/rooms/' + token);
  await page.getByLabel('예약 날짜로 이동').fill('2026-10-05');
  await page.getByRole('button', { name: '10/5 9교시 예약하기' }).click();
  await page
    .getByRole('textbox', { name: /사용 내용$/ })
    .fill('실제 SQL 9교시');
  const before = (await metrics()).requests.length;
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: /실제 SQL 9교시 고치기$/ }),
  ).toBeVisible();
  await expect
    .poll(async () => {
      const rows = (await metrics()).bookings;
      return rows.find(
        (b: any) => b.booking_date === '2026-10-05' && b.period === 9,
      )?.label;
    })
    .toBe('실제 SQL 9교시');
  const calls = (await metrics()).requests.slice(before);
  expect(calls.map((r: any) => r.action)).toEqual(['setBooking']);
});
test('두 Chrome 탭의 빈 칸 경쟁에서 초안을 유지하고 현재 예약 확인 후 수정한다', async ({
  page,
  context,
}) => {
  await page.goto('/s/rooms/' + token);
  await page.getByLabel('예약 날짜로 이동').fill('2026-10-12');
  const cell = '10/12 1교시 예약하기';
  await page.getByRole('button', { name: cell }).click();
  await page
    .getByRole('textbox', { name: /사용 내용$/ })
    .fill('첫 탭 가상 학급');
  const second = await context.newPage();
  await second.goto('/s/rooms/' + token);
  await second.getByLabel('예약 날짜로 이동').fill('2026-10-12');
  await second.getByRole('button', { name: cell }).click();
  await second
    .getByRole('textbox', { name: /사용 내용$/ })
    .fill('둘째 탭 초안');
  await page.bringToFront();
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await second.bringToFront();
  await second.getByRole('button', { name: '저장', exact: true }).click();
  await expect(second.getByRole('alert')).toContainText(
    '다른 사람이 예약을 변경했습니다',
  );
  await expect(second.getByRole('textbox', { name: /사용 내용$/ })).toHaveValue(
    '둘째 탭 초안',
  );
  await expect(second.getByRole('alert')).toContainText('첫 탭 가상 학급');
  await second.getByRole('button', { name: '현재 예약 확인' }).click();
  await second.getByRole('button', { name: '저장', exact: true }).click();
  await expect(second.getByRole('dialog')).toHaveCount(0);
  expect(
    (await metrics()).bookings.find(
      (b: any) => b.booking_date === '2026-10-12' && b.period === 1,
    )?.revision,
  ).toBe(2);
  await second.close();
});
test('실제 HTTP 503 뒤 초기 조회와 입력 초안을 다시 시도할 수 있다', async ({
  page,
}) => {
  await control({ action: 'failNext' });
  await page.goto('/s/rooms/' + token);
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);
  await page.getByRole('button', { name: '다시 시도' }).click();
  await page.getByLabel('예약 날짜로 이동').fill('2026-10-19');
  await page.getByRole('button', { name: '10/19 1교시 예약하기' }).click();
  await page
    .getByRole('textbox', { name: /사용 내용$/ })
    .fill('실패 후 보존 초안');
  await control({ action: 'failNext' });
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('시험용 연결 실패');
  await expect(page.getByRole('textbox', { name: /사용 내용$/ })).toHaveValue(
    '실패 후 보존 초안',
  );
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('느린 이전 주 응답이 마지막으로 선택한 주를 덮지 않는다', async ({
  page,
}) => {
  await page.goto('/s/rooms/' + token);
  await page.getByRole('table').waitFor();
  await control({ action: 'delayWeek', week: '2026-11-02' });
  await page.getByLabel('예약 날짜로 이동').fill('2026-11-02');
  await page.getByLabel('예약 날짜로 이동').fill('2026-11-09');
  await expect(
    page.getByRole('columnheader', { name: '월 11/9' }),
  ).toBeVisible();
  await expect
    .poll(async () =>
      (await metrics()).requests.some((r: any) => r.from === '2026-11-02'),
    )
    .toBe(true);
  await expect(
    page.getByRole('columnheader', { name: '월 11/9' }),
  ).toBeVisible();
});

test('두 Chrome 탭의 반복 요청은 실제 생성 행만 성공 수에 포함한다', async ({
  page,
  context,
}) => {
  await page.goto('/s/rooms/' + token);
  await page.getByLabel('예약 날짜로 이동').fill('2026-12-07');
  const second = await context.newPage();
  await second.goto('/s/rooms/' + token);
  await second.getByLabel('예약 날짜로 이동').fill('2026-12-07');
  for (const [tab, label] of [
    [page, '가상 반복 첫 탭'],
    [second, '가상 반복 둘째 탭'],
  ] as const) {
    await tab.getByRole('button', { name: '12/7 4교시 예약하기' }).click();
    await tab.getByRole('textbox', { name: /사용 내용$/ }).fill(label);
    await tab.getByLabel('매주 반복해서 잡기').check();
    await tab.locator('input[type=date]').last().fill('2026-12-21');
  }
  const response = (tab: typeof page) =>
    tab.waitForResponse(
      (r) =>
        r.url().endsWith('/functions/v1/special-rooms-public') &&
        r.request().postDataJSON()?.action === 'setRepeat',
    );
  const left = response(page),
    right = response(second);
  await Promise.all([
    page.getByRole('button', { name: '반복해서 잡기', exact: true }).click(),
    second.getByRole('button', { name: '반복해서 잡기', exact: true }).click(),
  ]);
  const outcomes = await Promise.all([
    (await left).json(),
    (await right).json(),
  ]);
  expect(outcomes.map((x) => x.created.length).sort()).toEqual([0, 3]);
  expect(outcomes.map((x) => x.skippedTaken.length).sort()).toEqual([0, 3]);
  expect(
    (await metrics()).bookings.filter((b: any) => b.period === 4).length,
  ).toBe(3);
  await second.close();
});
