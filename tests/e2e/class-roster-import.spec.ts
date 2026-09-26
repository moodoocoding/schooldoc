import { expect, test, type Page } from '@playwright/test';
import writeXlsxFile from 'write-excel-file/node';
import { defaultRoleState, parseRoleRoster } from '../../supabase/functions/_shared/classroomRoles';

const demoKey = 'schooldoc_classroom_roles_demo_v1';
const editor = (page: Page) => page.getByLabel('학생 명단 (한 줄에 번호와 이름)');
const fileInput = (page: Page) => page.getByTestId('class-roster-file-input');

async function openRoster(page: Page, edit = true) {
  await page.goto('/');
  const menu = page.getByRole('button', { name: '사이드바 메뉴 열기' });
  if ((page.viewportSize()?.width ?? 1280) < 768) await menu.click();
  await page.getByRole('button', { name: '설정', exact: true }).click();
  await page.getByRole('button', { name: '학급 학생 명단', exact: true }).click();
  await expect(editor(page).or(page.getByRole('heading', { name: '등록된 학생 명단', exact: true }))).toBeVisible();
  if (edit) {
    const editButton = page.getByRole('button', { name: '명단 수정', exact: true });
    if (await editButton.isVisible()) await editButton.click();
    await expect(editor(page)).toBeVisible();
  }
}

test('CSV 분석 → 미리보기 → 적용 → 저장하며 기존 학생 식별자와 배정을 보존한다', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openRoster(page);
  const state = defaultRoleState();
  state.roster = parseRoleRoster('1 가상하늘\n2 가상바다');
  state.periods = [{ id: crypto.randomUUID(), start: '2026-01-01', end: '2026-01-31', students: structuredClone(state.roster), roles: structuredClone(state.roles), assignments: Object.fromEntries(state.roster.map((student, index) => [student.id, state.roles[index].id])) }];
  await page.evaluate(({ key, state }) => {
    const board = JSON.parse(localStorage.getItem(key)!);
    localStorage.setItem(key, JSON.stringify({ ...board, state }));
  }, { key: demoKey, state });
  await openRoster(page);
  await fileInput(page).setInputFiles({ name: '가상명단.csv', mimeType: 'text/csv', buffer: Buffer.from('\uFEFF학급 명단\n\n비고,성명,학번,출석번호\n메모,가상하늘,30101,1\n메모,가상새봄,30103,3') });
  await expect(page.getByRole('table')).toContainText('학생 2명');
  await expect(page.getByLabel('번호 열')).toHaveValue('3');
  await expect(editor(page)).toHaveValue('1 가상하늘\n2 가상바다');
  await expect(page.getByRole('button', { name: '학생 명단 저장', exact: true })).toBeDisabled();
  await page.screenshot({ path: test.info().outputPath('roster-import-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: '이 명단 적용' }).click();
  await expect(editor(page)).toHaveValue('1 가상하늘\n3 가상새봄');
  await expect(editor(page)).toBeFocused();
  const beforeSave = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).state, demoKey);
  expect(beforeSave.roster).toEqual(state.roster);
  await page.getByRole('button', { name: '학생 명단 저장', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('학생 명단을 저장했습니다.');
  await expect(editor(page)).toHaveCount(0);
  await expect(page.getByRole('region', { name: '명단 가져오기', exact: true })).toHaveCount(0);
  await expect(page.getByRole('table', { name: '저장된 학급 명단' })).toContainText('가상새봄');
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).state, demoKey);
  expect(saved.roster[0].id).toBe(state.roster[0].id);
  expect(saved.periods).toEqual(state.periods);
  await page.goto('/tools/classroom-roles/assign');
  await expect(page.getByLabel('학생 명단', { exact: true })).toHaveValue('1 가상하늘\n3 가상새봄');
  expect(errors).toEqual([]);
});

test('XLSX 시트와 열을 바꾸어 명단을 선택하고 취소 시 편집 내용을 보존한다', async ({ page }, testInfo) => {
  const filePath = testInfo.outputPath('가상명단.xlsx');
  await writeXlsxFile([
    { sheet: '안내', data: [['반별로 시트를 선택하세요']] },
    { sheet: '1반', data: [['번호', '이름'], [1, '가상하늘']] },
    { sheet: '2반', data: [['안내 문구'], ['학생', '순서', '비고'], ['가상바다', 7, '메모']] },
  ]).toFile(filePath);
  await openRoster(page);
  await editor(page).fill('9 편집중학생');
  await fileInput(page).setInputFiles(filePath);
  await expect(page.getByLabel('시트 선택')).toHaveValue('1');
  await expect(page.getByRole('table')).toContainText('가상하늘');
  await page.getByLabel('시트 선택').selectOption('2');
  await page.getByLabel('열 제목 행').selectOption('1');
  await page.getByLabel('이름 열').selectOption('0');
  await page.getByLabel('번호 열').selectOption('1');
  await expect(page.getByRole('table')).toContainText('가상바다');
  await page.getByRole('button', { name: '가져오기 취소' }).click();
  await expect(editor(page)).toHaveValue('9 편집중학생');
  await expect(page.getByRole('table')).toHaveCount(0);
  await fileInput(page).setInputFiles(filePath);
  await page.getByLabel('시트 선택').selectOption('1');
  await page.getByRole('button', { name: '이 명단 적용' }).click();
  await expect(editor(page)).toHaveValue('1 가상하늘');
});

