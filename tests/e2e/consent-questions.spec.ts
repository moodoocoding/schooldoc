import { expect, test, type Page } from '@playwright/test';
import { jsPDF } from 'jspdf';
import AxeBuilder from '@axe-core/playwright';
import type { ConsentFieldDraft } from '../../src/features/consentForms/types';

const choice = { id: 'agreement', label: '동의 여부', mode: 'single' as const, required: true, minSelections: 1 };
const fields: ConsentFieldDraft[] = [
  { id: 'yes', kind: 'checkbox', label: '예', required: false, choice, pageIndex: 0, x: 20, y: 30, width: 2, height: 1.414 },
  { id: 'no', kind: 'checkbox', label: '아니오', required: false, choice, pageIndex: 0, x: 40, y: 30, width: 2, height: 1.414 },
  { id: 'name', kind: 'text', label: '보호자 성명', required: true, pageIndex: 0, x: 20, y: 40, width: 30, height: 1.8 },
  { id: 'optional', kind: 'checkbox', label: '추가 안내 희망', required: false, pageIndex: 0, x: 20, y: 50, width: 2, height: 1.414 },
];
async function seed(page: Page, customFields = fields) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  pdf.text('Consent notice - original must remain visible', 20, 25);
  pdf.rect(42, 89.1, 4.2, 4.2); pdf.text('YES', 48, 93);
  pdf.rect(84, 89.1, 4.2, 4.2); pdf.text('NO', 90, 93);
  pdf.rect(42, 118.8, 63, 5.346); pdf.text('Name:', 20, 122);
  await page.goto('/');
  await page.evaluate(({ source, customFields }) => localStorage.setItem('schooldoc:consent-forms:drafts', JSON.stringify([{
    id: 'question-test', title: '선택 질문 테스트', fileName: 'consent.pdf', fields: customFields, publicToken: 'question-token', status: 'open',
    pageCount: 1, pageSizes: [{ width: 210, height: 297 }], sourcePdfDataUrl: source,
  }])), { source: pdf.output('datauristring'), customFields });
  await page.goto('/s/consent/question-token');
  await expect(page.locator('section[aria-label="1쪽"] canvas')).toBeVisible();
  await expect(page.getByLabel('원본 PDF 렌더링 중')).toHaveCount(0);
}

