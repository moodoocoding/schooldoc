import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const admin = { id: 'fixture-preview-admin', email: 'panthea0@gmail.com', email_confirmed_at: '2026-10-05T00:00:00Z', is_anonymous: false, app_metadata: {}, user_metadata: { name: '가상 관리자' } };
const teacher = { ...admin, id: 'fixture-preview-teacher', email: 'teacher@example.invalid', user_metadata: { name: '가상 일반 교사' } };
const previewNames = ['이수증 수합', '문서 서명', '물품 대여', 'Neis Helper'];
const adminOnlyNames = [...previewNames, '학교 문서 작성'];
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
    const card = page.getByRole('main').getByRole('button', { name: new RegExp(`^${name}(?: 기능 살펴보기)?\\.`) });
    if (visible) {
      await expect(card).toBeVisible();
      if (name === 'Neis Helper') await expect(card).toBeEnabled();
      else await expect(card).toBeDisabled();
      await expect(card).toContainText('개발 중');
    } else {
      await expect(card).toHaveCount(0);
    }
  }
  const planCard = page.getByRole('main').getByRole('button', { name: /^학교 문서 작성 시작하기/ });
  if (visible) {
    await expect(planCard).toBeVisible();
    await expect(planCard).toBeEnabled();
    await expect(planCard).toContainText('관리자 미리보기');
  } else await expect(planCard).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '분실물 관리', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: `전체 업무 도구 (${visible ? 13 : 8})`, exact: true })).toBeVisible();
}

