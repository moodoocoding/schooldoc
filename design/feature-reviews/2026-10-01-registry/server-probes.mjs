// 네트워크 없는 소스 실행. DB/RPC/Storage/Auth/암호화는 모의이며 원격 RLS 검사가 아니다.
import fs from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import { webcrypto } from 'node:crypto';
import assert from 'node:assert/strict';

const root = 'design/feature-reviews/2026-10-01-registry';
const token = '22222222-2222-4222-8222-222222222222';
const rid = '11111111-1111-4111-8111-111111111111';
const pid = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const png = 'data:image/png;base64,' + (await fs.readFile(root+'/evidence/signature-original.png')).toString('base64');
const observations = [];
const record = (name, detail) => { observations.push({name,detail}); console.log(name, JSON.stringify(detail)); };
const layoutSource = ts.transpileModule(await fs.readFile('supabase/functions/registry-pdf/layout.ts','utf8'), {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const actualLayout = await import('data:text/javascript;base64,'+Buffer.from(layoutSource).toString('base64'));

function state() {
  return {
    registry: {id:rid,owner_id:'owner',public_token:token,mode:'fixed',title:'가상 모의 등록부',left_header:'',right_header:'',layout:20,status:'open',allow_walk_in:true,password_digest:null},
    columns:[{id:'affiliation',registry_id:rid,label:'소속',position:0}],
    participants:Array.from({length:24},(_,i)=>({id:pid(i+1),registry_id:rid,row_number:i+1,name:i<2?'가상김하늘':`가상참석자${i+1}`,field_values:{affiliation:`가상학교 ${i+1}반`},status:'pending'})),
    signatures:[], files:[],calls:[],limits:new Map(), failSeal:false,failLimit:false,user:'owner',configured:true,
  };
}
function database(s) {
  const from = table => {
    let op='select', values, options, filters=[], single=false;
    const chain = {
      select(_columns,o){if(op==='select')options=o;return this;},
      eq(k,v){filters.push(r=>r[k]===v);return this;},
      in(k,v){filters.push(r=>v.includes(r[k]));return this;},
      order(){return this;},limit(){return this;},
      maybeSingle(){single=true;return this;},single(){single=true;return this;},
      insert(v){op='insert';values=v;return this;},update(v){op='update';values=v;return this;},delete(){op='delete';return this;},
      then(resolve,reject){return Promise.resolve().then(()=>{
        s.calls.push({table,op});
        let rows=table==='registries'?[s.registry]:table==='registry_columns'?s.columns:table==='registry_participants'?s.participants:s.signatures;
        rows=rows.filter(r=>filters.every(f=>f(r)));
        if(op==='insert'&&table==='registry_signatures'){
          if(s.signatures.some(r=>r.participant_id===values.participant_id))return {data:null,error:{code:'23505'}};
          s.signatures.push({...values,created_at:'2026-10-01T00:00:00Z'});
          // 실제 sync_registry_signature_status trigger의 상태 변화만 모델링한다.
          s.participants.find(r=>r.id===values.participant_id).status='signed';
        }
        if(op==='update'&&table==='registry_participants'){
          if(s.failSeal)return {data:null,error:{code:'injected',message:'mock seal failure'}};
          rows.forEach(r=>Object.assign(r,values));
        }
        return {data:single?rows[0]??null:rows,error:null,count:options?.count?rows.length:undefined};
      }).then(resolve,reject);}
    };
    return chain;
  };
  return {
    from,
    rpc:async(name,args)=>{
      s.calls.push({rpc:name,args});
      if(name==='consume_registry_rate_limit'){
        if(s.failLimit)return {error:{message:'mock limit unavailable'}};
        const n=(s.limits.get(args.p_request_key)??0)+1;s.limits.set(args.p_request_key,n);
        return {data:n<=args.p_max_requests,error:null};
      }
      if(name==='verify_registry_password')return {data:args.p_password==='fictional-pass',error:null};
      if(name==='search_registry_participants')return {data:s.participants.filter(p=>p.name.includes(args.p_query)).slice(0,args.p_limit),error:null};
      if(name==='create_registry_walk_in'){
        const p={id:pid(100+s.participants.length),registry_id:rid,row_number:s.participants.length+1,name:args.p_name,field_values:args.p_field_values,status:'pending'};s.participants.push(p);return {data:p,error:null};
      }
      throw Error('Unexpected mock RPC '+name);
    },
    storage:{from:()=>({
      upload:async(p)=>{s.files.push(p);return {error:null};},
      remove:async(paths)=>{if(!s.silentRemove)s.files=s.files.filter(p=>!paths.includes(p));return {error:null};},
      createSignedUrls:async(paths)=>({data:paths.map(p=>({path:p,error:'mock missing object',signedUrl:null})),error:null}),
      download:async()=>({data:null,error:{message:'mock missing object'}}),
    })},
    auth:{getUser:async()=>({data:{user:s.user?{id:s.user}:null},error:s.user?null:{message:'mock invalid session'}})},
  };
}
async function loadSource(file,s,tail='') {
  let source=await fs.readFile(file,'utf8');
  source=source.replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g,'');
  source=source.replace(/import\.meta\.url/g,"'file:///mock/index.ts'");
  const code=ts.transpileModule(source+'\n'+tail,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/export\s+/g,'');
  let handler;
  const db=database(s);
  const context=vm.createContext({
    crypto:webcrypto,Request,Response,Headers,TextEncoder,Uint8Array,atob,URL,Map,Set,
    console:{error:()=>{},warn:()=>{}},
    Deno:{env:{get:()=> 'mock-only-placeholder'},serve:h=>{handler=h;}},
    createClient:()=>db,
    registryCrypto:{isConfigured:()=>s.configured,encryptPayload:async v=>'mock-sealed:'+JSON.stringify(v),decryptPayload:async v=>JSON.parse(v.replace('mock-sealed:',''))},
    supabase:db,window:{dispatchEvent:()=>{}},CustomEvent:class{},
    rgb:(r,g,b)=>({r,g,b}), ...actualLayout,
  });
  new vm.Script(code,{filename:file}).runInContext(context);
  return {handler,context};
}
const request=(action,extra={},auth=true)=>new Request('http://mock.invalid/registry',{method:'POST',headers:{'content-type':'application/json','x-forwarded-for':'192.0.2.1',...(auth?{Authorization:'Bearer mock-only'}:{})},body:JSON.stringify({action,token,...extra})});
const call=async(h,a,e={},auth=true)=>{const r=await h(request(a,e,auth));return {status:r.status,body:await r.json()};};
const submit=(n,extra={})=>({participantId:pid(n),dataUrl:png,source:'draw',width:300,height:190,values:{},...extra});

let s=state();let {handler:h}=await loadSource('supabase/functions/registry-public/index.ts',s);
record('invalid-token',await call(h,'metadata',{token:'invalid'}));
s.registry.password_digest='mock';
record('wrong-password',await call(h,'search',{query:'가상',password:'wrong'}));
s.registry.password_digest=null;s.registry.status='closed';
record('closed-submit',await call(h,'submit',submit(1)));
s.registry.status='open';
record('participant-from-other-registry',await call(h,'submit',submit(999)));
record('invalid-image',await call(h,'submit',submit(1,{dataUrl:'data:image/png;base64,aGVsbG8='})));
record('normal-submit',await call(h,'submit',submit(1,{values:{affiliation:''}})));
record('normal-preserves-teacher-field',JSON.parse(s.participants[0].field_values_ciphertext.replace('mock-sealed:','')));
record('duplicate-submit',await call(h,'submit',submit(1)));
const search=await call(h,'search',{query:'가상김하늘'});record('server-masked-duplicate',search);
record('name-only-affiliation-search',await call(h,'search',{query:'가상학교'}));

s=state();({handler:h}=await loadSource('supabase/functions/registry-public/index.ts',s));
s.failSeal=true;
const first=await call(h,'submit',submit(1,{values:{affiliation:'가상수정학교'}}));
const retry=await call(h,'submit',submit(1,{values:{affiliation:'가상수정학교'}}));
assert.equal(first.status,500);assert.equal(retry.status,409);assert.equal(s.signatures.length,1);
record('partial-submit-failure',{first,retry,signatureCount:s.signatures.length,fileCount:s.files.length,participant:s.participants[0]});
s=state();({handler:h}=await loadSource('supabase/functions/registry-public/index.ts',s));s.failSeal=true;
record('partial-walkin-failure',{response:await call(h,'walk-in',{name:'가상새참석자',values:{affiliation:'가상학교'}}),newParticipant:s.participants.at(-1)});

s=state();({handler:h}=await loadSource('supabase/functions/registry-public/index.ts',s));
const submitStatuses=[];for(let i=1;i<=24;i++)submitStatuses.push((await call(h,'submit',submit(i))).status);
assert.equal(submitStatuses.filter(n=>n===200).length,10);
record('same-ip-24-submits',{statuses:submitStatuses,accepted:10,rejected:14});
s=state();({handler:h}=await loadSource('supabase/functions/registry-public/index.ts',s));
const searchStatuses=[];for(let i=1;i<=31;i++)searchStatuses.push((await call(h,'search',{query:'가상'})).status);
record('same-ip-31-searches',{accepted:searchStatuses.filter(n=>n===200).length,rejected:searchStatuses.filter(n=>n===429).length});
s.failLimit=true;record('rate-limit-unavailable-blocks',await call(h,'metadata'));

s=state();({handler:h}=await loadSource('supabase/functions/registry-participants/index.ts',s));
record('teacher-no-auth',await call(h,'read',{registryIds:[rid]},false));
s.user=null;record('teacher-invalid-auth',await call(h,'read',{registryIds:[rid]}));
s.user='outsider';record('teacher-other-owner-write',await call(h,'addOne',{registryId:rid,name:'가상참석자'}));
record('teacher-other-owner-read',await call(h,'read',{registryIds:[rid]}));
s.user='owner';s.configured=false;record('teacher-encryption-unavailable',await call(h,'read',{registryIds:[rid]}));

s=state();const repo=await loadSource('src/features/registry/registryRepository.ts',s,'globalThis.probeAssemble = assembleRegistries;globalThis.probeRemove=removeSignatureFiles;');
const rows=await repo.context.probeAssemble([s.registry],[{...s.columns[0],registry_id:rid}],[{...s.participants[0],status:'signed',signed_at:'2026-10-01T00:00:00Z'}],[{registry_id:rid,participant_id:pid(1),source:'draw',storage_path:'mock/missing.png',created_at:'2026-10-01T00:00:00Z'}]);
assert.equal(rows[0].participants[0].signature,undefined);
record('signed-status-lost-with-missing-url',rows[0].participants[0]);
s.files=['mock/a.png'];s.silentRemove=true;
let removeError='';try{await repo.context.probeRemove(s.files,async()=>s.files);}catch(e){removeError=e.message;}
assert.match(removeError,/지우지 못/);
record('delete-verifies-storage-removal',{error:removeError,remaining:s.files.length});
s.silentRemove=false;await repo.context.probeRemove(s.files,async()=>s.files);
record('delete-retry-clears-storage',{remaining:s.files.length});

s=state();const pdf=await loadSource('supabase/functions/registry-pdf/index.ts',s,'globalThis.probeLoad = loadSignatureImages;globalThis.probeText = drawCellText;globalThis.probeHeader = drawHeaderText;');
const imageMap=await pdf.context.probeLoad({embedPng:async()=>({}),embedJpg:async()=>({})},[{participant_id:pid(1),storage_path:'mock/missing.png'}]);
assert.equal(imageMap.size,0);record('pdf-missing-signature-silent',{images:imageMap.size,error:false});
const texts=[];
const mockFont={widthOfTextAtSize:(text,size)=>Array.from(text).length*size};
const mockPage={drawText:(text,options)=>texts.push({text,...options,textWidth:mockFont.widthOfTextAtSize(text,options.size)})};
pdf.context.probeText(mockPage,mockFont,'가상학교긴추가항목데이터입니다',0,0,26.5,40,7.5,5.5);
pdf.context.probeHeader(mockPage,mockFont,'가상 첫 줄\n가상 둘째 줄\n가상 셋째 줄',0,100,200,'left');
record('pdf-boundary-text',{draws:texts,cellWidth:26.5,thirdHeaderLinePresent:texts.some(t=>t.text==='가상 셋째 줄')});
await fs.writeFile(root+'/evidence/server-observations.json',JSON.stringify({method:'TypeScript source transpiled in Node VM; all DB/RPC/Storage/Auth/crypto mocked; no network',observations},null,2));
