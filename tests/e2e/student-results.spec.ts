import { expect, test } from '@playwright/test';
import writeXlsxFile from 'write-excel-file/node';

test('교사 생성부터 학생 이의와 재확인까지 로컬 흐름이 이어진다', async ({ context, page }) => {
  await page.goto('/tools/student-results');
  await page.getByRole('button', { name: '새 결과 안내' }).click();

  await page.getByPlaceholder('예: 2학기 수행평가 결과').fill('2학기 수행평가 결과');
  await page.getByPlaceholder('학생에게 보여줄 안내').fill('평가 결과를 확인해 주세요.');
  await page.getByLabel('평가 점수 배점').fill('');
  await expect(page.getByLabel('평가 점수 배점')).toHaveValue('');
  await page.getByLabel('평가 점수 배점').fill('100');
  await page.getByLabel('1번 학생 성명').fill('김하늘');
  await page.getByLabel('1번 학생 확인번호').fill('4821');
  await page.getByLabel('1번 학생 평가 점수 점수').fill('0');
  await page.getByLabel('1번 학생 평가 점수 점수').fill('');
  await expect(page.getByLabel('1번 학생 평가 점수 점수')).toHaveValue('');
  await page.getByLabel('1번 학생 평가 점수 점수').fill('92');
  await page.getByLabel('1번 학생 피드백').fill('준비가 충실합니다.');
  await page.getByRole('button', { name: '결과 안내 만들기' }).click();

  await expect(page).toHaveURL(/\/tools\/student-results\/[0-9a-f-]+$/);
  await expect(page.getByRole('heading', { name: '학생 현황 (1명)' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '확인번호' })).toHaveCount(0);
  await page.getByRole('tab', { name: '접속 정보' }).click();
  await expect(page.getByRole('columnheader', { name: '확인번호' })).toBeVisible();
  await expect(page.getByRole('row', { name: /김하늘/ })).toContainText('••••');
  await page.getByRole('button', { name: '김하늘 확인번호 보기' }).click();
  await expect(page.getByRole('row', { name: /김하늘/ })).toContainText('4821');
  await expect(page.getByRole('button', { name: '김하늘 확인번호 복사' })).toBeVisible();
  const publicLink = await page.getByRole('link', { name: '학생 화면 열기' }).getAttribute('href');
  expect(publicLink).toBeTruthy();
  expect(publicLink).not.toContain('4821');
  await page.getByRole('tab', { name: '현황' }).click();

  const studentPage = await context.newPage();
  await studentPage.goto(publicLink!);
  await studentPage.getByLabel('성명').fill('김하늘');
  await studentPage.getByLabel('확인번호').fill('4821');
  await studentPage.getByRole('button', { name: '내 결과 조회' }).click();
  await expect(studentPage.getByText('92 / 100').first()).toBeVisible();
  await expect(page.getByRole('row', { name: /김하늘/ })).toContainText('조회');

  await studentPage.getByLabel('이의 내용').fill('점수 산출 내역을 확인해 주세요.');
  await studentPage.getByRole('button', { name: '이의 제출' }).click();
  await expect(page.getByRole('row', { name: /김하늘/ })).toContainText('이의');

  await page.getByPlaceholder('교사 답변').fill('산출 내역을 다시 확인했습니다.');
  await page.getByRole('button', { name: '답변' }).click();
  await expect(page.getByRole('row', { name: /김하늘/ })).toContainText('재확인 필요');

  await studentPage.reload();
  await studentPage.getByLabel('성명').fill('김하늘');
  await studentPage.getByLabel('확인번호').fill('4821');
  await studentPage.getByRole('button', { name: '내 결과 조회' }).click();
  await expect(studentPage.getByText('산출 내역을 다시 확인했습니다.')).toBeVisible();
  await studentPage.getByRole('button', { name: '내용 확인 완료' }).click();
  await expect(page.getByRole('row', { name: /김하늘/ })).toContainText('확인');

  await studentPage.setViewportSize({ width: 390, height: 844 });
  const width = await studentPage.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(width.document).toBe(width.viewport);

  await page.getByRole('tab', { name: '접속 정보' }).click();
  await page.getByRole('checkbox', { name: '김하늘 선택' }).check();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('tab', { name: '현황' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '접속 정보' })).toBeVisible();
  const manageWidth = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(manageWidth.document).toBe(manageWidth.viewport);
  await page.getByRole('button', { name: '선택 QR PDF (1명)' }).click();
  await expect(page).toHaveURL(/\/tools\/student-results\/[0-9a-f-]+\/qr-print\?recipient=/);
  await expect(page.getByRole('heading', { name: '개인 QR PDF' })).toBeVisible();
  await expect(page.getByText('선택 1명 · PDF A4 세로')).toBeVisible();
  await expect(page.getByTestId('student-result-qr-card')).toHaveCount(1);
  // QR만 세야 한다. 카드에는 이미지 저장 버튼의 아이콘도 svg로 들어 있다.
  await expect(page.locator('[id^="student-result-qr-"] svg')).toHaveCount(1);
  const qrPdfDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PDF 다운로드' }).click();
  const downloadedQrPdf = await qrPdfDownload;
  expect(downloadedQrPdf.suggestedFilename()).toBe('2학기 수행평가 결과_개인QR.pdf');
  const pdfStream = await downloadedQrPdf.createReadStream();
  const pdfChunks: Buffer[] = [];
  for await (const chunk of pdfStream) pdfChunks.push(Buffer.from(chunk));
  const pdfBuffer = Buffer.concat(pdfChunks);
  expect(pdfBuffer.subarray(0, 5).toString()).toBe('%PDF-');
  expect(pdfBuffer.toString('latin1').match(/\/Type \/Page\b/g)).toHaveLength(1);
});

