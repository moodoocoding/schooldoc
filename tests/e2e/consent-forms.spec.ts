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
  await page.getByRole('button', { name: '저장' }).click();
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
  await page.goto(responseLink!);
  await expect(page.getByRole('heading', { name: '수정된 현장체험학습 동의서' })).toBeVisible();
  await page.getByRole('textbox', { name: '참가 의견' }).fill('참가합니다');
  await page.getByRole('checkbox', { name: '체크박스' }).check();
  await page.getByRole('button', { name: '응답 제출' }).click();
  await expect(page.getByRole('heading', { name: '응답을 제출했습니다' })).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasHorizontalOverflow).toBe(false);
});
