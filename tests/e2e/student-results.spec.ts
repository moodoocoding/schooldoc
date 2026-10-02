import { expect, test } from '@playwright/test';
import { jsPDF } from 'jspdf';
import writeXlsxFile from 'write-excel-file/node';

test('수동 총점 저장·재조회와 안내 설정 정정 뒤 오래 열린 화면의 재확인을 보장한다', async ({ context, page }, testInfo) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/tools/student-results/new');
  await page.getByPlaceholder('예: 2학기 수행평가 결과').fill('가상 설정 정정 검사');
  await page.getByLabel('1번 항목명').fill('세부 점수');
  await page.getByLabel('세부 점수 배점').fill('50');
  await page.getByRole('button', { name: '항목 추가' }).click();
  await page.getByLabel('2번 항목명').fill('총점');
  await page.getByLabel('총점 배점').fill('100');
  await expect(page.getByLabel('총점 항목 종류')).toHaveValue('total');
  // Do not select the kind: renaming the manual column is the regression trigger.
  await page.getByLabel('1번 학생 성명').fill('가상하늘');
  await page.getByLabel('1번 학생 확인번호').fill('4821');
  await page.getByLabel('1번 학생 세부 점수 점수').fill('45');
  await page.getByLabel('1번 학생 총점 점수').fill('92');
  await page.getByRole('button', { name: '학생 추가' }).click();
  await page.getByLabel('2번 학생 성명').fill('가상바다');
  await page.getByLabel('2번 학생 확인번호').fill('5732');
  await page.getByLabel('2번 학생 세부 점수 점수').fill('40');
  await page.getByLabel('2번 학생 총점 점수').fill('87');
  await page.getByRole('button', { name: '결과 안내 만들기' }).click();
  await expect(page).toHaveURL(/\/tools\/student-results\/[0-9a-f-]+$/);
  await page.reload();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('schooldoc_student_results_v1')!)[0].columns[1].kind)).toBe('total');
  await page.getByRole('tab', { name: '접속 정보' }).click();
  const publicLink = await page.getByRole('link', { name: '학생 화면 열기' }).getAttribute('href');
  await page.getByRole('tab', { name: '현황' }).click();
  const student = await context.newPage();
  await student.setViewportSize({ width: 390, height: 844 });
  const staleStudent = await context.newPage();
  for (const [index, studentPage] of [student, staleStudent].entries()) {
    await studentPage.goto(publicLink!);
    await studentPage.getByLabel('성명').fill(index === 0 ? '가상하늘' : '가상바다');
    await studentPage.getByLabel('확인번호').fill(index === 0 ? '4821' : '5732');
    await studentPage.getByRole('button', { name: '내 결과 조회' }).click();
  }
  await expect(student.getByText('92 / 100').first()).toBeVisible();
  await student.getByRole('button', { name: '내용 확인 완료' }).click();
  const row = page.getByRole('row', { name: /가상하늘/ });
  await expect(row.getByText('확인', { exact: true })).toBeVisible();

  for (const field of ['label', 'maxScore', 'kind']) {
    await page.getByRole('button', { name: '안내 정보 수정' }).click();
    const dialog = page.getByRole('dialog');
    if (field === 'label') await dialog.getByLabel('2번 항목명').fill('정정 총점');
    if (field === 'maxScore') await dialog.getByLabel('배점', { exact: true }).nth(1).fill('200');
    if (field === 'kind') await dialog.getByRole('combobox').nth(1).selectOption('score');
    await dialog.getByRole('button', { name: '변경 저장' }).click();
    await expect(row).toContainText('재확인 필요');
    await staleStudent.getByRole('button', { name: '내용 확인 완료' }).click();
    await expect(staleStudent.getByRole('alert')).toContainText('최신 결과를 확인');
    await staleStudent.getByRole('button', { name: '최신 결과 확인' }).click();
    await student.getByRole('button', { name: '최신 결과 확인' }).focus();
    await student.getByRole('button', { name: '최신 결과 확인' }).press('Enter');
    await expect(student.getByText('수정된 결과나 선생님 답변을 확인한 뒤')).toBeVisible();
    await expect(student.getByText('정정 총점', { exact: true })).toBeVisible();
    if (field === 'maxScore') await expect(student.getByText('92 / 200').first()).toBeVisible();
    if (field === 'kind') await expect(student.getByText('137 / 250')).toBeVisible();
    if (field === 'kind') {
      await page.screenshot({ path: testInfo.outputPath('teacher-reconfirm-desktop.png'), fullPage: true });
      await student.screenshot({ path: testInfo.outputPath('student-reconfirm-mobile.png'), fullPage: true });
    }
    await student.getByRole('button', { name: '내용 확인 완료' }).click();
    await expect(student.getByText('결과 확인을 완료했습니다.')).toBeVisible();
    await expect(row.getByText('확인', { exact: true })).toBeVisible();
  }
  await student.screenshot({ path: testInfo.outputPath('student-confirmed-mobile.png'), fullPage: true });
  expect(await student.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

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
  await page.getByRole('button', { name: '김하늘 학생의 이의에 답변' }).click();
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
  const qrRecipientName = page.getByTestId('student-result-qr-name');
  await expect(qrRecipientName).toHaveText('김하늘');
  await expect(qrRecipientName).toHaveCSS('overflow-y', 'visible');
  await expect(page.getByRole('button', { name: /학생 QR 이미지 저장/ })).toHaveCount(1);
  await expect(page.getByTestId('student-result-qr-code').locator('svg')).toHaveCount(1);
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
  await expect(page.getByRole('heading', { name: '파일로 한 번에 채우기' })).toBeVisible();
  const fileSelectButton = page.getByRole('button', { name: '결과 파일 선택' });
  await page.getByRole('button', { name: '목록으로' }).focus();
  await page.keyboard.press('Tab');
  await expect(fileSelectButton).toBeFocused();
  const initialFileButtonBox = await fileSelectButton.boundingBox();
  const initialTitleBox = await page.getByPlaceholder('예: 2학기 수행평가 결과').boundingBox();
  expect(initialFileButtonBox!.y).toBeLessThan(initialTitleBox!.y);
  await page.getByTestId('student-results-file-input').setInputFiles({
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

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileFileButton = page.getByRole('button', { name: '결과 파일 선택' });
  await expect(mobileFileButton).toBeVisible();
  const mobileFileButtonBox = await mobileFileButton.boundingBox();
  const mobileTitleBox = await page.getByPlaceholder('예: 2학기 수행평가 결과').boundingBox();
  expect(mobileFileButtonBox!.y).toBeLessThan(mobileTitleBox!.y);
  expect(mobileFileButtonBox!.width).toBeGreaterThan(250);
  const mobileWidth = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }));
  expect(mobileWidth.document).toBe(mobileWidth.viewport);
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
  await page.getByTestId('student-results-file-input').setInputFiles(filePath);

  await expect(page.getByText('Sheet1 · 머리글 3행 · 결과 항목 2개 · 학생 1명')).toBeVisible();
  await page.getByRole('button', { name: '분석 결과 적용' }).click();
  await expect(page.getByPlaceholder('예: 2학기 수행평가 결과')).toHaveValue('2026학년도 진단평가 결과');
  await expect(page.getByLabel('1번 학생 성명')).toHaveValue('박서연');
  await expect(page.getByLabel('1번 학생 국어 점수')).toHaveValue('88');
  await expect(page.getByLabel('1번 학생 수학 점수')).toHaveValue('94');
  await expect(page.getByLabel('1번 학생 피드백')).toHaveValue('수학 문제 해결력이 좋습니다.');
});

