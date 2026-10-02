// Isolated Edge Function HTTP contracts. SQL transactions are checked separately
// in studentResults.sql.mjs. All fetches below are mocked; no network permission.
import { decryptStudentPayload, encryptStudentPayload, studentNameLookup } from '../../supabase/functions/_shared/studentResultsCrypto.ts';
type Row = Record<string, unknown>;
type Handler = (request: Request) => Response | Promise<Response>;
const assert = (condition: unknown, message = 'Assertion failed') => { if (!condition) throw new Error(message); };
const keys = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'STUDENT_RESULTS_ENCRYPTION_KEY'];
const previousEnv = keys.map(key => Deno.env.get(key));
const previousFetch = globalThis.fetch;
const previousServe = Deno.serve;
Deno.env.set(keys[0], 'https://student-results-test.invalid');
Deno.env.set(keys[1], 'fictional-service-key');
Deno.env.set(keys[2], '33'.repeat(32));
let captured: Handler | undefined;
Deno.serve = ((handler: Handler) => { captured = handler; return {}; }) as typeof Deno.serve;
await import('../../supabase/functions/student-results-public/index.ts');
const publicHandler = captured!;
await import('../../supabase/functions/student-results-admin/index.ts');
const adminHandler = captured!;
Deno.serve = previousServe;

async function fixture(run: (f: Awaited<ReturnType<typeof setup>>) => Promise<void>) {
  const oldError = console.error;
  const f = await setup();
  console.error = () => {}; // Expected synthetic RPC failures do not print request data.
  try { await run(f); }
  finally { globalThis.fetch = previousFetch; console.error = oldError; }
}

