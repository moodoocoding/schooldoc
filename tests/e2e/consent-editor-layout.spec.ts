import { expect, test, type Page } from '@playwright/test';
import { jsPDF } from 'jspdf';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { finishConsentFieldPlacement } from './consentFieldPlacement';

const evidence = 'design/consent-field-editor/2026-10-02/evidence';
const phase = process.env.CONSENT_UI_PHASE ?? 'final';
const longName = '가상보호자긴이름표시확인'.repeat(6).slice(0,60);
const longIdentity = '가상학생식별값줄바꿈확인'.repeat(6).slice(0,60);
const errorsOf = (page: Page) => { const errors: string[]=[]; page.on('pageerror',error=>errors.push(error.message)); return errors; };
async function capture(page: Page, name: string) {
  await mkdir(evidence,{recursive:true});
  if(await page.getByTestId('consent-field-canvas').count()) await expect(page.getByTestId('consent-field-canvas').locator('[data-pdf-state]')).toHaveAttribute('data-pdf-state','ready');
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:`${evidence}/${phase}-${name}.png`,fullPage:true});
}
const noOverflow = async(page: Page) => expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
function documentPdf(pages=5) {
  const pdf=new jsPDF({unit:'mm',format:'a4'});
  pdf.setProperties({title:'Fictional family notice'});
  for(let p=0;p<pages;p++) {
    if(p) pdf.addPage();
    pdf.setFontSize(18); pdf.text(`School notice - page ${p+1}`,20,25);
    pdf.setFontSize(11);
    for(let row=0;row<12;row++) pdf.text(`Fictional family guidance ${row+1}: Please review this original notice.`,20,45+row*9);
    pdf.rect(20,162,170,24); pdf.text('Parent name:',24,178);
    pdf.rect(20,196,170,15); pdf.text('YES [ ]       NO [ ]',24,205);
    pdf.rect(110,229,80,25); pdf.text('Signature:',24,240);
    pdf.text('Original content remains visible below response fields.',20,274);
  }
  return pdf;
}
async function openEditor(page: Page) {
  await page.goto('/tools/consent-forms/new');
  await page.getByLabel('가정통신문 PDF 파일').setInputFiles({name:'fictional-five-pages.pdf',mimeType:'application/pdf',buffer:Buffer.from(documentPdf().output('arraybuffer'))});
  await page.getByRole('button',{name:'확인 후 필드 배치'}).click();
  await expect(page.getByTestId('consent-field-canvas').locator('[data-pdf-state="ready"]')).toBeVisible();
}
async function seedManage(page: Page, count: number) {
  await page.goto('/');
  const recipients=Array.from({length:count},(_,i)=>({id:`person-${i}`,formId:'ui-roster',token:`fictional-token-${i}`,name:i===0?longName:`가상학생${i+1}`,studentKey:i===0?longIdentity:`301${String(i+1).padStart(2,'0')}`,responseId:i<8?`response-${i}`:null,submittedAt:i<8?'2026-10-01T12:00:00Z':null}));
  const responses=recipients.filter(r=>r.responseId).map(r=>({id:r.responseId,formId:'ui-roster',recipientId:r.id,submittedAt:r.submittedAt,values:{opinion:'가상 보호자 응답'},signatures:[]}));
  await page.evaluate(({recipients,responses,source,count})=>{
    localStorage.setItem('schooldoc:consent-forms:drafts',JSON.stringify([{id:'ui-roster',title:'가상 현장체험학습 안내',fileName:'fictional.pdf',fields:[{id:'opinion',kind:'text',label:'보호자 의견',required:true,pageIndex:0,x:20,y:40,width:30,height:5}],publicToken:'ui-public-token',recipientMode:count?'named':'open',recipientCount:count,responseCount:responses.length,currentResponseCount:responses.length,status:'open',sourcePdfDataUrl:source,pageCount:1,pageSizes:[{width:595.28,height:841.89}]}]));
    localStorage.setItem('schooldoc:consent-forms:recipients',JSON.stringify(recipients));
    localStorage.setItem('schooldoc:consent-forms:responses',JSON.stringify(responses));
  },{recipients,responses,source:documentPdf(1).output('datauristring'),count});
  await page.goto('/tools/consent-forms/ui-roster');
}

