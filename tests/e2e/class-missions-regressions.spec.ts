import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { missionToday } from '../../supabase/functions/_shared/classMissions';

const key = 'schooldoc_class_missions_demo_v1';
async function seed(page: Page, names = ['가상하늘', '가상바다']) {
  await page.goto('/tools/class-missions');
  await page.evaluate(({ key, names, today }) => {
    const roster = names.map((name, i) => ({ id: crypto.randomUUID(), number: i + 1, name, codeHash: '' }));
    const mission = { id: crypto.randomUUID(), title: '지금 할 가상 미션', description: '가상 활동을 마치세요.', startDate: today,
      dueDate: today, requiresConfirmation: true, status: 'open', targets: roster.map(({ id, number, name }) => ({ id, number, name })),
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    localStorage.setItem(key, JSON.stringify([{ id: crypto.randomUUID(), publicToken: crypto.randomUUID(), publicEnabled: true,
      version: 1, updatedAt: new Date().toISOString(), state: { className: '가상 회귀 학급', roster, missions: [mission], checks: [], events: [] } }]));
  }, { key, names, today: missionToday() });
  await page.reload();
  await expect(page.getByRole('region', { name: '미션 현황' })).toBeVisible();
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!)[0], key);
}
async function issueCode(page: Page, index = 0) {
  await page.locator('summary').filter({ hasText: '학급 명단 및 개인 코드' }).click();
  page.once('dialog', d => d.accept());
  await page.getByRole('button', { name: '코드 재발급' }).nth(index).click();
  const code = (await page.getByRole('region', { name: '이번에 발급한 개인 코드' }).locator('strong').textContent())!;
  await page.getByRole('button', { name: '코드 목록 닫기' }).click();
  return code;
}
async function enter(page: Page, token: string, value: string, code = false) {
  await page.goto('/s/missions/' + token);
  if (code) await page.getByRole('button', { name: '개인 코드로 접속' }).click();
  const input = page.getByRole('textbox', { name: code ? '개인 접속 코드' : '학생 이름' });
  await input.fill(value); await input.press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/의 미션$/);
}
async function delayHash(page: Page) {
  await page.evaluate(() => {
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    const state = window as typeof window & { missionHashPending: boolean; releaseMissionHash: () => void; missionHashDone: boolean };
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    state.releaseMissionHash = release;
    crypto.subtle.digest = async (...args) => { state.missionHashPending = true; await gate; const value = await digest(...args); state.missionHashDone = true; return value; };
  });
}
async function releaseHash(page: Page) {
  await page.evaluate(() => (window as typeof window & { releaseMissionHash: () => void }).releaseMissionHash());
  await page.waitForFunction(() => (window as typeof window & { missionHashDone: boolean }).missionHashDone);
  // Flush the API continuation and React update after the deliberately deferred request.
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 100)));
}

test('동명 이름은 저장하지 않고 개인 코드로 두 번째 학생만 완료 표시한다', async ({ page, context }) => {
  const initial = await seed(page, ['가상동명', '가상동명']);
  const code = await issueCode(page, 1);
  const student = await context.newPage(); await student.setViewportSize({ width: 390, height: 844 });
  await student.goto('/s/missions/' + initial.publicToken);
  await student.getByRole('textbox', { name: '학생 이름' }).fill('가상동명');
  await student.getByRole('button', { name: '내 미션 보기' }).click();
  await expect(student.getByRole('alert')).toContainText('개인 코드');
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!)[0].state.checks, key)).toEqual([]);
  await enter(student, initial.publicToken, code, true);
  await expect(student.getByRole('heading', { level: 1 })).toBeFocused();
  await student.getByRole('button', { name: '완료했어요' }).click();
  await expect(student.getByText('확인 기다리는 중', { exact: true })).toBeVisible();
  const checks = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!)[0].state.checks, key);
  expect(checks).toHaveLength(1); expect(checks[0].studentId).toBe(initial.state.roster[1].id);
  await page.getByRole('button', { name: 'QR·학생 링크' }).click();
  await expect(page.locator('summary').filter({ hasText: '학생 참여 링크' })).toBeFocused();
  await expect(page.getByRole('region', { name: '학생 참여 링크' })).toBeVisible();
});

