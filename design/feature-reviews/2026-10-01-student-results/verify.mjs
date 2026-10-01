import { chromium } from 'playwright';
import { jsPDF } from 'jspdf';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const accessibility = async target => { await target.addScriptTag({path:require.resolve('axe-core/axe.min.js')}); return target.evaluate(async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary})),description:v.description}));}); };
const origin = process.env.REVIEW_ORIGIN ?? 'http://127.0.0.1:4177';
assert.match(origin, /^http:\/\/127\.0\.0\.1:\d+$/);
const outputJson = value => JSON.stringify(value,null,2).replaceAll(process.cwd().replaceAll('\\','/'),'<review-worktree>').replaceAll(process.cwd().replaceAll('\\','\\\\'),'<review-worktree>').replace(/C:\/Users\/[^/]+\/Documents\/vibecoding\/260812_schooldoc\/node_modules/g,'<shared-node_modules>').replace(/C:\/Users\/[^/]+\/AppData\/Local\/Temp\/schooldoc-student-results-review-vite/g,'<review-vite-cache>');
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'evidence');
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const page = await context.newPage();
const results = { browser: browser.version(), origin, scope: 'Local demo and synthetic data only', observations: {}, pageErrors: [] };
page.on('pageerror', e => results.pageErrors.push(e.message));
const shot = async (name, target = page) => target.screenshot({ path: path.join(dir, name + '.png'), fullPage: true });
const step = async (name, fn) => { results.observations[name] = await fn(); console.log(name, JSON.stringify(results.observations[name])); await writeFile(path.join(dir,'results.json'),outputJson(results)); };
try {
await page.goto(origin + '/tools/student-results/new');
await page.getByPlaceholder('예: 2학기 수행평가 결과').waitFor();
const pdf = new jsPDF();
pdf.text('2026 Semester Result',15,20); pdf.text('Please review your results.',15,30);
[['id',15],['name',40],['accesscode',75],['Math/100',115],['feedback',150]].forEach(([t,x]) => pdf.text(t,x,45));
[['30101',15],['Kim Sky',40],['4821',75],['93',115],['Good work',150]].forEach(([t,x]) => pdf.text(t,x,55));
const bytes = Array.from(new Uint8Array(pdf.output('arraybuffer')));
await step('pdfLoader', async () => {
 const requests = [];
 const listener = response => { if (/pdf|worker/.test(response.url())) requests.push({ url: response.url().replace(origin,''), status: response.status() }); };
 page.on('response',listener);
 const value = await page.evaluate(async bytes => {
  const { loadPdfJs } = await import('/src/utils/pdfjs.ts');
  const lib = await loadPdfJs();
  const task = lib.getDocument({ data: new Uint8Array(bytes) });
  try { const doc = await task.promise; return { version: lib.version, workerSrc: lib.GlobalWorkerOptions.workerSrc, pages: doc.numPages }; }
  catch (e) { return { version: lib.version, workerSrc: lib.GlobalWorkerOptions.workerSrc, error: String(e), stack: e.stack }; }
  finally { await task.destroy(); }
 }, bytes);
 page.off('response',listener);
 await page.getByTestId('student-results-file-input').setInputFiles({ name: 'synthetic-result.pdf', mimeType:'application/pdf', buffer: Buffer.from(bytes) });
 await page.getByText('PDF 1쪽 · 머리글 3행 · 결과 항목 1개 · 학생 1명').waitFor();
 await shot('01-pdf-import-success');
 return { ...value, requests, uiAnalysis: await page.getByText('PDF 1쪽 · 머리글 3행 · 결과 항목 1개 · 학생 1명').innerText() };
});

const seed = async (count, options = {}) => page.evaluate(async ({count,options}) => {
 const local = await import('/src/features/studentResults/studentResultsStore.ts');
 const columns = [{ id:'math', label:'수학', maxScore:100, description:'문항별 채점표와 대조했습니다.', kind:'score' }];
 const event = local.createStudentResultEvent('local-demo-teacher', {
  title: options.title ?? '가상 2학기 평가 결과', description:'가상 학생을 위한 리뷰 자료입니다.\n점수와 교사 의견을 읽고 확인 또는 이의를 제출하세요.',
  allowConfirmation: true, allowDispute:true, columns,
  recipients:Array.from({length:count},(_,i)=>({
   studentKey:options.long ? '식별'.repeat(49)+String(i+1).padStart(2,'0') : String(20101+i),
   name:options.long ? '가상'.repeat(50) : '가상학생'+String(i+1).padStart(2,'0'),
   verificationCode:String(4800+i), values:{math:92-i%40},
   feedback:'채점 결과를 확인해 주세요. 가상 데이터입니다.'
  })),
 });
 if(options.mixed) {
  const events=JSON.parse(localStorage.getItem('schooldoc_student_results_v1'));
  const target=events.find(e=>e.id===event.id);
  target.recipients.forEach((r,i)=>{
   const status=['unviewed','viewed','confirmed','disputed','reconfirm','replied'][i%6]; r.status=status;
   if(['disputed','reconfirm','replied'].includes(status)) r.dispute={message:'가상 이의: 채점 근거 확인 요청',submittedAt:new Date().toISOString(),...(['reconfirm','replied'].includes(status)?{teacherReply:'가상 답변: 채점 기준 대조 완료',repliedAt:new Date().toISOString()}:{})};
  });
  localStorage.setItem('schooldoc_student_results_v1',JSON.stringify(events));
  dispatchEvent(new CustomEvent('schooldoc-student-results-change'));
 }
 return event;
}, {count,options});
const makeStudent = async (event, index = 0) => {
 const student=await context.newPage(); student.on('pageerror',e=>results.pageErrors.push(e.message));
 await student.setViewportSize({width:390,height:844});
 await student.goto(origin+'/s/results/'+event.publicToken);
 await student.getByLabel('성명').fill(event.recipients[index].name);
 await student.getByLabel('확인번호').fill(event.recipients[index].verificationCode);
 await student.getByRole('button',{name:'내 결과 조회'}).click();
 await student.getByRole('button',{name:'조회 종료'}).waitFor();
 return student;
};
const width = target => target.evaluate(()=>({viewport:innerWidth, document:document.documentElement.scrollWidth}));
await step('teacherEmpty',async()=>{
 await page.goto(origin+'/tools/student-results'); await page.getByRole('button',{name:'새 결과 안내'}).waitFor();
 await shot('02-teacher-empty'); return { width:await width(page) };
});
const classroom=await seed(24,{mixed:true});
await step('representativeTeacher24',async()=>{
 await page.goto(origin+'/tools/student-results/'+classroom.id); await page.getByRole('heading',{name:'학생 현황 (24명)'}).waitFor();
 await shot('03-teacher-desktop-24');
 await page.getByRole('tab',{name:'접속 정보'}).focus(); await page.keyboard.press('ArrowLeft'); assert.equal(await page.getByRole('tab',{name:'현황'}).getAttribute('aria-selected'),'true');
 await page.getByRole('tab',{name:'접속 정보'}).click(); await shot('04-teacher-access-desktop-24');
 const masked=await page.getByRole('row',{name:/가상학생01/}).innerText(); assert(masked.includes('••••'));assert(!masked.includes('4800'));
 await page.setViewportSize({width:390,height:844}); await shot('05-teacher-access-mobile-24'); const mobileWidth=await width(page);
 await page.getByRole('tab',{name:'현황'}).click(); await shot('06-teacher-mobile-24');
 return {desktopRows:24, masked:true, keyboardTabs:true, mobileWidth};
});
await step('studentFlowAndCorrection',async()=>{
 const event=await seed(1,{title:'가상 정상 흐름 검증'}); const student=await makeStudent(event);
 await shot('07-student-mobile-viewed',student);
 const studentAxe=await accessibility(student);
 await student.getByLabel('이의 내용').fill('가상 이의: 3번 문항을 확인해 주세요.');
 await student.getByRole('button',{name:'내용 확인 완료'}).click(); await student.getByRole('alertdialog').waitFor();
 await shot('08-student-draft-protection',student); await student.getByRole('button',{name:'이의 계속 작성'}).click();
 await student.getByRole('button',{name:'이의 제출'}).click(); await student.getByText('교사 답변을 기다려 주세요.',{exact:false}).waitFor();
 await page.evaluate(async ({eid,rid})=>{const s=await import('/src/features/studentResults/studentResultsStore.ts');s.replyToStudentDispute('local-demo-teacher',eid,rid,'가상 답변: 3번 문항 배점은 올바릅니다.');},{eid:event.id,rid:event.recipients[0].id});
 await student.getByRole('button',{name:'최신 결과 확인'}).click(); await student.getByText('가상 답변: 3번 문항 배점은 올바릅니다.').waitFor();
 await shot('09-student-reconfirm',student); await student.getByRole('button',{name:'내용 확인 완료'}).click(); await student.getByText('결과 확인을 완료했습니다.').waitFor();
 await page.evaluate(async eid=>{const s=await import('/src/features/studentResults/studentResultsStore.ts');const e=s.getStudentResultEvent('local-demo-teacher',eid);const r=e.recipients[0];s.updateStudentResultRecipient('local-demo-teacher',e.id,r.id,e.updatedAt,r.updatedAt,{math:95},'가상 정정 의견','가상 채점 수정');},event.id);
 await student.getByRole('button',{name:'최신 결과 확인'}).click(); await student.getByText('95 / 100').first().waitFor(); await shot('10-student-corrected-reconfirm',student);
 const content=await student.locator('main').innerText(); assert(content.includes('다시 확인해 주세요.'));
 await student.getByRole('button',{name:'조회 종료'}).click(); await student.getByRole('button',{name:'내 결과 조회'}).waitFor(); assert.equal(await student.getByLabel('성명').inputValue(),'');
 await shot('11-student-normal-exit',student); await student.close();
 return {studentAxe,disputeDraftProtected:true,replyReconfirm:true,scoreCorrectionReconfirm:true,normalLogoutClears:true};
});
await step('lateResponseAfterLogout',async()=>{
 const event=await seed(1,{title:'가상 조회 종료 경쟁 검증'});
 const student=await context.newPage(); await student.setViewportSize({width:390,height:844});
 await student.route('**/src/features/studentResults/studentResultsPublicApi.ts*',async route=>{
  const response=await route.fetch(); let body=await response.text();
  assert(body.includes('const refreshPublicStudentResult = async'), 'Vite export signature changed');
  body=body.replace('const refreshPublicStudentResult = async','const reviewOriginalRefresh = async');
  body+='\nexport const refreshPublicStudentResult = async (...args) => { const value=await reviewOriginalRefresh(...args); window.__reviewInFlight=true; await new Promise(resolve=>setTimeout(resolve,1500)); window.__reviewInFlight=false; return value; };\n';
  await route.fulfill({response,body});
 });
 await student.goto(origin+'/s/results/'+event.publicToken);
 await student.getByLabel('성명').fill(event.recipients[0].name);await student.getByLabel('확인번호').fill(event.recipients[0].verificationCode);await student.getByRole('button',{name:'내 결과 조회'}).click();await student.getByRole('button',{name:'조회 종료'}).waitFor();
 await student.getByRole('button',{name:'최신 결과 확인'}).click();await student.waitForFunction(()=>window.__reviewInFlight===true);
 await student.getByRole('button',{name:'조회 종료'}).click(); await student.getByRole('button',{name:'내 결과 조회'}).waitFor(); await shot('12-exit-before-late-response',student);
 await student.waitForFunction(()=>window.__reviewInFlight===false); await student.getByRole('button',{name:'조회 종료'}).waitFor(); await shot('13-private-result-restored-after-exit',student);
 const value={resultRestored:await student.getByText('92 / 100').first().isVisible(), refreshButtonEnabled:await student.getByRole('button',{name:'최신 결과 확인'}).isEnabled(), url:student.url().replace(origin,'')};
 assert(value.resultRestored); await student.close();return value;
});
await step('parentSettingsVersion',async()=>{
 const event=await seed(2,{title:'가상 배점 변경 검증'});const student=await makeStudent(event);
 // One recipient confirms before the setting change.
 await page.evaluate(async ({eid,rid})=>{const s=await import('/src/features/studentResults/studentResultsStore.ts');s.confirmStudentResult(eid,rid);},{eid:event.id,rid:event.recipients[1].id});
 await shot('14-student-old-max-score',student);
 const changed=await page.evaluate(async eid=>{
  const s=await import('/src/features/studentResults/studentResultsStore.ts');const e=s.getStudentResultEvent('local-demo-teacher',eid);
  const version=e.recipients[0].updatedAt;s.updateStudentResultSettings('local-demo-teacher',eid,e.updatedAt,{title:e.title,description:e.description,allowConfirmation:true,allowDispute:true,columns:e.columns.map(c=>({...c,maxScore:200}))});
  const updated=s.getStudentResultEvent('local-demo-teacher',eid);
  return {sameRecipientVersion:version===updated.recipients[0].updatedAt, alreadyConfirmedStatus:updated.recipients[1].status, newMax:updated.columns[0].maxScore};
 },event.id);
 assert(await student.getByText('92 / 100').first().isVisible());
 await student.getByRole('button',{name:'내용 확인 완료'}).click();await student.getByText('결과 확인을 완료했습니다.').waitFor();await shot('15-new-max-marked-confirmed-from-old-view',student);
 assert(await student.getByText('92 / 200').first().isVisible()); await student.close();
 return {...changed, oldViewAccepted:true, returnedNewMaxAsConfirmed:true};
});
await step('spaDraftLoss',async()=>{
 await page.setViewportSize({width:1440,height:1000});
 await page.goto(origin+'/tools/student-results');await page.getByRole('button',{name:'새 결과 안내'}).click();
 await page.getByPlaceholder('예: 2학기 수행평가 결과').fill('가상 저장 전 초안');
 await shot('16-create-draft-before-back');await page.goBack();
 const url=page.url().replace(origin,'');const dialog=await page.getByRole('alertdialog').count();
 await page.getByRole('button',{name:'새 결과 안내'}).click();
 const value=await page.getByPlaceholder('예: 2학기 수행평가 결과').inputValue();await shot('17-create-draft-lost-after-back');
 return {backDestination:url, warningDialogs:dialog, titleOnReentry:value};
});
await step('qrOutput17',async()=>{
 const event=await seed(17,{title:'가상 개인 QR 배부 17명'});
 await page.goto(origin+'/tools/student-results/'+event.id+'/qr-print');await page.getByTestId('student-result-qr-page').first().waitFor();
 const cards=await page.getByTestId('student-result-qr-card').count(),pages=await page.getByTestId('student-result-qr-page').count();
 await shot('18-qr-preview-17');
 const images=await page.getByRole('button',{name:/QR.*이미지|PNG|이미지.*저장/}).count();
 const wait=page.waitForEvent('download');await page.getByRole('button',{name:'PDF 다운로드'}).click(); const download=await wait;await download.saveAs(path.join(dir,'qr-17.pdf'));
 assert.equal(cards,17);assert.equal(pages,3);return {cards,pages,imageSaveButtons:images,filename:download.suggestedFilename()};
});
await step('qrLongIdentity',async()=>{
 const event=await seed(8,{long:true,title:'가상 긴 성명과 식별값 경계 검증'});
 await page.goto(origin+'/tools/student-results/'+event.id+'/qr-print');await page.getByTestId('student-result-qr-page').first().waitFor();
 await shot('19-qr-long-identity-preview');
 const layout=await page.getByTestId('student-result-qr-card').evaluateAll(cards=>cards.map(card=>{
  const c=card.getBoundingClientRect(),s=card.querySelector('svg').getBoundingClientRect(),n=card.querySelector('[data-testid=student-result-qr-name]').getBoundingClientRect();
  return {cardHeight:c.height,nameHeight:n.height,qrHeight:s.height,qrBottomOutsideCard:s.bottom>c.bottom};
 }));
 const wait=page.waitForEvent('download'); await page.getByRole('button',{name:'PDF 다운로드'}).click();const download=await wait;await download.saveAs(path.join(dir,'qr-long.pdf'));
 return {nameLength:100,keyLength:100,layout};
});
await step('density60AndAxe',async()=>{
 const event=await seed(60,{mixed:true,title:'가상 60명 현황'});
 await page.goto(origin+'/tools/student-results/'+event.id);await page.getByRole('heading',{name:'학생 현황 (60명)'}).waitFor();
 await shot('20-teacher-desktop-60');await page.setViewportSize({width:390,height:844});await shot('21-teacher-mobile-60');const mobileWidth=await width(page);const teacherAxe=await accessibility(page);
 // CSS zoom approximates reflow; this is not a physical browser zoom/device test.
 await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>document.documentElement.style.zoom='2');await shot('22-teacher-css-200-percent');await page.evaluate(()=>document.documentElement.style.zoom='');
 return {students:60,mobileWidth,cssZoom:200,teacherAxe};
});


