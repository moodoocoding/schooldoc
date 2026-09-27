import { defineConfig, devices } from '@playwright/test';

const testPort = process.env.PLAYWRIGHT_TEST_PORT ?? '4173';
const testUrl = `http://127.0.0.1:${testPort}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 8_000,
  },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: testUrl,
    channel: 'chrome',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${testPort}`,
    env: {
      VITE_REGISTRY_DEMO_MODE: 'true',
      VITE_STUDENT_RESULTS_DEMO_MODE: 'true',
      VITE_CONSENT_FORMS_DEMO_MODE: 'true',
      VITE_SPECIAL_ROOMS_DEMO_MODE: 'true',
      VITE_CLASSROOM_ROLES_DEMO_MODE: 'true',
      VITE_CLASS_MISSIONS_DEMO_MODE: 'true',
      VITE_PUBLIC_APP_URL: testUrl,
    },
    url: `${testUrl}/tools/registry-sign`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
