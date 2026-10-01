// The shared node_modules junction resolves outside this managed checkout.
// Explicitly allow that dependency directory; do not alter product Vite configuration.
import { createServer } from 'vite';
import path from 'node:path';
import { realpathSync } from 'node:fs';
const port = Number(process.env.PLAYWRIGHT_TEST_PORT ?? 4177);
process.env.VITE_STUDENT_RESULTS_DEMO_MODE = 'true';
process.env.VITE_PUBLIC_APP_URL = 'http://127.0.0.1:' + port;
const server = await createServer({
 cacheDir: path.join(process.env.TEMP ?? process.cwd(), 'schooldoc-student-results-review-vite'),
 server: { host: '127.0.0.1', port, strictPort: true,
  fs: { allow: [process.cwd(), realpathSync('node_modules')] } },
});
await server.listen();
server.printUrls();
