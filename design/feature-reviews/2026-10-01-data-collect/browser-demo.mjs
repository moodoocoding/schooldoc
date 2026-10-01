import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import writeExcelFile from 'write-excel-file/node';
import { jsPDF } from 'jspdf';
import fs from 'node:fs';
import path from 'node:path';

const base = 'http://127.0.0.1:4183';
const out = path.resolve('design/feature-reviews/2026-10-01-data-collect/evidence');
fs.mkdirSync(out, { recursive: true });
const observations = { browser: '', mode: 'local demo, real installed Chrome, virtual files only', steps: [], screens: [], errors: [] };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
observations.browser = browser.version();
const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, timezoneId: 'Asia/Seoul', permissions: ['clipboard-read', 'clipboard-write'] });
await context.route('**/*', route => {
  const url = route.request().url();
  return url.startsWith(base) || url.startsWith('data:') || url.startsWith('blob:') ? route.continue() : route.abort();
});
const page = await context.newPage();
page.setDefaultTimeout(15000);
page.on('pageerror', e => observations.errors.push(String(e)));
async function step(name, action) {
  try { const value = await action(); observations.steps.push({ name, completed: true, observation: value ?? null }); console.log(name, JSON.stringify(value ?? 'completed')); }
  catch (error) { observations.steps.push({ name, completed: false, error: String(error) }); console.log(name, String(error)); throw error; }
}
async function capture(name, target = page, axe = false) {
  await target.screenshot({ path: path.join(out, name + '.jpg'), fullPage: true, quality: 75 });
  const layout = await target.evaluate(() => ({ viewport: innerWidth, width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, bodyZoom: getComputedStyle(document.body).zoom, focused: document.activeElement?.outerHTML.slice(0, 400) }));
  const record = { name, ...layout };
  if (axe) {
    const result = await new AxeBuilder({ page: target }).analyze();
    record.axe = result.violations.map(v => ({ id: v.id, impact: v.impact, count: v.nodes.length, nodes: v.nodes.map(n => ({ target: n.target, failure: n.failureSummary })) }));
  }
  observations.screens.push(record);
}
async function download(target, locator, name) {
  const event = target.waitForEvent('download'); await locator.click(); const item = await event;
  await item.saveAs(path.join(out, name)); return { suggested: item.suggestedFilename(), bytes: fs.statSync(path.join(out, name)).size };
}
const doc = new jsPDF(); doc.text('SchoolDoc virtual review file. No personal data.', 15, 20);
const pdf = Buffer.from(doc.output('arraybuffer'));
fs.writeFileSync(path.join(out, 'virtual-template.pdf'), pdf);
const file = name => ({ name, mimeType: 'application/pdf', buffer: pdf });
let fixedUrl, fixedId, customUrl, customId;
try {
  await step('empty list', async () => { await page.goto(base + '/tools/data-collect'); await page.getByRole('heading', { name: '아직 자료 수합이 없습니다' }).waitFor(); await capture('01-empty-desktop', page, true); });
  await step('creation validation and keyboard', async () => {
    await page.getByRole('button', { name: '새 자료 수합', exact: true }).click();
    await page.getByRole('button', { name: '자료 수합 만들기', exact: true }).click();
    await page.getByText('수합 제목을 입력해 주세요.').waitFor();
    await page.waitForTimeout(200);
    const focused = await page.getByLabel('제목').evaluate(el => el === document.activeElement);
    await page.keyboard.press('Tab');
    await capture('02-create-empty-error', page, true);
    return { titleFocusedAfterValidation: focused };
  });
  await step('paste duplicates, owner distinction, undo', async () => {
    await page.getByLabel('이름 입력 또는 붙여넣기').evaluate(el => {
      const clipboard = new DataTransfer(); clipboard.setData('text/plain', '번호\t성명\t부서\n1\t김하늘\t연구부\n2\t박서준\t교무부\n3\t김하늘\t교육부');
      el.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, clipboardData: clipboard }));
    });
    await page.getByLabel('1번 구분 정보').fill('2학년 1반');
    await page.getByLabel('3번 구분 정보').fill('2학년 2반');
    await capture('03-paste-duplicate-desktop');
    await page.getByRole('button', {name:'실행 취소', exact:true}).click();
    return { afterUndoRows: await page.locator('input[aria-label$="번 제출 대상"]').count() };
  });
  await step('Excel analyze/change column/replace/corrupt recover', async () => {
    await page.getByRole('radio', {name:'Excel 불러오기', exact:true}).check();
    const workbook = await writeExcelFile([['번호','부서','성명'],[1,'연구부','김하늘'],[2,'교무부','박서준']]).toBuffer();
    await page.locator('input[type=file][accept=".xlsx"]').setInputFiles({name:'가상명단.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:workbook});
    await page.getByLabel('이름으로 사용할 열').waitFor();
    const automatic = await page.getByLabel('이름으로 사용할 열').inputValue();
    await page.getByLabel('이름으로 사용할 열').selectOption('1');
    await capture('04-excel-column-choice');
    await page.getByLabel('이름으로 사용할 열').selectOption('2');
    await page.getByRole('button', {name:'명단 교체',exact:true}).click();
    await page.locator('input[type=file][accept=".xlsx"]').setInputFiles({name:'손상명단.xlsx',mimeType:'application/octet-stream',buffer:Buffer.from('invalid')});
    await page.getByText(/Excel을 읽지 못했습니다/).waitFor();
    const rows = await page.locator('input[aria-label$="번 제출 대상"]').count();
    await capture('05-excel-error');
    await page.getByRole('radio', {name:'이름 입력',exact:true}).check();
    return { automaticColumn: automatic, rowsPreservedAfterCorruptExcel:rows };
  });
  await step('representative 30-target fixed template collection', async () => {
    await page.getByLabel('제목').fill('가상 2학기 자료 검토');
    await page.getByLabel('안내').fill('가상 자료입니다. 배포 파일 확인 뒤 회신하세요.');
    const names=['가상긴이름담당부서학생03',...Array.from({length:27},(_,i)=>'가상학생'+String(i+4).padStart(2,'0'))];
    await page.getByLabel('이름 입력 또는 붙여넣기').fill(names.join('\n'));
    await page.getByRole('button', {name:'입력한 이름 추가',exact:true}).click();
    await page.getByRole('radio', {name:/파일을 보내 검토받기/}).check();
    await page.locator('input[type=file][accept*=".pdf"]').setInputFiles(file('가상배포.pdf'));
    await page.getByRole('button', {name:/기한 없음/}).click();
    await capture('06-create-30-desktop',page,true);
    await page.getByRole('button',{name:'자료 수합 만들기',exact:true}).click();
    await page.getByRole('heading',{name:'가상 2학기 자료 검토',exact:true}).waitFor();
    fixedId = new URL(page.url()).pathname.split('/').at(-1);
    fixedUrl = await page.getByLabel('자료 수합 공개 링크').inputValue();
    await capture('07-manage-30-pending-desktop',page,true);
    await page.getByRole('button',{name:'링크 복사',exact:true}).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    const qr = await download(page,page.getByRole('button',{name:'QR 이미지 저장',exact:true}),'08-qr.png');
    return { targets:await page.locator('tbody tr').count(), copiedLinkMatches:copied===fixedUrl, qr };
  });
  const mobile = await context.newPage(); mobile.setDefaultTimeout(15000); await mobile.setViewportSize({width:390,height:844});
  await step('mobile fixed search/no results/confirm',async()=>{
    await mobile.goto(fixedUrl);
    await mobile.getByPlaceholder('제출 대상 이름 2글자 이상').fill('없는이름');
    await capture('09-mobile-no-match',mobile,true);
    await mobile.getByPlaceholder('제출 대상 이름 2글자 이상').fill('김하늘');
    await mobile.getByRole('button',{name:'김○늘',exact:true}).click();
    const original = await download(mobile,mobile.getByRole('link',{name:'가상배포.pdf',exact:true}),'10-template-download.pdf');
    await mobile.getByRole('button',{name:'이상 없음',exact:true}).click();
    await mobile.getByLabel('전달 사항').fill('가상 확인 메모');
    await capture('11-management-intermediate');
    await mobile.getByRole('button',{name:'회신 제출',exact:true}).click();
    await mobile.getByRole('heading',{name:'회신을 제출했습니다',exact:true}).waitFor();
    await capture('12-mobile-confirm-complete',mobile);
    return original;
  });
  await step('mobile correction validation/retry/revision preservation',async()=>{
    await mobile.getByRole('button',{name:'다시 회신하기',exact:true}).click();
    await mobile.getByRole('button',{name:'수정본 제출',exact:true}).click();
    await mobile.getByLabel('전달 사항').fill('가상 수정 메모 보존');
    await mobile.locator('input[type=file]').setInputFiles({name:'가짜.pdf',mimeType:'application/pdf',buffer:Buffer.from('not-pdf')});
    await mobile.getByRole('button',{name:'새 버전으로 회신',exact:true}).click();
    await mobile.getByText('파일 확장자와 실제 파일 형식이 일치하지 않습니다.').waitFor();
    await capture('13-mobile-upload-error',mobile,true);
    const kept=await mobile.getByLabel('전달 사항').inputValue();
    await mobile.locator('input[type=file]').setInputFiles(file('가상수정.pdf'));
    await mobile.getByRole('button',{name:'새 버전으로 회신',exact:true}).click();
    await mobile.getByRole('heading',{name:'회신을 제출했습니다',exact:true}).waitFor();
    await mobile.goto(fixedUrl); await mobile.getByPlaceholder('제출 대상 이름 2글자 이상').fill('박서준'); await mobile.getByRole('button',{name:'박○준',exact:true}).click();
    await mobile.getByRole('button',{name:'이상 없음',exact:true}).click(); await mobile.getByRole('button',{name:'회신 제출',exact:true}).click();
    await page.reload(); await page.getByRole('heading',{name:'가상 2학기 자료 검토'}).waitFor();
    await capture('14-manage-30-mixed-desktop',page,true);
    const current=await download(page,page.getByRole('link',{name:'가상수정.pdf',exact:true}),'15-current-file.pdf');
    const collection=await page.evaluate(id=>JSON.parse(localStorage.getItem('schooldoc_data_collect_v1')).find(x=>x.id===id),fixedId);
    return { kept, revisions:collection.submissions.filter(s=>s.targetId===collection.targets[0].id).map(s=>s.revision), noteVisibleInManagement:(await page.innerText('body')).includes('가상 수정 메모 보존'), priorVersionDownloadVisible:await page.getByRole('link',{name:'가상배포.pdf',exact:true}).count(), current };
  });
  await step('desktop CSS 200%, teacher mobile, A4 browser print',async()=>{
    await page.evaluate(()=>document.body.style.zoom='2'); await capture('16-manage-css-200',page,true); await page.evaluate(()=>document.body.style.zoom='1');
    await mobile.goto(base+'/tools/data-collect/'+fixedId); await mobile.getByRole('heading',{name:'가상 2학기 자료 검토'}).waitFor(); await capture('17-manage-mobile',mobile,true);
    await page.emulateMedia({media:'print'}); await capture('18-browser-print',page); await page.pdf({path:path.join(out,'19-browser-print-A4.pdf'),format:'A4',printBackground:true}); await page.emulateMedia({media:'screen'});
  });
  await step('custom collection first submit, session resubmit, reload duplicate',async()=>{
    await page.goto(base+'/tools/data-collect/new'); await page.getByLabel('제목').fill('가상 명단 없는 파일 수합'); await page.getByRole('radio',{name:/제출자가 이름 입력/}).check(); await page.getByRole('button',{name:/기한 없음/}).click(); await page.getByRole('button',{name:'자료 수합 만들기',exact:true}).click();
    await page.getByRole('heading',{name:'가상 명단 없는 파일 수합'}).waitFor(); customId=new URL(page.url()).pathname.split('/').at(-1); customUrl=await page.getByLabel('자료 수합 공개 링크').inputValue();
    await mobile.goto(customUrl); await mobile.getByLabel('제출자 이름').fill('가상제출자'); await mobile.locator('input[type=file]').setInputFiles(file('가상첫제출.pdf')); await mobile.getByRole('button',{name:'회신 제출',exact:true}).click(); await mobile.getByRole('heading',{name:'회신을 제출했습니다'}).waitFor(); await capture('20-custom-first-complete-mobile',mobile,true);
    const firstText=await mobile.innerText('body');
    await mobile.getByRole('button',{name:'다시 회신하기',exact:true}).click(); await mobile.locator('input[type=file]').setInputFiles(file('가상재제출.pdf')); await mobile.getByRole('button',{name:'회신 제출',exact:true}).click(); await mobile.getByRole('heading',{name:'회신을 제출했습니다'}).waitFor();
    await mobile.reload(); await mobile.getByLabel('제출자 이름').fill('가상제출자'); await mobile.locator('input[type=file]').setInputFiles(file('가상새로고침.pdf')); await mobile.getByRole('button',{name:'회신 제출',exact:true}).click(); await mobile.getByText('같은 이름의 제출 기록이 있습니다. 이름을 확인해 주세요.').waitFor(); await capture('21-custom-reload-blocked-mobile',mobile);
    await page.goto(base+'/tools/data-collect/'+customId); await page.getByRole('heading',{name:'가상 명단 없는 파일 수합'}).waitFor(); await capture('22-custom-management-status',page);
    return { firstText, managementText:await page.innerText('body') };
  });
  await step('closed/reopen and expired status discrepancy',async()=>{
    await page.getByRole('button',{name:'수합 종료',exact:true}).click(); await page.getByRole('button',{name:'다시 열기',exact:true}).waitFor(); await mobile.goto(customUrl); await mobile.getByRole('heading',{name:'자료 수합이 종료되었습니다'}).waitFor(); await capture('23-closed-mobile',mobile);
    await page.getByRole('button',{name:'다시 열기',exact:true}).click(); await page.getByRole('button',{name:'수합 종료',exact:true}).waitFor();
    await page.evaluate(id=>{const a=JSON.parse(localStorage.getItem('schooldoc_data_collect_v1'));a.find(x=>x.id===id).dueAt='2026-01-01T17:00';localStorage.setItem('schooldoc_data_collect_v1',JSON.stringify(a));},customId);
    await page.reload(); await page.getByRole('heading',{name:'가상 명단 없는 파일 수합'}).waitFor(); await capture('24-expired-management-open',page);
    await mobile.goto(customUrl); await mobile.getByRole('heading',{name:'자료 수합이 종료되었습니다'}).waitFor(); await capture('25-expired-mobile-closed',mobile);
  });
  await step('teacher 31MB template acceptance and 51MB rejection',async()=>{
    await page.goto(base+'/tools/data-collect/new'); await page.getByRole('radio',{name:/파일을 보내 검토받기/}).check();
    const large=Buffer.alloc(31*1024*1024); pdf.copy(large);
    await page.locator('input[type=file][accept*=".pdf"]').setInputFiles({name:'가상31MB.pdf',mimeType:'application/pdf',buffer:large}); await page.getByText('가상31MB.pdf',{exact:true}).waitFor(); await capture('26-template-31MB-accepted');
    const largePath=path.join(out,'virtual-51mb.tmp.pdf'); fs.writeFileSync(largePath,Buffer.alloc(51*1024*1024)); try { await page.locator('input[type=file][accept*=".pdf"]').setInputFiles(largePath); } finally { fs.unlinkSync(largePath); }
    await page.getByText('파일은 50MB보다 작아야 합니다.',{exact:true}).waitFor(); await capture('27-template-51MB-rejected');
  });
  await step('password/no-resubmit single target',async()=>{
    await page.getByLabel('제목').fill('가상 비밀번호 재제출 제한'); await page.getByRole('radio',{name:/새 파일 제출받기/}).check(); await page.getByLabel('이름 입력 또는 붙여넣기').fill('정가상'); await page.getByRole('button',{name:'입력한 이름 반영',exact:true}).click(); await page.locator('summary').filter({hasText:'추가 설정'}).click(); await page.getByLabel('링크 비밀번호').fill('virtual-2026'); await page.getByLabel('제출 후 파일 교체 허용').uncheck(); await page.getByRole('button',{name:'자료 수합 만들기',exact:true}).click(); await page.getByRole('heading',{name:'가상 비밀번호 재제출 제한'}).waitFor();
    const url=await page.getByLabel('자료 수합 공개 링크').inputValue(); await mobile.goto(url); await mobile.getByLabel('공개 비밀번호').fill('wrong'); await mobile.getByRole('button',{name:'확인',exact:true}).click(); await mobile.getByText('비밀번호가 맞지 않습니다.').waitFor(); await capture('28-password-error-mobile',mobile);
    await mobile.getByLabel('공개 비밀번호').fill('virtual-2026'); await mobile.getByRole('button',{name:'확인',exact:true}).click(); await mobile.getByPlaceholder('제출 대상 이름 2글자 이상').fill('정가상'); await mobile.getByRole('button',{name:'정○상',exact:true}).click(); await mobile.locator('input[type=file]').setInputFiles(file('가상제한.pdf')); await mobile.getByRole('button',{name:'회신 제출',exact:true}).click(); await mobile.getByRole('heading',{name:'회신을 제출했습니다'}).waitFor();
    return { resubmitButtonCount:await mobile.getByRole('button',{name:'다시 회신하기'}).count() };
  });
  await step('2000-target creation density and saved-roster affordance',async()=>{
    await page.goto(base+'/tools/data-collect/new'); await page.getByLabel('제목').fill('가상 최대 2000명'); await page.getByLabel('이름 입력 또는 붙여넣기').fill(Array.from({length:2000},(_,i)=>'가상'+String(i+1).padStart(4,'0')).join('\n')); await page.getByRole('button',{name:'입력한 이름 반영',exact:true}).click();
    await capture('29-create-2000-desktop'); await page.setViewportSize({width:390,height:844}); await capture('30-create-2000-mobile',page); await page.setViewportSize({width:1366,height:900});
    return { rows:await page.locator('input[aria-label$="번 제출 대상"]').count(), savedRosterAffordances:await page.getByText(/저장.*명단|학급 학생 명단/).count() };
  });
} finally {
  fs.writeFileSync(path.join(out,'browser-observations.json'),JSON.stringify(observations,null,2));
  await browser.close();
}
