import { defineConfig, devices } from '@playwright/test';

const testPort = process.env.PLAYWRIGHT_TEST_PORT ?? '4173';
const testUrl = `http://127.0.0.1:${testPort}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  outputDir: process.env.PLAYWRIGHT_OUTPUT_DIR || './test-results/e2e',
  timeout: 60_000,
  expect: {
    timeout: 8_000,
  },
  reporter: [['list'], ['html', { open: 'never', outputFolder: process.env.PLAYWRIGHT_REPORT_DIR || 'playwright-report' }]],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: testUrl,
    channel: 'chrome',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${testPort} --strictPort`,
    env: {
      // 원격 형태의 테스트는 Playwright가 요청을 가로챈다. 운영 설정을 읽지 않는다.
      VITE_SUPABASE_URL: process.env.SPECIAL_ROOMS_SQL_URL || 'https://schooldoc-e2e.invalid',
      VITE_SUPABASE_ANON_KEY: 'fixture-public-anon-key',
      VITE_REGISTRY_DEMO_MODE: 'true',
      VITE_STUDENT_RESULTS_DEMO_MODE: 'true',
      VITE_CONSENT_FORMS_DEMO_MODE: 'true',
      VITE_SPECIAL_ROOMS_DEMO_MODE: process.env.SPECIAL_ROOMS_SQL_URL ? 'false' : 'true',
      VITE_CLASSROOM_ROLES_DEMO_MODE: 'true',
      VITE_CLASS_MISSIONS_DEMO_MODE: 'true',
      VITE_PUBLIC_APP_URL: testUrl,
    },
    url: `${testUrl}/tools/registry-sign`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
