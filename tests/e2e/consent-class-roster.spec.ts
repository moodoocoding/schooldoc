import { expect, test, type Page } from '@playwright/test';
import { jsPDF } from 'jspdf';
import { defaultRoleState, parseRoleRoster } from '../../supabase/functions/_shared/classroomRoles';
import { confirmConsentPlacementPreview, finishConsentFieldPlacement } from './consentFieldPlacement';

const demoKey = 'schooldoc_classroom_roles_demo_v1';
const recipients = (page: Page) => page.locator('section').filter({ has: page.getByRole('heading', { name: '수신자 명단', exact: true }) });

async function openRecipients(page: Page) {
  const pdf = new jsPDF();
  pdf.text('Class notice', 20, 25);
  await page.goto('/tools/consent-forms/new');
  await page.getByLabel('가정통신문 PDF 파일').setInputFiles({
    name: 'class-notice.pdf', mimeType: 'application/pdf', buffer: Buffer.from(pdf.output('arraybuffer')),
  });
  await page.getByRole('textbox', { name: '제목', exact: true }).fill('우리반 가정통신문');
  await page.getByRole('button', { name: '확인 후 필드 배치' }).click();
  await page.getByRole('button', { name: '텍스트', exact: true }).click();
  await finishConsentFieldPlacement(page);
  await expect(page.getByRole('heading', { name: '누가 응답할지 정하기' })).toBeVisible();
}

