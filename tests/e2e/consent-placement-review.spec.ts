import { expect, test } from '@playwright/test';
import { jsPDF } from 'jspdf';

test('새 필드는 원본에 놓고 미리보기 확인 후에만 발행하며 모바일에서 확대해 읽는다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  pdf.text('Read the notice before choosing YES or NO', 20, 40);
  pdf.rect(70, 94, 5, 5); pdf.text('YES', 78, 98);
  pdf.rect(105, 94, 5, 5); pdf.text('NO', 113, 98);
  pdf.rect(70, 145, 95, 8); pdf.text('Parent name', 20, 150);

  await page.goto('/tools/consent-forms/new');
  await page.getByLabel('가정통신문 PDF 파일').setInputFiles({ name: 'fictional-consent.pdf', mimeType: 'application/pdf', buffer: Buffer.from(pdf.output('arraybuffer')) });
  await page.getByRole('button', { name: '확인 후 필드 배치' }).click();
  const canvas = page.getByTestId('consent-field-canvas');
  await expect(canvas.locator('[data-pdf-state="ready"]')).toBeVisible();
  const canvasBounds = (await canvas.boundingBox())!;
  expect(canvasBounds.width).toBeGreaterThan(650);
  const clickPdf = (xMillimeters: number, yMillimeters: number) => canvas.click({ position: {
    x: canvasBounds.width * xMillimeters / 210,
    y: canvasBounds.height * yMillimeters / 297,
  } });
  await page.getByRole('button', { name: '예 / 아니오 질문' }).click();
  await expect(page.getByRole('button', { name: '필드 배치 완료' })).toBeDisabled();
  await clickPdf(72.5, 96.5);
  await clickPdf(107.5, 96.5);
  await page.getByRole('button', { name: '텍스트', exact: true }).click();
  await page.getByRole('textbox', { name: '표시 이름' }).fill('보호자 성명');
  await page.getByText('크기와 위치').click();
  await page.getByLabel('너비', { exact: true }).fill('45');
  await page.getByLabel('높이', { exact: true }).fill('2.7');
  await clickPdf(117.5, 149);
  const placedCanvasBounds = (await canvas.boundingBox())!;
  const textBounds = (await canvas.getByRole('button', { name: '보호자 성명 필드', exact: true }).boundingBox())!;
  expect(Math.abs(textBounds.x - placedCanvasBounds.x - placedCanvasBounds.width * 70 / 210)).toBeLessThan(5);
  expect(Math.abs(textBounds.y - placedCanvasBounds.y - placedCanvasBounds.height * 145 / 297)).toBeLessThan(5);
  await expect(page.getByRole('button', { name: '필드 배치 완료' })).toBeEnabled();
  await page.screenshot({ path: test.info().outputPath('teacher-placed-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: '필드 배치 완료' }).click();
  await page.getByLabel('명단 없이 받기').check();
  await page.getByRole('button', { name: '다음: 공유 설정' }).click();
  await expect(page.getByRole('button', { name: '수합 만들기' })).toBeDisabled();
  await expect(page.getByLabel('보호자 성명 입력 위치')).toBeVisible();
  await page.getByRole('checkbox', { name: '원본의 입력칸과 회색 표시 위치를 확인했습니다.' }).check();
  await page.screenshot({ path: test.info().outputPath('teacher-final-preview-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: '수합 만들기' }).click();
  await page.getByRole('button', { name: '관리·공유' }).click();
  const link = await page.getByLabel('응답 화면 열기').getAttribute('href');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(link!);
  await expect(page.locator('section[aria-label="1쪽"] [data-pdf-state="ready"]')).toBeVisible();
  const originalWidth = (await page.locator('section[aria-label="1쪽"]').boundingBox())!.width;
  await page.getByRole('button', { name: '원본 확대' }).click();
  await page.getByRole('button', { name: '원본 확대' }).click();
  expect((await page.locator('section[aria-label="1쪽"]').boundingBox())!.width).toBeGreaterThan(originalWidth * 1.9);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.screenshot({ path: test.info().outputPath('parent-zoom-mobile.png'), fullPage: true });
  const enlargedPage = page.getByRole('region', { name: '1쪽 원본 확대 영역' });
  await enlargedPage.focus();
  await enlargedPage.press('ArrowRight');
  await expect.poll(() => enlargedPage.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
  await page.setViewportSize({ width: 600, height: 900 });
  const viewportWidth = (await enlargedPage.boundingBox())!.width;
  expect((await page.locator('section[aria-label="1쪽"]').boundingBox())!.width).toBeGreaterThan(viewportWidth * 1.9);
  await page.screenshot({ path: test.info().outputPath('parent-zoom-wide-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '입력 시작' }).click();
  await page.getByRole('radio', { name: '아니오', exact: true }).check();
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await page.getByRole('textbox', { name: '보호자 성명' }).fill('가상 보호자');
  await page.getByRole('button', { name: '원본 축소' }).click();
  await expect(page.getByRole('textbox', { name: '보호자 성명' })).toHaveValue('가상 보호자');
});

test('교사 편집 중 두 번째 원본 쪽 표시 실패는 진행을 막고 재시도할 수 있다', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    Reflect.set(window, '__failTeacherPdf', true);
    HTMLCanvasElement.prototype.getContext = function (...args: unknown[]) {
      const pageInput = document.querySelector<HTMLInputElement>('input[aria-label="쪽 번호"]');
      if (Reflect.get(window, '__failTeacherPdf') && this.closest('[data-field-canvas]') && pageInput?.value === '2') {
        throw new Error('private-render-failure');
      }
      return Reflect.apply(original, this, args);
    } as typeof original;
  });
  const pdf = new jsPDF();
  pdf.text('First page', 20, 30);
  pdf.addPage(); pdf.text('Second page', 20, 30);
  await page.goto('/tools/consent-forms/new');
  await page.getByLabel('가정통신문 PDF 파일').setInputFiles({ name: 'fictional-two-page.pdf', mimeType: 'application/pdf', buffer: Buffer.from(pdf.output('arraybuffer')) });
  await page.getByRole('button', { name: '확인 후 필드 배치' }).click();
  const canvas = page.getByTestId('consent-field-canvas');
  await expect(canvas.locator('[data-pdf-state="ready"]')).toBeVisible();
  await page.getByRole('button', { name: '텍스트', exact: true }).click();
  await canvas.click({ position: { x: 300, y: 400 } });
  await page.getByRole('button', { name: '다음 쪽' }).click();
  await expect(canvas.locator('[data-pdf-state="error"]')).toBeVisible();
  await expect(page.getByRole('button', { name: '필드 배치 완료' })).toBeDisabled();
  await expect(page.getByText('private-render-failure')).toHaveCount(0);
  await page.evaluate(() => Reflect.set(window, '__failTeacherPdf', false));
  await canvas.getByRole('button', { name: '다시 시도' }).click();
  await expect(canvas.locator('[data-pdf-state="ready"]')).toBeVisible();
  await expect(page.getByRole('button', { name: '필드 배치 완료' })).toBeEnabled();
});
