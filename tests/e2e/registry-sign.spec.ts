import { expect, test } from '@playwright/test';
import writeXlsxFile from 'write-excel-file/node';

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
  const publicUrl = await page.getByRole('textbox', { name: '참석자 서명 링크', exact: true }).inputValue();

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

test('촬영한 서명 사진의 배경과 여백을 정리해 제출한다', async ({ page }, testInfo) => {
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
  await page.getByRole('tab', { name: '사진 촬영' }).click();

  const photoBase64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 800;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('테스트 사진을 만들 수 없습니다.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = '#111827';
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = 28;
    context.beginPath();
    context.moveTo(300, 420);
    context.bezierCurveTo(420, 220, 500, 620, 610, 360);
    context.bezierCurveTo(720, 180, 760, 550, 900, 340);
    context.stroke();
    return canvas.toDataURL('image/png').split(',')[1];
  });

  await page.locator('input[type="file"]:not([capture])').setInputFiles({
    name: 'signature-photo.png',
    mimeType: 'image/png',
    buffer: Buffer.from(photoBase64, 'base64'),
  });

  await expect(page.getByText(/사진 보정 완료/)).toBeVisible();
  await expect(page.getByAltText('보정된 서명 사진')).toBeVisible();
  await testInfo.attach('photo-signature-mobile', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
  await page.getByRole('button', { name: '서명 제출' }).click();
  await expect(page.getByRole('heading', { name: '서명이 제출되었습니다' })).toBeVisible();

  const normalized = await page.evaluate(() => {
    const registries = JSON.parse(localStorage.getItem('schooldoc_registry_v1') ?? '[]') as Array<{
      participants: Array<{ name: string; signature?: { dataUrl: string; source: string } }>;
    }>;
    const signature = registries
      .flatMap((registry) => registry.participants)
      .find((participant) => participant.name === '김하늘')?.signature;
    if (!signature) throw new Error('저장된 사진 서명을 찾지 못했습니다.');

    return new Promise<{ bytes: number; width: number; height: number; cornerAlpha: number; source: string }>((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('저장된 서명을 확인할 수 없습니다.'));
          return;
        }
        context.drawImage(image, 0, 0);
        resolve({
          bytes: Math.floor((signature.dataUrl.split(',')[1]?.length ?? 0) * 0.75),
          width: image.naturalWidth,
          height: image.naturalHeight,
          cornerAlpha: context.getImageData(0, 0, 1, 1).data[3],
          source: signature.source,
        });
      };
      image.onerror = () => reject(new Error('저장된 서명을 열 수 없습니다.'));
      image.src = signature.dataUrl;
    });
  });

  expect(normalized.source).toBe('photo');
  expect(normalized.bytes).toBeLessThanOrEqual(200 * 1024);
  expect(normalized.width).toBeLessThanOrEqual(1000);
  expect(normalized.height).toBeLessThanOrEqual(400);
  expect(normalized.cornerAlpha).toBe(0);
  expect(runtimeErrors).toEqual([]);
});
