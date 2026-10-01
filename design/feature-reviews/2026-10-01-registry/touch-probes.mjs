// 설치된 Chrome의 모바일/터치 에뮬레이션. 실제 휴대전화 실험은 아니다.
import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
const out='design/feature-reviews/2026-10-01-registry/evidence';
const base=process.env.REGISTRY_REVIEW_URL??'http://127.0.0.1:4182';
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:3});
await context.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
const page=await context.newPage();
try {
 await page.goto(base+'/s/registry/demo-digital-training-2026');
 await page.getByLabel('이름 또는 소속 검색').fill('김하늘');
 await page.getByRole('button',{name:/김\*늘.*선택/}).click();
 const canvas=page.getByLabel('서명 입력 영역');
 const b=await canvas.boundingBox();
 const cdp=await context.newCDPSession(page);
 const yStart=await page.evaluate(()=>scrollY);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width*.2,y:b.y+b.height*.6}]});
 for(let i=1;i<=10;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:b.x+b.width*(.2+i*.035),y:b.y+b.height*(.6-i*.02)}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const ink=await canvas.evaluate(c=>{
   const data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let minX=c.width,maxX=0,minY=c.height,maxY=0,n=0;
   for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(data[(y*c.width+x)*4+3]){n++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
   return {width:c.width,height:c.height,minX,maxX,minY,maxY,inkPixels:n};
 });
 await expect(page.getByRole('button',{name:'서명 제출',exact:true})).toBeEnabled();
 await page.screenshot({path:out+'/35-touch-signature-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'다시 쓰기',exact:true}).click();
 await expect(page.getByRole('button',{name:'서명 제출',exact:true})).toBeDisabled();
 await fs.writeFile(out+'/touch-observations.json',JSON.stringify({method:'Chrome CDP touch emulation; not physical phone',rect:b,dpr:3,ink,scrollBefore:yStart,scrollAfter:await page.evaluate(()=>scrollY),clearDisablesSubmit:true},null,2));
 console.log(JSON.stringify(ink));
} finally {await context.close();await browser.close();}
