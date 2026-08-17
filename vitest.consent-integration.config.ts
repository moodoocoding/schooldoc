import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/consent-forms.remote.test.ts'],
    testTimeout: 60_000,
    fileParallelism: false,
  },
});
