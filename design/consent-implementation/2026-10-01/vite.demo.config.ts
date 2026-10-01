import {defineConfig} from 'vite';
import config from './vite.verify.config';
export default defineConfig({...config,define:{...config.define,...Object.fromEntries(['REGISTRY','STUDENT_RESULTS','CONSENT_FORMS','SPECIAL_ROOMS','CLASSROOM_ROLES','CLASS_MISSIONS','DATA_COLLECT'].map(name=>[`import.meta.env.VITE_${name}_DEMO_MODE`,JSON.stringify('true')])), 'import.meta.env.VITE_PUBLIC_APP_URL':JSON.stringify('http://127.0.0.1:4173')},server:{...config.server,port:4173}});
