/** Explicit opt-in remote check. Only this run's synthetic users/boards are touched.
 * Keys enter via environment, sessions stay in memory. Google OAuth is not automated.
 * Run SQL contracts inside a rolled-back transaction, then delete the exact test users.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ref = process.env.MISSIONS_SMOKE_PROJECT;
assert.ok(ref && process.env.MISSIONS_SMOKE_ALLOW_WRITE === ref, 'Explicit synthetic-write project opt-in is required.');
const keys = JSON.parse(process.env.MISSIONS_SMOKE_KEYS ?? '[]');
delete process.env.MISSIONS_SMOKE_KEYS;
const anon = keys.find(k => k.name === 'anon')?.api_key;
const service = keys.find(k => k.name === 'service_role')?.api_key;
assert.ok(anon && service, 'Required credentials unavailable.');
const base = `https://${ref}.supabase.co`;
const origin = new URL(process.env.MISSIONS_SMOKE_ORIGIN).origin;
const output = resolve(process.env.MISSIONS_SMOKE_OUTPUT ?? 'test-results/missions-remote');
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(base, service, options);
const run = randomUUID();
const users = [];
const boardIds = [];
const results = [];
let stage = 'initialization';
let browser;
let cleanupDone = false;
const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 86400000 + 9 * 3600000).toISOString().slice(0, 10);
const pass = label => { results.push({ label, passed: true }); console.log(`PASS ${label}`); };
await mkdir(output, { recursive: true });
const journal = resolve(output, 'cleanup.local.json');
const saveJournal = () => writeFile(journal, JSON.stringify({ project: ref, run, users, boardIds }));
function checked(condition, label) { assert.ok(condition, label); }
async function call(kind, body, jwt, expected = 200) {
  const response = await fetch(`${base}/functions/v1/class-missions-${kind}`, {
    method: 'POST', headers: { apikey: anon, 'Content-Type': 'application/json', ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
    body: JSON.stringify(body), signal: AbortSignal.timeout(30000),
  });
  checked(response.status === expected, `${kind}: HTTP ${response.status}; expected ${expected}`);
  return response.json();
}
async function teacher(label) {
  const email = `missions-smoke-${run}-${label}@example.com`;
  const password = `${randomUUID()}aA!9`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true,
    user_metadata: { full_name: `가상검증교사${label}`, class_missions_smoke: run } });
  checked(!created.error && created.data.user, 'Synthetic teacher creation failed');
  users.push(created.data.user.id); await saveJournal();
  const client = createClient(base, anon, options);
  const login = await client.auth.signInWithPassword({ email, password });
  checked(!login.error && login.data.session, 'Real Supabase sign-in failed');
  const identity = await client.auth.getUser();
  checked(!identity.error && identity.data.user.id === created.data.user.id, 'Real JWT identity failed');
  return { client, session: login.data.session, jwt: login.data.session.access_token, id: created.data.user.id };
}
async function load(owner, boardId) {
  const { boards } = await call('admin', { action: 'list' }, owner.jwt);
  checked(boards.every(b => boardIds.includes(b.id)), 'Unexpected non-fixture board');
  const board = boards.find(b => b.id === boardId);
  checked(board, 'Fixture board missing'); return board;
}
async function mutate(owner, board, mutation, expected = 200) {
  return call('admin', { boardId: board.id, version: board.version, ...mutation }, owner.jwt, expected);
}
async function sqlContracts(a,b) {
  stage = 'actual PostgreSQL transaction contracts';
  const template = await readFile(resolve(dirname(fileURLToPath(import.meta.url)),'classMissions.transactions.sql'),'utf8');
  checked([a.id,b.id,run].every(id => /^[0-9a-f-]{36}$/i.test(id)), 'SQL fixture identifiers invalid');
  const sqlPath = resolve(output,`transaction-${run}.local.sql`);
  await writeFile(sqlPath,template.replaceAll('__OWNER_A__',a.id).replaceAll('__OWNER_B__',b.id).replaceAll('__RUN__',run));
  try {
    const { stdout } = await promisify(execFile)(process.env.MISSIONS_SMOKE_SUPABASE_CLI,
      ['db','query','--linked','--project-ref',ref,'--output','json','--file',sqlPath],{ timeout:45000,maxBuffer:1024*1024 });
    const data = JSON.parse(stdout.slice(stdout.indexOf('{')));
    checked(data.rows?.[0]?.passed === true && data.rows[0].contract_groups === 8,'SQL contract report missing');
    pass('8 actual PostgreSQL contracts: RLS/ACL, owner/version, rollback, replace, audit, replay, link revocation');
  } finally { await unlink(sqlPath).catch(() => {}); }
}
try {
  stage = 'real authentication and owner isolation';
  await call('admin', { action: 'list' }, undefined, 401);
  const a = await teacher('A'); const b = await teacher('B');
  const titleA = `가상 원격 A ${run.slice(0, 8)}`;
  const titleB = `가상 원격 B ${run.slice(0, 8)}`;
  let board = (await call('admin', { action: 'createBoard', className: titleA }, a.jwt)).board;
  boardIds.push(board.id); await saveJournal();
  const other = (await call('admin', { action: 'createBoard', className: titleB }, b.jwt)).board;
  boardIds.push(other.id); await saveJournal();
  const listA = await call('admin', { action: 'list' }, a.jwt);
  const listB = await call('admin', { action: 'list' }, b.jwt);
  checked(listA.boards.length === 1 && listA.boards[0].id === board.id, 'Teacher A isolation failed');
  checked(listB.boards.length === 1 && listB.boards[0].id === other.id, 'Teacher B isolation failed');
  await mutate(b, board, { action: 'renameBoard', className: '거부돼야 하는 이름' }, 404);
  pass('real auth/JWT; anonymous 401; cross-owner API read/write isolation');

  stage = 'roster encryption and mission publication';
  const savedRoster = await mutate(a, board, { action: 'saveRoster', rosterText: '1 가상동명\n2 가상동명\n3 가상푸름' });
  board = savedRoster.board;
  const codes = savedRoster.issuedCodes;
  checked(codes.length === 3 && board.state.roster.every(s => !('codeHash' in s)), 'Private code hashes leaked');
  const stored = await admin.from('class_mission_boards').select('encrypted_payload').eq('id', board.id).single();
  checked(!stored.error && stored.data.encrypted_payload.includes('.'), 'Encrypted fixture missing');
  checked(!['가상동명','가상푸름',...codes.map(c => c.code)].some(value => stored.data.encrypted_payload.includes(value)), 'Plaintext stored');
  const missionTitle = '가상 원격 공개 미션';
  board = (await mutate(a, board, { action: 'saveMission', mission: { title: missionTitle,
    description: '가상 자료로만 실제 저장을 검증합니다.', startDate: today, dueDate: tomorrow,
    requiresConfirmation: true, targetStudentIds: board.state.roster.map(s => s.id), status: 'open' } })).board;
  const mission = board.state.missions[0];
  pass('real encrypted roster/code storage and mission publication');

  stage = 'actual browser-role database permissions';
  const anonClient = createClient(base, anon, options);
  for (const client of [anonClient,a.client,b.client]) {
    for (const table of ['class_mission_boards','class_mission_purge_audit']) {
      const filter = table === 'class_mission_boards' ? 'id' : 'board_id';
      const read = await client.from(table).select('id').eq(filter,board.id);
      checked(read.error?.code === '42501', 'Browser SELECT should be permission denied');
      const update = await client.from(table).update(table === 'class_mission_boards' ? { version: 999 } : { status:'resolved' }).eq(filter,board.id);
      checked(update.error?.code === '42501', 'Browser UPDATE should be permission denied');
      const remove = await client.from(table).delete().eq(filter,board.id);
      checked(remove.error?.code === '42501', 'Browser DELETE should be permission denied');
    }
    const insert = await client.from('class_mission_boards').insert({ id:randomUUID(),owner_id:a.id,encrypted_payload:'synthetic-forbidden' });
    checked(insert.error?.code === '42501', 'Browser INSERT should be permission denied');
    const auditInsert = await client.from('class_mission_purge_audit').insert({ board_id:board.id,mission_id:mission.id,
      status:'completed',target_count:0,check_count:0,event_count:0 });
    checked(auditInsert.error?.code === '42501', 'Browser audit INSERT should be permission denied');
    const rpc = await client.rpc('commit_class_mission_purge', { p_board_id:board.id,p_owner_id:a.id,
      p_expected_version:board.version,p_mission_id:mission.id,p_encrypted_payload:'synthetic-forbidden',
      p_target_count:3,p_check_count:0,p_event_count:0,p_clear_roster:false });
    checked(rpc.error?.code === '42501', 'Browser purge RPC should be permission denied');
  }
  pass('anon/owner/foreign teacher denied direct SELECT/INSERT/UPDATE/DELETE and service-only RPC');

  stage = 'public identity and response minimization';
  const duplicate = await call('public', { action:'view',token:board.publicToken,name:'가상동명' },undefined,400);
  checked(duplicate.error.includes('개인 코드') && Object.keys(duplicate).length === 1, 'Duplicate name did not fail safely');
  const codeView = await call('public', { action:'view',token:board.publicToken,name:'가상동명',code:codes[1].code });
  const unique = await call('public', { action:'view',token:board.publicToken,name:' 가상푸름 ' });
  checked(codeView.studentName === '가상동명' && unique.studentName === '가상푸름', 'Identity selection failed');
  checked(Object.keys(unique).sort().join(',') === 'className,missions,studentName', 'Public response keys leaked');
  checked(unique.missions.every(m => !('targets' in m) && !('studentId' in m)), 'Other student data leaked');
  pass('duplicate name rejected; code priority/unique name accepted; public response minimized');

  stage = 'actual student transactions and optimistic concurrency';
  await call('public', { action:'mark',token:board.publicToken,code:codes[1].code,missionId:mission.id,status:'reported' });
  board = await load(a,board.id);
  checked(board.state.checks.length === 1 && board.state.checks[0].studentId === codes[1].id, 'Duplicate student mark went to wrong identity');
  await call('public', { action:'mark',token:board.publicToken,code:codes[1].code,missionId:mission.id,status:'unmarked' });
  const beforeConcurrent = await load(a,board.id);
  await Promise.all(codes.slice(0,2).map(c => call('public', { action:'mark',token:board.publicToken,code:c.code,missionId:mission.id,status:'reported' })));
  board = await load(a,board.id);
  checked(board.state.checks.filter(c => c.status === 'pending').length === 2, 'Concurrent writes lost a mark');
  checked(board.version === beforeConcurrent.version + 2, 'Concurrent version increments incorrect');
  await mutate(a,beforeConcurrent,{ action:'renameBoard',className:'반영되면 안 되는 오래된 입력' },409);
  checked((await load(a,board.id)).state.className === titleA, 'Stale save changed data');
  board = (await mutate(a,board,{ action:'renameBoard',className:titleA })).board;
  pass('correct duplicate identity; mark/cancel; concurrent SQL writes and stale-version rejection');

  stage = 'teacher confirmation and purge safeguards';
  await mutate(a,board,{ action:'confirmPending',missionId:mission.id,expectedStudentIds:[] },409);
  board = (await mutate(a,board,{ action:'confirmPending',missionId:mission.id,expectedStudentIds:codes.slice(0,2).map(c => c.id) })).board;
  checked(board.state.checks.every(c => c.status === 'confirmed'), 'Teacher confirmation failed');
  await call('public',{ action:'mark',token:board.publicToken,code:codes[0].code,missionId:mission.id,status:'unmarked' },undefined,400);
  await mutate(a,board,{ action:'purgeMission',missionId:mission.id,confirmText:'영구 파기',
    expectedTargetCount:0,expectedCheckCount:0,expectedEventCount:0 },409);
  await mutate(a,board,{ action:'purgeMission',missionId:mission.id,confirmText:'영구 파기',
    expectedTargetCount:3,expectedCheckCount:board.state.checks.length,expectedEventCount:board.state.events.length },400);
  checked((await load(a,board.id)).state.missions.length === 1, 'Open mission was purged');
  pass('confirmation list checked; confirmed mark protected; count/retention purge safeguards');

  stage = 'share controls';
  const oldToken = board.publicToken;
  board = (await mutate(a,board,{ action:'setPublic',enabled:false })).board;
  await call('public',{ action:'view',token:oldToken,name:'가상푸름' },undefined,404);
  board = (await mutate(a,board,{ action:'setPublic',enabled:true })).board;
  board = (await mutate(a,board,{ action:'rotateToken' })).board;
  checked(board.publicToken !== oldToken, 'Token rotation failed');
  await call('public',{ action:'view',token:oldToken,name:'가상푸름' },undefined,404);
  pass('share stop/resume; rotated old link rejected');
  await sqlContracts(a,b);

  stage = 'deployed authenticated teacher and anonymous student browsers';
  const { chromium,expect } = await import('@playwright/test');
  browser = await chromium.launch({ channel:'chrome',headless:true });
  const teacherContext = await browser.newContext({ viewport:{ width:1366,height:900 } });
  const storageKey = `sb-${ref}-auth-token`;
  await teacherContext.addInitScript(({ storageKey,session }) => {
    if (!localStorage.getItem(storageKey)) localStorage.setItem(storageKey,JSON.stringify(session));
  },{ storageKey,session:a.session });
  const page = await teacherContext.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror',() => errors.push('teacher page error'));
  await page.goto(`${origin}/tools/class-missions?board=${board.id}`);
  await expect(page.getByRole('combobox',{ name:'학급 선택',exact:true })).toHaveValue(board.id);
  await expect(page.getByRole('region',{ name:'미션 현황',exact:true })).toContainText(missionTitle);
  const studentContext = await browser.newContext({ viewport:{ width:390,height:844 } });
  const student = await studentContext.newPage(); student.setDefaultTimeout(15000);
  student.on('pageerror',() => errors.push('student page error'));
  await student.goto(`${origin}/s/missions/${board.publicToken}`);
  await student.getByLabel('학생 이름',{ exact:true }).fill('가상동명');
  await student.getByRole('button',{ name:'내 미션 보기',exact:true }).click();
  await expect(student.getByRole('alert')).toContainText('개인 코드');
  await student.getByRole('button',{ name:'개인 코드로 접속',exact:true }).click();
  await student.getByLabel('개인 접속 코드',{ exact:true }).fill(codes[1].code);
  await student.getByRole('button',{ name:'내 미션 보기',exact:true }).click();
  await expect(student.getByRole('heading',{ name:'가상동명의 미션',exact:true })).toBeVisible();
  await student.getByRole('button',{ name:'나가기',exact:true }).click();
  await expect(student.getByLabel('학생 이름',{ exact:true })).toHaveValue('');
  await student.getByLabel('학생 이름',{ exact:true }).fill('가상푸름');
  await student.getByRole('button',{ name:'내 미션 보기',exact:true }).click();
  await expect(student.getByRole('button',{ name:'완료했어요',exact:true })).toBeVisible();
  checked(await student.evaluate(() => !Object.keys(localStorage).some(k => k.includes('auth-token'))), 'Student browser unexpectedly authenticated');
  pass('deployed real teacher session; anonymous mobile duplicate-name/code/name entry');

  stage = 'deployed conflict recovery and teacher confirmation';
  await page.getByRole('button',{ name:'새 미션',exact:true }).click();
  const editor = page.getByRole('region',{ name:'새 미션 만들기',exact:true });
  await editor.getByLabel('미션 제목',{ exact:true }).fill('가상 원격 보존 초안');
  const descriptionField = editor.getByRole('textbox',{ name:'학생에게 보일 안내' });
  await descriptionField.fill('충돌 뒤에도 남을 가상 안내');
  await expect(descriptionField).toHaveValue('충돌 뒤에도 남을 가상 안내');
  await editor.getByLabel('시작일',{ exact:true }).fill(today);
  await editor.getByLabel('마감일',{ exact:true }).fill(tomorrow);
  await editor.getByRole('checkbox',{ name:/교사 확인 필요/ }).check();
  await editor.getByRole('checkbox',{ name:'2번 가상동명',exact:true }).uncheck();
  await expect(descriptionField).toHaveValue('충돌 뒤에도 남을 가상 안내');
  await student.getByRole('button',{ name:'완료했어요',exact:true }).click();
  await expect(student.getByText('확인 기다리는 중',{ exact:true })).toBeVisible();
  await editor.getByRole('button',{ name:'초안 저장',exact:true }).click();
  await expect(page.getByRole('alert').first()).toContainText('다른 화면에서 변경');
  await page.getByRole('button',{ name:'새로고침',exact:true }).click();
  await expect(page.getByRole('status').filter({ hasText:'최신 현황을 불러왔습니다' })).toBeVisible();
  await expect(editor.getByLabel('미션 제목',{ exact:true })).toHaveValue('가상 원격 보존 초안');
  await expect(descriptionField).toHaveValue('충돌 뒤에도 남을 가상 안내');
  await expect(editor.getByLabel('시작일',{ exact:true })).toHaveValue(today);
  await expect(editor.getByLabel('마감일',{ exact:true })).toHaveValue(tomorrow);
  await expect(editor.getByRole('checkbox',{ name:/교사 확인 필요/ })).toBeChecked();
  await expect(editor.getByRole('checkbox',{ name:'2번 가상동명',exact:true })).not.toBeChecked();
  await editor.getByRole('button',{ name:'초안 저장',exact:true }).click();
  await expect(page.getByRole('region',{ name:'미션 현황',exact:true })).toContainText('가상 원격 보존 초안');
  board = await load(a,board.id);
  checked(board.state.missions.some(m => m.title === '가상 원격 보존 초안' && m.status === 'draft' && m.targets.length === 2), 'Manual retry not saved');
  await page.getByRole('region',{ name:'미션 목록',exact:true }).getByRole('button').filter({ hasText:missionTitle }).click();
  await page.getByLabel('3번 가상푸름 상태 정정',{ exact:true }).selectOption('confirmed');
  await expect(page.getByLabel('3번 가상푸름 상태 정정',{ exact:true })).toHaveValue('confirmed');
  await student.getByRole('button',{ name:'새로고침',exact:true }).click();
  await expect(student.getByText('교사 확인',{ exact:true })).toBeVisible();
  await student.screenshot({ path:resolve(output,'student-confirmed-mobile.png'),fullPage:true });
  await page.screenshot({ path:resolve(output,'teacher-desktop.png'),fullPage:true });
  checked(await student.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile overflow');
  checked(errors.length === 0, 'Browser page exception');
  pass('real UI→Edge→SQL submission; stale save/input preservation/manual retry; teacher confirmation');

  stage = 'deployed account switch';
  await page.evaluate(({ storageKey,session }) => localStorage.setItem(storageKey,JSON.stringify(session)),{ storageKey,session:b.session });
  await page.reload();
  const select = page.getByRole('combobox',{ name:'학급 선택',exact:true });
  await expect(select).toHaveValue(other.id);
  await expect(select).toContainText(titleB);
  await expect(select).not.toContainText(titleA);
  await expect(page.getByRole('region',{ name:'미션 현황',exact:true })).toHaveCount(0);
  checked(errors.length === 0, 'Account switch browser exception');
  pass('real account switch removes previous teacher board/state');

} catch (error) {
  results.push({ label:stage,passed:false,error:error.name });
  console.error(`FAIL at ${stage}: ${error.name}`);
  // No SDK response objects, credentials, sessions or assertion diffs are logged.
  const safe = String(error.message).split('\n')[0].replace(/eyJ[A-Za-z0-9_.-]+/g,'[token]').replace(/https?:\/\/[^\s]+/g,'[url]');
  console.error(safe.slice(0,350));
  const sourceLine = error.stack?.split('\n').find(line => line.includes('classMissions.smoke.mjs:'));
  if (sourceLine) console.error(sourceLine.trim());
  if (browser) {
    for (const [i,context] of browser.contexts().entries()) {
      for (const [j,page] of context.pages().entries()) {
        const diagnostics = {};
        for (const label of ['미션 제목','학생에게 보일 안내','시작일','마감일']) {
          const field = label === '학생에게 보일 안내' ? page.getByRole('textbox',{ name:label }) : page.getByLabel(label,{ exact:true });
          if (await field.count()) diagnostics[label] = await field.inputValue().catch(() => 'unavailable');
        }
        await writeFile(resolve(output,`failure-${i}-${j}.json`),JSON.stringify(diagnostics));
        await page.getByLabel('개인 접속 코드',{ exact:true }).evaluateAll(elements => elements.forEach(el => { el.type='password'; }));
        await page.screenshot({ path:resolve(output,`failure-${i}-${j}.png`),fullPage:true }).catch(() => {});
      }
    }
  }
  process.exitCode = 1;
} finally {
  await browser?.close();
  let cleaned = 0;
  for (const userId of users) {
    const identity = await admin.auth.admin.getUserById(userId);
    if (identity.error || identity.data.user?.user_metadata?.class_missions_smoke !== run) {
      console.error('CLEANUP synthetic owner guard failed'); process.exitCode = 1; continue;
    }
    if (boardIds.length) {
      const audit = await admin.from('class_mission_purge_audit').delete().in('board_id',boardIds);
      if (audit.error) { console.error('CLEANUP audit deletion failed'); process.exitCode = 1; continue; }
    }
    const removed = await admin.auth.admin.deleteUser(userId);
    const remaining = await admin.from('class_mission_boards').select('id').eq('owner_id',userId);
    const roleRows = await admin.from('classroom_role_boards').select('id').eq('owner_id',userId);
    const absent = await admin.auth.admin.getUserById(userId);
    if (removed.error || remaining.error || remaining.data.length || roleRows.error || roleRows.data.length || !absent.error) {
      console.error('CLEANUP verification failed'); process.exitCode = 1;
    } else cleaned++;
  }
  cleanupDone = cleaned === users.length;
  if (cleanupDone) await unlink(journal).catch(() => {});
  else await saveJournal();
  const report = { project:ref,origin,createdAt:new Date().toISOString(),run,results,
    cleanup:{ createdUsers:users.length,removedUsers:cleaned,fixtureBoards:boardIds.length,verified:cleanupDone },
    limitations:['Google interactive OAuth not automated','No physical school NAT/load or device testing','SQL changes rolled back; no actual retention purge of user data'] };
  await writeFile(resolve(output,'results.json'),JSON.stringify(report,null,2));
  console.log(`Completed ${results.filter(r => r.passed).length} check groups; removed ${cleaned}/${users.length} synthetic users and verified cascading data cleanup.`);
}
