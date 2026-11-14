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
  page.once('dialog', (dialog) => void dialog.accept());
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

test('학생별 완료 현황에서 종료일 당시 상태, 학생 검색과 이름 가림을 확인한다', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-13T02:00:00Z'));
  await page.addInitScript(({ key, boards }) => localStorage.setItem(key, JSON.stringify(boards)), {
    key: demoKey, boards: [demoBoard(24), demoBoard(60), demoBoard(0)],
  });
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/tools/class-missions');
  await page.getByRole('tab', { name: '통계', exact: true }).click();
  await page.getByRole('radio', { name: '학생별 현황' }).check();
  const panel = page.getByRole('region', { name: '학생별 완료 현황' });
  await expect(panel.getByRole('row')).toHaveCount(21);
  await expect(panel.getByRole('status')).toHaveText('24명 · 1 / 2쪽');
  const studentTwo = panel.getByRole('button', { name: '2번 가상학생2', exact: true });
  await expect(studentTwo.locator('xpath=ancestor::tr')).toContainText('2 / 2');
  await studentTwo.focus();
  await page.keyboard.press('Enter');
  const details = panel.getByRole('list', { name: '2번 가상학생2 미션별 상태' });
  await expect(details).toContainText('교사 확인');
  await expect(details).toContainText('완료 표시');
  await page.screenshot({ path: test.info().outputPath('students-24-desktop.png'), fullPage: true });

  await page.getByLabel('종료일', { exact: true }).fill('2026-11-12');
  await page.getByRole('button', { name: '조회', exact: true }).click();
  await expect(studentTwo.locator('xpath=ancestor::tr')).toContainText('0 / 2');
  await expect(details).toContainText('확인 대기');
  await expect(details).toContainText('표시 전');
  await expect(panel.getByRole('columnheader', { name: '완료 인정 / 대상' })).toBeVisible();
  await expect(panel.getByText(/확인 대기는 학생이 완료를 표시한 상태/)).toBeVisible();
  await panel.getByRole('searchbox', { name: '학생 검색' }).fill('가상학생2');
  await expect(panel.getByRole('row')).toHaveCount(7);
  await panel.getByRole('checkbox', { name: '이름 가림' }).check();
  await expect(panel.getByText(/가상학생/)).toHaveCount(0);
  await panel.getByRole('searchbox', { name: '학생 검색' }).fill('2번');
  await expect(panel.getByRole('button', { name: '2번', exact: true })).toBeVisible();
  await expect(panel.getByRole('row')).toHaveCount(2);
  await page.getByRole('radio', { name: '일별 활동' }).check();
  await page.getByRole('radio', { name: '학생별 현황' }).check();
  await expect(panel.getByRole('checkbox', { name: '이름 가림' })).toBeChecked();

  const select = page.getByRole('combobox', { name: '학급 선택' });
  await select.selectOption('board-60');
  await expect(panel.getByRole('checkbox', { name: '이름 가림' })).toBeChecked();
  await panel.getByRole('checkbox', { name: '이름 가림' }).uncheck();
  await expect(panel.getByRole('row')).toHaveCount(21);
  await panel.getByRole('button', { name: '다음', exact: true }).click();
  await expect(panel.getByRole('status')).toHaveText('60명 · 2 / 3쪽');
  await expect(panel.getByRole('button', { name: '21번 가상학생21', exact: true })).toBeVisible();
  await panel.getByRole('button', { name: '이전', exact: true }).click();
  await panel.getByRole('button', { name: '2번 가상학생2', exact: true }).click();
  for (const [width, height, zoom, label] of [[390, 844, '1', 'mobile'], [1366, 900, '2', 'zoom-200']] as const) {
    await page.setViewportSize({ width, height });
    await page.evaluate((scale) => { document.documentElement.style.zoom = scale; window.scrollTo(0, 0); }, zoom);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 390) {
      const firstStudent = panel.getByRole('row').nth(1);
      expect((await firstStudent.boundingBox())!.y).toBeLessThan(844);
    }
    await page.screenshot({ path: test.info().outputPath(`students-60-${label}.png`), fullPage: true });
  }
  await page.evaluate(() => { document.documentElement.style.zoom = ''; });
  await page.setViewportSize({ width: 390, height: 844 });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.reload();
  await expect(page.getByRole('tab', { name: '통계', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('radio', { name: '학생별 현황' })).toBeChecked();
  await expect(select).toHaveValue('board-60');
  await expect(page.getByLabel('종료일', { exact: true })).toHaveValue('2026-11-12');
  await expect(panel.getByRole('button', { name: '2번 가상학생2', exact: true }).locator('xpath=ancestor::tr')).toContainText('0 / 2');
  const query = new URL(page.url()).searchParams;
  expect(Object.fromEntries(query)).toMatchObject({ tab: 'statistics', board: 'board-60', view: 'students', start: '2026-11-07', end: '2026-11-12' });
  expect([...query.keys()].sort()).toEqual(['board', 'end', 'start', 'tab', 'view']);
  await select.selectOption('board-0');
  await expect(panel.getByRole('status')).toContainText('선택 기간에 조회할 미션이 없습니다.');
  await page.screenshot({ path: test.info().outputPath('students-empty-mobile.png'), fullPage: true });
});

