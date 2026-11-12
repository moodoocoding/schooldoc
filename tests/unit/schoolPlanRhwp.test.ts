import { beforeAll, describe, expect, test } from 'vitest';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import init, { HwpDocument } from '@rhwp/core';
import { buildPlanDocument, checkedHwpxExport } from '../../src/features/schoolDocuments/planRhwpEngine';
import { draft } from '../fixtures/schoolPlan';
import { unzipSync, strFromU8 } from 'fflate';

const base = 'src/features/schoolDocuments/assets/';
const fonts: [Uint8Array, Uint8Array] = [readFileSync(`${base}fonts/NanumGothic-Regular.ttf`), readFileSync(`${base}fonts/NanumGothic-Bold.ttf`)];
beforeAll(async () => { await init({ module_or_path: readFileSync('node_modules/@rhwp/core/rhwp_bg.wasm') }); });
describe('실제 rhwp WASM의 계획서 생성·보존', () => {
  for (const pages of [1, 2] as const) test(`${pages}쪽 문서의 실제 표·전체 본문·재열기`, () => {
    const doc = new HwpDocument(readFileSync(`${base}blank-plan.hwpx`));
    try {
      buildPlanDocument(doc, draft, draft.title, pages, fonts);
      const bytes = checkedHwpxExport(doc);
      const files = unzipSync(bytes), xml = strFromU8(files['Contents/section0.xml']);
      expect((xml.match(/<hp:tbl\b/g) ?? []).length).toBe(2);
      const reopened = new HwpDocument(bytes);
      try {
        expect(reopened.pageCount()).toBe(pages);
        const text = JSON.parse(reopened.getTextFileText()) as string;
        for (const section of draft.sections) for (const p of section.paragraphs) expect(text).toContain(p);
        for (const row of draft.schedule) expect(text).toContain(row.activity);
        expect(text).toContain('합계 200,000원');
      } finally { reopened.free(); }
      mkdirSync('test-results/rhwp-implementation', { recursive: true });
      writeFileSync(`test-results/rhwp-implementation/wasm-${pages}page.hwpx`, bytes);
    } finally { doc.free(); }
  });
  test('분량 초과 시 내용을 줄이지 않고 저장을 거부한다', () => {
    const doc = new HwpDocument(readFileSync(`${base}blank-plan.hwpx`));
    try {
      const long = { ...draft, sections: draft.sections.map(s => ({ ...s, paragraphs: s.paragraphs.map(p => p.repeat(12)) })) };
      expect(() => buildPlanDocument(doc, long, draft.title, 1, fonts)).toThrow(/1쪽에 담기 어렵습니다/);
    } finally { doc.free(); }
  });
});