async function openQuickMenu(page: Page, width: number) {
  if (width < 768) await page.getByRole('button', { name: '사이드바 메뉴 열기' }).click();
  else {
    await page.locator('aside').hover();
    await expect(page.locator('aside').getByText(/^퀵 메뉴 \(\d+\/5\)$/)).toBeVisible();
  }
  await page.getByRole('button', { name: '퀵 메뉴 추가', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  return dialog;
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
      for (const name of adminOnlyNames) {
        await search.fill(name);
        if (label === '관리자') await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
        else {
          await expect(page.getByRole('heading', { name, exact: true })).toHaveCount(0);
          await expect(page.getByText('에 해당되는 도구를 찾지 못했습니다.', { exact: false })).toBeVisible();
        }
      }
      await search.fill('분실물 관리');
      await expect(page.getByRole('heading', { name: '분실물 관리', exact: true })).toHaveCount(0);
      await expect(page.getByText('에 해당되는 도구를 찾지 못했습니다.', { exact: false })).toBeVisible();
      await page.getByRole('button', { name: '검색어 지우기' }).click();
      await expectPreviewCards(page, label === '관리자');
      const dialog = await openQuickMenu(page, width);
      for (const name of adminOnlyNames) {
        await expect(dialog.getByRole('button', { name: `${name} + 추가`, exact: true })).toHaveCount(label === '관리자' ? 1 : 0);
      }
      await expect(dialog.getByRole('button', { name: '분실물 관리 + 추가', exact: true })).toHaveCount(0);
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
  for (const name of adminOnlyNames) await expect(dialog.getByText(name, { exact: true })).toHaveCount(0);
  await page.evaluate(() => (window as unknown as { __previewResolveSession: () => void }).__previewResolveSession());
  await expectPreviewCards(page, true);
  for (const name of adminOnlyNames) await expect(dialog.getByText(name, { exact: true })).toBeVisible();
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
  for (const id of ['cert-collect', 'doc-sign', 'lost-found', 'item-rent', 'neis-helper']) {
    await page.goto(`/tools/${id}`);
    await expectPreviewCards(page, false);
  }
  expect(evidence.errors).toEqual([]);
  expect(evidence.remoteCalls).toEqual([]);
});

for (const [label, width, zoom] of [['desktop', 1366, 1], ['mobile', 390, 1], ['zoom', 683, 2]] as const) {
  test(`Neis Helper 네 기능 안내와 돌아가기 ${label}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const evidence = await setup(page, admin);
    await page.goto('/');
    const entry = page.getByRole('button', { name: /^Neis Helper 기능 살펴보기/ });
    await entry.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/tools\/neis-helper$/);
    await expect(page.getByRole('heading', { name: 'Neis Helper', exact: true })).toBeVisible();
    if (zoom > 1) await page.evaluate(value => { document.documentElement.style.zoom = String(value); }, zoom);
    for (const name of ['교과학습발달상황(세특)', '행동특성 및 발달상황', '창체 누가기록 및 특기·적성', '학교스포츠클럽 특기사항']) {
      const implemented = name === '교과학습발달상황(세특)';
      const button = page.getByRole('button', { name: `${name}. ${implemented ? '평어 작성 시작' : '개발 예정'}`, exact: true });
      await expect(button).toBeVisible();
      if (implemented) await expect(button).toBeEnabled();
      else await expect(button).toBeDisabled();
    }
    await expect(page.getByRole('main').getByRole('textbox')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    const accessibility = await new AxeBuilder({ page }).include('main').analyze();
    expect(accessibility.violations).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('neis-helper-full.png'), fullPage: true });
    await page.getByRole('button', { name: '업무 도구로', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/$/);
    await expect(entry).toBeVisible();
    expect(evidence.errors).toEqual([]);
    expect(evidence.remoteCalls).toEqual([]);
  });
}

test('Neis Helper 퀵 메뉴를 키보드로 열고 계정 전환 시 안내 화면도 숨긴다', async ({ page }) => {
  const evidence = await setup(page, admin);
  await page.goto('/');
  await expectPreviewCards(page, true);
  await page.locator('aside').hover();
  const dialog = await openQuickMenu(page, 1366);
  await dialog.getByRole('button', { name: 'Neis Helper + 추가', exact: true }).click();
  const quickButton = page.locator('aside').getByRole('button', { name: 'Neis Helper (개발 중)', exact: true });
  await quickButton.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Neis Helper', exact: true })).toBeVisible();
  await changeUser(page, teacher);
  await expectPreviewCards(page, false);
  await expect(quickButton).toHaveCount(0);
  await changeUser(page, admin);
  await expect(page.getByRole('heading', { name: 'Neis Helper', exact: true })).toBeVisible();
  await changeUser(page, null);
  await expectPreviewCards(page, false);
  expect(evidence.errors).toEqual([]);
  expect(evidence.remoteCalls).toEqual([]);
});

test('Neis Helper 직접 주소에서도 세션 확인 전에는 안내를 숨긴다', async ({ page }) => {
  const evidence = await setup(page, admin, true);
  await page.goto('/tools/neis-helper');
  await expectPreviewCards(page, false);
  await page.evaluate(() => (window as unknown as { __previewResolveSession: () => void }).__previewResolveSession());
  await expect(page.getByRole('heading', { name: 'Neis Helper', exact: true })).toBeVisible();
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

test('관리자는 홈에서 계획서를 열고 계정 전환 시 작성 화면이 즉시 닫힌다', async ({ page }, testInfo) => {
  const evidence = await setup(page, admin);
  await page.goto('/');
  await page.getByRole('button', { name: /^학교 문서 작성 시작하기/ }).click();
  await expect(page).toHaveURL(/\/tools\/school-documents$/);
  await expect(page.getByLabel('문서 종류', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('admin-plan-entry-full.png'), fullPage: true });
  await changeUser(page, teacher);
  await expect(page.getByRole('alert')).toContainText('관리자 계정');
  await expect(page.getByLabel('문서 종류')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('teacher-plan-blocked-full.png'), fullPage: true });
  await changeUser(page, null);
  await expect(page.getByRole('button', { name: 'Google로 로그인', exact: true })).toBeVisible();
  expect(evidence.errors).toEqual([]); expect(evidence.remoteCalls).toEqual([]);
});

test('삭제한 분실물 주소에서도 관리자에게 분실물 도구를 표시하지 않는다', async ({ page }) => {
  const evidence = await setup(page, admin);
  await page.goto('/tools/lost-found');
  await expectPreviewCards(page, true);
  await expect(page.getByRole('heading', { name: '분실물 관리', exact: true })).toHaveCount(0);
  expect(evidence.errors).toEqual([]); expect(evidence.remoteCalls).toEqual([]);
});
