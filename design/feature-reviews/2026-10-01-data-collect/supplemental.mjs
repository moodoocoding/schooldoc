import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const base='http://127.0.0.1:4183',out=path.resolve('design/feature-reviews/2026-10-01-data-collect/evidence'),result={keyboard:[],formats:[],zoom:{}};
const source=fs.readFileSync('src/features/dataCollect/dataCollectUtils.ts','utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const utils=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
for(const [extension,magic] of [['pdf',[37,80,68,70]],['png',[137,80,78,71]],['jpg',[255,216,255]],['jpeg',[255,216,255]],['hwp',[208,207,17,224]],['hwpx',[80,75,3,4]],['docx',[80,75,3,4]],['xlsx',[80,75,3,4]],['exe',[80,75,3,4]]]){
  try{await utils.validateCollectionFile(new File([new Uint8Array(magic)],'virtual.'+extension));result.formats.push({extension,accepted:true,fixture:'header-only synthetic'});}
  catch(e){result.formats.push({extension,accepted:false,message:e.message});}
}
for(const [name,blob] of [['zero.pdf',new Blob([])],['disguised.pdf',new Blob(['invalid'])],['large51.pdf',new Blob([new Uint8Array(51*1024*1024)])]]){
  try{await utils.validateCollectionFile(new File([blob],name));result.formats.push({name,accepted:true});}
  catch(e){result.formats.push({name,accepted:false,message:e.message});}
}
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1366,height:900},timezoneId:'Asia/Seoul'});
await context.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
const page=await context.newPage();page.setDefaultTimeout(10000);
try{
  await page.goto(base+'/tools/data-collect/new');await page.getByLabel('제목').fill('가상 키보드 파일 제출');await page.getByRole('radio',{name:/제출자가 이름 입력/}).check();await page.getByRole('button',{name:/기한 없음/}).click();await page.getByRole('button',{name:'자료 수합 만들기',exact:true}).click();await page.getByLabel('자료 수합 공개 링크').waitFor();
  const url=await page.getByLabel('자료 수합 공개 링크').inputValue();
  // Measure the CSS 200% QR relative to its sharing card, not only document overflow.
  await page.evaluate(()=>document.body.style.zoom='2');
  result.zoom.teacher=await page.locator('svg[height="144"]').evaluate(el=>{const qr=el.getBoundingClientRect(),card=el.closest('section').getBoundingClientRect();return {qrLeft:qr.left,qrRight:qr.right,cardRight:card.right,viewport:innerWidth,overflowsCard:qr.right>card.right};});
  await page.screenshot({path:path.join(out,'42-single-teacher-css-200.jpg'),fullPage:true,quality:75});
  await page.evaluate(()=>document.body.style.zoom='1');
  const mobile=await context.newPage();await mobile.setViewportSize({width:390,height:844});await mobile.goto(url);await mobile.getByLabel('제출자 이름').waitFor();
  await mobile.keyboard.press('Tab');await mobile.keyboard.type('가상키보드학생');await mobile.keyboard.press('Tab');
  result.keyboard.push(await mobile.evaluate(()=>{const el=document.activeElement,rect=el.getBoundingClientRect(),label=el.closest('label'),style=label?getComputedStyle(label):null;return {tag:el.tagName,type:el.type,width:rect.width,height:rect.height,labelOutline:style?.outline,labelBoxShadow:style?.boxShadow};}));
  await mobile.screenshot({path:path.join(out,'43-mobile-keyboard-file-focus.jpg'),fullPage:true,quality:75});
  const chooser=mobile.waitForEvent('filechooser');await mobile.keyboard.press('Enter');await (await chooser).setFiles({name:'virtual.pdf',mimeType:'application/pdf',buffer:fs.readFileSync(path.join(out,'virtual-template.pdf'))});
  result.keyboard.push({fileSelectedByKeyboard:await mobile.locator('input[type=file]').evaluate(el=>el.files[0].name)});
  await mobile.keyboard.press('Tab');await mobile.keyboard.type('가상 키보드 회신 메모');await mobile.keyboard.press('Tab');await mobile.keyboard.press('Enter');await mobile.getByRole('heading',{name:'회신을 제출했습니다'}).waitFor();result.keyboard.push({submissionByKeyboard:true});
  await mobile.getByRole('button',{name:'다시 회신하기',exact:true}).click();await mobile.evaluate(()=>document.body.style.zoom='2');
  await mobile.screenshot({path:path.join(out,'44-participant-mobile-css-200.jpg'),fullPage:true,quality:75});
  result.zoom.participant=await mobile.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,zoom:getComputedStyle(document.body).zoom}));
}finally{fs.writeFileSync(path.join(out,'supplemental-observations.json'),JSON.stringify(result,null,2));await browser.close();}
console.log(JSON.stringify(result));
