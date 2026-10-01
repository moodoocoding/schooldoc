import {chromium,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:false});
const context=await browser.newContext({viewport:{width:1366,height:900}});
const page=await context.newPage();
const reports=[];
try {
 await page.goto('http://127.0.0.1:4173/tools/consent-forms/new');
 await page.getByLabel('가정통신문 PDF 파일').setInputFiles('design/consent-implementation/2026-10-01/evidence/fictional-source.pdf');
 await page.getByRole('button',{name:'확인 후 필드 배치'}).click();
 await expect(page.getByTestId('consent-field-canvas').locator('[data-pdf-state]')).toHaveAttribute('data-pdf-state','ready');
 for(const state of ['empty','selected','mobile-selected']) {
  if(state==='selected')await page.getByRole('button',{name:'텍스트',exact:true}).click();
  if(state==='mobile-selected')await page.setViewportSize({width:390,height:844});
  const result=await new AxeBuilder({page}).include('main').analyze();
  reports.push({state,violations:result.violations.map(v=>({id:v.id,impact:v.impact,description:v.description,nodes:v.nodes.map(n=>n.target)}))});
 }
 await writeFile('design/consent-field-editor/2026-10-02/evidence/editor-accessibility.json',JSON.stringify({browser:browser.version(),headed:true,reports},null,2));
 console.log(JSON.stringify(reports));
}finally{await browser.close();}