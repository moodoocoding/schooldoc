import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { unzipSync, strFromU8 } from 'fflate';
import { jsPDF } from 'jspdf';
import { analysis, authoredDraft, draft, sourceText } from '../fixtures/schoolPlan';
import { authorizePlanRequest, createPlanHandler } from '../../supabase/functions/school-plan/core';
import { requestPlanAi } from '../../supabase/functions/school-plan/openai';
import { PLAN_REFERENCE_VERSION } from '../../supabase/functions/_shared/schoolPlanReferences';

async function setup(page: Page, options: { questions?: number; failure?: boolean; anonymous?: boolean; realClient?: boolean; teacher?: boolean; unconfirmed?: boolean } = {}) {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  page.on('close', () => expect(errors).toEqual([]));
  // Local transport and authentication substitutes; no provider or remote data.
  await page.route('**/src/utils/supabaseClient.ts', route => route.fulfill({ contentType: 'application/javascript', body: `
    export const isSupabaseConfigured = true;
    const user = {id:'plan-test-teacher',is_anonymous:${!!options.anonymous},email:'${options.teacher ? 'teacher@example.invalid' : 'panthea0@gmail.com'}',email_confirmed_at:${options.unconfirmed ? 'null' : "'2026-10-26T00:00:00Z'"},app_metadata:{},user_metadata:{name:'테스트 교사'}};
    export const supabase = {
      auth:{getSession:async()=>({data:{session:{user}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({})},
      functions:{invoke:async(name,options)=>{
        const r=await fetch('/__test_school_plan',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer fixture-token'},body:JSON.stringify(options.body),signal:options.signal});
        return r.ok ? {data:await r.json(),error:null}:{data:null,error:{context:r}};
      }}
    };
  ` }));
  if (!options.realClient) await page.route('**/src/features/schoolDocuments/planApi.ts', route => route.fulfill({ contentType: 'application/javascript', body: `
    export async function runPlanAi(body,signal){const r=await fetch('/__test_school_plan',{method:'POST',body:JSON.stringify(body),signal}); if(!r.ok)throw new Error('시험용 서버 오류. 입력은 유지됩니다.');return r.json();}
  ` }));
  await page.route('**/__test_school_plan', async route => {
    const request = route.request().postDataJSON();
    if (options.failure) { await route.fulfill({ status: 503, json: { error: 'offline' } }); return; }
    if (request.action === 'analyze') await route.fulfill({ json: { analysis: { ...analysis, questions: Array.from({ length: options.questions ?? 0 }, (_, i) => ({ id: `q${i}`, label: `추가 확인 ${i + 1}`, hint: '시험 조건' })) } } });
    else if (request.action === 'revise') await route.fulfill({ json: { draft: { ...draft, schedule: draft.schedule.map((s, i) => i ? s : { ...s, when: '10월 셋째 주(안)' }) } } });
    else await route.fulfill({ json: { draft } });
  });
  await page.goto('/tools/school-documents');
}
async function decisions(page: Page, max = 3) {
  expect(await page.locator('[data-decision]').count()).toBeLessThanOrEqual(max);
  const controls = page.locator('section[aria-labelledby="plan-step-heading"] input:not([type=hidden]),section[aria-labelledby="plan-step-heading"] textarea,section[aria-labelledby="plan-step-heading"] select');
  expect(await controls.count()).toBeLessThanOrEqual(max);
}
async function source(page: Page, paste = false) {
  await page.getByRole('button', { name: '계획서 작성', exact: true }).click();
  if (paste) { await page.getByLabel('공문 입력 방식').selectOption('paste'); await page.getByLabel('공문과 붙임 본문').fill(sourceText); }
  else await page.getByLabel('공문·붙임 파일').setInputFiles({ name: '가상 공문.txt', mimeType: 'text/plain', buffer: Buffer.from(sourceText) });
  await decisions(page);
  await page.getByRole('checkbox', { name: /OpenAI/ }).check();
  await page.getByRole('button', { name: '공문 분석', exact: true }).click();
  await expect(page.getByRole('heading', { name: '공문 확인', exact: true })).toBeVisible();
}
async function generate(page: Page) {
  await page.getByRole('button', { name: '학교 조건으로 계속' }).click();
  await page.getByLabel('학교 예산(원)').fill('300000');
  await page.getByLabel('행사·운영 시기').fill('2026년 11월 2~6일');
  await decisions(page);
  await page.getByRole('button', { name: 'AI 초안 작성', exact: true }).click();
  await expect(page.getByRole('heading', { name: '초안 검토', exact: true })).toBeVisible();
}