for (const action of ['mark', 'refresh'] as const) {
  test(action + ': 나가기 후 새 학생 접속에 늦은 이전 응답을 적용하지 않는다', async ({ page, context }) => {
    const initial = await seed(page); const code = await issueCode(page);
    const student = await context.newPage(); await enter(student, initial.publicToken, code, true);
    const errors: string[] = []; student.on('pageerror', e => errors.push(e.message));
    await delayHash(student);
    await student.getByRole('button', { name: action === 'mark' ? '완료했어요' : '새로고침' }).click();
    await student.waitForFunction(() => (window as typeof window & { missionHashPending: boolean }).missionHashPending);
    await student.getByRole('button', { name: '나가기' }).click();
    await expect(student.getByRole('textbox', { name: '학생 이름' })).toBeFocused();
    await student.getByRole('textbox', { name: '학생 이름' }).fill('가상바다');
    await student.getByRole('button', { name: '내 미션 보기' }).click();
    await expect(student.getByRole('heading', { name: '가상바다의 미션' })).toBeVisible();
    await releaseHash(student);
    await expect(student.getByRole('heading', { name: '가상바다의 미션' })).toBeVisible();
    await expect(student.getByRole('heading', { name: '가상하늘의 미션' })).toHaveCount(0);
    await expect(student.getByRole('button', { name: '완료했어요' })).toBeEnabled();
    expect(errors).toEqual([]);
  });
}