test('전 과목 0점 학생은 동의를 받은 뒤에만 미응시자로 제외한다', async ({ page }) => {
  const importCsv = async () => {
    await page.getByTestId('student-results-file-input').setInputFiles({
      name: '미응시_포함.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from([
        '시험 결과,,,',
        '성명,국어/20,수학/20,확인번호',
        '김미응시,0,0,4821',
        '이응시,18,19,5732',
      ].join('\n'), 'utf8'),
    });
  };

  await page.goto('/tools/student-results/new');
  await importCsv();
  await expect(page.getByText('전 과목 점수가 0점이거나 비어 있는 학생 1명')).toBeVisible();
  await page.getByRole('button', { name: '분석 결과 적용' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('김미응시');
  await dialog.getByRole('button', { name: '확인 창 닫기' }).click();
  await expect(page.getByPlaceholder('예: 2학기 수행평가 결과')).toHaveValue('');

  await page.getByRole('button', { name: '분석 결과 적용' }).click();
  await page.getByRole('button', { name: '명단에 유지하고 적용' }).click();
  await expect(page.getByLabel('1번 학생 성명')).toHaveValue('김미응시');
  await expect(page.getByLabel('2번 학생 성명')).toHaveValue('이응시');

  await page.getByRole('button', { name: '가져오기 취소' }).click();
  await importCsv();
  await page.getByRole('button', { name: '분석 결과 적용' }).click();
  await page.getByRole('button', { name: '제외하고 적용' }).click();
  await expect(page.getByLabel('1번 학생 성명')).toHaveValue('이응시');
  await expect(page.getByLabel('2번 학생 성명')).toHaveCount(0);
  await expect(page.getByText('전 과목 점수가 0점 또는 미입력인 학생 1명을 미응시자로 제외했습니다')).toBeVisible();
});

