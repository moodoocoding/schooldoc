// 출력/반응형의 추가 관찰. 모두 로컬 가상 seed이며 제품 변경 없음.
import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
const base = process.env.REGISTRY_REVIEW_URL ?? 'http://127.0.0.1:4182';
const out='design/feature-reviews/2026-10-01-registry/evidence';
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1366,height:900},acceptDownloads:true});
await context.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
const page=await context.newPage();
const observations=[];
const record=(name,detail)=>{observations.push({name,detail});console.log(name,JSON.stringify(detail));};
try {
 await page.goto(base+'/tools/registry-sign');
 await page.evaluate(()=>{
   const r={id:'output-probe',publicToken:'output-probe',title:'가상 여러 쪽 출력 검토',leftHeader:'가상 첫째 줄\n가상 둘째 줄\n가상 셋째 줄',rightHeader:'가상 장소',mode:'fixed',status:'open',layout:20,allowWalkIn:false,columns:[{id:'a',label:'소속'}],participants:Array.from({length:41},(_,i)=>({id:'p'+i,rowNumber:i+1,name:'가상참석자'+(i+1),values:{a:'가상학교'+(i+1)}})),createdAt:'',updatedAt:''};localStorage.setItem('schooldoc_registry_v1',JSON.stringify([r]));
 });
 await page.goto(base+'/tools/registry-sign/output-probe');
 await expect(page.getByRole('heading',{name:'참석자 명단',exact:true})).toBeVisible();
 await page.getByLabel('인쇄 미리보기 페이지 선택').selectOption('2');
 await page.screenshot({path:out+'/29-preview-page2-desktop.png',fullPage:true});
 const dPromise=page.waitForEvent('download');
 await page.getByRole('button',{name:'PDF 다운로드',exact:true}).click();
 await page.waitForFunction(()=>document.querySelectorAll('.registry-print-page').length===3);
 record('all-pages-export-DOM',await page.locator('.registry-print-page').evaluateAll(pages=>pages.map(e=>({height:e.offsetHeight,title:e.querySelector('h1').textContent,rows:Array.from(e.querySelectorAll('tbody tr')).map(r=>r.offsetHeight),bottom:e.lastElementChild.getBoundingClientRect().bottom,pageBottom:e.getBoundingClientRect().bottom}))));
 await (await dPromise).saveAs(out+'/registry-41-download.pdf');
 await page.getByRole('button',{name:'등록부 목록',exact:true}).click();
 await page.getByRole('button',{name:'새 등록부',exact:true}).click();
 await page.getByLabel(/문서 제목/).fill('가상 모바일 명단');
 await page.getByRole('button',{name:'다음',exact:true}).click();
 await page.getByLabel('1번 참석자 성명',{exact:true}).fill('가상홍길동');
 await page.getByLabel('1번 참석자 소속',{exact:true}).fill('가상학교');
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:out+'/30-create-mobile-viewport.png'});
 record('mobile-create-outside-elements',await page.evaluate(()=>Array.from(document.querySelectorAll('*')).filter(e=>{const r=e.getBoundingClientRect();return r.right>innerWidth+2&&r.width>0;}).map(e=>({tag:e.tagName,classes:e.className,rect:e.getBoundingClientRect().toJSON(),scrollWidth:e.scrollWidth,clientWidth:e.clientWidth,overflowX:getComputedStyle(e).overflowX})).slice(0,15)));
 record('mobile-create-table-scroll',await page.locator('table').evaluate(e=>{const p=e.parentElement;p.scrollLeft=300;return {scrollLeft:p.scrollLeft,scrollWidth:p.scrollWidth,clientWidth:p.clientWidth};}));
 await page.screenshot({path:out+'/31-create-mobile-table-scrolled.png'});
 await page.getByRole('button',{name:'다음',exact:true}).click();
 await page.screenshot({path:out+'/32-create-preview-mobile.png',fullPage:true});
 await page.setViewportSize({width:1366,height:900});
 await page.evaluate(()=>document.documentElement.style.zoom='2');
 await page.screenshot({path:out+'/33-create-preview-css200.png',fullPage:true});
 record('create-preview-css200',await page.evaluate(()=>({viewport:innerWidth,documentWidth:document.documentElement.scrollWidth})));
} finally {
 await fs.writeFile(out+'/output-observations.json',JSON.stringify({observations},null,2));
 await context.close();await browser.close();
}
