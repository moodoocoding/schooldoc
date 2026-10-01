import ts from 'typescript';
import vm from 'node:vm';
import fs from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import assert from 'node:assert/strict';
const out=new URL('./evidence/server-mock.json',import.meta.url);
const token='11111111-1111-4111-8111-111111111111', boardId='22222222-2222-4222-8222-222222222222', roomId='33333333-3333-4333-8333-333333333333';
const records=[];
function fresh(){return {board:{id:boardId,public_token:token,title:'가상 예약표',description:'',period_count:9,include_saturday:true,school_name:'',status:'open',password_digest:null,owner_id:'owner-a',neis_office_code:'B10',neis_school_code:'mock'},rooms:[{id:roomId,board_id:boardId,name:'가상 과학실',position:0,location:''}],bookings:[],closures:[],days:[],calls:[],rate:true,race:null,authUser:'owner-a',upsertFail:false}}
async function handler(kind,state,now='2026-10-01T02:00:00Z'){
 let serve;
 const tableRows=t=>t==='special_room_boards'?[state.board]:t==='special_rooms'?state.rooms:t==='special_room_bookings'?state.bookings:t==='special_room_closures'?state.closures:state.days;
 class Query{
  constructor(t){this.t=t;this.filters=[];this.op='select';this.single=false}
  select(c){this.columns=c;return this} eq(k,v){this.filters.push([k,v,'eq']);return this} gte(k,v){this.filters.push([k,v,'gte']);return this} lte(k,v){this.filters.push([k,v,'lte']);return this} gt(k,v){this.filters.push([k,v,'gt']);return this} in(k,v){this.filters.push([k,v,'in']);return this} ilike(k,v){this.filters.push([k,v.replaceAll('%',''),'includes']);return this} order(){return this} limit(n){this.max=n;return this} maybeSingle(){this.single=true;return this} insert(v){this.op='insert';this.values=Array.isArray(v)?v:[v];return this} update(v){this.op='update';this.values=v;return this} delete(){this.op='delete';return this} upsert(v){this.op='upsert';this.values=v;return this}
  async then(resolve,reject){try{return resolve(this.run())}catch(e){return reject(e)}}
  run(){state.calls.push({table:this.t,op:this.op,filters:this.filters});
   const match=r=>this.filters.every(([k,v,op])=>op==='eq'?r[k]===v:op==='gte'?r[k]>=v:op==='lte'?r[k]<=v:op==='gt'?r[k]>v:op==='in'?v.includes(r[k]):String(r[k]).includes(v));
   let rows=tableRows(this.t),selected=rows.filter(match);if(this.max)selected=selected.slice(0,this.max);
   if(this.op==='select')return {data:this.single?selected[0]??null:selected,error:null};
   if(this.op==='update'){for(const r of selected)Object.assign(r,this.values);return {data:null,error:null}}
   if(this.op==='delete'){const keep=rows.filter(r=>!match(r));if(this.t==='special_room_bookings')state.bookings=keep;else if(this.t==='special_room_school_days')state.days=keep;return {data:null,error:null}}
   if(this.op==='upsert'&&state.upsertFail)return {data:null,error:{code:'mock',message:'mock insert failure'}};
   if(this.op==='insert'&&this.t==='special_room_bookings'){
    if(state.race){state.bookings.push({...this.values[0],id:'competitor',label:'다른 교사 예약'});state.race=null;}
    if(this.values.some(v=>state.bookings.some(r=>v.room_id===r.room_id&&v.booking_date===r.booking_date&&v.period===r.period)))return {data:null,error:{code:'23505',message:'mock unique conflict'}};
    state.bookings.push(...this.values.map((v,i)=>({...v,id:'own-'+state.bookings.length+'-'+i})));
   }
   if(this.op==='upsert')state.days.push(...this.values);
   return {data:null,error:null};
  }
 }
 const client={from:t=>new Query(t),rpc:async(name,args)=>name==='consume_special_room_rate_limit'?{data:state.rate,error:state.rateError?{code:'mock',message:'mock limiter unavailable'}:null}:{data:args.p_password==='review-only',error:null},auth:{getUser:async()=>({data:{user:state.authUser?{id:state.authUser}:null},error:null})}};
 class FixedDate extends Date{constructor(...args){super(...(args.length?args:[now]))}static now(){return new Date(now).getTime()}}
 const sandbox={createClient:()=>client,Deno:{env:{get:key=>key==='SUPABASE_URL'?'https://mock.invalid':'synthetic-only'},serve:fn=>serve=fn},Response,Request,TextEncoder,crypto:webcrypto,Date:FixedDate,URLSearchParams,AbortSignal,console:{error:()=>{}},fetch:async()=>new Response(JSON.stringify({SchoolSchedule:[{}, {row:[{AA_YMD:'20261001',EVENT_NM:'가상 행사',SBTR_DD_SC_NM:'해당없음'}]}]}),{status:200})};
 const src=(await fs.readFile('supabase/functions/'+kind+'/index.ts','utf8')).replace(/^import .*;\r?\n/,'');
 vm.runInNewContext(ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,sandbox);
 return async(body,auth=true)=>{const res=await serve(new Request('https://mock.invalid/'+kind,{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer synthetic-token'}:{})},body:JSON.stringify(body)}));return {status:res.status,body:await res.json()}};
}
const body={action:'setBooking',token,roomId,date:'2026-10-01',period:1,label:'가상6-1반'};
async function record(name,state,b,expected,kind='special-rooms-public',auth=true,now){const run=await handler(kind,state,now);const response=await run(b,auth);assert.equal(response.status,expected,'observation changed: '+name); const r={name,request:b,response,writes:state.bookings,days:state.days,calls:state.calls};records.push(r);console.log(name,JSON.stringify(response));return response}
await record('9교시 예약/수정 거절',fresh(),{...body,period:9},400);
await record('9교시 삭제 거절',fresh(),{...body,action:'clearBooking',period:9},400);
await record('9교시 반복 거절',fresh(),{...body,action:'setRepeat',period:9,until:'2026-10-22'},400);
const reduced=fresh();reduced.board.period_count=4;reduced.board.include_saturday=false;await record('4교시판 숨은 8교시 요청 허용',reduced,{...body,period:8},200);
const sat=fresh();sat.board.include_saturday=false;await record('토요일 미운영판 토요일 요청 허용',sat,{...body,date:'2026-10-03'},200);
await record('일요일 요청 허용',fresh(),{...body,date:'2026-10-04'},200);
await record('지난 날짜 쓰기 허용',fresh(),{...body,date:'2026-09-01'},200);
const c=fresh();c.board.status='closed';await record('종료판 쓰기 차단',c,body,409);
const locked=fresh();locked.board.password_digest='synthetic';await record('비밀번호 오류 차단',locked,{...body,password:'wrong'},401);
await record('다른 예약표 방 차단',fresh(),{...body,roomId:'44444444-4444-4444-8444-444444444444'},404);
const closure=fresh();closure.closures=[{board_id:boardId,room_id:roomId,start_date:'2026-10-01',end_date:'2026-10-02',reason:'가상 점검'}];await record('휴관 쓰기 차단',closure,body,409);
const rate=fresh();rate.rateError=true;await record('제한 확인 실패 시 중단',rate,body,500);
const race=fresh();race.race=true;await record('동시 단일 INSERT 충돌 안내',race,body,409);
const existing=fresh();existing.bookings=[{id:'old',board_id:boardId,room_id:roomId,booking_date:body.date,period:1,label:'먼저 잡은 교사 예약'}];await record('기대 버전 없이 기존 예약 덮어쓰기',existing,body,200);
const repeated=fresh();repeated.race=true;await record('반복 INSERT 경쟁 후 잘못된 성공 수량',repeated,{...body,action:'setRepeat',until:'2026-10-22'},200);
const badRange=fresh();await record('반복 종료가 시작보다 이전이어도 하나 생성',badRange,{...body,action:'setRepeat',until:'2026-09-01'},200);
const kst=fresh();kst.days=[{board_id:boardId,day:'2026-10-02',event_name:'가상 겨울방학',is_off_day:true},{board_id:boardId,day:'2026-12-30',event_name:'가상 겨울방학',is_off_day:true}];await record('KST 새벽 metadata UTC 기준 학기말',kst,{action:'metadata',token},200,'special-rooms-public',true,'2026-10-01T16:00:00Z');
await record('관리 요청 미인증 차단',fresh(),{action:'syncSchoolDays',boardId,from:'2026-03-01',to:'2027-02-28'},401,'special-rooms-admin',false);
const other=fresh();other.authUser='owner-b';await record('타 교사 관리 요청 차단',other,{action:'syncSchoolDays',boardId,from:'2026-03-01',to:'2027-02-28'},403,'special-rooms-admin');
const sync=fresh();sync.days=[{board_id:boardId,day:'2026-10-01',event_name:'기존 휴업일',is_off_day:true}];sync.upsertFail=true;await record('학사일정 삭제 후 삽입 실패로 기존 자료 손실',sync,{action:'syncSchoolDays',boardId,from:'2026-03-01',to:'2027-02-28'},500,'special-rooms-admin');
await fs.writeFile(out,JSON.stringify({mode:'actual TS handlers transpiled in Node VM, fake DB/Auth/NEIS; no network, no remote RLS/Postgres assertion',observations:records},null,2));
