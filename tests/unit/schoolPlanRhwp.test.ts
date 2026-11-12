import { beforeAll, describe, expect, test } from 'vitest';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import init, { HwpDocument } from '@rhwp/core';
import { unzipSync, strFromU8 } from 'fflate';
import { layoutOfficialDocument } from '../../src/features/officialDocument/format';
import { checkedHwpxExport, writeOfficialDocument, type OfficialFonts } from '../../src/features/officialDocument/rhwpWriter';
import { checkedPlanDocument, planToOfficialDocument } from '../../src/features/schoolDocuments/planDocument';
import { draft } from '../fixtures/schoolPlan';

const assets = 'src/features/officialDocument/assets/';
const read = (name: string) => readFileSync(`${assets}fonts/${name}`);
const gothicBold = read('NanumGothic-Bold.ttf');
const fonts: OfficialFonts = {
  휴먼명조: { regular: read('NanumMyeongjo-Regular.otf'), bold: read('NanumMyeongjo-Bold.otf') },
  HY헤드라인M: { regular: gothicBold, bold: gothicBold },
  '맑은 고딕': { regular: read('NanumGothic-Regular.ttf'), bold: gothicBold },
};
beforeAll(async () => { await init({ module_or_path: readFileSync('node_modules/@rhwp/core/rhwp_bg.wasm') }); });

describe('운영계획서 초안 → 공문 문서 모델', () => {
  test('AI 표시 없이 제목·목차·문단·일정·예산·확인 사항을 트리로 담는다', () => {
    const document = planToOfficialDocument(draft, draft.title, 2);
    expect(document).toMatchObject({ kind: 'attachment-plan', title: draft.title });
    const text = layoutOfficialDocument(document).flatMap(l => l.kind === 'table' ? [] : [l.text]);
    expect(text).toContain('1. 운영 목적');
    // 문단이 하나뿐인 목차는 편람대로 가.를 붙이지 않는다.
    expect(text).toContain(draft.sections[0].paragraphs[0]);
    expect(text).not.toContain(`가. ${draft.sections[0].paragraphs[0]}`);
    expect(text).toContain(`가. ${draft.sections[1].paragraphs[0]}`);
    expect(text).toContain(`나. ${draft.sections[1].paragraphs[1]}`);
    expect(text).toContain('4. 세부추진 일정(안)');
    expect(text).toContain('※ 합계 금200,000원(금이십만원). 단가와 배분은 제안이며 집행 기준·실제 견적 확인 필요');
    expect(text.join('\n')).not.toMatch(/\[초안\]|AI 작성/);
  });
  test('2쪽 출력만 일정 목차 앞에서 쪽을 나눈다', () => {
    const breaks = (pages: 1 | 2) => planToOfficialDocument(draft, draft.title, pages).body.flatMap(n => n.kind === 'item' && n.pageBreakBefore ? [n.text] : []);
    expect(breaks(2)).toEqual(['세부추진 일정(안)']);
    expect(breaks(1)).toEqual([]);
  });
  test('저장 전 공문 표기 점검: 가상 초안은 고칠 점이 없고, 본문에 넣은 기호·날짜는 정리한다', () => {
    expect(checkedPlanDocument(draft, draft.title, 2).issues).toEqual([]);
    const messy = { ...draft, sections: [{ ...draft.sections[0], paragraphs: ['가. 2026-11-02부터 운영한다.', '나. 오후 3시에 모인다.'] }] };
    const { document, issues } = checkedPlanDocument(messy, draft.title, 2);
    const first = document.body[0];
    expect(first.kind === 'item' && first.children?.map(c => c.kind !== 'table' && c.text)).toEqual(['2026. 11. 2.부터 운영한다.', '오후 3시에 모인다.']);
    expect(issues.map(i => [i.where, i.fixed, i.message.split(/[(']/)[0]])).toEqual([
      ['본문 1 > 1', true, '앞의 항목 기호를 지웠습니다'], ['본문 1 > 1', true, '날짜를 공문 표기'],
      ['본문 1 > 2', true, '앞의 항목 기호를 지웠습니다'], ['본문 1 > 2', false, '시각은 24시각제로 씁니다'],
    ]);
  });
  test('제목은 100자 이내여야 한다', () => {
    expect(() => planToOfficialDocument(draft, ' ', 2)).toThrow('문서 제목을 100자 이내로');
  });
});

describe('실제 rhwp WASM의 계획서 생성·보존', () => {
  // 13pt·줄간격 160% 공문 서식에서는 목차 두 개 분량까지 1쪽에 담긴다.
  const compact = { ...draft, sections: [draft.sections[0], draft.sections[2]] };
  for (const pages of [1, 2] as const) test(`${pages}쪽 문서의 실제 표·전체 본문·재열기`, () => {
    const doc = new HwpDocument(readFileSync(`${assets}blank.hwpx`));
    const plan = pages === 1 ? compact : draft;
    try {
      writeOfficialDocument(doc, planToOfficialDocument(plan, plan.title, pages), pages, fonts);
      const bytes = checkedHwpxExport(doc);
      const xml = strFromU8(unzipSync(bytes)['Contents/section0.xml']);
      expect((xml.match(/<hp:tbl\b/g) ?? []).length).toBe(2);
      const reopened = new HwpDocument(bytes);
      try {
        expect(reopened.pageCount()).toBe(pages);
        const text = JSON.parse(reopened.getTextFileText()) as string;
        for (const section of plan.sections) for (const p of section.paragraphs) expect(text).toContain(p);
        for (const row of plan.schedule) expect(text).toContain(row.activity);
        expect(text).toContain('합계 금200,000원(금이십만원)');
      } finally { reopened.free(); }
      mkdirSync('test-results/rhwp-implementation', { recursive: true });
      writeFileSync(`test-results/rhwp-implementation/wasm-${pages}page.hwpx`, bytes);
    } finally { doc.free(); }
  });
  test('분량 초과 시 내용을 줄이지 않고 저장을 거부한다', () => {
    const doc = new HwpDocument(readFileSync(`${assets}blank.hwpx`));
    try {
      const long = { ...draft, sections: draft.sections.map(s => ({ ...s, paragraphs: s.paragraphs.map(p => p.repeat(12)) })) };
      expect(() => writeOfficialDocument(doc, planToOfficialDocument(long, draft.title, 1), 1, fonts)).toThrow(/1쪽에 담기 어렵습니다/);
    } finally { doc.free(); }
  });
});
