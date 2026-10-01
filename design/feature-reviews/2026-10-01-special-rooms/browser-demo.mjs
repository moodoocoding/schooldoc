import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';
const base='http://127.0.0.1:4184', out=new URL('./evidence/',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1');
const log={mode:'real installed Chrome, local demo, synthetic fixtures only', checks:[], errors:[], externalRequests:[]};
const browser=await chromium.launch({channel:'chrome',headless:true});
const ctx=await browser.newContext({viewport:{width:1366,height:900},timezoneId:'Asia/Seoul',acceptDownloads:true});
await ctx.route('**/*',r=>r.request().url().startsWith(base)||/^(data|blob):/.test(r.request().url())?r.continue(): (log.externalRequests.push(r.request().url()),r.abort()));
const p=await ctx.newPage();
p.on('pageerror',e=>log.errors.push(e.message));
await p.clock.install({time:new Date('2026-10-01T02:00:00Z')});
const check=(name,data)=>{log.checks.push({name,...data}); console.log(name,JSON.stringify(data.violations?{violationRules:data.violations.map(v=>v.id),nodes:data.violations.reduce((n,v)=>n+(Array.isArray(v.nodes)?v.nodes.length:v.nodes),0)}:data));};
const snap=async(page,name)=>page.screenshot({path:out+name+'.png',fullPage:true});
const shape=async page=>page.evaluate(()=>({viewport:{w:innerWidth,h:innerHeight},scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,bodyHeight:document.body.scrollHeight,dialog:(()=>{const d=document.querySelector('[role=dialog]'); if(!d)return null;const r=d.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height,overflow:getComputedStyle(d).overflowY}})()}));
try {
 await p.goto(base+'/tools/special-rooms'); await p.getByRole('heading',{name:'아직 예약표가 없습니다'}).waitFor(); await snap(p,'01-teacher-empty');
 await p.getByRole('button',{name:'새 예약표',exact:true}).click();
 await p.getByLabel('예약표 이름').fill('가상 새빛학교 2학기 특별실');
 await p.getByLabel('안내 문구').fill('가상 검토 자료입니다. 사용 후 정리해 주세요.');
 await p.getByLabel('하루 교시 수').selectOption('9');
 await p.getByLabel('토요일도 예약받기').check();
 await p.getByLabel('공개 비밀번호').fill('review-only');
 await p.getByLabel('1번 특별실 이름').fill('과학실'); await p.getByLabel('1번 특별실 위치').fill('본관 3층');
 await p.getByRole('button',{name:'특별실 추가',exact:true}).click();
 await p.getByLabel('2번 특별실 이름').fill('음악실');
 await p.getByLabel('2번 특별실 이름').press('Enter');
 await p.getByLabel('3번 특별실 이름').fill('미래융합창작활동실'); await snap(p,'02-create');
 await p.getByRole('button',{name:'예약표 만들기',exact:true}).click(); await p.waitForURL(/\/tools\/special-rooms\/[0-9a-f-]+$/);
 await p.getByRole('rowheader',{name:'9교시',exact:true}).waitFor(); const manage=p.url(), link=await p.getByLabel('예약 링크 주소').inputValue();
 check('create, 9 periods, Saturday, three rooms',{manage,link,rows:await p.getByRole('rowheader').count()});
 const dlPromise=p.waitForEvent('download'); await p.getByRole('button',{name:'QR 이미지 저장'}).click(); const dl=await dlPromise; await dl.saveAs(out+'qr.png'); const qr=await fs.readFile(out+'qr.png'); check('QR PNG download',{file:dl.suggestedFilename(),signature:qr.subarray(0,8).toString('hex'),bytes:qr.length});
 await p.getByRole('button',{name:'예약 링크 복사'}).click();
 check('link copy visual feedback',{copied:await p.getByRole('button',{name:'예약 링크 복사'}).innerHTML()});
 const pub=await ctx.newPage(); await pub.clock.install({time:new Date('2026-10-01T02:00:00Z')});
 await pub.goto(link); await pub.getByLabel('비밀번호',{exact:true}).fill('wrong'); await pub.getByRole('button',{name:'열기',exact:true}).click(); await pub.getByRole('alert').waitFor(); check('wrong public password',{alert:await pub.getByRole('alert').innerText()});
 await pub.getByLabel('비밀번호',{exact:true}).fill('review-only'); await pub.getByRole('button',{name:'열기',exact:true}).click(); await pub.getByRole('table').waitFor();
 await pub.getByRole('button',{name:'10/1 1교시 예약하기',exact:true}).click(); await pub.getByRole('textbox',{name:/사용 내용$/}).fill('6학년1반 실험'); await pub.getByRole('button',{name:'저장',exact:true}).click();
 await pub.getByRole('button',{name:'10/1 1교시 6학년1반 실험 고치기',exact:true}).waitFor();
 await pub.reload(); await pub.getByLabel('비밀번호',{exact:true}).fill('review-only'); await pub.getByRole('button',{name:'열기',exact:true}).click();
 await pub.getByRole('button',{name:/6학년1반 실험 고치기$/}).click(); await pub.getByRole('button',{name:'취소',exact:true}).waitFor(); await pub.waitForTimeout(60); check('existing cell confirmation',{text:await pub.getByRole('dialog').innerText(),focus:await pub.evaluate(()=>document.activeElement.textContent)});
 await pub.getByRole('button',{name:'취소',exact:true}).click();
 await pub.getByRole('button',{name:/6학년1반 실험 고치기$/}).click(); await pub.getByRole('button',{name:'바꾸기',exact:true}).click(); await pub.getByRole('textbox',{name:/사용 내용$/}).fill('6학년1반 수정'); await pub.getByRole('button',{name:'저장',exact:true}).click();
 await pub.getByRole('button',{name:/6학년1반 수정 고치기$/}).waitFor();
 await pub.getByRole('button',{name:/6학년1반 수정 고치기$/}).click(); await pub.getByRole('button',{name:'바꾸기',exact:true}).click(); await pub.getByRole('button',{name:'예약 지우기',exact:true}).click();
 await pub.getByRole('button',{name:'10/1 1교시 예약하기',exact:true}).waitFor();
 check('save/reload/modify/delete',{passed:true});
 // Representative class-scale calendar, all synthetic.
 await p.evaluate(()=>{const all=JSON.parse(localStorage.getItem('schooldoc_special_rooms_v1')); const b=all[0]; const days=['2026-09-28','2026-09-29','2026-09-30','2026-10-01','2026-10-02','2026-10-03']; b.bookings=Array.from({length:24},(_,i)=>({id:crypto.randomUUID(),roomId:b.rooms[i%3].id,date:days[i%6],period:1+Math.floor(i/6),label:i===6?'6학년 1반 융합 실험 안전교육':'가상 '+(i%6+1)+'학년'+(i%3+1)+'반',updatedAt:new Date().toISOString()}));b.schoolDays=[{date:'2026-10-02',eventName:'가상 재량휴업일',isOffDay:true},{date:'2026-10-12',eventName:'가상 휴업일',isOffDay:true},{date:'2026-12-30',eventName:'겨울방학',isOffDay:true}];localStorage.setItem('schooldoc_special_rooms_v1',JSON.stringify(all));window.dispatchEvent(new Event('schooldoc-special-rooms-change'))});
 await p.getByRole('tab',{name:'과학실',exact:true}).waitFor(); await snap(p,'03-teacher-representative');
 await pub.getByRole('button',{name:/가상.*고치기$/}).first().waitFor(); await snap(pub,'04-public-desktop');
 const axe=await new AxeBuilder({page:pub}).analyze(); check('axe public',{violations:axe.violations.map(v=>({id:v.id,impact:v.impact,description:v.description,nodes:v.nodes.map(n=>({html:n.html,summary:n.failureSummary}))}))});
 const axet=await new AxeBuilder({page:p}).analyze(); check('axe teacher',{violations:axet.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.length}))});
 // Closure hides but preserves reservations, then restores.
 await p.getByLabel('어느 특별실').selectOption({label:'과학실'}); await p.getByLabel('시작 날짜').fill('2026-09-28'); await p.getByLabel('사유').fill('가상 시설 점검'); await p.getByRole('button',{name:'휴관 추가'}).click();
 await pub.getByRole('button',{name:/9\/28 1교시 휴관/}).waitFor(); check('closure blocks and retains',{disabled:await pub.getByRole('button',{name:/9\/28 1교시 휴관/}).isDisabled(),stored:await p.evaluate(()=>JSON.parse(localStorage.getItem('schooldoc_special_rooms_v1'))[0].bookings.length)});
 await snap(pub,'05-closure');
 await p.getByRole('button',{name:/가상 시설 점검 휴관 풀기$/}).click(); await pub.getByRole('button',{name:/9\/28 1교시 가상.*고치기$/}).waitFor();
 // Shape shrink/restore.
 await p.getByLabel('하루 교시 수').selectOption('4'); await p.getByLabel('토요일도 예약받기').uncheck(); await p.getByRole('button',{name:'저장',exact:true}).click(); await pub.waitForTimeout(500);
 check('shape reduced',{teacherRows:await p.getByRole('rowheader').count(),publicRows:await pub.getByRole('rowheader').count()});
 await p.getByLabel('하루 교시 수').selectOption('9'); await p.getByLabel('토요일도 예약받기').check(); await p.getByRole('button',{name:'저장',exact:true}).click();
 await pub.getByRole('rowheader',{name:'9교시',exact:true}).waitFor();
 // Save failure injected locally; rollback and draft recovery observation.
 await pub.getByRole('button',{name:'10/1 9교시 예약하기',exact:true}).click(); await pub.getByRole('textbox',{name:/사용 내용$/}).fill('실패시 보존할 가상 입력');
 await pub.evaluate(()=>{window.reviewSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='schooldoc_special_rooms_v1')throw new Error('가상 저장 실패');return window.reviewSetItem.call(this,k,v)}});
 await pub.getByRole('button',{name:'저장',exact:true}).click(); await pub.getByRole('alert').waitFor(); await snap(pub,'06-save-failure');
 await pub.evaluate(()=>{Storage.prototype.setItem=window.reviewSetItem}); await pub.getByRole('button',{name:'10/1 9교시 예약하기',exact:true}).click();
 check('save failure recovery',{alert:await pub.getByRole('alert').innerText(),draftAfterReopen:await pub.getByRole('textbox',{name:/사용 내용$/}).inputValue()}); await pub.keyboard.press('Escape');
 // Open draft receives concurrent change without re-confirmation.
 await pub.getByRole('button',{name:'10/1 8교시 예약하기',exact:true}).click(); await pub.getByRole('textbox',{name:/사용 내용$/}).fill('먼저 작성중');
 await p.evaluate(()=>{const all=JSON.parse(localStorage.getItem('schooldoc_special_rooms_v1'));const b=all[0];b.bookings.push({id:crypto.randomUUID(),roomId:b.rooms[0].id,date:'2026-10-01',period:8,label:'다른 교사 예약',updatedAt:new Date().toISOString()});localStorage.setItem('schooldoc_special_rooms_v1',JSON.stringify(all));window.dispatchEvent(new Event('schooldoc-special-rooms-change'))});
 await pub.waitForTimeout(400);
 check('live concurrent change in open draft',{draft:await pub.getByRole('textbox',{name:/사용 내용$/}).inputValue(),confirmationShown:await pub.getByText(/바꿀까요/).count()});
 await pub.getByRole('textbox',{name:/사용 내용$/}).fill('경고없이 덮어쓴 예약'); await pub.getByRole('button',{name:'저장',exact:true}).click(); await pub.getByRole('button',{name:/경고없이 덮어쓴 예약 고치기$/}).waitFor(); check('concurrent overwrite',{warningRequired:false,stored:true});
 // Past bookings are allowed; explicit policy observation.
 await pub.getByRole('button',{name:'지난 주',exact:true}).click(); await pub.getByRole('button',{name:/교시 예약하기$/}).first().click(); await pub.getByRole('textbox',{name:/사용 내용$/}).fill('이미 지난 가상 예약'); await pub.getByRole('button',{name:'저장',exact:true}).click(); check('past week write',{stored:await pub.getByRole('button',{name:/이미 지난 가상 예약 고치기$/}).count()});
 await pub.getByRole('button',{name:'이번 주',exact:true}).click();
 // Repeat skips synthetic holiday; future pages query correctly.
 await pub.getByRole('button',{name:'9/28 5교시 예약하기',exact:true}).click(); await pub.getByRole('textbox',{name:/사용 내용$/}).fill('가상 정기 실험'); await pub.getByLabel('매주 반복해서 잡기').check(); await pub.getByRole('button',{name:'4주',exact:true}).click(); await pub.getByRole('button',{name:'반복해서 잡기',exact:true}).click(); await pub.getByRole('status').waitFor(); check('repeat results',{text:await pub.getByRole('status').innerText()}); await pub.keyboard.press('Escape');
 await pub.setViewportSize({width:390,height:844}); await snap(pub,'07-public-mobile');check('mobile shape',await shape(pub));
 await pub.getByRole('button',{name:'10/1 9교시 예약하기',exact:true}).click(); await pub.getByRole('textbox',{name:/사용 내용$/}).fill('키보드 가상'); await pub.keyboard.press('Tab'); await pub.keyboard.press('Shift+Tab'); check('keyboard dialog',{focusName:await pub.evaluate(()=>document.activeElement.getAttribute('aria-label'))}); await pub.keyboard.press('Escape'); check('escape focus return',{focused:await pub.getByRole('button',{name:'10/1 9교시 예약하기',exact:true}).evaluate(e=>e===document.activeElement)});
 await pub.setViewportSize({width:390,height:568}); await pub.getByRole('button',{name:'10/1 9교시 예약하기',exact:true}).click(); await pub.getByLabel('매주 반복해서 잡기').check(); await snap(pub,'08-repeat-small-mobile');check('small mobile repeat dialog',await shape(pub)); await pub.keyboard.press('Escape');
 await pub.setViewportSize({width:1366,height:900}); await pub.evaluate(()=>document.documentElement.style.zoom='2'); await snap(pub,'09-public-css200');
 await pub.getByRole('button',{name:'10/1 9교시 예약하기',exact:true}).click(); await pub.getByLabel('매주 반복해서 잡기').check(); await snap(pub,'10-repeat-css200');await pub.screenshot({path:out+'10-repeat-css200-viewport.png'});check('CSS200 repeat dialog',await shape(pub));await pub.keyboard.press('Escape');await pub.evaluate(()=>document.documentElement.style.zoom='');
 await p.evaluate(()=>document.documentElement.style.zoom='2');await snap(p,'11-teacher-css200');check('teacher CSS200',await shape(p));await p.evaluate(()=>document.documentElement.style.zoom='');
 await pub.setViewportSize({width:1920,height:1080});await snap(pub,'12-electronic-board');
 // Browser print, actual PDFs; render and inspect separately.
 await pub.pdf({path:out+'public-a4.pdf',format:'A4',printBackground:true});
 await p.pdf({path:out+'teacher-a4.pdf',format:'A4',printBackground:true});
 check('print exports',{public:'public-a4.pdf',teacher:'teacher-a4.pdf',explicitPrintControls:await p.getByRole('button',{name:/인쇄|출력|PDF/}).count()});
 // Closed state.
 await p.getByRole('button',{name:'예약 종료',exact:true}).click();await pub.getByText('예약이 종료되어 보기만 할 수 있습니다').waitFor();await snap(pub,'13-closed');check('closed cells',{enabled:await pub.getByRole('table').getByRole('button').evaluateAll(es=>es.filter(e=>!e.disabled).length)});
 await p.getByRole('button',{name:'예약 다시 열기',exact:true}).click(); await pub.getByRole('button',{name:'10/1 9교시 예약하기',exact:true}).waitFor();
 // Local-only closed repeat divergence: leave dialog open before closure.
 await pub.getByRole('button',{name:'10/1 9교시 예약하기',exact:true}).click();await pub.getByRole('textbox',{name:/사용 내용$/}).fill('종료후 데모 반복');await pub.getByLabel('매주 반복해서 잡기').check();await pub.getByRole('button',{name:'2주',exact:true}).click();await p.getByRole('button',{name:'예약 종료',exact:true}).click();await pub.getByRole('button',{name:'반복해서 잡기',exact:true}).click();await pub.waitForTimeout(500);check('demo closed repeat divergence',{notice:await pub.getByRole('status').allInnerTexts()});await pub.keyboard.press('Escape');
 // Teacher status failure is unhandled.
 await p.evaluate(()=>{window.reviewSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='schooldoc_special_rooms_v1')throw new Error('가상 상태 저장 실패');return window.reviewSetItem.call(this,k,v)}});
 await p.getByRole('button',{name:'예약 다시 열기',exact:true}).click();await p.waitForTimeout(100);check('teacher status failure UI',{alerts:await p.getByRole('alert').allInnerTexts(),errors:log.errors});await snap(p,'14-status-failure');
 await p.evaluate(()=>{Storage.prototype.setItem=window.reviewSetItem});
 await p.getByRole('button',{name:'예약 다시 열기',exact:true}).click();
 await p.getByRole('button',{name:'눌러서 학교를 찾습니다'}).click();await p.getByRole('textbox').last().fill('가상학교');await p.getByRole('button',{name:'찾기',exact:true}).click();await p.getByRole('alert').waitFor();check('optional school search failure',{alert:await p.getByRole('alert').innerText()});await p.keyboard.press('Escape');
 await p.goto(base+'/tools/special-rooms'); await p.getByRole('button',{name:/가상 새빛학교.*삭제/}).click();check('delete confirm',{text:await p.getByRole('alertdialog').innerText()});await p.getByRole('button',{name:'취소',exact:true}).click();check('delete canceled retains',{cards:await p.locator('article').count()});
 await p.goto(base+'/s/rooms/00000000-0000-4000-8000-000000000000');await snap(p,'15-missing');check('missing public board',{text:await p.locator('main').innerText(),buttons:await p.getByRole('button').count()});
} catch(e){log.fatal=e.stack;console.error(e);await snap(p,'fatal');process.exitCode=1}
finally{await fs.writeFile(out+'browser-demo.json',JSON.stringify(log,null,2));await browser.close()}
