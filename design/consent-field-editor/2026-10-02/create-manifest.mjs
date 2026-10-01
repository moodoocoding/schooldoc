// 검사를 새로 실행하는 도구가 아니다. 본 작업에서 확인한 결과와 파일/링크를 기록한다.
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
const base='design/consent-field-editor/2026-10-02',ev=base+'/evidence';
const sources=['src/features/consentForms/ConsentFieldEditor.tsx','src/features/consentForms/ConsentFormsManagePage.tsx','src/features/consentForms/ConsentQrPrintPage.tsx','src/features/consentForms/consentRecipientSheet.ts','tests/e2e/consent-editor-layout.spec.ts','tests/e2e/consent-forms.spec.ts','tests/e2e/consent-questions.spec.ts','tests/e2e/consent-small-fields.spec.ts'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const sourceHashes={};for(const file of sources)sourceHashes[file]=hash((await readFile(file,'utf8')).replaceAll('\r\n','\n'));
const pdfHashes={};for(const file of(await readdir(ev)).filter(f=>f.startsWith('final-')&&f.endsWith('.pdf')))pdfHashes[file]=hash(await readFile(ev+'/'+file));
const reports=[base+'/report.md','design/consent-implementation/2026-10-01/report.md','docs/feature-review-consent-2026-10-01.md'];
let links=0;const missing=[];
for(const file of reports){const text=await readFile(file,'utf8');for(const match of text.matchAll(/\]\(([^)]+)\)/g)){let link=match[1];if(link.startsWith('http')||link.startsWith('#')||link.includes('://'))continue;link=link.split('#')[0];links++;if(!existsSync(resolve(dirname(file),link)))missing.push({file,link});}}
if(missing.length)throw new Error(JSON.stringify(missing));
const data={date:'2026-10-02',browser:'Google Chrome 154.0.8037.58',headed:true,typecheck:'pass',lint:{result:'pass',existingWarnings:6},unit:{files:63,tests:501,result:'pass'},chromeDemo:{uniqueTests:63,result:'pass',lastDirectRegression:25,questionsAndRecovery:13,spaceAndFoldSave:4},realLocalDb:{scenarios:5,result:'pass',remote:false,authStorage:'local adapters'},editorAxe:{states:3,violations:0},qrPdf:{documents:3,pages:18,A4:true,blankPages:0},sourceHashEncoding:'UTF8 normalized LF',sourceHashes,pdfHashes,markdownLinksChecked:links,missingLinks:missing,remoteWrites:false};
await writeFile(ev+'/verification-manifest.json',JSON.stringify(data,null,2));console.log(JSON.stringify({sourceFiles:sources.length,pdfs:Object.keys(pdfHashes).length,markdownLinks:links,missing:missing.length}));