test('큰 원본 옆의 왼쪽 도구에서 다쪽 필드를 이동·확대·복사한다',async({page})=>{
  const errors=errorsOf(page); await page.setViewportSize({width:1570,height:900}); await openEditor(page);
  const canvas=page.getByTestId('consent-field-canvas'); const original=await canvas.boundingBox(); const tools=await page.getByTestId('consent-field-tools').boundingBox();
  expect(original!.width).toBeGreaterThan(800); expect(tools!.x+tools!.width).toBeLessThan(original!.x);
  const help=page.locator('details').filter({has:page.getByText('단축키 안내',{exact:true})}); expect(await help.evaluate(el=>(el as HTMLDetailsElement).open)).toBe(false);
  await capture(page,'editor-empty-desktop');
  await page.getByRole('button',{name:'텍스트',exact:true}).click(); await page.getByLabel('표시 이름').fill('보호자 성명');
  const field=page.getByRole('button',{name:'보호자 성명 필드',exact:true}); await field.scrollIntoViewIfNeeded();
  const before=await field.boundingBox(); await page.mouse.move(before!.x+before!.width/2,before!.y+before!.height/2); await page.mouse.down(); await page.mouse.move(original!.x+original!.width*0.60,original!.y+original!.height*0.59,{steps:8}); await page.mouse.up();
  const moved=await field.boundingBox(); expect(moved!.x).toBeGreaterThan(before!.x+50);
  await page.getByRole('button',{name:'필드 설정 닫기'}).click(); await field.focus(); await page.keyboard.press('Enter'); await expect(page.getByLabel('표시 이름')).toHaveValue('보호자 성명');
  await page.getByRole('button',{name:'필드 설정 닫기'}).click(); await field.focus(); await page.keyboard.press('Space'); await expect(page.getByLabel('표시 이름')).toHaveValue('보호자 성명');
  await page.keyboard.press('ArrowRight'); expect((await field.boundingBox())!.x).toBeGreaterThan(moved!.x);
  const keyboardHeight=(await field.boundingBox())!.height; await page.keyboard.press('Alt+ArrowDown'); expect((await field.boundingBox())!.height).toBeGreaterThan(keyboardHeight);
  await page.getByRole('button',{name:'확대',exact:true}).click(); expect((await canvas.boundingBox())!.width).toBeCloseTo(original!.width*1.25,0); await noOverflow(page);
  await page.getByRole('button',{name:'너비 맞춤'}).click(); expect((await canvas.boundingBox())!.width).toBeCloseTo(original!.width,0);
  await page.getByRole('button',{name:'복사',exact:true}).click(); await page.getByLabel('쪽 번호').fill('5'); await page.getByRole('button',{name:'붙여넣기',exact:true}).click();
  const placed=page.getByRole('region',{name:'배치된 필드'}); await expect(placed.getByRole('button',{name:/보호자 성명/})).toHaveCount(2);
  await page.getByRole('button',{name:'되돌리기',exact:true}).click(); await expect(placed.getByRole('button',{name:/보호자 성명/})).toHaveCount(1);
  await page.getByRole('button',{name:'다시 실행',exact:true}).click(); await expect(placed.getByRole('button',{name:/보호자 성명/})).toHaveCount(2);
  await page.getByText('단축키 안내',{exact:true}).click(); expect(await help.evaluate(el=>(el as HTMLDetailsElement).open)).toBe(true); await page.getByText('단축키 안내',{exact:true}).click();
  await page.getByLabel('쪽 번호').fill('1'); await field.click(); await expect(page.getByRole('status').filter({hasText:'다시 실행했습니다.'})).toBeHidden(); await page.evaluate(()=>scrollTo(0,0)); await capture(page,'editor-selected-desktop');
  await page.evaluate(()=>document.documentElement.style.fontSize='200%'); await noOverflow(page); await capture(page,'editor-desktop-css200'); await page.evaluate(()=>document.documentElement.style.fontSize='');
  await finishConsentFieldPlacement(page); await expect(page.getByRole('heading',{name:'누가 응답할지 정하기'})).toBeVisible(); await page.getByRole('button',{name:'필드 배치로'}).click();
  await expect(placed.getByRole('button',{name:/보호자 성명/})).toHaveCount(2); expect(errors).toEqual([]);
});

