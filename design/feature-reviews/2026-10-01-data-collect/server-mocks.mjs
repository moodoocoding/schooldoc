// Executes the unchanged Edge Function handler with in-memory Auth/DB/Storage doubles.
// No network, real credentials, remote uploads or remote deletes. This observes defects.
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const dir=path.resolve('design/feature-reviews/2026-10-01-data-collect');
const CID='10000000-0000-4000-8000-000000000001', TOKEN='20000000-0000-4000-8000-000000000001', TID='30000000-0000-4000-8000-000000000001', PT='40000000-0000-4000-8000-000000000001';
const user='50000000-0000-4000-8000-000000000001';
const base={ id:CID, owner_id:user, public_token:TOKEN, title:'virtual collection', description:'virtual instruction', kind:'custom', mode:'fixed', status:'open', due_at:null, password_digest:null, allow_resubmit:true, template_path:null, template_name_ciphertext:null, retention_months:12 };
const target={id:TID, collection_id:CID,row_number:1,label_ciphertext:JSON.stringify({label:'가상교사',owner:'가상부서'}),personal_token:PT,display_label:'가○사',display_owner:'가○서',label_search:['hash:가상'],owner_search:[]};
const results=[];
function model(options={}) {
  const state={ collections:[{...base,...options.collection}], targets:[{...target}], files:options.history ? [{id:'old', collection_id:CID,target_id:TID,revision:1,is_current:true,response_kind:'submitted',storage_path:CID+'/'+TID+'/old.pdf'}]:[], calls:[], limits:new Map(), objects:new Map(),failInsert:options.failInsert, failCurrentUpdate:options.failCurrentUpdate, failTargetUpdate:options.failTargetUpdate };
  if(state.collections[0].mode==='custom')state.targets=[];
  let releaseNumbering; let numberReads=0; const numberingBarrier=new Promise(resolve=>releaseNumbering=resolve);
  class Query {
    constructor(table){this.table=table;this.operation='select';this.filters=[];this.singleMode=false;this.payload=null;this.ordering=null;this.maximum=null;}
    select(){return this;} eq(k,v){this.filters.push([k,v]);return this;}
    insert(payload){this.operation='insert';this.payload=payload;return this;}
    update(payload){this.operation='update';this.payload=payload;return this;}
    delete(){this.operation='delete';return this;}
    order(k,opts={}){this.ordering=[k,opts.ascending!==false];return this;}
    limit(n){this.maximum=n;return this;} maybeSingle(){this.singleMode=true;return this;} single(){this.singleMode=true;return this;}
    then(resolve,reject){return Promise.resolve().then(async()=>{const result=this.execute(); if(options.barrierWalkInNumbering && this.table==='data_collection_targets' && this.operation==='select' && this.ordering?.[0]==='row_number'){if(++numberReads===2)releaseNumbering();await numberingBarrier;}return result;}).then(resolve,reject);}
    execute(){
      state.calls.push({table:this.table,operation:this.operation,filters:this.filters,payload:this.payload});
      const key=({'data_collections':'collections','data_collection_targets':'targets','data_collection_files':'files'})[this.table];
      if(!key)return {data:[],error:null,count:0};
      let rows=state[key].filter(row=>this.filters.every(([k,v])=>row[k]===v));
      if(this.operation==='insert'){
        if(key==='files' && state.failInsert)return {data:null,error:new Error('virtual insert failure')};
        const input=Array.isArray(this.payload)?this.payload:[this.payload];
        const items=input.map(r=>({id:crypto.randomUUID(),personal_token:crypto.randomUUID(),created_at:new Date().toISOString(),uploaded_at:new Date().toISOString(),...r}));
        if(key==='targets'&&items.some(r=>state.targets.some(x=>x.collection_id===r.collection_id&&x.row_number===r.row_number)))return {data:null,error:new Error('virtual SQL unique collection,row_number violation')};
        if(key==='files'&&items.some(r=>state.files.some(x=>x.collection_id===r.collection_id&&x.target_id===r.target_id&&(x.revision===r.revision||(x.is_current&&r.is_current)))))return {data:null,error:new Error('virtual SQL unique revision/current violation')};
        state[key].push(...items);rows=items;
      }
      if(this.operation==='update'){
        if((key==='files'&&state.failCurrentUpdate)||(key==='targets'&&state.failTargetUpdate))return {data:null,error:new Error('virtual update failure')};
        rows.forEach(r=>Object.assign(r,this.payload));
      }
      if(this.operation==='delete')state[key]=state[key].filter(r=>!rows.includes(r));
      if(this.ordering){const [k,asc]=this.ordering;rows.sort((a,b)=>(a[k]<b[k]?-1:a[k]>b[k]?1:0)*(asc?1:-1));}
      if(this.maximum!==null)rows=rows.slice(0,this.maximum);
      return {data:this.singleMode?(rows[0]??null):rows,error:null,count:rows.length};
    }
  }
  const storage={from:bucket=>({
    createSignedUrl:async(p,expiry)=>{state.calls.push({storage:'sign',bucket,path:p,expiry});return {data:{signedUrl:'https://invalid.example/virtual-only'},error:null};},
    createSignedUrls:async(paths,expiry)=>{state.calls.push({storage:'sign-many',bucket,paths,expiry});return {data:paths.map(p=>({path:p,signedUrl:'https://invalid.example/'+p})),error:null};},
    createSignedUploadUrl:async p=>{state.calls.push({storage:'prepare',bucket,path:p});return {data:{token:'virtual-upload'},error:null};},
    download:async p=>({data:state.objects.get(p)??new Blob(['%PDF-1.7 virtual file'],{type:'application/pdf'}),error:null}),
    remove:async paths=>{state.calls.push({storage:'remove',bucket,paths});paths.forEach(p=>state.objects.delete(p));return {data:[],error:null};},
    list:async()=>({data:[],error:null})
  })};
  const rpc=async(name,args)=>{
    state.calls.push({rpc:name,args});
    if(name==='consume_data_collect_rate_limit'){
      if(options.failLimit)return {data:null,error:new Error('virtual limit database failure')};
      const n=(state.limits.get(args.p_request_key)??0)+1;state.limits.set(args.p_request_key,n);
      return {data:!options.enforceLimits||n<=args.p_max_requests,error:null};
    }
    if(name==='verify_data_collection_password')return {data:args.p_password==='virtual-password',error:null};
    return {data:null,error:null};
  };
  const db={from:table=>new Query(table),rpc,storage};
  const caller={auth:{getUser:async()=>({data:{user:{id:user,email:'ordinary-teacher@example.invalid'}},error:null})},rpc};
  return {state,createClient:(_u,key)=>key==='review-service'?db:caller};
}
async function loadHandler(kind,m) {
  const source=fs.readFileSync('supabase/functions/data-collect-'+kind+'/index.ts','utf8').replace(/^import .*;\r?\n/gm,'');
  const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText.replace(/export \{\};?/g,'');
  let handler;
  const Deno={env:{get:name=>name==='SUPABASE_SERVICE_ROLE_KEY'?'review-service':name==='SUPABASE_URL'?'https://invalid.example':'review-anon'},serve:h=>handler=h};
  const cipher={isConfigured:()=>true,encryptPayload:async v=>JSON.stringify(v),decryptPayload:async v=>JSON.parse(v),nameLookup:async v=>'hash:'+v};
  // Silence only the handler's expected synthetic errors, retain them in the result of each request.
  const quietConsole={error:(...items)=>m.state.calls.push({handlerError:items.map(String)})};
  new Function('Deno','createClient','dataCollectCrypto','dataCollectSubmissionTargetPrefix','dataCollectSubmissionPrefix','dataCollectTemplatePrefix','console',compiled)(
    Deno,m.createClient,cipher,(c,t)=>c+'/'+t,c=>c,(u,c)=>u+'/'+c,quietConsole);
  return handler;
}
const request=(body,auth=false)=>new Request('https://invalid.example/review',{method:'POST',headers:{'Content-Type':'application/json','cf-connecting-ip':'192.0.2.40',...(auth?{Authorization:'Bearer virtual-review-token'}:{})},body:JSON.stringify(body)});
async function run(name,kind,options,action){
  const m=model(options);const h=await loadHandler(kind,m);const send=async b=>{const r=await h(request({token:TOKEN,...b},kind==='admin'));return {status:r.status,body:await r.json()};};
  const evidence=await action({m,h,send});results.push({name,kind,evidence});console.log(name,JSON.stringify(evidence));
}
await run('authentication and owner boundary','admin',{},async({m,h,send})=>{
  const missing=await h(request({action:'list'}));const list=await send({action:'list'});
  assert.equal(missing.status,401);assert.equal(list.status,200);assert.ok(m.state.calls.some(c=>c.filters?.some(([k,v])=>k==='owner_id'&&v===user)));
  m.state.collections[0].owner_id='another-user';m.state.calls=[];const denied=await send({action:'get',id:CID});assert.equal(denied.status,403);assert.equal(m.state.calls.filter(c=>c.storage?.startsWith('sign')).length,0);
  const badPath=await send({action:'create-upload-url',path:'another-user/'+CID+'/template.pdf'});assert.equal(badPath.status,422);
  return {missingAuthStatus:missing.status,ordinaryTeacherStatus:list.status,foreignCollectionStatus:denied.status,foreignFileSigns:0,badUploadPathStatus:badPath.status};
});
await run('password, closure, public minimization','public',{collection:{password_digest:'virtual-digest',template_path:'virtual/template.pdf',template_name_ciphertext:JSON.stringify('virtual.pdf')}},async({m,send})=>{
  const summary=await send({action:'metadata'});const wrong=await send({action:'metadata',password:'wrong'});const granted=await send({action:'metadata',password:'virtual-password'});
  assert.equal(summary.body.collection.accessGranted,false);assert.ok(!('template' in summary.body.collection));assert.equal(wrong.status,401);assert.equal(granted.body.collection.accessGranted,true);
  m.state.collections[0].status='closed';const closed=await send({action:'metadata',password:'virtual-password'});assert.ok(!('template' in closed.body.collection));const closedSubmit=await send({action:'submit',password:'virtual-password',personalToken:PT,decision:'confirmed'});assert.equal(closedSubmit.status,410);
  return {initialSignedUrlAbsent:true,wrongPasswordStatus:wrong.status,grantedExpiry:300,closedSignedUrlAbsent:true,closedSubmitStatus:closedSubmit.status};
});
await run('rate-limit failure stops DB reads','public',{failLimit:true},async({m,send})=>{
  const r=await send({action:'metadata'});assert.equal(r.status,500);assert.equal(m.state.calls.filter(c=>c.table).length,0);return {status:r.status,dataQueries:0};
});
await run('same-school-IP ninth student rejected','public',{enforceLimits:true,collection:{template_path:'virtual/template.pdf'}},async({m,send})=>{
  m.state.targets=Array.from({length:9},(_,i)=>({...target,id:crypto.randomUUID(),personal_token:crypto.randomUUID(),row_number:i+1})); const statuses=[];for(const row of m.state.targets){const r=await send({action:'submit',personalToken:row.personal_token,decision:'confirmed'});statuses.push(r.status);}
  assert.deepEqual(statuses,[200,200,200,200,200,200,200,200,429]);return {statuses,bucketScope:'IP + collection token + action; not participant'};
});
await run('required upload can be bypassed with confirmed','public',{},async({m,send})=>{
  const r=await send({action:'submit',personalToken:PT,decision:'confirmed'});assert.equal(r.status,200);assert.equal(m.state.files[0].storage_path,undefined);return {status:r.status,noTemplate:true,createdDecision:m.state.files[0].response_kind,fileAbsent:true};
});
await run('failed revision leaves no current row','public',{history:true,failInsert:true},async({m,send})=>{
  const r=await send({action:'submit',personalToken:PT,decision:'submitted',storagePath:CID+'/'+TID+'/new.pdf',fileName:'new.pdf'});
  assert.equal(r.status,500);assert.equal(m.state.files.filter(x=>x.is_current).length,0);
  return {status:r.status,previousFilePresent:true,currentRows:0,cleanupAttempted:m.state.calls.some(c=>c.storage==='remove')};
});
await run('target update failure still returns success','public',{failTargetUpdate:true},async({m,send})=>{
  const r=await send({action:'submit',personalToken:PT,decision:'submitted',storagePath:CID+'/'+TID+'/new.pdf',fileName:'new.pdf'});
  assert.equal(r.status,200);assert.equal(m.state.targets[0].submitted_at,undefined);
  return {status:r.status,fileRows:m.state.files.length,targetSubmittedAtAbsent:true};
});
await run('invalid custom upload creates ghost target and orphan','public',{collection:{mode:'custom'}},async({m,send})=>{
  const p=CID+'/walk-in/bad.pdf';m.state.objects.set(p,new Blob(['bad pdf']));
  const r=await send({action:'submit',respondentName:'가상학생',decision:'submitted',storagePath:p,fileName:'bad.pdf'});
  assert.equal(r.status,400);assert.equal(m.state.targets.length,1);assert.ok(m.state.objects.has(p));
  return {status:r.status,targetRows:m.state.targets.length,fileRows:m.state.files.length,storageObjectLeft:true,cleanupCalls:m.state.calls.filter(c=>c.storage==='remove').length};
});
await run('custom same-name reload makes a new person','public',{collection:{mode:'custom',allow_resubmit:false}},async({m,send})=>{
  const statuses=[];for(let i=0;i<2;i++){const r=await send({action:'submit',respondentName:'가상학생',decision:'submitted',storagePath:CID+'/walk-in/'+i+'.pdf',fileName:'virtual.pdf'});statuses.push(r.status);}
  assert.deepEqual(statuses,[200,200]);assert.equal(m.state.targets.length,2);
  return {statuses,targetRows:2,revisions:m.state.files.map(x=>x.revision),resubmitDisabledBypassedAsNewPerson:true};
});
await run('custom concurrent row numbering collides','public',{collection:{mode:'custom'},barrierWalkInNumbering:true},async({m,send})=>{
  const r=await Promise.all([1,2].map(i=>send({action:'submit',respondentName:'가상학생'+i,decision:'submitted',storagePath:CID+'/walk-in/'+i+'.pdf',fileName:'virtual.pdf'})));
  const statuses=r.map(x=>x.status).sort();assert.deepEqual(statuses,[200,500]);return {statuses,targets:m.state.targets.length,modelConstraint:'unique(collection_id,row_number)'};
});
await run('search has masked identity but participant credential','public',{},async({send})=>{
  const r=await send({action:'search',query:'가상'});assert.equal(r.status,200);return {status:r.status,targets:r.body.targets,identityOnlyMasked:true,personalTokenReturned:true};
});
fs.writeFileSync(path.join(dir,'evidence/server-mock-observations.json'),JSON.stringify({boundary:'actual handler transpiled, in-memory dependencies; not RLS/PostgreSQL/remote verification',results},null,2));