async function setup() {
  const owner = crypto.randomUUID(), eventId = crypto.randomUUID(), token = crypto.randomUUID();
  const event: Row = { id: eventId, owner_id: owner, public_token: token, title: '가상 안내', description: '',
    status: 'open', allow_confirmation: true, allow_dispute: true, updated_at: '2026-01-01T00:00:00.000Z' };
  const recipients: Row[] = await Promise.all(Array.from({length:60}, async (_,i) => ({
    id: crypto.randomUUID(), event_id: eventId, personal_token: crypto.randomUUID(),
    name_lookup: await studentNameLookup('가상학생'+i),
    identity_ciphertext: await encryptStudentPayload({studentKey:String(i+1),name:'가상학생'+i,verificationCode:String(4800+i)}),
    result_ciphertext: await encryptStudentPayload({values:{math:92},feedback:'가상 의견'}),
    revision_ciphertext:null,status:'viewed',viewed_at:'2026-01-01T00:00:00.000Z',confirmed_at:null,
    updated_at:'2026-01-01T00:00:00.000Z',
  })));
  const columns: Row[] = [{event_id:eventId,id:'math',label:'수학',max_score:100,description:'',kind:'score',position:0}];
  const sessions: Row[] = [], disputes: Row[] = [];
  const tables: Record<string,Row[]> = { student_result_events:[event], student_result_recipients:recipients,
    student_result_columns:columns, student_result_public_sessions:sessions, student_result_disputes:disputes };
  const counts = new Map<string,number>(), failures = new Map<string,number>();
  const calls: {path:string;method:string;body?:Row}[] = [];
  const flags = { failRpc:'', revokeBeforeMutation:false, changeSettingsDuringRead:false, continuouslyChange:false, revokeSessionsDuringRead:false, failRateAt:0 };
  const json = (data:unknown,status=200) => new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
  let version = 0;
  let rateCalls = 0;
  const touch = (r:Row) => { r.updated_at = new Date(Date.UTC(2026,0,1,0,0,1,++version)).toISOString(); };
  const issue = (r:Row) => { const session = {token:crypto.randomUUID(),event_id:eventId,recipient_id:r.id,expires_at:new Date(Date.now()+3600000).toISOString()};
    sessions.push(session); return {code:'OK',recipientId:r.id,sessionToken:session.token}; };
  const authorized = (body:Row) => {
    if(flags.revokeBeforeMutation){ sessions.length=0; flags.revokeBeforeMutation=false; }
    const s=sessions.find(s=>s.token===body.p_session_token && Date.parse(String(s.expires_at))>Date.now());
    return s ? recipients.find(r=>r.id===s.recipient_id) : undefined;
  };
  globalThis.fetch = async (input,init) => {
    const request = new Request(input,init), url = new URL(request.url);
    assert(url.hostname==='student-results-test.invalid','Unexpected real request');
    const body:Row|undefined = request.method==='GET'||request.method==='DELETE'?undefined:await request.json();
    calls.push({path:url.pathname,method:request.method,body});
    if(url.pathname==='/auth/v1/user') return json({id:owner,aud:'authenticated',role:'authenticated'});
    if(url.pathname.includes('/rpc/')) {
      const name=url.pathname.split('/').at(-1)!;
      const b=body!;
      if(flags.failRpc===name) return json({code:'fictional_rpc_failure',message:'Fictional transaction unavailable'},503);
      if(name==='consume_student_result_rate_limit') {
        rateCalls++;
        if(flags.failRateAt===rateCalls) return json({code:'fictional_rate_failure',message:'Fictional limit unavailable'},503);
        const n=(counts.get(String(b.p_request_key))??0)+1; counts.set(String(b.p_request_key),n);
        return json(n<=Number(b.p_max_requests));
      }
      if(name==='authenticate_student_result_session') {
        const k=String(b.p_event_id)+':'+String(b.p_name_lookup);
        if((failures.get(k)??0)>=10) return json({code:'RATE_LIMITED'});
        const matches=recipients.filter((r,i)=>r.event_id===b.p_event_id&&r.name_lookup===b.p_name_lookup&&b.p_code===String(4800+i));
        if(matches.length!==1){failures.set(k,(failures.get(k)??0)+1);return json({code:matches.length>1?'AUTH_AMBIGUOUS':'AUTH_INVALID'});}
        return json(issue(matches[0]));
      }
      if(name==='open_student_result_personal_session') {
        const r=recipients.find(r=>r.event_id===b.p_event_id&&r.personal_token===b.p_personal_token);
        return json(r?issue(r):{code:'PERSONAL_LINK_INVALID'});
      }
      if(name==='confirm_student_result'||name==='submit_student_result_dispute') {
        const r=authorized(b); if(!r) return json('SESSION_EXPIRED');
        if(event.status!=='open') return json('EVENT_CLOSED');
        if(r.status==='disputed') return json('DISPUTE_PENDING');
        if(name==='confirm_student_result') {
          if(!event.allow_confirmation) return json('CONFIRM_DISABLED');
          if(r.updated_at!==b.p_expected_updated_at) return json('RESULT_CHANGED');
          r.status='confirmed';r.confirmed_at=new Date().toISOString();touch(r); return json('OK');
        }
        if(!event.allow_dispute) return json('DISPUTE_DISABLED');
        const existing=disputes.find(d=>d.recipient_id===r.id);
        const value={event_id:eventId,recipient_id:r.id,message:null,message_ciphertext:b.p_message_ciphertext,
          submitted_at:new Date().toISOString(),teacher_reply:null,reply_ciphertext:null,replied_at:null};
        if(existing)Object.assign(existing,value);else disputes.push(value);
        r.status='disputed';r.confirmed_at=null;touch(r);return json('OK');
      }
      if(name==='reply_student_result_dispute'||name==='regenerate_student_result_personal_token') {
        if(event.owner_id!==b.p_owner_id||eventId!==b.p_event_id)return json('EVENT_NOT_FOUND');
        const r=recipients.find(r=>r.id===b.p_recipient_id&&r.event_id===b.p_event_id);
        if(!r)return json('RECIPIENT_NOT_FOUND');
        if(name==='reply_student_result_dispute'){
          const d=disputes.find(d=>d.recipient_id===r.id);if(!d)return json('DISPUTE_NOT_FOUND');
          Object.assign(d,{reply_ciphertext:b.p_reply_ciphertext,teacher_reply:null,replied_at:new Date().toISOString()});
          r.status=event.allow_confirmation?'reconfirm':'replied';r.confirmed_at=null;touch(r);return json('OK');
        }
        r.personal_token=b.p_personal_token;touch(r);
        for(let i=sessions.length-1;i>=0;i--)if(sessions[i].recipient_id===r.id)sessions.splice(i,1);
        return json('OK');
      }
      throw new Error('Unexpected RPC '+name);
    }
    const name=url.pathname.split('/').at(-1)!;
    const rows=tables[name];assert(rows,'Unexpected table '+name);
    const filtered=rows.filter(row=>Array.from(url.searchParams).every(([key,value])=>
      value.startsWith('eq.')?String(row[key])===value.slice(3):
      value.startsWith('in.(')?value.slice(4,-1).split(',').includes(String(row[key])):true));
    const format=(selected:Row[])=>request.headers.get('accept')?.includes('vnd.pgrst.object')?selected[0]??null:selected;
    if(request.method==='GET') {
      if(name==='student_result_columns'&&flags.revokeSessionsDuringRead){sessions.length=0;flags.revokeSessionsDuringRead=false;}
      if(name==='student_result_columns'&&(flags.changeSettingsDuringRead||flags.continuouslyChange)){
        event.title='바뀐 가상 안내'; columns[0].max_score=200;touch(event);recipients.forEach(touch);
        flags.changeSettingsDuringRead=false;
      }
      return json(format(filtered));
    }
    if(request.method==='DELETE'){filtered.forEach(r=>rows.splice(rows.indexOf(r),1));return json(null);}
    if(request.method==='PATCH'&&name==='student_result_recipients'&&body?.status==='viewed'){
      filtered.forEach(r=>{Object.assign(r,body);touch(r);});return json(format(filtered));
    }
    throw new Error('Non-atomic protected write attempted: '+request.method+' '+name);
  };
  const request=(body:Row,admin=false,ip='192.0.2.1')=>new Request('https://handler.invalid',{method:'POST',
    headers:{'content-type':'application/json','x-forwarded-for':ip,...(admin?{authorization:'Bearer fictional-owner'}:{})},body:JSON.stringify(body)});
  const call=(body:Row,ip?:string)=>publicHandler(request(body,false,ip));
  const teacher=(body:Row)=>adminHandler(request(body,true));
  const authenticate=(i:number,personal=false)=>call(personal?{action:'personal',token,personalToken:recipients[i].personal_token}:
    {action:'authenticate',token,name:'가상학생'+i,verificationCode:String(4800+i)});
  return {owner,eventId,token,event,recipients,columns,sessions,disputes,calls,flags,failures,call,teacher,authenticate};
}

