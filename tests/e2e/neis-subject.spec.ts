import { readFileSync } from 'node:fs';
import { test, expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import initRhwp, { HwpDocument } from '@rhwp/core';
import { jsPDF } from 'jspdf';
import readXlsx from 'read-excel-file/node';
import writeXlsx from 'write-excel-file/node';

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
    {
      id: 'assessment-3',
      subject: '국어',
      standardCode: '[6국01-02]',
      standard: '의견을 제시하고 함께 조정하며 토의한다.',
      task: '토론하기',
      rubrics: {
        high: '근거를 들어 의견을 제시하고 조정한다.',
        middle: '자신의 의견을 제시한다.',
        low: '안내에 따라 의견을 말한다.',
      },
      sourcePage: 1,
      warnings: [],
    },
  ],
};
const pdf = () => {
  const doc = new jsPDF();
  doc.text('Fictional assessment plan - Maths - Grade 5', 20, 25);
  doc.text('Assessment 1: Average. Assessment 2: Decimal multiplication.', 20, 40);
  return Buffer.from(doc.output('arraybuffer'));
};
const csv = (count = 3) =>
  Buffer.from(
    `2026학년도 5학년 1반\n번호,이름,평균 구하기,소수 곱셈\n${Array.from({ length: count }, (_, i) => `${i + 1},${i < 2 ? '가상동명' : i === 2 ? '가상아주긴이름학생' : `가상학생${i + 1}`},${i === 1 ? '' : i % 2 ? '△' : '◎'},${i % 2 ? '◌' : '○'}`).join('\n')}`,
    'utf8',
  );

