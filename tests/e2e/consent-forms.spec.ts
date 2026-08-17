import { expect, test } from '@playwright/test';
import { jsPDF } from 'jspdf';
import writeXlsxFile from 'write-excel-file/node';

test('지원하지 않는 문서 형식은 분석하지 않는다', async ({ page }) => {
  await page.goto('/tools/consent-forms/new');
  await page.getByLabel('가정통신문 PDF 파일').setInputFiles({
    name: '명단.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from('not-a-document'),
  });
  await expect(page.getByRole('alert')).toContainText('PDF 파일만');
  await expect(page.getByText('문서 분석 완료')).toHaveCount(0);
});

test('PDF 가정통신문의 페이지와 원본 미리보기를 표시한다', async ({ page }) => {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  pdf.setProperties({ title: 'Field Trip Consent' });
  pdf.setFontSize(18);
  pdf.text('Field Trip Consent', 30, 35);
  pdf.setFontSize(11);
  pdf.text('Please submit your response.', 30, 50);

  await page.goto('/tools/consent-forms/new');
  await page.getByLabel('가정통신문 PDF 파일').setInputFiles({
    name: 'field-trip.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(pdf.output('arraybuffer')),
  });

  await expect(page.getByText('문서 분석 완료')).toBeVisible();
  await expect(page.getByText(/^PDF · \d+(?:\.\d+)?(?:KB|MB) · 1쪽$/)).toBeVisible();
  await expect(page.getByText('1쪽')).toHaveCount(2);
  await expect(page.getByTitle('Field Trip Consent PDF 미리보기')).toBeVisible();
  await expect(page.getByRole('textbox', { name: '제목' })).toHaveValue('Field Trip Consent');
  const uploadTop = await page.getByText('원본 PDF 올리기').boundingBox();
  const infoTop = await page.getByText('안내 정보').boundingBox();
  expect(uploadTop?.y).toBeLessThan(infoTop?.y ?? 0);

  await page.getByRole('button', { name: '확인 후 필드 배치' }).click();
  await page.getByRole('button', { name: '텍스트', exact: true }).click();
  await expect(page.getByTestId('consent-field-canvas').locator('canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: '텍스트 필드', exact: true })).toBeVisible();
  const textField = page.getByRole('button', { name: '텍스트 필드', exact: true });
  const beforeResize = await textField.boundingBox();
  const resizeHandle = page.getByRole('button', { name: '텍스트 필드 왼쪽 위 크기 조절' });
  const handleBox = await resizeHandle.boundingBox();
  if (!handleBox) throw new Error('필드 크기 조절 핸들을 찾지 못했습니다.');
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + handleBox.width / 2 - 35, handleBox.y + handleBox.height / 2 - 20);
  await page.mouse.up();
  const afterResize = await textField.boundingBox();
  expect(afterResize?.width).toBeGreaterThan(beforeResize?.width ?? 0);

  await page.getByRole('button', { name: '체크박스', exact: true }).click();
  await expect(page.getByRole('button', { name: '체크박스 필드', exact: true })).toBeVisible();
  const checkboxField = await page.getByRole('button', { name: '체크박스 필드', exact: true }).boundingBox();
  const resizedTextField = await textField.boundingBox();
  expect(checkboxField && resizedTextField && (
    checkboxField.x >= resizedTextField.x + resizedTextField.width
    || checkboxField.x + checkboxField.width <= resizedTextField.x
    || checkboxField.y >= resizedTextField.y + resizedTextField.height
    || checkboxField.y + checkboxField.height <= resizedTextField.y
  )).toBe(true);
  await expect(page.getByRole('button', { name: '단일 선택', exact: true })).toHaveCount(0);
  const desktopCanvas = await page.getByTestId('consent-field-canvas').boundingBox();
  const desktopSettings = await page.getByTestId('consent-field-settings').boundingBox();
  expect(desktopSettings?.x).toBeGreaterThan((desktopCanvas?.x ?? 0) + (desktopCanvas?.width ?? 0) - 1);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: '필드 배치 완료' })).toBeVisible();
  await expect(page.getByTestId('consent-field-settings')).toBeVisible();
  expect(await page.getByTestId('consent-field-settings').evaluate((element) => getComputedStyle(element).position)).toBe('fixed');
  await page.getByRole('button', { name: '필드 배치 완료' }).click();
  await expect(page.getByRole('heading', { name: '누가 응답할지 정하기' })).toBeVisible();
  const rosterWorkbook = await writeXlsxFile([
    ['Class roster'],
    [],
    ['Student ID', 'Name'],
    ['30101', 'Alice Kim'],
    ['30102', 'Daniel Lee'],
  ]).toBuffer();
  await page.getByLabel('엑셀 명단 파일').setInputFiles({
    name: 'class-roster.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: rosterWorkbook,
  });
  await expect(page.getByRole('status')).toContainText('2명을 불러왔습니다');
  await expect(page.getByText('Alice Kim')).toBeVisible();
  await expect(page.getByText('30102')).toBeVisible();

  const rosterPdf = new jsPDF({ unit: 'mm', format: 'a4' });
  rosterPdf.text('Name', 25, 30);
  rosterPdf.text('Student ID', 90, 30);
  rosterPdf.text('Sophia Park', 25, 42);
  rosterPdf.text('30201', 90, 42);
  rosterPdf.text('Noah Choi', 25, 54);
  rosterPdf.text('30202', 90, 54);
  await page.getByLabel('PDF 명단 파일').setInputFiles({
    name: 'additional-roster.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(rosterPdf.output('arraybuffer')),
  });
  await expect(page.getByRole('status')).toContainText('2명을 불러왔습니다');
  await expect(page.getByText('Sophia Park')).toBeVisible();
  await expect(page.getByText('4명')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await page.getByLabel('명단 없이 받기').check();
  await page.getByRole('button', { name: '다음: 공유 설정' }).click();
  await expect(page.getByRole('heading', { name: '공유 조건 확인' })).toBeVisible();
  await page.getByRole('button', { name: '수합 만들기' }).click();
  await expect(page.getByRole('heading', { name: '가정통신문 수합' })).toBeVisible();
  await expect(page.getByText('Field Trip Consent')).toBeVisible();

  await page.getByRole('button', { name: '관리·공유' }).click();
  await expect(page.getByRole('heading', { name: 'Field Trip Consent' })).toBeVisible();
  await page.getByRole('button', { name: '설정 수정' }).click();
  await page.getByRole('textbox', { name: '제목' }).fill('수정된 현장체험학습 동의서');
  await page.getByRole('button', { name: '설정 저장' }).click();
  await expect(page.getByRole('heading', { name: '수정된 현장체험학습 동의서' })).toBeVisible();
  await page.getByRole('button', { name: '원본·필드 수정' }).click();
  await page.getByLabel('가정통신문 PDF 파일').setInputFiles({
    name: 'field-trip.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(pdf.output('arraybuffer')),
  });
  await page.getByRole('button', { name: '확인 후 필드 배치' }).click();
  await expect(page.getByRole('button', { name: '텍스트 필드', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '텍스트 필드', exact: true }).click();
  await page.getByRole('textbox', { name: '표시 이름' }).fill('참가 의견');
  await page.getByRole('button', { name: '필드 배치 완료' }).click();
  await page.getByRole('button', { name: '수합 만들기' }).click();
  await expect(page.getByRole('heading', { name: '수정된 현장체험학습 동의서' })).toBeVisible();
  await expect(page.getByLabel('가정통신문 응답 링크 QR 코드')).toBeVisible();
  const responseLink = await page.getByLabel('응답 화면 열기').getAttribute('href');
  expect(responseLink).toContain('/s/consent/');
  const managePageUrl = page.url();
  await page.goto(responseLink!);
  await expect(page.getByRole('heading', { name: '수정된 현장체험학습 동의서' })).toBeVisible();
  await expect(page.locator('section[aria-label="1쪽"] canvas')).toBeVisible();
  const responsePage = await page.locator('section[aria-label="1쪽"]').boundingBox();
  const responseField = await page.getByRole('textbox', { name: '참가 의견' }).boundingBox();
  expect(responseField?.x).toBeGreaterThanOrEqual(responsePage?.x ?? 0);
  expect((responseField?.x ?? 0) + (responseField?.width ?? 0)).toBeLessThanOrEqual((responsePage?.x ?? 0) + (responsePage?.width ?? 0) + 1);
  await page.getByRole('textbox', { name: '참가 의견' }).fill('참가합니다');
  await page.getByRole('checkbox', { name: '체크박스' }).check();
  await page.getByRole('button', { name: '작성 완료' }).click();
  await expect(page.getByRole('heading', { name: '응답을 제출했습니다' })).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasHorizontalOverflow).toBe(false);

  await page.goto(managePageUrl);
  const submissions = page.getByRole('region', { name: '받은 응답' });
  await expect(submissions.getByText('1건')).toBeVisible();
  await expect(submissions).toContainText('참가 의견: 참가합니다');
  await expect(submissions).toContainText('체크박스: 예');
  const download = page.waitForEvent('download');
  await submissions.getByRole('button', { name: '1번째 응답 PDF 내려받기' }).click();
  expect((await download).suggestedFilename()).toBe('수정된 현장체험학습 동의서_응답001.pdf');

  const bulkDownload = page.waitForEvent('download');
  await submissions.getByRole('button', { name: '전체 PDF 내려받기' }).click();
  expect((await bulkDownload).suggestedFilename()).toBe('수정된 현장체험학습 동의서_응답모음_1건.pdf');

  const qrDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'QR 이미지 저장' }).click();
  expect((await qrDownload).suggestedFilename()).toBe('수정된 현장체험학습 동의서_응답QR.png');
});

