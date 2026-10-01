import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {realpathSync} from 'node:fs';
import path from 'node:path';
export default defineConfig({plugins:[react()],server:{host:'127.0.0.1',port:4181,strictPort:true,fs:{allow:[process.cwd(),realpathSync(path.resolve('node_modules'))]}},cacheDir:path.resolve('design/feature-reviews/2026-10-01-consent/.vite-cache')});
