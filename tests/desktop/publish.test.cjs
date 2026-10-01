const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const path = require('node:path');
const os = require('node:os');

const hash = content => createHash('sha256').update(content).digest('hex');
const sha = 'a'.repeat(40);
async function fixture(t, options = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'schooldoc-release-test-'));
  const artifactName = 'SchoolDoc_Portable_1.0.1_aaaaaaaaaaaa.exe';
  const bytes = Buffer.from('fictional exe');
  const manifest = { commit: sha, version: '1.0.1', artifactName, dirty: false, sha256: hash(bytes), size: bytes.length, ...options };
  const smokePath = path.join(directory, 'portable-smoke.json');
  const files = { [artifactName]: bytes, 'portable-manifest.json': JSON.stringify(manifest),
    'SHA256SUMS.txt': `${hash(bytes)}  ${artifactName}\n`,
    'portable-smoke.json': JSON.stringify({ commit: sha, sha256: hash(bytes), success: true }) };
  for (const [name, content] of Object.entries(files)) await fs.writeFile(path.join(directory, name), content);
  t.after(async () => {
    assert.ok(directory.startsWith(path.join(os.tmpdir(), 'schooldoc-release-test-')));
    for (const name of [...Object.keys(files), 'release-notes.md']) await fs.rm(path.join(directory, name), { force: true });
    await fs.rmdir(directory);
  });
  const calls = [];
  let release, tagExists = false, main = sha;
  const missing = () => { const error = new Error('Not Found'); error.stderr = '404'; throw error; };
  const gh = args => {
    calls.push(args);
    if (args[0] === 'api') {
      if (args[1].endsWith('/branches/main')) return JSON.stringify({ commit: { sha: main } });
      if (args[1].includes('/git/ref/tags/')) return tagExists ? JSON.stringify({ object: { type: 'commit', sha } }) : missing();
      return release ? JSON.stringify(release) : missing();
    }
    if (args[1] === 'create') release = { draft: true, target_commitish: sha, assets: [], html_url: 'https://example.invalid/release' };
    if (args[1] === 'upload') {
      const content = readFileSync(args[3]);
      release.assets.push({ name: path.basename(args[3]), size: content.length, digest: `sha256:${hash(content)}` });
    }
    if (args[1] === 'edit') { release.draft = false; release.prerelease = args.includes('--prerelease=true'); tagExists = true; }
    return '';
  };
  const { publishPortable } = await import('../../scripts/publish-portable.mjs');
  return { publish: (extra = {}) => publishPortable({ directory, smokePath, gh, repo: 'example/test', ...extra }),
    calls, setMain: value => { main = value; }, getRelease: () => release, directory, gh };
}

test('dirty and mismatched checksums cannot reach GitHub', async t => {
  const f = await fixture(t, { dirty: true });
  await assert.rejects(f.publish(), /Clean commit/);
  assert.equal(f.calls.length, 0);
});
test('stable publication refuses a different main; candidate remains allowed', async t => {
  const f = await fixture(t); f.setMain('b'.repeat(40));
  await assert.rejects(f.publish(), /current main/);
  assert.ok(f.calls.every(call => call[0] === 'api'));
  await f.publish({ candidate: true });
  assert.equal(f.getRelease().prerelease, true);
});
test('publication checks all four assets and a repeat performs no mutations', async t => {
  const f = await fixture(t); await f.publish();
  assert.equal(f.getRelease().assets.length, 4);
  f.calls.length = 0; await f.publish();
  assert.ok(f.calls.every(call => call[0] === 'api'));
  f.getRelease().assets.find(asset => asset.name === 'portable-smoke.json').digest = 'sha256:wrong';
  await assert.rejects(f.publish(), /asset mismatch/);
});
test('main advancing during upload retains the draft', async t => {
  const f = await fixture(t);
  await assert.rejects(f.publish({ gh: args => {
    const result = f.gh(args);
    if (args[0] === 'release' && args[1] === 'upload') f.setMain('b'.repeat(40));
    return result;
  } }), /Main advanced/);
  assert.equal(f.getRelease().draft, true);
  assert.ok(!f.calls.some(call => call[1] === 'edit'));
});
test('changed checksum text is rejected before remote calls', async t => {
  const f = await fixture(t); await fs.writeFile(path.join(f.directory, 'SHA256SUMS.txt'), 'incorrect');
  await assert.rejects(f.publish(), /matching checksum/);
  assert.equal(f.calls.length, 0);
});
