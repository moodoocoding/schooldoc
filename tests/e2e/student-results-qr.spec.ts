import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const seedQrEvent = async (page: Page, count: number, longText = false) => {
  await page.goto('/tools/student-results');
  const eventId = await page.evaluate(async ({ count, longText }) => {
    const store = await import('/src/features/studentResults/studentResultsStore.ts');
    const event = store.createStudentResultEvent('local-demo-teacher', {
      title: '가상 학생 QR 배부 검증', description: '', allowConfirmation: true, allowDispute: true,
      columns: [{ id: 'score', label: '평가', maxScore: 100, description: '' }],
      recipients: Array.from({ length: count }, (_, index) => ({
        name: longText ? '가'.repeat(99) + String(index + 1) : `가상학생${index + 1}`,
        studentKey: longText ? '나'.repeat(99) + String(index + 1) : String(index + 1),
        verificationCode: String(4000 + index), values: { score: 80 }, feedback: '',
      })),
    });
    return event.id;
  }, { count, longText });
  await page.goto(`/tools/student-results/${eventId}/qr-print`);
  await expect(page.getByRole('button', { name: 'PDF 다운로드' })).toBeEnabled();
};

const assertCardsFit = async (page: Page) => {
  const problems = await page.getByTestId('student-result-qr-card').evaluateAll((cards) => cards.flatMap((card) => {
    const page = card.closest('[data-testid="student-result-qr-page"]')!;
    const footer = page.querySelector('footer')!;
    const name = card.querySelector('[data-testid="student-result-qr-name"]')!;
    const key = card.querySelector('[data-testid="student-result-qr-key"]')!;
    const qr = card.querySelector('[data-testid="student-result-qr-code"]')!;
    const caption = card.lastElementChild!;
    const box = card.getBoundingClientRect();
    const qrBox = qr.getBoundingClientRect();
    return [
      qrBox.width !== 116 || qrBox.height !== 116 ? 'QR 축소' : '',
      key.getBoundingClientRect().top < name.getBoundingClientRect().bottom ? '이름과 식별값 겹침' : '',
      qrBox.top < key.getBoundingClientRect().bottom ? '식별값과 QR 겹침' : '',
      caption.getBoundingClientRect().bottom > box.bottom + 1 ? '카드 하단 잘림' : '',
      box.bottom > footer.getBoundingClientRect().top + 1 ? '쪽번호 겹침' : '',
    ].filter(Boolean);
  }));
  expect(problems).toEqual([]);
};

test('개인 QR은 해당 학생 링크를 담은 1024px PNG로 저장된다', async ({ context, page }, testInfo) => {
  await seedQrEvent(page, 2);
  const originalQr = await page.getByTestId('student-result-qr-code').first().locator('svg').evaluate((svg) => svg.innerHTML);
  const nextQr = await page.getByTestId('student-result-qr-code').nth(1).locator('svg').evaluate((svg) => svg.innerHTML);
  expect(originalQr).not.toBe(nextQr);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '1 가상학생1 학생 QR 이미지 저장' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^1_가상학생1_.*개인QR_[0-9a-f-]+\.png$/);
  const file = testInfo.outputPath('individual-qr.png');
  await download.saveAs(file);
  const png = await readFile(file);
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  expect(png.readUInt32BE(16)).toBeGreaterThanOrEqual(1024);
  expect(png.readUInt32BE(20)).toBeGreaterThanOrEqual(1024);
  const target = await page.evaluate(() => {
    const event = JSON.parse(localStorage.getItem('schooldoc_student_results_v1')!)[0];
    return `/s/results/${event.publicToken}?recipient=${event.recipients[0].personalToken}`;
  });
  const student = await context.newPage();
  await student.goto(target);
  await expect(student.getByText('가상학생1 · 1', { exact: true })).toBeVisible();
  // PNG도 같은 SVG를 복제해 만들며 저장 버튼의 아이콘 SVG가 선택되지 않는다.
  await expect(page.getByTestId('student-result-qr-code').first().locator('svg')).toHaveCount(1);
});

test('일반 17명은 8·8·1명 배치를 유지하고 PDF에 PNG 버튼이 없다', async ({ page }, testInfo) => {
  await seedQrEvent(page, 17);
  const sheets = page.getByTestId('student-result-qr-page');
  await expect(sheets).toHaveCount(3);
  expect(await sheets.evaluateAll((pages) => pages.map((page) => page.querySelectorAll('[data-testid="student-result-qr-card"]').length))).toEqual([8, 8, 1]);
  await assertCardsFit(page);
  await page.screenshot({ path: testInfo.outputPath('qr-desktop-17.png'), fullPage: true });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PDF 다운로드' }).click();
  const download = await downloadPromise;
  const file = testInfo.outputPath('qr-normal-17.pdf');
  await download.saveAs(file);
  const pdf = await readFile(file);
  expect(pdf.toString('latin1').match(/\/Type \/Page\b/g)).toHaveLength(3);
  await page.emulateMedia({ media: 'print' });
  for (const button of await page.getByRole('button', { name: /학생 QR 이미지 저장/ }).all()) await expect(button).toBeHidden();
  await assertCardsFit(page);
});

test('100자 이름과 식별값 8명은 모든 글자와 QR을 보존해 A4에 배치한다', async ({ page }, testInfo) => {
  await seedQrEvent(page, 8, true);
  await expect(page.getByTestId('student-result-qr-page')).toHaveCount(2);
  await expect(page.getByTestId('student-result-qr-name').first()).toHaveText('가'.repeat(99) + '1');
  await expect(page.getByTestId('student-result-qr-key').first()).toHaveText('나'.repeat(99) + '1');
  await assertCardsFit(page);
  await page.screenshot({ path: testInfo.outputPath('qr-desktop-long-8.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await assertCardsFit(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({ path: testInfo.outputPath('qr-mobile-long-8.png'), fullPage: true });
  const preview = page.getByRole('region', { name: '개인 QR A4 미리보기' });
  await preview.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => preview.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  await preview.evaluate((element) => { element.scrollLeft = 0; });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PDF 다운로드' }).click();
  const download = await downloadPromise;
  const file = testInfo.outputPath('qr-long-8.pdf');
  await download.saveAs(file);
  const pdf = await readFile(file);
  expect(pdf.toString('latin1').match(/\/Type \/Page\b/g)).toHaveLength(2);
});
