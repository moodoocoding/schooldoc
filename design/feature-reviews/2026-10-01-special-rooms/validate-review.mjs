import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const dir=path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'));
const docs=path.resolve(dir,'../../../docs/feature-review-special-rooms-2026-10-01.md');
const problems=[],links=[];
for(const file of [path.join(dir,'review.md'),docs]){
 const body=await fs.readFile(file,'utf8');
 for(const m of body.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)){
  const target=m[1];if(/^https?:/.test(target))continue;
  const [relative,anchor]=target.split('#'),full=path.resolve(path.dirname(file),relative);
  try{const stat=await fs.stat(full);if(anchor&&/^L\d+$/.test(anchor)&&stat.isFile()){const lines=(await fs.readFile(full,'utf8')).split(/\r?\n/).length;assert.ok(Number(anchor.slice(1))<=lines,'anchor outside file')}links.push(target)}
  catch(e){problems.push({file,target,error:e.message})}
 }
}
assert.deepEqual(problems,[],'broken links');
for(const file of ['browser-demo.mjs','browser-network-mock.mjs','browser-boundaries.mjs','server-mock.mjs','validate-review.mjs'])execFileSync(process.execPath,['--check',path.join(dir,file)]);
const demo=JSON.parse(await fs.readFile(path.join(dir,'evidence/browser-demo.json'),'utf8'));
const net=JSON.parse(await fs.readFile(path.join(dir,'evidence/browser-network-mock.json'),'utf8'));
assert.ok(!demo.fatal&&!net.fatal,'observation incomplete');
const server=JSON.parse(await fs.readFile(path.join(dir,'evidence/server-mock.json'),'utf8'));
assert.equal(server.observations.length,20);
const boundary=JSON.parse(await fs.readFile(path.join(dir,'evidence/browser-boundaries.json'),'utf8'));
assert.equal(boundary.length,5);
const manifest=[];
for(const file of (await fs.readdir(path.join(dir,'evidence'))).sort()){
 if(!/\.(json|txt|png|pdf)$/.test(file)||file==='evidence-manifest.json'||file==='review-validation.json')continue;
 const data=await fs.readFile(path.join(dir,'evidence',file));if(file.endsWith('.json'))JSON.parse(data);
 manifest.push({file,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')});
}
await fs.writeFile(path.join(dir,'evidence/evidence-manifest.json'),JSON.stringify(manifest,null,2));
const changed=execFileSync('git',['diff','--name-only','c208afefca40bb4f15cab164fc292661e80fb9a0'],{cwd:path.resolve(dir,'../../..'),encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
assert.ok(changed.every(p=>p.startsWith('design/feature-reviews/2026-10-01-special-rooms/')||p==='docs/feature-review-special-rooms-2026-10-01.md'),'unexpected product changes');
const result={markdownLinksChecked:links.length,scriptSyntaxChecked:5,evidenceFiles:manifest.length,completeDemo:true,completeNetworkMock:true,serverObservations:20,boundaryContexts:5,productSourceChanges:false};
await fs.writeFile(path.join(dir,'evidence/review-validation.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