await step('expiredSessionRecovery',async()=>{
 const event=await seed(1,{title:'가상 세션 만료 복구 검증'});
 const student=await context.newPage();await student.setViewportSize({width:390,height:844});
 await student.route('**/src/features/studentResults/studentResultsPublicApi.ts*',async route=>{
  const response=await route.fetch();let body=await response.text();assert(body.includes('const refreshPublicStudentResult = async'));
  body=body.replace('const refreshPublicStudentResult = async','const reviewOriginalRefresh = async');
  body+='\nexport const refreshPublicStudentResult = async () => { throw new Error("학생 인증이 만료되었습니다. 다시 확인해 주세요."); };\n';
  await route.fulfill({response,body});
 });
 await student.goto(origin+'/s/results/'+event.publicToken);
 await student.getByLabel('성명').fill(event.recipients[0].name);await student.getByLabel('확인번호').fill(event.recipients[0].verificationCode);await student.getByRole('button',{name:'내 결과 조회'}).click();
 await student.getByRole('button',{name:'최신 결과 확인'}).click();await student.getByRole('alert').waitFor();await shot('23-expired-session-keeps-private-result',student);
 const value={error:await student.getByRole('alert').innerText(), privateResultRetained:await student.getByText('92 / 100').first().isVisible(),loginFormVisible:await student.getByRole('button',{name:'내 결과 조회'}).count()>0};
 await student.getByRole('button',{name:'조회 종료'}).click();await student.getByRole('button',{name:'내 결과 조회'}).waitFor();value.logoutRecovers=true;
 await student.close();return value;
});
await step('invalidAndClosedAccess',async()=>{
 const event=await seed(1,{title:'가상 접근 실패와 종료'});
 const student=await context.newPage();await student.setViewportSize({width:390,height:844});await student.goto(origin+'/s/results/'+event.publicToken);
 await student.getByLabel('성명').fill(event.recipients[0].name);await student.getByLabel('확인번호').fill('0000');await student.getByRole('button',{name:'내 결과 조회'}).click();await student.getByRole('alert').waitFor();await shot('24-invalid-student-code',student);
 const wrongCode=await student.getByRole('alert').innerText();
 await page.evaluate(async eid=>{const s=await import('/src/features/studentResults/studentResultsStore.ts');s.setStudentResultEventStatus('local-demo-teacher',eid,'closed');},event.id);
 await student.reload();await student.getByRole('heading',{name:'종료된 결과 안내입니다'}).waitFor();await shot('25-public-closed',student);
 await student.goto(origin+'/s/results/not-a-result');await student.getByRole('heading',{name:'결과 안내를 찾을 수 없습니다'}).waitFor();await shot('26-public-missing',student);
 await student.close();return {wrongCodeMessage:wrongCode,closedBlocked:true,missingPageShown:true};
});

} finally { await writeFile(path.join(dir,'results.json'),outputJson(results)); await browser.close(); }