test('유형 자동 추천과 비식별 사례를 실제 요청 코어에 연결하고 세 선택을 유지한다', async ({ page }) => {
  await setup(page, { realClient: true });
  let referenceChecked = false;
  const handler = createPlanHandler({
    authorize: async () => 'fixture-admin', consumeQuota: async () => true,
    run: (request, signal) => requestPlanAi(request, 'fixture-key', 'fixture-model', async (_url, init) => {
      const payload = JSON.parse(String(init?.body));
      const data = JSON.parse(payload.input[0].content[0].text);
      if (request.action === 'analyze') expect(data.referencePack).toBeUndefined();
      else {
        expect(data.referencePack.type).toBe('student-program');
        expect(data.referencePack.examples.map((e: { id: string }) => e.id)).toEqual(['program-01', 'program-02']);
        expect(data.referenceVersion).toBe(PLAN_REFERENCE_VERSION);
        referenceChecked = true;
      }
      return new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(request.action === 'analyze' ? analysis : authoredDraft) }] }] }));
    }, signal),
  });
  await page.route('**/__test_school_plan', async route => {
    const req = route.request();
    const response = await handler(new Request(req.url(), { method: 'POST', headers: req.headers(), body: req.postData() }));
    await route.fulfill({ status: response.status, body: await response.text(), contentType: 'application/json' });
  });
  await expect(page.getByLabel('운영계획 유형')).toHaveValue('auto');
  await decisions(page, 2);
  await source(page, true);
  await page.getByRole('button', { name: '학교 조건으로 계속' }).click();
  await expect(page.getByRole('complementary', { name: '작성·검토 기준' })).toContainText('학생 교육활동·행사');
  await page.getByLabel('주제·사업명').fill('교원 연수 운영');
  await expect(page.getByRole('complementary', { name: '작성·검토 기준' })).toContainText('교원 연수');
  await page.getByLabel('주제·사업명').fill('독서 주간 운영');
  await page.getByLabel('학교 예산(원)').fill('300000');
  await page.getByText('작성 기준과 참고 사례 보기', { exact: true }).click();
  await decisions(page);
  await page.screenshot({ path: 'test-results/school-plan/references-conditions-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'AI 초안 작성', exact: true }).click();
  await expect(page.getByRole('heading', { name: '초안 검토', exact: true })).toBeVisible();
  expect(referenceChecked).toBe(true);
  await page.getByText('유형별 검토 항목과 참고 사례', { exact: true }).click();
  await expect(page.getByRole('complementary', { name: '작성·검토 기준' })).toContainText('검토 완료 표시가 아닙니다');
  await decisions(page);
  await page.screenshot({ path: 'test-results/school-plan/references-review-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/school-plan/references-review-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
  await page.setViewportSize({ width: 683, height: 450 });
  await page.screenshot({ path: 'test-results/school-plan/references-review-zoom.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('직접 고른 유형과 초안의 적용 기준은 새로고침 후에도 유지된다', async ({ page }) => {
  await setup(page);
  await page.getByLabel('운영계획 유형').selectOption('club');
  await page.reload();
  await expect(page.getByLabel('운영계획 유형')).toHaveValue('club');
  await decisions(page, 2);
  await source(page); await generate(page);
  await expect(page.getByRole('complementary', { name: '작성·검토 기준' })).toContainText('스포츠클럽·동아리');
  await page.reload();
  await expect(page.getByRole('complementary', { name: '작성·검토 기준' })).toContainText('직접 선택한 유형');
  await decisions(page);
  await page.getByRole('button', { name: '출력 확인', exact: true }).click();
  await expect(page.getByRole('img', { name: '운영계획서 1쪽 지면' })).toBeVisible();
  await decisions(page);
});

test('공문 → 근거 → 조건 → 초안 수정 → HWPX와 새로고침', async ({ page }) => {
  await setup(page); await decisions(page); await source(page);
  await page.getByText('원문 확인 · 가상 공문.txt · 본문').first().click();
  await expect(page.getByRole('blockquote').first()).toContainText('11월');
  await generate(page); await decisions(page);
  await expect(page.getByRole('article')).toContainText('합계 200,000원');
  await page.getByRole('button', { name: '본문 수정', exact: true }).click();
  await decisions(page, 2);
  await page.getByLabel('본문 내용').fill('학생이 직접 고른 책을 읽고 자신의 읽기 기록을 남긴 뒤 학급별 작품을 나눈다.');
  await page.getByRole('button', { name: '본문 반영', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('article')).toContainText('학생이 직접 고른 책');
  await page.getByRole('button', { name: '출력 확인' }).click();
  await decisions(page);
  const saved = page.waitForEvent('download'); await page.getByRole('button', { name: 'HWPX 저장', exact: true }).click();
  const download = await saved; expect(download.suggestedFilename()).toMatch(/초안\.hwpx$/);
  await download.saveAs('test-results/school-plan/browser-2page.hwpx');
  const files = unzipSync(await readFile('test-results/school-plan/browser-2page.hwpx'));
  expect(strFromU8(files.mimetype)).toBe('application/hwp+zip');
  const xml = strFromU8(files['Contents/section0.xml']);
  expect(xml).toContain('학생이 직접 고른 책'); expect(xml).toContain('11월 9일까지');
  expect((xml.match(/<hp:tbl\b/g) ?? []).length).toBe(2);
  await expect(page.getByRole('img', { name: /운영계획서 .*쪽 지면/ })).toHaveCount(1);
  await decisions(page);
  await page.screenshot({ path: 'test-results/school-plan/save-desktop.png', fullPage: true });
  await page.getByLabel('미리볼 쪽').selectOption('1');
  await expect(page.getByRole('img', { name: '운영계획서 2쪽 지면' })).toBeVisible();
  await page.screenshot({ path: 'test-results/school-plan/save-desktop-page2.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/school-plan/save-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByText('문서 본문 읽기', { exact: true }).click();
  await expect(page.getByText('시기: 10월 마지막 주', { exact: false })).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(accessibility.violations).toEqual([]);
  await page.getByText('문서 본문 읽기', { exact: true }).click();
  await page.setViewportSize({ width: 683, height: 450 });
  await page.screenshot({ path: 'test-results/school-plan/save-zoom-equivalent.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('질문 7개를 최대 3개씩 나누고 앞뒤 이동 시 답을 유지한다', async ({ page }) => {
  await setup(page, { questions: 7 }); await source(page, true);
  await decisions(page); await page.getByLabel('추가 확인 1', { exact: true }).fill('1차 답변');
  await page.getByRole('button', { name: '다음 확인 사항' }).click(); await decisions(page);
  await expect(page.getByLabel('추가 확인 4', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '이전', exact: true }).click();
  await expect(page.getByLabel('추가 확인 1', { exact: true })).toHaveValue('1차 답변');
  for (let i = 0; i < 3; i++) { await decisions(page); await page.getByRole('button', { name: /다음 확인 사항|학교 조건으로 계속/ }).click(); }
  await expect(page.getByRole('heading', { name: '학교 조건', exact: true })).toBeVisible();
});

test('분석 실패·잘못된 확장자에도 본문을 보존하고 새로고침한다', async ({ page }) => {
  await setup(page, { failure: true });
  await page.getByRole('button', { name: '계획서 작성', exact: true }).click();
  await page.getByLabel('공문 입력 방식').selectOption('paste'); await page.getByLabel('공문과 붙임 본문').fill(sourceText);
  await page.getByRole('checkbox', { name: /OpenAI/ }).check(); await page.getByRole('button', { name: '공문 분석', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('시험용 서버 오류');
  await expect(page.getByLabel('공문과 붙임 본문')).toHaveValue(sourceText); await decisions(page);
  await page.reload(); await expect(page.getByLabel('공문과 붙임 본문')).toHaveValue(sourceText);
  await page.getByLabel('공문 입력 방식').selectOption('files');
  await page.getByLabel('공문·붙임 파일').setInputFiles({ name: 'notice.hwp', mimeType: 'application/octet-stream', buffer: Buffer.from('not supported') });
  await page.getByRole('checkbox', { name: /OpenAI/ }).check(); await page.getByRole('button', { name: '공문 분석', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('HWPX');
});

test('모바일·키보드·접근성·200% 화면 밀도를 확인한다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await setup(page); await source(page); await generate(page);
  await page.screenshot({ path: 'test-results/school-plan/review-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const results = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations).toEqual([]);
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.screenshot({ path: 'test-results/school-plan/review-desktop.png', fullPage: true });
  await page.getByRole('button', { name: '일정 수정', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: '일정 수정', exact: true })).toBeFocused(); await decisions(page);
  await page.getByLabel('AI 수정 요청').fill('준비를 일주일 앞당겨 주세요.');
  await page.getByRole('button', { name: 'AI 수정안 보기' }).click();
  await expect(page.getByRole('heading', { name: '수정안 비교', exact: true })).toBeVisible(); await decisions(page);
  await page.getByRole('button', { name: '기존 초안 유지' }).click();
  await expect(page.getByRole('article')).toContainText('10월 마지막 주');
  await page.setViewportSize({ width: 683, height: 450 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/school-plan/review-zoom-equivalent.png', fullPage: true });
});

test('HWPX 원고는 문단 위치와 전체 내용으로 읽고 스캔 PDF를 누락 없이 거부한다', async ({ page }) => {
  await setup(page);
  // Export and re-import an untouched fixture using the actual browser modules.
  await page.evaluate(value => { document.documentElement.dataset.fixtureDraft = JSON.stringify(value); }, draft);
  const actual = await page.evaluate(async () => {
    const { exportPlanHwpx } = await import('/src/features/schoolDocuments/planHwpx.ts');
    const { extractHwpxSource } = await import('/src/features/schoolDocuments/planSourceImport.ts');
    const d = JSON.parse(document.documentElement.dataset.fixtureDraft!);
    const bytes = await exportPlanHwpx(d, { title: d.title, pages: 1 });
    return { source: extractHwpxSource(bytes, '자체 생성.hwpx', 'testSource'), bytes: [...bytes] };
  });
  expect(actual.source.parts.map(p => p.text).join('\n')).toContain('11월 9일까지');
  expect(actual.source.parts.every(p => p.label.includes('문단'))).toBe(true);
  const { writeFile } = await import('node:fs/promises'); await writeFile('test-results/school-plan/browser-1page.hwpx', Buffer.from(actual.bytes));
  await page.getByRole('button', { name: '계획서 작성', exact: true }).click();
  const pdf = new jsPDF();
  await page.getByLabel('공문·붙임 파일').setInputFiles({ name: 'scan.pdf', mimeType: 'application/pdf', buffer: Buffer.from(pdf.output('arraybuffer')) });
  await page.getByRole('checkbox', { name: /OpenAI/ }).check(); await page.getByRole('button', { name: '공문 분석', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('텍스트를 읽지 못했습니다');
});

test('HWP 5.0 공문의 실제 표 본문과 근거 위치를 추출하여 분석에 전달한다', async ({ page }) => {
  await setup(page);
  let imported = false;
  await page.route('**/__test_school_plan', async route => {
    const request = route.request().postDataJSON();
    expect(request.action).toBe('analyze');
    const input = request.sources[0];
    expect(input.name).toBe('school-plan-source.hwp');
    expect(input.parts.map((p: { text: string }) => p.text).join('\n')).toContain('학생별 읽기 기록과 학급 작품 나눔');
    const cell = input.parts.find((p: { text: string }) => p.text.includes('학생별 읽기 기록'));
    expect(cell.label).toMatch(/표1 2행 2열/);
    imported = true;
    await route.fulfill({ json: { analysis: { title: '독서 주간 운영계획', summary: '가상 HWP 공문의 활동을 확인합니다.', questions: [], budgetLimit: null, requirements: [{ id: 'r1', kind: 'required', text: cell.text, quote: cell.text, sourceId: input.id, partId: cell.id }] } } });
  });
  await page.getByRole('button', { name: '계획서 작성', exact: true }).click();
  await page.getByLabel('공문·붙임 파일').setInputFiles('tests/fixtures/school-plan-source.hwp');
  await page.getByRole('checkbox', { name: /OpenAI/ }).check();
  await page.getByRole('button', { name: '공문 분석', exact: true }).click();
  await expect(page.getByRole('heading', { name: '공문 확인', exact: true })).toBeVisible();
  expect(imported).toBe(true);
  await page.getByText(/원문 확인 · school-plan-source.hwp/).click();
  await expect(page.getByRole('blockquote')).toContainText('학생별 읽기 기록과 학급 작품 나눔');
});

test('지면 취소와 제목 변경은 이전 파일 저장을 막고 초안을 유지한다', async ({ page }) => {
  await setup(page); await source(page); await generate(page);
  await page.getByRole('button', { name: '출력 확인' }).click();
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('취소했습니다');
  await expect(page.getByRole('button', { name: 'HWPX 저장', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '지면 다시 만들기' }).click();
  await expect(page.getByRole('button', { name: 'HWPX 저장', exact: true })).toBeEnabled();
  await page.getByLabel('문서 제목', { exact: true }).fill('');
  await expect(page.getByRole('button', { name: 'HWPX 저장', exact: true })).toBeDisabled();
  await expect(page.getByRole('img', { name: /쪽 지면/ })).toHaveCount(0);
  await page.getByLabel('문서 제목', { exact: true }).fill('수정한 제목');
  await expect(page.getByRole('button', { name: 'HWPX 저장', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '초안 검토', exact: true }).click();
  await expect(page.getByRole('article')).toContainText(draft.sections[0].paragraphs[0]);
});

test('익명 계정은 작성 화면에 접근할 수 없다', async ({ page }) => {
  await setup(page, { anonymous: true });
  await expect(page.getByRole('button', { name: 'Google로 로그인', exact: true })).toBeVisible();
  await expect(page.getByLabel('문서 종류')).toHaveCount(0);
});

for (const label of ['일반 교사', '미확인 관리자'] as const) {
  test(`${label}는 직접 주소로도 계획서 화면에 진입할 수 없다`, async ({ page }) => {
    await setup(page, { teacher: label === '일반 교사', unconfirmed: label === '미확인 관리자' });
    await expect(page.getByRole('alert')).toContainText('관리자 계정');
    await expect(page.getByLabel('문서 종류')).toHaveCount(0);
    await expect(page.getByLabel('공문·붙임 파일')).toHaveCount(0);
    await page.getByRole('button', { name: '홈으로 돌아가기' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('button', { name: /^학교 문서 작성 시작하기/ })).toHaveCount(0);
  });
}

test('분석 중 취소해도 입력을 유지하고 늦게 도착한 결과를 반영하지 않는다', async ({ page }) => {
  await setup(page);
  await page.route('**/__test_school_plan', async route => {
    await new Promise(resolve => setTimeout(resolve, 1200));
    await route.fulfill({ json: { analysis } }).catch(() => {});
  });
  await page.getByRole('button', { name: '계획서 작성', exact: true }).click();
  await page.getByLabel('공문 입력 방식').selectOption('paste');
  await page.getByLabel('공문과 붙임 본문').fill(sourceText);
  await page.getByRole('checkbox', { name: /OpenAI/ }).check();
  await page.getByRole('button', { name: '공문 분석', exact: true }).click();
  await page.getByRole('button', { name: '작업 취소' }).click();
  await expect(page.getByLabel('공문과 붙임 본문')).toHaveValue(sourceText);
  await page.reload();
  await expect(page.getByLabel('공문과 붙임 본문')).toHaveValue(sourceText);
  await expect(page.getByRole('heading', { name: '공문 추가', exact: true })).toBeVisible();
});

for (const change of ['학교 조건', '운영계획 유형', '작성 기준 버전']) test(`${change} 변경 시 이전 초안을 보존하면서 저장을 막는다`, async ({ page }) => {
  await setup(page); await source(page); await generate(page);
  await page.evaluate(change => {
    const key = 'schooldoc:school-plan:v1:plan-test-teacher';
    const s = JSON.parse(localStorage.getItem(key)!);
    if (change === '학교 조건') s.conditions.budget = 250000;
    else if (change === '운영계획 유형') s.referenceType = 'contest';
    else { const old = JSON.parse(s.draftContext); old.referenceVersion = 'old'; s.draftContext = JSON.stringify(old); }
    localStorage.setItem(key, JSON.stringify(s));
  }, change);
  await page.reload();
  await expect(page.getByRole('article')).toContainText(draft.title);
  await expect(page.getByRole('alert')).toContainText('입력 조건 또는 작성 기준이 바뀌어');
  await expect(page.getByRole('button', { name: '출력 확인' })).toBeDisabled();
});

test('실제 클라이언트 → 서버 코어 → Responses 요청 → 초안·부분 수정·HWPX 저장', async ({ page }) => {
  await setup(page, { realClient: true });
  const providerCalls: Record<string, unknown>[] = [];
  const handler = createPlanHandler({
    authorize: req => authorizePlanRequest(req, async token => ({ data: { user: token === 'fixture-token' ? { id: 'plan-test-teacher', email: 'panthea0@gmail.com', email_confirmed_at: '2026-10-26T00:00:00Z' } : null }, error: null })),
    consumeQuota: async () => true,
    run: (request, signal) => requestPlanAi(request, 'fixture-key-not-real', 'fixture-model', async (_url, init) => {
      const payload = JSON.parse(String(init?.body)); providerCalls.push(payload);
      expect(payload.store).toBe(false); expect(payload.text.format.strict).toBe(true);
      expect(payload.input[0].content.every((c: { type: string }) => c.type === 'input_text')).toBe(true);
      const result = request.action === 'analyze' ? analysis : request.action === 'draft' ? authoredDraft : { schedule: draft.schedule.map((s, i) => i ? s : { ...s, when: '10월 셋째 주(안)' }) };
      return new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(result) }] }] }));
    }, signal),
  });
  await page.route('**/__test_school_plan', async route => {
    const result = await handler(new Request('https://schooldoc.invalid/school-plan', { method: 'POST', headers: route.request().headers(), body: route.request().postData() }));
    await route.fulfill({ status: result.status, contentType: 'application/json', body: await result.text() });
  });
  await source(page, true); await generate(page); await decisions(page);
  await page.getByRole('button', { name: '본문 수정', exact: true }).click();
  const edited = '학생별 읽기 기록과 학급 작품 나눔을 연결하여 독서 경험을 정리한다.';
  await page.getByLabel('본문 내용', { exact: true }).fill(edited);
  await page.getByRole('button', { name: '본문 반영', exact: true }).click();
  await page.getByRole('button', { name: '일정 수정', exact: true }).click();
  await page.getByLabel('AI 수정 요청', { exact: true }).fill('준비를 앞당겨 주세요.');
  await page.getByRole('button', { name: 'AI 수정안 보기' }).click();
  await page.getByRole('button', { name: '수정안 적용' }).click();
  await expect(page.getByRole('article')).toContainText(edited);
  await expect(page.getByRole('article')).toContainText('10월 셋째 주(안)');
  expect(providerCalls).toHaveLength(3);
  expect(JSON.stringify(providerCalls)).not.toContain('fixture-key-not-real');
  expect(JSON.stringify(providerCalls)).not.toContain('file_data');
  await page.getByRole('button', { name: '출력 확인' }).click();
  const saved = page.waitForEvent('download'); await page.getByRole('button', { name: 'HWPX 저장', exact: true }).click();
  const download = await saved; await download.saveAs('test-results/school-plan/connected-flow.hwpx');
  const files = unzipSync(await readFile('test-results/school-plan/connected-flow.hwpx'));
  expect(strFromU8(files['Contents/section0.xml'])).toContain(edited);
});

test('실제 클라이언트의 서버 한도 오류는 입력을 보존하고 공급자를 호출하지 않는다', async ({ page }) => {
  await setup(page, { realClient: true });
  let modelCalled = false;
  const handler = createPlanHandler({ authorize: async () => 'fixture', consumeQuota: async () => false, run: async () => { modelCalled = true; return { analysis }; } });
  await page.route('**/__test_school_plan', async route => {
    const result = await handler(new Request('https://schooldoc.invalid', { method: 'POST', headers: { 'content-type': 'application/json' }, body: route.request().postData() }));
    await route.fulfill({ status: result.status, contentType: 'application/json', body: await result.text() });
  });
  await page.getByRole('button', { name: '계획서 작성', exact: true }).click();
  await page.getByLabel('공문 입력 방식').selectOption('paste');
  await page.getByLabel('공문과 붙임 본문').fill(sourceText);
  await page.getByRole('checkbox', { name: /OpenAI/ }).check();
  await page.getByRole('button', { name: '공문 분석', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('한도');
  await expect(page.getByLabel('공문과 붙임 본문')).toHaveValue(sourceText);
  expect(modelCalled).toBe(false); await decisions(page);
});