test('가로 PDF 페이지 비율을 필드 편집기에 유지한다', async ({ page }) => {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  pdf.text('Landscape consent', 20, 20);
  await page.goto('/tools/consent-forms/new');
  await page.getByLabel('가정통신문 PDF 파일').setInputFiles({
    name: 'landscape-consent.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(pdf.output('arraybuffer')),
  });
  await page.getByRole('button', { name: '확인 후 필드 배치' }).click();
  const canvas = await page.getByTestId('consent-field-canvas').boundingBox();
  expect(canvas?.width).toBeGreaterThan(canvas?.height ?? Number.POSITIVE_INFINITY);
});

test('실수로 만든 수합을 확인창을 거쳐 삭제한다', async ({ page }) => {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  pdf.text('Mistaken consent', 20, 20);
  await page.goto('/tools/consent-forms/new');
  await page.getByLabel('가정통신문 PDF 파일').setInputFiles({
    name: 'mistake.pdf', mimeType: 'application/pdf', buffer: Buffer.from(pdf.output('arraybuffer')),
  });
  await page.getByRole('textbox', { name: '제목' }).fill('잘못 만든 수합');
  await page.getByRole('button', { name: '확인 후 필드 배치' }).click();
  await page.getByRole('button', { name: '텍스트', exact: true }).click();
  await page.getByRole('button', { name: '필드 배치 완료' }).click();
  await page.getByLabel('명단 없이 받기').check();
  await page.getByRole('button', { name: '다음: 공유 설정' }).click();
  await page.getByRole('button', { name: '수합 만들기' }).click();
  await expect(page.getByRole('heading', { name: '가정통신문 수합' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '잘못 만든 수합' })).toBeVisible();

  // 취소하면 목록에 그대로 남는다.
  await page.getByRole('button', { name: '잘못 만든 수합 삭제' }).click();
  const confirmDialog = page.getByRole('alertdialog');
  await expect(confirmDialog).toContainText('되돌릴 수 없습니다');
  await confirmDialog.getByRole('button', { name: '취소' }).click();
  await expect(page.getByRole('heading', { name: '잘못 만든 수합' })).toBeVisible();

  await page.getByRole('button', { name: '잘못 만든 수합 삭제' }).click();
  await confirmDialog.getByRole('button', { name: '영구 삭제' }).click();
  await expect(page.getByRole('heading', { name: '아직 가정통신문 수합이 없습니다' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '아직 가정통신문 수합이 없습니다' })).toBeVisible();
});

