import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

// 운영 비로그인/존재하지 않는 공개 링크 검사. 실제 업무 자료를 쓰지 않는다.
const origin = 'https://schooldoc-nine.vercel.app';
const token = '00000000-0000-4000-8000-000000000000';
const out = path.resolve('design/feature-reviews/2026-10-02-integration');
const features = [
  { id: 'consent', name: '가정통신문 수합', admin: '/tools/consent-forms', public: '/s/consent/', error: /가정통신문을 찾을 수 없습니다/ },
  { id: 'registry', name: '등록부 서명', admin: '/tools/registry-sign', public: '/s/registry/', error: /등록부를 찾을 수 없습니다/ },
  { id: 'data', name: '자료 수합', admin: '/tools/data-collect', public: '/s/data/', error: /자료 수합을 찾을 수 없습니다/, retry: '다시 불러오기' },
  { id: 'rooms', name: '특별실 예약', admin: '/tools/special-rooms', public: '/s/rooms/', error: /찾을 수 없|존재하지 않/, retry: '다시 시도' },
];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
let retries = 0;
try {
  for (const viewport of [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'mobile', width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    let pageErrors = [];
    let network = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('response', response => {
      const url = new URL(response.url());
      if (url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/functions/')) {
        network.push({ path: url.pathname, status: response.status() });
      }
    });
    async function record(id, response, screenshot) {
      await page.evaluate(() => document.fonts.ready);
      await page.mouse.move(0, 0);
      const metrics = await page.evaluate(() => ({
        text: document.body.innerText,
        width: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        overlays: document.querySelectorAll('vite-error-overlay, [data-nextjs-dialog], #webpack-dev-server-client-overlay').length,
      }));
      assert.equal(response?.status(), 200, `${id}: frontend status`);
      assert.equal(pageErrors.length, 0, `${id}: page errors`);
      assert.equal(metrics.overlays, 0, `${id}: overlay`);
      assert.ok(metrics.text.trim().length > 0, `${id}: content`);
      assert.ok(metrics.scrollWidth <= metrics.width + 2, `${id}: horizontal overflow`);
      if (screenshot) await page.screenshot({ path: path.join(out, `production-${id}-${viewport.name}.png`), fullPage: true, animations: 'disabled' });
      results.push({ id, viewport: viewport.name, url: page.url(), status: response.status(), pageErrors, api: network, horizontalOverflow: metrics.scrollWidth - metrics.width, text: metrics.text });
      pageErrors = []; network = [];
    }
    let response = await page.goto(origin, { waitUntil: 'networkidle' });
    for (const feature of features) await page.getByRole('heading', { name: feature.name, exact: true }).waitFor();
    await record('home', response, true);
    for (const feature of features) {
      response = await page.goto(origin, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: new RegExp(`^${feature.name} 시작하기`) }).click();
      await page.waitForURL(origin + feature.admin);
      await page.getByRole('button', { name: 'Google로 로그인', exact: true }).waitFor();
      await record(`${feature.id}-auth`, response, feature.id === 'consent');
      response = await page.goto(origin + feature.public + token, { waitUntil: 'networkidle' });
      await page.getByText(feature.error).first().waitFor();
      assert.ok(network.some(item => item.status === 404), `${feature.id}: real API not-found`);
      assert.ok(network.every(item => item.status === 404), `${feature.id}: unexpected API status`);
      if (feature.retry) {
        const previous = network.length;
        await page.getByRole('button', { name: feature.retry, exact: true }).click();
        await page.waitForResponse(response => response.url().includes('.supabase.co/functions/') && response.status() === 404);
        await page.getByText(feature.error).first().waitFor();
        assert.ok(network.length > previous, `${feature.id}: retry request`);
        retries += 1;
      }
      await record(`${feature.id}-public-error`, response, true);
    }
    await context.close();
  }
} finally { await browser.close(); }
const report = { production: origin, browser: 'installed Google Chrome via Playwright channel chrome', checkedAt: new Date().toISOString(), count: results.length, retryChecks: retries, results, limits: '비로그인 탐색과 존재하지 않는 링크의 실제 원격 오류 경로. 로그인 후 생성/제출/Storage/PDF/Realtime/부하는 미검증.' };
await writeFile(path.join(out, 'production-browser.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ count: report.count, retryChecks: retries, pageErrors: 0, production: origin }));

