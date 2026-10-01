import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { realpathSync } from 'node:fs';
import path from 'node:path';
export default defineConfig({
  plugins: [react()],
  cacheDir: '.vite-integration.local',
  // Mocked API E2E needs a configured client; the reserved .invalid host prevents real data access.
  define: Object.fromEntries([
    ['import.meta.env.VITE_SUPABASE_URL', JSON.stringify('https://integration-fixture.invalid')],
    ['import.meta.env.VITE_SUPABASE_ANON_KEY', JSON.stringify('fictional-integration-anon-key')],
    ...['REGISTRY','STUDENT_RESULTS','CONSENT_FORMS','DATA_COLLECT','SPECIAL_ROOMS','CLASSROOM_ROLES','CLASS_MISSIONS'].map(name => [`import.meta.env.VITE_${name}_DEMO_MODE`, JSON.stringify('true')]),
    ['import.meta.env.VITE_PUBLIC_APP_URL', JSON.stringify('http://127.0.0.1:4281')],
  ]),
  server: { host: '127.0.0.1', port: 4281, strictPort: true, fs: { allow: [process.cwd(), realpathSync(path.resolve('node_modules'))] } },
});
