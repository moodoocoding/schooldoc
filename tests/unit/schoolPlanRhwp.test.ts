import { beforeAll, describe, expect, test } from 'vitest';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import init, { HwpDocument } from '@rhwp/core';
import { buildPlanDocument, checkedHwpxExport, markerHang, planDocumentBlocks, planMarker, type PlanFonts } from '../../src/features/schoolDocuments/planRhwpEngine';
import { draft } from '../fixtures/schoolPlan';
import { unzipSync, strFromU8 } from 'fflate';

const base = 'src/features/schoolDocuments/assets/';
const fonts: PlanFonts = { body: readFileSync(`${base}fonts/NanumMyeongjo-Regular.otf`), bodyBold: readFileSync(`${base}fonts/NanumMyeongjo-Bold.otf`), title: readFileSync(`${base}fonts/NanumGothic-Bold.ttf`) };
beforeAll(async () => { await init({ module_or_path: readFileSync('node_modules/@rhwp/core/rhwp_bg.wasm') }); });
describe('실제 rhwp WASM의 계획서 생성·보존', () => {
  // 13pt·줄간격 160% 공문 서식에서는 목차 두 개 분량까지 1쪽에 담긴다.
  const compact = { ...draft, sections: [draft.sections[0], draft.sections[2]] };
  for (const pages of [1, 2] as const) test(`${pages}쪽 문서의 실제 표·전체 본문·재열기`, () => {
    const doc = new HwpDocument(readFileSync(`${base}blank-plan.hwpx`));
    const plan = pages === 1 ? compact : draft;
    try {
      buildPlanDocument(doc, plan, plan.title, pages, fonts);
      const bytes = checkedHwpxExport(doc);
      const files = unzipSync(bytes), xml = strFromU8(files['Contents/section0.xml']);
      expect((xml.match(/<hp:tbl\b/g) ?? []).length).toBe(2);
      const reopened = new HwpDocument(bytes);
      try {
        expect(reopened.pageCount()).toBe(pages);
        const text = JSON.parse(reopened.getTextFileText()) as string;
        for (const section of plan.sections) for (const p of section.paragraphs) expect(text).toContain(p);
        for (const row of plan.schedule) expect(text).toContain(row.activity);
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
  test('공문 서식: 휴먼명조 13pt·장평 100%·자간 0%·줄간격 160%, 제목 HY헤드라인M, A4 여백', () => {
    const doc = new HwpDocument(readFileSync(`${base}blank-plan.hwpx`));
    try {
      buildPlanDocument(doc, draft, draft.title, 2, fonts);
      const files = unzipSync(checkedHwpxExport(doc));
      const header = strFromU8(files['Contents/header.xml']), section = strFromU8(files['Contents/section0.xml']);
      const hangulFaces = header.match(/<hh:fontface lang="HANGUL"[\s\S]*?<\/hh:fontface>/)![0];
      const faces = new Map([...hangulFaces.matchAll(/<hh:font id="(\d+)" face="([^"]+)"/g)].map(m => [m[1], m[2]]));
      const charPrs = [...header.matchAll(/<hh:charPr id="(\d+)" height="(\d+)"[\s\S]*?<hh:fontRef hangul="(\d+)"[\s\S]*?<hh:ratio hangul="(\d+)"[\s\S]*?<hh:spacing hangul="(-?\d+)"/g)]
        .map(m => ({ id: m[1], height: Number(m[2]), face: faces.get(m[3]), ratio: Number(m[4]), spacing: Number(m[5]) }));
      const used = new Set([...section.matchAll(/charPrIDRef="(\d+)"/g)].map(m => m[1]));
      const styles = charPrs.filter(c => used.has(c.id) && c.face !== '함초롬바탕');
      expect(styles.some(c => c.face === '휴먼명조' && c.height === 1300)).toBe(true);
      expect(styles.some(c => c.face === 'HY헤드라인M' && c.height === 1600)).toBe(true);
      for (const c of styles) { expect(['휴먼명조', 'HY헤드라인M']).toContain(c.face); expect(c.ratio).toBe(100); expect(c.spacing).toBe(0); }
      expect(header).toMatch(/<hh:lineSpacing type="PERCENT" value="160"/);
      // 실제 공문처럼 한글은 어절 단위로 줄을 나눈다.
      expect(header).toMatch(/breakNonLatinWord="KEEP_WORD"/);
      // 둘째 항목(가.)은 2타 들여 시작하고 둘째 줄은 내용 첫 글자에 맞춘다.
      const hang = markerHang('가.', 1300);
      expect(header).toContain(`<hc:intent value="${-hang}" unit="HWPUNIT"/><hc:left value="1300" unit="HWPUNIT"/>`);
      expect(section).toMatch(/<hp:margin header="2835" footer="2835" gutter="0" left="5669" right="5669" top="4252" bottom="4252"\/>/);
    } finally { doc.free(); }
  });
});
describe('항목 기호 체계', () => {
  test('계층이 4단계 미만이면 편람 순서(1. → 가. → 1) → 가)), 4단계 이상이면 □ → ◦ → - → ※', () => {
    expect([1, 2, 3, 4, 5, 6].map(level => planMarker(level, 1, 2))).toEqual(['2.', '나.', '2)', '나)', '(2)', '(나)']);
    expect([1, 2, 3, 4].map(level => planMarker(level, 0, 4))).toEqual(['□', '◦', '-', '※']);
  });
  test('초안 본문은 AI 표시 없이 제목·번호 항목·표로 구성한다', () => {
    const blocks = planDocumentBlocks(draft, draft.title);
    expect(blocks[0]).toMatchObject({ kind: 'title', text: draft.title });
    const text = blocks.flatMap(b => b.kind === 'table' ? [] : [b.text]);
    expect(text).toContain('1. 운영 목적');
    expect(text).toContain(`가. ${draft.sections[1].paragraphs[0]}`);
    expect(text).toContain(`나. ${draft.sections[1].paragraphs[1]}`);
    expect(text).toContain('4. 세부추진 일정(안)');
    expect(text.join('\n')).not.toMatch(/\[초안\]|AI 작성/);
  });
});
