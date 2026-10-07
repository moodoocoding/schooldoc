import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { jsPDF } from 'jspdf';
import { readSheet } from 'read-excel-file/node';
import type { ReceiptBook, ReceiptEntry, ReceiptFile } from '../../src/features/classBudgetReceipts/types';

const OWNER_ID = 'receipt-export-test-teacher';
const BOOK_ID = 'receipt-export-book';
const CREATED_AT = '2026-09-01T09:00:00.000Z';
const FORMULA_MERCHANT = '=SUM(1,2)';
const FORMULA_PURPOSE = '+교실 자료';
type SourceFile = { id: string; name: string; mimeType: string; base64: string };
type FixtureKind = 'mixed' | 'manual' | 'empty' | 'missing' | 'corrupt';

function entry(id: string, spentAt: string, merchant: string, purpose: string, amount: number, evidenceFileIds: string[] = []): ReceiptEntry {
  return { id, spentAt, merchant, purpose, amount, evidenceFileIds, createdAt: CREATED_AT, updatedAt: CREATED_AT, deletedAt: null, purgeAfter: null };
}

function metadata(source: SourceFile, entries: ReceiptEntry[]): ReceiptFile {
  const bytes = Buffer.from(source.base64, 'base64');
  return {
    id: source.id, bookId: BOOK_ID, status: 'uploaded', originalName: source.name,
    mimeType: source.mimeType, sizeBytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
    analysisStatus: 'ready', analysis: null, analysisCandidates: [], analysisErrorCode: null,
    analyzedAt: CREATED_AT, previewUrl: '', linkedEntryIds: entries.filter(row => row.evidenceFileIds.includes(source.id)).map(row => row.id),
    createdAt: CREATED_AT, updatedAt: CREATED_AT,
  };
}