for (const width of [1440, 390]) for (const answer of ['예', '아니오']) {
  test(`원본 중심 자유 입력·${answer} 선택·검토·제출 ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await seed(page);
    await expect(page.getByText('문서를 읽고 회색 입력칸을 눌러 작성해 주세요.', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: '원본 위치 보기' })).toHaveCount(0);
    const original = page.locator('#consent-original-yes');
    expect(await original.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgba(100, 116, 139, 0.16)');
    expect((await page.locator('section[aria-label="1쪽"]').boundingBox())!.y).toBeLessThan(220);
    await page.getByRole('button', { name: '입력 시작' }).click();
    // 다음 위치로 이동할 때 입력을 강제하지 않고, 제출 전 확인에서 누락을 안내한다.
    await page.getByRole('button', { name: '다음', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.getByRole('button', { name: '응답 확인' }).click();
    await expect(page.getByRole('alert')).toContainText('선택해');
    const yes = page.getByRole('radio', { name: '예', exact: true });
    const no = page.getByRole('radio', { name: '아니오', exact: true });
    await yes.check(); await no.check();
    await expect(yes).not.toBeChecked();
    await page.getByRole('radio', { name: answer, exact: true }).check();
    if (width < 640) expect((await yes.locator('..').boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const overlay = page.locator('#consent-original-yes');
    await expect(overlay).toHaveAttribute('data-active', 'true');
    expect((await overlay.boundingBox())!.width).toBeLessThan(20);
    if (width < 640) {
      const box = (await overlay.boundingBox())!;
      const drawer = (await page.getByRole('region', { name: '동의 여부 · 필수' }).boundingBox())!;
      expect(box.y).toBeGreaterThan(60);
      expect(box.y + box.height).toBeLessThan(drawer.y);
    }
    await page.screenshot({ path: `test-results/consent-question-${answer}-${width}.png`, fullPage: true });
    await page.screenshot({ path: `test-results/consent-document-viewport-${answer}-${width}.png` });
    await page.getByRole('button', { name: '다음', exact: true }).click();
    if (width < 640) await expect(page.getByRole('radio')).toHaveCount(0);
    await page.getByRole('textbox', { name: '보호자 성명' }).fill('테스트 보호자');
    await page.getByRole('button', { name: '이전', exact: true }).click();
    await expect(page.getByRole('radio', { name: answer, exact: true })).toBeChecked();
    await page.getByRole('button', { name: '다음', exact: true }).click();
    await expect(page.getByRole('textbox', { name: '보호자 성명' })).toHaveValue('테스트 보호자');
    await page.getByRole('button', { name: '다음', exact: true }).click();
    await page.getByRole('button', { name: '응답 확인' }).click();
    await expect(page.getByRole('heading', { name: '제출 전 확인' })).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: '동의 여부' })).toContainText(answer);
    await page.getByRole('button', { name: '동의 여부 수정' }).click();
    await expect(page.getByRole('radio', { name: answer, exact: true })).toBeChecked();
    await page.getByRole('button', { name: '다음', exact: true }).click();
    await page.getByRole('button', { name: '다음', exact: true }).click();
    await page.getByRole('button', { name: '응답 확인' }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.getByRole('button', { name: '작성 완료' }).click();
    await expect(page.getByRole('heading', { name: '응답을 제출했습니다' })).toBeVisible();
    const responses = await page.evaluate(() => JSON.parse(localStorage.getItem('schooldoc:consent-forms:responses') ?? '[]'));
    expect(responses[0].values[answer === '예' ? 'yes' : 'no']).toBe('true');
    expect(responses[0].values[answer === '예' ? 'no' : 'yes']).not.toBe('true');
    expect(responses[0].values.optional).not.toBe('true');
    expect(errors).toEqual([]);
  });
}

test('PC에서 순서와 무관하게 원본의 필드를 직접 입력하고 다시 수정한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seed(page);
  await page.getByRole('textbox', { name: '보호자 성명' }).fill('먼저 작성');
  await expect(page.locator('footer')).toContainText('2/3 · 보호자 성명');
  await page.getByRole('radio', { name: '아니오', exact: true }).check();
  await page.getByRole('checkbox', { name: '추가 안내 희망' }).check();
  await page.getByRole('textbox', { name: '보호자 성명' }).fill('최종 이름');
  await page.getByRole('button', { name: '응답 확인' }).click();
  await page.getByRole('button', { name: '보호자 성명 수정' }).click();
  await expect(page.getByRole('textbox', { name: '보호자 성명' })).toHaveValue('최종 이름');
  await expect(page.getByRole('radio', { name: '아니오', exact: true })).toBeChecked();
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(result.violations).toEqual([]);
});

test('모바일에서 원본 칸 클릭·입력창 닫기·다른 칸 이동·화면 크기 변경 시 값을 보존한다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page);
  await page.getByRole('button', { name: '보호자 성명 입력 위치' }).click();
  await page.getByRole('textbox', { name: '보호자 성명' }).fill('테스트 이름');
  await page.getByRole('button', { name: '입력창 닫고 원본 보기' }).click();
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '보호자 성명 입력 위치' })).toContainText('테스트 이름');
  await page.getByRole('button', { name: '아니오 입력 위치' }).click();
  await page.getByRole('radio', { name: '아니오', exact: true }).check();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('radio')).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole('radio', { name: '아니오', exact: true })).toBeChecked();
  await expect(page.getByRole('textbox', { name: '보호자 성명' })).toHaveValue('테스트 이름');
});

test('두 쪽의 날짜·마지막 입력칸으로 이동해도 모바일 입력창에 가려지지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, [fields[2], { ...fields[2], id: 'date', kind: 'date', label: '작성 날짜', pageIndex: 1, y: 92 }]);
  await page.goto('/');
  await page.evaluate(() => {
    const rows = JSON.parse(localStorage.getItem('schooldoc:consent-forms:drafts')!);
    rows[0].pageCount = 2;
    rows[0].pageSizes.push({ width: 210, height: 297 });
    localStorage.setItem('schooldoc:consent-forms:drafts', JSON.stringify(rows));
  });
  // 실제 2쪽 PDF도 만들어 페이지 렌더링까지 확인한다.
  const pdf = new jsPDF(); pdf.text('First page', 20, 20); pdf.addPage(); pdf.text('Date at end', 20, 270);
  await page.evaluate(source => {
    const rows = JSON.parse(localStorage.getItem('schooldoc:consent-forms:drafts')!);
    rows[0].sourcePdfDataUrl = source;
    localStorage.setItem('schooldoc:consent-forms:drafts', JSON.stringify(rows));
  }, pdf.output('datauristring'));
  await page.goto('/s/consent/question-token');
  await page.getByRole('button', { name: '작성 날짜 입력 위치' }).click();
  await page.getByLabel('작성 날짜 필수').fill('2026-09-21');
  const rect = (await page.locator('#consent-original-date').boundingBox())!;
  const drawer = (await page.getByRole('region', { name: '작성 날짜 · 필수' }).boundingBox())!;
  expect(rect.y).toBeGreaterThan(60);
  expect(rect.y + rect.height).toBeLessThan(drawer.y);
  await page.getByRole('button', { name: '이전', exact: true }).click();
  await page.getByRole('textbox', { name: '보호자 성명' }).fill('김보호');
  await page.getByRole('button', { name: '응답 확인' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: '작성 날짜' })).toContainText('2026-09-21');
});

test('교사는 기존 체크박스를 질문으로 묶고 새 질문을 작게 배치할 수 있다', async ({ page }) => {
  const pdf = new jsPDF(); pdf.text('Original label', 20, 35);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/tools/consent-forms/new');
  await page.getByLabel('가정통신문 PDF 파일').setInputFiles({ name: 'checkbox.pdf', mimeType: 'application/pdf', buffer: Buffer.from(pdf.output('arraybuffer')) });
  await page.getByRole('button', { name: '확인 후 필드 배치' }).click();
  const settings = page.getByTestId('consent-field-settings');
  await page.getByRole('button', { name: '체크박스', exact: true }).click();
  await settings.getByLabel('표시 이름').fill('참가');
  await expect(settings.getByLabel('반드시 체크해야 하는 확인 항목')).not.toBeChecked();
  await settings.getByLabel('너비', { exact: true }).fill('1');
  await settings.getByLabel('높이', { exact: true }).fill('0.7');
  const field = page.getByRole('button', { name: '참가 필드', exact: true });
  expect(await field.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
  expect(await field.innerText()).toBe('');
  await page.getByRole('button', { name: '체크박스', exact: true }).click();
  await settings.getByLabel('표시 이름').fill('불참');
  await settings.getByLabel('다른 체크박스와 질문으로 묶기').selectOption({ label: '참가 (1쪽)' });
  await settings.getByLabel('질문 제목').fill('참가 여부');
  await expect(settings.getByText('선택지:', { exact: false })).toContainText('참가 / 불참');
  await page.getByRole('button', { name: '예 / 아니오 질문', exact: true }).click();
  await expect(settings.getByLabel('질문 제목')).toHaveValue('동의 여부');
  await expect(page.getByRole('button', { name: '필드 배치 완료' })).toBeEnabled();
  await page.getByTestId('consent-field-canvas').screenshot({ path: 'test-results/consent-checkbox-editor.png' });
  await page.getByRole('button', { name: '필드 배치 완료' }).click();
  await page.getByLabel('명단 없이 받기').check();
  await page.getByRole('button', { name: '다음: 공유 설정' }).click();
  await page.getByRole('button', { name: '수합 만들기' }).click();
  await page.getByRole('button', { name: '관리·공유' }).click();
  const link = await page.getByLabel('응답 화면 열기').getAttribute('href');
  await page.goto(link!);
  await page.getByRole('button', { name: '입력 시작' }).click();
  await expect(page.locator('footer')).toContainText('참가 여부');
  await page.getByRole('radio', { name: '불참', exact: true }).check();
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await expect(page.locator('footer')).toContainText('동의 여부');
});

test('모바일 단계별 입력 접근성 검사', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page);
  await page.getByRole('button', { name: '입력 시작' }).click();
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(result.violations).toEqual([]);
});

test('복수 선택 최소 수·선택 항목 건너뛰기·기존 필수 체크 보존', async ({ page }) => {
  const multiple = fields.slice(0, 2).map(field => ({ ...field, choice: { ...choice, mode: 'multiple' as const, minSelections: 2 } }));
  await seed(page, [...multiple, { ...fields[3], required: true }]);
  await page.getByRole('button', { name: '입력 시작' }).click();
  await page.getByRole('checkbox', { name: '예', exact: true }).check();
  await page.getByRole('button', { name: '응답 확인' }).click();
  await expect(page.getByRole('alert')).toContainText('2개 이상');
  await page.getByRole('checkbox', { name: '아니오', exact: true }).check();
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await page.getByRole('button', { name: '응답 확인' }).click();
  await expect(page.getByRole('alert')).toContainText('확인해');
  await page.getByRole('checkbox', { name: '추가 안내 희망' }).check();
  await page.getByRole('button', { name: '응답 확인' }).click();
  await expect(page.getByRole('heading', { name: '제출 전 확인' })).toBeVisible();
});

test('서명 단계의 적용·취소·키보드 포커스', async ({ page }) => {
  await seed(page, [{ ...fields[2], id: 'signature', kind: 'signature', label: '보호자 서명', width: 25, height: 8 }]);
  await page.getByRole('button', { name: '입력 시작' }).click();
  await page.getByRole('button', { name: '응답 확인' }).click();
  await expect(page.getByRole('alert')).toContainText('입력해');
  await page.getByRole('button', { name: '보호자 서명 작성' }).click();
  await expect(page.getByRole('button', { name: '서명 적용' })).toBeDisabled();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: '다시 쓰기' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: '보호자 서명 작성' }).click();
  const rect = (await page.getByLabel('서명 입력 영역').boundingBox())!;
  await page.mouse.move(rect.x + 30, rect.y + 50); await page.mouse.down();
  await page.mouse.move(rect.x + 100, rect.y + 90, { steps: 8 }); await page.mouse.up();
  await page.getByRole('button', { name: '서명 적용' }).click();
  await page.getByRole('button', { name: '보호자 서명 서명 수정' }).click();
  await page.getByRole('button', { name: '다시 쓰기' }).click();
  await page.getByRole('button', { name: '서명 창 닫기' }).click();
  await expect(page.getByRole('img', { name: '보호자 서명 서명' })).toBeVisible();
  await page.getByRole('button', { name: '응답 확인' }).click();
  await expect(page.getByText('서명 완료', { exact: true })).toBeVisible();
});

test('선택한 아니오만 결과 PDF의 원본 위치에 출력', async ({ page }) => {
  await seed(page);
  const rendered = await page.evaluate(async () => {
    const path = '/src/features/consentForms/consentResponseRender.ts';
    const { renderConsentResponsesPdf } = await import(path);
    const draft = JSON.parse(localStorage.getItem('schooldoc:consent-forms:drafts')!)[0];
    const file = new File([await (await fetch(draft.sourcePdfDataUrl)).blob()], 'test.pdf', { type: 'application/pdf' });
    const pdf = await renderConsentResponsesPdf({ file, fields: draft.fields, responses: [{ id: 'r', submittedAt: '2026-09-21', values: { no: 'true', name: 'Test Parent' } }] });
    const pdfjsPath = '/node_modules/pdfjs-dist/build/pdf.mjs';
    const pdfjs = await import(pdfjsPath);
    pdfjs.GlobalWorkerOptions.workerSrc = '/node_modules/pdfjs-dist/build/pdf.worker.min.mjs';
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await pdf.arrayBuffer()) }).promise;
    const pdfPage = await doc.getPage(1);
    const viewport = pdfPage.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas'); canvas.id = 'rendered-response-pdf';
    canvas.width = viewport.width; canvas.height = viewport.height;
    // PDF 자체를 촬영한다. 앱의 고정 푸터가 출력물 위에 겹치지 않게 분리한다.
    document.body.replaceChildren(canvas);
    const ctx = canvas.getContext('2d')!;
    await pdfPage.render({ canvas, canvasContext: ctx, viewport }).promise;
    const ink = (x: number) => {
      const pixels = ctx.getImageData(canvas.width * x / 100, canvas.height * .3, canvas.width * .02, canvas.height * .01414).data;
      let count = 0;
      for (let i = 0; i < pixels.length; i += 4) if (pixels[i] < 100 && pixels[i + 1] < 100 && pixels[i + 2] < 100) count++;
      return count;
    };
    return { pages: doc.numPages, yesInk: ink(20), noInk: ink(40), type: pdf.type };
  });
  expect(rendered.pages).toBe(1);
  expect(rendered.type).toBe('application/pdf');
  expect(rendered.noInk).toBeGreaterThan(rendered.yesInk + 10);
  await page.locator('#rendered-response-pdf').screenshot({ path: 'test-results/consent-question-output-pdf.png' });
});
