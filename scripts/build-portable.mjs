import { loadEnv } from 'vite';
import { build, Platform, Arch } from 'electron-builder';
import { spawnSync, execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const root = process.cwd();
if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Windows x64 build host required');
const env = loadEnv('production', process.env.SCHOOLDOC_ENV_DIR ?? root, 'VITE_');
const connection = {
  VITE_SUPABASE_URL: env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY,
  VITE_PUBLIC_APP_URL: env.VITE_PUBLIC_APP_URL || 'https://schooldoc-nine.vercel.app',
};
for (const name of ['VITE_SUPABASE_URL', 'VITE_PUBLIC_APP_URL']) {
  const url = new URL(connection[name] || '');
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error(`${name}: public HTTPS URL required`);
  connection[name] = url.origin;
}
const key = connection.VITE_SUPABASE_ANON_KEY || '';
if (key.startsWith('sb_secret_') || !key || key.includes('your_supabase')) throw new Error('Public anon/publishable key required');
if (key.split('.').length === 3) {
  const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
  if (claims.role !== 'anon') throw new Error('Server credential must not enter the desktop bundle');
} else if (!key.startsWith('sb_publishable_')) throw new Error('Unrecognized public key format');
const childEnv = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('VITE_')));
Object.assign(childEnv, connection);
for (const [script, args] of [
  // Electron 44부터 npm 설치와 바이너리 설치가 분리되어 있다.
  ['node_modules/electron/install.js', []],
  ['node_modules/typescript/bin/tsc', ['-b']],
  ['node_modules/vite/bin/vite.js', ['build', '--mode', 'portable']],
]) {
  const run = spawnSync(process.execPath, [script, ...args], { cwd: root, env: childEnv, stdio: 'inherit' });
  if (run.status !== 0) throw new Error(`Build command failed: ${script}`);
}
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const dirty = Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim());
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const info = { version, commit, dirty, supabaseUrl: connection.VITE_SUPABASE_URL, publicAppUrl: connection.VITE_PUBLIC_APP_URL };
await writeFile('dist-portable/desktop-build.json', JSON.stringify(info, null, 2) + '\n');
const artifactName = `SchoolDoc_Portable_${version}_${commit.slice(0, 12)}.exe`;
const files = await build({ targets: Platform.WINDOWS.createTarget('portable', Arch.x64),
  config: { electronDist: path.join(root, 'node_modules/electron/dist'), portable: { artifactName } }, publish: 'never' });
const executable = files.find(file => path.basename(file) === artifactName);
if (!executable) throw new Error('Portable executable missing');
const bytes = await readFile(executable);
const sha256 = createHash('sha256').update(bytes).digest('hex');
await mkdir('release', { recursive: true });
await writeFile('release/SHA256SUMS.txt', `${sha256}  ${artifactName}\n`);
await writeFile('release/portable-manifest.json', JSON.stringify({ ...info, artifactName, size: bytes.length, sha256 }, null, 2) + '\n');
console.log(`Portable built: ${artifactName} (${bytes.length} bytes), commit ${commit}, dirty=${dirty}`);