test('원본이 준비 중이면 오류 대신 준비 화면을 띄우고 준비되면 자동으로 연다', async ({ page }) => {
  let calls = 0;
  const source = new jsPDF({ unit: 'mm', format: 'a4' });
  source.text('Consent', 20, 20);
  await page.route('https://source.test/source.pdf', (route) => route.fulfill({
    status: 200, contentType: 'application/pdf', body: Buffer.from(source.output('arraybuffer')),
  }));
  // 데모 모드가 아닌 원격 경로를 흉내 낸다.
  await page.route('**/functions/v1/consent-forms-public', async (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}');
    if (body.action === 'metadata') {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ form: { title: '현장체험학습 동의서', description: '', passwordRequired: false, status: 'open', deadline: '' } }),
      });
    }
    calls += 1;
    if (calls < 3) {
      return route.fulfill({
        status: 425, contentType: 'application/json',
        body: JSON.stringify({ error: '가정통신문을 준비하고 있습니다. 잠시 후 자동으로 열립니다.' }),
      });
    }
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ form: {
        title: '현장체험학습 동의서', description: '', passwordRequired: false, status: 'open', deadline: '',
        fields: [], sourceUrl: 'https://source.test/source.pdf', allowResubmission: false, pageCount: 1,
        pageSizes: [{ width: 595, height: 842 }],
      } }),
    });
  });

  await page.goto('/s/consent/11111111-1111-4111-8111-111111111111');
  await expect(page.getByRole('heading', { name: '가정통신문을 준비하고 있습니다' })).toBeVisible();
  await expect(page.getByText('준비되면 자동으로 열립니다')).toBeVisible();
  // 재시도가 성공하면 준비 화면이 사라진다.
  await expect(page.getByRole('heading', { name: '가정통신문을 준비하고 있습니다' })).toBeHidden({ timeout: 15_000 });
  expect(calls).toBeGreaterThanOrEqual(3);
});

