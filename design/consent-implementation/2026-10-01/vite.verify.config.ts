import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {realpathSync,readFileSync} from 'node:fs';
import path from 'node:path';
const config=JSON.parse(readFileSync(path.resolve('design/consent-implementation/2026-10-01/.runtime/local.json'),'utf8'));
export default defineConfig({plugins:[react()],envDir:path.resolve('design/consent-implementation/2026-10-01/.runtime/empty-env'),define:{
 'import.meta.env.VITE_SUPABASE_URL':JSON.stringify('http://127.0.0.1:55434'),
 'import.meta.env.VITE_SUPABASE_ANON_KEY':JSON.stringify(config.anon),
 'import.meta.env.VITE_CONSENT_FORMS_DEMO_MODE':JSON.stringify('false'),
 'import.meta.env.VITE_PUBLIC_APP_URL':JSON.stringify('http://127.0.0.1:4181')
},server:{host:'127.0.0.1',port:4181,strictPort:true,fs:{allow:[process.cwd(),realpathSync(path.resolve('node_modules'))]}},cacheDir:path.resolve('design/consent-implementation/2026-10-01/.vite-cache')});
