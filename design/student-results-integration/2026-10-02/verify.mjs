// Synthetic data only. Refuses any non-loopback target and non-demo build.
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.STUDENT_RESULTS_REVIEW_URL || 'http://127.0.0.1:4183';
if (!/^http:\/\/(127\.0\.0\.1|localhost):[0-9]+$/.test(base)) throw new Error('Local demo target required');
const output = new URL('./screens/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const page = await context.newPage();
const logs = [];
page.on('pageerror', error => logs.push(error.message));
const findings = [];
async function seed(count) {
  await page.goto(base + '/tools/student-results');
  return await page.evaluate(async (count) => {
    const config = await import('/src/features/studentResults/studentResultsConfig.ts');
    if (!config.isStudentResultsDemoMode) throw new Error('Demo mode required');
    const store = await import('/src/features/studentResults/studentResultsStore.ts');
    const event = store.createStudentResultEvent('local-demo-teacher', {
      title: '가상 학급 평가 결과 안내', description: '자신의 결과를 확인하고 궁금한 점은 이의를 제출하세요.',
      allowConfirmation: true, allowDispute: true,
      columns: [ { id:'detail',label:'개별 점수',maxScore:50,description:'',kind:'score' }, { id:'total',label:'총점',maxScore:100,description:'',kind:'total' } ],
      recipients: Array.from({length:Math.max(1,count)}, (_,i) => ({ studentKey:String(i+1), name:i===count-1?'가상긴이름'.repeat(18):'가상학생'+String(i+1).padStart(2,'0'), verificationCode:String(4000+i), values:{detail:40,total:85}, feedback:'가상 피드백' })),
    });
    const events=JSON.parse(localStorage.getItem('schooldoc_student_results_v1'));
    const target=events.find(row=>row.id===event.id);
    if (count===0) target.recipients=[];
    const statuses=['unviewed','viewed','confirmed','disputed','reconfirm','replied'];
    target.recipients.forEach((row,i) => {
      row.status=statuses[i%6];
      if(i%6!==0) row.viewedAt=new Date().toISOString();
      if(i%6===2) row.confirmedAt=new Date().toISOString();
      if(i%6>=3) row.dispute={message:'가상 이의: 산출표 확인 요청',submittedAt:new Date().toISOString(),...(i%6>=4?{teacherReply:'가상 답변: 산출표를 확인했습니다.',repliedAt:new Date().toISOString()}: {})};
    });
    localStorage.setItem('schooldoc_student_results_v1',JSON.stringify(events));
    return {id:event.id,token:event.publicToken,personal:event.recipients[1]?.personalToken || event.recipients[0].personalToken};
  },count);
}
async function capture(name, inspect=true) {
  await page.screenshot({path:new URL(name+'.jpg',output).pathname.replace(/^\/(.:)/,'$1'),fullPage:true,type:'jpeg',quality:75});
  if (name === 'mobile-status-24') await page.screenshot({path:new URL('mobile-status-top.jpg',output).pathname.replace(/^\/(.:)/,'$1'),type:'jpeg',quality:85});
  const metric=await page.evaluate(() => ({width:innerWidth,document:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}));
  expect(metric.document).toBe(metric.width);
  const axe=inspect?await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze():{violations:[]};
  findings.push({name,...metric,violations:axe.violations.map(v=>({id:v.id,impact:v.impact,count:v.nodes.length,targets:v.nodes.slice(0,4).map(n=>n.target)}))});
}
try {
  const event=await seed(24);
  await page.goto(base+'/tools/student-results/'+event.id);
  await expect(page.getByRole('heading',{name:'학생 현황 (24명)'})).toBeVisible();
  await capture('desktop-status-24');
  await page.getByRole('tab',{name:'접속 정보'}).click(); await capture('desktop-access-24');
  await page.setViewportSize({width:390,height:844}); await capture('mobile-access-24');
  await page.getByRole('tab',{name:'현황'}).click(); await capture('mobile-status-24');
  await page.setViewportSize({width:683,height:450}); await capture('zoom-equivalent-status-24');
  await page.setViewportSize({width:1366,height:900});
  const max=await seed(60); await page.goto(base+'/tools/student-results/'+max.id); await capture('desktop-status-60');
  const empty=await seed(0); await page.goto(base+'/tools/student-results/'+empty.id); await capture('desktop-empty');
  await page.setViewportSize({width:390,height:844}); await capture('mobile-empty');
  await page.goto(base+'/s/results/'+event.token+'?recipient='+event.personal);
  await expect(page.getByRole('button',{name:'조회 종료'})).toBeVisible(); await capture('mobile-student-result');
  await page.getByRole('button',{name:'조회 종료'}).click(); await capture('mobile-student-exited');
  await page.setViewportSize({width:1366,height:900});
  await page.goto(base+'/tools/student-results/'+event.id+'/qr-print');
  await expect(page.getByRole('button',{name:'PDF 다운로드'})).toBeEnabled(); await capture('desktop-qr-24',false);
  expect(logs).toEqual([]);
  await writeFile(new URL('./findings.json',import.meta.url),JSON.stringify({environment:'Installed Chrome, local demo only; 683px simulates CSS viewport at 200% on 1366px. Not native browser zoom.',findings,pageErrors:logs},null,2)+'\n');
  console.log(JSON.stringify({screens:findings.length,violations:findings.filter(f=>f.violations.length),pageErrors:logs},null,2));
} finally { await browser.close(); }