test('원본이 늦게 도착해도 오류 화면이 스치지 않는다', async ({ page }) => {
  const source = new jsPDF({ unit: 'mm', format: 'a4' });
  source.text('Consent', 20, 20);
  await page.route('https://source.test/slow.pdf', (route) => route.fulfill({
    status: 200, contentType: 'application/pdf', body: Buffer.from(source.output('arraybuffer')),
  }));
  await page.route('**/functions/v1/consent-forms-public', async (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}');
    if (body.action === 'metadata') {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ form: { title: '느린 동의서', description: '', passwordRequired: false, status: 'open', deadline: '' } }),
      });
    }
    // 안내 정보보다 원본이 한참 뒤에 도착하는 상황을 만든다.
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ form: {
        title: '느린 동의서', description: '', passwordRequired: false, status: 'open', deadline: '',
        fields: [], sourceUrl: 'https://source.test/slow.pdf', allowResubmission: false, pageCount: 1,
        pageSizes: [{ width: 595, height: 842 }],
      } }),
    });
  });

  const errorFlashes: string[] = [];
  await page.goto('/s/consent/22222222-2222-4222-8222-222222222222');
  // 원본을 기다리는 동안 오류가 아니라 로딩 안내가 보여야 한다.
  await expect(page.getByRole('heading', { name: '가정통신문을 불러오는 중입니다' })).toBeVisible();
  const watcher = setInterval(async () => {
    if (await page.getByRole('heading', { name: '원본 PDF를 열지 못했습니다' }).count()) errorFlashes.push('보임');
  }, 100);
  await expect(page.getByRole('heading', { name: '느린 동의서' })).toBeVisible({ timeout: 15_000 });
  clearInterval(watcher);
  expect(errorFlashes).toEqual([]);
});