test('모바일 편집은 원본과 설정을 오가며 입력과 좌표를 유지한다',async({page})=>{
  const errors=errorsOf(page); await page.setViewportSize({width:390,height:844}); await openEditor(page);
  await page.getByRole('button',{name:'텍스트',exact:true}).click(); await page.getByLabel('표시 이름').fill('모바일 보호자 성명');
  await expect(page.getByTestId('consent-field-settings')).toBeVisible(); expect(await page.getByTestId('consent-field-settings').evaluate(el => Number(getComputedStyle(el).zIndex))).toBeGreaterThan(await page.getByTestId('consent-editor-document-toolbar').evaluate(el => Number(getComputedStyle(el).zIndex))); await noOverflow(page); await capture(page,'editor-mobile-settings');
  await page.getByRole('button',{name:'필드 설정 닫기'}).click(); await expect(page.getByRole('button',{name:'모바일 보호자 성명 필드',exact:true})).toBeVisible();
  await page.getByTestId('consent-field-canvas').scrollIntoViewIfNeeded(); await capture(page,'editor-mobile-document'); await noOverflow(page);
  await page.getByRole('button',{name:'모바일 보호자 성명 필드',exact:true}).click(); await expect(page.getByLabel('표시 이름')).toHaveValue('모바일 보호자 성명');
  expect(errors).toEqual([]);
});

for(const count of [0,24,60]) test(`공유를 먼저 찾고 응답·명단을 접어도 자료를 유지한다 ${count}명`,async({page})=>{
  const errors=errorsOf(page); await page.setViewportSize({width:1366,height:900}); await seedManage(page,count);
  const share=page.getByTestId('consent-share-panel'); const shareBox=await share.boundingBox(); const responses=page.getByRole('region',{name:'받은 응답'}); expect(shareBox!.y+shareBox!.height).toBeLessThanOrEqual((await responses.boundingBox())!.y);
  await capture(page,`manage-${count}-desktop`); const content=await page.locator('#consent-response-list').textContent();
  await page.getByRole('button',{name:'응답 목록 접기'}).click(); await expect(page.locator('#consent-response-list')).toBeHidden();
  if(count) {await page.getByRole('button',{name:'명단 목록 접기'}).click(); await expect(page.locator('#consent-recipient-list')).toBeHidden();}
  await page.getByRole('button',{name:'설정 수정',exact:true}).click(); await page.getByRole('button',{name:'설정 저장',exact:true}).click(); await expect(page.locator('#consent-response-list')).toBeHidden(); if(count) await expect(page.locator('#consent-recipient-list')).toBeHidden();  await capture(page,`manage-${count}-collapsed-desktop`);
  await page.setViewportSize({width:390,height:844}); await noOverflow(page); await capture(page,`manage-${count}-collapsed-mobile`); await page.setViewportSize({width:1366,height:900});
  if(count) await page.getByRole('button',{name:'명단 목록 펼치기'}).click();
  await page.getByRole('button',{name:'응답 목록 펼치기'}).click(); expect(await page.locator('#consent-response-list').textContent()).toBe(content);
  const download=page.waitForEvent('download'); await page.getByRole('button',{name:'QR 이미지 저장',exact:true}).click(); await (await download).saveAs(`${evidence}/${phase}-public-qr.png`);
  await page.setViewportSize({width:390,height:844}); await noOverflow(page); await capture(page,`manage-${count}-mobile`);
  const axe=await new AxeBuilder({page}).include('main').analyze(); expect(axe.violations).toEqual([]); expect(errors).toEqual([]);
});

