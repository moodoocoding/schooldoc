// Review observations, not passing product regression tests.
// All PostgREST/Auth/RPC responses are mocked; no network permission is required.
import { encryptStudentPayload, decryptStudentPayload, studentNameLookup } from '../../../supabase/functions/_shared/studentResultsCrypto.ts';
type Row = Record<string, unknown>;
type Handler = (request: Request) => Response | Promise<Response>;
const assert = (value: unknown, message: string) => { if (!value) throw new Error(message); };
const keys = ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','STUDENT_RESULTS_ENCRYPTION_KEY'];
const previousEnv = keys.map(key=>Deno.env.get(key));
const previousFetch = globalThis.fetch;
const originalServe = Deno.serve;
Deno.env.set(keys[0],'https://student-review.invalid'); Deno.env.set(keys[1],'fictional-review-key'); Deno.env.set(keys[2],'22'.repeat(32));
let captured: Handler | undefined;
Deno.serve = ((handler: Handler) => { captured=handler; return {}; }) as typeof Deno.serve;
await import('../../../supabase/functions/student-results-public/index.ts');
const publicHandler=captured!;
await import('../../../supabase/functions/student-results-admin/index.ts');
const adminHandler=captured!;
Deno.serve=originalServe;
async function fixture(run:(f:Awaited<ReturnType<typeof setup>>)=>Promise<void>) {
 const f=await setup();try {await run(f);}finally {globalThis.fetch=previousFetch;}
}
async function setup(){
 const owner=crypto.randomUUID(), eventId=crypto.randomUUID(), token=crypto.randomUUID();
 const event:Row={id:eventId,owner_id:owner,public_token:token,title:'가상 서버 결과',description:'가상 안내',status:'open',allow_confirmation:true,allow_dispute:true,updated_at:new Date().toISOString()};
 const recipients:Row[]=await Promise.all(Array.from({length:24},async(_,i)=>({
  id:crypto.randomUUID(),event_id:eventId,personal_token:crypto.randomUUID(),
  name_lookup:await studentNameLookup('가상학생'+i),
  identity_ciphertext:await encryptStudentPayload({studentKey:String(i+1),name:'가상학생'+i,verificationCode:String(4800+i)}),
  result_ciphertext:await encryptStudentPayload({values:{math:92},feedback:'가상 의견'}),revision_ciphertext:null,
  status:'viewed',viewed_at:new Date().toISOString(),confirmed_at:null,updated_at:new Date().toISOString(),
 })));
 const columns:Row[]=[{event_id:eventId,id:'math',label:'수학',max_score:100,description:'',kind:'score',position:0}];
 const sessions:Row[]=[],disputes:Row[]=[];
 const tables:Record<string,Row[]>={student_result_events:[event],student_result_recipients:recipients,student_result_columns:columns,student_result_public_sessions:sessions,student_result_disputes:disputes};
 const counts=new Map<string,number>(),calls:{path:string;method:string;body?:Row}[]=[];
 let failRecipientStatus=false;
 const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
 globalThis.fetch=async(input,init)=>{
  const request=new Request(input,init),url=new URL(request.url);
  assert(url.hostname==='student-review.invalid','Unexpected real request');
  const body=request.method==='GET'||request.method==='DELETE'?undefined:await request.json();
  calls.push({path:url.pathname,method:request.method,body});
  if(url.pathname==='/auth/v1/user') return json({id:owner,aud:'authenticated',role:'authenticated',email:'virtual@example.invalid'});
  if(url.pathname.endsWith('/rpc/consume_student_result_rate_limit')){
   const n=(counts.get(body.p_request_key)??0)+1;counts.set(body.p_request_key,n);return json(n<=body.p_max_requests);
  }
  if(url.pathname.endsWith('/rpc/verify_student_result_code')){
   const i=recipients.findIndex(r=>r.id===body.p_recipient_id);return json(i>=0&&body.p_code===String(4800+i));
  }
  const name=url.pathname.split('/').at(-1)!;
  const rows=tables[name];assert(rows,'Unexpected mocked table '+name);
  const filtered=rows.filter(row=>Array.from(url.searchParams).every(([k,v])=>{
   if(v.startsWith('eq.')) return String(row[k])===v.slice(3);
   if(v.startsWith('in.(')) return v.slice(4,-1).split(',').includes(String(row[k]));
   return true;
  }));
  const format=(rows:Row[])=>request.headers.get('accept')?.includes('vnd.pgrst.object')?rows[0]??null:rows;
  if(request.method==='GET') return json(format(filtered.slice(0,Number(url.searchParams.get('limit')??filtered.length))));
  if(request.method==='POST'){
   if(name==='student_result_public_sessions'){
    const s={...body,token:crypto.randomUUID(),expires_at:new Date(Date.now()+12*60*60_000).toISOString()};sessions.push(s);return json(format([s]));
   }
   if(name==='student_result_disputes'){
    const existing=disputes.find(d=>d.recipient_id===body.recipient_id);
    if(existing) Object.assign(existing,body);else disputes.push({id:crypto.randomUUID(),...body});
    return json(null);
   }
  }
  if(request.method==='PATCH'){
   if(name==='student_result_recipients'&&failRecipientStatus&&body.status) return json({code:'synthetic_failure',message:'virtual status write failed'},503);
   filtered.forEach(row=>Object.assign(row,body,...(name==='student_result_recipients'?[{updated_at:new Date().toISOString()}]:[])));
   return json(format(filtered));
  }
  if(request.method==='DELETE'){filtered.forEach(row=>rows.splice(rows.indexOf(row),1));return json(null);}
  throw new Error('Unexpected mocked request '+request.method+' '+url.pathname);
 };
 const request=(body:Row,admin=false)=>new Request('https://handler.invalid',{method:'POST',headers:{'content-type':'application/json','x-forwarded-for':'192.0.2.1',...(admin?{authorization:'Bearer virtual-owner-token'}:{})},body:JSON.stringify(body)});
 const call=(body:Row)=>publicHandler(request(body));
 const teacher=(body:Row)=>adminHandler(request(body,true));
 const authenticate=(i:number,personal=false)=>call(personal?{action:'personal',token,personalToken:recipients[i].personal_token}:{action:'authenticate',token,name:'가상학생'+i,verificationCode:String(4800+i)});
 return {owner,eventId,token,event,recipients,columns,sessions,disputes,calls,call,teacher,authenticate,setFailStatus:(value:boolean)=>{failRecipientStatus=value;}};
}
const observations:Record<string,unknown>={};
const record=(name:string,value:unknown)=>{observations[name]=value;console.log(name,JSON.stringify(value));};
Deno.test('review: normal public response strips secrets and session selects its own student',()=>fixture(async f=>{
 const auth=await f.authenticate(0);assert(auth.status===200,'Auth failed');const session=await auth.json();
 const r=session.result.recipient;assert(!('verificationCode'in r)&&!('personalToken'in r)&&!('identity_ciphertext'in r)&&!('revisions'in r),'Public secret leaked');
 const response=await f.call({action:'session',sessionToken:session.sessionToken,recipientId:f.recipients[1].id,eventId:crypto.randomUUID()});
 assert(response.status===200,'Session failed');assert((await response.json()).result.recipient.id===f.recipients[0].id,'Client recipient override trusted');
 record('publicContract',{status:200,secretsStripped:true,recipientOverrideIgnored:true});
}));
Deno.test('review: teacher owner filter and expired session are enforced',()=>fixture(async f=>{
 f.event.owner_id=crypto.randomUUID();
 const notOwned=await f.teacher({action:'get',eventId:f.eventId});
 f.event.owner_id=f.owner;assert(notOwned.status===404,'Wrong owner event read');
 const auth=await(await f.authenticate(0)).json();f.sessions[0].expires_at='2000-01-01T00:00:00.000Z';
 const expired=await f.call({action:'session',sessionToken:auth.sessionToken});assert(expired.status===401,'Expired session accepted');
 record('accessChecks',{otherOwnerEvent:404,expiredSession:401});
}));
Deno.test('review: 24 common-link authentications share the 10 per minute IP bucket',()=>fixture(async f=>{
 const statuses=[];for(let i=0;i<24;i++)statuses.push((await f.authenticate(i)).status);
 assert(statuses.filter(s=>s===200).length===10&&statuses.filter(s=>s===429).length===14,'Rate behavior changed');
 record('commonSchoolIp',{requests:24,success:10,limited:14,windowSeconds:60});
}));
Deno.test('review: 24 personal QR authentications share the 20 per minute IP bucket',()=>fixture(async f=>{
 const statuses=[];for(let i=0;i<24;i++)statuses.push((await f.authenticate(i,true)).status);
 assert(statuses.filter(s=>s===200).length===20&&statuses.filter(s=>s===429).length===4,'Personal rate behavior changed');
 record('personalSchoolIp',{requests:24,success:20,limited:4,windowSeconds:60});
}));
Deno.test('review: dispute write failure leaves stored message and old recipient status',()=>fixture(async f=>{
 const auth=await(await f.authenticate(0)).json();f.setFailStatus(true);
 const response=await f.call({action:'dispute',sessionToken:auth.sessionToken,message:'가상 이의'});
 assert(response.status===500&&f.disputes.length===1&&f.recipients[0].status==='viewed','Partial write behavior changed');
 record('partialDispute',{responseStatus:500,savedMessage:await decryptStudentPayload(f.disputes[0].message_ciphertext as string),recipientStatus:f.recipients[0].status});
}));
Deno.test('review: reply write failure leaves stored answer and disputed recipient status',()=>fixture(async f=>{
 const auth=await(await f.authenticate(0)).json();await f.call({action:'dispute',sessionToken:auth.sessionToken,message:'가상 이의'});f.setFailStatus(true);
 const response=await f.teacher({action:'reply',eventId:f.eventId,recipientId:f.recipients[0].id,reply:'가상 답변'});
 assert(response.status===500&&f.disputes[0].reply_ciphertext&&f.recipients[0].status==='disputed','Partial reply behavior changed');
 record('partialReply',{responseStatus:500,savedReply:await decryptStudentPayload(f.disputes[0].reply_ciphertext as string),recipientStatus:f.recipients[0].status});
}));
Deno.test('review: regenerated personal link rejects old token but keeps issued session',()=>fixture(async f=>{
 const oldToken=f.recipients[0].personal_token;
 const auth=await(await f.authenticate(0,true)).json();
 const reset=await f.teacher({action:'regenerate',eventId:f.eventId,recipientId:f.recipients[0].id});assert(reset.status===200,'Reset failed');
 const oldLink=await f.call({action:'personal',token:f.token,personalToken:oldToken});assert(oldLink.status===401,'Old personal token accepted');
 const session=await f.call({action:'session',sessionToken:auth.sessionToken});assert(session.status===200,'Session was revoked');
 record('regenerateSession',{reset:200,oldLink:401,oldIssuedSession:200,migrationDefaultHours:12});
}));
Deno.test('review: public confirmation accepts unchanged recipient version after parent max changes',()=>fixture(async f=>{
 const auth=await(await f.authenticate(0)).json();const oldVersion=f.recipients[0].updated_at;f.columns[0].max_score=200;
 const response=await f.call({action:'confirm',sessionToken:auth.sessionToken,expectedUpdatedAt:oldVersion});
 assert(response.status===200,'Stale parent rejected');const data=await response.json();assert(data.result.recipient.status==='confirmed'&&data.result.event.columns[0].maxScore===200,'Unexpected result');
 record('parentVersion',{responseStatus:200,status:'confirmed',returnedMaxScore:200,recipientVersionUnchangedBeforeConfirmation:true});
}));
Deno.test('review: dispute response contains stale version after the recipient update',()=>fixture(async f=>{
 const auth=await(await f.authenticate(0)).json();await new Promise(resolve=>setTimeout(resolve,2));
 const response=await f.call({action:'dispute',sessionToken:auth.sessionToken,message:'가상 버전 검사'});assert(response.status===200,'Dispute failed');
 const data=await response.json();assert(data.result.recipient.updatedAt!==f.recipients[0].updated_at,'Stale version behavior changed');
 record('disputeVersion',{returned: data.result.recipient.updatedAt,stored:f.recipients[0].updated_at});
}));
// Persist only virtual observations on exit; Deno tests are sequential by default.
globalThis.addEventListener('unload',()=>{
 Deno.writeTextFileSync(new URL('./evidence/server-results.json',import.meta.url),JSON.stringify(observations,null,2));
 keys.forEach((key,i)=>previousEnv[i]===undefined?Deno.env.delete(key):Deno.env.set(key,previousEnv[i]!));
 globalThis.fetch=previousFetch;
});
