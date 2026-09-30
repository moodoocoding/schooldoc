// Review-only harness: local demo, fictional students, no remote data writes.
// Start Vite with mission/role demo flags on port 4175, then run node <this file>.
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import readXlsxFile from 'read-excel-file/node';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const output = resolve(dirname(fileURLToPath(import.meta.url)), 'evidence');
await mkdir(output, { recursive: true });
const base = process.env.MISSION_REVIEW_URL ?? 'http://127.0.0.1:4175';
if (new URL(base).hostname !== '127.0.0.1') throw new Error('Local demo only');
const browser = await chromium.launch({ channel: 'chrome' });
const key = 'schooldoc_class_missions_demo_v1';
const root = `${base}/tools/class-missions`;
const results = [];
const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
const future = new Date(Date.now() + 7 * 86400000 + 9 * 3600000).toISOString().slice(0, 10);

async function scenario(name, run) {
  if (process.env.MISSION_REVIEW_FILTER && !name.includes(process.env.MISSION_REVIEW_FILTER)) return;
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(7000);
  try { results.push({ name, completed: true, ...(await run(page, context)) }); }
  catch (error) { results.push({ name, completed: false, error: String(error) }); }
  finally { await context.close(); }
  console.log(name, JSON.stringify(results.at(-1)));
}
async function shot(page, name) { await page.screenshot({ path: resolve(output, `${name}.png`), fullPage: true }); }
async function board(page) { return page.evaluate((key) => JSON.parse(localStorage.getItem(key))[0], key); }
async function seed(page, count = 24, names) {
  await page.goto(root);
  await expect(page.getByRole('heading', { name: '학급 미션', exact: true })).toBeVisible();
  await page.evaluate(({ key, count, names, today, future }) => {
    const roster = Array.from({ length: count }, (_, i) => ({
      id: crypto.randomUUID(), number: i + 1, name: names?.[i] ?? `가상학생${i + 1}${i === count - 1 ? '긴이름확인' : ''}`,
      codeHash: '',
    }));
    const mission = { id: crypto.randomUUID(), title: '가상 독서 기록', description: '활동을 마친 뒤 완료를 표시해 주세요.',
      startDate: today, dueDate: future, requiresConfirmation: true, status: 'open', targets: roster.map(({ codeHash, ...s }) => s),
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    localStorage.setItem(key, JSON.stringify([{ id: crypto.randomUUID(), publicToken: crypto.randomUUID(), publicEnabled: true,
      version: 1, updatedAt: new Date().toISOString(), state: { className: '가상 5학년 2반', roster, missions: [mission], checks: [], events: [] } }]));
  }, { key, count, names, today, future });
  await page.reload();
  await expect(page.getByRole('region', { name: '미션 현황' })).toBeVisible();
  return board(page);
}
async function enter(page, token, name) {
  await page.goto(`${base}/s/missions/${token}`);
  await page.getByRole('textbox', { name: '학생 이름' }).fill(name);
  await page.getByRole('textbox', { name: '학생 이름' }).press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/의 미션$/);
}

