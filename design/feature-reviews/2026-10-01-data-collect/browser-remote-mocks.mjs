// Actual remote React components; only the config and Supabase module boundary are replaced.
// This does not authenticate to or contact any remote service.
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';
const base='http://127.0.0.1:4183', out=path.resolve('design/feature-reviews/2026-10-01-data-collect/evidence');
const token='20000000-0000-4000-8000-000000000001', personal='40000000-0000-4000-8000-000000000001', id='10000000-0000-4000-8000-000000000001';
const now=new Date().toISOString();
const collection={id,ownerId:'teacher-a',publicToken:token,title:'가상 원격 경계 수합',description:'원격 연결 없는 모의 응답',kind:'custom',mode:'fixed',status:'open',dueAt:'',allowResubmit:true,passwordHash:'',retentionMonths:12,targets:[{id:'target-a',rowNumber:1,label:'김하늘',owner:'가상부서',personalToken:personal}],submissions:[],createdAt:now,updatedAt:now};
const state={collection,mode:'fixed',searchMode:'empty',getError:false,uploadError:false,submitError:false,calls:[]};
const log={browser:'',mode:'actual remote React code + synthetic API module; no network',checks:[],screens:[]};
const browser=await chromium.launch({channel:'chrome',headless:true});log.browser=browser.version();
const context=await browser.newContext({viewport:{width:1366,height:900},timezoneId:'Asia/Seoul'});
await context.exposeFunction('__reviewInvoke',async(name,body)=>{
  state.calls.push({name,body});
  const error=(message,status=400)=>({data:null,error:{message,status}});
  if(name==='data-collect-admin'){
    if(body.action==='get')return state.getError?error('가상 서버 오류: 수합을 불러오지 못했습니다.',500):{data:{collection:state.collection},error:null};
    if(body.action==='list')return {data:{collections:[state.collection]},error:null};
  }
  if(name==='data-collect-public'){
    if(body.action==='metadata')return {data:{collection:{accessGranted:true,title:collection.title,description:collection.description,mode:state.mode,kind:'custom',status:'open',dueAt:'',passwordRequired:false,allowResubmit:true,hasTemplate:false,template:null}},error:null};
    if(body.action==='search'){
      if(body.query.length<2)return error('두 글자 이상 입력해 주세요.',422);
      if(state.searchMode==='error')return error('가상 검색 실패, 다시 시도해 주세요.',500);
      return {data:{targets:state.searchMode==='match'?[{token:personal,label:'김○늘',owner:'가○서'}]:[]},error:null};
    }
    if(body.action==='prepare-upload')return {data:{path:id+'/walk-in/virtual.pdf',token:'virtual-upload'},error:null};
    if(body.action==='submit')return state.submitError?error('가상 제출 실패, 다시 시도해 주세요.',500):{data:{submitted:true,revision:1,decision:body.decision,personalToken:personal},error:null};
  }
  return {data:[],error:null};
});
await context.addInitScript(()=>{window.__calls=[];window.__uploadError=false;});
await context.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin!==base){return route.abort();}
  if(url.pathname==='/src/features/dataCollect/dataCollectConfig.ts')return route.fulfill({contentType:'text/javascript',body:"export const isDataCollectDemoMode=false; export const dataCollectOwnerId=id=>id||'';"});
  if(url.pathname==='/src/utils/supabaseClient.ts')return route.fulfill({contentType:'text/javascript',body:"export const isSupabaseConfigured=true;\nconst user=()=>({id:localStorage.getItem('review-user')||'teacher-a',email:'ordinary-teacher@example.invalid',user_metadata:{full_name:'가상 일반 교사'}});\nconst chain=()=>new Proxy({}, {get:(_t,key)=>key==='then'?((resolve)=>resolve({data:null,error:null})):()=>chain()});\nexport const supabase={\nauth:{getSession:async()=>({data:{session:{user:user()}},error:null}),getUser:async()=>({data:{user:user()},error:null}),onAuthStateChange:callback=>{window.__setReviewUser=id=>{localStorage.setItem('review-user',id);callback('SIGNED_IN',{user:user()});};return {data:{subscription:{unsubscribe(){}}}};},signInWithOAuth:async()=>({error:null}),signOut:async()=>({error:null})},\nfunctions:{invoke:async(name,{body})=>{window.__calls.push({name,body});const r=await window.__reviewInvoke(name,body);return r.error?{data:null,error:{message:r.error.message,context:new Response(JSON.stringify({error:r.error.message}),{status:r.error.status})}}:r;}},\nstorage:{from:()=>({uploadToSignedUrl:async()=>({error:window.__uploadError?{message:'가상 업로드 실패'}:null})})},\nfrom:()=>chain(),channel:()=>({on(){return this;},subscribe(){return this;}}),removeChannel(){}};\n"});

  return route.continue();
});
const page=await context.newPage();page.setDefaultTimeout(10000);
const mobile=await context.newPage();mobile.setDefaultTimeout(10000);await mobile.setViewportSize({width:390,height:844});
async function capture(name,p=page){await p.screenshot({path:path.join(out,name+'.jpg'),fullPage:true,quality:75});const a=await new AxeBuilder({page:p}).analyze();log.screens.push({name,axe:a.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}))});}
async function check(name,fn){const r=await fn();log.checks.push({name,observation:r});console.log(name,JSON.stringify(r));}
try{
  await check('ordinary teacher opens management',async()=>{await page.goto(base+'/tools/data-collect/'+id);await page.getByRole('heading',{name:collection.title}).waitFor();await capture('31-mock-general-teacher');return {headingVisible:true,email:'ordinary-teacher@example.invalid'};});
  await check('remote update remains stale',async()=>{
    const before=state.calls.filter(c=>c.name==='data-collect-admin'&&c.body.action==='get').length;
    state.collection={...collection,submissions:[{id:'virtual-submission',targetId:'target-a',decision:'submitted',revision:1,note:'가상 숨은 메모',uploadedAt:now,file:{originalName:'virtual.pdf',mimeType:'application/pdf',byteSize:5,dataUrl:'data:application/pdf;base64,JVBERi0='}}]};
    await page.waitForTimeout(1500);await page.bringToFront();await page.keyboard.press('Tab');await capture('32-mock-management-stale');
    const currentCalls=state.calls.filter(c=>c.name==='data-collect-admin'&&c.body.action==='get').length;
    const stale=await page.getByText('미확인',{exact:true}).count();
    await page.reload();await page.getByRole('link',{name:'virtual.pdf',exact:true}).waitFor();await capture('33-mock-management-after-reload');
    return {getRequestsDuringExternalChange:currentCalls-before,stalePendingRows:stale,updatedAfterReload:true};
  });
  await check('load error hidden and no retry button',async()=>{
    state.getError=true;await page.reload();await page.getByRole('heading',{name:'자료 수합을 찾을 수 없습니다'}).waitFor();await capture('34-mock-load-error-hidden');
    const text=await page.innerText('body');state.getError=false;
    return {serverErrorShown:text.includes('가상 서버 오류'),retryControl:await page.getByRole('button',{name:/다시 시도|새로고침/}).count(),visibleText:text};
  });
  await check('unscoped draft crosses accounts',async()=>{
    await page.goto(base+'/tools/data-collect/new');await page.getByLabel('제목').fill('가상 A교사 미완료 초안');await page.getByLabel('이름 입력 또는 붙여넣기').fill('가상A학생');await page.getByRole('button',{name:'입력한 이름 반영',exact:true}).click();await page.waitForTimeout(350);
    await page.evaluate(()=>window.__setReviewUser('teacher-b'));await page.reload();await page.getByText('작성 중이던 내용을 복원했습니다.',{exact:true}).waitFor();await capture('35-mock-draft-cross-account');
    return {newUser:await page.evaluate(()=>localStorage.getItem('review-user')),restoredTitle:await page.getByLabel('제목').inputValue(),restoredStudent:await page.getByLabel('1번 제출 대상').inputValue()};
  });
  await check('remote search errors and empty result hidden',async()=>{
    await mobile.goto(base+'/s/data/'+token);await mobile.getByRole('button',{name:'찾기',exact:true}).click();await mobile.waitForTimeout(150);await capture('36-mock-search-invalid-mobile',mobile);
    const validationShown=(await mobile.innerText('body')).includes('두 글자 이상');
    state.searchMode='error';await mobile.getByPlaceholder('제출 대상 이름 2글자 이상').fill('김하늘');await mobile.getByRole('button',{name:'찾기',exact:true}).click();await mobile.waitForTimeout(150);await capture('37-mock-search-error-mobile',mobile);
    const failureShown=(await mobile.innerText('body')).includes('가상 검색 실패');
    state.searchMode='empty';await mobile.getByRole('button',{name:'찾기',exact:true}).click();await mobile.waitForTimeout(150);const emptyShown=(await mobile.innerText('body')).includes('검색 결과');
    return {validationMessageShown:validationShown,serverErrorShown:failureShown,emptyResultMessageShown:emptyShown};
  });
  await check('remote submit without file and upload failure recovery',async()=>{
    state.searchMode='match';await mobile.getByRole('button',{name:'찾기',exact:true}).click();await mobile.getByRole('button',{name:/김○늘/}).click();await mobile.getByLabel('전달 사항').fill('가상 복구 메모');
    state.submitError=true;await mobile.getByRole('button',{name:'회신 제출',exact:true}).click();await mobile.getByText('가상 제출 실패, 다시 시도해 주세요.').waitFor();
    const noFileSubmitted=state.calls.at(-1).body;await capture('38-mock-no-file-submit',mobile);
    await mobile.evaluate(()=>window.__uploadError=true);await mobile.locator('input[type=file]').setInputFiles({name:'virtual.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7 virtual')});await mobile.getByRole('button',{name:'회신 제출',exact:true}).click();await mobile.getByText('파일을 저장하지 못했습니다: 가상 업로드 실패').waitFor();await capture('39-mock-upload-error-mobile',mobile);
    const note=await mobile.getByLabel('전달 사항').inputValue(),filename=await mobile.locator('input[type=file]').evaluate(el=>el.files[0].name);
    state.submitError=false;await mobile.evaluate(()=>window.__uploadError=false);await mobile.getByRole('button',{name:'회신 제출',exact:true}).click();await mobile.getByRole('heading',{name:'회신을 제출했습니다'}).waitFor();await capture('40-mock-upload-retry-complete',mobile);
    return {noFileSubmitRequest:noFileSubmitted,noteKept:note,fileKept:filename,retryCompleted:true};
  });
  await check('custom remote reload loses returned personal token',async()=>{
    state.mode='custom';await mobile.goto(base+'/s/data/'+token);await mobile.getByLabel('제출자 이름').fill('가상제출자');await mobile.locator('input[type=file]').setInputFiles({name:'virtual.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7 virtual')});await mobile.getByRole('button',{name:'회신 제출',exact:true}).click();await mobile.getByRole('heading',{name:'회신을 제출했습니다'}).waitFor();await mobile.reload();await mobile.getByLabel('제출자 이름').fill('가상제출자');await mobile.locator('input[type=file]').setInputFiles({name:'virtual.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7 virtual')});await mobile.getByRole('button',{name:'회신 제출',exact:true}).click();await mobile.getByRole('heading',{name:'회신을 제출했습니다'}).waitFor();await capture('41-mock-custom-reload-new-token',mobile);
    return {afterReloadPersonalToken:state.calls.filter(c=>c.body.action==='submit').at(-1).body.personalToken};
  });
}finally{fs.writeFileSync(path.join(out,'remote-ui-mock-observations.json'),JSON.stringify({...log,calls:state.calls},null,2));await browser.close();}
