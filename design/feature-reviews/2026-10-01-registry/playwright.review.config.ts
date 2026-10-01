import { defineConfig } from '@playwright/test';

// 전용 서버를 명시적으로 시작한 뒤 실행한다. 공유 4173 서버는 사용하지 않는다.
export default defineConfig({
  testDir: '../../../tests/e2e',
  testMatch: /registry-(sign|accessibility)\.spec\.ts/,
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 8_000 },
  outputDir: './evidence/e2e-artifacts',
  reporter: [['list'], ['json', { outputFile: './evidence/e2e-results.json' }]],
  use: {
    channel: 'chrome',
    baseURL: process.env.REGISTRY_REVIEW_URL ?? 'http://127.0.0.1:4182',
    viewport: { width: 1366, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'off',
  },
});
