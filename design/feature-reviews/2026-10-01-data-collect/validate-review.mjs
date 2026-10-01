import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd(),dir=path.resolve('design/feature-reviews/2026-10-01-data-collect');
const files=[path.join(dir,'review.md'),path.join(dir,'evidence/index.md'),path.resolve('docs/feature-review-data-collect-2026-10-01.md')];
const failures=[],checks=[];
for(const file of files){
  const content=fs.readFileSync(file,'utf8');let links=0,sourceLocations=0;
  for(const match of content.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)){
    const target=match[1].split('#')[0];if(!target||/^https?:/.test(target))continue;
    links++;const resolved=path.resolve(path.dirname(file),target);if(!fs.existsSync(resolved))failures.push({file,target});
  }
  for(const match of content.matchAll(/((?:src|supabase)\/[A-Za-z0-9_./-]+):(\d+)/g)){
    const filename=path.resolve(root,match[1]),line=Number(match[2]);sourceLocations++;
    if(!fs.existsSync(filename)||line>fs.readFileSync(filename,'utf8').split(/\r?\n/).length)failures.push({file,source:match[1],line});
  }
  checks.push({file:path.relative(root,file),links,sourceLocations});
}
for(const file of ['browser-demo.mjs','browser-remote-mocks.mjs','server-mocks.mjs','supplemental.mjs','playwright-review.config.mjs'])if(!fs.existsSync(path.join(dir,file)))failures.push({missingTool:file});
const result={checks,failures};fs.writeFileSync(path.join(dir,'evidence/document-validation.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(failures.length)process.exit(1);
