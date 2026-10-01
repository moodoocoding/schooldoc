// HTTP 계약·장애 주입 검사. 실제 handler와 AES-GCM을 실행하되 DB/Storage 전송은 대역이다.
// 원격/로컬 Supabase 전체 검증으로 보고하지 않는다. 네트워크 권한 없이 실행한다.
import { registryCrypto } from '../../supabase/functions/_shared/registryCrypto.ts';
const id='10000000-0000-4000-8000-000000000001';
const token='20000000-0000-4000-8000-000000000001';
const participantId='30000000-0000-4000-8000-000000000001';
const columnId='40000000-0000-4000-8000-000000000001';
const requestId='50000000-0000-4000-8000-000000000001';
const assert=(value:unknown,message='Assertion failed')=>{if(!value)throw new Error(message);};
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
let handler:(request:Request)=>Promise<Response>;
let responder: typeof fetch;
const oldFetch=globalThis.fetch,oldServe=Deno.serve;
const names=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','REGISTRY_ENCRYPTION_KEY'];
const previous=names.map(n=>Deno.env.get(n));
Deno.env.set(names[0],'https://registry-contract.invalid');
Deno.env.set(names[1],'fixture-not-a-real-secret');
Deno.env.set(names[2],'12'.repeat(32));
// 서버 부팅만 가로채 요청 처리기를 캡처한다. 인증·검증·저장 분기는 실제 함수를 호출한다.
globalThis.fetch=((input,init)=>responder(input,init)) as typeof fetch;
Deno.serve=((callback:typeof handler)=>{handler=callback;return {} as ReturnType<typeof Deno.serve>;}) as typeof Deno.serve;
await import('../../supabase/functions/registry-public/index.ts');
Deno.serve=oldServe;
names.forEach((n,i)=>previous[i]===undefined?Deno.env.delete(n):Deno.env.set(n,previous[i]!));