test('설정에서 저장한 우리반 명단을 번호순으로 추가하고 기존 수신자와 동명이인을 유지한다', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: '설정', exact: true }).click();
  await page.getByRole('button', { name: '학급 학생 명단', exact: true }).click();
  await page.getByLabel('학생 명단 (한 줄에 번호와 이름)').fill('10 가상하늘\n2 가상바다\n1 가상하늘');
  await page.getByRole('button', { name: '학생 명단 저장', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '학생 명단을 저장했습니다.' })).toBeVisible();
  const savedBoard = await page.evaluate((key) => localStorage.getItem(key), demoKey);

  await openRecipients(page);
  await page.getByLabel('이름 (필수)').fill('기존수신자');
  await page.getByRole('button', { name: '추가', exact: true }).click();
  const importButton = page.getByRole('button', { name: '우리반 불러오기', exact: true });
  await importButton.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText('우리반 명단에서 3명을 불러왔습니다.');
  await expect(recipients(page).locator('li')).toHaveText(['1기존수신자', '2가상하늘1', '3가상바다2', '4가상하늘10']);
  await page.screenshot({ path: test.info().outputPath('consent-class-roster-desktop.png'), fullPage: true });

  await importButton.click();
  await expect(page.getByRole('status')).toContainText('0명을 불러왔습니다.');
  await expect(page.getByRole('status')).toContainText('중복 3명 제외');
  await expect(recipients(page).locator('li')).toHaveCount(4);
  await page.getByRole('button', { name: '가상바다 삭제' }).click();
  await importButton.click();
  await expect(page.getByRole('status')).toContainText('1명을 불러왔습니다.');
  await expect(recipients(page).locator('li')).toHaveCount(4);
  expect(await page.evaluate((key) => localStorage.getItem(key), demoKey)).toBe(savedBoard);

  await page.getByLabel('명단 없이 받기').check();
  await expect(importButton).toHaveCount(0);
  await page.getByLabel('명단으로 받기').check();
  await expect(recipients(page).locator('li')).toHaveCount(4);
  await page.getByRole('button', { name: '다음: 공유 설정' }).click();
  await expect(page.getByText('명단 4명', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '수신자 설정으로' }).click();
  await expect(recipients(page).locator('li')).toHaveCount(4);
  await page.getByRole('button', { name: '다음: 공유 설정' }).click();
  await confirmConsentPlacementPreview(page);
  await page.getByRole('button', { name: '수합 만들기' }).click();
  await expect(page.getByRole('heading', { name: '우리반 가정통신문', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('빈 명단과 불러오기 실패를 안내하고 기존 입력을 유지한 채 재시도한다', async ({ page }) => {
  await openRecipients(page);
  const importButton = page.getByRole('button', { name: '우리반 불러오기', exact: true });
  await importButton.click();
  await expect(page.getByRole('status')).toContainText('설정 > 학급 학생 명단');
  await expect(page.getByRole('button', { name: '다음: 공유 설정' })).toBeDisabled();
  await page.screenshot({ path: test.info().outputPath('consent-class-roster-empty.png'), fullPage: true });
  await page.getByLabel('이름 (필수)').fill('기존수신자');
  await page.getByRole('button', { name: '추가', exact: true }).click();
  await page.getByLabel('이름 (필수)').fill('입력중이름');
  await page.getByLabel('식별값 (선택)').fill('입력중식별값');
  const savedBoard = await page.evaluate((key) => {
    const saved = localStorage.getItem(key)!;
    localStorage.setItem(key, 'invalid-demo-data');
    return saved;
  }, demoKey);
  await importButton.click();
  await expect(page.getByRole('alert')).toContainText('우리반 명단을 불러오지 못했습니다.');
  await expect(page.getByRole('alert')).not.toContainText('invalid-demo-data');
  await expect(recipients(page).locator('li')).toHaveText(['1기존수신자']);
  await expect(page.getByLabel('이름 (필수)')).toHaveValue('입력중이름');
  await expect(page.getByLabel('식별값 (선택)')).toHaveValue('입력중식별값');
  await page.evaluate(({ key, saved, roster }) => {
    const board = JSON.parse(saved);
    board.state.roster = roster;
    localStorage.setItem(key, JSON.stringify(board));
  }, { key: demoKey, saved: savedBoard, roster: parseRoleRoster('1 가상하늘') });
  await importButton.click();
  await expect(page.getByRole('status')).toContainText('1명을 불러왔습니다.');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(recipients(page).locator('li')).toHaveText(['1기존수신자', '2가상하늘1']);
});

test('모바일에서 우리반 버튼과 명단이 가로 넘침 없이 표시된다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(({ key, state }) => {
    localStorage.setItem(key, JSON.stringify({ id: 'demo-class', version: 1, public_token: 'demo-token', state }));
  }, { key: demoKey, state: { ...defaultRoleState(), roster: parseRoleRoster('1 가상하늘\n2 가상바다') } });
  await openRecipients(page);
  const importButton = page.getByRole('button', { name: '우리반 불러오기', exact: true });
  await importButton.click();
  await expect(recipients(page).locator('li')).toHaveCount(2);
  await expect(page.getByRole('button', { name: '엑셀 불러오기' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'PDF 불러오기' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('consent-class-roster-mobile.png'), fullPage: true });
  for (const count of [23, 60]) {
    const roster = parseRoleRoster(Array.from({ length: count }, (_, index) =>
      `${index + 1} ${index === 0 ? '가상하늘' : index === 1 ? '가상바다' : index === 14 ? '가상학생긴이름확인용이름' : `가상학생${index + 1}`}`).join('\n'));
    await page.evaluate(({ key, roster }) => {
      const board = JSON.parse(localStorage.getItem(key)!);
      board.state.roster = roster;
      localStorage.setItem(key, JSON.stringify(board));
    }, { key: demoKey, roster });
    await importButton.click();
    await expect(recipients(page).locator('li')).toHaveCount(count);
    await page.setViewportSize({ width: count === 23 ? 1366 : 390, height: 844 });
    await page.screenshot({ path: test.info().outputPath(`consent-class-roster-${count}.png`), fullPage: true });
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('consent-class-roster-60-large-text.png'), fullPage: true });
  await page.getByRole('button', { name: '다음: 공유 설정' }).click();
  await expect(page.getByText('명단 60명', { exact: true })).toBeVisible();
});
