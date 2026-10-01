import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const origin = 'http://127.0.0.1:4177';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'evidence');
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const page = await context.newPage();
const results = { browser: browser.version(), scope: 'Local demo with synthetic students only', observations: {}, pageErrors: [] };
page.on('pageerror', e => results.pageErrors.push(e.message));
const shot = async (name, target = page) => target.screenshot({ path: path.join(dir, name + '.png'), fullPage: true });
const accessibility = async (target, name) => {
 await target.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
 const violations = await target.evaluate(async () => {
  const r = await axe.run(document, { runOnly: { type:'tag', values:['wcag2a','wcag2aa','wcag21aa'] } });
  return r.violations.map(v => ({ id:v.id, impact:v.impact, nodes:v.nodes.map(n => ({target:n.target,summary:n.failureSummary})) }));
 });
 results.observations[name] = { width: await width(target), violations };
};
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

try {
await page.goto(origin + '/tools/student-results');
await page.getByRole('button', { name:'새 결과 안내' }).waitFor();
await shot('01-empty-desktop');
const event = await seed(24, {mixed:true});
await page.goto(origin + '/tools/student-results/' + event.id);
await page.getByRole('heading', {name:'학생 현황 (24명)'}).waitFor();
await shot('02-status-24-desktop');
await accessibility(page,'desktopStatus');
await page.setViewportSize({width:390,height:844});
await page.getByTestId('student-results-status-cards').waitFor();
await shot('03-status-24-mobile');
await page.screenshot({path:path.join(dir,'04-status-mobile-viewport.png')});
await accessibility(page,'mobileStatus');
await page.getByRole('tab',{name:'접속 정보'}).click();
await page.getByTestId('student-results-access-cards').waitFor();
await shot('05-access-24-mobile');
await accessibility(page,'mobileAccess');
await page.getByPlaceholder('성명 또는 식별값 검색').fill('없는가상학생');
await shot('06-filter-empty-mobile');
await page.getByPlaceholder('성명 또는 식별값 검색').fill('');
await page.setViewportSize({width:1440,height:1000});
await shot('07-access-24-desktop');
await accessibility(page,'desktopAccess');
const student = await makeStudent(event);
await shot('08-public-mobile',student);
await accessibility(student,'publicResult');
await student.getByLabel('이의 내용').fill('가상 이의 확인 요청');
await student.getByRole('button',{name:'이의 제출'}).click();
await student.getByText('내가 보낸 이의').waitFor();
await shot('09-public-dispute-mobile',student);
await page.evaluate(async ({eventId,recipientId}) => {
 const local = await import('/src/features/studentResults/studentResultsStore.ts');
 local.replyToStudentDispute('local-demo-teacher',eventId,recipientId,'가상 답변: 산출 내역 확인을 마쳤습니다.');
},{eventId:event.id,recipientId:event.recipients[0].id});
await student.getByRole('button',{name:'최신 결과 확인'}).click();
await student.getByText('수정된 결과나 선생님 답변을 확인한 뒤 결과를 다시 확인해 주세요.').waitFor();
await shot('10-public-reconfirm-mobile',student);
await student.getByRole('button',{name:'내용 확인 완료'}).click();
await student.getByText('결과 확인을 완료했습니다.').waitFor();
await shot('11-public-confirmed-mobile',student);
await page.evaluate(async ({eventId,recipientId}) => {
 const local = await import('/src/features/studentResults/studentResultsStore.ts');
 local.regenerateStudentResultPersonalToken('local-demo-teacher',eventId,recipientId);
},{eventId:event.id,recipientId:event.recipients[0].id});
await student.getByRole('button',{name:'최신 결과 확인'}).click();
await student.getByRole('button',{name:'내 결과 조회'}).waitFor();
await shot('12-public-expired-mobile',student);
await accessibility(student,'publicExpired');
await student.close();
const large = await seed(60,{long:true,mixed:true});
await page.goto(origin+'/tools/student-results/'+large.id);
await page.getByRole('heading',{name:'학생 현황 (60명)'}).waitFor();
await shot('13-status-60-long-desktop');
await page.setViewportSize({width:390,height:844});
await page.getByTestId('student-results-status-cards').waitFor();
await shot('14-status-60-long-mobile');
await accessibility(page,'longMobileStatus');
await page.getByRole('tab',{name:'접속 정보'}).click();
await shot('15-access-60-long-mobile');
await accessibility(page,'longMobileAccess');
const ascii = await page.evaluate(async () => {
 const local = await import('/src/features/studentResults/studentResultsStore.ts');
 return local.createStudentResultEvent('local-demo-teacher',{ title:'T'.repeat(200),description:'D'.repeat(250),allowConfirmation:true,allowDispute:true,
 columns:[{id:'score',label:'L'.repeat(100),maxScore:100,description:'C'.repeat(200)}],
 recipients:[{studentKey:'K'.repeat(100),name:'N'.repeat(100),verificationCode:'가4821',values:{score:92},feedback:'F'.repeat(300)}] });
});
const longStudent = await makeStudent(ascii);
await shot('16-public-long-ascii-mobile',longStudent);
await accessibility(longStudent,'longPublicResult');
await longStudent.close();
for (const value of Object.values(results.observations)) {
 assert.equal(value.width.document,value.width.viewport);
 assert.deepEqual(value.violations,[]);
}
assert.deepEqual(results.pageErrors,[]);
} finally {
 await writeFile(path.join(dir,'results.json'),JSON.stringify(results,null,2));
 await context.close(); await browser.close();
}
console.log(JSON.stringify(results,null,2));