test('시트의 안내와 뒤섞인 열을 분석해 세 입력 영역을 채운다', async ({ page }) => {
  await page.goto('/tools/student-results/new');
  await page.getByLabel('학생 결과 엑셀 파일').setInputFiles({
    name: '2학기_평가결과.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from([
      '2026학년도 2학기 수행평가 결과,,,,,',
      '안내: 결과를 확인해 주세요.,,,,,',
      ',,,,,',
      '피드백,확인번호,발표(20점),성명,학번,협업/10',
      '준비가 충실합니다.,4821,18,김하늘,10101,9',
      '의견을 잘 나눕니다.,5732,17,이도윤,10102,8',
    ].join('\n'), 'utf8'),
  });

  await expect(page.getByText('CSV · 머리글 4행 · 결과 항목 2개 · 학생 2명')).toBeVisible();
  await expect(page.getByPlaceholder('예: 2학기 수행평가 결과')).toHaveValue('');
  await page.getByRole('button', { name: '분석 결과 적용' }).click();
  await expect(page.getByPlaceholder('예: 2학기 수행평가 결과')).toHaveValue('2026학년도 2학기 수행평가 결과');
  await expect(page.getByPlaceholder('학생에게 보여줄 안내')).toHaveValue('안내: 결과를 확인해 주세요.');
  await expect(page.getByLabel('1번 항목명')).toHaveValue('발표');
  await expect(page.getByLabel('발표 배점')).toHaveValue('20');
  await expect(page.getByLabel('2번 항목명')).toHaveValue('협업');
  await expect(page.getByLabel('1번 학생 성명')).toHaveValue('김하늘');
  await expect(page.getByLabel('1번 학생 발표 점수')).toHaveValue('18');
  await expect(page.getByLabel('2번 학생 협업 점수')).toHaveValue('8');
  await page.getByRole('button', { name: '가져오기 취소' }).click();
  await expect(page.getByPlaceholder('예: 2학기 수행평가 결과')).toHaveValue('');
  await expect(page.getByLabel('1번 학생 성명')).toHaveValue('');
});

