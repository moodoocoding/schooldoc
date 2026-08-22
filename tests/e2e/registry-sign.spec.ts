import { expect, test } from '@playwright/test';
import writeXlsxFile from 'write-excel-file/node';

test('500명 명단은 50명씩 편집하고 인쇄 미리보기는 한 페이지만 렌더링한다', async ({ page }) => {
  await page.goto('/tools/registry-sign/new');
  await page.evaluate(() => {
    localStorage.removeItem('schooldoc_registry_v1');
    sessionStorage.clear();
  });
  await page.reload();

  await page.getByLabel(/문서 제목/).fill('500명 등록부 성능 검증');
  await page.getByRole('button', { name: '다음', exact: true }).click();

  const rows = Array.from({ length: 500 }, (_, index) => (
    `검증학교${String(index + 1).padStart(3, '0')}\t검증교사${String(index + 1).padStart(3, '0')}`
  )).join('\n');
  await page.getByLabel(/표 붙여넣기/).fill(rows);
  await page.getByRole('button', { name: '명단 반영' }).click();

  await expect(page.getByRole('textbox', { name: '1번 참석자 성명', exact: true })).toHaveValue('검증교사001');
  await expect(page.getByRole('textbox', { name: '51번 참석자 성명', exact: true })).toHaveCount(0);
  await expect(page.locator('tbody tr')).toHaveCount(50);
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileOverflow = await page.evaluate(() => {
    const container = (() => {
      const element = document.querySelector('table')?.parentElement;
      if (!element) return null;
      element.scrollLeft = 100;
      return {
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        scrollLeft: element.scrollLeft,
        overflowX: getComputedStyle(element).overflowX,
      };
    })();
    return { container };
  });
  expect(mobileOverflow.container?.overflowX).toBe('auto');
  expect(mobileOverflow.container?.scrollWidth).toBeGreaterThan(mobileOverflow.container?.clientWidth ?? 0);
  expect(mobileOverflow.container?.scrollLeft).toBeGreaterThan(0);
  await page.mouse.move(10, 100);
  await page.mouse.wheel(1_000, 0);
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.scrollX)).toBe(0);
  await page.getByLabel('참석자 명단 페이지 선택').selectOption('10');
  await expect(page.getByRole('textbox', { name: '500번 참석자 성명', exact: true })).toHaveValue('검증교사500');
  await expect(page.getByRole('textbox', { name: '1번 참석자 성명', exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: '다음', exact: true }).click();
  await expect(page.locator('.registry-print-page')).toHaveCount(1);
  await page.getByLabel('인쇄 미리보기 페이지 선택').selectOption('50');
  await expect(page.locator('.registry-print-page')).toHaveCount(1);
  await expect(page.locator('.registry-print-page')).toContainText('- 50 -');
  await expect(page.locator('.registry-print-page')).toContainText('검증교사500');

  await page.getByRole('button', { name: '다음', exact: true }).click();
  await page.getByRole('button', { name: '등록부 생성' }).click();
  await expect(page).toHaveURL(/\/tools\/registry-sign\/[^/]+$/);
  await expect(page.locator('.registry-print-page')).toHaveCount(1);
  await page.getByLabel('참석자 명단 페이지 선택').selectOption('10');
  const manageList = page.locator('section').filter({ has: page.getByRole('heading', { name: '참석자 명단' }) });
  await expect(manageList.getByRole('row', { name: /검증교사500/ })).toBeVisible();
  await expect(manageList.getByRole('row', { name: /검증교사001/ })).toHaveCount(0);
});

test('제목 행 아래의 성명과 소속 헤더를 찾아 엑셀 명단을 불러온다', async ({ page }) => {
  await page.goto('/tools/registry-sign/new');
  await page.evaluate(() => {
    localStorage.removeItem('schooldoc_registry_v1');
    sessionStorage.clear();
  });
  await page.reload();

  await page.getByLabel(/문서 제목/).fill('엑셀 명단 파싱 검증');
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByRole('columnheader', { name: '서명', exact: true })).toBeVisible();
  await expect(page.getByLabel('1번 참석자 서명 칸')).toBeVisible();

  const text = String;
  const workbook = await writeXlsxFile([
    [{ value: '2026학년도 교직원 연수 등록부', type: text }],
    [
      { value: '일시: 2026. 8. 13.', type: text },
      { value: '장소: 미래교육실', type: text },
    ],
    [],
    [
      { value: '연번', type: text },
      { value: '소속', type: text },
      { value: '성 명', type: text },
      { value: '서명', type: text },
    ],
    [
      { value: 1, type: Number },
      { value: '새봄초등학교', type: text },
      { value: '김하늘', type: text },
    ],
    [
      { value: 2, type: Number },
      { value: '한빛중학교', type: text },
      { value: '이도윤', type: text },
    ],
  ]).toBuffer();

  await page.locator('input[type="file"]').setInputFiles({
    name: '참석자-명단.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: workbook,
  });

  await expect(page.getByLabel('1번 참석자 성명')).toHaveValue('김하늘');
  await expect(page.getByLabel('1번 참석자 소속')).toHaveValue('새봄초등학교');
  await expect(page.getByLabel('2번 참석자 성명')).toHaveValue('이도윤');
  await expect(page.getByLabel('2번 참석자 소속')).toHaveValue('한빛중학교');
  await expect(page.getByLabel('2번 참석자 서명 칸')).toBeVisible();
});

