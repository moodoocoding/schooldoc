import { beforeAll, describe, expect, test } from 'vitest';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import init, { HwpDocument } from '@rhwp/core';
import { unzipSync, strFromU8 } from 'fflate';
import { layoutOfficialDocument } from '../../src/features/officialDocument/format';
import { pageVolumeIssues } from '../../src/features/officialDocument/lint';
import { checkedHwpxExport, writeOfficialDocument, type OfficialFonts } from '../../src/features/officialDocument/rhwpWriter';
import { checkedPlanDocument, planToOfficialDocument } from '../../src/features/schoolDocuments/planDocument';
import { authoredDraft, context, draft } from '../fixtures/schoolPlan';
import { composePlanDraft } from '../../supabase/functions/school-plan/composition';
import { validatePlanDraft } from '../../supabase/functions/_shared/schoolPlan';
import { parseParagraphItems } from '../../supabase/functions/_shared/planItems';

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
  test('활동은 편람 번호로 가. 활동 → 1) 운영 방법 → 가) 단계, 2) 결과물까지 펼친다', () => {
    const composed = validatePlanDraft(composePlanDraft(authoredDraft, 'general', 2), context);
    const lines = layoutOfficialDocument(planToOfficialDocument(composed, composed.title, 2)).flatMap(l => l.kind === 'table' ? [] : [l.text]);
    const first = authoredDraft.body.activities[0];
    const at = lines.indexOf('가. 개별 읽기 기록(방법안)');
    expect(lines.slice(at, at + 6)).toEqual(['가. 개별 읽기 기록(방법안)', '1) 운영 방법', ...first.steps.map((step, i) => `${'가나다'[i]}) ${step}`), `2) 결과물: ${first.result}`]);
    expect(lines.join('\n')).not.toMatch(/[□◦○]/);
  });
  test('들여 쓴 줄은 하위 항목, 들여쓰지 않은 줄바꿈은 이어지는 글로 읽는다', () => {
    expect(parseParagraphItems('활동\n  방법\n    단계 하나\n    단계 둘\n이어지는 글\n  결과')).toEqual({ text: '활동', children: [
      { text: '방법', children: [{ text: '단계 하나', children: [] }, { text: '단계 둘 이어지는 글', children: [] }] },
      { text: '결과', children: [] },
    ] });
    expect(parseParagraphItems('예전 문단')).toEqual({ text: '예전 문단', children: [] });
  });
  test('기대 효과는 소요 예산 뒤 마지막 목차이고, 학교 확인 사항은 문서에 넣지 않는다', () => {
    const composed = validatePlanDraft(composePlanDraft(authoredDraft, 'general', 2), context);
    expect(composed.sections.map(s => s.heading)).not.toContain('결과 활용');
    const document = planToOfficialDocument(composed, composed.title, 2);
    const headings = document.body.flatMap(n => n.kind === 'item' ? [n.text] : []);
    expect(headings.slice(-3)).toEqual(['세부추진 일정(안)', '소요 예산(안)', '기대 효과']);
    const json = JSON.stringify(document);
    expect(json).not.toContain('확인 사항');
    expect(composed.unknowns.length).toBeGreaterThan(0);
    for (const u of composed.unknowns) expect(json).not.toContain(u);
  });
  test('AI 표시 없이 제목·목차·문단·일정·예산을 트리로 담는다', () => {
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
  test('희망 쪽 수가 늘어도 강제 쪽 나눔으로 빈 지면을 만들지 않는다', () => {
    const breaks = (pages: 1 | 2) => planToOfficialDocument(draft, draft.title, pages).body.flatMap(n => n.kind === 'item' && n.pageBreakBefore ? [n.text] : []);
    expect(breaks(2)).toEqual([]);
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
      writeOfficialDocument(doc, planToOfficialDocument(plan, plan.title, pages), fonts);
      const bytes = checkedHwpxExport(doc);
      const xml = strFromU8(unzipSync(bytes)['Contents/section0.xml']);
      expect((xml.match(/<hp:tbl\b/g) ?? []).length).toBe(2);
      const reopened = new HwpDocument(bytes);
      try {
        expect(reopened.pageCount()).toBeLessThanOrEqual(pages);
        const text = JSON.parse(reopened.getTextFileText()) as string;
        for (const section of plan.sections) for (const p of section.paragraphs) expect(text).toContain(p);
        for (const row of plan.schedule) expect(text).toContain(row.activity);
        expect(text).toContain('합계 금200,000원(금이십만원)');
      } finally { reopened.free(); }
      mkdirSync('test-results/rhwp-implementation', { recursive: true });
      writeFileSync(`test-results/rhwp-implementation/wasm-${pages}page.hwpx`, bytes);
    } finally { doc.free(); }
  });
  test('분량을 넘어도 내용과 글자 크기를 줄이지 않고 만들며, 넘친 쪽 수를 알린다', () => {
    const doc = new HwpDocument(readFileSync(`${assets}blank.hwpx`));
    try {
      const long = { ...draft, sections: draft.sections.map(s => ({ ...s, paragraphs: s.paragraphs.map(p => p.repeat(12)) })) };
      const volume = writeOfficialDocument(doc, planToOfficialDocument(long, draft.title, 1), fonts);
      expect(volume.fills.length).toBeGreaterThan(1);
      const text = JSON.parse(doc.getTextFileText()) as string;
      expect(text.replace(/\s/g, '')).toContain(long.sections[0].paragraphs[0].replace(/\s/g, ''));
      expect(pageVolumeIssues(volume, 1)).toEqual([expect.objectContaining({ where: '분량', message: expect.stringContaining('선택한 1쪽보다') })]);
    } finally { doc.free(); }
  });
  // codex/school-plan-composition(af12d44)의 시험을 공통 출력 계층 API로 옮긴 것.
  test('새 활동 구조와 공모전의 배점·동점 기준을 실제 HWPX에 빠짐없이 보존한다', () => {
    const composed = validatePlanDraft(composePlanDraft({ ...authoredDraft, body: {
      purpose: authoredDraft.body.purpose, overview: authoredDraft.body.overview,
      intake: authoredDraft.body.activities, publication: { ...authoredDraft.body.effects, requirementIds: ['r2', 'r3'] }, effects: authoredDraft.body.effects,
      selectionRules: { criteria: [{ name: '적합성', check: '주제에 어울리는지 확인한다.', maxScore: 50 }, { name: '의미', check: '뜻이 분명한지 확인한다.', maxScore: 50 }],
        evaluationMethod: '합산 점수가 높은 순으로 선정한다.', exclusions: ['부적절한 표현이 포함된 작품'],
        tieBreakPriority: ['적합성', '의미'], finalTie: '함께 논의하고 선정 이유를 기록한다.', methodKind: 'proposal', requirementIds: ['r2'] },
    } }, 'contest'), context);
    const doc = new HwpDocument(readFileSync(`${assets}blank.hwpx`));
    try {
      writeOfficialDocument(doc, planToOfficialDocument(composed, '가상 공모전 구조 검증', 2), fonts);
      const reopened = new HwpDocument(checkedHwpxExport(doc));
      try {
        const text = JSON.parse(reopened.getTextFileText()) as string;
        for (const section of composed.sections) for (const p of section.paragraphs) for (const line of p.split('\n')) expect(text).toContain(line.trim());
        expect(text).toContain('적합성(50점):');
        expect(text).toContain('만점 합계 100점');
        expect(text).toContain('적합성 → 의미');
      } finally { reopened.free(); }
    } finally { doc.free(); }
  });
});
