import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { jsPDF } from 'jspdf';
import fs from 'node:fs/promises';
import path from 'node:path';
const root = 'design/feature-reviews/2026-10-01-consent';
const ev = path.join(root, 'evidence');
const base = 'http://127.0.0.1:4181';
const id = '11111111-1111-4111-8111-111111111111';
const token = '22222222-2222-4222-8222-222222222222';
const recipientToken = '33333333-3333-4333-8333-333333333333';
const pdf = new jsPDF();
pdf.text('School notice - fictional consent review', 20, 25);
pdf.text('YES', 48, 93);
pdf.rect(42, 89.1, 4.2, 4.2);
pdf.text('NO', 90, 93);
pdf.rect(84, 89.1, 4.2, 4.2);
pdf.text('Guardian:', 20, 122);
pdf.rect(42, 118.8, 63, 18);
pdf.addPage();
pdf.text('Page 2 - additional notice and signature', 20, 25);
pdf.rect(42, 118.8, 63, 25);
const buffer = Buffer.from(pdf.output('arraybuffer'));
const source = pdf.output('datauristring');
const choice = { id: 'agreement', label: '참가 동의 여부', mode: 'single', required: true, minSelections: 1 };
const fields = [{ id: 'yes', kind: 'checkbox', label: '예', required: false, choice, pageIndex: 0, x: 20, y: 30, width: 2, height: 1.414 }, { id: 'no', kind: 'checkbox', label: '아니오', required: false, choice, pageIndex: 0, x: 40, y: 30, width: 2, height: 1.414 }, { id: 'name', kind: 'text', label: '보호자 성명', required: true, pageIndex: 0, x: 20, y: 40, width: 30, height: 6 }, { id: 'sign', kind: 'signature', label: '보호자 서명', required: true, pageIndex: 1, x: 20, y: 40, width: 30, height: 8 }];
const draft = { id, title: '가상 3학년 현장체험학습 참가 동의서', fileName: 'fictional-notice.pdf', fields, fieldCount: 4, recipientMode: 'named', recipientCount: 24, publicToken: token, status: 'open', deadline: '', passwordEnabled: false, passwordHash: '', allowResubmission: true, responseCount: 9, description: '가상 자료로 검토하는 동의서입니다.', pageCount: 2, pageSizes: [{ width: 210, height: 297 }, { width: 210, height: 297 }], sourcePdfDataUrl: source, sourcePath: 'owner/review/source.pdf', createdAt: '2026-10-01T00:00:00Z', retentionMonths: 12 };
const responses = Array.from({ length: 9 }, (_, i) => ({ id: `response-${i}`, recipientId: `student-${i === 0 ? 0 : i - 1}`, submittedAt: '2026-10-01T01:00:00Z', values: { name: '가상보호자', yes: i === 0 ? 'true' : '', no: i === 0 ? '' : 'true' } }));
const recipients = Array.from({ length: 24 }, (_, i) => ({ id: `student-${i}`, name: i === 13 ? '가상학생아주긴이름반응형확인' : '가상학생' + (i + 1), studentKey: `3학년 2반 ${i + 1}번`, token: i === 0 ? recipientToken : `44444444-4444-4444-8444-${String(i).padStart(12, '0')}`, responseId: i < 8 ? `response-${i + 1}` : null, submittedAt: i < 8 ? '2026-10-01T01:00:00Z' : null }));
const row = { id, public_token: token, title: draft.title, file_name: draft.fileName, source_path: draft.sourcePath, description: draft.description, fields, page_count: 2, page_sizes: draft.pageSizes, retention_months: 12, recipient_mode: 'named', recipient_count: 24, deadline: null, password_digest: null, allow_resubmission: true, response_count: 9, status: 'open', closed_at: null, created_at: draft.createdAt };
const result = { chrome: '', checks: [], observations: [], errors: [], blocked: [] };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
result.chrome = browser.version();
async function context(size = { width: 1366, height: 900 }) { const c = await browser.newContext({ viewport: size, acceptDownloads: true }); c.on('page', p => p.on('pageerror', e => result.observations.push({ name: 'pageerror', message: e.message }))); await c.route('**/*', r => { let u = new URL(r.request().url()); if (['127.0.0.1', 'localhost'].includes(u.hostname) || ['data:', 'blob:'].includes(u.protocol))
    return r.continue(); result.blocked.push(u.origin + u.pathname); return r.abort(); }); return c; }
