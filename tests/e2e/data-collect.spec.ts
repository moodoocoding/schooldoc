import { expect, test } from '@playwright/test';

test('배포 파일을 확인하고 이상 없음 또는 수정본으로 회신한다', async ({ page }) => {
  await page.goto('/tools/data-collect/new');
  await page.getByLabel('제목').fill('2학기 평가 문항 검토');
  await page.getByLabel('안내').fill('배포한 문항을 확인하고 이상 여부를 회신해 주세요.');
  await page.locator('input[type="file"]').first().setInputFiles({
    name: '평가문항.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7\n%%EOF'),
  });
  await page.getByLabel('1번 과목').fill('국어');
  await page.getByLabel('1번 담당자').fill('김하늘');
  await page.getByRole('button', { name: '자료 수합 만들기' }).click();

  await expect(page.getByRole('heading', { name: '2학기 평가 문항 검토' })).toBeVisible();
  await expect(page.getByText('미확인', { exact: true })).toBeVisible();
  const publicUrl = await page.getByLabel('자료 수합 공개 링크').inputValue();

  await page.goto(publicUrl);
  await page.getByPlaceholder(/과목 또는 담당자/).fill('국어');
  await page.getByRole('button', { name: /국○/ }).click();
  await expect(page.getByRole('link', { name: /평가문항.pdf 내려받기/ })).toBeVisible();
  await page.getByRole('button', { name: '이상 없음' }).click();
  await page.getByRole('button', { name: '회신 제출' }).click();
  await expect(page.getByRole('heading', { name: '회신을 제출했습니다' })).toBeVisible();

  await page.getByRole('button', { name: '다시 회신하기' }).click();
  await page.getByRole('button', { name: '수정본 제출' }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: '평가문항_수정.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7\ncorrected\n%%EOF'),
  });
  await page.getByLabel('전달 사항').fill('3번 문항의 표현을 고쳤습니다.');
  await page.getByRole('button', { name: '새 버전으로 회신' }).click();
  await expect(page.getByText('수정본 제출')).toBeVisible();

  await page.goto('/tools/data-collect');
  await page.getByRole('button', { name: /2학기 평가 문항 검토/ }).click();
  await expect(page.getByText('수정본 제출', { exact: true })).toHaveCount(2);
  await expect(page.getByRole('link', { name: '평가문항_수정.pdf' })).toBeVisible();
  await expect(page.getByText(/2차/)).toBeVisible();
});
