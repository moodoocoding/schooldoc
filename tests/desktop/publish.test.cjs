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
      const endpoint = args.find(arg => arg.startsWith('repos/'));
      if (endpoint.endsWith('/branches/main')) return JSON.stringify({ commit: { sha: main } });
      if (endpoint.includes('/git/ref/tags/')) return tagExists ? JSON.stringify({ object: { type: 'commit', sha } }) : missing();
      if (endpoint.endsWith('/releases?per_page=100')) return JSON.stringify([release ? [release] : []]);
      // 실제 GitHub 계약: 초안은 tag 조회에 나오지 않고 release ID 조회에는 나온다.
      if (endpoint.includes('/releases/tags/')) return release && !release.draft ? JSON.stringify(release) : missing();
      if (endpoint.endsWith('/releases/101')) return release ? JSON.stringify(release) : missing();
      throw new Error(`Unexpected API endpoint: ${endpoint}`);
    }
    if (args[1] === 'create') release = { id: 101, tag_name: args[2], draft: true, target_commitish: sha, assets: [], html_url: 'https://example.invalid/release' };
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

test('a partially uploaded draft is found by list and resumed without overwriting assets', async t => {
  const f = await fixture(t);
  await assert.rejects(f.publish({ candidate: true, gh: args => {
    const result = f.gh(args);
    if (args[0] === 'release' && args[1] === 'upload' && f.getRelease().assets.length === 2)
      throw new Error('Interrupted upload');
    return result;
  } }), /Interrupted upload/);
  assert.equal(f.getRelease().draft, true);
  f.calls.length = 0;
  await f.publish({ candidate: true });
  assert.equal(f.getRelease().assets.length, 4);
  assert.equal(f.calls.filter(call => call[1] === 'create').length, 0);
  assert.equal(f.calls.filter(call => call[1] === 'upload').length, 2);
  assert.ok(f.calls.some(call => call[0] === 'api' && call.includes('--paginate')));
  assert.ok(f.calls.some(call => call[1] === 'edit' && call.includes('--latest=false')));
});

test('a mismatched asset in a draft prevents all publication mutations', async t => {
  const f = await fixture(t);
  await assert.rejects(f.publish({ gh: args => {
    const result = f.gh(args);
    if (args[0] === 'release' && args[1] === 'upload') throw new Error('Interrupted upload');
    return result;
  } }), /Interrupted upload/);
  f.getRelease().assets[0].digest = 'sha256:wrong';
  f.calls.length = 0;
  await assert.rejects(f.publish(), /asset mismatch/);
  assert.ok(f.calls.every(call => call[0] === 'api'));
});
test('a newly created draft can appear late without duplicate creation or weaker validation', async t => {
  const f = await fixture(t);
  const waits = [];
  let hidden = 2;
  await f.publish({ candidate: true, wait: async ms => { waits.push(ms); }, gh: args => {
    const result = f.gh(args);
    if (f.getRelease() && args.some(arg => arg.endsWith('/releases?per_page=100')) && hidden-- > 0)
      return JSON.stringify([[]]);
    return result;
  } });
  assert.deepEqual(waits, [250, 1000]);
  assert.equal(f.calls.filter(call => call[1] === 'create').length, 1);
  assert.equal(f.getRelease().assets.length, 4);
  assert.equal(f.getRelease().prerelease, true);
});

test('a draft that remains invisible is retained and never uploaded or published', async t => {
  const f = await fixture(t);
  await assert.rejects(f.publish({ wait: async () => {}, gh: args => {
    const result = f.gh(args);
    if (f.getRelease() && args.some(arg => arg.endsWith('/releases?per_page=100')))
      return JSON.stringify([[]]);
    return result;
  } }), /not visible after retries/);
  assert.equal(f.calls.filter(call => call[1] === 'create').length, 1);
  assert.ok(!f.calls.some(call => ['upload', 'edit'].includes(call[1])));
  assert.equal(f.getRelease().draft, true);
});

test('incorrect metadata is diagnosed immediately and is never retried into publication', async t => {
  const f = await fixture(t);
  const waits = [];
  await assert.rejects(f.publish({ wait: async ms => { waits.push(ms); }, gh: args => {
    const result = f.gh(args);
    if (args[1] === 'create') f.getRelease().target_commitish = 'b'.repeat(40);
    return result;
  } }), /Draft release metadata mismatch:.*target.*bbbb/);
  assert.deepEqual(waits, []);
  assert.ok(!f.calls.some(call => ['upload', 'edit'].includes(call[1])));
});