Deno.test('public authentication strips secrets and rejects recipient override',()=>fixture(async f=>{
  const authentication=await(await f.authenticate(0)).json();
  const r=authentication.result.recipient;
  assert(!('verificationCode'in r)&&!('personalToken'in r)&&!('identity_ciphertext'in r)&&!('revisions'in r));
  const response=await f.call({action:'session',sessionToken:authentication.sessionToken,recipientId:f.recipients[1].id,eventId:crypto.randomUUID()});
  assert(response.status===200 && (await response.json()).result.recipient.id===f.recipients[0].id);
}));
Deno.test('rate limiter failures stop before authentication or protected reads',()=>fixture(async f=>{
  f.flags.failRpc='consume_student_result_rate_limit';
  const response=await f.authenticate(0);assert(response.status===500&&f.sessions.length===0);
  assert(!f.calls.some(c=>c.path.endsWith('/authenticate_student_result_session')||c.path.endsWith('/student_result_events')));
}));
Deno.test('credential verification failures fail closed without session',()=>fixture(async f=>{
  f.flags.failRpc='authenticate_student_result_session';
  assert((await f.authenticate(0)).status===500&&f.sessions.length===0);
}));
Deno.test('credential failures are bounded across changing IPs and leave other student eligible',()=>fixture(async f=>{
  const statuses=[];
  for(let i=0;i<15;i++)statuses.push((await f.call({action:'authenticate',token:f.token,name:'가상학생0',verificationCode:'wrong'},'192.0.2.'+(i+1))).status);
  assert(statuses.filter(s=>s===401).length===10&&statuses.filter(s=>s===429).length===5);
  assert((await f.authenticate(1)).status===200);
}));
Deno.test('teacher owner and expired session checks return no result',()=>fixture(async f=>{
  f.event.owner_id=crypto.randomUUID(); assert((await f.teacher({action:'get',eventId:f.eventId})).status===404);
  f.event.owner_id=f.owner;const auth=await(await f.authenticate(0)).json();
  f.sessions[0].expires_at='2000-01-01T00:00:00.000Z';
  const response=await f.call({action:'session',sessionToken:auth.sessionToken});
  assert(response.status===401&&(await response.json()).code==='SESSION_EXPIRED');
}));
Deno.test('regeneration replaces token and removes all previous student sessions',()=>fixture(async f=>{
  const oldToken=f.recipients[0].personal_token;
  const common=await(await f.authenticate(0)).json(),personal=await(await f.authenticate(0,true)).json();
  assert((await f.teacher({action:'regenerate',eventId:f.eventId,recipientId:f.recipients[0].id})).status===200);
  assert((await f.call({action:'personal',token:f.token,personalToken:oldToken})).status===401);
  for(const auth of [common,personal]){const response=await f.call({action:'session',sessionToken:auth.sessionToken});assert(response.status===401&&(await response.json()).code==='SESSION_EXPIRED');}
  assert((await f.authenticate(0,true)).status===200);
}));
Deno.test('regeneration RPC failure preserves existing personal token and sessions',()=>fixture(async f=>{
  await f.authenticate(0);const oldToken=f.recipients[0].personal_token;
  f.flags.failRpc='regenerate_student_result_personal_token';
  assert((await f.teacher({action:'regenerate',eventId:f.eventId,recipientId:f.recipients[0].id})).status===500);
  assert(f.recipients[0].personal_token===oldToken&&f.sessions.length===1);
}));
Deno.test('dispute encrypts input, uses one protected transaction and returns fresh recipient version',()=>fixture(async f=>{
  const auth=await(await f.authenticate(0)).json();
  const response=await f.call({action:'dispute',sessionToken:auth.sessionToken,message:'가상 이의'});
  const result=await response.json();assert(response.status===200&&result.result.recipient.status==='disputed');
  assert(result.result.recipient.updatedAt===f.recipients[0].updated_at&&result.result.recipient.updatedAt!==auth.result.recipient.updatedAt);
  assert(await decryptStudentPayload(f.disputes[0].message_ciphertext as string)==='가상 이의');
  const calls=f.calls.filter(c=>c.path.endsWith('/submit_student_result_dispute'));assert(calls.length===1);
  assert(!JSON.stringify(calls[0].body).includes('가상 이의'));
}));
Deno.test('dispute RPC failure leaves message and recipient untouched',()=>fixture(async f=>{
  const auth=await(await f.authenticate(0)).json();f.flags.failRpc='submit_student_result_dispute';
  assert((await f.call({action:'dispute',sessionToken:auth.sessionToken,message:'가상 이의'})).status===500);
  assert(f.disputes.length===0&&f.recipients[0].status==='viewed');
}));
Deno.test('answer RPC failure leaves reply empty and student still disputed',()=>fixture(async f=>{
  const auth=await(await f.authenticate(0)).json();await f.call({action:'dispute',sessionToken:auth.sessionToken,message:'가상 이의'});
  f.flags.failRpc='reply_student_result_dispute';
  assert((await f.teacher({action:'reply',eventId:f.eventId,recipientId:f.recipients[0].id,reply:'가상 답변'})).status===500);
  assert(!f.disputes[0].reply_ciphertext&&f.recipients[0].status==='disputed');
}));
Deno.test('answer returns reconfirm or replied according to actual confirmation flag',()=>fixture(async f=>{
  const auth=await(await f.authenticate(0)).json();await f.call({action:'dispute',sessionToken:auth.sessionToken,message:'가상 이의'});
  const args={action:'reply',eventId:f.eventId,recipientId:f.recipients[0].id,reply:'가상 답변'};
  assert((await f.teacher(args)).status===200&&f.recipients[0].status==='reconfirm');
  f.event.allow_confirmation=false;
  assert((await f.teacher(args)).status===200&&f.recipients[0].status==='replied');
  assert(await decryptStudentPayload(f.disputes[0].reply_ciphertext as string)==='가상 답변');
}));
Deno.test('changed version and absent version prevent confirmation',()=>fixture(async f=>{
  const auth=await(await f.authenticate(0)).json();
  f.recipients[0].updated_at='2026-01-02T00:00:00.000Z';
  for(const expectedUpdatedAt of [auth.result.recipient.updatedAt,undefined]){
    const response=await f.call({action:'confirm',sessionToken:auth.sessionToken,expectedUpdatedAt});
    assert(response.status===409&&(await response.json()).code==='RESULT_CHANGED');
  }
  assert(f.recipients[0].status==='viewed');
}));
Deno.test('revocation after pre-read is rechecked within mutation RPC',()=>fixture(async f=>{
  const auth=await(await f.authenticate(0)).json();f.flags.revokeBeforeMutation=true;
  const response=await f.call({action:'confirm',sessionToken:auth.sessionToken,expectedUpdatedAt:auth.result.recipient.updatedAt});
  assert(response.status===401&&(await response.json()).code==='SESSION_EXPIRED'&&f.recipients[0].status==='viewed');
}));
Deno.test('closed event has explicit error code and does not mutate',()=>fixture(async f=>{
  const auth=await(await f.authenticate(0)).json();f.event.status='closed';
  const response=await f.call({action:'dispute',sessionToken:auth.sessionToken,message:'가상 이의'});
  assert(response.status===409&&(await response.json()).code==='EVENT_CLOSED'&&f.disputes.length===0);
}));
Deno.test('malformed session and invalid personal link have distinct recovery codes',()=>fixture(async f=>{
  const session=await f.call({action:'session',sessionToken:'invalid'});assert(session.status===401&&(await session.json()).code==='SESSION_EXPIRED');
  const personal=await f.call({action:'personal',token:f.token,personalToken:'invalid'});assert(personal.status===401&&(await personal.json()).code==='PERSONAL_LINK_INVALID');
}));

