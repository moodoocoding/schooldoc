import { defineConfig, devices } from '@playwright/test';

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
    baseURL: 'http://127.0.0.1:4173',
    channel: 'chrome',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    env: {
      VITE_REGISTRY_DEMO_MODE: 'true',
      VITE_STUDENT_RESULTS_DEMO_MODE: 'true',
      VITE_CONSENT_FORMS_DEMO_MODE: 'true',
      VITE_SPECIAL_ROOMS_DEMO_MODE: 'true',
      VITE_PUBLIC_APP_URL: 'http://127.0.0.1:4173',
    },
    url: 'http://127.0.0.1:4173/tools/registry-sign',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
