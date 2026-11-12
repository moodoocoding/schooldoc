import { readFileSync } from 'node:fs';
import { test, expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import initRhwp, { HwpDocument } from '@rhwp/core';
import { jsPDF } from 'jspdf';
import readXlsx from 'read-excel-file/node';
import writeXlsx from 'write-excel-file/node';
import { validateClassOutput } from '../../supabase/functions/_shared/neisClassComments';
import type { ClassCommentInput } from '../../supabase/functions/_shared/neisClassComments';

const plan = {
  year: '2026',
  schoolGrade: '5학년',
  semester: '2학기',
  assessments: [
    {
      id: 'assessment-1',
      subject: '수학',
      standardCode: '[6수04-01]',
      standard: '평균의 의미를 알고 자료의 평균을 구한다.',
      task: '평균 구하기',
      rubrics: {
        high: '평균을 활용하여 다양한 문제를 해결한다.',
        middle: '주어진 자료의 평균을 구한다.',
        low: '간단한 자료의 평균을 구한다.',
      },
      sourcePage: 1,
      warnings: [],
    },
    {
      id: 'assessment-2',
      subject: '수학',
      standardCode: '[6수01-13]',
      standard: '소수의 곱셈 원리를 이해하고 계산한다.',
      task: '소수 곱셈',
      rubrics: {
        high: '소수 곱셈의 계산 과정을 설명한다.',
        middle: '소수의 곱셈을 계산한다.',
        low: '안내된 절차에 따라 소수의 곱셈을 계산한다.',
      },
      sourcePage: 1,
      warnings: [],
    },
  ],
};
const pdf = (lines = [plan.assessments[0].task, plan.assessments[0].standardCode, plan.assessments[0].standard, ...Object.values(plan.assessments[0].rubrics)]) => {
  const doc = new jsPDF();
  doc.addFileToVFS('Nanum.ttf', readFileSync('src/features/officialDocument/assets/fonts/NanumGothic-Regular.ttf').toString('base64'));
  doc.addFont('Nanum.ttf', 'Nanum', 'normal');
  doc.setFont('Nanum');
  doc.text(lines, 20, 25);
  return Buffer.from(doc.output('arraybuffer'));
};
const csv = (count = 3) =>
  Buffer.from(
    `2026학년도 5학년 1반\n번호,이름,평균 구하기,소수 곱셈\n${Array.from({ length: count }, (_, i) => `${i + 1},${i < 2 ? '가상동명' : i === 2 ? '가상아주긴이름학생' : `가상학생${i + 1}`},${i === 1 ? '' : i % 2 ? '△' : '◎'},${i % 2 ? '◌' : '○'}`).join('\n')}`,
    'utf8',
  );

async function setup(
  page: Page,
  options: { failGeneration?: boolean; delayGeneration?: boolean; failPlan?: boolean; duplicateGeneration?: boolean; streamGeneration?: boolean } = {},
) {
  const calls: Record<string, unknown>[] = [];
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ contentType: 'text/css', body: '' }),
  );
  await page.route(
    'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css',
    (route) => route.fulfill({ contentType: 'text/css', body: '' }),
  );
  await page.route(/https:\/\/[^/]+\/(auth|rest|functions|storage)\/v1\//, (route) => route.abort());
  await page.route('**/src/utils/supabaseClient.ts', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `
    export const isSupabaseConfigured = true;
    let user = { id: 'neis-fixture-admin', email: 'panthea0@gmail.com', email_confirmed_at: '2026-11-12', is_anonymous: false, app_metadata:{}, user_metadata:{} };
    let listener;
    window.__neisLogout = () => { user = null; listener?.('SIGNED_OUT', null); };
    export const supabase = { auth: {
      getSession: async () => ({data:{session:user?{user}:null},error:null}),
      onAuthStateChange: fn => {listener=fn;return {data:{subscription:{unsubscribe(){}}}};},
    }, functions: { invoke: async (name, options) => {
      const response = await fetch('/__neis-fixture', {method:'POST',headers:{'Content-Type':'application/json',...options.headers},body:JSON.stringify(options.body),signal:options.signal});
      if (!response.ok) return {data:null,error:{context:response}};
      const payload = await response.json();
      if (${Boolean(options.streamGeneration)} && options.body.action === 'generate-class' && options.headers?.Accept === 'text/event-stream') {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({ start(controller) {
          const send = event => controller.enqueue(encoder.encode('data: ' + JSON.stringify(event) + '\\n\\n'));
          const rows = payload.result.rows.toSorted((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
          send({type:'row',row:rows[0]});
          window.__neisReleaseRows = () => { rows.slice(1).forEach(row => send({type:'row',row})); send({type:'done'}); controller.close(); };
        } });
        return {data:new Response(stream,{headers:{'Content-Type':'text/event-stream'}}),error:null};
      }
      return {data:payload,error:null};
    } } };
  `,
    }),
  );
  let generationCalls = 0;
  await page.route('**/__neis-fixture', async (route) => {
    const body = route.request().postDataJSON();
    calls.push(body);
    if (body.action === 'plan') {
      if (options.failPlan) {
        await route.fulfill({ status: 503, json: { error: '가상 분석 실패. 다시 시도해 주세요.' } });
        return;
      }
      await route.fulfill({ json: { result: plan } });
      return;
    }
    if (body.action === 'generate-class') {
      generationCalls++;
      if (options.delayGeneration) await new Promise((resolve) => setTimeout(resolve, 1200));
      const input = body.input as ClassCommentInput;
      const starts = ['표를', '계산에서는', '주어진', '곱하는', '문제에서', '자리값에', '값의', '두 소수를', '조건대로'];
      const rows = input.groups.flatMap((group) => group.ids.map((id) => ({
        id, sentences: group.grades.map((grade, index) => {
          const offset = Number(id.slice(1)) - 1;
          const repeated = options.duplicateGeneration && generationCalls === 1 && offset <= 1 && index === 0;
          const start = repeated ? '자료를' : starts[(offset * 2 + index + (generationCalls > 1 ? 6 : 0)) % starts.length];
          const criterion = input.evaluations[index].rubrics[grade]!;
          if (offset === 2 && index === 0 && grade === 'high') return { a: 1, t: '문제에서 필요한 평균을 계산해 해결함.' };
          return { a: index + 1, t: `${start} 살펴 ${criterion.replace(/한다\.$/, '함.').replace(/구한다\.$/, '구함.')}` };
        }),
      })));
      await route.fulfill({
        json: { result: validateClassOutput(rows.length ? { rows: options.failGeneration && generationCalls === 1 ? rows.filter((row) => row.id !== 's2') : rows } : { rows: [] }, input) },
      });
      return;
    }
    if (body.action === 'grades') {
      await route.fulfill({
        json: {
          result: {
            context: '가상 PDF 성적표 5학년 1반',
            columns: [{ id: 'column-1', label: '평균 구하기' }],
            students: [{ id: 'student-1', number: '1', name: '가상학생', grades: [''], sourceRow: 1 }],
          },
        },
      });
      return;
    }
    await route.fulfill({ status: 400, json: { error: 'unexpected fixture action' } });
  });
  page.on('dialog', (dialog) => void dialog.accept());
  return { calls, errors };
}
async function uploadPlan(page: Page, info?: TestInfo) {
  await page.goto('/tools/neis-helper/subject');
  await expect(page.getByRole('heading', { name: '평가계획을 올려 주세요' })).toBeVisible();
  const analyze = page.getByRole('button', { name: '평가계획 분석', exact: true });
  await expect(analyze).toBeDisabled();
  if (info) await capture(page, info, 'empty-plan');
  await page.getByLabel('평가계획 파일', { exact: true }).setInputFiles({ name: '가상_평가계획.pdf', mimeType: 'application/pdf', buffer: pdf() });
  await expect(page.getByRole('group', { name: '평가계획 파일 업로드' }).getByRole('status')).toContainText('가상_평가계획.pdf');
  await analyze.click();
  await expect(page.getByRole('heading', { name: '평가 자료를 확인하세요' })).toBeVisible();
  const issues = page.getByRole('list', { name: '대조가 필요한 평가계획 항목' });
  await expect(issues.getByRole('listitem')).toHaveCount(1);
  await expect(issues).toContainText('소수 곱셈');
  await expect(issues).not.toContainText('평균 구하기');
  if (info) await capture(page, info, 'plan-exceptions');
}