test('단축키로 필드를 복사해 다른 쪽에 붙여넣고 되돌린다', async ({ page }) => {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  for (let index = 0; index < 4; index += 1) {
    if (index) pdf.addPage();
    pdf.text(`Notice page ${index + 1}`, 20, 25);
  }
  await page.goto('/tools/consent-forms/new');
  await page.getByLabel('가정통신문 PDF 파일').setInputFiles({
    name: 'multi.pdf', mimeType: 'application/pdf', buffer: Buffer.from(pdf.output('arraybuffer')),
  });
  await page.getByRole('textbox', { name: '제목' }).fill('여러 쪽 동의서');
  await page.getByRole('button', { name: '확인 후 필드 배치' }).click();

  await page.getByRole('button', { name: '서명', exact: true }).click();
  await page.getByRole('textbox', { name: '표시 이름' }).fill('보호자 서명');
  const placed = page.getByRole('region', { name: '배치된 필드' });
  await expect(placed.getByRole('button', { name: /보호자 서명/ })).toContainText('1쪽');

  // 3쪽으로 이동해 붙여넣으면 그 쪽에 복사본이 생긴다.
  // 이름 입력란에서 포커스를 빼야 단축키가 동작한다.
  await page.getByRole('button', { name: '보호자 서명 필드', exact: true }).click();
  await page.keyboard.press('ControlOrMeta+c');
  await page.getByLabel('쪽 번호').fill('3');
  await page.keyboard.press('ControlOrMeta+v');
  await expect(placed.getByRole('button', { name: /보호자 서명/ })).toHaveCount(2);
  await expect(placed.getByRole('button', { name: /보호자 서명/ }).nth(1)).toContainText('3쪽');

  // 되돌리면 복사본만 사라진다.
  await page.keyboard.press('ControlOrMeta+z');
  await expect(placed.getByRole('button', { name: /보호자 서명/ })).toHaveCount(1);

  // 다시 실행하면 복원된다.
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect(placed.getByRole('button', { name: /보호자 서명/ })).toHaveCount(2);
});

test('필드 목록에서 해당 쪽으로 이동하고 쪽 번호로 건너뛴다', async ({ page }) => {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  for (let index = 0; index < 8; index += 1) {
    if (index) pdf.addPage();
    pdf.text(`Notice page ${index + 1}`, 20, 25);
  }
  await page.goto('/tools/consent-forms/new');
  await page.getByLabel('가정통신문 PDF 파일').setInputFiles({
    name: 'long.pdf', mimeType: 'application/pdf', buffer: Buffer.from(pdf.output('arraybuffer')),
  });
  await page.getByRole('textbox', { name: '제목' }).fill('긴 동의서');
  await page.getByRole('button', { name: '확인 후 필드 배치' }).click();

  // 화살표를 반복해 누르지 않고 곧바로 6쪽으로 간다.
  await page.getByLabel('쪽 번호').fill('6');
  await expect(page.getByLabel('쪽 번호')).toHaveValue('6');
  await page.getByRole('button', { name: '텍스트', exact: true }).click();
  await page.getByRole('textbox', { name: '표시 이름' }).fill('보호자 의견');

  await page.getByLabel('쪽 번호').fill('1');
  await expect(page.getByLabel('쪽 번호')).toHaveValue('1');

  // 목록에서 누르면 그 필드가 있는 쪽으로 돌아간다.
  await page.getByRole('region', { name: '배치된 필드' }).getByRole('button', { name: /보호자 의견/ }).click();
  await expect(page.getByLabel('쪽 번호')).toHaveValue('6');
  await expect(page.getByRole('button', { name: '보호자 의견 필드', exact: true })).toBeVisible();
});

