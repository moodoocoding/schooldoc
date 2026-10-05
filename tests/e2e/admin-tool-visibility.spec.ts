import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const admin = { id: 'fixture-preview-admin', email: 'panthea0@gmail.com', email_confirmed_at: '2026-10-05T00:00:00Z', is_anonymous: false, app_metadata: {}, user_metadata: { name: '가상 관리자' } };
const teacher = { ...admin, id: 'fixture-preview-teacher', email: 'teacher@example.invalid', user_metadata: { name: '가상 일반 교사' } };
const previewNames = ['이수증 수합', '문서 서명', '분실물 관리', '물품 대여'];
type FixtureUser = typeof admin | null;

async function setup(page: Page, user: FixtureUser, pending = false) {
  const errors: string[] = [];
  const remoteCalls: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css', route => route.fulfill({ contentType: 'text/css', body: '' }));
  await page.route(/https:\/\/[^/]+\/(auth|rest|functions|storage)\/v1\//, route => {
    remoteCalls.push(route.request().url());
    return route.abort();
  });
  // 가상 인증 이벤트만 전달하며 Google·운영 Supabase를 호출하지 않는다.
  await page.route('**/src/utils/supabaseClient.ts', route => route.fulfill({ contentType: 'application/javascript', body: `
    export const isSupabaseConfigured = true;
    let user = ${JSON.stringify(user)};
    let listener;
    let resolveSession;
    const session = () => user ? { user } : null;
    window.__previewSetUser = next => { user = next; listener?.(next ? 'SIGNED_IN' : 'SIGNED_OUT', session()); };
    window.__previewResolveSession = () => resolveSession?.({ data: { session: session() }, error: null });
    export const supabase = { auth: {
      getSession: () => ${pending ? 'new Promise(resolve => { resolveSession = resolve; })' : 'Promise.resolve({data:{session:session()},error:null})'},
      onAuthStateChange: fn => { listener = fn; return {data:{subscription:{unsubscribe(){listener = null;}}}}; },
      signOut: async () => { user = null; listener?.('SIGNED_OUT', null); return {error:null}; },
    }, functions: { invoke: async () => { throw new Error('표시 검사에서는 원격 함수를 호출하지 않습니다.'); } } };
  ` }));
  return { errors, remoteCalls };
}

async function changeUser(page: Page, user: FixtureUser) {
  await page.evaluate(next => (window as unknown as { __previewSetUser: (user: unknown) => void }).__previewSetUser(next), user);
}

async function expectPreviewCards(page: Page, visible: boolean) {
  for (const name of previewNames) {
    const card = page.getByRole('main').getByRole('button', { name: new RegExp(`^${name}\\.`) });
    if (visible) {
      await expect(card).toBeVisible();
      await expect(card).toBeDisabled();
      await expect(card).toContainText('개발 중');
    } else {
      await expect(card).toHaveCount(0);
    }
  }
  await expect(page.getByRole('heading', { name: `전체 업무 도구 (${visible ? 12 : 8})`, exact: true })).toBeVisible();
}

async function openQuickMenu(page: Page, width: number) {
  if (width < 768) await page.getByRole('button', { name: '사이드바 메뉴 열기' }).click();
  await page.getByRole('button', { name: '퀵 메뉴 추가', exact: true }).click();
  return page.getByRole('dialog');
}

