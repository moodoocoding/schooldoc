import { test, expect, type Page, type TestInfo } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
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
async function uploadPlan(page: Page, info?: TestInfo) {
  await page.goto('/tools/neis-helper/subject');
  await expect(page.getByRole('heading', { name: '평가계획을 올려 주세요' })).toBeVisible();
  await expect(page.getByRole('button', { name: '평가계획 분석', exact: true })).toBeDisabled();
  if (info) await capture(page, info, 'empty-upload');
  await page
    .getByLabel('평가계획 PDF', { exact: true })
    .setInputFiles({ name: '가상_평가계획.pdf', mimeType: 'application/pdf', buffer: pdf() });
  await page.getByRole('button', { name: '평가계획 분석', exact: true }).click();
  await page.getByRole('button', { name: '이 교과로 계속' }).click();
  await expect(page.getByLabel('◎ 평가기준')).toHaveValue(plan.assessments[0].rubrics.high);
  if (info) {
    await expect(page.getByRole('img', { name: /가상_평가계획.pdf 1쪽 원본/ })).toBeVisible();
    await capture(page, info, 'plan-review');
  }
  await page.getByRole('button', { name: '이 평가 확인', exact: true }).click();
  await expect(page.getByLabel('평가 내용', { exact: true })).toHaveValue('소수 곱셈');
  await page.getByRole('button', { name: '이 평가 확인', exact: true }).click();
}
async function uploadGrades(page: Page, count = 3) {
  await page
    .getByLabel('나이스 성적 파일', { exact: true })
    .setInputFiles({ name: '가상_성적.csv', mimeType: 'text/csv', buffer: csv(count) });
  await page.getByRole('button', { name: '성적표 불러오기' }).click();
  await page.getByRole('button', { name: '이 시트 사용' }).click();
  await expect(page.getByLabel('제목 행')).toHaveValue('1');
  await page.getByRole('button', { name: '이 제목 행 사용' }).click();
  await page.getByLabel('평가계획의 같은 평가').selectOption('assessment-1');
  await page.getByRole('button', { name: '이 연결 확인' }).click();
  await page.getByLabel('평가계획의 같은 평가').selectOption('assessment-1');
  await expect(page.getByRole('button', { name: '이 연결 확인' })).toBeDisabled();
  await expect(
    page.getByText('이 평가에는 이미 다른 열이 연결되었습니다. 다시 선택해 주세요.'),
  ).toBeVisible();
  await page.getByLabel('평가계획의 같은 평가').selectOption('assessment-2');
  await page.getByRole('button', { name: '이 연결 확인' }).click();
  await page.getByRole('button', { name: '연결된 평가로 진행' }).click();
  await expect(page.getByLabel('3행 이름', { exact: true })).toHaveValue('가상동명');
  await expect(page.getByLabel('4행 이름', { exact: true })).toHaveValue('가상동명');
  await page.getByRole('button', { name: '명단 확인 완료' }).click();
}
async function finishGrades(page: Page) {
  await expect(page.getByRole('button', { name: '이 평가의 성적 확인 완료' })).toBeDisabled();
  await page.getByLabel('2번 가상동명 성적').selectOption('low');
  await page.getByRole('button', { name: '이 평가의 성적 확인 완료' }).click();
  await expect(page.getByLabel('2번 가상동명 성적')).toHaveValue('middle');
  await page.getByRole('button', { name: '이 평가의 성적 확인 완료' }).click();
}
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
  test(`교과 평어 전체 흐름·중복 연결 차단·빈 성적·동명이인·Excel ${label}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const evidence = await setup(page);
    await uploadPlan(page, info);
    await uploadGrades(page);
    await capture(page, info, 'missing-grade');
    await finishGrades(page);
    await page.getByRole('button', { name: '평어 생성', exact: true }).click();
    await expect(page.getByRole('button', { name: '검토 완료하고 다음 학생' })).toBeEnabled();
    await capture(page, info, 'review-result');
    await page.getByRole('button', { name: '검토 완료하고 다음 학생' }).click();
    await expect(page.getByLabel('평어', { exact: true })).toHaveValue(/간단한 자료/);
    await expect(page.getByRole('heading', { name: '근거와 평어를 함께 검토하세요' })).toBeInViewport();
    await expect(page.getByRole('heading', { name: '근거와 평어를 함께 검토하세요' })).toBeFocused();
    await capture(page, info, 'partly-reviewed');
    await page.getByRole('button', { name: '검토 완료하고 다음 학생' }).click();
    await page.getByRole('button', { name: '이 학생 검토 완료' }).click();
    await expect(page.getByRole('button', { name: '검토 완료 평어 Excel 저장' })).toBeEnabled();
    await capture(page, info, 'all-reviewed');
    const downloadEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: '검토 완료 평어 Excel 저장' }).click();
    const download = await downloadEvent;
    const path = await download.path();
    expect(download.suggestedFilename()).toBe('수학_교과평어.xlsx');
    const workbook = await readXlsx(path!);
    expect(workbook[0].data).toHaveLength(4);
    expect(workbook[0].data[1][1]).toBe('가상동명');
    expect(workbook[0].data[2][1]).toBe('가상동명');
    expect(String(workbook[0].data[2][3])).toContain('간단한 자료');
    await page.getByLabel('평어', { exact: true }).fill('교사가 수정한 평어임.');
    await expect(page.getByRole('button', { name: '검토 완료 평어 Excel 저장' })).toHaveCount(0);
    expect(evidence.calls.filter((c) => c.action === 'generate')).toHaveLength(3);
    expect(JSON.stringify(evidence.calls.filter((c) => c.action === 'generate'))).not.toContain('가상동명');
    expect(evidence.errors).toEqual([]);
  });
}

test('30명 명단·긴 이름·200% 확대에서 한 평가만 확인한다', async ({ page }, info) => {
  await page.setViewportSize({ width: 683, height: 900 });
  await setup(page);
  await uploadPlan(page);
  await uploadGrades(page, 30);
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });
  await expect(
    page.getByRole('list', { name: '평균 구하기 학생별 성적 확인' }).getByRole('listitem'),
  ).toHaveCount(30);
  await capture(page, info, 'classroom-30-zoom');
});

test('생성 실패 항목만 재시도하고 이전 단계 성적 변경은 결과를 무효화한다', async ({ page }) => {
  const evidence = await setup(page, { failGeneration: true });
  await uploadPlan(page);
  await uploadGrades(page);
  await finishGrades(page);
  await page.getByRole('button', { name: '평어 생성', exact: true }).click();
  await expect(page.getByRole('button', { name: '미생성·실패 항목 다시 시도' })).toBeEnabled();
  await page.getByRole('button', { name: '미생성·실패 항목 다시 시도' }).click();
  await expect(page.getByRole('button', { name: '검토 완료하고 다음 학생' })).toBeEnabled();
  expect(evidence.calls.filter((c) => c.action === 'generate')).toHaveLength(4);
  await page.getByRole('button', { name: '이전', exact: true }).click();
  await page.getByRole('button', { name: '이전', exact: true }).click();
  await page.getByLabel('1번 가상동명 성적').selectOption('low');
  await page.getByRole('button', { name: '이 평가의 성적 확인 완료' }).click();
  await expect(page.getByRole('button', { name: '평어 생성', exact: true })).toBeEnabled();
  expect(evidence.errors).toEqual([]);
});

test('중단 후 내부 이동은 초안을 보존하고 로그아웃은 늦은 응답을 버린다', async ({ page }) => {
  const evidence = await setup(page, { delayGeneration: true });
  await uploadPlan(page);
  await uploadGrades(page);
  await finishGrades(page);
  await page.getByRole('button', { name: '평어 생성', exact: true }).click();
  await page.getByRole('button', { name: '중단', exact: true }).click();
  await page.getByRole('button', { name: 'Neis Helper', exact: true }).click();
  await page.getByRole('button', { name: '교과학습발달상황(세특). 평어 작성 시작', exact: true }).click();
  await expect(page.getByRole('heading', { name: '근거와 평어를 함께 검토하세요' })).toBeVisible();
  await page.getByRole('button', { name: '미생성·실패 항목 다시 시도' }).click();
  await page.evaluate(() => (window as unknown as { __neisLogout: () => void }).__neisLogout());
  await expect(page.getByRole('heading', { name: '근거와 평어를 함께 검토하세요' })).toHaveCount(0);
  await expect(page.getByText('가상동명', { exact: false })).toHaveCount(0);
  expect(evidence.errors).toEqual([]);
});

test('계획 분석 실패는 파일을 유지하며 재시도를 제공한다', async ({ page }) => {
  const evidence = await setup(page, { failPlan: true });
  await page.goto('/tools/neis-helper/subject');
  await page
    .getByLabel('평가계획 PDF', { exact: true })
    .setInputFiles({ name: '가상_평가계획.pdf', mimeType: 'application/pdf', buffer: pdf() });
  await page.getByRole('button', { name: '평가계획 분석', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('가상 분석 실패');
  await expect(page.getByText('가상_평가계획.pdf', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '평가계획 분석', exact: true })).toBeEnabled();
  expect(evidence.errors).toEqual([]);
});

test('PDF 성적은 원본을 보며 빈칸을 수정하고 제외되는 평가를 알린다', async ({ page }, info) => {
  await setup(page);
  await uploadPlan(page);
  await page
    .getByLabel('나이스 성적 파일', { exact: true })
    .setInputFiles({ name: '가상_PDF_성적.pdf', mimeType: 'application/pdf', buffer: pdf() });
  await page.getByRole('button', { name: '성적표 불러오기' }).click();
  await page.getByLabel('평가계획의 같은 평가').selectOption('assessment-1');
  await page.getByRole('button', { name: '이 연결 확인' }).click();
  await expect(page.getByText('성적과 연결되지 않아 제외되는 평가 1개')).toBeVisible();
  await page.getByRole('button', { name: '연결된 평가로 진행' }).click();
  await page.getByText('성적표 원본 보기', { exact: true }).click();
  await expect(page.getByRole('img', { name: /가상_PDF_성적.pdf 1쪽 원본/ })).toBeVisible();
  await capture(page, info, 'pdf-roster-source');
  await page.getByRole('button', { name: '명단 확인 완료' }).click();
  await expect(page.getByRole('button', { name: '이 평가의 성적 확인 완료' })).toBeDisabled();
  await page.getByLabel('1번 가상학생 성적').selectOption('middle');
  await page.getByRole('button', { name: '이 평가의 성적 확인 완료' }).click();
  await expect(page.getByRole('heading', { name: '평어 분량을 선택하세요' })).toBeVisible();
});

test('XLSX 실제 worker가 시트와 빈 평가 셀을 보존한다', async ({ page }) => {
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
  await page
    .getByLabel('나이스 성적 파일', { exact: true })
    .setInputFiles({
      name: '가상성적.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer,
    });
  await page.getByRole('button', { name: '성적표 불러오기' }).click();
  await page.getByRole('combobox', { name: '시트', exact: true }).selectOption({ label: '수학 성적' });
  await page.getByRole('button', { name: '이 시트 사용' }).click();
  await page.getByRole('button', { name: '이 제목 행 사용' }).click();
  await expect(page.getByText('원본 예: 1번 빈칸')).toBeVisible();
  await page.getByLabel('평가계획의 같은 평가').selectOption('assessment-1');
  await page.getByRole('button', { name: '이 연결 확인' }).click();
  await expect(page.getByText('원본 예: 1번 △')).toBeVisible();
});

test('최대 60명 명단도 모두 표시하며 누락을 가리지 않는다', async ({ page }, info) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await setup(page);
  await uploadPlan(page);
  await uploadGrades(page, 60);
  await expect(
    page.getByRole('list', { name: '평균 구하기 학생별 성적 확인' }).getByRole('listitem'),
  ).toHaveCount(60);
  await capture(page, info, 'classroom-60');
});

test('제목 행까지 돌아갔다 와도 정정한 성적을 유지한다', async ({ page }) => {
  await setup(page);
  await uploadPlan(page);
  await uploadGrades(page);
  await finishGrades(page);
  await page.getByRole('button', { name: '이전', exact: true }).click();
  await page.getByLabel('1번 가상동명 성적').selectOption('high');
  for (let i = 0; i < 6; i++) await page.getByRole('button', { name: '이전', exact: true }).click();
  await expect(page.getByRole('heading', { name: '표의 제목 행을 선택하세요' })).toBeVisible();
  await page.getByRole('button', { name: '이 제목 행 사용' }).click();
  await page.getByRole('button', { name: '이 연결 확인' }).click();
  await page.getByRole('button', { name: '이 연결 확인' }).click();
  await page.getByRole('button', { name: '연결된 평가로 진행' }).click();
  await page.getByRole('button', { name: '명단 확인 완료' }).click();
  await page.getByRole('button', { name: '이 평가의 성적 확인 완료' }).click();
  await expect(page.getByLabel('1번 가상동명 성적')).toHaveValue('high');
});