test('XLSX 파일을 읽어 학생 결과를 채운다', async ({ page }, testInfo) => {
  const filePath = testInfo.outputPath('학생결과.xlsx');
  await writeXlsxFile([
    ['2026학년도 진단평가 결과'],
    [],
    ['학번', '이름', '국어/100', '수학/100', '종합의견'],
    ['20101', '박서연', 88, 94, '수학 문제 해결력이 좋습니다.'],
  ]).toFile(filePath);

  await page.goto('/tools/student-results/new');
  await page.getByLabel('학생 결과 엑셀 파일').setInputFiles(filePath);

  await expect(page.getByText('Sheet1 · 머리글 3행 · 결과 항목 2개 · 학생 1명')).toBeVisible();
  await page.getByRole('button', { name: '분석 결과 적용' }).click();
  await expect(page.getByPlaceholder('예: 2학기 수행평가 결과')).toHaveValue('2026학년도 진단평가 결과');
  await expect(page.getByLabel('1번 학생 성명')).toHaveValue('박서연');
  await expect(page.getByLabel('1번 학생 국어 점수')).toHaveValue('88');
  await expect(page.getByLabel('1번 학생 수학 점수')).toHaveValue('94');
  await expect(page.getByLabel('1번 학생 피드백')).toHaveValue('수학 문제 해결력이 좋습니다.');
});

test('실수로 지운 학생 행을 Ctrl+Z와 되돌리기 버튼으로 살린다', async ({ page }) => {
  // 학급 하나를 손으로 채우는 화면이라, 한 번의 오조작으로 입력이 사라지면 처음부터 다시 쳐야 한다.
  await page.goto('/tools/student-results/new');
  await page.getByLabel('1번 학생 성명').fill('김하늘');
  await page.getByRole('button', { name: '학생 추가' }).click();
  await page.getByLabel('2번 학생 성명').fill('박도윤');
  await page.getByLabel('2번 학생 확인번호').fill('7315');

  await expect(page.getByRole('button', { name: '되돌리기' })).toBeDisabled();

  await page.getByRole('button', { name: '2번 학생 삭제' }).click();
  await expect(page.getByLabel('2번 학생 성명')).toHaveCount(0);

  await page.keyboard.press('ControlOrMeta+z');
  await expect(page.getByLabel('2번 학생 성명')).toHaveValue('박도윤');
  await expect(page.getByLabel('2번 학생 확인번호')).toHaveValue('7315');
  await expect(page.getByLabel('1번 학생 성명')).toHaveValue('김하늘');
  await expect(page.getByRole('button', { name: '되돌리기' })).toBeDisabled();

  // 단축키를 모르는 사람을 위해 버튼으로도 같은 일이 되어야 한다.
  await page.getByRole('button', { name: '2번 학생 삭제' }).click();
  await expect(page.getByLabel('2번 학생 성명')).toHaveCount(0);
  await page.getByRole('button', { name: '되돌리기' }).click();
  await expect(page.getByLabel('2번 학생 성명')).toHaveValue('박도윤');
});

test('입력칸 안에서 누른 Ctrl+Z는 글자 되돌리기로 남는다', async ({ page }) => {
  // 행 되돌리기가 브라우저의 글자 되돌리기를 빼앗으면 입력 중에 더 큰 혼란이 생긴다.
  await page.goto('/tools/student-results/new');
  await page.getByRole('button', { name: '학생 추가' }).click();
  await page.getByLabel('2번 학생 성명').fill('박도윤');
  await page.getByRole('button', { name: '2번 학생 삭제' }).click();
  await expect(page.getByRole('button', { name: '되돌리기' })).toBeEnabled();

  await page.getByLabel('1번 학생 성명').fill('김하늘');
  await page.getByLabel('1번 학생 성명').press('ControlOrMeta+z');

  // 지운 행은 그대로 남아 있고, 되돌리기는 아직 쓸 수 있어야 한다.
  await expect(page.getByLabel('2번 학생 성명')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '되돌리기' })).toBeEnabled();
});

