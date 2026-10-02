import { expect, test, type Page } from '@playwright/test';

async function createVirtualClass(page: Page, count = 24) {
  const rows = Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    const name = number === count ? '긴성명'.repeat(20) : `가상학생${String(number).padStart(2, '0')}`;
    const studentKey = number === count ? '긴식별값-'.repeat(12) : String(20100 + number);
    return `${studentKey},${name},${4000 + number},${80 + number % 10},${85 + number % 10},평가 결과를 확인해 주세요.`;
  });
  await page.goto('/tools/student-results/new');
  await page.getByTestId('student-results-file-input').setInputFiles({
    name: '가상학급.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from([
      '모바일 관리 확인,,,,,',
      '학번,성명,확인번호,국어/100,수학/100,피드백',
      ...rows,
    ].join('\n'), 'utf8'),
  });
  await page.getByRole('button', { name: '분석 결과 적용' }).click();
  await page.getByRole('button', { name: '결과 안내 만들기' }).click();
  await expect(page).toHaveURL(/\/tools\/student-results\/[0-9a-f-]+$/);
  await expect(page.getByRole('heading', { name: `학생 현황 (${count}명)` })).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page) {
  const width = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }));
  expect(width.document).toBe(width.viewport);
}

test('모바일 학생 카드에서 답변과 정정을 하고 화면 폭을 바꿔도 답변 초안이 유지된다', async ({ page, context }) => {
  await createVirtualClass(page);
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByRole('row')).toHaveCount(25);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('table')).toHaveCount(0);
  const cards = page.getByTestId('student-results-status-cards');
  await expect(cards.getByRole('article')).toHaveCount(24);
  await expectNoHorizontalOverflow(page);

  await page.getByRole('tab', { name: '접속 정보' }).click();
  const publicLink = await page.getByRole('link', { name: '학생 화면 열기' }).getAttribute('href');
  await page.getByRole('tab', { name: '현황' }).click();
  const studentPage = await context.newPage();
  await studentPage.goto(publicLink!);
  await studentPage.getByLabel('성명').fill('가상학생01');
  await studentPage.getByLabel('확인번호').fill('4001');
  await studentPage.getByRole('button', { name: '내 결과 조회' }).click();
  await studentPage.getByLabel('이의 내용').fill('점수 산출표를 확인해 주세요.');
  await studentPage.getByRole('button', { name: '이의 제출' }).click();
  await expect(studentPage.getByText('내가 보낸 이의')).toBeVisible();

  const card = cards.getByRole('article', { name: '가상학생01 학생 현황', exact: true });
  await expect(card.getByText('이의', { exact: true })).toBeVisible();
  const replyInput = page.getByRole('textbox', { name: '가상학생01 학생에게 보낼 답변' });
  await replyInput.fill('산출표 대조를 마쳤습니다.');
  await page.setViewportSize({ width: 1366, height: 900 });
  await expect(page.getByRole('table')).toBeVisible();
  await expect(replyInput).toHaveCount(1);
  await expect(replyInput).toHaveValue('산출표 대조를 마쳤습니다.');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(replyInput).toHaveCount(1);
  await expect(replyInput).toHaveValue('산출표 대조를 마쳤습니다.');
  await card.getByRole('button', { name: '가상학생01 학생의 이의에 답변' }).click();
  await expect(card).toContainText('재확인 필요');
  await expect(card).toContainText('산출표 대조를 마쳤습니다.');

  await card.getByRole('button', { name: '가상학생01 학생 결과 정정' }).click();
  const correction = page.getByRole('dialog');
  await correction.getByLabel('국어 / 100').fill('95');
  await correction.getByLabel('수정 사유').fill('채점표 재대조');
  await correction.getByRole('button', { name: '결과 정정 저장' }).click();
  await expect(correction).toHaveCount(0);
  await expect(card).toContainText('95 / 100');
  await expect(card).toContainText('재확인 필요');
  await expectNoHorizontalOverflow(page);
});

test('모바일 접속 카드가 확인번호를 가리고 검색·QR 선택·재발급과 데스크톱 전환을 지원한다', async ({ page }) => {
  await createVirtualClass(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('tab', { name: '접속 정보' }).click();
  const cards = page.getByTestId('student-results-access-cards');
  await expect(cards.getByRole('article')).toHaveCount(24);
  await expect(page.getByRole('table')).toHaveCount(0);
  const first = cards.getByRole('article', { name: '가상학생01 접속 정보', exact: true });
  await expect(first).toContainText('••••');
  await expect(first.getByText('4001', { exact: true })).toHaveCount(0);
  await first.getByRole('button', { name: '가상학생01 확인번호 보기' }).click();
  await expect(first.getByText('4001', { exact: true })).toBeVisible();
  await first.getByRole('button', { name: '가상학생01 확인번호 숨기기' }).click();
  await expect(first.getByText('4001', { exact: true })).toHaveCount(0);
  await expect(first.getByRole('button', { name: '가상학생01 개인 링크 복사' })).toBeVisible();
  await first.getByRole('checkbox', { name: '가상학생01 선택' }).check();
  await page.getByRole('textbox', { name: '접속 정보 학생 검색' }).fill('가상학생02');
  await expect(cards.getByRole('article')).toHaveCount(1);
  await page.getByRole('checkbox', { name: '검색 결과 학생 전체 선택' }).check();
  await expect(page.getByRole('button', { name: '선택 QR PDF (2명)' })).toBeEnabled();
  await page.getByRole('textbox', { name: '접속 정보 학생 검색' }).fill('검색 결과 없음');
  await expect(page.getByText('조건에 맞는 학생이 없습니다. 검색어를 변경해 주세요.')).toBeVisible();
  await page.getByRole('textbox', { name: '접속 정보 학생 검색' }).fill('');
  await page.setViewportSize({ width: 1366, height: 900 });
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: '가상학생01 선택' })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: '가상학생02 선택' })).toBeChecked();
  await page.setViewportSize({ width: 390, height: 844 });

  await first.getByRole('button', { name: '가상학생01 학생의 개인 링크 재발급' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: '취소' }).click();
  await expect(page.getByRole('checkbox', { name: '가상학생01 선택' })).toBeChecked();
  await first.getByRole('button', { name: '가상학생01 학생의 개인 링크 재발급' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: '링크 재발급', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '가상학생01 학생의 개인 링크를 재발급했습니다.' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.getByRole('button', { name: '선택 QR PDF (2명)' }).click();
  await expect(page).toHaveURL(/\/qr-print\?recipient=.*&recipient=/);
  await expect(page.getByTestId('student-result-qr-card')).toHaveCount(2);
});