Deno.test('result assembly retries changed settings rather than mixing old guidance with new version',()=>fixture(async f=>{
  f.flags.changeSettingsDuringRead=true;
  const response=await f.authenticate(0);const data=await response.json();
  assert(response.status===200&&data.result.event.title==='바뀐 가상 안내'&&data.result.event.columns[0].maxScore===200);
  assert(data.result.recipient.updatedAt===f.recipients[0].updated_at);
}));
Deno.test('continuously changing result assembly returns conflict without disclosing mixed data',()=>fixture(async f=>{
  f.flags.continuouslyChange=true;const response=await f.authenticate(0);const data=await response.json();
  assert(response.status===409&&data.code==='RESULT_CHANGED'&&!('result'in data));
}));

Deno.test('session revoked during result assembly prevents returning previously read data',()=>fixture(async f=>{
  f.flags.revokeSessionsDuringRead=true;const response=await f.authenticate(0);const data=await response.json();
  assert(response.status===401&&data.code==='SESSION_EXPIRED'&&!('result'in data));
}));

Deno.test('one school IP supports 120 metadata reads and 60 common plus 60 personal authentications',()=>fixture(async f=>{
  const metadata=await Promise.all(Array.from({length:120},()=>f.call({action:'metadata',token:f.token})));
  assert(metadata.every(r=>r.status===200),'Normal classroom metadata was limited');
  const common=await Promise.all(Array.from({length:60},(_,i)=>f.authenticate(i)));
  assert(common.every(r=>r.status===200),'Normal classroom common authentication was limited');
  const personal=await Promise.all(Array.from({length:60},(_,i)=>f.authenticate(i,true)));
  assert(personal.every(r=>r.status===200),'Normal classroom personal authentication was limited');
  assert(f.sessions.length===120&&f.failures.size===0);
  assert(f.calls.some(c=>c.body?.p_max_requests===1200)&&f.calls.some(c=>c.body?.p_max_requests===600));
  for(const action of [
    {action:'metadata',token:f.token},
    {action:'authenticate',token:f.token,name:'가상학생0',verificationCode:'4800'},
    {action:'personal',token:f.token,personalToken:f.recipients[0].personal_token},
  ]){
    const response=await f.call(action);
    assert(response.status===429&&(await response.json()).code==='RATE_LIMITED','Action quota did not enforce its boundary');
  }
}));