test('결과 안내를 지우기 전에 함께 사라지는 것을 숫자로 알린다', async ({ page }) => {
  await page.goto('/tools/student-results/new');
  await page.getByPlaceholder('예: 2학기 수행평가 결과').fill('1학기 수행평가 결과');
  await page.getByLabel('1번 학생 성명').fill('김하늘');
  await page.getByLabel('1번 학생 확인번호').fill('4821');
  await page.getByLabel('1번 학생 평가 점수 점수').fill('92');
  await page.getByRole('button', { name: '결과 안내 만들기' }).click();
  await expect(page).toHaveURL(/\/tools\/student-results\/[0-9a-f-]+$/);

  await page.getByRole('button', { name: '목록으로' }).click();
  await page.getByRole('button', { name: '1학기 수행평가 결과 삭제' }).click();

  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('학생 1명의 점수와 피드백이 함께 지워집니다');
  await expect(dialog).toContainText('되돌릴 수 없');

  // 취소하면 아무것도 사라지지 않는다.
  await dialog.getByRole('button', { name: '취소' }).click();
  await expect(page.getByRole('heading', { name: '1학기 수행평가 결과' })).toBeVisible();

  await page.getByRole('button', { name: '1학기 수행평가 결과 삭제' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: '영구 삭제' }).click();
  await expect(page.getByRole('heading', { name: '아직 결과 안내가 없습니다' })).toBeVisible();
});

test('개인 QR을 한 명씩 이미지로 저장한다', async ({ page }) => {
  // 배부물 전체를 PDF로 받는 것과 별개로, QR 하나만 떼어 보낼 수 있어야 한다.
  await page.goto('/tools/student-results/new');
  await page.getByPlaceholder('예: 2학기 수행평가 결과').fill('QR 저장 확인');
  await page.getByLabel('1번 학생 성명').fill('김하늘');
  await page.getByLabel('1번 학생 확인번호').fill('4821');
  await page.getByLabel('1번 학생 평가 점수 점수').fill('92');
  await page.getByRole('button', { name: '결과 안내 만들기' }).click();
  await expect(page).toHaveURL(/\/tools\/student-results\/[0-9a-f-]+$/);

  await page.goto(`${page.url()}/qr-print`);
  const saveButton = page.getByRole('button', { name: '김하늘 학생 QR 이미지 저장' });
  await expect(saveButton).toBeVisible();

  const download = await Promise.all([
    page.waitForEvent('download'),
    saveButton.click(),
  ]).then(([event]) => event);

  expect(download.suggestedFilename()).toBe('QR 저장 확인_김하늘_개인QR.png');
  const path = await download.path();
  const { statSync } = await import('node:fs');
  expect(statSync(path!).size).toBeGreaterThan(1000);
});

test('학생이 결과를 열면 교사 표에 바로 반영된다', async ({ context, page }) => {
  // 갱신 중 화면이 비지 않는 규칙 자체는 studentResultsLoadState.test.ts가 지킨다.
  // 데모 모드는 즉시 끝나 로딩이 화면에 칠해지지 않으므로 여기서는 확인할 수 없다.
  await page.goto('/tools/student-results/new');
  await page.getByPlaceholder('예: 2학기 수행평가 결과').fill('갱신 확인');
  await page.getByLabel('1번 학생 성명').fill('김하늘');
  await page.getByLabel('1번 학생 확인번호').fill('4821');
  await page.getByLabel('1번 학생 평가 점수 점수').fill('92');
  await page.getByRole('button', { name: '결과 안내 만들기' }).click();
  await expect(page).toHaveURL(/\/tools\/student-results\/[0-9a-f-]+$/);

  await page.getByRole('tab', { name: '접속 정보' }).click();
  const publicLink = await page.getByRole('link', { name: '학생 화면 열기' }).getAttribute('href');
  await page.getByRole('tab', { name: '현황' }).click();
  const row = page.getByRole('row', { name: /김하늘/ });
  await expect(row).toBeVisible();

  const studentPage = await context.newPage();
  await studentPage.goto(publicLink!);
  await studentPage.getByLabel('성명').fill('김하늘');
  await studentPage.getByLabel('확인번호').fill('4821');
  await studentPage.getByRole('button', { name: '내 결과 조회' }).click();

  await expect(row).toContainText('조회');
  await expect(row).toBeVisible();
});