async function setup(page: Page, kind: FixtureKind = 'mixed') {
  const pageErrors: string[] = [];
  const remoteCalls: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  // 가상 계정과 브라우저 저장소만 사용한다. 원격 Supabase와 영수증 AI는 호출하지 않는다.
  await page.route('**/src/utils/supabaseClient.ts', route => route.fulfill({ contentType: 'application/javascript', body: `
    export const isSupabaseConfigured = true;
    const user = { id: '${OWNER_ID}', email: 'export-test@example.invalid', app_metadata: {}, user_metadata: { name: '출력 테스트 교사' } };
    export const supabase = {
      auth: {
        getSession: async () => ({ data: { session: { user } } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
        signOut: async () => ({}),
      },
      functions: { invoke: async () => { throw new Error('출력 테스트에서 원격 함수를 호출하면 안 됩니다.'); } },
    };
  ` }));
  await page.route('https://**.supabase.co/**', route => { remoteCalls.push(route.request().url()); return route.abort(); });
  await page.goto('/tools/receipts');

  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 450; canvas.height = 640;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#fff'; context.fillRect(0, 0, 450, 640);
    context.fillStyle = '#c82020'; context.fillRect(40, 100, 370, 140);
    context.fillStyle = '#172b4d'; context.font = 'bold 26px sans-serif';
    context.fillText('사진 증빙 테스트', 40, 65);
    context.font = '22px sans-serif'; context.fillText('학급 문구점', 40, 320);
    context.fillText('2026-09-03', 40, 380); context.fillText('합계 7,000원', 40, 460);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const pdf = new jsPDF();
  pdf.setFillColor(20, 70, 210); pdf.rect(20, 35, 160, 65, 'F'); pdf.text('PDF RECEIPT PAGE ONE', 20, 20);
  pdf.addPage(); pdf.setFillColor(20, 160, 60); pdf.rect(20, 35, 160, 65, 'F'); pdf.text('PDF RECEIPT PAGE TWO', 20, 20);
  const imageSource: SourceFile = { id: 'photo-source', name: '사진 증빙.png', mimeType: 'image/png', base64: png };
  const pdfSource: SourceFile = { id: 'pdf-source', name: '두 쪽 증빙.pdf', mimeType: 'application/pdf', base64: Buffer.from(pdf.output('arraybuffer')).toString('base64') };
  const manual = entry('manual-entry', '2026-09-01', FORMULA_MERCHANT, FORMULA_PURPOSE, 2000);
  const photo = entry('photo-entry', '2026-09-03', '학급 문구점', '미술 재료', 7000, [imageSource.id]);
  const pdfFirst = entry('pdf-first-entry', '2026-09-04', '학급 서점', '독서 자료', 8000, [pdfSource.id]);
  const pdfSecond = entry('pdf-second-entry', '2026-09-05', '-자료상점', '@학급행사', 13000, [pdfSource.id]);
  const trashed = { ...entry('trashed-entry', '2026-09-02', '휴지통 사용처', '출력 제외 휴지통', 99999, ['trashed-source']), deletedAt: CREATED_AT, purgeAfter: '2099-01-01T00:00:00.000Z' };
  const entries = kind === 'empty' ? [trashed] : kind === 'manual' ? [manual] : kind === 'mixed' ? [pdfSecond, manual, trashed, photo, pdfFirst] : [photo];
  const sources = kind === 'mixed' ? [imageSource, pdfSource] : kind === 'manual' || kind === 'empty' ? [] : [imageSource];
  const files = sources.map(source => metadata(source, entries));
  if (kind === 'mixed' || kind === 'empty') {
    files.push(metadata({ ...imageSource, id: 'trashed-source', name: '휴지통 원본.png' }, entries));
    // 미반영 후보와 휴지통의 원본은 일부러 저장하지 않는다. 출력 대상이 되면 PDF가 실패한다.
    files.push({ ...metadata({ ...imageSource, id: 'pending-source', name: '미반영 원본.png' }, entries), analysis: { spentAt: '2026-09-09', merchant: '미반영 사용처', amount: 123456, confidence: 1, source: 'openai', warnings: [] } });
  }
  const book: ReceiptBook = {
    id: BOOK_ID, ownerId: OWNER_ID, title: '학급 운영비 출력 검증', schoolYear: 2026, classLabel: '5학년 2반',
    totalBudget: 500000, status: 'active', entries, files, retentionMonths: 3, createdAt: CREATED_AT, updatedAt: CREATED_AT,
  };
  await page.evaluate(async ({ book, sources, kind }) => {
    localStorage.setItem('schooldoc_class_budget_receipts_v1:' + book.ownerId, JSON.stringify([book]));
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('schooldoc-receipt-originals-v1', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('originals');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('originals', 'readwrite');
        if (kind !== 'missing') for (const source of sources) {
          const bytes = kind === 'corrupt' ? new Uint8Array([0, 1, 2, 3]) : Uint8Array.from(atob(source.base64), char => char.charCodeAt(0));
          tx.objectStore('originals').put(new File([bytes], source.name, { type: source.mimeType }), JSON.stringify([book.ownerId, book.id, source.id]));
        }
        tx.oncomplete = () => resolve(); tx.onerror = tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
  }, { book, sources, kind });
  await page.goto('/tools/receipts/' + BOOK_ID);
  await expect(page.getByRole('heading', { name: book.title, exact: true })).toBeVisible();
  await page.getByRole('tab', { name: /정산내역/ }).click();
  return { imageSource, pageErrors, remoteCalls };
}

async function downloadFile(page: Page, testInfo: TestInfo, buttonName: string, extension: string) {
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: buttonName, exact: true }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(new RegExp('\\.' + extension + '$'));
  const path = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(path);
  expect(await download.failure()).toBeNull();
  await testInfo.attach(download.suggestedFilename(), { path, contentType: extension === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  return path;
}

async function renderDownloadedPdf(page: Page, testInfo: TestInfo, path: string) {
  const base64 = (await readFile(path)).toString('base64');
  const pages = await page.evaluate(async base64 => {
    const modulePath = '/src/utils/pdfjs.ts';
    const { loadPdfJs } = await import(modulePath);
    const pdfjs = await loadPdfJs();
    const task = pdfjs.getDocument({ data: Uint8Array.from(atob(base64), char => char.charCodeAt(0)) });
    const container = document.createElement('div'); container.id = 'export-pdf-render'; document.body.append(container);
    const rendered: { width: number; height: number; ink: number; red: number; blue: number; green: number; redWidth: number; redHeight: number }[] = [];
    try {
      const document = await task.promise;
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
        const pdfPage = await document.getPage(pageNumber);
        const viewport = pdfPage.getViewport({ scale: 1 });
        const canvas = window.document.createElement('canvas'); canvas.id = 'export-pdf-page-' + pageNumber;
        canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        canvas.style.display = 'block'; container.append(canvas);
        const context = canvas.getContext('2d')!;
        await pdfPage.render({ canvasContext: context, canvas, viewport }).promise;
        const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let ink = 0; let red = 0; let blue = 0; let green = 0;
        let redLeft = canvas.width; let redRight = -1; let redTop = canvas.height; let redBottom = -1;
        for (let index = 0; index < data.length; index += 4) {
          const [r, g, b] = [data[index], data[index + 1], data[index + 2]];
          if (r < 220 || g < 220 || b < 220) ink++;
          if (r > 150 && g < 90 && b < 90) {
            red++;
            const x = (index / 4) % canvas.width; const y = Math.floor(index / 4 / canvas.width);
            redLeft = Math.min(redLeft, x); redRight = Math.max(redRight, x);
            redTop = Math.min(redTop, y); redBottom = Math.max(redBottom, y);
          }
          if (b > 150 && r < 90 && g < 120) blue++;
          if (g > 110 && r < 90 && b < 110) green++;
        }
        rendered.push({ width: viewport.width, height: viewport.height, ink, red, blue, green,
          redWidth: red ? redRight - redLeft + 1 : 0, redHeight: red ? redBottom - redTop + 1 : 0 });
        pdfPage.cleanup();
      }
      return rendered;
    } finally { await task.destroy(); }
  }, base64);
  try {
    for (let index = 0; index < pages.length; index++) {
      const path = testInfo.outputPath('export-pdf-page-' + (index + 1) + '.png');
      await page.locator('#export-pdf-page-' + (index + 1)).screenshot({ path });
      await testInfo.attach('PDF ' + (index + 1) + '쪽', { path, contentType: 'image/png' });
    }
  } finally { await page.locator('#export-pdf-render').evaluate(element => element.remove()); }
  return pages;
}

test('Excel은 화면의 5열 정산내역과 반영한 지출만 내보내고 수식 모양 문자를 보존한다', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  const { pageErrors, remoteCalls } = await setup(page);
  await page.getByRole('tab', { name: /정산내역/ }).focus();
  await page.getByRole('tab', { name: /정산내역/ }).press('ArrowLeft');
  await expect(page.getByRole('tab', { name: /영수증 등록/ })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: /영수증 등록/ }).press('ArrowRight');
  await expect(page.getByRole('tab', { name: /정산내역/ })).toHaveAttribute('aria-selected', 'true');
  const rows = page.getByRole('table').locator('tbody tr');
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(0)).toContainText(FORMULA_MERCHANT);
  await expect(rows.nth(3)).toContainText('-자료상점');
  await expect(page.getByRole('columnheader')).toHaveText(['사용일자', '사용업체명', '사용금액', '증빙구분', '사용내역']);
  await page.screenshot({ path: testInfo.outputPath('settlement-headers-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath('settlement-headers-mobile.png'), fullPage: true });
  const path = await downloadFile(page, testInfo, 'Excel 정산내역', 'xlsx');
  const data = await readSheet(path);
  const values = data.flat();
  expect(data[0]).toEqual(['사용일자', '사용업체명', '사용금액', '증빙구분', '사용내역']);
  expect(values).toContain(FORMULA_MERCHANT);
  expect(values).toContain(FORMULA_PURPOSE);
  expect(values).toContain('-자료상점');
  expect(values).toContain('@학급행사');
  expect(values).not.toContain('휴지통 사용처');
  expect(values).not.toContain('미반영 사용처');
  expect(values).not.toContain(99999);
  expect(values).not.toContain(123456);
  for (const value of [2000, 7000, 8000, 13000]) expect(values).toContain(value);
  const exported = data.filter(row => row.includes(FORMULA_MERCHANT) || row.includes('학급 문구점') || row.includes('학급 서점') || row.includes('-자료상점'));
  expect(exported).toHaveLength(4);
  expect(exported.map(row => (row[0] as Date).toISOString().slice(0, 10))).toEqual(['2026-09-01', '2026-09-03', '2026-09-04', '2026-09-05']);
  expect(exported.map(row => row[2])).toEqual([2000, 7000, 8000, 13000]);
  expect(exported.map(row => row[3])).toEqual(['전산자료', '전산자료', '전산자료', '전산자료']);
  await expect(page.getByRole('button', { name: 'Excel 정산내역', exact: true })).toBeEnabled();
  expect(pageErrors).toEqual([]); expect(remoteCalls).toEqual([]);
});

test('PDF는 지출대장과 사진·두 쪽 PDF 전체를 포함하고 공유 증빙을 한 번만 첨부한다', async ({ page }, testInfo) => {
  const { pageErrors, remoteCalls } = await setup(page);
  await page.screenshot({ path: testInfo.outputPath('export-ledger-desktop.png'), fullPage: true });
  const path = await downloadFile(page, testInfo, '영수증 첨부 PDF', 'pdf');
  const pages = await renderDownloadedPdf(page, testInfo, path);
  expect(pages).toHaveLength(4);
  for (const rendered of pages) {
    expect(rendered.width).toBeCloseTo(595.28, 0); expect(rendered.height).toBeCloseTo(841.89, 0);
    expect(rendered.ink).toBeGreaterThan(1000);
  }
  expect(pages[1].red).toBeGreaterThan(1000);
  expect(pages[2].blue).toBeGreaterThan(1000);
  expect(pages[3].green).toBeGreaterThan(1000);
  await expect(page.getByRole('button', { name: '영수증 첨부 PDF', exact: true })).toBeEnabled();
  expect(pageErrors).toEqual([]); expect(remoteCalls).toEqual([]);
});

test('결손 원본은 불완전한 PDF를 내려받지 않고 같은 파일을 재연결한 뒤 복구한다', async ({ page }, testInfo) => {
  const { imageSource, pageErrors, remoteCalls } = await setup(page, 'missing');
  const downloads: string[] = [];
  page.on('download', download => downloads.push(download.suggestedFilename()));
  await page.getByRole('button', { name: '영수증 첨부 PDF', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(/원본|연결/);
  await expect(page.getByRole('button', { name: '영수증 첨부 PDF', exact: true })).toBeEnabled();
  expect(downloads).toEqual([]);
  await page.getByRole('button', { name: '학급 문구점 지출 수정', exact: true }).click();
  await page.getByLabel('기존 영수증 원본 다시 연결').setInputFiles({ name: imageSource.name, mimeType: imageSource.mimeType, buffer: Buffer.from(imageSource.base64, 'base64') });
  await expect(page.getByRole('status').filter({ hasText: '원본을 다시 연결했습니다.' })).toBeVisible();
  await page.getByRole('tab', { name: /정산내역/ }).click();
  const path = await downloadFile(page, testInfo, '영수증 첨부 PDF', 'pdf');
  expect((await renderDownloadedPdf(page, testInfo, path))).toHaveLength(2);
  expect(downloads).toHaveLength(1);
  expect(pageErrors).toEqual([]); expect(remoteCalls).toEqual([]);
});

test('손상된 영수증은 PDF 실패를 안내하고 Excel은 계속 내려받을 수 있다', async ({ page }, testInfo) => {
  const { pageErrors, remoteCalls } = await setup(page, 'corrupt');
  const downloads: string[] = [];
  page.on('download', download => downloads.push(download.suggestedFilename()));
  await page.getByRole('button', { name: '영수증 첨부 PDF', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(/원본|영수증|이미지/);
  await expect(page.getByRole('button', { name: '영수증 첨부 PDF', exact: true })).toBeEnabled();
  expect(downloads).toEqual([]);
  const path = await downloadFile(page, testInfo, 'Excel 정산내역', 'xlsx');
  expect((await readSheet(path)).flat()).toContain(7000);
  expect(downloads).toHaveLength(1);
  expect(pageErrors).toEqual([]); expect(remoteCalls).toEqual([]);
});

test('증빙 없는 수기 지출도 PDF로 저장하고 모바일에 가로 넘침이 없다', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { pageErrors, remoteCalls } = await setup(page, 'manual');
  await expect(page.getByRole('button', { name: 'Excel 정산내역', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: '영수증 첨부 PDF', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath('export-ledger-mobile.png'), fullPage: true });
  const path = await downloadFile(page, testInfo, '영수증 첨부 PDF', 'pdf');
  const pages = await renderDownloadedPdf(page, testInfo, path);
  expect(pages).toHaveLength(1); expect(pages[0].ink).toBeGreaterThan(1000);
  expect(pageErrors).toEqual([]); expect(remoteCalls).toEqual([]);
});

test('반영된 지출이 없으면 미반영 후보·휴지통이 있어도 내보내기를 비활성화한다', async ({ page }) => {
  const { pageErrors, remoteCalls } = await setup(page, 'empty');
  await expect(page.getByRole('table')).toContainText('반영한 지출이 없습니다');
  await expect(page.getByRole('button', { name: 'Excel 정산내역', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '영수증 첨부 PDF', exact: true })).toBeDisabled();
  expect(pageErrors).toEqual([]); expect(remoteCalls).toEqual([]);
});

test('PDF 생성 중에는 두 내보내기 버튼을 잠그고 완료 후 다시 사용할 수 있다', async ({ page }, testInfo) => {
  const { pageErrors, remoteCalls } = await setup(page, 'manual');
  let releaseImport: () => void = () => {};
  const importGate = new Promise<void>(resolve => { releaseImport = resolve; });
  let importStarted = false;
  await page.route('**/src/features/classBudgetReceipts/receiptExportPdf.ts*', async route => {
    importStarted = true; await importGate; await route.continue();
  });
  const downloading = page.waitForEvent('download');
  try {
    await page.getByRole('button', { name: '영수증 첨부 PDF', exact: true }).click();
    await expect.poll(() => importStarted).toBe(true);
    await expect(page.getByRole('button', { name: 'Excel 정산내역', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: '영수증 첨부 PDF', exact: true })).toBeDisabled();
    await expect(page.getByRole('status')).toBeVisible();
  } finally { releaseImport(); }
  const download = await downloading;
  await download.saveAs(testInfo.outputPath(download.suggestedFilename()));
  await expect(page.getByRole('button', { name: 'Excel 정산내역', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: '영수증 첨부 PDF', exact: true })).toBeEnabled();
  expect(pageErrors).toEqual([]); expect(remoteCalls).toEqual([]);
});

test('긴 제목·사용처·사용 목적과 40건의 지출을 여러 PDF 페이지에 이어서 출력한다', async ({ page }, testInfo) => {
  const { pageErrors, remoteCalls } = await setup(page, 'manual');
  const longTitle = '학급 운영비 장문 제목 검증 '.repeat(10).slice(0, 120);
  const longMerchant = '사용처 이름이 긴 학급 자료 상점 '.repeat(10).slice(0, 120);
  const longPurpose = '학생들이 함께 사용하는 학급 독서 활동 및 미술 수업 준비 자료를 구입하여 공동 교육활동에 활용합니다. '.repeat(8).slice(0, 300);
  const entries = Array.from({ length: 40 }, (_, index) => entry(
    'pagination-entry-' + index,
    new Date(Date.UTC(2026, 8, index + 1)).toISOString().slice(0, 10),
    index === 0 ? longMerchant : `학급 자료상점 ${index + 1}`,
    index === 0 ? longPurpose : `학급 활동 ${index + 1}회차 준비 자료`,
    (index + 1) * 100,
  ));
  await page.evaluate(({ ownerId, longTitle, entries }) => {
    const key = 'schooldoc_class_budget_receipts_v1:' + ownerId;
    const books = JSON.parse(localStorage.getItem(key)!);
    books[0].title = longTitle; books[0].entries = entries;
    localStorage.setItem(key, JSON.stringify(books));
    window.dispatchEvent(new Event('schooldoc-class-budget-receipts-change'));
  }, { ownerId: OWNER_ID, longTitle, entries });
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(40);
  await page.screenshot({ path: testInfo.outputPath('settlement-40-rows.png'), fullPage: true });
  await expect(page.getByRole('heading', { name: longTitle, exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: '예산 현황' })).toContainText('82,000원');
  const path = await downloadFile(page, testInfo, '영수증 첨부 PDF', 'pdf');
  const pages = await renderDownloadedPdf(page, testInfo, path);
  expect(pages.length).toBeGreaterThanOrEqual(2);
  for (const rendered of pages) {
    expect(rendered.width).toBeCloseTo(595.28, 0); expect(rendered.height).toBeCloseTo(841.89, 0);
    expect(rendered.ink).toBeGreaterThan(1000);
  }
  expect(pageErrors).toEqual([]); expect(remoteCalls).toEqual([]);
});

test('PDF 생성을 취소하면 파일을 저장하지 않으며 이어서 다시 내보낼 수 있다', async ({ page }, testInfo) => {
  const { pageErrors, remoteCalls } = await setup(page, 'manual');
  let releaseImport: () => void = () => {};
  const importGate = new Promise<void>(resolve => { releaseImport = resolve; });
  let importStarted = false;
  await page.route('**/src/features/classBudgetReceipts/receiptExportPdf.ts*', async route => {
    importStarted = true; await importGate; await route.continue();
  });
  const downloads: string[] = [];
  page.on('download', download => downloads.push(download.suggestedFilename()));
  try {
    await page.getByRole('button', { name: '영수증 첨부 PDF', exact: true }).click();
    await expect.poll(() => importStarted).toBe(true);
    await page.getByRole('button', { name: '내려받기 취소', exact: true }).click();
  } finally { releaseImport(); }
  await expect(page.getByRole('status')).toHaveText('내려받기를 취소했습니다.');
  await expect(page.getByRole('button', { name: 'Excel 정산내역', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: '영수증 첨부 PDF', exact: true })).toBeEnabled();
  expect(downloads).toEqual([]);
  await downloadFile(page, testInfo, '영수증 첨부 PDF', 'pdf');
  expect(downloads).toHaveLength(1);
  expect(pageErrors).toEqual([]); expect(remoteCalls).toEqual([]);
});

for (const fixture of [
  { label: '세로로 긴', width: 450, height: 3000, horizontal: false, positions: [100, 1400, 2750] },
  { label: '아래 여백이 큰', width: 450, height: 4200, horizontal: false, positions: [100, 500, 1100] },
  { label: '가로로 넓은', width: 3000, height: 450, horizontal: true, positions: [100, 1400, 2600] },
]) test(`${fixture.label} 영수증 사진 한 장을 자르거나 늘리지 않고 PDF 한 쪽에 보존한다`, async ({ page }, testInfo) => {
  const { pageErrors, remoteCalls } = await setup(page, 'manual');
  const base64 = await page.evaluate(fixture => {
    const canvas = document.createElement('canvas'); canvas.width = fixture.width; canvas.height = fixture.height;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
    const markers = [['#c82020', 'RECEIPT START'], ['#1446d2', 'RECEIPT MIDDLE'], ['#14a03c', 'RECEIPT END']];
    for (const [index, [color, label]] of markers.entries()) {
      const x = fixture.horizontal ? fixture.positions[index] : 40;
      const y = fixture.horizontal ? 100 : fixture.positions[index];
      context.fillStyle = color; context.fillRect(x, y, 370, 200);
      context.fillStyle = '#172b4d'; context.font = 'bold 24px sans-serif'; context.fillText(label, x, y - 20);
    }
    return canvas.toDataURL('image/png').split(',')[1];
  }, fixture);
  const source: SourceFile = { id: 'tall-receipt-source', name: `${fixture.label} 영수증.png`, mimeType: 'image/png', base64 };
  const tallEntry = entry('tall-receipt-entry', '2026-09-09', '긴 영수증 상점', '학급 준비 물품', 12000, [source.id]);
  const file = metadata(source, [tallEntry]);
  await page.evaluate(async ({ ownerId, bookId, source, file, tallEntry }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('schooldoc-receipt-originals-v1', 1);
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('originals', 'readwrite');
        const bytes = Uint8Array.from(atob(source.base64), char => char.charCodeAt(0));
        tx.objectStore('originals').put(new File([bytes], source.name, { type: source.mimeType }), JSON.stringify([ownerId, bookId, source.id]));
        tx.oncomplete = () => resolve(); tx.onerror = tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
    const key = 'schooldoc_class_budget_receipts_v1:' + ownerId;
    const books = JSON.parse(localStorage.getItem(key)!);
    books[0].entries = [tallEntry]; books[0].files = [file];
    localStorage.setItem(key, JSON.stringify(books));
    window.dispatchEvent(new Event('schooldoc-class-budget-receipts-change'));
  }, { ownerId: OWNER_ID, bookId: BOOK_ID, source, file, tallEntry });
  await expect(page.getByRole('table')).toContainText('긴 영수증 상점');
  const path = await downloadFile(page, testInfo, '영수증 첨부 PDF', 'pdf');
  const pages = await renderDownloadedPdf(page, testInfo, path);
  expect(pages).toHaveLength(2); // 지출대장 1쪽 + 사진 원본 1쪽
  for (const rendered of pages) {
    expect(rendered.width).toBeCloseTo(595.28, 0); expect(rendered.height).toBeCloseTo(841.89, 0);
    expect(rendered.ink).toBeGreaterThan(1000);
  }
  const evidencePage = pages[1];
  expect(evidencePage.red).toBeGreaterThan(1000);
  expect(evidencePage.blue).toBeGreaterThan(1000);
  expect(evidencePage.green).toBeGreaterThan(1000);
  expect(evidencePage.redWidth / evidencePage.redHeight).toBeCloseTo(370 / 200, 1);
  const excelPath = await downloadFile(page, testInfo, 'Excel 정산내역', 'xlsx');
  const exported = (await readSheet(excelPath)).find(row => row.includes('긴 영수증 상점'));
  expect(exported?.[3]).toBe('전산자료');
  expect(pageErrors).toEqual([]); expect(remoteCalls).toEqual([]);
});