async function shot(p, name) { await p.screenshot({ path: path.join(ev, name + '.png'), fullPage: true }); }
async function axe(p, name) { const a = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa']).analyze(); await fs.writeFile(path.join(ev, name + '-axe.json'), JSON.stringify(a.violations, null, 2)); result.checks.push({ name: name + ' axe', violations: a.violations.map(x => ({ id: x.id, nodes: x.nodes.length })) }); }
async function download(p, button, name) { const wait = p.waitForEvent('download'); await button.click(); const d = await wait; await d.saveAs(path.join(ev, name)); return d.suggestedFilename(); }
async function remote(c, { failUpdate = false, failRecipients = false, submitted = false, allowResubmission = true, count = 24 } = {}) {
    const calls = [];
    await c.route('**/src/utils/supabaseClient.ts*', async (r) => { const response = await r.fetch(); await r.fulfill({ response, body: (await response.text()).replaceAll('127.0.0.1:9', '127.0.0.1:54321') }); });
    await c.route('**/src/features/consentForms/consentFormsConfig.ts*', r => r.fulfill({ contentType: 'application/javascript', body: "export const isConsentFormsDemoMode=false; export {getPublicAppOrigin as getConsentPublicOrigin} from '/src/utils/publicAppOrigin.ts';" }));
    await c.addInitScript(() => location.hostname === '127.0.0.1' && localStorage.setItem('sb-127-auth-token', JSON.stringify({ access_token: 'fictional-review-access-token', refresh_token: 'fictional-review-refresh-token', expires_at: 4102444800, expires_in: 3600, token_type: 'bearer', user: { user_metadata: {}, id: '55555555-5555-4555-8555-555555555555' } })));
    await c.route('http://127.0.0.1:54321/**', async (r) => {
        const req = r.request();
        const u = new URL(req.url());
        const raw = req.postData();
        const body = raw?.trim().startsWith('{') ? JSON.parse(raw) : {};
        calls.push({ path: u.pathname, method: req.method(), body });
        let status = 200, data = {};
        if (u.pathname === '/auth/v1/user')
            data = { id: '55555555-5555-4555-8555-555555555555', user_metadata: {} };
        else if (u.pathname.includes('functions/v1/consent-forms-public')) {
            if (body.action === 'submit') {
                data = submitted && !allowResubmission ? { error: '이미 제출한 가정통신문입니다. 담당자에게 문의해 주세요.' } : { submitted: true };
                status = submitted && !allowResubmission ? 409 : 200;
            }
            else
                data = { form: { title: draft.title, description: draft.description, status: 'open', deadline: '', passwordRequired: false, recipientHint: '가○○', recipientName: '가상학생1', recipientSubmitted: submitted, ...body.action === 'document' ? { fields, sourceUrl: source, allowResubmission, pageCount: 2, pageSizes: draft.pageSizes } : {} } };
        }
        else if (u.pathname.includes('functions/v1/consent-forms-admin')) {
            if (body.action === 'list') {
                data = { recipients: Array.from({ length: count }, (_, i) => recipients[i] ?? { id: `student-${i}`, name: `가상학생${i + 1}`, studentKey: `3학년 2반 ${i + 1}번`, token: `44444444-4444-4444-8444-${String(i).padStart(12, '0')}`, responseId: null, submittedAt: null }) };
            }
            else if (body.action === 'responses')
                data = { responses };
            else if (body.action === 'replace') {
                status = failRecipients ? 503 : 200;
                data = failRecipients ? { error: '수신자 명단 암호화 키가 설정되지 않아 명단 기능을 쓸 수 없습니다.' } : { saved: body.recipients.length };
            }
        }
        else if (u.pathname === '/rest/v1/consent_forms') {
            if (req.method() === 'PATCH' && failUpdate) {
                status = 500;
                data = { message: '가상 저장 오류', code: 'REVIEW' };
            }
            else
                data = { ...row, ...body };
        }
        else if (u.pathname.includes('/storage/v1/object/sign/'))
            data = { signedURL: '/source.pdf' };
        else if ((u.pathname.endsWith('/source.pdf') && req.method() === 'GET'))
            return r.fulfill({ contentType: 'application/pdf', body: buffer });
        else if (req.method() === 'POST' && u.pathname.includes('/storage/'))
            data = { Key: 'owner/review/source.pdf' };
        else if (u.pathname.includes('teacher_profiles'))
            data = [];
        else
            data = [];
        await r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    });
    return calls;
}
async function run(name, fn) { try {
    await fn();
    result.checks.push({ name, status: 'completed' });
}
catch (e) {
    result.errors.push({ name, error: e.stack });
    console.log(name + ' FAILED ' + e.message);
    for (const c of browser.contexts())
        for (const p of c.pages()) {
            await shot(p, 'failure-' + name.replaceAll(/[^a-z]/g, '-')).catch(() => { });
            result.observations.push({ name: 'failure body ' + name, text: await p.locator('body').innerText().catch(() => '') });
        }
}
finally {
    await fs.writeFile(path.join(ev, 'browser-observations.json'), JSON.stringify(result, null, 2));
} }
await run('authoring, roster and demo workflow', async () => { const c = await context(); const p = await c.newPage(); await p.goto(base + '/tools/consent-forms/new'); await p.getByLabel('가정통신문 PDF 파일').setInputFiles({ name: 'fictional-notice.pdf', mimeType: 'application/pdf', buffer }); await p.getByRole('textbox', { name: '제목', exact: true }).fill(draft.title); await shot(p, 'author-document'); await p.getByRole('button', { name: '확인 후 필드 배치' }).click(); await p.getByRole('button', { name: '텍스트', exact: true }).click(); await p.getByLabel('표시 이름').fill('보호자 성명'); await p.getByLabel('가로 위치', { exact: true }).fill('20'); await p.getByLabel('세로 위치', { exact: true }).fill('40'); await p.getByLabel('쪽 번호').fill('2'); await p.getByRole('button', { name: '서명', exact: true }).click(); await p.getByLabel('표시 이름').fill('보호자 서명'); await shot(p, 'author-field-page2'); await p.getByRole('button', { name: '필드 배치 완료' }).click(); await shot(p, 'author-roster-empty'); await p.evaluate(async () => { const { defaultRoleState, parseRoleRoster } = await import('/supabase/functions/_shared/classroomRoles.ts'); localStorage.setItem('schooldoc_classroom_roles_demo_v1', JSON.stringify({ id: 'fictional-class', version: 1, public_token: 'fictional-token', state: { ...defaultRoleState(), roster: parseRoleRoster(Array.from({ length: 24 }, (_, i) => `${i + 1} 가상학생${i + 1}`).join('\n')) } })); }); await p.getByRole('button', { name: '우리반 불러오기' }).click(); await p.getByRole('button', { name: '우리반 불러오기' }).click(); await expect(p.getByRole('status')).toContainText('중복 24명 제외'); await shot(p, 'author-roster-24'); await p.getByRole('button', { name: '다음: 공유 설정' }).click(); await p.getByLabel('제출 후 수정 허용').check(); await p.getByRole('button', { name: '수합 만들기' }).click(); await p.getByRole('button', { name: '관리·공유' }).click(); await shot(p, 'demo-named-manage'); result.observations.push({ name: 'demo named unsupported', text: await p.locator('body').innerText() }); await c.close(); });
await run('guardian desktop/mobile, review and exports', async () => { const c = await context(); const p = await c.newPage(); await p.goto(base); await p.evaluate(d => localStorage.setItem('schooldoc:consent-forms:drafts', JSON.stringify([d])), draft); await p.goto(base + '/s/consent/' + token); await expect(p.locator('[data-pdf-state="ready"]')).toHaveCount(2); await shot(p, 'guardian-desktop-empty'); await p.getByRole('button', { name: '응답 확인', exact: true }).click(); await expect(p.getByRole('alert')).toContainText('선택'); await p.getByRole('radio', { name: '아니오', exact: true }).check(); await p.getByRole('textbox', { name: '보호자 성명' }).fill('가상보호자'); await p.getByRole('button', { name: '보호자 서명 작성', exact: true }).click(); const box = await p.getByRole('dialog').locator('canvas').boundingBox(); await p.mouse.move(box.x + 20, box.y + 40); await p.mouse.down(); await p.mouse.move(box.x + 100, box.y + 70, { steps: 10 }); await p.mouse.up(); await p.getByRole('button', { name: '서명 적용' }).click(); await p.setViewportSize({ width: 390, height: 844 }); await p.getByRole('button', { name: '보호자 성명 입력 위치' }).click(); await expect(p.getByRole('textbox', { name: '보호자 성명' })).toHaveValue('가상보호자'); await shot(p, 'guardian-mobile-input'); await p.keyboard.press('Escape'); await p.getByRole('button', { name: '아니오 입력 위치' }).click(); await expect(p.getByRole('radio', { name: '아니오', exact: true })).toBeChecked(); await p.getByRole('button', { name: '입력창 닫고 원본 보기' }).click(); await p.getByRole('button', { name: '응답 확인' }).click(); await shot(p, 'guardian-mobile-review'); await axe(p, 'guardian-mobile'); await p.evaluate(() => document.documentElement.style.fontSize = '200%'); await shot(p, 'guardian-mobile-200'); result.checks.push({ name: 'guardian 200%', overflow: await p.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth })) }); await p.evaluate(() => document.documentElement.style.fontSize = ''); await p.getByRole('button', { name: '작성 완료' }).click(); await expect(p.getByRole('heading', { name: '응답을 제출했습니다' })).toBeVisible(); await shot(p, 'guardian-submitted'); await p.setViewportSize({ width: 1366, height: 900 }); await p.goto(base + '/tools/consent-forms/' + id); await shot(p, 'demo-manage-submitted'); await download(p, p.getByRole('button', { name: 'QR 이미지 저장', exact: true }), 'public-qr.png'); await download(p, p.getByRole('button', { name: '결과 표(xlsx)' }), 'demo-responses.xlsx'); await download(p, p.getByRole('button', { name: '전체 PDF 내려받기' }), 'response.pdf'); await c.close(); });
await run('remote component fixture: mixed roster and re-submission association', async () => { const c = await context(); const calls = await remote(c); const p = await c.newPage(); await p.goto(base + '/tools/consent-forms/' + id); await expect(p.getByRole('region', { name: '명단 제출 현황' })).toBeVisible(); await shot(p, 'manage-24-mixed'); await axe(p, 'manage-24'); const responseText = await p.getByRole('region', { name: '받은 응답' }).innerText(); await download(p, p.getByRole('button', { name: '결과 표(xlsx)' }), 'remote-fixture-responses.xlsx'); result.observations.push({ name: 'resubmission association', responseText, firstResponse: responses[0], currentRecipient: recipients[0] }); await p.getByRole('button', { name: '미제출', exact: true }).click(); await expect(p.getByRole('region', { name: '명단 제출 현황' }).locator('li')).toHaveCount(16); await p.getByRole('textbox', { name: '이름 또는 식별값으로 찾기' }).fill('가상학생14'); await shot(p, 'manage-search-empty'); await p.setViewportSize({ width: 390, height: 844 }); await p.getByRole('textbox', { name: '이름 또는 식별값으로 찾기' }).fill(''); await shot(p, 'manage-mobile'); await p.evaluate(() => document.documentElement.style.fontSize = '200%'); await shot(p, 'manage-mobile-200'); await p.screenshot({ path: path.join(ev, 'manage-mobile-200-viewport.png') }); result.observations.push({ name: '200% clipped controls', elements: await p.locator('button,input').evaluateAll(els => els.map(el => ({ name: el.getAttribute('aria-label') || el.textContent || el.value, box: el.getBoundingClientRect().toJSON() })).filter(e => e.box.right > innerWidth)) }); result.checks.push({ name: 'manage 200%', overflow: await p.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth })) }); await p.evaluate(() => document.documentElement.style.fontSize = ''); await p.setViewportSize({ width: 1366, height: 900 }); await p.getByRole('button', { name: '응답 링크 재발급' }).click(); await p.keyboard.press('Escape'); await expect(p.getByRole('alertdialog')).toHaveCount(0); result.checks.push({ name: 'dialog Escape focus', active: await p.evaluate(() => document.activeElement?.getAttribute('aria-label')) }); await fs.writeFile(path.join(ev, 'mock-manage-calls.json'), JSON.stringify(calls, null, 2)); await c.close(); });
await run('remote component fixture: settings and close errors', async () => { const c = await context(); const calls = await remote(c, { failUpdate: true }); const p = await c.newPage(); const errors = []; p.on('pageerror', e => errors.push(e.message)); await p.goto(base + '/tools/consent-forms/' + id); await p.getByRole('button', { name: '설정 수정' }).click(); await p.getByRole('textbox', { name: '제목', exact: true }).fill('저장 실패 후 남은 제목'); await p.getByRole('button', { name: '설정 저장' }).click(); await p.waitForTimeout(500); await shot(p, 'settings-save-failure'); const alerts = await p.getByRole('alert').allTextContents(); await p.getByRole('button', { name: '수합 종료', exact: true }).click(); await p.waitForTimeout(500); result.observations.push({ name: 'unhandled setting/status errors', errors, alerts, calls: calls.filter(x => x.method === 'PATCH') }); await c.close(); });
await run('already submitted personal link', async () => { const c = await context(); const calls = await remote(c, { submitted: true, allowResubmission: false }); const p = await c.newPage(); await p.goto(base + '/s/consent/' + token + '?r=' + recipientToken); await expect(p.locator('[data-pdf-state="ready"]')).toHaveCount(2); await shot(p, 'already-submitted-blank'); result.observations.push({ name: 'already submitted fields enabled', text: await p.locator('body').innerText(), inputStartDisabled: await p.getByRole('button', { name: '입력 시작' }).isDisabled(), guardianValue: await p.getByRole('textbox', { name: '보호자 성명' }).inputValue(), calls }); await c.close(); });
await run('QR sheets PDF and print', async () => { const c = await context(); await remote(c); const p = await c.newPage(); await p.goto(base + '/tools/consent-forms/' + id + '/qr'); await expect(p.getByTestId('consent-qr-page')).toHaveCount(3); await shot(p, 'qr-24-preview'); await download(p, p.getByRole('button', { name: '가상학생1 QR 이미지 저장', exact: true }), 'personal-qr.png'); await download(p, p.getByRole('button', { name: 'PDF 다운로드', exact: true }), 'personal-qr-sheet.pdf'); await p.emulateMedia({ media: 'print' }); const visibility = await p.getByTestId('consent-qr-page').first().evaluate(el => getComputedStyle(el).visibility); await p.pdf({ path: path.join(ev, 'personal-qr-browser-print.pdf'), format: 'A4', printBackground: true }); await shot(p, 'qr-print-media'); result.observations.push({ name: 'browser print', visibility }); await c.close(); });
await run('named create despite roster save failure', async () => { const c = await context(); const calls = await remote(c, { failRecipients: true }); const p = await c.newPage(); await p.goto(base + '/tools/consent-forms/new'); await p.getByLabel('가정통신문 PDF 파일').setInputFiles({ name: 'fixture.pdf', mimeType: 'application/pdf', buffer }); await p.getByRole('textbox', { name: '제목', exact: true }).fill('명단 저장 실패 시험'); await p.getByRole('button', { name: '확인 후 필드 배치' }).click(); await p.getByRole('button', { name: '텍스트', exact: true }).click(); await p.getByRole('button', { name: '필드 배치 완료' }).click(); await p.getByLabel('이름 (필수)').fill('가상학생'); await p.getByRole('button', { name: '추가', exact: true }).click(); await p.getByRole('button', { name: '다음: 공유 설정' }).click(); await p.getByRole('button', { name: '수합 만들기' }).click(); await p.waitForTimeout(700); await shot(p, 'named-create-roster-save-failure'); result.observations.push({ name: 'named roster failure silently continues', url: p.url(), alerts: await p.getByRole('alert').allTextContents(), calls: calls.filter(x => x.method === 'POST' || x.method === 'PATCH') }); await c.close(); });
await run('roster 60 and empty remote fixture', async () => { for (const count of [0, 60]) {
    const c = await context();
    await remote(c, { count });
    const p = await c.newPage();
    await p.goto(base + '/tools/consent-forms/' + id);
    await p.getByRole('heading', { name: draft.title, exact: true }).waitFor();
    await shot(p, 'manage-' + count);
    if (count === 60) {
        await p.setViewportSize({ width: 390, height: 844 });
        await shot(p, 'manage-60-mobile');
        await p.evaluate(() => document.documentElement.style.fontSize = '200%');
        await shot(p, 'manage-60-mobile-200');
    }
    await c.close();
} });
await browser.close();
await fs.writeFile(path.join(ev, 'browser-observations.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ checks: result.checks, observations: result.observations.map(x => x.name), errors: result.errors }, null, 2));