async function uploadGrades(page: Page, count = 3) {
  await page.getByRole('button', { name: '확인하고 성적표로' }).click();
  await page.getByLabel('나이스 성적 파일', { exact: true }).setInputFiles({ name: '가상_성적.csv', mimeType: 'text/csv', buffer: csv(count) });
  await page.getByRole('button', { name: '성적표 불러오기' }).click();
  await expect(page.getByRole('heading', { name: '명단과 성적을 확인하세요' })).toBeVisible();
  await expect(page.getByText('평가 연결 · 2개', { exact: true })).toBeVisible();
}

async function finishGrades(page: Page) {
  const next = page.getByRole('button', { name: '명단·성적 확인 완료' });
  await expect(next).toBeDisabled();
  await expect(page.getByRole('rowheader', { name: /1번 가상동명/ })).toBeVisible();
  await expect(page.getByRole('rowheader', { name: /2번 가상동명/ })).toBeVisible();
  await page.getByLabel('2번 가상동명 평균 구하기 성적', { exact: true }).selectOption('low');
  await expect(page.getByLabel('2번 가상동명 소수 곱셈 성적', { exact: true })).toHaveValue('middle');
  await next.click();
}

async function capture(page: Page, info: TestInfo, name: string) {
  const overflow = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth - innerWidth,
    elements: Array.from(document.querySelectorAll('main *')).flatMap((node) => {
      const rect = node.getBoundingClientRect();
      return rect.right > innerWidth + 1
        ? [`${node.tagName} ${node.className} ${Math.round(rect.right)}`] : [];
    }).slice(0, 20),
  }));
  expect(overflow.width, JSON.stringify(overflow.elements)).toBeLessThanOrEqual(1);
  const clipped = await page.locator('main input, main select, main textarea').evaluateAll((elements) => elements.filter((element) => {
    const box = element.getBoundingClientRect();
    return box.width > 0 && (box.left < -1 || box.right > innerWidth + 1);
  }).map((element) => element.getAttribute('aria-label') || element.tagName));
  expect(clipped).toEqual([]);
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
  await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true });
}

