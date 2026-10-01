import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
const origin='https://schooldoc-nine.vercel.app';
const out=path.resolve('design/consent-ui-integration/2026-10-02');
const response=await fetch(origin);
assert.equal(response.status,200);
const html=await response.text();
const assets=[...html.matchAll(/<script[^>]*src="([^"]+\.js)"[^>]*>/g)].map(m=>m[1]);
assert.ok(assets.length>0);
const js=(await Promise.all(assets.map(async asset=>{const r=await fetch(new URL(asset,origin));assert.equal(r.status,200);return r.text();}))).join('\n');
const markers=['PDF 필드 편집','필드 추가 도구','consent-response-list','consent-recipient-list'];
for(const marker of markers)assert.ok(js.includes(marker),'Missing deployed UI marker: '+marker);
const browser=await chromium.launch({channel:'chrome'});
const results=[];
try {
 for(const viewport of [{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:844}]) {
  const context=await browser.newContext({viewport,reducedMotion:'reduce'});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  let r=await page.goto(origin,{waitUntil:'networkidle'});
  await page.getByRole('heading',{name:'가정통신문 수합',exact:true}).waitFor();
  results.push({viewport:viewport.name,path:'/',status:r.status()});
  assert.equal(r.status(),200);
  await page.getByRole('button',{name:/^가정통신문 수합 시작하기/}).click();
  await page.waitForURL(origin+'/tools/consent-forms');
  await page.getByRole('button',{name:'Google로 로그인',exact:true}).waitFor();
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:path.join(out,`production-consent-auth-${viewport.name}.png`),fullPage:true,animations:'disabled'});
  results.push({viewport:viewport.name,path:'/tools/consent-forms',loginGate:true});
  const api=page.waitForResponse(r=>r.url().includes('.supabase.co/functions/v1/consent-forms-public')&&r.status()===404);
  r=await page.goto(origin+'/s/consent/00000000-0000-4000-8000-000000000000',{waitUntil:'networkidle'});
  await api;
  await page.getByRole('heading',{name:'가정통신문을 찾을 수 없습니다',exact:true}).waitFor();
  assert.equal(r.status(),200);
  assert.deepEqual(errors,[]);
  results.push({viewport:viewport.name,path:'/s/consent/<fictional token>',frontendStatus:r.status(),apiStatus:404,pageErrors:errors});
  await context.close();
 }
} finally {await browser.close();}
await writeFile(path.join(out,'production-browser.json'),JSON.stringify({checkedAt:new Date().toISOString(),origin,browser:'installed Google Chrome channel chrome',count:results.length,assets,markers,results,limits:'비로그인 탐색과 실제 404, 새 배포 JS의 UI 코드 포함 확인. 로그인 후 편집/생성/파일 제출/출력은 미검증.'},null,2)+'\n');
console.log('PASS '+results.length+' production Chrome screens; '+markers.length+' new UI code markers in deployed JS');