test('텍스트 PDF의 안내와 결과 표를 분석해 입력 영역을 채운다', async ({ page }) => {
  const pdf = new jsPDF();
  pdf.text('2026 Semester Result', 15, 20);
  pdf.text('Please review your results.', 15, 30);
  pdf.text('id', 15, 45);
  pdf.text('name', 40, 45);
  pdf.text('accesscode', 75, 45);
  pdf.text('Math/100', 115, 45);
  pdf.text('feedback', 150, 45);
  pdf.text('30101', 15, 55);
  pdf.text('Kim Sky', 40, 55);
  pdf.text('4821', 75, 55);
  pdf.text('93', 115, 55);
  pdf.text('Good work', 150, 55);

  await page.goto('/tools/student-results/new');
  await page.getByTestId('student-results-file-input').setInputFiles({
    name: 'semester-result.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(pdf.output('arraybuffer')),
  });

  await expect(page.getByText('PDF 1쪽 · 머리글 3행 · 결과 항목 1개 · 학생 1명')).toBeVisible();
  await expect(page.getByText('PDF의 글자 위치를 바탕으로 표를 복원했습니다.')).toBeVisible();
  await page.getByRole('button', { name: '분석 결과 적용' }).click();
  await expect(page.getByPlaceholder('예: 2학기 수행평가 결과')).toHaveValue('2026 Semester Result');
  await expect(page.getByPlaceholder('학생에게 보여줄 안내')).toHaveValue('Please review your results.');
  await expect(page.getByLabel('1번 항목명')).toHaveValue('Math');
  await expect(page.getByLabel('Math 배점')).toHaveValue('100');
  await expect(page.getByLabel('1번 학생 성명')).toHaveValue('Kim Sky');
  await expect(page.getByLabel('1번 학생 Math 점수')).toHaveValue('93');
  await expect(page.getByLabel('1번 학생 피드백')).toHaveValue('Good work');
});