test('누적 미션을 페이지·상태·검색으로 탐색하고 설정 제목을 같은 스타일로 표시한다', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-13T02:00:00Z'));
  const board = demoBoard(24);
  const past = Array.from({ length: 58 }, (_, index): Mission => ({ ...board.state.missions[0], id: `past-${index}`,
    status: index % 2 ? 'open' : 'closed', title: `가상 지난 미션 ${String(index + 1).padStart(2, '0')}`, dueDate: '2026-11-01' }));
  board.state.missions.unshift(...past);
  await page.addInitScript(({ key, board }) => localStorage.setItem(key, JSON.stringify([board])), { key: demoKey, board });
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/tools/class-missions');
  const list = page.getByRole('region', { name: '미션 목록' });
  const detail = page.getByRole('region', { name: '미션 현황' });
  await expect(list.getByRole('listitem')).toHaveCount(5);
  await expect(list.getByRole('listitem').first()).toContainText(longTitle);
  await expect(detail).toContainText(longTitle);
  await page.screenshot({ path: test.info().outputPath('manage-60-missions-desktop.png'), fullPage: true });
  await list.getByRole('combobox', { name: '미션 상태' }).selectOption('지난 미션');
  const outside = page.getByText('현재 상세는 검색 조건 밖의 선택 미션입니다.');
  await expect(outside).toBeVisible();
  await list.getByRole('button', { name: '다음' }).click();
  await expect(list.getByRole('status')).toHaveText('58건 · 2 / 12쪽');
  const search = list.getByRole('searchbox', { name: '미션 검색' });
  await search.fill('일치하는 미션 없음');
  await expect(list.getByText('조건에 맞는 미션이 없습니다.')).toBeVisible();
  await expect(outside).toBeVisible();
  await search.fill('지난 미션 01');
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await list.getByRole('button', { name: /가상 지난 미션 01/ }).click();
  await expect(detail).toContainText('가상 지난 미션 01');
  await expect(outside).toHaveCount(0);
  expect(await detail.evaluate((node) => document.activeElement === node.parentElement)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('manage-60-missions-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: '미션 목록으로' }).click();
  await expect(list).toBeFocused();
  const titles = page.locator('#mission-panel-manage > details > summary');
  const styles = await titles.evaluateAll((nodes) => nodes.map((node) => {
    const { fontSize, fontWeight, fontFamily } = getComputedStyle(node);
    return [fontSize, fontWeight, fontFamily];
  }));
  expect(styles).toHaveLength(3);
  expect(styles.every((style) => JSON.stringify(style) === JSON.stringify(styles[0]))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/tools/class-missions?board=board-24&mission=past-0');
  await expect(detail).toContainText('가상 지난 미션 01');
});

test('미션 편집 이탈을 취소하면 작성 내용이 유지되고 이름 가림은 번호로 읽힌다', async ({ page }) => {
  await page.addInitScript(({ key, boards }) => localStorage.setItem(key, JSON.stringify(boards)), {
    key: demoKey, boards: [demoBoard(24), demoBoard(60)],
  });
  await page.goto('/tools/class-missions');
  const detail = page.getByRole('region', { name: '미션 현황' });
  await detail.getByRole('checkbox', { name: '이름 가림' }).check();
  await expect(detail.getByRole('combobox', { name: '1번 상태 정정', exact: true })).toBeVisible();
  await expect(detail.getByRole('combobox', { name: /가상학생/ })).toHaveCount(0);
  await page.locator('summary').filter({ hasText: '학급 명단 및 개인 코드' }).click();
  await expect(page.getByRole('textbox', { name: '편집 명단' })).toHaveCount(0);
  await expect(page.getByText(/가상학생1$/, { exact: false })).toHaveCount(0);

  const newMission = page.getByRole('button', { name: '새 미션', exact: true });
  const title = page.getByRole('textbox', { name: '미션 제목' });
  await newMission.click();
  await expect(page.getByRole('checkbox', { name: '1번', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(title).toHaveCount(0);
  await newMission.click();
  await title.fill('저장 전 입력 확인');
  expect(await page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  })).toBe(true);
  const dismiss = () => page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('저장하지 않은 미션 작성 내용');
    await dialog.dismiss();
  });
  const other = page.getByRole('region', { name: '미션 목록' }).getByRole('button', { name: /가상 독서 기록/ });
  dismiss();
  await other.click();
  await expect(title).toHaveValue('저장 전 입력 확인');
  dismiss();
  await newMission.click();
  await expect(title).toHaveValue('저장 전 입력 확인');
  dismiss();
  await page.getByRole('combobox', { name: '학급 선택' }).selectOption('board-60');
  await expect(page.getByRole('combobox', { name: '학급 선택' })).toHaveValue('board-24');
  await expect(title).toHaveValue('저장 전 입력 확인');
  dismiss();
  await page.getByRole('button', { name: '설정', exact: true }).click();
  await expect(title).toHaveValue('저장 전 입력 확인');
  await page.getByRole('tab', { name: '통계', exact: true }).click();
  await page.getByRole('tab', { name: '미션 관리' }).click();
  await expect(title).toHaveValue('저장 전 입력 확인');
  page.once('dialog', (dialog) => void dialog.accept());
  await other.click();
  await expect(title).toHaveCount(0);
  await expect(detail.getByRole('heading', { name: '가상 독서 기록' })).toBeVisible();
  expect(await page.evaluate(() => window.dispatchEvent(new Event('beforeunload', { cancelable: true })))).toBe(true);

  await newMission.click();
  await title.fill('다시 시작하기 전 가상 미션');
  await page.getByRole('button', { name: '발행 전 확인', exact: true }).click();
  await expect(page.getByRole('group', { name: '발행 전 확인' })).toBeVisible();
  page.once('dialog', (dialog) => void dialog.accept());
  await newMission.click();
  await expect(title).toHaveValue('');
  await expect(page.getByRole('group', { name: '발행 전 확인' })).toHaveCount(0);
});