Deno.test('one IP still bounds one student to 10 wrong codes and admits another student',()=>fixture(async f=>{
  const statuses=[];
  for(let i=0;i<15;i++)statuses.push((await f.call({action:'authenticate',token:f.token,name:'가상학생0',verificationCode:'wrong'})).status);
  assert(statuses.filter(s=>s===401).length===10&&statuses.filter(s=>s===429).length===5);
  assert(f.sessions.length===0);
  assert((await f.authenticate(1)).status===200,'Another student was blocked by the first student failure quota');
}));

Deno.test('the same token is capped at 600 requests across different IPs',()=>fixture(async f=>{
  for(let i=0;i<600;i++){
    const response=await f.call({action:'metadata',token:f.token},'192.0.2.'+(Math.floor(i/120)+1));
    assert(response.status===200,'Token quota limited an eligible request '+i);
  }
  const before=f.calls.length;
  const response=await f.call({action:'metadata',token:f.token},'192.0.2.6');
  assert(response.status===429&&(await response.json()).code==='RATE_LIMITED');
  const blockedCalls=f.calls.slice(before);
  assert(blockedCalls.length===2&&blockedCalls.every(c=>c.path.endsWith('/consume_student_result_rate_limit')));
}));

Deno.test('one IP is capped at 1200 requests across different tokens and actions',()=>fixture(async f=>{
  for(let i=0;i<1200;i++){
    const response=await f.call({action:i%2===0?'metadata':'authenticate',token:crypto.randomUUID(),name:'가상학생0',verificationCode:'4800'});
    assert(response.status===404,'Total IP quota limited an eligible request '+i);
  }
  const before=f.calls.length;
  const response=await f.call({action:'metadata',token:f.token});
  assert(response.status===429&&(await response.json()).code==='RATE_LIMITED');
  const blockedCalls=f.calls.slice(before);
  assert(blockedCalls.length===1&&blockedCalls[0].path.endsWith('/consume_student_result_rate_limit'));
}));