test('모바일에서 구글 시트 표를 붙여넣고 중복 번호를 수정한 후 적용한다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openRoster(page);
  await page.getByRole('button', { name: '구글 시트·표 붙여넣기' }).click();
  await page.getByLabel('복사한 표 또는 명단').fill('이름\t번호\t반\n가상하늘\t1\t1\n가상바다\t1\t1');
  await page.getByRole('button', { name: '붙여넣은 명단 분석' }).click();
  await expect(page.getByRole('alert')).toContainText('중복');
  await expect(page.getByRole('button', { name: '이 명단 적용' })).toBeDisabled();
  await page.getByLabel('복사한 표 또는 명단').fill('이름\t번호\t반\n가상하늘\t1\t1\n가상바다\t2\t1');
  await page.getByRole('button', { name: '붙여넣은 명단 분석' }).click();
  await expect(page.getByRole('table')).toContainText('학생 2명');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('roster-import-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: '이 명단 적용' }).click();
  await expect(editor(page)).toHaveValue('1 가상하늘\n2 가상바다');
  await page.getByRole('button', { name: '학생 명단 저장', exact: true }).click();
  await expect(page.getByRole('heading', { name: '등록된 학생 명단', exact: true })).toBeVisible();
  await expect(page.getByRole('table', { name: '저장된 학급 명단' })).toContainText('가상바다');
  await expect(editor(page)).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('saved-roster-mobile.png'), fullPage: true });
});

test('저장하면 번호순 목록을 보여주고 재방문·수정 취소·저장 오류를 구분한다', async ({ page }) => {
  await openRoster(page);
  await editor(page).fill('10 가상하늘\n2 가상바다\n1 가상하늘');
  await page.getByRole('button', { name: '학생 명단 저장', exact: true }).click();
  const heading = page.getByRole('heading', { name: '등록된 학생 명단', exact: true });
  const table = page.getByRole('table', { name: '저장된 학급 명단' });
  await expect(heading).toBeFocused();
  await expect(page.getByText('총 3명 · 번호순', { exact: true })).toBeVisible();
  await expect(table.locator('tbody tr')).toHaveText(['1가상하늘', '2가상바다', '10가상하늘']);
  await expect(editor(page)).toHaveCount(0);
  await expect(fileInput(page)).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath('saved-roster-desktop.png'), fullPage: true });
  const savedState = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), demoKey);

  await openRoster(page, false);
  await expect(heading).toBeVisible();
  await expect(editor(page)).toHaveCount(0);
  await page.getByRole('button', { name: '명단 수정', exact: true }).click();
  await expect(editor(page)).toBeFocused();
  await expect(editor(page)).toHaveValue('1 가상하늘\n2 가상바다\n10 가상하늘');
  await editor(page).fill('1 가상학생\n1 중복학생');
  await page.getByRole('button', { name: '학생 명단 저장', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('중복');
  await expect(editor(page)).toHaveValue('1 가상학생\n1 중복학생');
  await expect(heading).toHaveCount(0);
  await page.getByRole('button', { name: '수정 취소', exact: true }).click();
  await expect(heading).toBeFocused();
  await expect(table.locator('tbody tr')).toHaveText(['1가상하늘', '2가상바다', '10가상하늘']);
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), demoKey)).toEqual(savedState);

  await page.getByRole('button', { name: '명단 수정', exact: true }).click();
  await fileInput(page).setInputFiles({ name: '변경.txt', mimeType: 'text/plain', buffer: Buffer.from('1 가상새학생') });
  await expect(page.getByRole('button', { name: '학생 명단 저장', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '수정 취소', exact: true }).click();
  await expect(table).not.toContainText('가상새학생');
  await page.getByRole('button', { name: '명단 수정', exact: true }).click();
  await expect(page.getByRole('button', { name: '학생 명단 저장', exact: true })).toBeEnabled();
  await editor(page).fill('');
  await page.getByRole('button', { name: '학생 명단 저장', exact: true }).click();
  await expect(page.getByText('총 0명 · 번호순', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '학생 등록', exact: true }).click();
  await expect(editor(page)).toHaveValue('');
});

test('TXT·TSV를 읽고 잘못된 파일에도 기존 명단을 유지하며 다시 선택할 수 있다', async ({ page }) => {
  await openRoster(page);
  await editor(page).fill('9 가상기존');
  await fileInput(page).setInputFiles({ name: 'broken.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from('broken') });
  await expect(page.getByRole('alert')).toContainText('엑셀 파일을 읽지 못했습니다');
  await expect(editor(page)).toHaveValue('9 가상기존');
  await expect(page.getByRole('button', { name: '학생 명단 저장', exact: true })).toBeEnabled();
  for (const [name, text] of [['가상.txt', '가상하늘\n가상바다'], ['가상.tsv', '번호\t이름\n1\t가상하늘\n2\t가상바다']]) {
    await fileInput(page).setInputFiles({ name, mimeType: 'text/plain', buffer: Buffer.from(text) });
    await expect(page.getByRole('table')).toContainText('학생 2명');
    await page.getByRole('button', { name: '이 명단 적용' }).click();
    await expect(editor(page)).toHaveValue('1 가상하늘\n2 가상바다');
  }
});
