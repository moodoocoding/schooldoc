// Isolated fictional profile; no personal Chrome profile or remote data is used.
import { chromium, expect } from '@playwright/test';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

const base = 'http://127.0.0.1:4177';
const output = resolve('design/feature-reviews/2026-10-01-class-missions-fixes/evidence');
const profile = await mkdtemp(resolve(tmpdir(), 'mission-zoom-'));
await mkdir(resolve(profile, 'Default'));
// Chrome host zoom prefs: log(2)/log(1.2) gives an actual 200% page zoom.
// The default storage partition encodes its empty relative path as x.
await writeFile(resolve(profile, 'Default/Preferences'), JSON.stringify({ partition: {
  default_zoom_level: { 'x': Math.log(2) / Math.log(1.2) },
  per_host_zoom_levels: { 'x': { '127.0.0.1': { zoom_level: Math.log(2) / Math.log(1.2), last_modified: String(Date.now() * 1000) } } },
} }));
const context = await chromium.launchPersistentContext(profile, { channel: 'chrome', viewport: null,
  args: ['--window-size=1366,900'] });
const page = context.pages()[0];
const measurements = [];
try {
  await page.goto(base + '/tools/class-missions');
  await page.evaluate(() => {
    const roster = Array.from({ length: 24 }, (_, i) => ({ id: crypto.randomUUID(), number: i + 1, name: '가상학생' + (i + 1), codeHash: '' }));
    const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
    const mission = { id: crypto.randomUUID(), title: '200% 가상 미션', description: '가상 활동을 마친 뒤 완료해 주세요.', startDate: today, dueDate: today,
      requiresConfirmation: true, status: 'open', targets: roster.map(({ id, number, name }) => ({ id, number, name })), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    localStorage.setItem('schooldoc_class_missions_demo_v1', JSON.stringify([{ id: crypto.randomUUID(), publicToken: '20000000-0000-4000-8000-000000000001', publicEnabled: true, version: 1,
      updatedAt: new Date().toISOString(), state: { className: '가상 확대 학급', roster, missions: [mission],
        checks: roster.slice(0, 4).map((s, i) => ({ missionId: mission.id, studentId: s.id, status: ['reported', 'pending', 'confirmed', 'exempt'][i], updatedAt: new Date().toISOString() })), events: [] } }]));
  });
  await page.reload(); await expect(page.getByRole('region', { name: '미션 현황' })).toBeVisible();
  for (const name of ['teacher', 'student']) {
    if (name === 'student') {
      await page.goto(base + '/s/missions/20000000-0000-4000-8000-000000000001');
      await page.getByRole('textbox', { name: '학생 이름' }).fill('가상학생5');
      await page.getByRole('button', { name: '내 미션 보기' }).click();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('가상학생5의 미션');
    }
    const measured = await page.evaluate(() => ({ innerWidth, innerHeight, outerWidth, devicePixelRatio, cssZoom: getComputedStyle(document.documentElement).zoom, scrollWidth: document.documentElement.scrollWidth }));
    expect(measured.devicePixelRatio).toBeCloseTo(2, 1);
    expect(measured.cssZoom).toBe('1'); expect(measured.scrollWidth).toBeLessThanOrEqual(measured.innerWidth);
    measurements.push({ name, ...measured });
    const cdp = await context.newCDPSession(page); const metrics = await cdp.send('Page.getLayoutMetrics'); const pixels = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { ...metrics.contentSize, scale: 1 } }); await writeFile(resolve(output, name + '-chrome-zoom-200.png'), Buffer.from(pixels.data, 'base64')); await cdp.detach();
  }
  await writeFile(resolve(output, 'real-zoom-results.json'), JSON.stringify({ passed: true, method: 'Chrome persistent profile page zoom, CSS zoom unchanged', measurements }, null, 2));
  console.log(JSON.stringify(measurements));
} finally { await context.close(); }
