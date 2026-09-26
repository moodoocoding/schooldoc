import { expect, test, type Locator, type Page } from '@playwright/test';
import { jsPDF } from 'jspdf';
import type { ConsentFieldDraft } from '../../src/features/consentForms/types';

const token = 'pdf-compatibility-token';
const fields: ConsentFieldDraft[] = [
  { id: 'parent-name', kind: 'text', label: '보호자 성명', required: true, pageIndex: 0, x: 20, y: 40, width: 35, height: 3 },
  { id: 'read-notice', kind: 'checkbox', label: '안내 내용 확인', required: true, pageIndex: 1, x: 20, y: 40, width: 2, height: 1.414 },
];

async function seedDocument(page: Page) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  pdf.text('PDF compatibility first page', 20, 25);
  pdf.text('Please read the complete notice before responding.', 20, 45);
  pdf.rect(42, 118.8, 73.5, 8.91);
  pdf.addPage();
  pdf.text('PDF compatibility second page', 20, 25);
  pdf.text('This second page must also be visible before submission.', 20, 45);
  pdf.rect(42, 118.8, 4.2, 4.2);
  await page.goto('/');
  await page.evaluate(({ source, fields, token }) => {
    localStorage.setItem('schooldoc:consent-forms:drafts', JSON.stringify([{
      id: 'pdf-compatibility', title: '원본 표시 호환성 확인', fileName: 'compatibility.pdf',
      fields, publicToken: token, status: 'open', pageCount: 2,
      pageSizes: [{ width: 210, height: 297 }, { width: 210, height: 297 }],
      sourcePdfDataUrl: source,
    }]));
    localStorage.removeItem('schooldoc:consent-forms:responses');
  }, { source: pdf.output('datauristring'), fields, token });
  await page.goto(`/s/consent/${token}`);
}

// A canvas element alone is not evidence of a successful PDF render: failed pages
// retain a blank canvas. Inspect the heading pixels in the real PDF canvas.
async function expectPrintedPage(canvas: Locator) {
  await expect(canvas).toBeVisible();
  await expect.poll(() => canvas.evaluate(element => {
    const node = element as HTMLCanvasElement;
    const context = node.getContext('2d');
    if (!context || !node.width || !node.height) return 0;
    const data = context.getImageData(0, 0, node.width, Math.ceil(node.height * .2)).data;
    let darkPixels = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 0 && data[i] < 120 && data[i + 1] < 120 && data[i + 2] < 120) darkPixels++;
    }
    return darkPixels;
  })).toBeGreaterThan(100);
}

async function expectNoSubmission(page: Page) {
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('schooldoc:consent-forms:responses') ?? '[]'))).toEqual([]);
  await expect(page.getByRole('heading', { name: '응답을 제출했습니다' })).toHaveCount(0);
}

async function assertBlocked(page: Page) {
  await expect(page.getByTestId('consent-original-field')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '입력 시작', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '응답 확인', exact: true })).toBeDisabled();
  // Also exercise the form handler: disabled buttons alone must not be the guard.
  await page.locator('form').dispatchEvent('submit');
  await expect(page.getByRole('heading', { name: '제출 전 확인' })).toHaveCount(0);
  await expectNoSubmission(page);
}

async function finishResponse(page: Page, mobile: boolean) {
  await expect(page.locator('[data-pdf-state="ready"]')).toHaveCount(2);
  await page.getByRole('button', { name: '입력 시작', exact: true }).click();
  await page.getByRole('textbox', { name: '보호자 성명' }).fill('호환성 확인 보호자');
  if (mobile) await page.getByRole('button', { name: '다음', exact: true }).click();
  await page.getByRole('checkbox', { name: '안내 내용 확인', exact: true }).check();
  await page.getByRole('button', { name: '응답 확인', exact: true }).click();
  await expect(page.getByRole('heading', { name: '제출 전 확인' })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: '보호자 성명' })).toContainText('호환성 확인 보호자');
  await page.getByRole('button', { name: '작성 완료', exact: true }).click();
  await expect(page.getByRole('heading', { name: '응답을 제출했습니다' })).toBeVisible();
  const responses = await page.evaluate(() => JSON.parse(localStorage.getItem('schooldoc:consent-forms:responses') ?? '[]'));
  expect(responses).toHaveLength(1);
  expect(responses[0].values).toMatchObject({ 'parent-name': '호환성 확인 보호자', 'read-notice': 'true' });
}

