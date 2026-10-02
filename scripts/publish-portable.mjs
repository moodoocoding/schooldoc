import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const runGh = args => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

// gh를 주입할 수 있어 게시 방지·재실행 검사를 원격 변경 없이 수행한다.
export async function publishPortable({ directory = 'release', smokePath = process.env.PORTABLE_SMOKE_REPORT || 'test-results/portable/portable-smoke.json',
  candidate = false, repo = process.env.GITHUB_REPOSITORY || 'moodoocoding/schooldoc', gh = runGh,
  wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)) } = {}) {
  const manifestPath = path.resolve(directory, 'portable-manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (!/^SchoolDoc_Portable_[\w.-]+\.exe$/.test(manifest.artifactName) || !/^\d+\.\d+\.\d+$/.test(manifest.version))
    throw new Error('Invalid portable artifact metadata');
  const exePath = path.resolve(directory, manifest.artifactName);
  const bytes = await readFile(exePath);
  const hash = digest(bytes);
  const smoke = JSON.parse(await readFile(smokePath, 'utf8'));
  const sumsPath = path.resolve(directory, 'SHA256SUMS.txt');
  if (manifest.dirty !== false || !/^[a-f0-9]{40}$/.test(manifest.commit) || hash !== manifest.sha256 || bytes.length !== manifest.size
    || smoke.success !== true || smoke.commit !== manifest.commit || smoke.sha256 !== hash
    || (await readFile(sumsPath, 'utf8')).trim() !== `${hash}  ${manifest.artifactName}`) {
    throw new Error('Clean commit, matching checksum/size and passed packaged smoke report required');
  }
  const files = [exePath, sumsPath, manifestPath, path.resolve(smokePath)];
  const expected = await Promise.all(files.map(async file => {
    const content = await readFile(file);
    return { file, name: path.basename(file), size: content.length, digest: `sha256:${digest(content)}` };
  }));
  if (new Set(expected.map(asset => asset.name)).size !== expected.length) throw new Error('Duplicate asset names');
  const api = endpoint => JSON.parse(gh(['api', `repos/${repo}/${endpoint}`]));
  const currentMain = () => api('branches/main').commit.sha;
  if (!candidate && currentMain() !== manifest.commit) throw new Error('Only current main commit may become a stable release');
  const tag = `portable-${candidate ? 'rc-' : ''}v${manifest.version}-${manifest.commit.slice(0, 12)}`;
  const taggedCommit = () => {
    try {
      const ref = api(`git/ref/tags/${tag}`);
      if (ref.object.type !== 'commit' || ref.object.sha !== manifest.commit) throw new Error('Existing tag points to another commit');
      return true;
    } catch (error) { if (error.stderr?.toString().includes('404')) return false; throw error; }
  };
  const checkAssets = (release, allowMissing) => {
    for (const wanted of expected) {
      const actual = release.assets.find(asset => asset.name === wanted.name);
      if ((!actual && !allowMissing) || (actual && (actual.size !== wanted.size || actual.digest !== wanted.digest)))
        throw new Error(`Release asset mismatch: ${wanted.name}`);
    }
  };
  const findRelease = () => {
    try { return api(`releases/tags/${tag}`); }
    catch (error) { if (!error.stderr?.toString().includes('404')) throw error; }
    // GitHub의 tag 조회는 게시된 release만 반환한다. 초안은 목록에서 찾아 ID로 확인한다.
    const pages = JSON.parse(gh(['api', '--paginate', '--slurp', `repos/${repo}/releases?per_page=100`]));
    const matches = pages.flat().filter(release => release.tag_name === tag);
    if (matches.length > 1) throw new Error('Duplicate release tag metadata');
    return matches[0];
  };
  let existing = findRelease();
  // 이미 존재하는 태그는 release가 없어도 다른 SHA로 덮어쓰지 않는다.
  const tagExists = taggedCommit();
  if (existing) {
    checkAssets(existing, existing.draft);
    if (!existing.draft) {
      if (!tagExists || existing.prerelease !== candidate) throw new Error('Published release metadata mismatch');
      console.log(`Already published: ${existing.html_url}`);
      return existing.html_url;
    }
    if (existing.target_commitish !== manifest.commit) throw new Error('Draft target commit mismatch');
  }
  const notes = [
    `SchoolDoc Windows x64 ${candidate ? '검증용 후보' : '포터블'} v${manifest.version}`, '',
    `대상 커밋: ${manifest.commit}`, `EXE SHA-256: ${hash}`, '',
    '패키지 실행 검사: Windows 실제 EXE, 경로 이동, PDF worker, 다운로드, 인쇄 엔진, 저장 및 재시작.',
    '자동 패키지 검사는 모의 서버를 사용합니다. 실제 Google/Supabase 통합 검증은 PR 검증 기록을 확인하세요.',
    candidate ? 'main 병합 전 필수 실제 인증·공개 브라우저 검증을 완료해야 합니다.' : 'main 병합 후 같은 커밋으로 생성한 정식 포터블입니다.',
    '', '검증 보고서: 첨부 portable-smoke.json',
  ].join('\n');
  const notesPath = path.resolve(directory, 'release-notes.md');
  await writeFile(notesPath, notes + '\n');
  if (!existing) {
    gh(['release', 'create', tag, '--repo', repo, '--draft', '--target', manifest.commit,
      '--title', `스쿨독 포터블 v${manifest.version}${candidate ? ' 검증 후보' : ''} (${manifest.commit.slice(0, 12)})`, '--notes-file', notesPath]);
    // 생성 직후 목록에 아직 나타나지 않을 수 있다. 같은 초안을 다시 만들지 않고 조회만 재시도한다.
    for (const delay of [0, 250, 1000, 3000]) {
      if (delay) await wait(delay);
      existing = findRelease();
      if (existing) break;
    }
  }
  if (!existing?.draft || existing.target_commitish !== manifest.commit || existing.tag_name !== tag
    || !Number.isSafeInteger(existing.id) || existing.id < 1) {
    const observed = existing ? { id: existing.id, draft: existing.draft, tag: existing.tag_name,
      target: existing.target_commitish } : 'not visible after retries';
    throw new Error(`Draft release metadata mismatch: ${JSON.stringify(observed)}`);
  }
  checkAssets(existing, true);
  for (const asset of expected) {
    if (!existing?.assets.some(saved => saved.name === asset.name)) gh(['release', 'upload', tag, asset.file, '--repo', repo]);
  }
  checkAssets(api(`releases/${existing.id}`), false);
  if (!candidate && currentMain() !== manifest.commit) throw new Error('Main advanced during publication; draft retained without publishing');
  taggedCommit();
  gh(['release', 'edit', tag, '--repo', repo, '--draft=false', `--prerelease=${candidate}`, `--latest=${!candidate}`]);
  const published = api(`releases/tags/${tag}`);
  checkAssets(published, false);
  if (published.draft || published.prerelease !== candidate || !taggedCommit()) throw new Error('Published release verification failed');
  console.log(published.html_url);
  return published.html_url;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  await publishPortable({ candidate: process.argv.includes('--candidate') });