interface Flags { commitError:boolean; responseLost:boolean; uploadError:boolean; removeRemains:boolean; brokenCipher:boolean; duplicates:boolean; prior:boolean; }
async function fixture(run:(f:Awaited<ReturnType<typeof createFixture>>)=>Promise<void>) {
  const oldKey = Deno.env.get('REGISTRY_ENCRYPTION_KEY');
  Deno.env.set('REGISTRY_ENCRYPTION_KEY','12'.repeat(32));
  try { await run(await createFixture()); }
  finally { globalThis.fetch=oldFetch; if (oldKey === undefined) Deno.env.delete('REGISTRY_ENCRYPTION_KEY'); else Deno.env.set('REGISTRY_ENCRYPTION_KEY',oldKey); }
}
async function createFixture() {
  globalThis.fetch=((input,init)=>responder(input,init)) as typeof fetch;
  const flags:Flags={commitError:false,responseLost:false,uploadError:false,removeRemains:false,brokenCipher:false,duplicates:false,prior:false};
  const files=new Set<string>(),calls:{path:string;method:string;body?:Record<string,unknown>}[]=[];
  let saved:Record<string,unknown>|null=null;
  const values={ [columnId]:'가상학교 원문' };
  const ciphertext=await registryCrypto.encryptPayload(values);
  const row={id:participantId,registry_id:id,row_number:1,name:'가상동명',status:'pending',updated_at:'2026-10-01T00:00:00Z',field_values_ciphertext:ciphertext};
  responder=async(input,init)=>{
    const request=new Request(input,init),url=new URL(request.url);
    assert(url.hostname==='registry-contract.invalid','Unexpected network');
    const storageUpload=url.pathname.startsWith('/storage/v1/object/registry-signatures/') && request.method==='POST';
    const body=storageUpload?undefined:request.method==='GET'?undefined:await request.json() as Record<string,unknown>;
    calls.push({path:url.pathname,method:request.method,body});
    if(url.pathname.endsWith('/rpc/registry_public_context'))return json({
      registry:{id,owner_id:id,public_token:token,title:'가상등록부',left_header:'',right_header:'',status:'open',mode:'fixed',allow_walk_in:true,layout:20},
      columns:[{id:columnId,label:'소속',position:0}],has_password:false,
      participants:[{...row,field_values_ciphertext:flags.brokenCipher?'broken':ciphertext,requires_identity:flags.duplicates,requires_code:false}],
      participant:body?.p_participant_id===participantId?{...row,field_values_ciphertext:flags.brokenCipher?'broken':ciphertext}:null,
      peers:flags.duplicates?[row,{...row,id:crypto.randomUUID()}]:[row],duplicate_count:0,
      prior_signature:flags.prior?saved:null,
    });
    if(storageUpload){if(flags.uploadError)return json({statusCode:'503',error:'storage unavailable',message:'storage unavailable'},503);files.add(url.pathname.split('/registry-signatures/')[1]);return json({Key:'ok'},200);}
    if(url.pathname.endsWith('/rpc/registry_commit_signature')) {
      if(flags.commitError)return json({message:'injected DB failure'},500);
      saved={request_id:body!.p_request_id,content_hash:body!.p_hash,request_digest:body!.p_request_digest,storage_path:body!.p_path};
      if(flags.responseLost)return json({message:'response lost'},500);
      return json({ok:true});
    }
    if(url.pathname.endsWith('/registry_signatures'))return json(saved);
    if(url.pathname==='/storage/v1/object/registry-signatures' && request.method==='DELETE'){
      if(!flags.removeRemains)for(const path of body!.prefixes as string[])files.delete(path);
      return json([]);
    }
    if(url.pathname==='/storage/v1/object/list/registry-signatures')return json(Array.from(files).filter(p=>p.startsWith(String(body!.prefix)+'/')).map(p=>({name:p.split('/').at(-1),id:crypto.randomUUID()})));
    if(url.pathname.endsWith('/registry_cleanup_attempts'))return json({},201);
    throw new Error('Unhandled fixture route '+url.pathname);
  };
  const request=async(overrides:Record<string,unknown>={})=>{
    const response=await handler(new Request('https://local-handler.invalid',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'submit',token,participantId,requestId,source:'draw',width:1,height:1,dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jW9kAAAAASUVORK5CYII=',values:{},...overrides})}));
    return {status:response.status,body:await response.json()};
  };
  return {flags,calls,files,request,getSaved:()=>saved};
}
Deno.test('공개 검색은 원문·암호문 없이 마스킹과 확인 조건만 반환한다',()=>fixture(async f=>{
  const r=await f.request({action:'search',query:'가상'});assert(r.status===200);
  assert(!JSON.stringify(r.body).includes('가상학교 원문'));assert(!JSON.stringify(r.body).includes('field_values_ciphertext'));
  assert(r.body.participants[0].values[columnId].startsWith('가상'));assert(f.calls.length===1);
}));
Deno.test('서명은 한 완료 RPC에서 암호문으로 저장되고 동일 재시도는 업로드하지 않는다',()=>fixture(async f=>{
  assert((await f.request()).status===200);
  const commit=f.calls.find(c=>c.path.endsWith('/registry_commit_signature'))!.body!;
  const decoded=await registryCrypto.decryptPayload<Record<string,string>>(String(commit.p_ciphertext));assert(decoded[columnId]==='가상학교 원문');
  assert(!String(commit.p_ciphertext).includes('가상학교'));assert(f.calls.filter(c=>c.path.endsWith('/registry_commit_signature')).length===1);
  const count=f.calls.length;f.flags.prior=true;assert((await f.request()).status===200);assert(f.calls.length===count+1);
}));
Deno.test('SQL 실패는 해당 시도 파일만 정리하고 재시도에 새 파일 경로를 사용한다',()=>fixture(async f=>{
  f.flags.commitError=true;assert((await f.request()).status===500);assert(f.files.size===0);
  const first=f.calls.find(c=>c.path.endsWith('/registry_commit_signature'))!.body!.p_path;
  f.flags.commitError=false;assert((await f.request()).status===200);assert(f.files.size===1);
  const last=f.calls.filter(c=>c.path.endsWith('/registry_commit_signature')).at(-1)!.body!.p_path;assert(first!==last);
}));
Deno.test('완료 응답 유실 후 저장 사실을 확인하면 성공하고 참조 파일을 지우지 않는다',()=>fixture(async f=>{
  f.flags.responseLost=true;assert((await f.request()).status===200);assert(f.files.size===1);
  assert(!f.calls.some(c=>c.method==='DELETE'));assert(f.getSaved()?.storage_path===Array.from(f.files)[0]);
}));
Deno.test('Storage 제거 성공 응답 뒤 잔존 파일을 확인하고 개인정보 없는 재시도 기록을 남긴다',()=>fixture(async f=>{
  f.flags.commitError=true;f.flags.removeRemains=true;assert((await f.request()).status===500);
  const records=f.calls.filter(c=>c.path.endsWith('/registry_cleanup_attempts'));assert(records.length===1);
  assert(JSON.stringify(records[0].body)===JSON.stringify({owner_id:id,registry_id:id,purpose:'upload',file_count:1}));
}));
Deno.test('이미지 업로드·복호화 실패는 DB 완료 저장을 실행하지 않는다',()=>fixture(async f=>{
  f.flags.uploadError=true;assert((await f.request()).status===500);assert(!f.calls.some(c=>c.path.endsWith('/registry_commit_signature')));
  f.flags.uploadError=false;f.flags.brokenCipher=true;const before=f.calls.length;assert((await f.request()).status===500);
  assert(f.calls.slice(before).every(c=>c.path.endsWith('/registry_public_context')));
}));
Deno.test('동명이인 원문 조건이 두 명에 일치하면 서명을 저장하지 않는다',()=>fixture(async f=>{
  f.flags.duplicates=true;assert((await f.request({verifyName:'가상동명',verificationValues:{[columnId]:'가상학교 원문'}})).status===401);
  assert(f.files.size===0);assert(f.calls.every(c=>c.path.endsWith('/registry_public_context')));
}));
Deno.test('현장 미리보기는 쓰지 않고 최종 제출에만 원문 항목을 봉인한다',()=>fixture(async f=>{
  assert((await f.request({action:'walk-in',name:'가상현장',values:{[columnId]:'현장 원문'}})).status===200);
  assert(f.calls.length===1);assert(f.files.size===0);
  const other=crypto.randomUUID();assert((await f.request({participantId:other,walkInName:'가상현장',walkInValues:{[columnId]:'현장 원문'},values:{}})).status===200);
  const commit=f.calls.find(c=>c.path.endsWith('/registry_commit_signature'))!.body!;
  assert((await registryCrypto.decryptPayload<Record<string,string>>(String(commit.p_ciphertext)))[columnId]==='현장 원문');
}));