test('글자가 없는 스캔 PDF는 임의로 추측하지 않고 교체 방법을 안내한다', async ({ page }) => {
  const scannedPdf = new jsPDF();

  await page.goto('/tools/student-results/new');
  await page.getByTestId('student-results-file-input').setInputFiles({
    name: 'scanned-result.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(scannedPdf.output('arraybuffer')),
  });

  await expect(page.getByRole('alert')).toContainText('PDF에서 글자를 찾지 못했습니다.');
  await expect(page.getByRole('alert')).toContainText('텍스트를 선택할 수 있는 PDF나 엑셀 파일');
  await expect(page.getByPlaceholder('예: 2학기 수행평가 결과')).toHaveValue('');
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

test('총점·이의 작성 보호·교사 정정·학생 새로고침이 이어진다', async ({ context, page }) => {
  await page.goto('/tools/student-results/new');
  await page.getByPlaceholder('예: 2학기 수행평가 결과').fill('2학기 시험 결과');
  await page.getByPlaceholder('학생에게 보여줄 안내').fill('과목 점수와 총점을 확인하세요.');
  await page.getByLabel('1번 항목명').fill('국어');
  await page.getByLabel('국어 배점').fill('50');
  await page.getByRole('button', { name: '항목 추가' }).click();
  await page.getByLabel('2번 항목명').fill('합산 결과');
  await page.getByLabel('합산 결과 배점').fill('100');
  await page.getByLabel('합산 결과 항목 종류').selectOption('total');
  await page.getByLabel('1번 학생 성명').fill('김하늘');
  await page.getByLabel('1번 학생 확인번호').fill('4821');
  await page.getByLabel('1번 학생 국어 점수').fill('47');
  await page.getByLabel('1번 학생 합산 결과 점수').fill('92');
  await page.getByRole('button', { name: '결과 안내 만들기' }).click();
  await expect(page).toHaveURL(/\/tools\/student-results\/[0-9a-f-]+$/);

  await page.getByRole('tab', { name: '접속 정보' }).click();
  const publicLink = await page.getByRole('link', { name: '학생 화면 열기' }).getAttribute('href');
  await page.getByRole('tab', { name: '현황' }).click();
  const studentPage = await context.newPage();
  await studentPage.goto(publicLink!);
  await studentPage.getByLabel('성명').fill('김하늘');
  await studentPage.getByLabel('확인번호').fill('4821');
  await studentPage.getByRole('button', { name: '내 결과 조회' }).click();
  await expect(studentPage.getByText('92 / 100').first()).toBeVisible();
  await expect(studentPage.getByText('과목 점수와 총점을 확인하세요.')).toBeVisible();

  await studentPage.getByLabel('이의 내용').fill('점수 산출표를 확인해 주세요.');
  await studentPage.getByRole('button', { name: '내용 확인 완료' }).click();
  await expect(studentPage.getByRole('alertdialog')).toContainText('작성 중인 이의');
  await studentPage.getByRole('alertdialog').getByRole('button', { name: '이의 계속 작성' }).click();
  await expect(studentPage.getByLabel('이의 내용')).toHaveValue('점수 산출표를 확인해 주세요.');
  await studentPage.getByRole('button', { name: '이의 제출' }).click();
  await expect(studentPage.getByText('내가 보낸 이의')).toBeVisible();

  await page.getByPlaceholder('교사 답변').fill('점수를 다시 계산했습니다.');
  await page.getByRole('button', { name: '김하늘 학생의 이의에 답변' }).click();
  await studentPage.getByRole('button', { name: '최신 결과 확인' }).click();
  await expect(studentPage.getByText('점수를 다시 계산했습니다.')).toBeVisible();
  await studentPage.getByRole('button', { name: '내용 확인 완료' }).click();
  await expect(page.getByRole('row', { name: /김하늘/ })).toContainText('확인');

  await page.getByRole('button', { name: '김하늘 학생 결과 정정' }).click();
  const correction = page.getByRole('dialog');
  await correction.getByLabel('합산 결과 / 100').fill('95');
  await correction.getByLabel('수정 사유').fill('산출표 대조');
  await correction.getByRole('button', { name: '결과 정정 저장' }).click();
  await expect(page.getByRole('row', { name: /김하늘/ })).toContainText('재확인 필요');
  await studentPage.getByRole('button', { name: '최신 결과 확인' }).click();
  await expect(studentPage.getByText('95 / 100').first()).toBeVisible();
  await page.getByRole('button', { name: '김하늘 학생 결과 정정' }).click();
  await page.getByRole('dialog').getByLabel('합산 결과 / 100').fill('96');
  await page.getByRole('dialog').getByLabel('수정 사유').fill('원본 재대조');
  await page.getByRole('dialog').getByRole('button', { name: '결과 정정 저장' }).click();
  await studentPage.getByRole('button', { name: '내용 확인 완료' }).click();
  await expect(studentPage.getByRole('alert')).toContainText('최신 결과를 확인');
  await studentPage.getByRole('button', { name: '최신 결과 확인' }).click();
  await expect(studentPage.getByText('96 / 100').first()).toBeVisible();
  await studentPage.getByRole('button', { name: '내용 확인 완료' }).click();

  await page.getByRole('button', { name: '안내 정보 수정' }).click();
  const settings = page.getByRole('dialog');
  await settings.getByLabel('제목').fill('수정된 2학기 시험 결과');
  await settings.getByRole('button', { name: '변경 저장' }).click();
  await studentPage.getByRole('button', { name: '최신 결과 확인' }).click();
  await expect(studentPage.getByRole('heading', { name: '수정된 2학기 시험 결과' })).toBeVisible();
  await studentPage.getByRole('button', { name: '조회 종료' }).click();
  await expect(studentPage.getByRole('button', { name: '내 결과 조회' })).toBeVisible();
});

test('17명 QR은 빈 페이지 없이 3장 PDF로 내려받는다', async ({ page }, testInfo) => {
  await page.goto('/tools/student-results/new');
  const csv = [
    '2026학년도 결과 안내',
    '학번,성명,확인번호,점수/100',
    ...Array.from({ length: 17 }, (_, index) => `${index + 1},가상학생${index + 1},${String(4000 + index)},80`),
  ].join('\n');
  await page.getByTestId('student-results-file-input').setInputFiles({
    name: '가상학생17명.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf8'),
  });
  await page.getByRole('button', { name: '분석 결과 적용' }).click();
  await expect(page.getByLabel('17번 학생 성명')).toHaveValue('가상학생17');
  await page.getByRole('button', { name: '결과 안내 만들기' }).click();
  await page.getByRole('tab', { name: '접속 정보' }).click();
  await page.getByRole('checkbox', { name: '검색 결과 학생 전체 선택' }).check();
  await page.getByRole('button', { name: '선택 QR PDF (17명)' }).click();
  await expect(page.getByTestId('student-result-qr-page')).toHaveCount(3);
  const pendingDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PDF 다운로드' }).click();
  const download = await pendingDownload;
  const filePath = testInfo.outputPath('qr-17-students.pdf');
  await download.saveAs(filePath);
  const pdf = await import('node:fs/promises').then((fs) => fs.readFile(filePath));
  expect(pdf.toString('latin1').match(/\/Type \/Page\b/g)).toHaveLength(3);
});
