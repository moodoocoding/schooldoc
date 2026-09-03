import { expect, test, type Page } from '@playwright/test';
import { jsPDF } from 'jspdf';

const reset = async (page: Page) => page.addInitScript(() => {
  for (const key of Object.keys(localStorage)) if (key.startsWith('schooldoc_class_budget_receipts_v1:')) localStorage.removeItem(key);
});

const createBook = async (page: Page) => {
  await page.goto('/');
  await page.getByRole('button', { name: /학급 운영비 영수증 시작하기/ }).click();
  await page.getByRole('button', { name: '새 장부 만들기' }).click();
  await page.getByLabel('학급').fill('5학년 2반');
  await page.getByLabel('전체 예산').fill('500000');
  await page.getByRole('button', { name: '장부 만들기' }).click();
};

test.describe('학급 운영비 영수증', () => {
  test.beforeEach(async ({ page }) => reset(page));

  test('업로드하면 파일 선택과 중복 안내를 숨기고 분석값을 바로 채운다', async ({ page }) => {
    await createBook(page);
    const pdf = new jsPDF();
    pdf.text('CENTRAL STATIONERY', 25, 35);
    pdf.text('DATE 2026-09-02', 25, 50);
    pdf.text('TOTAL 32,500', 25, 60);
    await page.getByLabel('영수증 증빙 파일').setInputFiles({ name: 'receipt.pdf', mimeType: 'application/pdf', buffer: Buffer.from(pdf.output('arraybuffer')) });

    const files = page.getByRole('region', { name: '영수증 파일 올리기' });
    await expect(files.getByRole('button', { name: '영수증 파일 선택' })).toHaveCount(0);
    await expect(page.getByText('다음: 자동 분석 결과를 확인·수정하세요')).toHaveCount(0);
    await expect(files).toContainText('자동 분석 완료');
    await expect(page.getByLabel('사용 날짜')).toHaveValue('2026-09-02');
    await expect(page.getByLabel('사용처')).toHaveValue('CENTRAL STATIONERY');
    await expect(page.getByLabel('금액')).toHaveValue('32500');
    await page.getByLabel('사용 목적').fill('미술 활동 재료');
    await page.getByRole('button', { name: '이 지출을 장부에 반영' }).click();
    await expect(page.getByRole('button', { name: '영수증 파일 선택' })).toBeVisible();
    await expect(page.getByText('남음 467,500원')).toHaveCount(0);
    await expect(page.getByText('467,500원')).toBeVisible();
  });
});
