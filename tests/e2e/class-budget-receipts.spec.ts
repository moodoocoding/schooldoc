import { expect, test, type Page } from '@playwright/test';
import { jsPDF } from 'jspdf';
import AxeBuilder from '@axe-core/playwright';

const receipt = { spentAt: '2026-09-08', merchant: '테스트 문구점', amount: 32500, currency: 'KRW', description: '색연필·종이', page: 1, warnings: [] };
const file = (name = 'receipt.pdf') => {
  const pdf = new jsPDF(); pdf.text('TEST RECEIPT', 20, 20); pdf.text('PAID KRW 32,500', 20, 35);
  return { name, mimeType: 'application/pdf', buffer: Buffer.from(pdf.output('arraybuffer')) };
};
async function setup(page: Page, rows = [receipt]) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('close', () => expect(errors).toEqual([]));
  // 브라우저 통합 테스트용 인증/API 대역. 실제 OpenAI 호출·정확도 검증이 아니다.
  await page.route('**/src/utils/supabaseClient.ts', route => route.fulfill({ contentType: 'application/javascript', body: `
    export const isSupabaseConfigured = true;
    const user = {id:'receipt-test-teacher', email:'test@example.invalid', app_metadata:{role:'admin'}, user_metadata:{name:'테스트 교사'}};
    export const supabase = {
      auth: {
        getSession: async () => ({data:{session:{user}}}),
        onAuthStateChange: () => ({data:{subscription:{unsubscribe(){}}}}),
        signOut: async () => ({}),
      },
      functions: {invoke: async (name, options) => {
        const response = await fetch('/__test_receipt_ai', {method:'POST', body:JSON.stringify(options.body), signal:options.signal});
        return response.ok ? {data:await response.json(),error:null} : {data:null,error:{context:response}};
      }}
    };` }));
  await page.route('**/__test_receipt_ai', route => route.fulfill({ json: { receipts: rows } }));
  await page.goto('/tools/receipts/new');
  await page.getByLabel('학급', {exact:true}).fill('5학년 2반');
  await page.getByLabel('전체 예산').fill('500000');
  await page.getByRole('button', { name: '장부 만들기', exact:true }).click();
  expect(await page.getByRole('button', {name:'영수증 등록',exact:true}).evaluate(el => {
    const css = getComputedStyle(el); return css.color !== css.backgroundColor && css.backgroundColor !== 'rgb(255, 255, 255)';
  })).toBe(true);
}
async function startUpload(page: Page) {
  await page.getByRole('button', { name: '영수증 등록', exact:true }).click();
  await page.getByRole('checkbox', { name: /OpenAI/ }).check();
  await page.getByLabel('영수증 증빙 파일').setInputFiles(file());
  await expect(page.getByLabel('사용처', {exact:true})).toHaveValue(receipt.merchant);
}
test('동의 후 업로드 → 분석 → 원본·수정 → 표·잔액 → 새로고침 후 원본', async ({ page }) => {
  await setup(page);
  await expect(page.getByLabel('사용 날짜')).toHaveCount(0);
  await page.getByRole('button', { name:'영수증 등록', exact:true }).click();
  await expect(page.getByRole('button', {name:'영수증 파일 선택'})).toBeDisabled();
  await page.getByRole('checkbox', {name:/OpenAI/}).check();
  await page.getByLabel('영수증 증빙 파일').setInputFiles(file());
  await expect(page.getByLabel('사용처', {exact:true})).toHaveValue(receipt.merchant);
  await expect(page.getByLabel('금액', {exact:true})).toHaveValue('32500');
  await expect(page.getByLabel('사용 목적', {exact:true})).toHaveValue('');
  await expect(page.getByText('신뢰도', {exact:false})).toHaveCount(0);
  await expect(page.getByRole('button', {name:'영수증 파일 선택'})).toHaveCount(0);
  await expect(page.getByTitle('영수증 PDF 원본')).toHaveAttribute('src', /blob:.*#page=1/);
  await page.getByLabel('사용 목적').fill('학급 미술 재료');
  await page.getByRole('button', {name:'이 지출을 장부에 반영'}).click();
  await expect(page.getByRole('table')).toContainText('학급 미술 재료');
  await expect(page.getByRole('region', {name:'예산 현황'})).toContainText('467,500원');
  await page.reload();
  await page.getByRole('button', {name:'테스트 문구점 영수증 미리보기'}).click();
  await expect(page.getByRole('dialog').getByTitle('영수증 PDF 원본')).toHaveAttribute('src', /blob:/);
  await expect(page.getByRole('dialog').getByRole('checkbox')).toHaveCount(0);
  await page.getByRole('dialog').getByRole('button', {name:'닫기', exact:true}).click();
  await page.getByRole('button', {name:'테스트 문구점 지출 수정'}).click();
  await page.getByLabel('금액', {exact:true}).fill('30000');
  await page.getByRole('button', {name:'수정 저장'}).click();
  await expect(page.getByRole('region', {name:'예산 현황'})).toContainText('470,000원');
  await page.getByRole('button', {name:'테스트 문구점 지출 수정'}).click();
  await page.getByRole('button', {name:'휴지통으로 이동'}).click();
  await expect(page.getByRole('table')).not.toContainText('학급 미술 재료');
  await page.getByText('휴지통 1건', {exact:true}).click();
  await page.getByRole('button', {name:'복원', exact:true}).click();
  await expect(page.getByRole('table')).toContainText('학급 미술 재료');
});
for (const width of [1440, 390]) test('영수증 모아 보기·사진/PDF 넘기기·닫기·초안 유지 ' + width, async ({page}) => {
  await page.setViewportSize({width, height:900});
  await setup(page);
  let apiCalls = 0;
  await page.route('**/__test_receipt_ai', route => { apiCalls++; return route.fulfill({json:{receipts:[receipt]}}); });
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 450; canvas.height = 640;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#fff'; context.fillRect(0, 0, 450, 640);
    context.fillStyle = '#172B4D'; context.font = 'bold 28px sans-serif'; context.fillText('테스트 영수증', 50, 70);
    context.font = '22px sans-serif';
    ['테스트 문구점', '2026-09-08', '색연필 · 종이', '합계 32,500원'].forEach((line, i) => context.fillText(line, 50, 160 + i * 90));
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.getByRole('button', {name:'영수증 등록',exact:true}).click();
  await page.getByRole('checkbox', {name:/OpenAI/}).check();
  await page.getByLabel('영수증 증빙 파일').setInputFiles([
    {name:'사진 영수증.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')}, file('영수증.pdf'),
  ]);
  await expect(page.getByRole('button', {name:'결과 확인·수정'})).toHaveCount(2);
  await page.getByLabel('사용 목적').fill('입력 중인 내용 유지');
  const gallery = page.getByRole('region', {name:'등록한 영수증 2개'});
  await expect(gallery.locator('img')).toHaveJSProperty('naturalWidth',450);
  const opener = gallery.getByRole('button', {name:'사진 영수증.png 원본 보기'});
  // Playwright가 버튼을 화면으로 옮기는 스크롤이 아닌, 실제 클릭 직전 위치와 비교한다.
  await opener.evaluate(el => el.addEventListener('click', () => el.setAttribute('data-scroll-before', String(scrollY)), {once:true}));
  await opener.click();
  const scrollBefore = Number(await opener.getAttribute('data-scroll-before'));
  const dialog = page.getByRole('dialog', {name:'영수증 보기'});
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('img')).toHaveJSProperty('naturalWidth',450);
  await expect(dialog.getByRole('button', {name:'이전 영수증'})).toBeDisabled();
  await expect(dialog.getByRole('button', {name:'닫기',exact:true})).toBeFocused();
  expect(await page.evaluate(() => scrollY)).toBe(scrollBefore);
  expect(await new AxeBuilder({page}).include('dialog').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze().then(result => result.violations)).toEqual([]);
  expect(await dialog.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({path:'test-results/receipt-viewer-' + width + '.png'});
  await dialog.getByRole('button', {name:'다음 영수증'}).click();
  await expect(dialog.getByTitle('영수증 PDF 원본')).toHaveAttribute('src', /blob:.*#page=1/);
  await expect(dialog.getByRole('status')).toHaveText('2 / 2');
  await expect(dialog.getByRole('button', {name:'다음 영수증'})).toBeDisabled();
  await dialog.getByRole('button', {name:'이전 영수증'}).click();
  await expect(dialog.getByRole('img')).toHaveJSProperty('naturalWidth',450);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  await expect(page.getByLabel('사용 목적')).toHaveValue('입력 중인 내용 유지');
  expect(apiCalls).toBe(2);
});
test('실패 이유를 보여주고 저장한 원본으로 재분석한다', async ({page}) => {
  await setup(page);
  let calls = 0;
  await page.route('**/__test_receipt_ai', route => { calls++; return calls === 1 ? route.fulfill({status:429,json:{error:'AI 사용 한도 또는 결제 설정을 확인해 주세요.'}}) : route.fulfill({json:{receipts:[receipt]}}); });
  await page.getByRole('button', {name:'영수증 등록',exact:true}).click();
  await page.getByRole('checkbox', {name:/OpenAI/}).check();
  await page.getByLabel('영수증 증빙 파일').setInputFiles(file());
  await expect(page.getByRole('alert')).toContainText('AI 사용 한도');
  await page.getByRole('button', {name:'재분석',exact:true}).click();
  await expect(page.getByLabel('금액', {exact:true})).toHaveValue('32500');
  expect(calls).toBe(2);
});
test('수정 초안을 새로고침 후 복원하고 복수 후보를 중복 없이 반영한다', async ({page}) => {
  await setup(page,[receipt,{...receipt,merchant:'테스트 서점',amount:18000,page:2}]);
  await startUpload(page);
  await page.getByLabel('사용 목적').fill('저장된 초안');
  await page.reload();
  await page.getByRole('button', {name:'결과 확인·수정'}).click();
  await expect(page.getByLabel('사용 목적')).toHaveValue('저장된 초안');
  await page.getByRole('button', {name:'이 지출을 장부에 반영'}).click();
  await page.getByRole('button', {name:'결과 확인·수정'}).click();
  await expect(page.getByLabel('사용처', {exact:true})).toHaveValue('테스트 서점');
  await page.getByLabel('사용 목적').fill('학급 도서');
  await page.getByRole('button', {name:'이 지출을 장부에 반영'}).click();
  await expect(page.getByRole('region', {name:'예산 현황'})).toContainText('449,500원');
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(4);
});
for (const width of [1440,390]) test('장부·검토 화면 접근성 및 가로 넘침 ' + width, async ({page}) => {
  await page.setViewportSize({width,height:900});
  await setup(page);
  await startUpload(page);
  // Chrome 내장 PDF 뷰어의 문서 제목/랜드마크는 앱 소유 영역이 아니다. WCAG A/AA를 검사한다.
  const violations = (await new AxeBuilder({page}).include('main').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations;
  expect(violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({path:'test-results/receipt-review-' + width + '.png',fullPage:true});
  await page.getByLabel('사용 목적').fill('학급 미술 재료');
  await page.getByRole('button', {name:'이 지출을 장부에 반영'}).click();
  await page.screenshot({path:'test-results/receipt-ledger-' + width + '.png',fullPage:true});
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => { scrollTo(0,document.documentElement.scrollHeight); return innerHeight - document.getElementById('root')!.firstElementChild!.getBoundingClientRect().bottom; })).toBeLessThanOrEqual(1);
});
