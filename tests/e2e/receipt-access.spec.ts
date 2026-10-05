import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const teacher = { id: 'ordinary-receipt-teacher', email: 'teacher@example.invalid', app_metadata: {}, user_metadata: { name: '일반 교사' }, is_anonymous: false };
async function setup(page: Page, user: typeof teacher | null = teacher, pending = false) {
  const errors: string[] = [];
  const remoteCalls: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://**.supabase.co/**', route => { remoteCalls.push(route.request().url()); return route.abort(); });
  await page.route('**/src/utils/supabaseClient.ts', route => route.fulfill({ contentType: 'application/javascript', body: `
    export const isSupabaseConfigured = true;
    let user = sessionStorage.getItem('__receipt_access_user') ? JSON.parse(sessionStorage.getItem('__receipt_access_user')) : ${JSON.stringify(user)};
    let listener;
    let resolveSession;
    const session = () => user ? { user } : null;
    window.__receiptSetUser = next => { user = next; sessionStorage.setItem('__receipt_access_user', JSON.stringify(next)); listener?.('SIGNED_IN', session()); };
    window.__receiptResolveSession = () => resolveSession?.({data:{session:session()},error:null});
    export const supabase = { auth: {
      getSession: () => ${pending ? 'new Promise(resolve => { resolveSession = resolve; })' : 'Promise.resolve({data:{session:session()},error:null})'},
      onAuthStateChange: fn => { listener = fn; return {data:{subscription:{unsubscribe(){ listener = null; }}}}; },
      signInWithOAuth: async options => { window.__receiptLoginOptions = options; return { data:{}, error:null }; },
      signOut: async () => { user = null; listener?.('SIGNED_OUT', null); return {error:null}; },
    }, functions: { invoke: async () => { throw new Error('이 접근 검사에서는 AI를 호출하면 안 됩니다.'); } } };
  ` }));
  return { errors, remoteCalls };
}
async function createBook(page: Page) {
  await page.goto('/tools/receipts/new');
  await page.getByLabel('제목', { exact: true }).fill('일반 교사 공개 검증 장부');
  await page.getByLabel('학급', { exact: true }).fill('가상 5학년 2반');
  await page.getByLabel('전체 예산').fill('500000');
  await page.getByRole('button', { name: '장부 만들기', exact: true }).click();
  await expect(page.getByRole('tab', { name: /영수증 등록/ })).toBeVisible();
  return page.url();
}

for (const width of [1366, 390]) test(`일반 교사 홈 카드·장부 생성·수기 반영·정산·출력 ${width}`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  const { errors, remoteCalls } = await setup(page);
  await page.goto('/');
  const card = page.getByRole('button', { name: /^학급 운영비 영수증 시작하기/ });
  await expect(card).toBeEnabled();
  await expect(card).not.toContainText(/관리자|개발 중/);
  await page.screenshot({ path: testInfo.outputPath('teacher-home.png'), fullPage: true });
  await card.click();
  await expect(page.getByRole('heading', { name: '아직 학급 운영비 장부가 없습니다' })).toBeVisible();
  const url = await createBook(page);
  await page.screenshot({ path: testInfo.outputPath('teacher-empty-book.png'), fullPage: true });
  await page.getByRole('button', { name: '직접 입력', exact: true }).click();
  await page.getByLabel('사용처', { exact: true }).fill('가상 문구점');
  await page.getByLabel('사용 목적', { exact: true }).fill('학급 미술 재료');
  await page.getByLabel('금액', { exact: true }).fill('12000');
  await page.getByRole('button', { name: '이 지출을 장부에 반영', exact: true }).click();
  await page.getByRole('tab', { name: /정산내역/ }).click();
  await expect(page.getByRole('table')).toContainText('가상 문구점');
  await expect(page.getByRole('region', { name: '예산 현황' })).toContainText('488,000원');
  for (const name of ['Excel 정산내역', '영수증 첨부 PDF']) {
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name, exact: true }).click();
    const download = await downloading;
    await download.saveAs(testInfo.outputPath(download.suggestedFilename()));
    expect(await download.failure()).toBeNull();
  }
  await page.reload();
  await page.getByRole('tab', { name: /정산내역/ }).click();
  await expect(page.getByRole('table')).toContainText('가상 문구점');
  await page.screenshot({ path: testInfo.outputPath('teacher-settlement.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
  await page.evaluate(user => (window as unknown as { __receiptSetUser: (user: unknown) => void }).__receiptSetUser(user), { ...teacher, id: 'other-receipt-teacher' });
  await expect(page.getByText('장부를 찾을 수 없습니다.', { exact: false })).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);
  await page.goto('/tools/receipts');
  await expect(page.getByRole('heading', { name: '아직 학급 운영비 장부가 없습니다' })).toBeVisible();
  await page.evaluate(user => (window as unknown as { __receiptSetUser: (user: unknown) => void }).__receiptSetUser(user), teacher);
  await page.goto(url);
  await page.getByRole('tab', { name: /정산내역/ }).click();
  await expect(page.getByRole('table')).toContainText('가상 문구점');
  expect(errors).toEqual([]); expect(remoteCalls).toEqual([]);
});

