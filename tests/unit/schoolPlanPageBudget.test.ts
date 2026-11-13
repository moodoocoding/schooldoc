import { beforeAll, expect, test } from 'vitest';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import init, { HwpDocument } from '@rhwp/core';
import { writeOfficialDocument, checkedHwpxExport, type OfficialFonts } from '../../src/features/officialDocument/rhwpWriter';
import { planToOfficialDocument } from '../../src/features/schoolDocuments/planDocument';
import { validatePlanDocument } from '../../supabase/functions/_shared/planDocumentV2';
import { PLAN_PAGE_OPTIONS } from '../../supabase/functions/_shared/schoolPlan';
import { volumeFixture } from '../fixtures/schoolPlanVolume';
const assets = 'src/features/officialDocument/assets/';
const font = (name: string) => readFileSync(assets + 'fonts/' + name);
const fonts: OfficialFonts = {
  휴먼명조: { regular: font('NanumMyeongjo-Regular.otf'), bold: font('NanumMyeongjo-Bold.otf') },
  HY헤드라인M: { regular: font('NanumGothic-Bold.ttf'), bold: font('NanumGothic-Bold.ttf') },
  '맑은 고딕': { regular: font('NanumGothic-Regular.ttf'), bold: font('NanumGothic-Bold.ttf') },
};
beforeAll(async () => { await init({ module_or_path: readFileSync('node_modules/@rhwp/core/rhwp_bg.wasm') }); });
for (const pages of PLAN_PAGE_OPTIONS) test(pages + '쪽 목표의 내용이 실제 지면과 HWPX에 보존된다', () => {
  const draft = validatePlanDocument(volumeFixture(pages), { analysis: null });
  const doc = new HwpDocument(readFileSync(assets + 'blank.hwpx'));
  try {
    const volume = writeOfficialDocument(doc, planToOfficialDocument(draft, draft.title, pages), fonts);
    mkdirSync('test-results/plan-writing', { recursive: true });
    writeFileSync('test-results/plan-writing/' + pages + '-pages.hwpx', checkedHwpxExport(doc));
    writeFileSync('test-results/plan-writing/' + pages + '-volume.json', JSON.stringify(volume));
    for (let i = 0; i < doc.pageCount(); i++) writeFileSync('test-results/plan-writing/' + pages + '-page-' + (i + 1) + '.svg', doc.renderPageSvg(i));
    expect(volume.fills.length).toBe(pages);
    expect(volume.fills.every(fill => fill > 0)).toBe(true);
    const reopened = new HwpDocument(checkedHwpxExport(doc));
    try {
      const text = (JSON.parse(reopened.getTextFileText()) as string).replace(/\s/g, '');
      for (const p of draft.detailedPlans) for (const line of [p.subTitle, ...p.details]) expect(text).toContain(line.replace(/\s/g, ''));
      for (const line of [...draft.purpose, ...draft.policies, ...draft.expectedEffects]) expect(text).toContain(line.replace(/\s/g, ''));
    } finally { reopened.free(); }
  } finally { doc.free(); }
});
