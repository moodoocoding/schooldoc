/** Explicit opt-in remote smoke check. Never runs in the regular Vitest suite.
 * Creates only two synthetic teachers and removes exactly those accounts in finally.
 * Credentials arrive through process environment, never command arguments or reports.
 * Optional ROLES_SMOKE_ORIGIN verifies the deployed UI with a real test-user session
 * (not Google's interactive OAuth), plus a separate unauthenticated student context.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const ref = process.env.ROLES_SMOKE_PROJECT;
if (!ref || process.env.ROLES_SMOKE_ALLOW_WRITE !== ref) {
  throw new Error('Explicit project confirmation is required for synthetic remote writes.');
}
const keys = JSON.parse(process.env.ROLES_SMOKE_KEYS ?? '[]');
delete process.env.ROLES_SMOKE_KEYS;
const anon = keys.find((key) => key.name === 'anon')?.api_key;
const service = keys.find((key) => key.name === 'service_role')?.api_key;
assert.ok(anon && service, 'Required API credentials are missing.');
const base = `https://${ref}.supabase.co`;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(base, service, options);
const users = [];
let stage = 'initialization';
let browser;
let checks = 0;
const pass = (label) => { checks++; console.log(`PASS ${label}`); };
const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
const allDays = [0, 1, 2, 3, 4, 5, 6];
async function call(kind, body, jwt, expected = 200) {
  const response = await fetch(`${base}/functions/v1/classroom-roles-${kind}`, {
    method: 'POST', headers: { apikey: anon, 'Content-Type': 'application/json',
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
    body: JSON.stringify(body), signal: AbortSignal.timeout(30000),
  });
  if (response.status !== expected) {
    throw new Error(`Unexpected HTTP ${response.status}; expected ${expected}.`);
  }
  return response.json();
}
async function newTeacher() {
  const run = randomUUID();
  const email = `roles-smoke-${run}@example.com`;
  const password = `${randomUUID()}aA!9`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true,
    user_metadata: { full_name: '가상검증교사', classroom_roles_smoke: run } });
  assert.ok(!created.error && created.data.user, 'Synthetic teacher creation failed.');
  users.push(created.data.user.id);
  const client = createClient(base, anon, options);
  const signed = await client.auth.signInWithPassword({ email, password });
  assert.ok(!signed.error && signed.data.session, 'Synthetic teacher sign-in failed.');
  return { client, session: signed.data.session, jwt: signed.data.session.access_token };
}
try {
  stage = 'authentication';
  await call('admin', { action: 'load' }, undefined, 401);
  const a = await newTeacher();
  const b = await newTeacher();
  let board = await call('admin', { action: 'load' }, a.jwt);
  const other = await call('admin', { action: 'load', boardId: board.id }, b.jwt);
  assert.notEqual(board.id, other.id);
  pass('unauthenticated admin blocked; teacher owner isolation');

  stage = 'assignment and encryption';
  const state = structuredClone(board.state);
  state.roster = [{ id: randomUUID(), number: 1, name: '가상하늘' },
    { id: randomUUID(), number: 2, name: '가상바다' }];
  state.settings.schoolDays = allDays;
  state.roles.forEach((role) => { role.weekdays = allDays; });
  const period = { id: randomUUID(), start: today, end: today,
    students: structuredClone(state.roster), roles: structuredClone(state.roles),
    assignments: Object.fromEntries(state.roster.map((s, i) => [s.id, state.roles[i].id])) };
  state.periods = [period];
  board = await call('admin', { action: 'save', version: board.version, state }, a.jwt);
  const stored = await admin.from('classroom_role_boards').select('encrypted_payload').eq('id', board.id).single();
  assert.ok(!stored.error && !stored.data.encrypted_payload.includes('가상하늘'));
  const isolated = await b.client.from('classroom_role_boards').select('id').eq('id', board.id);
  assert.ok(!isolated.error && isolated.data.length === 0);
  const forbidden = await a.client.from('classroom_role_boards').update({ version: 999 }).eq('id', board.id);
  assert.ok(forbidden.error);
  pass('encrypted storage; cross-teacher RLS; direct browser writes denied');

  stage = 'student records';
  const publicInput = { action: 'record', token: board.public_token, periodId: period.id,
    studentId: state.roster[0].id, date: today, status: 'done' };
  const view = await call('public', { action: 'view', token: board.public_token });
  assert.equal(view.students.length, 2);
  assert.ok(!('state' in view) && !('owner_id' in view) && !('public_token' in view));
  await call('public', publicInput);
  await call('public', { ...publicInput, status: 'not_done' });
  let records = await call('admin', { action: 'records', start: today, end: today }, a.jwt);
  assert.ok(records.length === 1 && records[0].status === 'not_done' && records[0].source === 'student');
  const hidden = await call('public', { action: 'view', token: board.public_token });
  assert.ok(hidden.students.every((student) => !('status' in student)));
  const selected = await call('public', { action: 'view', token: board.public_token, studentId: state.roster[0].id });
  assert.equal(selected.students[0].status, 'not_done');
  await call('public', { ...publicInput, date: tomorrow }, undefined, 400);
  await call('public', { ...publicInput, status: 'exempt' }, undefined, 400);
  await call('public', { ...publicInput, studentId: randomUUID() }, undefined, 400);
  pass('shared submission and resubmission; private status; forged inputs rejected');

  stage = 'teacher corrections and version conflicts';
  const teacherInput = { action: 'record', version: board.version, periodId: period.id,
    studentId: state.roster[0].id, date: today, status: 'exempt' };
  await call('admin', teacherInput, a.jwt);
  records = await call('admin', { action: 'records', start: today, end: today }, a.jwt);
  assert.ok(records[0].status === 'exempt' && records[0].source === 'teacher');
  await call('admin', teacherInput, b.jwt, 400);
  const otherRecords = await call('admin', { action: 'records', start: today, end: today, boardId: board.id }, b.jwt);
  assert.equal(otherRecords.length, 0);
  const rpc = await a.client.rpc('write_classroom_role_record', { p_board_id: board.id,
    p_version: board.version, p_period_id: period.id, p_student_id: state.roster[0].id,
    p_date: today, p_status: 'done', p_source: 'teacher' });
  assert.ok(rpc.error);
  await call('admin', { action: 'save', version: 1, state: board.state }, a.jwt, 409);
  await call('admin', { ...teacherInput, status: 'missing' }, a.jwt);
  records = await call('admin', { action: 'records', start: today, end: today }, a.jwt);
  assert.equal(records.length, 0);
  pass('teacher correction/reset; record isolation; service-only RPC; stale save rejected');

  stage = 'historical snapshots and share controls';
  const next = structuredClone(board.state);
  next.roster[0].name = '변경된가상학생';
  next.roles[0].name = '다음기간역할';
  next.periods.push({ id: randomUUID(), start: tomorrow, end: tomorrow,
    students: structuredClone(next.roster), roles: structuredClone(next.roles), assignments: period.assignments });
  board = await call('admin', { action: 'save', version: board.version, state: next }, a.jwt);
  assert.deepEqual(board.state.periods[0], period);
  const current = await call('public', { action: 'view', token: board.public_token });
  assert.equal(current.students[0].name, '가상하늘');
  const tampered = structuredClone(board.state);
  tampered.periods[0].students[0].name = '과거변경시도';
  await call('admin', { action: 'save', version: board.version, state: tampered }, a.jwt, 400);
  board.state.settings.publicEnabled = false;
  board = await call('admin', { action: 'save', version: board.version, state: board.state }, a.jwt);
  assert.equal((await call('public', { action: 'view', token: board.public_token })).students.length, 0);
  await call('public', publicInput, undefined, 400);
  const oldToken = board.public_token;
  board = await call('admin', { action: 'rotateToken', version: board.version }, a.jwt);
  await call('public', { action: 'view', token: oldToken }, undefined, 404);
  pass('period snapshot preservation; sharing disabled; old link revoked');

  if (process.env.ROLES_SMOKE_ORIGIN) {
    stage = 'deployed browser setup';
    const { chromium, expect } = await import('@playwright/test');
    const origin = new URL(process.env.ROLES_SMOKE_ORIGIN).origin;
    const root = `${origin}/tools/classroom-roles`;
    other.state.settings.schoolDays = allDays;
    other.state.roles.forEach((role) => { role.weekdays = allDays; });
    await call('admin', { action: 'save', version: other.version, state: other.state }, b.jwt);
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const teacher = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    await teacher.addInitScript(({ storageKey, session }) => {
      localStorage.setItem(storageKey, JSON.stringify(session));
    }, { storageKey: `sb-${ref}-auth-token`, session: b.session });
    const page = await teacher.newPage();
    const errors = [];
    page.on('pageerror', () => errors.push('teacher page error'));
    await page.goto(root);
    await expect(page.getByRole('region', { name: '1인 1역 기능' }).getByRole('link')).toHaveCount(6);
    await page.getByRole('button', { name: '설정', exact: true }).click();
    await page.getByRole('button', { name: '학급 학생 명단', exact: true }).click();
    await page.getByLabel('학생 명단 (한 줄에 번호와 이름)').fill('1 가상새봄\n2 가상푸름');
    await page.getByRole('button', { name: '학생 명단 저장', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('학생 명단을 저장했습니다');
    await page.goto(`${root}/assign`);
    await expect(page.getByText('설정에 저장된 학생 명단을 자동으로 불러왔습니다.')).toBeVisible();
    await page.getByRole('button', { name: '다음: 역할 설정' }).click();
    await page.getByLabel('1번 가상새봄 역할', { exact: true }).selectOption(other.state.roles[0].id);
    await page.getByLabel('2번 가상푸름 역할', { exact: true }).selectOption(other.state.roles[1].id);
    await expect(page.getByRole('status')).toContainText('미배정 학생 0명');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: '배정 확정하기' }).click();
    await expect(page).toHaveURL(`${root}/board`);
    const sharedUrl = await page.getByLabel('학생 공용 주소').inputValue();
    stage = 'deployed independent student browser';
    const studentContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const student = await studentContext.newPage();
    student.on('pageerror', () => errors.push('student page error'));
    await student.goto(sharedUrl);
    await student.getByRole('button', { name: '1번 가상새봄', exact: true }).click();
    await student.getByRole('button', { name: '했어요', exact: true }).click();
    // A refresh status may coexist briefly with the persisted save confirmation.
    await expect(student.getByRole('status').filter({ hasText: '저장했어요' })).toBeVisible();
    await expect(student.getByRole('heading', { name: '내 이름을 선택해 주세요' })).toBeVisible();
    await student.screenshot({ path: 'test-results/roles-remote-student.png', fullPage: true });
    assert.ok(await student.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.getByRole('button', { name: '기록 새로고침' }).click();
    await expect(page.getByLabel('1번 가상새봄 기록 정정')).toHaveValue('done');
    await page.getByLabel('2번 가상푸름 기록 정정').selectOption('exempt');
    await expect(page.getByRole('status')).toContainText('교사 정정');
    await page.goto(`${root}/records`);
    await page.getByRole('button', { name: /1번 가상새봄/ }).click();
    await expect(page.locator('#role-student-history')).toContainText('학생 자기보고');
    await page.goto(root);
    await page.screenshot({ path: 'test-results/roles-remote-teacher.png', fullPage: true });
    assert.equal(errors.length, 0);
    pass('deployed UI: settings roster → two-step assignment → anonymous mobile submission → teacher/history');
    stage = 'deployed browser share controls';
    await page.goto(`${root}/settings`);
    await page.getByLabel('학생 화면과 입력 허용').uncheck();
    await page.getByRole('button', { name: '운영 설정 저장' }).click();
    await expect(page.getByRole('status')).toContainText('저장했습니다');
    await student.reload();
    await expect(student.getByText('선생님이 학생 입력을 잠시 중지했어요.')).toBeVisible();
    page.on('dialog', (dialog) => dialog.accept());
    const rotated = page.waitForResponse((response) =>
      response.url().endsWith('/classroom-roles-admin') &&
      response.request().postDataJSON()?.action === 'rotateToken');
    await page.getByRole('button', { name: '공용 링크 재발급', exact: true }).click();
    assert.ok((await rotated).ok());
    await student.reload();
    await expect(student.getByRole('alert')).toContainText('사용할 수 없는 학급 링크');
    pass('deployed UI sharing stop and old-link rejection');
  }
} catch (error) {
  // Do not print SDK payloads, session tokens, or assertion diffs from remote data.
  console.error(`FAIL at ${stage}: ${error.name}`);
  console.error(String(error.message)
    .replace(/https?:\/\/[^\s)]+/g, '[url]')
    .replace(/eyJ[A-Za-z0-9_.-]+/g, '[redacted token]')
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '[synthetic id]'));
  if (browser) {
    for (const [i, context] of browser.contexts().entries()) {
      for (const [j, page] of context.pages().entries()) {
        await page.screenshot({ path: `test-results/roles-remote-failure-${i}-${j}.png`, fullPage: true }).catch(() => {});
      }
    }
  }
  const sourceLine = error.stack?.split('\n').find((line) => line.includes('classroomRoles.smoke.mjs:'));
  if (sourceLine) console.error(sourceLine.trim());
  process.exitCode = 1;
} finally {
  await browser?.close();
  let cleaned = 0;
  for (const userId of users) {
    const removed = await admin.auth.admin.deleteUser(userId);
    if (removed.error) {
      console.error(`CLEANUP FAILED for synthetic user ${userId}`);
      process.exitCode = 1;
    } else {
      const remaining = await admin.from('classroom_role_boards').select('id').eq('owner_id', userId);
      if (remaining.error || remaining.data.length) {
        console.error('CLEANUP verification failed');
        process.exitCode = 1;
      } else cleaned++;
    }
  }
  console.log(`Completed ${checks} check groups; removed ${cleaned}/${users.length} synthetic users and cascading feature data.`);
}