test('긴 이름·식별값을 QR 카드에 모두 표시하고 다쪽 A4와 PNG로 저장한다',async({page})=>{
  const errors=errorsOf(page); await page.setViewportSize({width:1366,height:900}); await seedManage(page,24); await page.getByRole('button',{name:'개인 QR 배부 자료',exact:true}).click();
  await expect(page.getByTestId('consent-qr-page')).toHaveCount(4); await expect(page.getByTestId('consent-qr-name').first()).toHaveText(longName); await expect(page.getByTestId('consent-qr-identity').first()).toHaveText(longIdentity);
  const clipped=await page.getByTestId('consent-qr-card').evaluateAll(cards=>cards.some(card=>[...card.querySelectorAll('p')].some(text=>{const r=text.getBoundingClientRect(),c=card.getBoundingClientRect();return text.scrollWidth>text.clientWidth+1||text.scrollHeight>text.clientHeight+1||r.bottom>c.bottom||r.right>c.right;}))); expect(clipped).toBe(false);
  expect(await page.getByTestId('consent-qr-card').first().locator('svg').first().getAttribute('width')).toBe('104');
  await capture(page,'qr-long-desktop'); const image=page.waitForEvent('download'); await page.getByRole('button',{name:`${longName} QR 이미지 저장`,exact:true}).click(); await (await image).saveAs(`${evidence}/${phase}-personal-qr.png`);
  const pdf=page.waitForEvent('download'); await page.getByRole('button',{name:'PDF 다운로드',exact:true}).click(); await (await pdf).saveAs(`${evidence}/${phase}-qr-download.pdf`);
  await page.pdf({path:`${evidence}/${phase}-qr-print.pdf`,format:'A4',printBackground:true,preferCSSPageSize:true});
  await page.setViewportSize({width:390,height:844}); await noOverflow(page); await capture(page,'qr-long-mobile');
  await page.getByRole('button',{name:'미제출자 16명',exact:true}).click(); await expect(page.getByTestId('consent-qr-page')).toHaveCount(3); expect(errors).toEqual([]);
});
test('60명 QR도 열 장의 A4에 명단을 빠짐없이 인쇄한다',async({page})=>{
  await page.setViewportSize({width:1366,height:900}); await seedManage(page,60); await page.getByRole('button',{name:'개인 QR 배부 자료',exact:true}).click();
  await expect(page.getByTestId('consent-qr-page')).toHaveCount(10); await expect(page.getByTestId('consent-qr-card')).toHaveCount(60);
  await page.pdf({path:`${evidence}/${phase}-qr-60-print.pdf`,format:'A4',printBackground:true,preferCSSPageSize:true});
  await page.getByTestId('consent-qr-page').last().scrollIntoViewIfNeeded(); await capture(page,'qr-60-desktop');
  await page.getByRole('button',{name:'미제출자 52명',exact:true}).click(); await expect(page.getByTestId('consent-qr-page')).toHaveCount(9); await expect(page.getByTestId('consent-qr-card')).toHaveCount(52);
});
test('QR 배부 자료는 모바일·태블릿·데스크톱에서 모두 보이고 A4 저장 규격을 유지한다',async({page})=>{
  const errors=errorsOf(page); await seedManage(page,6); await page.getByRole('button',{name:'개인 QR 배부 자료',exact:true}).click();
  const measurements=[];
  for(const width of [390,640,768,1024,1280,1570]) {
    await page.setViewportSize({width,height:900}); await noOverflow(page);
    await expect(page.getByTestId('consent-qr-card')).toHaveCount(6);
    const measured=await page.getByTestId('consent-qr-page').evaluateAll(papers=>papers.map(paper=>({width:innerWidth,paper:paper.getBoundingClientRect().toJSON(),outside:[...paper.querySelectorAll('[data-testid="consent-qr-card"],svg,[data-testid="consent-qr-name"],[data-testid="consent-qr-identity"],button')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&(r.left<0||r.right>innerWidth+1);}).length,clipped:[...paper.querySelectorAll('[data-testid="consent-qr-card"]')].filter(card=>[...card.querySelectorAll('p')].some(el=>{const r=el.getBoundingClientRect(),c=card.getBoundingClientRect();return el.scrollWidth>el.clientWidth+1||el.scrollHeight>el.clientHeight+1||r.bottom>c.bottom+1||r.right>c.right+1;})).length})));
    expect(measured[0].outside).toBe(0); expect(measured[0].clipped).toBe(0); measurements.push(...measured);
    await expect(page.getByTestId('consent-qr-name').first()).toHaveText(longName); await expect(page.getByTestId('consent-qr-identity').first()).toHaveText(longIdentity);
    await capture(page,`qr-width-${width}`);
  }
  await page.setViewportSize({width:768,height:900});
  const pdf=page.waitForEvent('download'); await page.getByRole('button',{name:'PDF 다운로드',exact:true}).click(); await (await pdf).saveAs(`${evidence}/tablet-qr-768-download.pdf`);
  await page.setViewportSize({width:390,height:844}); await page.pdf({path:`${evidence}/tablet-qr-390-print.pdf`,format:'A4',printBackground:true,preferCSSPageSize:true});
  await writeFile(`${evidence}/tablet-qr-layout.json`,JSON.stringify({browser:page.context().browser()!.version(),widths:measurements,pageErrors:errors},null,2)); expect(errors).toEqual([]);
});
