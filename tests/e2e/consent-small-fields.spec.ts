import { expect, test } from '@playwright/test';
import { jsPDF } from 'jspdf';

for (const width of [1440, 390]) test('좁은 PDF 표에 텍스트 칸 배치·저장·응답 ' + width, async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  // 편집은 데스크톱에서 하고 같은 저장 좌표를 PC·모바일 응답 화면에서 검증한다.
  await page.setViewportSize({width:1440,height:1000});
  const pdf = new jsPDF({unit:'mm',format:'a4'});
  pdf.setProperties({title:'Small table consent'});
  pdf.text('Parent name', 20, 182);
  pdf.rect(70,178,110,8); pdf.rect(70,186,110,8);
  await page.goto('/tools/consent-forms/new');
  await page.getByLabel('가정통신문 PDF 파일').setInputFiles({name:'small-table.pdf',mimeType:'application/pdf',buffer:Buffer.from(pdf.output('arraybuffer'))});
  await page.getByRole('button',{name:'확인 후 필드 배치'}).click();
  await page.getByRole('button',{name:'텍스트',exact:true}).click();
  const settings = page.getByTestId('consent-field-settings');
  await settings.getByLabel('높이',{exact:true}).fill('1.8');
  await settings.getByLabel('너비',{exact:true}).fill('50');
  await settings.getByLabel('가로 위치',{exact:true}).fill('35');
  await settings.getByLabel('세로 위치',{exact:true}).fill('60.1');
  const field = page.getByRole('button',{name:'텍스트 필드',exact:true});
  const canvas = page.getByTestId('consent-field-canvas');
  expect(await field.evaluate(el => el.getBoundingClientRect().height / el.parentElement!.getBoundingClientRect().height)).toBeCloseTo(.018,3);
  await expect(settings.getByLabel('높이',{exact:true})).toHaveValue('1.8');
  // 키보드로도 종전 4% 하한을 넘겨 축소할 수 있다.
  await field.focus(); await page.keyboard.press('Alt+ArrowUp');
  await expect(settings.getByLabel('높이',{exact:true})).toHaveValue('1.7');
  // 작은 상자의 상하 조절점 클릭 영역이 겹치면 실제 드래그가 불가능해진다.
  const nw = await field.locator('[data-resize-handle="nw"]').boundingBox();
  const sw = await field.locator('[data-resize-handle="sw"]').boundingBox();
  expect(nw!.y + nw!.height).toBeLessThanOrEqual(sw!.y);
  const se = await field.locator('[data-resize-handle="se"]').boundingBox();
  await page.mouse.move(se!.x + se!.width / 2,se!.y + se!.height / 2); await page.mouse.down();
  await page.mouse.move(se!.x + se!.width / 2,se!.y + se!.height / 2 - 100); await page.mouse.up();
  await expect(settings.getByLabel('높이',{exact:true})).toHaveValue('1');
  await settings.getByLabel('높이',{exact:true}).fill('1.8');
  await canvas.screenshot({path:'test-results/consent-small-field-editor-' + width + '.png'});
  await page.getByRole('button',{name:'필드 배치 완료'}).click();
  await page.getByLabel('명단 없이 받기').check();
  await page.getByRole('button',{name:'다음: 공유 설정'}).click();
  await page.getByRole('button',{name:'수합 만들기'}).click();
  await page.getByRole('button',{name:'관리·공유'}).click();
  const href = await page.getByLabel('응답 화면 열기').getAttribute('href');
  await page.setViewportSize({width,height:900});
  await page.goto(href!);
  await page.getByRole('button', { name: '입력 시작' }).click();
  const input = page.getByRole('textbox',{name:'텍스트 필수'});
  await expect(input).toBeVisible();
  const overlay = page.getByTestId('consent-original-field');
  const rect = await overlay.evaluate(el => ({
    height: el.getBoundingClientRect().height, pageHeight: el.parentElement!.getBoundingClientRect().height,
  }));
  expect(rect.height / rect.pageHeight).toBeCloseTo(.018,3);
  if (width < 640) expect((await input.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  else expect((await input.boundingBox())!.height).toBeCloseTo(rect.height, 0);
  await input.fill('김태호');
  await page.screenshot({path:'test-results/consent-small-field-response-' + width + '.png',fullPage:true});
  await page.getByRole('button', { name: '응답 확인' }).click();
  await page.getByRole('button',{name:'작성 완료'}).click();
  await expect(page.getByRole('heading',{name:'응답을 제출했습니다'})).toBeVisible();
  expect(errors).toEqual([]);
});