async function setup(
  page: Page,
  options: { failGeneration?: boolean; delayGeneration?: boolean; failPlan?: boolean } = {},
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
      const response = await fetch('/__neis-fixture', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(options.body),signal:options.signal});
      if (!response.ok) return {data:null,error:{context:response}};
      return {data:await response.json(),error:null};
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
    if (body.action === 'generate') {
      generationCalls++;
      if (options.delayGeneration) await new Promise((resolve) => setTimeout(resolve, 1200));
      if (options.failGeneration && generationCalls === 2) {
        await route.fulfill({ status: 422, json: { error: '가상 근거 검증 실패' } });
        return;
      }
      await route.fulfill({
        json: {
          result: {
            sentences: body.input.evidence.map((e: { assessmentId: string; criterion: string }) => ({
              assessmentId: e.assessmentId,
              evidenceQuote: e.criterion,
              text: e.criterion.replace(/한다\.$/, '함.').replace(/구한다\.$/, '구함.'),
            })),
          },
        },
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
async function uploadPlan(
  page: Page,
  options: { info?: TestInfo; mode?: 'subject' | 'whole'; subject?: string } = {},
) {
  const { info, mode = 'subject', subject = '수학' } = options;
  await page.goto('/tools/neis-helper/subject');
  await expect(page.getByRole('heading', { name: '평가계획을 넣어 주세요' })).toBeVisible();
  await expect(page.getByRole('button', { name: '평가계획 분석', exact: true })).toBeDisabled();
  if (mode === 'whole') await page.getByRole('radio', { name: /^전체 평가계획/ }).check();
  else await page.getByLabel('교과', { exact: true }).selectOption(subject);
  if (info) await capture(page, info, `empty-upload-${mode}`);
  await page
    .getByLabel('평가계획 파일', { exact: true })
    .setInputFiles({ name: '가상_평가계획.pdf', mimeType: 'application/pdf', buffer: pdf() });
  const picker = page.getByRole('group', { name: '평가계획 파일 업로드' });
  await expect(picker.getByRole('status')).toContainText('가상_평가계획.pdf');
  await page.getByRole('button', { name: '평가계획 분석', exact: true }).click();
  if (mode === 'whole') {
    await expect(page.getByRole('heading', { name: '교과를 확인하고 성적을 넣어 주세요' })).toBeVisible();
    await expect(page.getByRole('radio', { name: /^수학/ })).toBeVisible();
    await expect(page.getByRole('radio', { name: /^국어/ })).toBeVisible();
    if (info) await capture(page, info, 'whole-subjects');
    await pickSubject(page, '수학');
  }
}
async function uploadGrades(page: Page, count = 3) {
  await expect(page.getByRole('heading', { name: '수학 평가 2개' })).toBeVisible();
  await page
    .getByLabel('나이스 성적 파일', { exact: true })
    .setInputFiles({ name: '가상_성적.csv', mimeType: 'text/csv', buffer: csv(count) });
  await page.getByRole('button', { name: '평어 만들기', exact: true }).click();
  await expect(page.getByRole('heading', { name: '수학 평어 결과' })).toBeVisible();
  await expect(page.getByRole('button', { name: '중단', exact: true })).toHaveCount(0);
}
const studentList = (page: Page) => page.getByRole('list', { name: '학생별 평어 목록' }).locator(':scope > li');
async function capture(page: Page, info: TestInfo, name: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  const clippedControls = await page
    .locator('main input, main select, main textarea')
    .evaluateAll((elements) =>
      elements
        .filter((el) => {
          const box = el.getBoundingClientRect();
          return box.width > 0 && (box.left < -1 || box.right > innerWidth + 1);
        })
        .map((el) => el.getAttribute('aria-label') || el.tagName),
    );
  expect(clippedControls).toEqual([]);
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
  await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true });
}


for (const [label, width] of [
  ['desktop', 1366],
  ['mobile', 390],
] as const) {
  test(`교과별 계획 → 성적 한 번에 평어·빈 성적 학생 제외·동명이인·Excel ${label}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const evidence = await setup(page);
    await uploadPlan(page, { info });
    // 교과별 방식은 고른 교과의 평가만 정리해 보여 준다.
    await expect(page.getByRole('heading', { name: '수학 평가 2개' })).toBeVisible();
    await expect(page.getByText('토론하기')).toHaveCount(0);
    await capture(page, info, 'plan-summary');
    await uploadGrades(page);
    // 확인 버튼 없이 바로 결과가 나오고, 빈 성적 학생만 생성하지 않는다.
    expect(evidence.calls.filter((c) => c.action === 'generate')).toHaveLength(2);
    await expect(page.getByRole('group', { name: '평어 현황' })).toContainText('완성2명');
    await expect(page.getByRole('group', { name: '평어 현황' })).toContainText('확인 필요1명');
    await expect(page.getByLabel('1번 가상동명 평어', { exact: true })).toHaveValue(/평균을 활용하여/);
    await expect(page.getByLabel('2번 가상동명 평어', { exact: true })).toHaveCount(0);
    await expect(studentList(page).nth(1)).toContainText('성적 확인 필요');
    await expect(studentList(page).nth(1)).toContainText('평균 구하기 빈칸');
    // 확인할 것이 없으면 자동 정리 내용은 접혀 있다. 열어서 연결 방식을 확인한다.
    await page.getByText('자동으로 정리한 내용').click();
    await expect(page.getByText('제목 일치').first()).toBeVisible();
    await capture(page, info, 'results-attention');

    await page.getByRole('radio', { name: '확인 필요 1' }).click();
    await expect(studentList(page)).toHaveCount(1);
    await page.getByLabel('2번 가상동명 평균 구하기 성적').selectOption('low');
    await expect(page.getByLabel('2번 가상동명 평어', { exact: true })).toHaveValue(/간단한 자료/);
    await expect(page.getByText('확인이 필요한 학생이 없습니다.')).toBeVisible();
    await page.getByRole('radio', { name: '전체 3' }).click();
    await capture(page, info, 'results-complete');
    expect(evidence.calls.filter((c) => c.action === 'generate')).toHaveLength(3);
    expect(JSON.stringify(evidence.calls.filter((c) => c.action === 'generate'))).not.toContain('가상동명');

    const downloadEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Excel 저장', exact: true }).click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toBe('수학_교과평어.xlsx');
    const workbook = await readXlsx((await download.path())!);
    expect(workbook[0].data).toHaveLength(4);
    expect(workbook[0].data[1][1]).toBe('가상동명');
    expect(workbook[0].data[2][1]).toBe('가상동명');
    expect(String(workbook[0].data[2][3])).toContain('간단한 자료');
    await page.getByLabel('1번 가상동명 평어', { exact: true }).fill('교사가 수정한 평어임.');
    await expect(page.getByLabel('1번 가상동명 평어', { exact: true })).toHaveValue('교사가 수정한 평어임.');
    expect(evidence.errors).toEqual([]);
  });
}

test('전체 계획은 교과별로 나누고 다른 교과로 바꿔도 다시 분석하지 않는다', async ({ page }, info) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  const evidence = await setup(page);
  await uploadPlan(page, { info, mode: 'whole' });
  await uploadGrades(page);
  await page.getByRole('button', { name: '다른 교과 작성', exact: true }).click();
  await expect(page.getByRole('heading', { name: '교과를 확인하고 성적을 넣어 주세요' })).toBeVisible();
  await pickSubject(page, '국어');
  await expect(page.getByRole('heading', { name: '국어 평가 1개' })).toBeVisible();
  expect(evidence.calls.filter((c) => c.action === 'plan')).toHaveLength(1);
  expect(evidence.errors).toEqual([]);
});

test('교과별 방식에 다른 교과만 있는 전체 계획을 넣으면 전체 방식으로 이어 간다', async ({ page }) => {
  const evidence = await setup(page);
  await page.goto('/tools/neis-helper/subject');
  await page.getByLabel('교과', { exact: true }).selectOption('과학');
  await page
    .getByLabel('평가계획 파일', { exact: true })
    .setInputFiles({ name: '가상_평가계획.pdf', mimeType: 'application/pdf', buffer: pdf() });
  await page.getByRole('button', { name: '평가계획 분석', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('과학 평가를 찾지 못했습니다');
  await page.getByRole('button', { name: '전체 평가계획으로 보고 교과 고르기' }).click();
  await pickSubject(page, '수학');
  await expect(page.getByRole('heading', { name: '수학 평가 2개' })).toBeVisible();
  expect(evidence.calls).toHaveLength(1);
});

test('30명·긴 이름·200% 확대에서도 결과 목록을 한 화면 흐름으로 본다', async ({ page }, info) => {
  await page.setViewportSize({ width: 683, height: 900 });
  await setup(page);
  await uploadPlan(page);
  await uploadGrades(page, 30);
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });
  await expect(studentList(page)).toHaveCount(30);
  await capture(page, info, 'classroom-30-zoom');
});

test('생성 실패만 다시 시도하고 연결을 바꾸면 다시 생성을 안내한다', async ({ page }) => {
  const evidence = await setup(page, { failGeneration: true });
  await uploadPlan(page);
  await uploadGrades(page);
  await expect(page.getByText('생성 실패', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '미생성·실패 1명 다시 시도' }).click();
  await expect(page.getByText('생성 실패', { exact: true })).toHaveCount(0);
  expect(evidence.calls.filter((c) => c.action === 'generate')).toHaveLength(3);
  await page.getByText('자동으로 정리한 내용').click();
  await page.getByLabel('소수 곱셈 열에 연결할 평가').selectOption('');
  await expect(page.getByText('연결 못 함 · 평어에서 제외')).toBeVisible();
  await page.getByRole('button', { name: '바뀐 내용으로 다시 생성' }).click();
  await expect(page.getByRole('button', { name: '바뀐 내용으로 다시 생성' })).toHaveCount(0);
  const last = evidence.calls.filter((c) => c.action === 'generate').at(-1) as {
    input: { evidence: unknown[] };
  };
  expect(last.input.evidence).toHaveLength(1);
  expect(evidence.errors).toEqual([]);
});

test('중단 후 내부 이동은 결과를 보존하고 로그아웃은 늦은 응답을 버린다', async ({ page }) => {
  const evidence = await setup(page, { delayGeneration: true });
  await uploadPlan(page);
  await page
    .getByLabel('나이스 성적 파일', { exact: true })
    .setInputFiles({ name: '가상_성적.csv', mimeType: 'text/csv', buffer: csv() });
  await page.getByRole('button', { name: '평어 만들기', exact: true }).click();
  await page.getByRole('button', { name: '중단', exact: true }).click();
  await page.getByRole('button', { name: 'Neis Helper', exact: true }).click();
  await page.getByRole('button', { name: '교과학습발달상황(세특). 평어 작성 시작', exact: true }).click();
  await expect(page.getByRole('heading', { name: '수학 평어 결과' })).toBeVisible();
  await page.getByRole('button', { name: /미생성·실패 \d명 다시 시도/ }).click();
  await page.evaluate(() => (window as unknown as { __neisLogout: () => void }).__neisLogout());
  await expect(page.getByRole('heading', { name: '수학 평어 결과' })).toHaveCount(0);
  await expect(page.getByText('가상동명', { exact: false })).toHaveCount(0);
  expect(evidence.errors).toEqual([]);
});

test('계획 분석 실패는 파일을 유지하며 재시도를 제공한다', async ({ page }) => {
  const evidence = await setup(page, { failPlan: true });
  await page.goto('/tools/neis-helper/subject');
  await page.getByLabel('교과', { exact: true }).selectOption('수학');
  const choose = page.getByRole('button', { name: '파일 선택', exact: true });
  await choose.focus();
  const opened = page.waitForEvent('filechooser');
  await page.keyboard.press('Enter');
  await (await opened).setFiles({ name: '가상_평가계획.pdf', mimeType: 'application/pdf', buffer: pdf() });
  await page.getByRole('button', { name: '평가계획 분석', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('가상 분석 실패');
  await expect(page.getByText('가상_평가계획.pdf', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '평가계획 분석', exact: true })).toBeEnabled();
  expect(evidence.errors).toEqual([]);
});

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
  } finally {
    await transfer.dispose();
  }
}

async function hangulPlan(format: 'hwp' | 'hwpx') {
  await initRhwp({ module_or_path: readFileSync('node_modules/@rhwp/core/rhwp_bg.wasm') });
  const doc = new HwpDocument(readFileSync('src/features/officialDocument/assets/blank.hwpx'));
  try {
    doc.deleteText(0, 0, 0, doc.getParagraphLength(0, 0));
    doc.insertText(0, 0, 0, '가상 평가계획 표지');
    doc.insertParagraph(0, 1);
    doc.insertText(0, 1, 0, '가상 수학 평가 기준');
    doc.applyParaFormat(0, 1, JSON.stringify({ pageBreakBefore: true }));
    const table = JSON.parse(doc.createTableEx(JSON.stringify({
      sectionIdx: 0, paraIdx: 1, charOffset: doc.getParagraphLength(0, 1),
      rowCount: 3, colCount: 2, colWidths: [18000, 25000], treatAsChar: true,
    })));
    const { task, standardCode, rubrics } = plan.assessments[0];
    const cells = [task, standardCode, `◎ ${rubrics.high}`, `○ ${rubrics.middle}`, `△ ${rubrics.low}`, '평가기준'];
    cells.forEach((text, i) => doc.insertTextInCell(0, table.paraIdx, table.controlIdx, i, 0, 0, text));
    return Buffer.from(format === 'hwp' ? doc.exportHwp() : doc.exportHwpx());
  } finally {
    doc.free();
  }
}


for (const format of ['hwp', 'hwpx'] as const) {
  test(`${format.toUpperCase()} 평가계획을 변환하고 표의 쪽과 원본 파일을 확인한다`, async ({ page }, info) => {
    await page.setViewportSize({ width: format === 'hwp' ? 390 : 1366, height: 900 });
    const evidence = await setup(page);
    await page.goto('/tools/neis-helper/subject');
    await page.getByLabel('교과', { exact: true }).selectOption('수학');
    const picker = page.getByRole('group', { name: '평가계획 파일 업로드' });
    const name = `${'가상평가계획_'.repeat(8)}.${format}`;
    const buffer = await hangulPlan(format);
    if (format === 'hwp') {
      await picker.getByLabel('평가계획 파일', { exact: true }).setInputFiles({ name, mimeType: 'application/x-hwp', buffer });
    } else {
      await dragFiles(page, picker, [{ name, buffer }]);
      await dragFiles(page, picker, [{ name, buffer }, { name: '추가.hwpx', buffer }]);
      await expect(page.getByRole('alert')).toContainText('한 번에 파일 한 개');
    }
    await expect(picker.getByRole('status')).toContainText(name);
    await capture(page, info, 'hangul-selected');
    expect(evidence.calls).toHaveLength(0);
    await page.getByRole('button', { name: '평가계획 분석', exact: true }).click();
    await expect(page.getByRole('heading', { name: '수학 평가 2개' })).toBeVisible();
    await page.locator('summary', { hasText: '평균 구하기' }).first().click();
    await page.getByText('원본과 대조하거나 수정', { exact: true }).first().click();
    await expect(page.getByRole('img', { name: `${name} 2쪽 변환 지면` })).toBeVisible();
    const convertedLink = page.getByRole('link', { name: '변환 PDF 열기' });
    const originalLink = page.getByRole('link', { name: '원본 파일 다운로드' });
    await expect(convertedLink).toHaveAttribute('href', /^blob:/);
    await expect(originalLink).toHaveAttribute('download', name);
    const downloaded = page.waitForEvent('download');
    await originalLink.click();
    expect(readFileSync((await (await downloaded).path())!)).toEqual(buffer);
    await capture(page, info, 'hangul-review');
    await page.getByLabel('변환 지면 쪽', { exact: true }).selectOption('1');
    await expect(page.getByRole('img', { name: `${name} 1쪽 변환 지면` })).toBeVisible();

    const [{ data }] = evidence.calls;
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const loading = getDocument({ data: Uint8Array.from(Buffer.from(String(data), 'base64')) });
    try {
      const converted = await loading.promise;
      expect(converted.numPages).toBe(2);
      const content = await (await converted.getPage(2)).getTextContent();
      const text = content.items.map((item) => 'str' in item ? item.str : '').join('').replace(/\s/g, '');
      for (const cell of [plan.assessments[0].task, plan.assessments[0].standardCode, ...Object.values(plan.assessments[0].rubrics)]) {
        expect(text).toContain(cell.replace(/\s/g, ''));
      }
    } finally {
      await loading.destroy();
    }
    if (format === 'hwpx') {
      const grades = page.getByRole('group', { name: '나이스 성적 파일 업로드' });
      await dragFiles(page, grades, [{ name: '가상성적.csv', buffer: csv() }]);
      await expect(grades.getByRole('status')).toContainText('가상성적.csv');
      await page.getByRole('button', { name: '평어 만들기', exact: true }).click();
      await expect(page.getByRole('heading', { name: '수학 평어 결과' })).toBeVisible();
    }
    expect(evidence.errors).toEqual([]);
  });
}

test('손상된 한글 파일은 분석 요청을 보내지 않고 교체할 수 있다', async ({ page }) => {
  const evidence = await setup(page);
  await page.goto('/tools/neis-helper/subject');
  await page.getByLabel('교과', { exact: true }).selectOption('수학');
  const picker = page.getByRole('group', { name: '평가계획 파일 업로드' });
  await dragFiles(page, picker, [{ name: '가상_손상.hwp', buffer: Buffer.from('invalid') }]);
  await page.getByRole('button', { name: '평가계획 분석', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('한글 문서를 읽지 못했습니다.');
  await expect(picker.getByRole('status')).toContainText('가상_손상.hwp');
  await dragFiles(page, picker, [{ name: '지원하지않는형식.txt', buffer: Buffer.from('invalid') }]);
  await expect(page.getByRole('alert')).toContainText('PDF·HWP·HWPX');
  await expect(picker.getByRole('status')).toContainText('가상_손상.hwp');
  expect(evidence.calls).toHaveLength(0);
  await dragFiles(page, picker, [{ name: '가상_평가계획.pdf', buffer: pdf() }]);
  await expect(picker.getByRole('status')).toContainText('가상_평가계획.pdf');
  await page.getByRole('button', { name: '평가계획 분석', exact: true }).click();
  await expect(page.getByRole('heading', { name: '수학 평가 2개' })).toBeVisible();
  expect(evidence.calls).toHaveLength(1);
});

test('PDF 성적은 원본을 보며 빈칸만 입력하고 빠진 평가를 알린다', async ({ page }, info) => {
  await setup(page);
  await uploadPlan(page);
  await page
    .getByLabel('나이스 성적 파일', { exact: true })
    .setInputFiles({ name: '가상_PDF_성적.pdf', mimeType: 'application/pdf', buffer: pdf() });
  await page.getByRole('button', { name: '평어 만들기', exact: true }).click();
  await expect(page.getByRole('heading', { name: '수학 평어 결과' })).toBeVisible();
  await page.getByText('자동으로 정리한 내용').click();
  await expect(page.getByText('성적 열이 없어 평어에서 빠진 평가: 소수 곱셈')).toBeVisible();
  await page.getByText('성적표 원본 보기', { exact: true }).click();
  await expect(page.getByRole('img', { name: /가상_PDF_성적.pdf 1쪽 원본/ })).toBeVisible();
  await capture(page, info, 'pdf-grade-source');
  await page.getByLabel('1번 가상학생 평균 구하기 성적').selectOption('middle');
  await expect(page.getByLabel('1번 가상학생 평어', { exact: true })).toHaveValue(/주어진 자료의 평균/);
});

test('XLSX 실제 worker에서 성적표 시트를 찾아 빈 평가 셀을 보존한다', async ({ page }) => {
  await setup(page);
  await uploadPlan(page);
  const cell = (value: string) => ({ type: String, value });
  const buffer = await writeXlsx([
    { sheet: '안내', data: [['안내만 있는 시트'].map(cell)] },
    {
      sheet: '수학 성적',
      data: [['번호', '이름', '평균 구하기', '소수 곱셈'].map(cell), ['1', '가상학생', '', '△'].map(cell)],
    },
  ]).toBuffer();
  await page.getByLabel('나이스 성적 파일', { exact: true }).setInputFiles({
    name: '가상성적.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer,
  });
  await page.getByRole('button', { name: '평어 만들기', exact: true }).click();
  await expect(page.getByText(/수학 성적 시트 · 1명/)).toBeVisible();
  await expect(studentList(page).first()).toContainText('평균 구하기 빈칸');
});

test('최대 60명 결과도 모두 표시하며 확인 필요를 가리지 않는다', async ({ page }, info) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await setup(page);
  await uploadPlan(page);
  await uploadGrades(page, 60);
  await expect(studentList(page)).toHaveCount(60);
  await expect(page.getByRole('radio', { name: '확인 필요 1' })).toBeVisible();
  await capture(page, info, 'classroom-60');
});

test('수정한 평어는 다른 화면에 다녀와도 유지된다', async ({ page }) => {
  await setup(page);
  await uploadPlan(page);
  await uploadGrades(page);
  await page.getByLabel('3번 가상아주긴이름학생 평어', { exact: true }).fill('교사가 고친 평어임.');
  await page.getByRole('button', { name: 'Neis Helper', exact: true }).click();
  await page.getByRole('button', { name: '교과학습발달상황(세특). 평어 작성 시작', exact: true }).click();
  await expect(page.getByLabel('3번 가상아주긴이름학생 평어', { exact: true })).toHaveValue('교사가 고친 평어임.');
});

// 교과 선택지는 라벨 전체가 누르는 영역이다. 숨긴 라디오 대신 사용자가 누르는 라벨을 누른다.
async function pickSubject(page: Page, subject: string) {
  const radio = page.getByRole('radio', { name: new RegExp(`^${subject}`) });
  await radio.locator('xpath=..').click();
  await expect(radio).toBeChecked();
}
