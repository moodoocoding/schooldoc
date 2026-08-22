import { expect, test } from '@playwright/test';
import writeExcelFile from 'write-excel-file/node';

test('필요한 생성 입력만 보여주고 첫 오류로 이동한다', async ({ page }) => {
  await page.goto('/tools/data-collect/new');
  await page.getByRole('radio', { name: /제출자가 이름 입력/ }).check();
  await expect(page.getByRole('heading', { name: '제출 대상 명단' })).toHaveCount(0);

  await page.getByRole('button', { name: '자료 수합 만들고 링크 확인' }).click();
  await expect(page.getByText('수합 제목을 입력해 주세요.')).toBeVisible();
  await expect(page.getByLabel('제목')).toBeFocused();
});

test('붙여넣은 명단을 자동 분류하고 동명이인은 구분하게 한다', async ({ page }) => {
  await page.goto('/tools/data-collect/new');
  await page.getByLabel('명단 붙여넣기').evaluate((element, text) => {
    const clipboard = new DataTransfer();
    clipboard.setData('text/plain', text);
    element.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, clipboardData: clipboard }));
  }, '번호\t성명\t부서\n1\t김하늘\t연구부\n2\t박서준\t교무부\n3\t김하늘\t교육부');

  await expect(page.getByLabel('1번 제출 대상')).toHaveValue('김하늘');
  await expect(page.getByLabel('2번 제출 대상')).toHaveValue('박서준');
  await expect(page.getByLabel('3번 제출 대상')).toHaveValue('김하늘');
  await expect(page.getByLabel('1번 구분 정보')).toBeVisible();
  await expect(page.getByLabel('3번 구분 정보')).toBeVisible();
  await expect(page.getByText(/붙여넣기에서 3명을 반영했습니다/)).toBeVisible();
});

test('Excel의 성명 열을 자동 분석하고 사용자가 열을 바꿀 수 있다', async ({ page }) => {
  const workbook = await writeExcelFile([
    ['번호', '부서', '성명'],
    [1, '연구부', '김하늘'],
    [2, '교무부', '박서준'],
  ]).toBuffer();

  await page.goto('/tools/data-collect/new');
  await page.getByRole('radio', { name: 'Excel 불러오기' }).check();
  await page.locator('input[type="file"][accept=".xlsx"]').setInputFiles({
    name: '교직원명단.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: workbook,
  });

  await expect(page.getByLabel('이름으로 사용할 열')).toHaveValue('2');
  await expect(page.getByText(/2명 인식/)).toBeVisible();
  await page.getByLabel('이름으로 사용할 열').selectOption('1');
  await expect(page.getByText('1. 연구부')).toBeVisible();
  await page.getByLabel('이름으로 사용할 열').selectOption('2');
  await page.getByRole('button', { name: '명단 교체' }).click();
  await expect(page.getByLabel('1번 제출 대상')).toHaveValue('김하늘');
  await expect(page.getByLabel('2번 제출 대상')).toHaveValue('박서준');
});

test('배포 파일을 확인하고 이상 없음 또는 수정본으로 회신한다', async ({ page }) => {
  await page.goto('/tools/data-collect/new');
  await page.getByLabel('제목').fill('2학기 평가 문항 검토');
  await page.getByLabel('안내').fill('배포한 문항을 확인하고 이상 여부를 회신해 주세요.');
  await page.getByRole('radio', { name: /파일을 보내 검토받기/ }).check();
  await page.locator('input[type="file"][accept*=".pdf"]').setInputFiles({
    name: '평가문항.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7\n%%EOF'),
  });
  await page.getByRole('radio', { name: '직접 입력' }).check();
  await page.getByLabel('1번 제출 대상').fill('국어');
  await page.getByRole('button', { name: '자료 수합 만들고 링크 확인' }).click();

  await expect(page.getByRole('heading', { name: '2학기 평가 문항 검토' })).toBeVisible();
  await expect(page.getByText('미확인', { exact: true })).toBeVisible();
  const publicUrl = await page.getByLabel('자료 수합 공개 링크').inputValue();

  await page.goto(publicUrl);
  await page.getByPlaceholder(/제출 대상 이름/).fill('국어');
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

test('명단 없이 제출자가 이름을 입력해 자료를 제출한다', async ({ page }) => {
  await page.goto('/tools/data-collect/new');
  await page.getByLabel('제목').fill('명단 없는 자료 제출');
  await page.getByLabel('안내').fill('제출자 이름을 입력하고 자료를 올려 주세요.');
  await page.getByRole('radio', { name: /제출자가 이름 입력/ }).check();
  await page.getByRole('button', { name: '자료 수합 만들고 링크 확인' }).click();

  await expect(page.getByRole('heading', { name: '명단 없는 자료 제출' })).toBeVisible();
  const publicUrl = await page.getByLabel('자료 수합 공개 링크').inputValue();
  await page.goto(publicUrl);
  await page.getByLabel('제출자 이름').fill('김태호');
  await page.locator('input[type="file"]').setInputFiles({
    name: '제출자료.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7\n%%EOF'),
  });
  await page.getByRole('button', { name: '회신 제출' }).click();
  await expect(page.getByRole('heading', { name: '회신을 제출했습니다' })).toBeVisible();
  await page.getByRole('button', { name: '다시 회신하기' }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: '제출자료_수정.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7\ncorrected\n%%EOF'),
  });
  await page.getByRole('button', { name: '회신 제출' }).click();
  await expect(page.getByRole('heading', { name: '회신을 제출했습니다' })).toBeVisible();

  await page.goto('/tools/data-collect');
  await page.getByRole('button', { name: /명단 없는 자료 제출/ }).click();
  await expect(page.getByText('김태호')).toBeVisible();
  await expect(page.getByRole('cell', { name: '수정본 제출' })).toBeVisible();
  await expect(page.getByText(/2차/)).toBeVisible();
});
