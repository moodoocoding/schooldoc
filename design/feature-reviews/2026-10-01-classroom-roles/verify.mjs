// Review harness: actual Chrome, local demo and fictional students only.
// Existing defects are observed here; completed does not mean a defect is fixed.
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const output = resolve(dirname(fileURLToPath(import.meta.url)), 'evidence');
await mkdir(output, { recursive: true });
const base = process.env.ROLES_REVIEW_URL ?? 'http://127.0.0.1:4176';
if (new URL(base).hostname !== '127.0.0.1') throw new Error('Local demo only');
const browser = await chromium.launch({ channel: 'chrome' });
const key = 'schooldoc_classroom_roles_demo_v1';
const root = `${base}/tools/classroom-roles`;
const results = [];
async function shot(page, name) { await page.screenshot({ path: resolve(output, `${name}.png`), fullPage: true }); }
async function scenario(name, run) {
  if (process.env.ROLES_REVIEW_FILTER && !name.includes(process.env.ROLES_REVIEW_FILTER)) return;
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage(); page.setDefaultTimeout(7000);
  const errors = []; page.on('pageerror', error => errors.push(String(error)));
  try { results.push({ name, completed: true, ...(await run(page, context)), pageErrors: errors }); }
  catch (error) { results.push({ name, completed: false, error: String(error), pageErrors: errors }); }
  finally { await context.close(); }
  console.log(name, JSON.stringify(results.at(-1)));
}
async function seed(page, count = 24, mode = 'normal') {
  await page.goto(root);
  await expect(page.getByRole('heading', { name: '1인 1역', exact: true })).toBeVisible();
  const board = await page.evaluate(async ({ key, count, mode }) => {
    const api = await import('/src/features/classroomRoles/roleApi.ts');
    const state = api.defaultRoleState();
    const today = api.roleToday();
    const day = offset => new Date(new Date(`${today}T00:00:00Z`).getTime() + offset * 86400000).toISOString().slice(0,10);
    state.settings.title = '가상 5학년 2반 1인 1역';
    state.settings.schoolDays = [0,1,2,3,4,5,6];
    state.roster = api.parseRoleRoster(Array.from({length:count},(_,i)=>`${i+1} 가상학생${i+1}${i === count-1 ? '긴이름확인' : ''}`).join('\n'));
    state.roles.forEach(role => { role.weekdays = [0,1,2,3,4,5,6]; });
    if (mode === 'one-role') { state.roles = [state.roles[0]]; state.roles[0].capacity = 60; }
    else state.roles.forEach(role=>{role.capacity=Math.max(2,Math.ceil(count/state.roles.length));});
    state.roles[0].description = '수업이 끝나면 칠판을 닦고 지우개를 정리해 주세요.';
    const period = { id:crypto.randomUUID(), start:day(-7), end:day(20), students:structuredClone(state.roster), roles:structuredClone(state.roles),
      assignments: Object.fromEntries(state.roster.map((s,i)=>[s.id,state.roles[i % state.roles.length].id])) };
    state.periods = [period];
    if (mode === 'unassigned') state.periods = [];
    api.validateRoleState(state);
    const board = {id:crypto.randomUUID(),public_token:crypto.randomUUID(),version:1,state};
    const records = count && mode !== 'unassigned' ? [{period_id:period.id,student_id:state.roster[0].id,record_date:day(-1),status:'not_done',source:'student',updated_at:new Date().toISOString()}] : [];
    localStorage.setItem(key,JSON.stringify(board)); localStorage.setItem(`${key}_records`,JSON.stringify(records));
    return { ...board, today, yesterday:day(-1) };
  }, {key,count,mode});
  await page.reload();
  return board;
}
try {
  await scenario('desktop-mobile-workflow-and-description', async(page, context)=>{
    const board=await seed(page);
    await shot(page,'teacher-home-24');
    await page.goto(`${root}/assign`); await page.getByRole('button',{name:'다음: 역할 배정'}).click();
    await shot(page,'assignment-24-desktop'); await page.setViewportSize({width:390,height:844}); await shot(page,'assignment-24-mobile');
    await page.setViewportSize({width:1366,height:900});
    await page.goto(`${root}/board`); await expect(page.getByRole('table')).toBeVisible();
    await shot(page,'teacher-board-24-desktop');
    const displayLinks=await page.locator('a[href*="view=display"]').count();
    const teacherAxe=(await new AxeBuilder({page}).include('main').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}));
    const waiting=page.waitForEvent('download'); await page.getByRole('button',{name:'QR 이미지 저장'}).click();
    const download=await waiting; await download.saveAs(resolve(output,'roles-student-qr.png'));
    const png=await readFile(resolve(output,'roles-student-qr.png'));
    const student=await context.newPage(); await student.setViewportSize({width:390,height:844});
    await student.goto(`${base}/s/roles/${board.public_token}`); await shot(student,'student-tiles-24-mobile');
    await student.getByRole('button',{name:'1번 가상학생1',exact:true}).click();
    const dialog=student.getByRole('dialog',{name:board.state.roles[0].name}); await expect(dialog).toBeVisible();
    const descriptionRendered=await dialog.getByText(board.state.roles[0].description,{exact:true}).count();
    await shot(student,'student-detail-missing-description');
    await student.getByRole('button',{name:'했어요',exact:true}).click();
    await expect(dialog.getByRole('status')).toContainText('했어요로 저장했어요.');
    await expect(dialog.getByRole('button',{name:'했어요',exact:true})).toHaveAttribute('aria-pressed','true');
    const publicAxe=(await new AxeBuilder({page:student}).include('dialog').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations.map(v=>({id:v.id,nodes:v.nodes.length}));
    await student.keyboard.press('Escape'); await expect(student.getByRole('button',{name:'1번 가상학생1',exact:true})).toBeFocused();
    await page.setViewportSize({width:390,height:844}); await shot(page,'teacher-board-24-mobile');
    await student.setViewportSize({width:1920,height:1080}); await student.goto(`${base}/s/roles/${board.public_token}?view=display`);
    await shot(student,'whiteboard-24-desktop');
    return {descriptionRendered,displayLinks,teacherAxe,publicAxe,qr:{width:png.readUInt32BE(16),height:png.readUInt32BE(20)},submission:'done row written and focus restored'};
  });
  await scenario('historical-correction-route-only-edits-today', async(page)=>{
    const board=await seed(page,2); await page.goto(`${root}/records`);
    await page.locator('input[type="month"]').fill(board.yesterday.slice(0,7));
    await page.getByRole('button',{name:/1번 가상학생1/}).first().click();
    await expect(page.locator('#role-student-history')).toContainText(board.yesterday);
    await shot(page,'history-yesterday-no-edit');
    await page.getByRole('link',{name:'실천판에서 기록 정정 →'}).click();
    await page.getByRole('table').getByRole('button',{name:'가상학생1',exact:true}).click();
    await expect(page.getByLabel('1번 가상학생1 기록 정정')).toBeVisible();
    const dateInputs=await page.locator('input[type="date"]').count();
    await page.getByLabel('1번 가상학생1 기록 정정').selectOption('done');
    await expect(page.getByRole('status')).toContainText('교사 정정');
    const records=await page.evaluate(key=>JSON.parse(localStorage.getItem(`${key}_records`)),key);
    expect(records.find(r=>r.record_date===board.yesterday).status).toBe('not_done');
    expect(records.find(r=>r.record_date===board.today).status).toBe('done');
    await shot(page,'correction-only-today'); return {dateInputs,yesterday:board.yesterday,today:board.today,records:records.map(r=>({date:r.record_date,status:r.status}))};
  });
  await scenario('unsaved-assignment-browser-back-loses-draft', async(page)=>{
    await seed(page,2,'unassigned');
    let confirmations=0; page.on('dialog',async d=>{confirmations++;await d.dismiss();});
    await page.getByRole('link',{name:/학생 역할 배정/}).click();
    await page.getByRole('button',{name:'다음: 역할 배정'}).click();
    await page.getByRole('button',{name:'1번 가상학생1 추가',exact:true}).click();
    await expect(page.getByRole('button',{name:'1번 가상학생1 배정 해제',exact:true})).toBeVisible();
    await page.goBack(); await expect(page).toHaveURL(root);
    await page.getByRole('link',{name:/학생 역할 배정/}).click(); await page.getByRole('button',{name:'다음: 역할 배정'}).click();
    await expect(page.getByRole('button',{name:'1번 가상학생1 추가',exact:true})).toBeVisible();
    await shot(page,'assignment-browser-back-draft-lost'); return {confirmations,draftRetained:false};
  });
  await scenario('unsaved-catalog-navigation-loses-fields', async(page)=>{
    const board=await seed(page,2); await page.goto(`${root}/roles`);
    const input=page.getByLabel('역할 1 이름'); const initial=await input.inputValue();
    await input.fill('가상 수정 중 역할');
    let confirmations=0; page.on('dialog',async d=>{confirmations++;await d.dismiss();});
    await page.getByRole('button',{name:'스쿨독 홈으로 이동'}).click();
    await page.goto(`${root}/roles`); await expect(page.getByLabel('역할 1 이름')).toHaveValue(initial);
    return {initial,confirmations,unsavedValue:'가상 수정 중 역할',persisted:board.state.roles[0].name};
  });
  await scenario('delayed-submit-message-appears-for-next-student', async(page)=>{
    const board=await seed(page,2);
    let injected=false;
    await page.route('**/src/features/classroomRoles/roleApi.ts*',async route=>{
      const response=await route.fetch(); const source=await response.text();
      const delayed=source.replace(/async function writeRoleRecord\(input\)\s*\{/, match=>{injected=true;return `${match}\n await new Promise(resolve => setTimeout(resolve, 1500));`;});
      await route.fulfill({response,body:delayed});
    });
    await page.goto(`${base}/s/roles/${board.public_token}`);
    await page.getByRole('button',{name:'1번 가상학생1',exact:true}).click();
    await page.getByRole('button',{name:'했어요',exact:true}).click();
    await page.getByRole('button',{name:'상세 닫기'}).click();
    await page.getByRole('button',{name:'2번 가상학생2긴이름확인',exact:true}).click();
    const dialog=page.getByRole('dialog');
    await expect(dialog.getByRole('status')).toContainText('했어요로 저장했어요.');
    await expect(dialog.getByRole('button',{name:'했어요',exact:true})).toHaveAttribute('aria-pressed','false');
    expect(injected).toBe(true);
    await shot(page,'late-feedback-on-another-student');
    const records=await page.evaluate(key=>JSON.parse(localStorage.getItem(`${key}_records`)),key);
    return {injectedDelayMs:1500,messageStudent:2,actuallySavedStudent:board.state.roster.find(s=>s.id===records.find(r=>r.record_date===board.today).student_id).number,reproduced:true};
  });
  await scenario('print-normal-and-valid-large-capacity-overlap', async(page)=>{
    await seed(page,24); await page.goto(`${root}/print`);
    await expect(page.locator('.role-poster-slot')).toHaveCount(20);
    await shot(page,'poster-normal-preview');
    await page.pdf({path:resolve(output,'poster-normal.pdf'),format:'A4',printBackground:true});
    await seed(page,60,'one-role'); await page.goto(`${root}/print`);
    const geometry=await page.locator('.role-poster-slot').first().evaluate(el=>{
      const box=el.getBoundingClientRect(); const content=el.lastElementChild.getBoundingClientRect();
      return {slotTop:box.top,slotBottom:box.bottom,slotHeight:box.height,contentTop:content.top,contentBottom:content.bottom,contentHeight:content.height};
    });
    expect(geometry.contentHeight).toBeGreaterThan(geometry.slotHeight);
    await shot(page,'poster-60-one-role-overlap');
    await page.pdf({path:resolve(output,'poster-60-one-role.pdf'),format:'A4',printBackground:true});
    return {validStudents:60,validCapacity:60,geometry,overlap:true};
  });
  await scenario('sixty-students-responsive-and-zoom',async(page,context)=>{
    const board=await seed(page,60); await page.goto(`${root}/board`); await expect(page.getByRole('table')).toBeVisible();
    await shot(page,'teacher-board-60-desktop');
    await page.setViewportSize({width:390,height:844}); await shot(page,'teacher-board-60-mobile');
    const teacherOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
    const student=await context.newPage();await student.setViewportSize({width:1366,height:900}); await student.goto(`${base}/s/roles/${board.public_token}`);
    await expect(student.getByRole('button',{name:'1번 가상학생1',exact:true})).toBeVisible();
    await student.evaluate(()=>document.documentElement.style.zoom='2'); await shot(student,'student-60-css-200');
    return {teacherOverflow,studentOverflow:await student.evaluate(()=>document.documentElement.scrollWidth>innerWidth)};
  });
} finally { await browser.close(); await writeFile(resolve(output,'results.json'),JSON.stringify(results,null,2)+'\n'); }
if(results.some(r=>!r.completed)) process.exitCode=1;
