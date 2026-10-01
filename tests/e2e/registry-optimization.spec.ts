import { expect, test, type Page } from '@playwright/test';

// 모든 명단을 생성 화면의 입력으로 만든다. 운영 Supabase 자료를 사용하지 않는다.
async function createFixture(page: Page, rows: string, title = '등록부 개선 회귀 검증') {
  await page.goto('/tools/registry-sign/new');
  await page.getByLabel(/문서 제목/).fill(title);
  await page.getByRole('button', { name:'다음',exact:true }).click();
  await page.getByLabel(/표 붙여넣기/).fill(rows);
  await page.getByRole('button', { name:'명단 확인',exact:true }).click();
  await page.getByRole('button', { name:'기존 명단 바꾸기',exact:true }).click();
  await page.getByRole('button', { name:'다음',exact:true }).click();
  await page.getByRole('button', { name:'2단 20명',exact:true }).click();
  await page.getByRole('button', { name:'다음',exact:true }).click();
  await page.getByRole('button', { name:'등록부 생성',exact:true }).click();
  await expect(page).toHaveURL(/\/tools\/registry-sign\/[^/]+$/);
  return { manage:page.url(), publicUrl:await page.getByLabel('서명 링크 주소').inputValue() };
}
async function draw(page: Page) {
  const canvas=page.getByLabel('서명 입력 영역');
  await canvas.scrollIntoViewIfNeeded();
  const box=await canvas.boundingBox();
  if (!box) throw new Error('서명 캔버스 없음');
  await page.mouse.move(box.x+40,box.y+80);
  await page.mouse.down();
  await page.mouse.move(box.x+180,box.y+110,{steps:8});
  await page.mouse.up();
}
const ink = (page: Page) => page.getByLabel('서명 입력 영역').evaluate((element) => {
  const c=element as HTMLCanvasElement;
  const pixels=c.getContext('2d')!.getImageData(0,0,c.width,c.height).data;
  let count=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i])count++;
  return count;
});

test('가져오기 취소·추가·되돌리기와 포커스 복귀가 기존 명단을 보존한다',async({page})=>{
  await page.goto('/tools/registry-sign/new');
  await page.getByLabel(/문서 제목/).fill('가져오기 보존');
  await page.getByRole('button',{name:'다음',exact:true}).click();
  await page.getByLabel('1번 참석자 성명',{exact:true}).fill('기존가상교사');
  await page.getByLabel(/표 붙여넣기/).fill('성명\t소속\n새가상교사\t새가상학교');
  const button=page.getByRole('button',{name:'명단 확인',exact:true});await button.click();
  const dialog=page.getByRole('dialog',{name:'가져올 명단 확인'});
  await expect(dialog).toContainText('새 명단 1명 · 현재 명단 1명');
  await expect(dialog.getByRole('button',{name:'취소',exact:true})).toBeFocused();
  for(let i=0;i<7;i++){await page.keyboard.press('Tab');expect(await dialog.evaluate(e=>e.contains(document.activeElement))).toBe(true);}
  await page.keyboard.press('Escape');await expect(button).toBeFocused();
  await expect(page.getByLabel('1번 참석자 성명',{exact:true})).toHaveValue('기존가상교사');
  await button.click();await dialog.getByRole('button',{name:'명단에 추가'}).click();
  await expect(page.getByLabel('2번 참석자 성명',{exact:true})).toHaveValue('새가상교사');
  await page.getByRole('button',{name:'가져오기 되돌리기'}).click();
  await expect(page.getByLabel('1번 참석자 성명',{exact:true})).toHaveValue('기존가상교사');
  await expect(page.getByLabel('2번 참석자 성명',{exact:true})).toHaveCount(0);
});