for (const width of [1366, 390]) {
  for (const [label, user] of [['로그아웃', null], ['일반 교사', teacher], ['관리자', admin]] as const) {
    test(`${label}의 홈·검색·퀵 메뉴 표시 ${width}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      const evidence = await setup(page, user);
      await page.goto('/');
      await expectPreviewCards(page, label === '관리자');
      await expect(page.getByRole('button', { name: /^학급 운영비 영수증 시작하기/ })).toBeVisible();
      await expect(page.locator('vite-error-overlay')).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath('home-full.png'), fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      const accessibility = await new AxeBuilder({ page }).include('main').analyze();
      await testInfo.attach('accessibility', { body: JSON.stringify(accessibility.violations, null, 2), contentType: 'application/json' });
      // 기존 홈의 상단 문구·상태 배지는 대비가 부족하다. 알려진 세 표현만
      // 별도 기록하며 다른 요소나 다른 규칙의 오류는 실패로 처리한다.
      const unexpectedViolations = accessibility.violations.filter(violation => !(
        violation.id === 'color-contrast' && violation.nodes.every(node =>
          node.html.includes('>스쿨독 스마트 교무 센터</span>') || node.html.includes('>새로 만들기</span>') || node.html.includes('>로그인 후 사용</span>'),
        )
      ));
      expect(unexpectedViolations).toEqual([]);
      const search = page.getByRole('textbox', { name: '업무 도구 검색' });
      await expect(search).not.toHaveAttribute('placeholder', /이수증/);
      await search.focus();
      await expect(search).toBeFocused();
      for (const name of previewNames) {
        await search.fill(name);
        if (label === '관리자') await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
        else {
          await expect(page.getByRole('heading', { name, exact: true })).toHaveCount(0);
          await expect(page.getByText('에 해당되는 도구를 찾지 못했습니다.', { exact: false })).toBeVisible();
        }
      }
      await page.getByRole('button', { name: '검색어 지우기' }).click();
      await expectPreviewCards(page, label === '관리자');
      const dialog = await openQuickMenu(page, width);
      for (const name of previewNames) {
        await expect(dialog.getByRole('button', { name: `${name} + 추가`, exact: true })).toHaveCount(label === '관리자' ? 1 : 0);
      }
      await page.screenshot({ path: testInfo.outputPath('quick-menu-full.png'), fullPage: true });
      expect(evidence.errors).toEqual([]);
      expect(evidence.remoteCalls).toEqual([]);
    });
  }
}

test('로그인 확인 중에는 숨기고 관리자 세션 확인 후에 표시한다', async ({ page }) => {
  const evidence = await setup(page, admin, true);
  await page.goto('/');
  await expectPreviewCards(page, false);
  const dialog = await openQuickMenu(page, 1366);
  for (const name of previewNames) await expect(dialog.getByText(name, { exact: true })).toHaveCount(0);
  await page.evaluate(() => (window as unknown as { __previewResolveSession: () => void }).__previewResolveSession());
  await expectPreviewCards(page, true);
  for (const name of previewNames) await expect(dialog.getByText(name, { exact: true })).toBeVisible();
  expect(evidence.errors).toEqual([]);
  expect(evidence.remoteCalls).toEqual([]);
});

test('관리자 퀵 메뉴 등록 후 일반 계정 전환·로그아웃 시 카드·메뉴·개수를 즉시 갱신한다', async ({ page }) => {
  const evidence = await setup(page, admin);
  await page.goto('/');
  await expectPreviewCards(page, true);
  await page.locator('aside').hover();
  const dialog = await openQuickMenu(page, 1366);
  await dialog.getByRole('button', { name: '문서 서명 + 추가', exact: true }).click();
  await page.locator('aside').hover();
  await expect(page.locator('aside').getByText('문서 서명 (개발 중)', { exact: true })).toBeVisible();
  await expect(page.getByText('퀵 메뉴 (3/5)', { exact: true })).toBeVisible();
  await changeUser(page, teacher);
  await expectPreviewCards(page, false);
  await expect(page.locator('aside').getByText('문서 서명 (개발 중)', { exact: true })).toHaveCount(0);
  await expect(page.getByText('퀵 메뉴 (2/5)', { exact: true })).toBeVisible();
  await openQuickMenu(page, 1366);
  await changeUser(page, admin);
  await expectPreviewCards(page, true);
  await expect(page.getByRole('dialog').getByText('이수증 수합', { exact: true })).toBeVisible();
  await changeUser(page, null);
  await expectPreviewCards(page, false);
  for (const name of previewNames) await expect(page.getByRole('dialog').getByText(name, { exact: true })).toHaveCount(0);
  expect(evidence.errors).toEqual([]);
  expect(evidence.remoteCalls).toEqual([]);
});

for (const [label, user] of [
  ['익명', { ...admin, is_anonymous: true }],
  ['미확인 이메일', { ...admin, email_confirmed_at: '' }],
  ['다른 계정의 admin 역할', { ...teacher, app_metadata: { role: 'admin' }, user_metadata: { name: '가상 역할 위장', role: 'admin', email: admin.email } }],
] as const) {
  test(`${label} 계정에는 관리자 도구를 표시하지 않는다`, async ({ page }) => {
    const evidence = await setup(page, user);
    await page.goto('/');
    await expectPreviewCards(page, false);
    expect(evidence.errors).toEqual([]);
    expect(evidence.remoteCalls).toEqual([]);
  });
}

test('미구현 도구 주소를 직접 입력해도 일반 사용자에게는 숨겨진 홈만 보여준다', async ({ page }) => {
  const evidence = await setup(page, teacher);
  for (const id of ['cert-collect', 'doc-sign', 'lost-found', 'item-rent']) {
    await page.goto(`/tools/${id}`);
    await expectPreviewCards(page, false);
  }
  expect(evidence.errors).toEqual([]);
  expect(evidence.remoteCalls).toEqual([]);
});

test('200% 크기의 좁은 화면에서도 일반 교사 홈이 가로로 넘치지 않는다', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 683, height: 900 });
  const evidence = await setup(page, teacher);
  await page.goto('/');
  await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
  await expectPreviewCards(page, false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath('home-200-percent-full.png'), fullPage: true });
  expect(evidence.errors).toEqual([]);
  expect(evidence.remoteCalls).toEqual([]);
});
