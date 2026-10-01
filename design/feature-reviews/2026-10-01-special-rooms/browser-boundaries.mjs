import { chromium } from '@playwright/test';import fs from 'node:fs/promises';
const base='http://127.0.0.1:4184',out=new URL('./evidence/',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'),token='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const b={id,publicToken:token,ownerId:'local-demo-teacher',password:'',title:'가상 짧은 학급명과 50개 특별실',description:'',periodCount:9,includeSaturday:true,schoolName:'',status:'open',isPasswordProtected:false,rooms:Array.from({length:50},(_,i)=>({id:'room-'+i,position:i,name:i===0?'과학실':'가상 특별실 '+(i+1),location:'가상 장소'})),bookings:Array.from({length:54},(_,i)=>({id:'booking-'+i,roomId:'room-0',date:['2026-09-28','2026-09-29','2026-09-30','2026-10-01','2026-10-02','2026-10-03'][i%6],period:1+Math.floor(i/6),label:'6학년1반',updatedAt:''})),schoolDays:[],closures:[],createdAt:'',updatedAt:''};
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];
async function run(name,timezone,time,viewport,fixture=b){
 const ctx=await browser.newContext({timezoneId:timezone,viewport});await ctx.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());await ctx.addInitScript(x=>localStorage.setItem('schooldoc_special_rooms_v1',JSON.stringify([x])),fixture);
 const p=await ctx.newPage();await p.clock.install({time:new Date(time)});await p.goto(base+'/s/rooms/'+token);await p.getByRole('table').waitFor();await p.screenshot({path:out+name+'.png',fullPage:true});const result={name,timezone,time,range:await p.getByLabel('예약 주간 선택').innerText(),today:await p.locator('th[aria-current=date]').count()?await p.locator('th[aria-current=date]').innerText():'',tabCount:await p.getByRole('tab').count(),pageWidth:await p.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth,tableTop:document.querySelector('table').getBoundingClientRect().top})),firstChip:await p.locator('tbody td button span[title]').count()?await p.locator('tbody td button span[title]').first().evaluate(e=>({text:e.textContent,clientWidth:e.clientWidth,scrollWidth:e.scrollWidth,fontSize:getComputedStyle(e).fontSize})):null};
 results.push(result);await ctx.close();
}
try{
 await run('30-max-rooms-mobile','Asia/Seoul','2026-10-01T02:00:00Z',{width:390,height:844});
 await run('31-short-labels-mobile','Asia/Seoul','2026-10-01T02:00:00Z',{width:390,height:844},{...b,rooms:b.rooms.slice(0,3)});
 await run('32-year-boundary','Asia/Seoul','2026-12-31T15:30:00Z',{width:1366,height:900},{...b,title:'가상 연말 예약표',rooms:b.rooms.slice(0,3),bookings:[]});
 await run('33-sunday-seoul','Asia/Seoul','2026-10-04T00:00:00Z',{width:1366,height:900},{...b,rooms:b.rooms.slice(0,3),bookings:[]});
 await run('34-same-instant-losangeles','America/Los_Angeles','2026-10-04T00:00:00Z',{width:1366,height:900},{...b,rooms:b.rooms.slice(0,3),bookings:[]});
}finally{await fs.writeFile(out+'browser-boundaries.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));await browser.close()}
