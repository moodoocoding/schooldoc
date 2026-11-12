import { beforeAll, describe, expect, test } from 'vitest';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import init, { HwpDocument } from '@rhwp/core';
import { buildPlanDocument, checkedHwpxExport } from '../../src/features/schoolDocuments/planRhwpEngine';
import { authoredDraft, context, draft } from '../fixtures/schoolPlan';
import { composePlanDraft } from '../../supabase/functions/school-plan/composition';
import { validatePlanDraft } from '../../supabase/functions/_shared/schoolPlan';
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
  test('새 활동 구조와 공모전의 배점·동점 기준을 실제 HWPX에 빠짐없이 보존한다', () => {
    const composed = validatePlanDraft(composePlanDraft({ ...authoredDraft, body: {
      purpose: authoredDraft.body.purpose, overview: authoredDraft.body.overview,
      intake: authoredDraft.body.activities[0], publication: { ...authoredDraft.body.activities[1], requirementIds: ['r2', 'r3'] },
      selectionRules: { criteria: [{ name: '적합성', check: '주제에 어울리는지 확인한다.', maxScore: 50 }, { name: '의미', check: '뜻이 분명한지 확인한다.', maxScore: 50 }],
        evaluationMethod: '합산 점수가 높은 순으로 선정한다.', exclusions: ['부적절한 표현이 포함된 작품'],
        tieBreakPriority: ['적합성', '의미'], finalTie: '함께 논의하고 선정 이유를 기록한다.', methodKind: 'proposal', requirementIds: ['r2'] },
    } }, 'contest'), context);
    const doc = new HwpDocument(readFileSync(`${base}blank-plan.hwpx`));
    try {
      buildPlanDocument(doc, composed, '가상 공모전 구조 검증', 2, fonts);
      const reopened = new HwpDocument(checkedHwpxExport(doc));
      try {
        const text = JSON.parse(reopened.getTextFileText()) as string;
        for (const section of composed.sections) for (const p of section.paragraphs) expect(text).toContain(p);
        expect(text).toContain('적합성(50점):');
        expect(text).toContain('만점 합계 100점');
        expect(text).toContain('적합성 → 의미');
      } finally { reopened.free(); }
    } finally { doc.free(); }
  });
});