test('로그아웃 상태는 홈 카드와 직접 주소 모두 로그인 안내만 보여 준다', async ({ page }, testInfo) => {
  const { errors, remoteCalls } = await setup(page, null);
  await page.goto('/');
  await page.getByRole('button', { name: /^학급 운영비 영수증 시작하기/ }).click();
  for (const path of ['/tools/receipts', '/tools/receipts/new', '/tools/receipts/another-account-book']) {
    await page.goto(path);
    const main = page.getByRole('main');
    await expect(main.getByRole('button', { name: 'Google로 로그인', exact: true })).toBeVisible();
    await expect(page.getByLabel('전체 예산')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '새 장부 만들기', exact: true })).toHaveCount(0);
    await expect(page.getByRole('table')).toHaveCount(0);
  }
  await page.getByRole('main').getByRole('button', { name: 'Google로 로그인', exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { __receiptLoginOptions: { options: { redirectTo: string } } }).__receiptLoginOptions.options.redirectTo)).toContain('/tools/receipts/another-account-book');
  await page.screenshot({ path: testInfo.outputPath('logged-out.png'), fullPage: true });
  expect(errors).toEqual([]); expect(remoteCalls).toEqual([]);
});

test('로그인 확인 중에는 장부를 열지 않고 확인 후 일반 교사에게 연다', async ({ page }) => {
  const { errors } = await setup(page, teacher, true);
  await page.goto('/tools/receipts/new');
  await expect(page.getByText('로그인 상태를 확인하고 있습니다.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('전체 예산')).toHaveCount(0);
  await page.evaluate(() => (window as unknown as { __receiptResolveSession: () => void }).__receiptResolveSession());
  await expect(page.getByLabel('전체 예산')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Supabase 익명 로그인 계정도 장부와 AI 입력을 열지 않는다', async ({ page }) => {
  await setup(page, { ...teacher, is_anonymous: true });
  await page.goto('/tools/receipts/new');
  await expect(page.getByRole('main').getByRole('button', { name: 'Google로 로그인', exact: true })).toBeVisible();
  await expect(page.getByLabel('전체 예산')).toHaveCount(0);
  await expect(page.getByLabel('영수증 증빙 파일')).toHaveCount(0);
});

test('IndexedDB 원본은 계정·장부 키로 격리하고 로그아웃 후에는 장부를 숨긴다', async ({ page }) => {
  const { errors, remoteCalls } = await setup(page);
  const url = await createBook(page);
  const bookId = url.split('/').pop()!;
  const isolated = await page.evaluate(async ({ ownerId, bookId }) => {
    const modulePath = '/src/features/classBudgetReceipts/receiptOriginalStore.ts';
    const { putReceiptOriginal, getReceiptOriginal } = await import(modulePath);
    await putReceiptOriginal(ownerId, bookId, 'virtual-file', new File(['virtual-original'], '가상 원본.txt'));
    return {
      own: await (await getReceiptOriginal(ownerId, bookId, 'virtual-file'))?.text(),
      otherAccount: Boolean(await getReceiptOriginal('other-teacher', bookId, 'virtual-file')),
      otherBook: Boolean(await getReceiptOriginal(ownerId, 'other-book', 'virtual-file')),
    };
  }, { ownerId: teacher.id, bookId });
  expect(isolated).toEqual({ own: 'virtual-original', otherAccount: false, otherBook: false });
  await page.evaluate(() => (window as unknown as { __receiptSetUser: (user: unknown) => void }).__receiptSetUser(null));
  await expect(page.getByRole('main').getByRole('button', { name: 'Google로 로그인', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: /영수증 등록/ })).toHaveCount(0);
  expect(errors).toEqual([]); expect(remoteCalls).toEqual([]);
});
