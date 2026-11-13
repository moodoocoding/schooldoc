import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import readXlsx from 'read-excel-file/node';

const captureDir = 'test-results/neis-behavior';
async function setup(page: Page, count = 24, hold = false) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('dialog', (dialog) => dialog.accept());
  await page.route(/https:\/\/[^/]+\/(auth|rest|functions|storage)\/v1\//, (route) => route.abort());
  await page.route('**/src/utils/supabaseClient.ts', (route) => route.fulfill({ contentType: 'application/javascript', body: `
    export const isSupabaseConfigured = true;
    const user = {id:'behavior-fixture',email:'panthea0@gmail.com',email_confirmed_at:'2026-11-14',is_anonymous:false,app_metadata:{},user_metadata:{}};
    window.__behaviorCalls=[];
    export const supabase={auth:{getSession:async()=>({data:{session:{user}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},functions:{invoke:async(name,options)=>{
      window.__behaviorCalls.push(options.body);
      const encoder=new TextEncoder();
      const stream=new ReadableStream({start(controller){
        const send=event=>controller.enqueue(encoder.encode('data: '+JSON.stringify(event)+'\\n\\n'));
        const rows=options.body.students.map((s,i)=>({id:s.id,text:window.__behaviorCalls.length===1?'친구의 생각을 경청하며 함께 활동하는 태도를 지님.':String.fromCharCode(0xAC00+Number(s.id.slice(1)))+'장점을 살려 학습 활동에 꾸준히 참여함.',error:''}));
        send({type:'row',row:rows[0]});
        const finish=()=>{rows.slice(1).forEach(row=>send({type:'row',row}));send({type:'done'});controller.close();};
        if(${hold}) window.__behaviorRelease=finish; else setTimeout(finish,200);
        options.signal.addEventListener('abort',()=>controller.error(new DOMException('cancelled','AbortError')),{once:true});
      }});
      return {data:new Response(stream,{headers:{'Content-Type':'text/event-stream'}}),error:null};
    }}};
  ` }));
  await page.addInitScript(({ count }) => {
    localStorage.setItem('schooldoc_classroom_roles_demo_v1', JSON.stringify({ id: 'fake-board', version: 1, state: { roster: Array.from({ length: count }, (_, index) => ({ id: `fake-${index}`, number: count - index, name: index < 2 ? '가상동명' : index === 2 ? '가상아주긴이름학생테스트' : `가상학생${count - index}` })) } }));
  }, { count });
  await page.goto('/tools/neis-helper/behavior');
  await expect(page.getByRole('heading', { name: '행동특성 및 발달상황', exact: true })).toBeVisible();
  return errors;
}
async function roster(page: Page) {
  await page.getByRole('button', { name: '설정의 학생 명단 불러오기' }).click();
  await expect(page.getByLabel(/^1번 .* 특성 추가$/)).toBeVisible();
}
async function fill(page: Page, count: number) {
  for (let n = 1; n <= count; n++) await page.getByLabel(new RegExp(`^${n}번 .* 특성 추가$`)).selectOption(n % 2 ? '배려' : '끈기');
  await page.getByLabel(/^1번 .* 교사 메모$/).fill('친구의 의견을 듣고 자신의 생각을 차분히 설명함.');
}
test('24명 전체 입력·단일 요청·실시간 행·편집 보존·중복 선택 재작성·Excel', async ({ page }) => {
  await mkdir(captureDir, { recursive: true });
  const errors = await setup(page, 24, true);
  await page.screenshot({ path: `${captureDir}/empty-desktop.png`, fullPage: true });
  await roster(page); await fill(page, 24);
  await page.screenshot({ path: `${captureDir}/input-24-desktop.png`, fullPage: true });
  await page.getByRole('button', { name: '학급 24명 작성', exact: true }).click();
  const first = page.getByLabel(/^1번 .* 작성 내용$/);
  await expect(first).toHaveValue(/친구의/);
  await expect(page.getByLabel(/^2번 .* 작성 내용$/)).toHaveValue('');
  await expect(first).toBeEditable();
  await first.fill('차분한 태도로 친구와 의견을 나누며 서로의 생각을 존중함.');
  await page.screenshot({ path: `${captureDir}/stream-24-desktop.png`, fullPage: true });
  await page.evaluate(() => (window as unknown as { __behaviorRelease(): void }).__behaviorRelease());
  await expect(page.getByRole('status').filter({ hasText: '24명 완료' })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __behaviorCalls: unknown[] }).__behaviorCalls.length)).toBe(1);
  await page.getByRole('button', { name: '중복 23명만 다시 작성', exact: true }).click();
  await page.evaluate(() => (window as unknown as { __behaviorRelease(): void }).__behaviorRelease());
  await expect(page.getByRole('status').filter({ hasText: '24명 완료' })).toBeVisible();
  await expect(first).toHaveValue('차분한 태도로 친구와 의견을 나누며 서로의 생각을 존중함.');
  const calls = await page.evaluate(() => (window as unknown as { __behaviorCalls: { students: { id: string }[]; avoid: string[] }[] }).__behaviorCalls);
  expect(calls[1].students).toHaveLength(23);
  expect(calls[1].students.some((s) => s.id === 's1')).toBe(false);
  expect(calls[1].avoid).toEqual(['차분한 태도로 친구와 의견을 나누며 서로의 생각을 존중함.']);
  expect(JSON.stringify(calls)).not.toContain('가상학생');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Excel 저장', exact: true }).click();
  const file = await download;
  const rows = (await readXlsx((await file.path())!))[0].data;
  expect(rows).toHaveLength(25);
  expect(rows[1][0]).toBe('1'); expect(rows[24][0]).toBe('24'); expect(rows[1][2]).toBe(await first.inputValue());
  expect(rows[0][4]).toBe('바이트(줄바꿈 1)');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(errors).toEqual([]);
  await page.screenshot({ path: `${captureDir}/results-24-desktop.png`, fullPage: true });
});

