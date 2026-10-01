import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '../../../tests/e2e',
  testMatch: 'data-collect.spec.ts',
  workers: 1, fullyParallel: false, timeout: 60000,
  expect: { timeout: 8000 },
  outputDir: './evidence/e2e-results',
  reporter: [['list']],
  use: { channel: 'chrome', baseURL: 'http://127.0.0.1:4183', timezoneId: 'Asia/Seoul', screenshot: 'only-on-failure', trace: 'retain-on-failure' }
});
// Start only this review's strictPort demo server before running; no webServer/reuse.