test('등록부를 만들고 모바일에서 서명한 뒤 결과물을 내려받는다', async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });

  await page.goto('/tools/registry-sign/new');
  await page.evaluate(() => {
    localStorage.removeItem('schooldoc_registry_v1');
    sessionStorage.clear();
  });
  await page.reload();

  await page.getByLabel(/문서 제목/).fill('E2E 교직원 연수 등록부');
  await page.getByLabel('왼쪽 내용').fill('일시: 2026. 8. 13.(목) 14:00');
  await page.getByLabel('오른쪽 내용').fill('장소: 미래교육실');
  await page.getByRole('button', { name: '다음' }).click();

  await page.getByLabel('1번 참석자 성명').fill('테스트교사');
  await page.getByLabel('1번 참석자 소속').fill('새봄초등학교');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '2단 20명' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '등록부 생성' }).click();

  await expect(page).toHaveURL(/\/tools\/registry-sign\/[^/]+$/);
  await expect(page.locator('h1').filter({ hasText: 'E2E 교직원 연수 등록부' }).first()).toBeVisible();
  const manageUrl = page.url();
  const publicUrl = await page.getByLabel('서명 링크 주소').inputValue();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(publicUrl);
  await page.getByPlaceholder('이름 또는 소속 검색').fill('테스트교사');
  await page.getByRole('button', { name: /테.*사.*선택/ }).click();

  const canvas = page.getByLabel('서명 입력 영역');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (!box) throw new Error('서명 입력 영역의 위치를 찾지 못했습니다.');
  await page.mouse.move(box.x + 70, box.y + 90);
  await page.mouse.down();
  await page.mouse.move(box.x + 130, box.y + 55, { steps: 5 });
  await page.mouse.move(box.x + 190, box.y + 105, { steps: 5 });
  await page.mouse.up();
  await page.getByRole('button', { name: '서명 제출' }).click();
  await expect(page.getByRole('heading', { name: '서명이 제출되었습니다' })).toBeVisible();

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(manageUrl);
  const participantRow = page.getByRole('row', { name: /테스트교사/ });
  await expect(participantRow.getByText('완료', { exact: true })).toBeVisible();

  const printLayout = await page.locator('.registry-print-page').first().evaluate((printPage) => {
    const tables = Array.from(printPage.querySelectorAll('table'));
    return tables.map((table) => {
      const rowHeights = Array.from(table.querySelectorAll('tbody tr'))
        .map((row) => (row as HTMLElement).offsetHeight);
      const firstRowCells = Array.from(table.querySelectorAll('tbody tr:first-child td'));
      const cellWidths = firstRowCells.map((cell) => (cell as HTMLElement).offsetWidth);
      const signatureCell = firstRowCells.at(-1)?.getBoundingClientRect();
      const signatureImage = table.querySelector('tbody img')?.getBoundingClientRect();
      return {
        rowHeights,
        cellWidths,
        signatureFitsCell: !signatureCell || !signatureImage || (
          signatureImage.width <= signatureCell.width
          && signatureImage.height <= signatureCell.height
        ),
      };
    });
  });

  expect(printLayout).toHaveLength(2);
  for (const table of printLayout) {
    expect(Math.max(...table.rowHeights) - Math.min(...table.rowHeights)).toBeLessThan(1);
    expect(table.cellWidths[0]).toBeCloseTo(34, 0);
    expect(table.cellWidths[1]).toBeCloseTo(70, 0);
    expect(table.cellWidths.at(-1)).toBeCloseTo(88, 0);
    expect(table.signatureFitsCell).toBe(true);
  }
  const headerSpacing = await page.locator('.registry-print-page').first().evaluate((printPage) => (
    Array.from(printPage.querySelectorAll('p')).slice(0, 2).map((paragraph) => ({
      letterSpacing: getComputedStyle(paragraph).letterSpacing,
      fontKerning: getComputedStyle(paragraph).fontKerning,
      fits: paragraph.scrollWidth <= paragraph.clientWidth,
    }))
  ));
  for (const header of headerSpacing) {
    expect(['0px', 'normal']).toContain(header.letterSpacing);
    expect(header.fontKerning).toBe('none');
    expect(header.fits).toBe(true);
  }

  const excelDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '엑셀 다운로드' }).click();
  await expect((await excelDownload).suggestedFilename()).toBe('E2E 교직원 연수 등록부.xlsx');

  const pdfDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PDF 다운로드' }).click();
  await expect((await pdfDownload).suggestedFilename()).toBe('E2E 교직원 연수 등록부.pdf');

  expect(runtimeErrors).toEqual([]);
});