try {
  await scenario('current-ui-workflow', async (page, context) => {
    await page.goto(root);
    await shot(page, 'teacher-empty');
    await page.getByRole('textbox', { name: '새 학급 이름' }).fill('가상 5학년 2반');
    await page.getByRole('button', { name: '학급 만들기' }).click();
    await page.locator('summary').filter({ hasText: '학급 명단 및 개인 코드' }).click();
    await page.getByRole('textbox', { name: '편집 명단' }).fill('1 가상하늘\n2 가상바다');
    await page.getByRole('button', { name: '학생 명단 저장' }).click();
    await expect(page.getByRole('region', { name: '이번에 발급한 개인 코드' })).toBeVisible();
    await page.getByRole('button', { name: '코드 목록 닫기' }).click();
    await page.getByRole('button', { name: '새 미션', exact: true }).click();
    const editor = page.getByRole('region', { name: '새 미션 만들기' });
    await editor.getByRole('textbox', { name: '미션 제목' }).fill('가상 독서 기록');
    await editor.getByRole('checkbox', { name: /교사 확인 필요/ }).check();
    await editor.getByRole('button', { name: '발행 전 확인' }).click();
    await editor.getByRole('button', { name: '이 내용으로 발행' }).click();
    await expect(page.getByRole('region', { name: '미션 현황' })).toBeVisible();
    const initial = await board(page);
    const student = await context.newPage();
    await student.setViewportSize({ width: 390, height: 844 });
    await enter(student, initial.publicToken, '가상하늘');
    const focusAfterLogin = await student.evaluate(() => document.activeElement.tagName);
    await student.getByRole('button', { name: '완료했어요' }).click();
    await expect(student.getByText('확인 기다리는 중', { exact: true })).toBeVisible();
    await student.getByRole('button', { name: '완료 표시 취소' }).click();
    await student.getByRole('button', { name: '완료했어요' }).click();
    await page.getByRole('button', { name: '새로고침', exact: true }).click();
    await page.getByRole('button', { name: '확인', exact: true }).click();
    await student.getByRole('button', { name: '새로고침', exact: true }).click();
    await expect(student.getByText('선생님이 확인했습니다.', { exact: false })).toBeVisible();
    await expect(student.getByRole('button', { name: '완료 표시 취소' })).toHaveCount(0);
    await shot(student, 'student-confirmed-mobile');
    const downloads = [];
    for (const label of ['QR PNG 저장', 'Excel 내려받기']) {
      const waiting = page.waitForEvent('download');
      await page.getByRole('button', { name: label, exact: true }).click();
      const download = await waiting;
      downloads.push(download.suggestedFilename());
      await download.saveAs(resolve(output, download.suggestedFilename()));
    }
    const png = await readFile(resolve(output, downloads[0]));
    const excel = await readXlsxFile(resolve(output, downloads[1]));
    const rows = excel[0].data;
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1024, 1024]);
    expect(rows[6].slice(0, 5)).toEqual([1, '가상하늘', '예', '예', '교사 확인']);
    expect(rows[7].slice(0, 5)).toEqual([2, '가상바다', '아니요', '아니요', '표시 전']);
    await page.getByRole('checkbox', { name: '공개 링크 사용' }).uncheck();
    await student.getByRole('button', { name: '나가기', exact: true }).click();
    await student.getByRole('textbox', { name: '학생 이름' }).fill('가상바다');
    await student.getByRole('button', { name: '내 미션 보기' }).click();
    await expect(student.getByRole('alert')).toContainText('이름 또는 링크');
    return { workflowPassed: true, downloads, focusAfterLogin, qrPixels: [1024, 1024], excelStatusesVerified: true };
  });

  await scenario('duplicate-name-selects-first-student', async (page, context) => {
    const initial = await seed(page, 2, ['가상동명', '가상동명']);
    const student = await context.newPage();
    await student.setViewportSize({ width: 390, height: 844 });
    await enter(student, initial.publicToken, '가상동명');
    await student.getByRole('button', { name: '완료했어요' }).click();
    const saved = await board(page);
    await shot(student, 'duplicate-name-mobile');
    return { reproduced: saved.state.checks[0]?.studentId === initial.state.roster[0].id,
      secondStudentCheckCount: saved.state.checks.filter((s) => s.studentId === initial.state.roster[1].id).length };
  });

  await scenario('teacher-stale-version-and-draft-loss', async (page, context) => {
    const initial = await seed(page, 2, ['가상하늘', '가상바다']);
    const unhandled = [];
    page.on('pageerror', (e) => unhandled.push(e.message));
    const student = await context.newPage();
    await enter(student, initial.publicToken, '가상하늘');
    await student.getByRole('button', { name: '완료했어요' }).click();
    await page.getByRole('combobox', { name: '1번 가상하늘 상태 정정' }).selectOption('confirmed');
    await expect(page.getByRole('alert').first()).toContainText('다른 화면에서 변경');
    await shot(page, 'teacher-stale-error');
    await page.getByRole('button', { name: '새로고침', exact: true }).click();
    await page.getByRole('button', { name: '새 미션', exact: true }).click();
    const editor = page.getByRole('region', { name: '새 미션 만들기' });
    await editor.getByRole('textbox', { name: '미션 제목' }).fill('사라지면 안 되는 작성 중 미션');
    await student.getByRole('button', { name: '완료 표시 취소' }).click();
    await editor.getByRole('button', { name: '초안 저장' }).click();
    await expect(page.getByRole('alert').first()).toContainText('다른 화면에서 변경');
    await expect(editor.getByRole('textbox', { name: '미션 제목' })).toHaveValue('사라지면 안 되는 작성 중 미션');
    await page.getByRole('button', { name: '새로고침', exact: true }).click();
    await expect(page.getByRole('region', { name: '새 미션 만들기' })).toHaveCount(0);
    await page.getByRole('button', { name: '새 미션', exact: true }).click();
    const after = await page.getByRole('textbox', { name: '미션 제목' }).inputValue();
    return { conflictReproduced: true, unhandled, draftLost: after === '' };
  });

  await scenario('logout-during-delayed-mark-restores-view', async (page, context) => {
    const initial = await seed(page, 1, ['가상하늘']);
    await page.locator('summary').filter({ hasText: '학급 명단 및 개인 코드' }).click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: '코드 재발급' }).click();
    const code = await page.getByRole('region', { name: '이번에 발급한 개인 코드' }).locator('strong').textContent();
    const student = await context.newPage();
    await student.setViewportSize({ width: 390, height: 844 });
    await enter(student, initial.publicToken, code);
    await student.evaluate(() => {
      const digest = crypto.subtle.digest.bind(crypto.subtle);
      crypto.subtle.digest = async (...args) => {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        return digest(...args);
      };
    });
    await student.getByRole('button', { name: '완료했어요' }).click();
    await student.getByRole('button', { name: '나가기', exact: true }).click();
    await expect(student.getByRole('textbox', { name: '학생 이름' })).toBeVisible();
    await expect(student.getByRole('heading', { name: '가상하늘의 미션' })).toBeVisible();
    await shot(student, 'logout-restored-mobile');
    return { reproduced: true, delay: 'Test delays code hashing 1500ms to model an in-flight async response after logout.' };
  });

  await scenario('density-responsive-accessibility', async (page) => {
    const initial = await seed(page, 24);
    await page.evaluate((key) => {
      const boards = JSON.parse(localStorage.getItem(key));
      const b = boards[0];
      b.state.checks = b.state.roster.slice(0, 19).map((s, i) => ({ missionId: b.state.missions[0].id, studentId: s.id,
        status: i < 12 ? 'reported' : i < 15 ? 'pending' : i < 18 ? 'confirmed' : 'exempt', updatedAt: new Date().toISOString() }));
      localStorage.setItem(key, JSON.stringify(boards));
    }, key);
    await page.reload();
    await expect(page.getByRole('region', { name: '미션 현황' })).toBeVisible();
    const positions = await page.getByRole('region', { name: '미션 현황' }).boundingBox();
    await shot(page, 'teacher-24-desktop');
    const measurements = [];
    for (const [w, h, zoom, name] of [[390, 844, 1, 'teacher-24-mobile'], [1366, 768, 2, 'teacher-24-zoom-200']]) {
      await page.setViewportSize({ width: w, height: h });
      await page.evaluate((zoom) => { document.documentElement.style.zoom = String(zoom); window.scrollTo(0, 0); }, zoom);
      await shot(page, name);
      measurements.push({ name, ...(await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth }))) });
    }
    await page.evaluate(() => { document.documentElement.style.zoom = '1'; });
    await page.setViewportSize({ width: 1366, height: 900 });
    await seed(page, 60);
    await shot(page, 'teacher-60-desktop');
    await page.setViewportSize({ width: 390, height: 844 });
    await shot(page, 'teacher-60-mobile');
    const teacherAxe = await new AxeBuilder({ page }).analyze();
    const student = await page.context().newPage();
    await student.setViewportSize({ width: 390, height: 844 });
    const final = await board(page);
    await enter(student, final.publicToken, final.state.roster[0].name);
    const studentAxe = await new AxeBuilder({ page: student }).analyze();
    await shot(student, 'student-active-mobile');
    return { statusPanelTop: positions.y, viewportHeight: 900, measurements,
      teacherAxe: teacherAxe.violations.map((v) => ({ id: v.id, impact: v.impact, count: v.nodes.length })),
      studentAxe: studentAxe.violations.map((v) => ({ id: v.id, impact: v.impact, count: v.nodes.length,
        nodes: v.nodes.map((n) => ({ html: n.html, failureSummary: n.failureSummary })) })), studentCount: initial.state.roster.length };
  });

  await scenario('closed-missions-before-actionable-mission', async (page, context) => {
    const initial = await seed(page, 1, ['가상하늘']);
    await page.evaluate((key) => {
      const boards = JSON.parse(localStorage.getItem(key));
      const b = boards[0];
      const active = b.state.missions[0];
      b.state.missions = [...Array.from({ length: 5 }, (_, i) => ({ ...active, id: crypto.randomUUID(),
        title: `종료된 가상 미션 ${i + 1}`, startDate: '2026-01-01', dueDate: '2026-01-08', status: 'closed',
        closedAt: new Date().toISOString() })), active];
      localStorage.setItem(key, JSON.stringify(boards));
    }, key);
    const student = await context.newPage();
    await student.setViewportSize({ width: 390, height: 844 });
    await enter(student, initial.publicToken, '가상하늘');
    const order = await student.locator('article h2').allTextContents();
    const actionableTop = (await student.getByRole('button', { name: '완료했어요' }).boundingBox()).y;
    await shot(student, 'closed-first-mobile');
    return { reproduced: order[0].startsWith('종료'), order, actionableTop };
  });

  await scenario('future-start-teacher-label', async (page, context) => {
    const initial = await seed(page, 1, ['가상하늘']);
    await page.evaluate(({ key, future }) => {
      const boards = JSON.parse(localStorage.getItem(key));
      boards[0].state.missions[0].startDate = future;
      localStorage.setItem(key, JSON.stringify(boards));
    }, { key, future });
    await page.reload();
    const teacherText = await page.getByRole('region', { name: '미션 현황' }).innerText();
    const student = await context.newPage();
    await enter(student, initial.publicToken, '가상하늘');
    return { reproduced: teacherText.startsWith('진행 중') && await student.getByText('시작 전', { exact: true }).isVisible(),
      teacherState: teacherText.split('\n')[0], studentState: '시작 전' };
  });

  await scenario('purge-guard-counts-and-final-link', async (page, context) => {
    const initial = await seed(page, 2, ['가상하늘', '가상바다']);
    const age = async (days) => {
      await page.evaluate(({ key, days }) => {
        const boards = JSON.parse(localStorage.getItem(key));
        const m = boards[0].state.missions[0];
        m.status = 'closed'; m.closedAt = new Date(Date.now() - days * 86400000).toISOString();
        localStorage.setItem(key, JSON.stringify(boards));
      }, { key, days });
      await page.reload();
    };
    await age(89);
    await expect(page.getByRole('button', { name: '미션 영구 파기' })).toHaveCount(0);
    await age(91);
    const section = page.getByLabel('미션 보관 및 파기');
    await expect(section).toContainText('대상 학생 2명 · 현재 응답 0건 · 변경 이력 0건');
    const purge = section.getByRole('button', { name: '미션 영구 파기' });
    await expect(purge).toBeDisabled();
    await section.getByRole('checkbox').check();
    await section.getByRole('textbox', { name: '확인 문구: 영구 파기' }).fill('영구 파기');
    await expect(purge).toBeEnabled();
    await page.getByRole('combobox', { name: '1번 가상하늘 상태 정정' }).selectOption('exempt');
    await expect(purge).toBeDisabled();
    await expect(section.getByRole('checkbox')).not.toBeChecked();
    await section.getByRole('checkbox').check();
    await section.getByRole('textbox', { name: '확인 문구: 영구 파기' }).fill('영구 파기');
    await shot(page, 'teacher-purge');
    await purge.click();
    await expect(page.getByText('미션과 관련 응답·이력을 파기했습니다.')).toBeVisible();
    const final = await board(page);
    expect(final.state).toMatchObject({ roster: [], missions: [], checks: [], events: [] });
    expect(final.publicEnabled).toBe(false);
    expect(final.publicToken).not.toBe(initial.publicToken);
    const student = await context.newPage();
    await student.goto(`${base}/s/missions/${initial.publicToken}`);
    await student.getByRole('textbox', { name: '학생 이름' }).fill('가상하늘');
    await student.getByRole('button', { name: '내 미션 보기' }).click();
    await expect(student.getByRole('alert')).toContainText('이름 또는 링크');
    return { passed: true, environment: 'local demo; database transaction not exercised' };
  });
} finally {
  let combined = results;
  if (process.env.MISSION_REVIEW_FILTER) {
    try {
      const previous = JSON.parse(await readFile(resolve(output, 'results.json'), 'utf8')).results;
      combined = previous.map((entry) => results.find((r) => r.name === entry.name) ?? entry);
      combined.push(...results.filter((r) => !previous.some((entry) => entry.name === r.name)));
    } catch { /* First filtered run has no earlier results. */ }
  }
  await writeFile(resolve(output, 'results.json'), JSON.stringify({ localDemoOnly: true, results: combined }, null, 2) + '\n');
  await browser.close();
}
if (results.some((r) => !r.completed)) process.exitCode = 1;
