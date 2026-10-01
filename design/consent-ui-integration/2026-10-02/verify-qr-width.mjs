import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
const origin=process.env.CONSENT_REVIEW_ORIGIN ?? 'http://127.0.0.1:4281';
const out=path.resolve('design/consent-ui-integration/2026-10-02');
const browser=await chromium.launch({channel:'chrome'});
const results=[];
const pageErrors=[];
try {
 const context=await browser.newContext({reducedMotion:'reduce'});
 const page=await context.newPage();
 page.on('pageerror',e=>pageErrors.push(e.message));
 await page.goto(origin);
 await page.evaluate(()=>{
  localStorage.setItem('schooldoc:consent-forms:drafts',JSON.stringify([{id:'integration-qr-width',title:'가상 QR 너비 검사',fileName:'fictional.pdf',fields:[],publicToken:'fictional-public',recipientMode:'named',recipientCount:6,responseCount:0,status:'open',pageCount:1,pageSizes:[{width:595,height:842}]}]));
  localStorage.setItem('schooldoc:consent-forms:recipients',JSON.stringify(Array.from({length:6},(_,i)=>({id:`fictional-${i}`,formId:'integration-qr-width',token:`fictional-token-${i}`,name:i===0?'가상보호자긴이름표시확인'.repeat(6).slice(0,60):`가상학생${i+1}`,studentKey:i===0?'가상학생식별값줄바꿈확인'.repeat(6).slice(0,60):`3010${i+1}`}))));
 });
 await page.goto(origin+'/tools/consent-forms/integration-qr-width/qr');
 await page.getByTestId('consent-qr-page').first().waitFor();
 for(const width of [390,640,768,1024,1280,1570]) {
  await page.setViewportSize({width,height:900});
  await page.evaluate(()=>document.fonts.ready);
  await page.mouse.move(0,0);
  const measurement=await page.evaluate(()=>{
   const p=document.querySelector('[data-testid=consent-qr-page]').getBoundingClientRect();
   return {viewport:innerWidth,x:p.x,width:p.width,right:p.right,clippedCards:[...document.querySelectorAll('[data-testid=consent-qr-card]')].filter(e=>{const b=e.getBoundingClientRect();return b.right>innerWidth+1||b.left<0;}).length,horizontalOverflow:document.documentElement.scrollWidth-innerWidth};
  });
  results.push(measurement);
  assert.equal(measurement.clippedCards,0,`${width}: clipped QR cards`);
  assert.ok(measurement.horizontalOverflow<=1,`${width}: horizontal overflow`);
  if([390,640,768,1570].includes(width)) await page.screenshot({path:path.join(out,`qr-width-${width}.png`),fullPage:true,animations:'disabled'});
 }
 assert.deepEqual(pageErrors,[]);
} finally {await browser.close();}
await writeFile(path.join(out,'qr-width-after.json'),JSON.stringify({browser:'installed Google Chrome channel chrome',mode:'demo with fictional roster',results,pageErrors},null,2)+'\n');
console.log('PASS '+results.length+' viewport widths, no clipped QR cards or page errors');
