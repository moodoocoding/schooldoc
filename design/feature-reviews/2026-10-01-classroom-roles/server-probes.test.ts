// Review probes: mocked HTTP, fictional students, no network permission.
// The rate probe asserts a current limitation; it is not a fix regression test.
import { handleClassroomRoles } from '../../../supabase/functions/_shared/classroomRolesServer.ts';
import { defaultRoleState, parseRoleRoster, roleToday } from '../../../supabase/functions/_shared/classroomRoles.ts';
import { createPayloadCrypto } from '../../../supabase/functions/_shared/payloadCrypto.ts';
const assert=(value:unknown,message:string)=>{if(!value)throw new Error(message);};
const json=(value:unknown)=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});
async function fixture(run:(f:Awaited<ReturnType<typeof setup>>)=>Promise<void>){
 const oldFetch=globalThis.fetch;
 const names=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','CLASSROOM_ROLES_ENCRYPTION_KEY'];
 const old=names.map(n=>Deno.env.get(n));
 Deno.env.set(names[0],'https://role-review.invalid');Deno.env.set(names[1],'fictional-review-key');Deno.env.set(names[2],'22'.repeat(32));
 try{await run(await setup());}finally{globalThis.fetch=oldFetch;names.forEach((n,i)=>old[i]===undefined?Deno.env.delete(n):Deno.env.set(n,old[i]!));}
}
async function setup(){
 const state=defaultRoleState();const today=roleToday();
 const date=(offset:number)=>new Date(Date.parse(today+'T00:00:00Z')+offset*86400000).toISOString().slice(0,10);
 state.roster=parseRoleRoster(Array.from({length:60},(_,i)=>`${i+1} 가상학생${i+1}`).join('\n'));
 state.settings.schoolDays=[0,1,2,3,4,5,6];state.roles=[{...state.roles[0],capacity:60,weekdays:[0,1,2,3,4,5,6]}];
 const period={id:crypto.randomUUID(),start:date(-7),end:date(20),students:structuredClone(state.roster),roles:structuredClone(state.roles),assignments:Object.fromEntries(state.roster.map(s=>[s.id,state.roles[0].id]))};state.periods=[period];
 const token=crypto.randomUUID();const owner=crypto.randomUUID();
 const seal=createPayloadCrypto('CLASSROOM_ROLES_ENCRYPTION_KEY','review');
 const row={id:crypto.randomUUID(),owner_id:owner,public_token:token,version:1,encrypted_payload:await seal.encryptPayload(state)};
 const buckets=new Map<string,number>();const writes:Record<string,unknown>[]=[];const limits:Record<string,unknown>[]=[];
 globalThis.fetch=async(input,init)=>{
  const req=new Request(input,init);const url=new URL(req.url);assert(url.hostname==='role-review.invalid','Unexpected real network request');
  if(url.pathname==='/auth/v1/user')return json({id:owner,aud:'authenticated',role:'authenticated',created_at:new Date().toISOString()});
  if(url.pathname.endsWith('/rpc/consume_registry_rate_limit')){const args=await req.json();limits.push(args);const n=(buckets.get(args.p_request_key)??0)+1;buckets.set(args.p_request_key,n);return json(n<=args.p_max_requests);}
  if(url.pathname.endsWith('/classroom_role_boards'))return json([row]);
  if(url.pathname.endsWith('/classroom_role_records'))return json([]);
  if(url.pathname.endsWith('/rpc/write_classroom_role_record')){writes.push(await req.json());return json(true);}
  throw new Error('Unexpected mock endpoint '+url.pathname);
 };
 const call=(body:Record<string,unknown>,publicRequest=true)=>handleClassroomRoles(new Request('https://handler.invalid',{method:'POST',headers:{'content-type':'application/json','x-forwarded-for':'192.0.2.7',...(!publicRequest?{authorization:'Bearer fictional-teacher'}:{})},body:JSON.stringify({token,...body})}),publicRequest);
 return {state,period,today,yesterday:date(-1),writes,limits,call};
}
Deno.test('review: a teacher can correct yesterday through the server contract',()=>fixture(async({state,period,yesterday,writes,call})=>{
 const response=await call({action:'record',periodId:period.id,studentId:state.roster[0].id,date:yesterday,status:'done',version:1},false);
 assert(response.status===200,'Expected historical correction to be accepted');assert(writes[0].p_date===yesterday,'Correction wrote another date');
}));
Deno.test('review: 60 students completing one UI cycle exhaust one school IP bucket',()=>fixture(async({state,period,today,limits,call})=>{
 const statuses:number[]=[];
 // Each cycle: open -> select -> submit -> read saved state -> close detail.
 // All 300 requests are in one mocked 60-second window; no polls are counted.
 for(const student of state.roster){
  for(const body of [{action:'view'},{action:'view',studentId:student.id},{action:'record',periodId:period.id,studentId:student.id,date:today,status:'done'},{action:'view',studentId:student.id},{action:'view'}])statuses.push((await call(body)).status);
 }
 assert(statuses.filter(s=>s===200).length===240,'Unexpected successful request count');
 assert(statuses.filter(s=>s===429).length===60,'Expected sixty requests blocked');
 assert(limits.every(l=>l.p_window_seconds===60&&l.p_max_requests===240),'Rate policy changed');
 assert(new Set(limits.map(l=>l.p_request_key)).size===1,'Expected a shared IP bucket');
}));
