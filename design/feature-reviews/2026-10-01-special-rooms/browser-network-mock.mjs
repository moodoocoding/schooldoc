import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const base='http://127.0.0.1:4184', out=new URL('./evidence/',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1');
const token='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222', room='33333333-3333-4333-8333-333333333333';
const board={id,publicToken:token,title:'가상 서버 경로 검토',description:'네트워크 없는 모의 응답',periodCount:6,includeSaturday:false,hasPassword:false,status:'open',rooms:[{id:room,position:0,name:'가상 과학실',location:'본관3층'},{id:'44444444-4444-4444-8444-444444444444',position:1,name:'가상 음악실',location:''}],closures:[],schoolName:'',termEndDate:''};
let failure=false,queryFailure=false,afterSaveFailure=false,delays=false;
const logs={mode:'real Chrome with config false and Supabase module replaced at browser boundary only; all API responses fulfilled locally',observations:[],errors:[],requests:[]};
const browser=await chromium.launch({channel:'chrome',headless:true}),ctx=await browser.newContext({viewport:{width:1366,height:900},timezoneId:'Asia/Seoul'});
await ctx.addInitScript(()=>{
 const fetchApi=async(body)=>{const r=await fetch('/review-mock',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});return r.ok?{data:await r.json(),error:null}:{data:null,error:{message:'mock request failed',context:r}}};
 class Query{constructor(t){this.t=t;this.filters=[];this.op='select';this.single=false}select(c){this.columns=c;return this}in(k,v){this.filters.push([k,v,'in']);return this}eq(k,v){this.filters.push([k,v,'eq']);return this}order(){return this}maybeSingle(){this.single=true;return this}update(v){this.op='update';this.values=v;return this}then(a,b){return fetchApi({db:{table:this.t,op:this.op,values:this.values,single:this.single,filters:this.filters}}).then(a,b)}}
 const user={id:'synthetic-owner',email:'virtual@example.invalid',user_metadata:{full_name:'가상 교사'}};
 window.__specialReviewClient={functions:{invoke:async(name,{body})=>fetchApi(body)},from:t=>new Query(t),auth:{getUser:async()=>({data:{user},error:null}),getSession:async()=>({data:{session:{user}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},channel:()=>{const c={on:(type,filter,handler)=>(window.__reviewRealtime=handler,c),subscribe:()=>c};return c},removeChannel:async()=>{}};
});
await ctx.route('**/*',async r=>{
 const url=r.request().url();
 if(!url.startsWith(base)){await r.abort();return}
 if(url.includes('/specialRoomsConfig.ts')){const a=await r.fetch();await r.fulfill({response:a,body:(await a.text()).replace(/export const isSpecialRoomsDemoMode = [^;]+;/,'export const isSpecialRoomsDemoMode = false;')});return}
 if(url.includes('/src/utils/supabaseClient.ts')){await r.fulfill({contentType:'application/javascript',body:'export const isSupabaseConfigured=true;export const supabase=window.__specialReviewClient;'});return}
 if(!url.endsWith('/review-mock')){await r.continue();return}
 const b=r.request().postDataJSON();logs.requests.push(b);let status=200,data;
 if(b.db){
  const q=b.db;
  if(q.op==='update'){if(q.values.period_count!==undefined)board.periodCount=q.values.period_count;if(q.values.include_saturday!==undefined)board.includeSaturday=q.values.include_saturday;if(q.values.title!==undefined)board.title=q.values.title;data=null}
  else if(queryFailure){status=500;data={error:'가상 DB 조회 실패'}}
  else {
   const row={id,public_token:token,title:board.title,description:board.description,period_count:board.periodCount,include_saturday:board.includeSaturday,school_name:'',password_digest:null,status:board.status,created_at:'',updated_at:''};
   const rows=q.table==='special_room_boards'?[row]:q.table==='special_rooms'?board.rooms.map(x=>({...x,board_id:id})):[];data=q.single?rows[0]??null:rows;
  }
 }else if(b.action==='metadata')data={board:structuredClone(board)};
 else if(b.action==='week'){
  if(failure||afterSaveFailure){status=503;data={error:'가상 주 조회 실패'};}
  else {if(delays)await new Promise(resolve=>setTimeout(resolve,b.from==='2026-10-05'?450:60));data={bookings:[{id:'mock-'+b.from,roomId:room,date:b.from,period:1,label:b.from+' 가상 예약',updatedAt:''}],schoolDays:[]}}
 }else if(b.action==='setBooking'){
  if(board.status==='closed'){status=409;data={error:'예약이 종료되었습니다.'}} else if(board.closures.length){status=409;data={error:'그날은 특별실을 쓸 수 없습니다.'}}else {data={ok:true};afterSaveFailure=true}
 } else data={ok:true};
 await r.fulfill({status,json:data});
});
const p=await ctx.newPage();p.on('pageerror',e=>logs.errors.push(e.message));await p.clock.install({time:new Date('2026-10-01T02:00:00Z')});
const obs=(name,data)=>{logs.observations.push({name,...data});console.log(name,JSON.stringify(data))};
const snap=async(name)=>p.screenshot({path:out+name+'.png',fullPage:true});
try{
 failure=true;await p.goto(base+'/s/rooms/'+token);await p.getByText('가상 주 조회 실패',{exact:true}).waitFor();obs('initial load failure recovery',{main:await p.locator('main').innerText(),buttons:await p.getByRole('button').count()});await snap('20-initial-load-error');
 failure=false;await p.reload();await p.getByRole('button',{name:/2026-09-28 가상 예약 고치기$/}).waitFor();
 failure=true;await p.getByRole('button',{name:'다음 주',exact:true}).click();await p.waitForTimeout(250);obs('week failure silently retains previous dates',{alerts:await p.getByRole('alert').count(),oldCellShown:await p.getByRole('button',{name:/9\/28.*가상 예약/}).count(),range:await p.getByLabel('예약 주간 선택').innerText(),tableText:await p.getByRole('table').innerText()});await snap('21-week-load-error');
 failure=false;await p.reload();await p.getByRole('table').waitFor();await p.getByRole('button',{name:'이번 주',exact:true}).click();await p.getByRole('button',{name:/2026-09-28 가상 예약 고치기$/}).waitFor();
 delays=true;await p.getByRole('button',{name:'다음 주',exact:true}).click();await p.waitForTimeout(90);await p.getByRole('button',{name:'다음 주',exact:true}).click();await p.waitForTimeout(650);obs('out of order weeks lose latest visible booking',{range:await p.getByLabel('예약 주간 선택').innerText(),bookedCells:await p.getByRole('button',{name:/가상 예약 고치기$/}).count()});await snap('22-week-response-race');delays=false;
 await p.reload();await p.getByRole('table').waitFor();
 board.status='closed';await p.evaluate(()=>window.__reviewRealtime());await p.waitForTimeout(400);obs('remote close does not refresh metadata',{closedNotice:await p.getByText('예약이 종료되어 보기만 할 수 있습니다').count(),enabled:await p.getByRole('table').getByRole('button').evaluateAll(es=>es.filter(e=>!e.disabled).length)});await snap('23-stale-status');
 board.status='open';board.closures=[{id:'closure',roomId:room,startDate:'2026-09-28',endDate:'2026-10-03',reason:'가상 휴관'}];await p.evaluate(()=>window.__reviewRealtime());await p.waitForTimeout(400);obs('remote closure does not refresh metadata',{closureButtons:await p.getByRole('button',{name:/휴관/}).count(),firstCellDisabled:await p.getByRole('table').getByRole('button').first().isDisabled()});await snap('24-stale-closure');
 board.closures=[];await p.reload();await p.getByRole('table').waitFor();await p.getByRole('button',{name:'10/1 2교시 예약하기',exact:true}).click();await p.getByRole('textbox',{name:/사용 내용$/}).fill('모의 저장 성공');await p.getByRole('button',{name:'저장',exact:true}).click();await p.waitForTimeout(450);obs('post save refresh rejected with success indicator',{saved:await p.getByText('저장됨',{exact:true}).count(),alerts:await p.getByRole('alert').count(),pageErrors:logs.errors});await snap('25-refresh-error-after-save');afterSaveFailure=false;
 await p.goto(base+'/tools/special-rooms/'+id);await p.getByRole('rowheader',{name:'6교시',exact:true}).waitFor();
 board.periodCount=4;board.includeSaturday=true;await p.evaluate(()=>window.__reviewRealtime());await p.waitForTimeout(150);obs('external teacher shape update leaves form stale',{gridRows:await p.getByRole('rowheader').count(),formPeriods:await p.getByLabel('하루 교시 수').inputValue(),formSaturday:await p.getByLabel('토요일도 예약받기').isChecked(),saturdayColumn:await p.getByRole('columnheader',{name:/토/}).count()});await snap('26-stale-board-info');
 queryFailure=true;await p.reload();await p.getByText('예약표를 찾을 수 없습니다.',{exact:true}).waitFor();obs('teacher query error becomes missing board',{text:await p.locator('body').innerText(),retry:await p.getByRole('button',{name:/다시|재시도/}).count()});await snap('27-teacher-load-error');queryFailure=false;
 await p.goto(base+'/s/rooms/'+token);await p.getByRole('table').waitFor();await p.getByRole('tab',{name:'가상 과학실',exact:true}).focus();await p.keyboard.press('ArrowRight');obs('tab keyboard ArrowRight',{selected:await p.getByRole('tab',{selected:true}).innerText(),focus:await p.evaluate(()=>document.activeElement.textContent)});
}catch(e){logs.fatal=e.stack;process.exitCode=1;console.error(e)}
finally{await fs.writeFile(out+'browser-network-mock.json',JSON.stringify(logs,null,2));await browser.close()}
