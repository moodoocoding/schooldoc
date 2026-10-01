// 실제 Chrome + 실제 로컬 PostgreSQL/PostgREST/Deno 읽기 검증. 원격 쓰기는 하지 않는다.
// 시험 JWT와 가상 자료 식별자는 무시된 .runtime 파일에서 읽고 결과에 기록하지 않는다.
import {chromium,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const prior='design/consent-implementation/2026-10-01/.runtime';
const cfg=JSON.parse(await readFile(prior+'/local.json','utf8'));
const fixtures=JSON.parse(await readFile(prior+'/fixtures.json','utf8'));
const ev='design/consent-field-editor/2026-10-02/evidence'; await mkdir(ev,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:false});
const context=await browser.newContext({viewport:{width:1366,height:900},permissions:['clipboard-read','clipboard-write']});
await context.addInitScript(({teacher,user})=>localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:teacher,refresh_token:'isolated-local-only',expires_at:Math.floor(Date.now()/1000)+86400,expires_in:86400,token_type:'bearer',user:{id:user,aud:'authenticated',role:'authenticated',email:'fictional-teacher@example.test',app_metadata:{provider:'google'},user_metadata:{full_name:'가상 교사'}}})),{teacher:cfg.teacher,user:cfg.user});
const page=await context.newPage();page.setDefaultTimeout(20000);
const errors=[],actions=[],checks=[],responses=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>{if(r.url().includes('/functions/v1/consent-forms-admin'))try{actions.push(JSON.parse(r.postData()).action);}catch{}});
page.on('response',async r=>{if(r.url().includes('/functions/v1/consent-forms-admin'))try{const body=await r.json();if(body.recipients?.length!==undefined)responses.push({action:JSON.parse(r.request().postData()).action,recipients:body.recipients.length,responses:body.responses?.length});}catch{}});
const check=async(name,fn)=>{await fn();checks.push({name,result:'pass'});console.log('PASS',name);};
const overflow=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
const capture=async name=>{await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:ev+'/local-db-'+name+'.png',fullPage:true});};
try {
 await check('2,000명·응답100건 실제 DB 초기 bundle 1회와 각60개·전체 제출 건수',async()=>{
  await page.goto(`http://127.0.0.1:4181/tools/consent-forms/${fixtures.max.id}`);
  const roster=page.getByRole('region',{name:'명단 제출 현황'});
  await expect(roster).toContainText('현재 명단 60 / 2000명');
  await expect(page.getByRole('region',{name:'수합 요약'})).toContainText('100건');
  await expect(page.getByTestId('consent-share-panel')).toContainText('미제출 1900명');
  assert.deepEqual(actions,['bundle']);
  await expect(page.getByRole('region',{name:'받은 응답'}).getByRole('button',{name:'내용 보기',exact:true})).toHaveCount(60);
  const s=await page.getByTestId('consent-share-panel').boundingBox(),r=await roster.boundingBox();assert.ok(s.y+s.height<r.y);
  await capture('2000-initial-60');
 });
 await check('접기·펼치기와 공용 링크 복사는 DB 업무 요청을 추가하지 않는다',async()=>{
  const n=actions.length;
  await page.getByRole('button',{name:'응답 목록 접기'}).click();await page.getByRole('button',{name:'명단 목록 접기'}).click();
  await expect(page.locator('#consent-response-list')).toBeHidden();await expect(page.locator('#consent-recipient-list')).toBeHidden();await capture('2000-collapsed-desktop');
  await page.getByRole('button',{name:'응답 링크 복사',exact:true}).click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),await page.getByLabel('공용 응답 링크',{exact:true}).inputValue());
  await page.setViewportSize({width:390,height:844});await overflow();await capture('2000-collapsed-mobile');
  await page.evaluate(()=>document.documentElement.style.fontSize='200%');await overflow();await capture('2000-collapsed-mobile-css200');
  const axe=await new AxeBuilder({page}).include('main').analyze();assert.deepEqual(axe.violations.map(v=>v.id),[]);
  await page.evaluate(()=>document.documentElement.style.fontSize='');await page.setViewportSize({width:1366,height:900});
  await page.getByRole('button',{name:'응답 목록 펼치기'}).click();await page.getByRole('button',{name:'명단 목록 펼치기'}).click();assert.equal(actions.length,n);
 });
 await check('본문은 내용 보기에서만 조회하고 다시 보기에는 상세 캐시를 쓴다',async()=>{
  const n=actions.length;const region=page.getByRole('region',{name:'받은 응답'});await region.getByRole('button',{name:'내용 보기',exact:true}).first().click();
  await expect(region).not.toContainText('입력된 값이 없습니다.');assert.equal(actions.slice(n).filter(a=>a==='detail').length,1);
  await region.getByRole('button',{name:'내용 보기',exact:true}).first().click();assert.equal(actions.slice(n).filter(a=>a==='detail').length,1);
 });
 await check('응답 커서 조회100건과 명단 추가60, 전체2,000명 검색·미제출1900 유지',async()=>{
  await page.getByRole('button',{name:'응답 더 보기 (현재 60건)',exact:true}).click();await expect(page.getByRole('region',{name:'받은 응답'}).getByRole('button',{name:'내용 보기',exact:true})).toHaveCount(100);
  await page.getByRole('button',{name:'명단 더 보기',exact:true}).click();await expect(page.getByRole('region',{name:'명단 제출 현황'})).toContainText('현재 명단 120 / 2000명');
  await page.getByRole('button',{name:'전체 명단 불러와 검색',exact:true}).click();await expect(page.getByRole('region',{name:'명단 제출 현황'})).toContainText('현재 명단 2000 / 2000명');
  await page.getByRole('textbox',{name:'이름 또는 식별값으로 찾기',exact:true}).fill('2000');await expect(page.getByRole('region',{name:'명단 제출 현황'})).toContainText('가상학생 2000');
  await expect(page.getByTestId('consent-share-panel')).toContainText('미제출 1900명');await overflow();await capture('2000-all-search');
 });
 await check('기존 실제 DB 재제출 이력과 최신 응답 수를 별도로 표시한다',async()=>{
  await page.goto(`http://127.0.0.1:4181/tools/consent-forms/${fixtures.class24.id}`);
  const historyButton=page.getByRole('button',{name:/가상학생.* 제출 이력/}).first();await historyButton.click();
  await expect(page.getByRole('region',{name:'재제출 이력'}).getByRole('button',{name:'내용 보기',exact:true})).toHaveCount(2);
  await expect(page.getByRole('region',{name:'받은 응답'}).getByRole('button',{name:'내용 보기',exact:true})).toHaveCount(1);
  await capture('latest-and-history');
 });
 assert.deepEqual(errors,[]);
 await writeFile(ev+'/local-db-ui.json',JSON.stringify({browser:browser.version(),headed:true,mode:'real-local-PostgreSQL-PostgREST-Deno, Auth/Storage local adapters',checks,initialActions:['bundle'],initialRecipients:60,initialResponseHeaders:60,totalRecipients:2000,currentResponses:100,pending:1900,actions,responses,pageErrors:errors,remote:false},null,2));
 console.log('LOCAL_DB_UI_CHECKS',checks.length,'pageErrors',errors.length);
} finally { await context.close();await browser.close(); }