for (const width of [1440, 390]) {
  test(`Map API가 없는 실제 main·Worker에서 PDF 원본을 읽고 제출한다 ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    let interceptedWorkers = 0;
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      for (const prototype of [Map.prototype, WeakMap.prototype]) {
        for (const method of ['getOrInsert', 'getOrInsertComputed']) Reflect.deleteProperty(prototype, method);
      }
      Object.defineProperty(globalThis, '__missingNativeMapMethods', {
        value: [Map.prototype, WeakMap.prototype].every(prototype => ['getOrInsert', 'getOrInsertComputed'].every(method => !(method in prototype))),
      });
      // The renderer destroys its worker after finishing. Capture an explicit
      // startup message so the assertion remains valid after that cleanup.
      Reflect.set(globalThis, '__workerMapCompatibilityMarkers', []);
      const NativeWorker = window.Worker;
      window.Worker = class extends NativeWorker {
        constructor(url: string | URL, options?: WorkerOptions) {
          super(url, options);
          this.addEventListener('message', event => {
            if (event.data?.type === 'schooldoc-pdf-compatibility-ready') {
              Reflect.get(globalThis, '__workerMapCompatibilityMarkers').push(event.data.missingNativeMapMethods);
            }
          });
        }
      };
    });
    // Worker has its own global scope. addInitScript alone does not reproduce the
    // failing phone environment there; strip APIs before the real worker runs.
    await page.route(/\/pdf\.worker(?:\.min)?\.mjs(?:\?|$)/, async route => {
      const response = await route.fetch();
      interceptedWorkers++;
      const prelude = `
        for (const prototype of [Map.prototype, WeakMap.prototype]) {
          for (const method of ['getOrInsert', 'getOrInsertComputed']) Reflect.deleteProperty(prototype, method);
        }
        self.__missingNativeWorkerMapMethods = [Map.prototype, WeakMap.prototype].every(prototype =>
          ['getOrInsert', 'getOrInsertComputed'].every(method => !(method in prototype)));
        self.postMessage({ type: 'schooldoc-pdf-compatibility-ready', missingNativeMapMethods: self.__missingNativeWorkerMapMethods });
      `;
      await route.fulfill({ response, body: prelude + await response.text() });
    });
    await seedDocument(page);
    await expect(page.locator('[data-pdf-state="ready"]')).toHaveCount(2);
    expect(await page.evaluate(() => Reflect.get(globalThis, '__missingNativeMapMethods'))).toBe(true);
    expect(interceptedWorkers).toBeGreaterThan(0);
    await expect.poll(() => page.evaluate(() => Reflect.get(globalThis, '__workerMapCompatibilityMarkers'))).toContain(true);
    await expectPrintedPage(page.locator('section[aria-label="1쪽"] canvas'));
    await expectPrintedPage(page.locator('section[aria-label="2쪽"] canvas'));
    // Exercise text extraction through the same compatibility loader as the app.
    const text = await page.evaluate(async () => {
      const modulePath = '/src/utils/pdfjs.ts';
      const { loadPdfJs } = await import(modulePath);
      const pdfjs = await loadPdfJs();
      const source = JSON.parse(localStorage.getItem('schooldoc:consent-forms:drafts')!)[0].sourcePdfDataUrl;
      const task = pdfjs.getDocument({ data: new Uint8Array(await (await fetch(source)).arrayBuffer()) });
      try {
        const document = await task.promise;
        const pdfPage = await document.getPage(2);
        const content = await pdfPage.getTextContent();
        return content.items.map((item: { str?: string }) => item.str ?? '').join(' ');
      } finally { await task.destroy(); }
    });
    expect(text).toContain('PDF compatibility second page');
    await finishResponse(page, width < 640);
    expect(errors).toEqual([]);
  });
}

test('2쪽 원본 렌더링이 늦으면 첫 쪽이 보여도 입력·제출을 기다린다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    const original = Worker.prototype.postMessage;
    let hold = true;
    const queued: Array<() => void> = [];
    Reflect.set(globalThis, '__delayedPdfPageMessages', 0);
    Reflect.set(globalThis, '__releaseSecondPdfPage', () => {
      hold = false;
      queued.splice(0).forEach(send => send());
    });
    Worker.prototype.postMessage = function (message: unknown, transfer?: Transferable[] | StructuredSerializeOptions) {
      const packet = message as { action?: string; data?: { pageIndex?: number } };
      if (hold && packet?.action === 'GetOperatorList' && packet.data?.pageIndex === 1) {
        queued.push(() => Reflect.apply(original, this, [message, transfer]));
        Reflect.set(globalThis, '__delayedPdfPageMessages', queued.length);
        return;
      }
      Reflect.apply(original, this, [message, transfer]);
    };
  });
  await seedDocument(page);
  await expect.poll(() => page.evaluate(() => Reflect.get(globalThis, '__delayedPdfPageMessages'))).toBeGreaterThan(0);
  await expect(page.locator('section[aria-label="1쪽"] [data-pdf-state="ready"]')).toHaveCount(1);
  await expectPrintedPage(page.locator('section[aria-label="1쪽"] canvas'));
  await expect(page.locator('section[aria-label="2쪽"] [data-pdf-state="loading"]')).toHaveCount(1);
  await assertBlocked(page);
  await page.evaluate(() => Reflect.get(globalThis, '__releaseSecondPdfPage')());
  await expect(page.locator('[data-pdf-state="ready"]')).toHaveCount(2);
  await expectPrintedPage(page.locator('section[aria-label="2쪽"] canvas'));
  await expect(page.getByRole('button', { name: '입력 시작', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: '응답 확인', exact: true })).toBeEnabled();
});

test('2쪽 원본 표시 실패는 제출을 막고 다시 시도하면 정상 입력·제출된다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    Reflect.set(globalThis, '__failSecondPdfPage', true);
    HTMLCanvasElement.prototype.getContext = function (...args: unknown[]) {
      if (Reflect.get(globalThis, '__failSecondPdfPage') && this.closest('section[aria-label="2쪽"]')) {
        throw new Error('compatibility-test-canvas-failure');
      }
      return Reflect.apply(original, this, args);
    } as typeof original;
  });
  await seedDocument(page);
  await expect(page.locator('section[aria-label="1쪽"] [data-pdf-state="ready"]')).toHaveCount(1);
  await expectPrintedPage(page.locator('section[aria-label="1쪽"] canvas'));
  const failedPage = page.locator('section[aria-label="2쪽"]');
  await expect(failedPage.locator('[data-pdf-state="error"]')).toHaveCount(1);
  await expect(failedPage.getByRole('alert')).toBeVisible();
  await expect(page.getByText('compatibility-test-canvas-failure', { exact: false })).toHaveCount(0);
  await assertBlocked(page);
  await page.evaluate(() => Reflect.set(globalThis, '__failSecondPdfPage', false));
  await failedPage.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.locator('[data-pdf-state="ready"]')).toHaveCount(2);
  await expect(failedPage.getByRole('alert')).toHaveCount(0);
  await expectPrintedPage(failedPage.locator('canvas'));
  await finishResponse(page, false);
});