test('모바일 서명 창은 사진 입력 없이 직접 서명만 제공한다', async ({ page }, testInfo) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/s/registry/demo-digital-training-2026');
  await page.evaluate(() => {
    localStorage.removeItem('schooldoc_registry_v1');
    sessionStorage.clear();
  });
  await page.reload();
  await page.getByPlaceholder('이름 또는 소속 검색').fill('김하늘');
  await page.getByRole('button', { name: /김\*늘.*선택/ }).click();

  const dialog = page.getByRole('dialog', { name: '김하늘님 서명' });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('heading', { name: '직접 서명' })).toBeVisible();
  await expect(page.getByLabel('서명 입력 영역')).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(0);
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  const dialogLayout = await dialog.evaluate((element) => ({
    width: element.getBoundingClientRect().width,
    scrollWidth: element.scrollWidth,
  }));
  expect(dialogLayout.scrollWidth).toBeLessThanOrEqual(dialogLayout.width + 1);

  await testInfo.attach('direct-signature-mobile', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });

  const canvas = page.getByLabel('서명 입력 영역');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (!box) throw new Error('서명 입력 영역의 위치를 찾지 못했습니다.');
  await page.mouse.move(box.x + 60, box.y + 95);
  await page.mouse.down();
  await page.mouse.move(box.x + 140, box.y + 55, { steps: 5 });
  await page.mouse.move(box.x + 220, box.y + 105, { steps: 5 });
  await page.mouse.up();
  await page.getByRole('button', { name: '서명 제출' }).click();
  await expect(page.getByRole('heading', { name: '서명이 제출되었습니다' })).toBeVisible();

  const source = await page.evaluate(() => {
    const registries = JSON.parse(localStorage.getItem('schooldoc_registry_v1') ?? '[]') as Array<{
      participants: Array<{ name: string; signature?: { dataUrl: string; source: string } }>;
    }>;
    return registries
      .flatMap((registry) => registry.participants)
      .find((participant) => participant.name === '김하늘')?.signature?.source;
  });

  expect(source).toBe('draw');
  expect(runtimeErrors).toEqual([]);
});

test('서명 링크 QR을 이미지 파일로 저장한다', async ({ page }) => {
  // QR을 그렸다면 언제나 이미지로 받을 수 있어야 한다는 제품 원칙을 실제 브라우저에서 확인한다.
  await page.goto('/tools/registry-sign/new');
  await page.evaluate(() => {
    localStorage.removeItem('schooldoc_registry_v1');
    sessionStorage.clear();
  });
  await page.reload();

  await page.getByLabel(/문서 제목/).fill('QR 저장 확인 등록부');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('1번 참석자 성명').fill('테스트교사');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '등록부 생성' }).click();
  await expect(page).toHaveURL(/\/tools\/registry-sign\/[^/]+$/);

  const saveButton = page.getByRole('button', { name: 'QR 이미지 저장' });
  await expect(saveButton).toBeVisible();

  const download = await Promise.all([
    page.waitForEvent('download'),
    saveButton.click(),
  ]).then(([event]) => event);

  expect(download.suggestedFilename()).toBe('QR 저장 확인 등록부_서명QR.png');

  // 빈 파일이 떨어지면 저장은 됐지만 QR이 담기지 않은 것이다.
  const path = await download.path();
  expect(path).toBeTruthy();
  const { statSync } = await import('node:fs');
  expect(statSync(path!).size).toBeGreaterThan(1000);
});

test('인쇄 미리보기 아래에 빈 공간이 남지 않는다', async ({ page }) => {
  // transform: scale()은 그려지는 크기만 줄이고 차지하는 자리는 그대로 둔다. 예전에는 그래서
  // 미리보기 아래에 원본 높이의 남은 만큼(72%면 314px) 회색 공백이 생겼다.
  await page.goto('/tools/registry-sign/new');
  await page.evaluate(() => {
    localStorage.removeItem('schooldoc_registry_v1');
    sessionStorage.clear();
  });
  await page.reload();

  await page.getByLabel(/문서 제목/).fill('미리보기 여백 확인');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('1번 참석자 성명').fill('테스트교사');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '등록부 생성' }).click();
  await expect(page).toHaveURL(/\/tools\/registry-sign\/[^/]+$/);

  const gap = await page.locator('.registry-print-frame').evaluate((frame) => {
    const page1 = frame.querySelector('.registry-print-page');
    if (!page1) throw new Error('인쇄 미리보기를 찾지 못했습니다.');
    return Math.round(frame.getBoundingClientRect().height - page1.getBoundingClientRect().height);
  });
  // 차지하는 자리와 그려지는 크기가 같아야 한다. 반올림 오차만 허용한다.
  expect(Math.abs(gap)).toBeLessThanOrEqual(1);
});