test('새로고침해도 올린 원본과 배치한 필드를 복구한다', async ({ page }) => {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  pdf.addPage();
  pdf.text('Notice', 20, 25);
  await page.goto('/tools/consent-forms/new');
  await page.getByLabel('가정통신문 PDF 파일').setInputFiles({
    name: 'restore.pdf', mimeType: 'application/pdf', buffer: Buffer.from(pdf.output('arraybuffer')),
  });
  await page.getByRole('textbox', { name: '제목' }).fill('복구 확인 동의서');
  await page.getByRole('button', { name: '확인 후 필드 배치' }).click();
  await page.getByRole('button', { name: '텍스트', exact: true }).click();
  await page.getByRole('textbox', { name: '표시 이름' }).fill('보호자 의견');
  await expect(page.getByRole('button', { name: '보호자 의견 필드', exact: true })).toBeVisible();

  // 임시 보관이 끝나길 기다린 뒤 새로고침한다.
  await page.waitForTimeout(1_200);
  await page.reload();

  await expect(page.getByRole('button', { name: '보호자 의견 필드', exact: true })).toBeVisible();
  await expect(page.getByTestId('consent-field-canvas').locator('canvas')).toBeVisible();
  await expect(page.getByRole('region', { name: '배치된 필드' }).getByRole('button', { name: /보호자 의견/ })).toHaveCount(1);

  // 처음 단계로 돌아가면 복구 안내와 새로 시작 버튼이 보인다.
  await page.getByRole('button', { name: '원본 문서로' }).click();
  await expect(page.getByRole('textbox', { name: '제목' })).toHaveValue('복구 확인 동의서');
  await expect(page.getByRole('status')).toContainText('만들던 내용을 복구했습니다');

  await page.getByRole('button', { name: '새로 시작' }).click();
  await expect(page.getByText('문서 분석 완료')).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('문서 분석 완료')).toHaveCount(0);
});

test('개인 링크로 들어오면 누구의 문서인지 알려주고 제출을 그 사람에게 연결한다', async ({ page }) => {
  const source = new jsPDF({ unit: 'mm', format: 'a4' });
  source.text('Consent', 20, 20);
  let submitted: Record<string, unknown> | null = null;

  await page.route('https://source.test/personal.pdf', (route) => route.fulfill({
    status: 200, contentType: 'application/pdf', body: Buffer.from(source.output('arraybuffer')),
  }));
  await page.route('**/functions/v1/consent-forms-public', async (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}');
    const base = { title: '현장체험학습 동의서', description: '', passwordRequired: false, status: 'open', deadline: '' };
    if (body.action === 'metadata') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ form: { ...base, recipientHint: '김○○', recipientSubmitted: false } }) });
    }
    if (body.action === 'document') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ form: {
        ...base, fields: [{ id: 'f1', kind: 'text', label: '보호자 의견', required: true, pageIndex: 0, x: 10, y: 20, width: 40, height: 8 }],
        sourceUrl: 'https://source.test/personal.pdf', allowResubmission: false, pageCount: 1,
        pageSizes: [{ width: 595, height: 842 }], recipientName: '김학생', recipientSubmitted: false,
      } }) });
    }
    submitted = body;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ submitted: true }) });
  });

  await page.goto('/s/consent/33333333-3333-4333-8333-333333333333?r=44444444-4444-4444-8444-444444444444');
  await expect(page.getByText('김학생 학생 보호자용')).toBeVisible();

  await page.getByRole('textbox', { name: '보호자 의견' }).fill('참가합니다');
  await page.getByRole('button', { name: '작성 완료' }).click();
  await expect(page.getByRole('heading', { name: '응답을 제출했습니다' })).toBeVisible();

  // 제출이 개인 링크의 수신자와 함께 전달돼야 누가 냈는지 이어붙일 수 있다.
  expect(submitted).toMatchObject({ action: 'submit', recipientToken: '44444444-4444-4444-8444-444444444444' });
});

test('명단 없는 수합의 개인 QR 화면은 배부할 명단이 없다고 안내한다', async ({ page }) => {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  pdf.text('Notice', 20, 25);
  await page.goto('/tools/consent-forms/new');
  await page.getByLabel('가정통신문 PDF 파일').setInputFiles({
    name: 'qr.pdf', mimeType: 'application/pdf', buffer: Buffer.from(pdf.output('arraybuffer')),
  });
  await page.getByRole('textbox', { name: '제목' }).fill('공개 수합 동의서');
  await page.getByRole('button', { name: '확인 후 필드 배치' }).click();
  await page.getByRole('button', { name: '텍스트', exact: true }).click();
  await page.getByRole('button', { name: '필드 배치 완료' }).click();
  await page.getByLabel('명단 없이 받기').check();
  await page.getByRole('button', { name: '다음: 공유 설정' }).click();
  await page.getByRole('button', { name: '수합 만들기' }).click();
  await page.getByRole('button', { name: '관리·공유' }).click();

  await page.goto(`${page.url()}/qr`);
  await expect(page.getByRole('heading', { name: '개인 QR 배부 자료' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '배부할 명단이 없습니다' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'PDF 다운로드' })).toBeDisabled();
});