test('학생 제출 충돌 후 교사의 제목·안내·기간·대상·명단을 보존하고 수동 재저장한다', async ({ page, context }) => {
  const initial = await seed(page);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const student = await context.newPage(); await enter(student, initial.publicToken, '가상하늘');
  await student.getByRole('button', { name: '완료했어요' }).click();
  await expect(student.getByText('확인 기다리는 중', { exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: '1번 가상하늘 상태 정정' }).selectOption('confirmed');
  await expect(page.getByRole('alert')).toContainText('다른 화면에서 변경');
  await page.getByRole('button', { name: '새로고침' }).click();
  await page.getByRole('button', { name: '새 미션', exact: true }).click();
  const editor = page.getByRole('region', { name: '새 미션 만들기' });
  await editor.getByRole('textbox', { name: '미션 제목' }).fill('보존할 가상 초안');
  await editor.getByRole('textbox', { name: '학생에게 보일 안내' }).fill('보존할 상세 안내');
  await editor.getByLabel('시작일', { exact: true }).fill('2026-11-01');
  await editor.getByLabel('마감일', { exact: true }).fill('2026-11-10');
  await editor.getByRole('checkbox', { name: /교사 확인 필요/ }).check();
  await editor.getByRole('checkbox', { name: '2번 가상바다', exact: true }).uncheck();
  await page.locator('summary').filter({ hasText: '학급 명단 및 개인 코드' }).click();
  await page.getByRole('textbox', { name: '편집 명단' }).fill('1 가상하늘\n2 가상바다\n3 가상추가예정');
  await student.getByRole('button', { name: '완료 표시 취소' }).click();
  await expect(student.getByRole('button', { name: '완료했어요' })).toBeVisible();
  await editor.getByRole('button', { name: '초안 저장' }).click();
  await expect(page.getByRole('alert').first()).toContainText('다른 화면에서 변경');
  await page.getByRole('button', { name: '새로고침' }).click();
  await expect(editor.getByRole('textbox', { name: '미션 제목' })).toHaveValue('보존할 가상 초안');
  await expect(editor.getByRole('textbox', { name: '학생에게 보일 안내' })).toHaveValue('보존할 상세 안내');
  await expect(editor.getByLabel('시작일', { exact: true })).toHaveValue('2026-11-01');
  await expect(editor.getByLabel('마감일', { exact: true })).toHaveValue('2026-11-10');
  await expect(editor.getByRole('checkbox', { name: /교사 확인 필요/ })).toBeChecked();
  await expect(editor.getByRole('checkbox', { name: '2번 가상바다', exact: true })).not.toBeChecked();
  await expect(page.getByRole('textbox', { name: '편집 명단' })).toHaveValue('1 가상하늘\n2 가상바다\n3 가상추가예정');
  await editor.getByRole('button', { name: '초안 저장' }).click();
  await expect(page.getByRole('region', { name: '미션 현황' })).toContainText('보존할 가상 초안');
  expect(errors).toEqual([]);
});

test('수행 가능한 미션을 우선하고 과거 기록·시작 전 상태를 계속 열어 볼 수 있다', async ({ page, context }) => {
  const initial = await seed(page);
  await page.evaluate((key) => {
    const boards = JSON.parse(localStorage.getItem(key)!); const b = boards[0]; const active = b.state.missions[0];
    b.state.missions = [
      ...Array.from({ length: 5 }, (_, i) => ({ ...active, id: crypto.randomUUID(), title: '종료된 기록 ' + i, status: 'closed', startDate: '2026-01-01', dueDate: '2026-01-02', closedAt: new Date().toISOString() })),
      { ...active, id: crypto.randomUUID(), title: '시작 전 가상 미션', startDate: '2099-01-01', dueDate: '2099-01-10' }, active,
    ]; localStorage.setItem(key, JSON.stringify(boards));
  }, key);
  const student = await context.newPage(); await student.setViewportSize({ width: 390, height: 844 });
  await enter(student, initial.publicToken, '가상하늘');
  await expect(student.getByRole('region', { name: '지금 할 미션', exact: true })).toContainText('지금 할 가상 미션');
  expect((await student.getByRole('button', { name: '완료했어요' }).boundingBox())!.y).toBeLessThan(844);
  await student.locator('summary').filter({ hasText: '시작 전·지난 미션' }).click();
  await expect(student.getByText('종료된 기록 0', { exact: true })).toBeVisible();
  await expect(student.getByText('시작 전', { exact: true })).toBeVisible();
  const accessibility = await new AxeBuilder({ page: student }).analyze(); expect(accessibility.violations).toEqual([]);
  await page.reload();
  await page.getByRole('button', { name: /시작 전 가상 미션/ }).click();
  await expect(page.getByRole('region', { name: '미션 현황' })).toContainText('시작 전');
  await page.getByRole('button', { name: '진행 중', exact: true }).click();
  await expect(page.getByText('시작 전 가상 미션', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('시작 전', { exact: true }).first()).toBeVisible();
});

test('저장한 초안에서 발행 준비를 다시 열면 기존 입력과 대상이 유지된다', async ({ page }) => {
  await seed(page);
  await page.getByRole('button', { name: '새 미션', exact: true }).click();
  const editor = page.getByRole('region', { name: '새 미션 만들기' });
  await editor.getByRole('textbox', { name: '미션 제목' }).fill('다시 발행할 가상 초안');
  await editor.getByRole('button', { name: '초안 저장' }).click();
  await expect(page.getByRole('region', { name: '미션 현황' })).toContainText('다시 발행할 가상 초안');
  await page.getByRole('button', { name: '발행 준비' }).click();
  const reopened = page.getByRole('region', { name: '미션 수정' });
  await expect(reopened.getByRole('textbox', { name: '미션 제목' })).toHaveValue('다시 발행할 가상 초안');
  await expect(reopened).toContainText('대상 학생 · 2명');
  await reopened.getByRole('button', { name: '발행 전 확인' }).click();
  await reopened.getByRole('button', { name: '이 내용으로 발행' }).click();
  await expect(page.getByRole('region', { name: '미션 현황' })).toContainText('진행 중');
});