async function dragFiles(page: Page, target: Locator, files: { name: string; buffer: Buffer }[]) {
  const transfer = await page.evaluateHandle((entries) => {
    const data = new DataTransfer();
    for (const { name, bytes } of entries) data.items.add(new File([new Uint8Array(bytes)], name));
    return data;
  }, files.map(({ name, buffer }) => ({ name, bytes: [...buffer] })));
  try {
    await target.dispatchEvent('dragover', { dataTransfer: transfer });
    await expect(target.getByText('여기에 놓으세요.', { exact: true })).toBeVisible();
    await target.dispatchEvent('drop', { dataTransfer: transfer });
    await expect(target.getByText('여기에 놓으세요.', { exact: true })).toHaveCount(0);
  } finally { await transfer.dispose(); }
}

async function hangulFile(format: 'hwp' | 'hwpx', title: string, cells: string[] = []) {
  await initRhwp({ module_or_path: readFileSync('node_modules/@rhwp/core/rhwp_bg.wasm') });
  const doc = new HwpDocument(readFileSync('src/features/officialDocument/assets/blank.hwpx'));
  try {
    doc.deleteText(0, 0, 0, doc.getParagraphLength(0, 0));
    doc.insertText(0, 0, 0, title);
    if (cells.length) {
      const table = JSON.parse(doc.createTableEx(JSON.stringify({ sectionIdx: 0, paraIdx: 0, charOffset: doc.getParagraphLength(0, 0), rowCount: 2, colCount: 3, colWidths: [9000, 14000, 19000], treatAsChar: true })));
      cells.forEach((text, index) => doc.insertTextInCell(0, table.paraIdx, table.controlIdx, index, 0, 0, text));
    }
    return Buffer.from(format === 'hwp' ? doc.exportHwp() : doc.exportHwpx());
  } finally { doc.free(); }
}