test('결과 표 내려받기와 응답 링크 재발급을 제공한다', async ({ page }) => {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  pdf.text('Notice', 20, 25);
  await page.goto('/tools/consent-forms/new');
  await page.getByLabel('가정통신문 PDF 파일').setInputFiles({
    name: 'sheet.pdf', mimeType: 'application/pdf', buffer: Buffer.from(pdf.output('arraybuffer')),
  });
  await page.getByRole('textbox', { name: '제목' }).fill('결과 표 동의서');
  await page.getByRole('button', { name: '확인 후 필드 배치' }).click();
  await page.getByRole('button', { name: '텍스트', exact: true }).click();
  await page.getByRole('textbox', { name: '표시 이름' }).fill('보호자 의견');
  await page.getByRole('button', { name: '필드 배치 완료' }).click();
  await page.getByLabel('명단 없이 받기').check();
  await page.getByRole('button', { name: '다음: 공유 설정' }).click();
  await page.getByRole('button', { name: '수합 만들기' }).click();
  await page.getByRole('button', { name: '관리·공유' }).click();
  const manageUrl = page.url();

  const beforeLink = await page.getByLabel('응답 화면 열기').getAttribute('href');
  await page.goto(beforeLink!);
  await page.getByRole('textbox', { name: '보호자 의견' }).fill('참가합니다');
  await page.getByRole('button', { name: '작성 완료' }).click();
  await expect(page.getByRole('heading', { name: '응답을 제출했습니다' })).toBeVisible();

  await page.goto(manageUrl);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '결과 표(xlsx)' }).click();
  expect((await download).suggestedFilename()).toBe('결과 표 동의서_응답.xlsx');

  // 링크를 재발급하면 이전 주소는 더 이상 쓰이지 않는다.
  await page.getByRole('button', { name: '응답 링크 재발급' }).click();
  await expect(page.getByRole('alertdialog')).toContainText('이미 배부한 개인 링크가 모두 열리지 않습니다');
  await page.getByRole('alertdialog').getByRole('button', { name: '링크 재발급' }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  const afterLink = await page.getByLabel('응답 화면 열기').getAttribute('href');
  expect(afterLink).not.toBe(beforeLink);

  await page.goto(beforeLink!);
  await expect(page.getByRole('heading', { name: '가정통신문을 찾을 수 없습니다' })).toBeVisible();
});

test('확대해도 필드의 상대 위치가 유지된다', async ({ page }) => {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  pdf.text('Notice', 20, 25);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/tools/consent-forms/new');
  await page.getByLabel('가정통신문 PDF 파일').setInputFiles({
    name: 'zoom.pdf', mimeType: 'application/pdf', buffer: Buffer.from(pdf.output('arraybuffer')),
  });
  await page.getByRole('button', { name: '확인 후 필드 배치' }).click();
  await page.getByRole('button', { name: '텍스트', exact: true }).click();

  const ratioOf = async () => {
    const canvas = await page.getByTestId('consent-field-canvas').boundingBox();
    const field = await page.getByRole('button', { name: '텍스트 필드', exact: true }).boundingBox();
    if (!canvas || !field) throw new Error('측정에 실패했습니다.');
    return {
      x: (field.x - canvas.x) / canvas.width,
      y: (field.y - canvas.y) / canvas.height,
      width: field.width / canvas.width,
    };
  };

  const before = await ratioOf();
  await page.getByRole('button', { name: '확대' }).click();
  await page.getByRole('button', { name: '확대' }).click();
  await expect(page.getByRole('button', { name: '쪽 맞춤' })).toContainText('150%');

  const after = await ratioOf();
  expect(after.x).toBeCloseTo(before.x, 2);
  expect(after.y).toBeCloseTo(before.y, 2);
  expect(after.width).toBeCloseTo(before.width, 2);

  await page.getByRole('button', { name: '쪽 맞춤' }).click();
  await expect(page.getByRole('button', { name: '쪽 맞춤' })).toContainText('100%');
});