test('같은 마스킹 동명이인을 코드로 구분하고 오류·화면 크기 변경 뒤 획을 보존한다',async({page})=>{
  const links=await createFixture(page,'성명\t소속\n가상동명\t가상학교A\n가상동명\t가상학교B');
  const row=page.locator('tr').filter({hasText:'가상학교B'}).filter({has:page.getByRole('button',{name:'가상동명 확인 코드 발급'})});
  await row.getByRole('button',{name:'가상동명 확인 코드 발급'}).click();
  const code=(await page.getByRole('status').innerText()).match(/코드: (\d{6})/)![1];
  await page.setViewportSize({width:390,height:844});await page.goto(links.publicUrl);
  await page.getByLabel('이름 검색',{exact:true}).fill('가상동명');
  await page.getByRole('button',{name:'검색',exact:true}).click();
  await expect(page.getByRole('button',{name:/가\*\*명.*선택/})).toHaveCount(2);
  await page.getByLabel('이름 검색',{exact:true}).fill('없는사람');
  await expect(page.getByRole('button',{name:/가\*\*명.*선택/})).toHaveCount(0);
  await page.getByLabel('이름 검색',{exact:true}).fill('가상동명');
  await page.getByLabel('검색 확인 코드',{exact:true}).fill(code);
  await page.getByRole('button',{name:'검색',exact:true}).click();
  await expect(page.getByRole('button',{name:/가\*\*명.*선택/})).toHaveCount(1);
  await page.getByRole('button',{name:/가\*\*명.*선택/}).click();
  await expect(page.getByLabel('확인 코드',{exact:true})).toHaveValue(code);
  await page.getByLabel('확인 코드',{exact:true}).fill('000000');await draw(page);
  await page.getByRole('button',{name:'서명 제출',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('본인 확인');
  expect(await ink(page)).toBeGreaterThan(100);
  await page.setViewportSize({width:768,height:1024});await expect.poll(()=>ink(page)).toBeGreaterThan(100);
  await page.setViewportSize({width:390,height:844});await expect.poll(()=>ink(page)).toBeGreaterThan(100);
  await page.getByLabel('확인 코드',{exact:true}).fill(code);await page.getByRole('button',{name:'서명 제출',exact:true}).click();
  await expect(page.getByRole('heading',{name:'서명이 제출되었습니다'})).toBeVisible();
  await page.getByRole('button',{name:'다른 사람 서명하기'}).click();
  await expect(page.getByLabel('검색 확인 코드',{exact:true})).toHaveValue('');
  await page.goto(links.manage);
  const list=page.locator('section').filter({has:page.getByRole('heading',{name:'참석자 명단',exact:true})});
  await expect(list.getByRole('row').filter({hasText:'가상학교A'})).toContainText('미서명');
  await expect(list.getByRole('row').filter({hasText:'가상학교B'})).toContainText('완료');
});

test('현장 입력 취소는 행을 만들지 않고 최종 제출만 원문과 서명을 저장한다',async({page})=>{
  const links=await createFixture(page,'성명\t소속\n사전가상교사\t가상학교');
  await page.goto(links.publicUrl);
  await page.getByLabel('성명',{exact:true}).fill('현장가상교사');await page.getByLabel('소속',{exact:true}).fill('원문가상학교');
  await page.getByRole('button',{name:'정보 확인 후 서명하기'}).click();
  await page.getByRole('button',{name:'서명 창 닫기'}).click();
  await page.goto(links.manage);
  const list=page.locator('section').filter({has:page.getByRole('heading',{name:'참석자 명단',exact:true})});
  await expect(list.getByRole('row').filter({hasText:'현장가상교사'})).toHaveCount(0);
  await page.goto(links.publicUrl);
  await page.getByLabel('성명',{exact:true}).fill('현장가상교사');await page.getByLabel('소속',{exact:true}).fill('원문가상학교');
  await page.getByRole('button',{name:'정보 확인 후 서명하기'}).click();
  await expect(page.getByRole('dialog').getByLabel('소속',{exact:true})).toHaveValue('원문가상학교');await draw(page);
  await page.getByRole('button',{name:'서명 제출',exact:true}).click();await expect(page.getByRole('heading',{name:'서명이 제출되었습니다'})).toBeVisible();
  await page.goto(links.manage);await expect(list.getByRole('row').filter({hasText:'현장가상교사'})).toContainText('원문가상학교');
  await expect(list.getByRole('row').filter({hasText:'현장가상교사'})).toContainText('완료');
});

test('공유·보관 설정과 링크 회수 및 종료 후 파기 수량을 확인한다',async({page})=>{
  const links=await createFixture(page,'성명\t소속\n가상교사\t가상학교');
  await page.getByText('공유·보관 설정',{exact:true}).click();
  await page.getByLabel('종료 후 보관 기간').selectOption('1');
  await page.getByLabel('명단 외 참석자 추가 허용').uncheck();
  await page.getByRole('button',{name:'공개 링크 재발급',exact:true}).click();
  await page.getByRole('alertdialog').getByRole('button',{name:'링크 재발급',exact:true}).click();
  const updated=await page.getByLabel('서명 링크 주소').inputValue();expect(updated).not.toBe(links.publicUrl);
  await page.goto(links.publicUrl);await expect(page.getByRole('heading',{name:'등록부를 찾을 수 없습니다'})).toBeVisible();
  await page.goto(updated);await expect(page.getByRole('heading',{name:'명단에 이름이 없나요?'})).toHaveCount(0);
  await page.goto(links.manage);await page.getByText('공유·보관 설정',{exact:true}).click();
  await expect(page.getByLabel('종료 후 보관 기간')).toHaveValue('1');
  await expect(page.getByRole('button',{name:'파기 대상 확인',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'수합 종료',exact:true}).click();
  await page.getByRole('button',{name:'파기 대상 확인',exact:true}).click();
  await expect(page.getByRole('alertdialog')).toContainText('참석자 1명 · 서명 0건 · 서명 파일 0개');
  await page.getByRole('alertdialog').getByRole('button',{name:'취소',exact:true}).click();
  await expect(page.getByRole('heading',{name:'등록부를 영구 파기할까요?'})).toHaveCount(0);
});

test('네 열과 긴 셀은 한 단으로 출력하고 A4 셀·하단을 넘지 않는다',async({page},testInfo)=>{
  await page.goto('/tools/registry-sign/new');await page.getByLabel(/문서 제목/).fill('긴 정보 출력 검증');
  await page.getByRole('button',{name:'다음',exact:true}).click();
  for(let i=0;i<3;i++)await page.getByRole('button',{name:'열 추가',exact:true}).click();
  await page.getByLabel(/표 붙여넣기/).fill('성명\t소속\t추가 항목 2\t추가 항목 3\t추가 항목 4\n가상교사\t'+ '긴소속정보'.repeat(30)+'\t입력값2\t입력값3\t마지막값4');
  await page.getByRole('button',{name:'명단 확인',exact:true}).click();await page.getByRole('button',{name:'기존 명단 바꾸기',exact:true}).click();
  await page.getByRole('button',{name:'다음',exact:true}).click();await page.getByRole('button',{name:'2단 20명',exact:true}).click();
  const sheet=page.locator('.registry-print-page');await expect(sheet.locator('table')).toHaveCount(1);
  await expect(sheet).toContainText('마지막값4');
  const overflow=await sheet.evaluate(e=>({height:e.scrollHeight,client:e.clientHeight,cells:Array.from(e.querySelectorAll('td')).filter(c=>c.textContent?.trim()).map(c=>({scroll:c.scrollHeight,height:c.clientHeight,width:c.scrollWidth,client:c.clientWidth}))}));
  expect(overflow.height).toBeLessThanOrEqual(overflow.client+1);
  for(const cell of overflow.cells){expect(cell.scroll).toBeLessThanOrEqual(cell.height+1);expect(cell.width).toBeLessThanOrEqual(cell.client+1);}
  await testInfo.attach('four-column-long-values',{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
});

test('Chrome 인쇄 엔진은 41명 전체를 원본 A4 세 쪽으로 출력한다',async({page},testInfo)=>{
  await createFixture(page,'성명\t소속\n'+Array.from({length:41},(_,i)=>`가상교사${i+1}\t가상학교${i+1}`).join('\n'),'Chrome A4 전체 인쇄 검증');
  await expect(page.locator('.registry-print-page')).toHaveCount(1);
  const pdf=await page.pdf({preferCSSPageSize:true,printBackground:true});
  // Chrome은 Page 사전을 압축하지 않는다. /Pages 트리 노드는 이 패턴에 포함되지 않는다.
  await testInfo.attach('chrome-native-print-three-pages',{body:pdf,contentType:'application/pdf'});
  expect(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)).toHaveLength(3);
  await expect(page.locator('.registry-print-page')).toHaveCount(1);
});