test('중단 시 도착한 내용을 남기고 미완료만 다시 요청한다', async ({ page }) => {
  await setup(page, 3, true); await roster(page); await fill(page, 3);
  await page.getByRole('button', { name: '학급 3명 작성' }).click();
  await expect(page.getByLabel(/^1번 .* 작성 내용$/)).toHaveValue(/친구의/);
  await page.getByRole('button', { name: '작성 중단', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('중단');
  await page.getByRole('button', { name: '미완료 2명 작성' }).click();
  await page.evaluate(() => (window as unknown as { __behaviorRelease(): void }).__behaviorRelease());
  await expect(page.getByRole('status').filter({ hasText: '3명 완료' })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __behaviorCalls: { students: { id: string }[] }[] }).__behaviorCalls[1].students.map((s) => s.id))).toEqual(['s2', 's3']);
});

test('모바일 60명·키보드 특성 선택·입력 변경 표시·200% 화면', async ({ page }) => {
  await mkdir(captureDir, { recursive: true });
  const errors = await setup(page, 60); await roster(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const select = page.getByLabel(/^1번 .* 특성 추가$/);
  await select.focus(); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /^1번 .* 삭제$/ })).toBeVisible();
  await page.getByRole('button', { name: '학급 1명 작성' }).click();
  await expect(page.getByRole('status').filter({ hasText: '1명 완료' })).toBeVisible();
  await page.getByRole('button', { name: '특성·메모', exact: true }).click();
  await page.getByLabel(/^1번 .* 교사 메모$/).fill('꾸준히 질문하며 과제 해결 방법을 찾음.');
  await page.getByRole('button', { name: '작성 결과', exact: true }).click();
  await expect(page.getByTestId('behavior-1')).toContainText('입력 변경됨');
  await page.getByRole('button', { name: '입력 변경 반영 확인' }).click();
  await expect(page.getByTestId('behavior-1')).toContainText('직접 수정함');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: `${captureDir}/results-60-mobile.png`, fullPage: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${captureDir}/results-mobile-viewport.png` });
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `${captureDir}/results-200-percent.png`, fullPage: true });
  expect(errors).toEqual([]);
});

test('명단 교체 취소는 입력을 보존하고 명시적으로 선택한 수정 문장만 재작성한다', async ({ page }) => {
  await setup(page, 2); await roster(page); await fill(page, 2);
  await page.getByRole('button', { name: '다른 명단', exact: true }).click();
  await page.getByRole('button', { name: '기존 명단 유지', exact: true }).click();
  await expect(page.getByLabel(/^1번 .* 교사 메모$/)).toHaveValue(/친구의 의견/);
  await page.getByRole('button', { name: '학급 2명 작성' }).click();
  await expect(page.getByRole('status').filter({ hasText: '2명 완료' })).toBeVisible();
  const first = page.getByLabel(/^1번 .* 작성 내용$/);
  await first.fill('자신의 생각을 또렷하게 표현함.');
  await page.getByLabel(/^1번 .* 재작성 선택$/).check();
  await page.getByRole('button', { name: '선택 1명 다시 작성' }).click();
  await expect(first).not.toHaveValue('자신의 생각을 또렷하게 표현함.');
  expect(await page.evaluate(() => (window as unknown as { __behaviorCalls: { students: { id: string }[] }[] }).__behaviorCalls[1].students.map((s) => s.id))).toEqual(['s1']);
});

test('CSV 파일 명단을 가져와 번호순으로 입력한다', async ({ page }) => {
  await setup(page, 0);
  await page.getByRole('button', { name: '파일·붙여넣기로 가져오기', exact: true }).click();
  await page.getByTestId('class-roster-file-input').setInputFiles({ name: 'fictional-roster.csv', mimeType: 'text/csv', buffer: Buffer.from('번호,이름\n3,가상다\n1,가상가\n2,가상나', 'utf8') });
  await page.getByRole('button', { name: '이 명단 적용', exact: true }).click();
  await expect(page.getByTestId('behavior-1')).toContainText('가상가');
  await expect(page.locator('tbody tr').first()).toHaveAttribute('data-testid', 'behavior-1');
});

test('전체 동일 문장은 Excel로 내보내지 않고 실패를 알린다', async ({ page }) => {
  await setup(page, 2); await roster(page); await fill(page, 2);
  await page.getByRole('button', { name: '학급 2명 작성' }).click();
  await expect(page.getByRole('status').filter({ hasText: '2명 완료' })).toBeVisible();
  await page.getByRole('button', { name: 'Excel 저장', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('전체 내용이 같은 학생');
});
