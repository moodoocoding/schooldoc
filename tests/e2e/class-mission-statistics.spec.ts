import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { setMissionCheck, type Mission, type MissionBoard, type StoredMissionState } from '../../supabase/functions/_shared/classMissions';

const demoKey = 'schooldoc_class_missions_demo_v1';
const longTitle = '가상사회탐구활동기록미션긴제목줄바꿈확인'.repeat(4);

function demoBoard(size: number): MissionBoard {
  const roster = Array.from({ length: size }, (_, i) => ({ id: `student-${i}`, number: i + 1, name: `가상학생${i + 1}`, codeHash: '' }));
  const reading: Mission = {
    id: 'reading', title: '가상 독서 기록', description: '', targets: roster, requiresConfirmation: true,
    startDate: '2026-10-25', dueDate: '2026-11-20', status: 'open',
    createdAt: '2026-10-25T00:00:00Z', updatedAt: '2026-10-25T00:00:00Z',
  };
  const inquiry = { ...reading, id: 'inquiry', title: longTitle, requiresConfirmation: false };
  let state: StoredMissionState = {
    className: size ? `가상 ${size}명 학급` : '가상 빈 학급', roster, missions: size ? [reading, inquiry] : [], checks: [], events: [],
  };
  if (size) {
    state = setMissionCheck(state, inquiry.id, roster[0].id, 'reported', 'student', '2026-10-30T02:00:00Z', '2026-10-30');
    for (const student of roster) {
      state = setMissionCheck(state, reading.id, student.id, 'pending', 'student', '2026-11-12T14:00:00Z', '2026-11-12');
    }
    state = setMissionCheck(state, reading.id, roster[0].id, 'unmarked', 'student', '2026-11-12T14:30:00Z', '2026-11-12');
    state = setMissionCheck(state, reading.id, roster[0].id, 'pending', 'student', '2026-11-12T14:45:00Z', '2026-11-12');
    for (const student of roster.slice(0, 12)) {
      state = setMissionCheck(state, reading.id, student.id, 'confirmed', 'teacher', '2026-11-12T15:00:00Z', '2026-11-13');
    }
    state = setMissionCheck(state, reading.id, roster[0].id, 'exempt', 'teacher', '2026-11-12T15:30:00Z', '2026-11-13');
    state = setMissionCheck(state, inquiry.id, roster[1].id, 'reported', 'student', '2026-11-12T15:45:00Z', '2026-11-13');
  }
  return { id: `board-${size}`, publicToken: `token-${size}`, publicEnabled: true, version: 1, updatedAt: reading.updatedAt, state };
}

test('교사가 기간별 활동을 조회하고 날짜와 학급을 바꿔 비교한다', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-13T02:00:00Z'));
  await page.addInitScript(({ key, boards }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(boards));
  }, { key: demoKey, boards: [demoBoard(60), demoBoard(24), demoBoard(0)] });
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/tools/class-missions');

  const manage = page.getByRole('tab', { name: '미션 관리' });
  const statistics = page.getByRole('tab', { name: '통계', exact: true });
  await page.getByRole('button', { name: '새 미션' }).click();
  await page.getByRole('textbox', { name: '미션 제목' }).fill('작성 중인 미션');
  await manage.focus();
  await page.keyboard.press('ArrowRight');
  await expect(statistics).toBeFocused();
  await expect(statistics).toHaveAttribute('aria-selected', 'true');
  const panel = page.getByRole('tabpanel', { name: '통계' });
  const start = panel.getByLabel('시작일');
  const end = panel.getByLabel('종료일');
  const search = panel.getByRole('button', { name: '조회' });
  await page.keyboard.press('Tab');
  await expect(start).toBeFocused();
  await expect(start).toHaveValue('2026-11-07');
  await expect(end).toHaveValue('2026-11-13');
  await expect(panel.getByRole('row')).toHaveCount(8);
  expect(await panel.getByRole('row', { name: /2026-11-12/ }).getByRole('cell').allTextContents()).toEqual(['61', '0', '1', '0']);
  expect(await panel.getByRole('row', { name: /2026-11-11/ }).getByRole('cell').allTextContents()).toEqual(['0', '0', '0', '0']);

  const date = panel.getByRole('button', { name: '2026-11-13 미션별 활동' });
  await date.focus();
  await page.keyboard.press('Enter');
  await expect(date).toHaveAttribute('aria-expanded', 'true');
  const details = panel.getByRole('list', { name: '2026-11-13 미션별 활동' });
  await expect(details).toContainText(longTitle);
  await expect(details).toContainText('교사 확인 12건');
  await expect(details).toContainText('교사 정정 1건');
  await expect(panel.getByText('62건')).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('statistics-desktop-60.png'), fullPage: true });
  for (const [width, height, zoom, name] of [[390, 844, '1', 'mobile'], [320, 720, '1', 'narrow'], [1366, 900, '2', 'zoom-200']] as const) {
    await page.setViewportSize({ width, height });
    await page.evaluate((value) => { document.documentElement.style.zoom = value; }, zoom);
    await page.screenshot({ path: test.info().outputPath(`statistics-${name}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await date.evaluate((button) => button.getBoundingClientRect().right <= button.closest('th')!.getBoundingClientRect().right)).toBe(true);
    if (width === 390) expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
  await page.evaluate(() => { document.documentElement.style.zoom = ''; });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await manage.click();
  await expect(page.getByRole('textbox', { name: '미션 제목' })).toHaveValue('작성 중인 미션');
  await statistics.click();
  await end.fill('2026-11-06');
  await search.click();
  await expect(panel.getByRole('alert')).toContainText('종료일은 시작일과 같거나 이후');
  await expect(end).toBeFocused();
  await expect(panel.getByText('62건')).toBeVisible();
  await start.fill('2026-10-25');
  await end.fill('2026-11-13');
  await search.click();
  await expect(panel.getByRole('alert')).toHaveCount(0);
  await expect(panel.getByText('63건')).toBeVisible();
  await panel.getByRole('button', { name: '이전 날짜' }).click();
  await expect(panel.getByRole('row')).toHaveCount(7);
  await expect(panel.getByRole('button', { name: '2026-10-30 미션별 활동' })).toBeVisible();
  await panel.getByRole('button', { name: '최근 날짜' }).click();

  const boardSelect = page.getByRole('combobox', { name: '학급 선택' });
  await boardSelect.selectOption('board-24');
  await expect(start).toHaveValue('2026-10-25');
  await expect(panel.getByText('27건')).toBeVisible();
  await page.evaluate((key) => {
    const boards: MissionBoard[] = JSON.parse(localStorage.getItem(key) ?? '[]');
    const board = boards.find((entry) => entry.id === 'board-24')!;
    const last = board.state.events.at(-1)!;
    board.state.events.push({ ...last, id: crypto.randomUUID(), from: 'reported', status: 'unmarked' });
    board.state.checks = board.state.checks.filter((check) => check.missionId !== last.missionId || check.studentId !== last.studentId);
    localStorage.setItem(key, JSON.stringify(boards));
  }, demoKey);
  await page.getByRole('button', { name: '새로고침' }).click();
  await expect(page.getByText('최신 활동 기록을 불러왔습니다.')).toBeVisible();
  await expect(panel.getByText('27건')).toBeVisible();
  await expect(panel.getByText('2건', { exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('statistics-desktop-24.png'), fullPage: true });

  await boardSelect.selectOption('board-0');
  await expect(panel.getByRole('status')).toContainText('이 기간에 기록된 미션 활동이 없습니다.');
  await expect(panel.getByRole('table')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: test.info().outputPath('statistics-empty-mobile.png'), fullPage: true });
});
