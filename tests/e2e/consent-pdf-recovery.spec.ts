import { expect, test } from '@playwright/test';
import { jsPDF } from 'jspdf';
import type { ConsentFieldDraft } from '../../src/features/consentForms/types';

test('작성한 응답은 새 File 원본의 표시 실패·재시도를 거쳐 보존되고 완료 전 제출은 차단된다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const pdf = new jsPDF();
  pdf.text('First page of the original notice', 20, 25);
  pdf.addPage();
  pdf.text('Second page - read this before responding', 20, 25);
  const fields: ConsentFieldDraft[] = [
    { id: 'name', kind: 'text', label: '보호자 성명', required: true, pageIndex: 0, x: 20, y: 35, width: 35, height: 3 },
    { id: 'read', kind: 'checkbox', label: '안내 내용 확인', required: true, pageIndex: 1, x: 20, y: 35, width: 2, height: 1.414 },
  ];
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    Reflect.set(globalThis, '__failReplacementPdf', false);
    HTMLCanvasElement.prototype.getContext = function (...args: unknown[]) {
      if (Reflect.get(globalThis, '__failReplacementPdf') && this.closest('section[aria-label="2쪽"]')) {
        throw new Error('replacement-canvas-failure');
      }
      return Reflect.apply(original, this, args);
    } as typeof original;
  });
  // A small parent harness can replace the File prop without remounting the real
  // form or clearing its controlled values. It renders the production component,
  // production PDF loader and real workers; only the parent prop update is added.
  await page.route('**/__consent_pdf_recovery', route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html lang="ko"><head><meta charset="UTF-8"><title>PDF recovery test</title></head><body><div id="root"></div></body></html>',
  }));
  await page.goto('/__consent_pdf_recovery');
  await page.evaluate(async ({ source, fields }) => {
    const refreshPath = '/@react-refresh';
    const refresh = (await import(refreshPath)).default;
    refresh.injectIntoGlobalHook(window);
    Reflect.set(globalThis, '$RefreshReg$', () => undefined);
    Reflect.set(globalThis, '$RefreshSig$', () => (component: unknown) => component);
    Reflect.set(globalThis, '__vite_plugin_react_preamble_installed__', true);
    // Use the app's resolved dependency URLs so hooks and createRoot share the
    // same React instance, including Vite's dependency version query.
    const mainSource = await (await fetch('/src/main.tsx')).text();
    const reactPath = mainSource.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1];
    const clientPath = mainSource.match(/from "([^"]*\/react-dom_client\.js[^"]*)"/)?.[1];
    if (!reactPath || !clientPath) throw new Error('React test harness dependency URLs were not found');
    const React = (await import(reactPath)).default;
    const { createRoot } = (await import(clientPath)).default;
    const stylesPath = '/src/index.css';
    await import(stylesPath);
    const formPath = '/src/features/consentForms/ConsentResponseForm.tsx';
    const { ConsentResponseForm } = await import(formPath);
    const initialFile = new File([await (await fetch(source)).blob()], 'same-original.pdf', { type: 'application/pdf' });
    const consentDocument = {
      title: '원본 재표시와 응답 보존 확인', fields, pageCount: 2,
      pageSizes: [{ width: 210, height: 297 }, { width: 210, height: 297 }],
      status: 'open', passwordRequired: false, allowResubmission: false, sourceUrl: source,
    };
    Reflect.set(globalThis, '__recoverySubmissions', []);
    function RecoveryHarness() {
      const [file, setFile] = React.useState(initialFile);
      const [values, setValues] = React.useState({} as Record<string, string>);
      const [submitted, setSubmitted] = React.useState(false);
      React.useLayoutEffect(() => { Reflect.set(globalThis, '__recoveryValues', { ...values }); }, [values]);
      React.useLayoutEffect(() => {
        if (file === initialFile) return;
        // Inspect the first committed replacement render before PDF effects can
        // replace old "ready" notifications with a new "loading" notification.
        const submit = document.querySelector<HTMLButtonElement>('button[type="submit"]');
        Reflect.set(globalThis, '__replacementInitialState', {
          submitDisabled: submit?.disabled,
          fieldCount: document.querySelectorAll('[data-testid="consent-original-field"]').length,
          readyPages: document.querySelectorAll('[data-pdf-state="ready"]').length,
        });
        document.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }, [file]);
      if (submitted) return React.createElement('p', { role: 'status' }, '테스트 제출 완료');
      return React.createElement(React.Fragment, null,
        React.createElement('button', {
          type: 'button',
          onClick: () => {
            Reflect.set(globalThis, '__failReplacementPdf', true);
            setFile(new File([initialFile], initialFile.name, { type: initialFile.type }));
          },
        }, '같은 원본 다시 불러오기'),
        React.createElement(ConsentResponseForm, {
          document: consentDocument, file, values, setValues, submitting: false, serverError: '',
          onSubmit: async () => {
            Reflect.get(globalThis, '__recoverySubmissions').push({ ...values });
            setSubmitted(true);
          },
        }),
      );
    }
    createRoot(document.getElementById('root')!).render(React.createElement(RecoveryHarness));
  }, { source: pdf.output('datauristring'), fields });

  await expect(page.locator('[data-pdf-state="ready"]')).toHaveCount(2);
  await page.getByRole('textbox', { name: '보호자 성명' }).fill('보존할 보호자');
  await page.getByRole('checkbox', { name: '안내 내용 확인', exact: true }).check();
  await page.getByRole('button', { name: '응답 확인', exact: true }).click();
  await expect(page.getByRole('button', { name: '작성 완료', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '같은 원본 다시 불러오기', exact: true }).click();
  expect(await page.evaluate(() => Reflect.get(globalThis, '__replacementInitialState'))).toEqual({
    submitDisabled: true, fieldCount: 0, readyPages: 0,
  });
  const failedPage = page.locator('section[aria-label="2쪽"]');
  await expect(failedPage.locator('[data-pdf-state="error"]')).toHaveCount(1);
  await expect(page.getByTestId('consent-original-field')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '제출 전 확인' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '작성 완료', exact: true })).toBeDisabled();
  await expect(page.getByText('replacement-canvas-failure', { exact: false })).toHaveCount(0);
  await page.locator('form').dispatchEvent('submit');
  expect(await page.evaluate(() => Reflect.get(globalThis, '__recoverySubmissions'))).toEqual([]);
  expect(await page.evaluate(() => Reflect.get(globalThis, '__recoveryValues'))).toEqual({ name: '보존할 보호자', read: 'true' });

  await page.evaluate(() => Reflect.set(globalThis, '__failReplacementPdf', false));
  await failedPage.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.locator('[data-pdf-state="ready"]')).toHaveCount(2);
  await expect(page.getByRole('textbox', { name: '보호자 성명' })).toHaveValue('보존할 보호자');
  await expect(page.getByRole('checkbox', { name: '안내 내용 확인', exact: true })).toBeChecked();
  await expect(page.getByRole('heading', { name: '제출 전 확인' })).toBeVisible();
  await page.getByRole('button', { name: '작성 완료', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('테스트 제출 완료');
  expect(await page.evaluate(() => Reflect.get(globalThis, '__recoverySubmissions'))).toEqual([{ name: '보존할 보호자', read: 'true' }]);
  expect(errors).toEqual([]);
});