test('여러 수합을 선택해 한 번에 지운다', async ({ page }) => {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  pdf.text('Notice', 20, 25);
  const buffer = Buffer.from(pdf.output('arraybuffer'));

  for (const title of ['정리 대상 하나', '정리 대상 둘', '남겨둘 수합']) {
    await page.goto('/tools/consent-forms/new');
    await page.getByLabel('가정통신문 PDF 파일').setInputFiles({ name: 'bulk.pdf', mimeType: 'application/pdf', buffer });
    await page.getByRole('textbox', { name: '제목' }).fill(title);
    await page.getByRole('button', { name: '확인 후 필드 배치' }).click();
    await page.getByRole('button', { name: '텍스트', exact: true }).click();
    await page.getByRole('button', { name: '필드 배치 완료' }).click();
    await page.getByLabel('명단 없이 받기').check();
    await page.getByRole('button', { name: '다음: 공유 설정' }).click();
    await page.getByRole('button', { name: '수합 만들기' }).click();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
  }

  await page.getByLabel('정리 대상 하나 선택').check();
  await page.getByLabel('정리 대상 둘 선택').check();
  await expect(page.getByText('2개 선택')).toBeVisible();

  await page.getByRole('button', { name: '선택 삭제' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('선택한 수합 2개를 삭제할까요?');
  await expect(dialog).toContainText('되돌릴 수 없습니다');
  await dialog.getByRole('button', { name: '2개 삭제' }).click();

  await expect(page.getByRole('status')).toContainText('2개를 지웠습니다');
  await expect(page.getByRole('heading', { name: '정리 대상 하나' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '정리 대상 둘' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '남겨둘 수합' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: '남겨둘 수합' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '정리 대상 하나' })).toHaveCount(0);
});

test('처리 중인 버튼은 다시 눌리지 않는다', async ({ page }) => {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  pdf.text('Notice', 20, 25);
  await page.goto('/tools/consent-forms/new');
  await page.getByLabel('가정통신문 PDF 파일').setInputFiles({
    name: 'busy.pdf', mimeType: 'application/pdf', buffer: Buffer.from(pdf.output('arraybuffer')),
  });
  await page.getByRole('textbox', { name: '제목' }).fill('처리 중 확인 동의서');
  await page.getByRole('button', { name: '확인 후 필드 배치' }).click();
  await page.getByRole('button', { name: '텍스트', exact: true }).click();
  await page.getByRole('textbox', { name: '표시 이름' }).fill('보호자 의견');
  await page.getByRole('button', { name: '필드 배치 완료' }).click();
  await page.getByLabel('명단 없이 받기').check();
  await page.getByRole('button', { name: '다음: 공유 설정' }).click();
  await page.getByRole('button', { name: '수합 만들기' }).click();
  await page.getByRole('button', { name: '관리·공유' }).click();
  const manageUrl = page.url();

  const link = await page.getByLabel('응답 화면 열기').getAttribute('href');
  await page.goto(link!);
  await page.getByRole('textbox', { name: '보호자 의견' }).fill('참가합니다');
  await page.getByRole('button', { name: '작성 완료' }).click();
  await expect(page.getByRole('heading', { name: '응답을 제출했습니다' })).toBeVisible();
  await page.goto(manageUrl);

  // 이름이 겹치지 않아 확인창 안팎을 구분해 집을 수 있다.
  await expect(page.getByRole('button', { name: '설정 저장' })).toHaveCount(0);
  await page.getByRole('button', { name: '설정 수정' }).click();
  await expect(page.getByRole('button', { name: '설정 저장' })).toBeVisible();
  await page.getByRole('button', { name: '취소' }).click();

  // 내려받기 버튼은 처리 중 문구로 바뀌며 중복 실행을 막는다.
  const excelDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '결과 표(xlsx)' }).click();
  await excelDownload;

  const qrDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'QR 이미지 저장' }).click();
  await qrDownload;

  // 삭제 확인창의 확정 버튼은 여는 버튼과 이름이 다르다.
  await page.getByRole('button', { name: '수합 삭제' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog.getByRole('button', { name: '영구 삭제' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: '수합 삭제' })).toHaveCount(0);
});