for (const [label, width] of [['desktop', 1366], ['mobile', 390]] as const) {
  test(`교과 자료 대조·전체 성적·한 번 생성·번호순 Excel ${label}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const evidence = await setup(page);
    await uploadPlan(page, info);
    await uploadGrades(page);
    await capture(page, info, 'grade-table');
    await finishGrades(page);
    await page.getByRole('button', { name: '학급 평어 생성' }).click();
    const verify = page.getByRole('button', { name: '전체 평어 검토 완료' });
    await expect(verify).toBeEnabled();
    const table = page.getByRole('table', { name: '번호순 학급 교과평어' });
    await expect(table.getByRole('rowheader')).toHaveText([/1번 가상동명/, /2번 가상동명/, /3번 가상아주긴이름학생/]);
    await capture(page, info, 'result-table');
    await verify.click();
    await capture(page, info, 'reviewed-table');
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: '검토 완료 평어 Excel 저장' }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toBe('수학_교과평어.xlsx');
    const workbook = await readXlsx((await download.path())!);
    expect(workbook[0].data.slice(1).map((row) => row.slice(0, 2))).toEqual([['1', '가상동명'], ['2', '가상동명'], ['3', '가상아주긴이름학생']]);
    await page.getByRole('button', { name: '1번 가상동명 평어 수정', exact: true }).click();
    await page.getByLabel('1번 가상동명 평어', { exact: true }).fill('교사가 내용을 확인함.');
    await expect(page.getByRole('button', { name: '검토 완료 평어 Excel 저장' })).toHaveCount(0);
    const requests = evidence.calls.filter((call) => call.action === 'generate-class');
    expect(requests).toHaveLength(1);
    expect((requests[0].input as ClassCommentInput).groups.flatMap((group) => group.ids)).toHaveLength(3);
    expect(JSON.stringify(requests)).not.toContain('가상동명');
    expect(evidence.errors).toEqual([]);
  });
}

test('빈 HWPX 평가지는 한 번 읽고 연결한 평가와 다른 학급에도 재사용한다', async ({ page }, info) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  const evidence = await setup(page);
  await uploadPlan(page);
  await page.getByText('수행평가 평가지 양식', { exact: true }).click();
  const picker = page.getByRole('group', { name: '평가지 파일 업로드' });
  await dragFiles(page, picker, [{ name: '가상_평가지.hwpx', buffer: await hangulFile('hwpx', '[6수04-01] 평균 구하기: 표의 자료를 읽고 평균을 구하시오.') }]);
  await expect(picker.getByRole('status')).toContainText('가상_평가지.hwpx');
  expect(evidence.calls.map((call) => call.action)).toEqual(['plan']);
  const selector = page.getByLabel('평가지를 연결할 평가');
  await selector.selectOption('assessment-2');
  await dragFiles(page, picker, [{ name: '다른_평가지.pdf', buffer: pdf(['평균 구하기']) }]);
  await expect(page.getByText('평가지와 선택한 평가의 연결을 확인해 주세요.')).toBeVisible();
  await capture(page, info, 'worksheet-exception');
  await page.getByRole('button', { name: '평가지 제거' }).click();
  await selector.selectOption('assessment-1');
  await expect(picker.getByRole('status')).toContainText('가상_평가지.hwpx');
  await uploadGrades(page);
  await finishGrades(page);
  await page.getByRole('button', { name: '학급 평어 생성' }).click();
  await page.getByRole('button', { name: '전체 평어 검토 완료' }).click();
  const request = evidence.calls.find((call) => call.action === 'generate-class')!.input as ClassCommentInput;
  expect(request.evaluations[0].taskContext).toContain('표의 자료를');
  expect(request.evaluations[1].taskContext).toBeUndefined();
  await page.getByRole('button', { name: '다른 학급 성적표' }).click();
  await page.getByRole('button', { name: '이전', exact: true }).click();
  await page.getByText('수행평가 평가지 양식', { exact: true }).click();
  await expect(picker.getByRole('status')).toContainText('가상_평가지.hwpx');
  expect(evidence.calls.filter((call) => call.action === 'plan')).toHaveLength(1);
});

test('첫 단어가 겹치는 두 학생만 함께 다시 생성하고 다른 행은 유지한다', async ({ page }, info) => {
  const evidence = await setup(page, { duplicateGeneration: true });
  await uploadPlan(page); await uploadGrades(page); await finishGrades(page);
  await page.getByRole('button', { name: '학급 평어 생성' }).click();
  const retry = page.getByRole('button', { name: '겹치는 학생 2명 다시 생성' });
  await expect(retry).toBeVisible();
  await capture(page, info, 'duplicate-rows');
  const unaffected = page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: /3번 가상아주긴이름학생/ }) }).getByText(/문제에서 필요한 평균/);
  const original = await unaffected.innerText();
  await retry.click();
  await expect(page.getByRole('button', { name: '전체 평어 검토 완료' })).toBeEnabled();
  await expect(unaffected).toHaveText(original);
  const requests = evidence.calls.filter((call) => call.action === 'generate-class').map((call) => call.input as ClassCommentInput);
  expect(requests.map((input) => input.groups.flatMap((group) => group.ids).length)).toEqual([3, 2]);
  expect(requests[1].usedStarts).toContain('자료를');
});

test('일부 미생성 행을 다시 시도하고 나머지 평어를 보존한다', async ({ page }) => {
  const evidence = await setup(page, { failGeneration: true });
  await uploadPlan(page); await uploadGrades(page); await finishGrades(page);
  await page.getByRole('button', { name: '학급 평어 생성' }).click();
  const retry = page.getByRole('button', { name: '미생성·실패 1명 다시 시도' });
  await expect(retry).toBeVisible();
  const valid = page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: /1번 가상동명/ }) }).getByText(/표를 살펴/);
  const original = await valid.innerText();
  await retry.click();
  await expect(page.getByRole('button', { name: '전체 평어 검토 완료' })).toBeEnabled();
  await expect(valid).toHaveText(original);
  expect(evidence.calls.filter((call) => call.action === 'generate-class')).toHaveLength(2);
});

test('성적표 첫 행의 위치와 관계없이 1번 학생의 수정 성적을 결과에 반영한다', async ({ page }) => {
  const evidence = await setup(page);
  await uploadPlan(page);
  await page.getByRole('button', { name: '확인하고 성적표로' }).click();
  const buffer = Buffer.from('번호,이름,평균 구하기,소수 곱셈\n2,가상둘,◎,○\n1,가상하나,◎,△', 'utf8');
  await page.getByLabel('나이스 성적 파일', { exact: true }).setInputFiles({ name: '가상_성적.csv', mimeType: 'text/csv', buffer });
  await page.getByRole('button', { name: '성적표 불러오기' }).click();

  const firstGrade = page.getByRole('combobox', { name: '1번 가상하나 평균 구하기 성적' });
  const secondGrade = page.getByRole('combobox', { name: '2번 가상둘 평균 구하기 성적' });
  await expect(firstGrade).toHaveValue('high');
  await firstGrade.selectOption('low');
  await page.getByRole('button', { name: '명단·성적 확인 완료' }).click();
  const progress = page.getByRole('list', { name: '작성 단계' });
  await expect(progress.getByRole('listitem').filter({ hasText: '명단·성적' })).toContainText('완료');

  await page.getByRole('button', { name: '이전', exact: true }).click();
  await expect(firstGrade).toHaveValue('low');
  await expect(secondGrade).toHaveValue('high');
  await page.getByRole('button', { name: '명단·성적 확인 완료' }).click();
  await page.getByRole('button', { name: '학급 평어 생성' }).click();

  const table = page.getByRole('table', { name: '번호순 학급 교과평어' });
  const firstRow = table.getByRole('row').nth(1);
  await expect(firstRow.getByRole('rowheader')).toContainText('1번 가상하나');
  await expect(firstRow.getByRole('rowheader')).toContainText('△ · △');
  await expect(firstRow.getByText(/간단한 자료의 평균을 구함/)).toBeVisible();
  const requests = evidence.calls.filter((call) => call.action === 'generate-class');
  expect(requests).toHaveLength(1);
  expect((requests[0].input as ClassCommentInput).groups).toEqual([
    { ids: ['s1'], grades: ['low', 'low'] },
    { ids: ['s2'], grades: ['high', 'middle'] },
  ]);
});

test('번호순 학급 표의 첫 행이 나머지 스트림보다 먼저 표시되고 근거 패널이 없다', async ({ page }) => {
  const evidence = await setup(page, { streamGeneration: true });
  await uploadPlan(page); await uploadGrades(page); await finishGrades(page);
  await page.getByRole('button', { name: '학급 평어 생성' }).click();
  const table = page.getByRole('table', { name: '번호순 학급 교과평어' });
  await expect(table.getByRole('row')).toHaveCount(4);
  await expect(table.getByText(/표를 살펴/)).toBeVisible();
  await expect(table.getByText('평어를 받는 즉시 표시됩니다.')).toHaveCount(2);
  await expect(page.getByRole('status')).toContainText('학생 3명의 평어를 생성하고 있습니다.');
  await expect(page.getByText(/생성 당시 근거 보기|평어에 사용한 근거|검토할 학생/)).toHaveCount(0);
  await page.evaluate(() => (window as unknown as { __neisReleaseRows: () => void }).__neisReleaseRows());
  await expect(page.getByRole('button', { name: '전체 평어 검토 완료' })).toBeEnabled();
  expect(evidence.calls.filter((call) => call.action === 'generate-class')).toHaveLength(1);
});

test('중단 후 내부 이동은 초안을 보존하고 로그아웃은 늦은 결과를 버린다', async ({ page }) => {
  const evidence = await setup(page, { delayGeneration: true });
  await uploadPlan(page); await uploadGrades(page); await finishGrades(page);
  await page.getByRole('button', { name: '학급 평어 생성' }).click();
  await page.getByRole('button', { name: '중단', exact: true }).click();
  await page.getByRole('button', { name: 'Neis Helper', exact: true }).click();
  await page.getByRole('button', { name: '교과학습발달상황(세특). 평어 작성 시작', exact: true }).click();
  await expect(page.getByRole('heading', { name: '학급 평어를 확인하세요' })).toBeVisible();
  await page.getByRole('button', { name: '미생성·실패 3명 다시 시도' }).click();
  await page.evaluate(() => (window as unknown as { __neisLogout: () => void }).__neisLogout());
  await expect(page.getByRole('heading', { name: '학급 평어를 확인하세요' })).toHaveCount(0);
  await expect(page.getByText('가상동명', { exact: false })).toHaveCount(0);
  expect(evidence.errors).toEqual([]);
});

for (const format of ['hwp', 'hwpx'] as const) {
  test(`${format.toUpperCase()} 성적표를 변환해 원본 대조와 성적 확인을 제공한다`, async ({ page }) => {
    const evidence = await setup(page);
    await uploadPlan(page);
    await page.getByRole('button', { name: '확인하고 성적표로' }).click();
    const picker = page.getByRole('group', { name: '나이스 성적 파일 업로드' });
    const file = `가상 성적표.${format}`;
    await dragFiles(page, picker, [{ name: file, buffer: await hangulFile(format, '5학년 가상 수학 성적표', ['번호', '이름', '평균 구하기', '1', '가상학생', '']) }]);
    await expect(picker.getByRole('status')).toContainText(file);
    expect(evidence.calls.filter((call) => call.action === 'grades')).toHaveLength(0);
    await page.getByRole('button', { name: '성적표 불러오기' }).click();
    await expect(page.getByRole('heading', { name: '명단과 성적을 확인하세요' })).toBeVisible();
    await page.getByText('성적표 원본 보기', { exact: true }).click();
    await expect(page.getByRole('img', { name: `${file} 1쪽 변환 지면` })).toBeVisible();
    await expect(page.getByRole('link', { name: '원본 파일 다운로드' })).toHaveAttribute('download', file);
    const data = evidence.calls.find((call) => call.action === 'grades')!.data;
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const loading = getDocument({ data: Uint8Array.from(Buffer.from(String(data), 'base64')) });
    try {
      const content = await (await (await loading.promise).getPage(1)).getTextContent();
      expect(content.items.map((item) => 'str' in item ? item.str : '').join('').replace(/\s/g, '')).toContain('가상학생');
    } finally { await loading.destroy(); }
    await expect(page.getByText(/성적과 연결되지 않은 평가 1개/)).toBeVisible();
    await expect(page.getByRole('button', { name: '명단·성적 확인 완료' })).toBeDisabled();
    await page.getByLabel('1번 가상학생 평균 구하기 성적').selectOption('middle');
    await expect(page.getByRole('button', { name: '명단·성적 확인 완료' })).toBeEnabled();
  });
}

test('한글 평가계획 드롭과 손상된 파일 교체가 동작한다', async ({ page }) => {
  const evidence = await setup(page);
  await page.goto('/tools/neis-helper/subject');
  const picker = page.getByRole('group', { name: '평가계획 파일 업로드' });
  await dragFiles(page, picker, [{ name: '손상.hwp', buffer: Buffer.from('invalid') }]);
  await page.getByRole('button', { name: '평가계획 분석', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('한글 문서를 읽지 못했습니다.');
  expect(evidence.calls).toHaveLength(0);
  const { task, standardCode, standard, rubrics } = plan.assessments[0];
  const source = await hangulFile('hwp', `${standardCode} ${standard}`, [task, rubrics.high, rubrics.middle, rubrics.low, '', '']);
  await dragFiles(page, picker, [{ name: '가상_한글계획.hwp', buffer: source }]);
  await dragFiles(page, picker, [{ name: '추가1.hwp', buffer: source }, { name: '추가2.hwp', buffer: source }]);
  await expect(page.getByRole('alert')).toContainText('한 번에 파일 한 개');
  await expect(picker.getByRole('status')).toContainText('가상_한글계획.hwp');
  await page.getByRole('button', { name: '평가계획 분석', exact: true }).click();
  await expect(page.getByRole('heading', { name: '평가 자료를 확인하세요' })).toBeVisible();
  await page.getByText('전체 성취기준과 평가 보기', { exact: true }).click();
  await page.getByRole('button', { name: '평균 구하기 상세 보기' }).click();
  await expect(page.getByRole('img', { name: '가상_한글계획.hwp 1쪽 변환 지면' })).toBeVisible();
});

test('키보드 파일 선택과 분석 실패 후 원본 유지', async ({ page }) => {
  const evidence = await setup(page, { failPlan: true });
  await page.goto('/tools/neis-helper/subject');
  const choose = page.getByRole('button', { name: '파일 선택', exact: true });
  await choose.focus();
  const opened = page.waitForEvent('filechooser');
  await page.keyboard.press('Enter');
  await (await opened).setFiles({ name: '가상_평가계획.pdf', mimeType: 'application/pdf', buffer: pdf() });
  await page.getByRole('button', { name: '평가계획 분석', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('가상 분석 실패');
  await expect(page.getByText('가상_평가계획.pdf', { exact: true })).toBeVisible();
  expect(evidence.errors).toEqual([]);
});

test('모호한 XLSX 시트는 선택을 요청하고 같은 제목 행으로 돌아가도 정정을 보존한다', async ({ page }) => {
  await setup(page); await uploadPlan(page);
  await page.getByRole('button', { name: '확인하고 성적표로' }).click();
  const cell = (value: string) => ({ type: String, value });
  const data = [['번호', '이름', '평균 구하기', '소수 곱셈'].map(cell), ['1', '가상학생', '', '△'].map(cell)];
  const buffer = await writeXlsx([{ sheet: '가반', data }, { sheet: '나반', data }]).toBuffer();
  await page.getByLabel('나이스 성적 파일', { exact: true }).setInputFiles({ name: '가상성적.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer });
  await page.getByRole('button', { name: '성적표 불러오기' }).click();
  await page.getByRole('combobox', { name: '시트', exact: true }).selectOption({ label: '나반' });
  await page.getByRole('button', { name: '이 시트 사용' }).click();
  await page.getByRole('button', { name: '이 제목 행 사용' }).click();
  await expect(page.getByText('불러온 값 빈칸')).toBeVisible();
  const grade = page.getByLabel('1번 가상학생 평균 구하기 성적');
  await grade.selectOption('high');
  await page.getByRole('button', { name: '시트·제목 행 다시 선택' }).click();
  await expect(page.getByRole('combobox', { name: '시트', exact: true })).toHaveValue('1');
  await page.getByRole('button', { name: '이 시트 사용' }).click();
  await page.getByRole('button', { name: '이 제목 행 사용' }).click();
  await expect(grade).toHaveValue('high');
});

test('60명 명단과 200% 확대에서 중복 평가 연결·빈 성적을 표시한다', async ({ page }, info) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await setup(page); await uploadPlan(page); await uploadGrades(page, 60);
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(61);
  await page.getByText('평가 연결 · 2개', { exact: true }).click();
  await page.getByRole('combobox', { name: '소수 곱셈', exact: true }).selectOption('assessment-1');
  await expect(page.getByText(/같은 평가에 두 열이 연결되었습니다/)).toBeVisible();
  await page.getByRole('combobox', { name: '소수 곱셈', exact: true }).selectOption('assessment-2');
  await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
  await capture(page, info, 'sixty-students-zoom');
});