Deno.test('per-session action quotas remain 60 reads and 10 confirmations',()=>fixture(async f=>{
  const auth=await(await f.authenticate(0)).json();
  for(let i=0;i<60;i++)assert((await f.call({action:'session',sessionToken:auth.sessionToken})).status===200);
  assert((await f.call({action:'session',sessionToken:auth.sessionToken})).status===429);
  for(let i=0;i<10;i++)assert((await f.call({action:'confirm',sessionToken:auth.sessionToken,expectedUpdatedAt:f.recipients[0].updated_at})).status===200);
  assert((await f.call({action:'confirm',sessionToken:auth.sessionToken,expectedUpdatedAt:f.recipients[0].updated_at})).status===429);
}));

for(const bucket of [1,2,3]){
 Deno.test('rate bucket '+bucket+' failure stops before data access or session issuance',()=>fixture(async f=>{
  f.flags.failRateAt=bucket;
  assert((await f.authenticate(0)).status===500&&f.sessions.length===0);
  assert(f.calls.length===bucket&&f.calls.every(c=>c.path.endsWith('/consume_student_result_rate_limit')));
 }));
}

globalThis.addEventListener('unload',()=>{
  keys.forEach((key,i)=>previousEnv[i]===undefined?Deno.env.delete(key):Deno.env.set(key,previousEnv[i]!));
  globalThis.fetch=previousFetch;
});
