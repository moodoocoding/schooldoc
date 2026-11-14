import { beforeAll, describe, expect, test } from 'vitest';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import init, { HwpDocument } from '@rhwp/core';
import { unzipSync, strFromU8 } from 'fflate';
import { layoutOfficialDocument } from '../../src/features/officialDocument/format';
import { pageVolumeIssues } from '../../src/features/officialDocument/lint';
import { checkedHwpxExport, TITLE_GAP, writeOfficialDocument, type OfficialFonts } from '../../src/features/officialDocument/rhwpWriter';
import { checkedPlanDocument, planToOfficialDocument } from '../../src/features/schoolDocuments/planDocument';
import { draft } from '../fixtures/schoolPlan';
import { uccDraft } from '../fixtures/schoolPlanUcc';

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
  test('6대 목차를 편람 번호로 펼친다: 1. 목차 → 가. 중항목 → 1) 세부 내용, 일정은 세부 추진 계획 끝 표', () => {
    const lines = layoutOfficialDocument(planToOfficialDocument(draft, draft.title, 2)).flatMap(l => l.kind === 'table' ? [] : [l.text]);
    const at = lines.indexOf('나. 개별 읽기 기록');
    expect(lines.slice(at, at + 3)).toEqual(['나. 개별 읽기 기록', `1) ${draft.detailedPlans[1].details[0]}`, `2) ${draft.detailedPlans[1].details[1]}`]);
    expect(lines).toContain('마. 추진 일정');
    expect(lines).toContain(`가. 기간: ${draft.overview.period}`);
    expect(lines.join('\n')).not.toMatch(/[□◦○]/);
  });
  test('기대 효과는 소요 예산 뒤 마지막 목차이고, 확인 사항은 문서에 넣지 않는다', () => {
    const document = planToOfficialDocument(draft, draft.title, 2);
    const headings = document.body.flatMap(n => n.kind === 'item' ? [n.text] : []);
    expect(headings.slice(-2)).toEqual(['소요 예산', '기대 효과']);
    const json = JSON.stringify(document);
    for (const u of draft.meta.unknowns) expect(json).not.toContain(u);
  });
  test('AI 표시 없이 제목·목차·항목·일정·예산을 트리로 담는다', () => {
    const document = planToOfficialDocument(draft, draft.title, 2);
    expect(document).toMatchObject({ kind: 'attachment-plan', title: draft.title });
    const text = layoutOfficialDocument(document).flatMap(l => l.kind === 'table' ? [] : [l.text]);
    expect(text).toContain('1. 추진 목적');
    expect(text).toContain(`가. ${draft.purpose[0]}`);
    expect(text).toContain('5. 소요 예산');
    expect(text).toContain('※ 합계 금200,000원(금이십만원). 단가는 실제 견적·집행 기준 확인 필요');
    expect(text.join('\n')).not.toMatch(/\[초안\]|AI 작성/);
  });
  test('희망 쪽 수가 늘어도 강제 쪽 나눔으로 빈 지면을 만들지 않는다', () => {
    const breaks = (pages: 1 | 2) => planToOfficialDocument(draft, draft.title, pages).body.flatMap(n => n.kind === 'item' && n.pageBreakBefore ? [n.text] : []);
    expect(breaks(2)).toEqual([]);
    expect(breaks(1)).toEqual([]);
  });
  test('저장 전 공문 표기 점검: 가상 초안은 고칠 점이 없고, 본문에 넣은 기호·날짜는 정리한다', () => {
    expect(checkedPlanDocument(draft, draft.title, 2).issues).toEqual([]);
    const messy = { ...draft, purpose: ['가. 2026-11-02부터 운영한다.', '나. 오후 3시에 모인다.'] };
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
  // 13pt·줄간격 160% 공문 서식의 1쪽 요약: 세부 추진 계획 2개, 방침 1개.
  const compact = { ...draft, purpose: draft.purpose.slice(0, 1), policies: draft.policies.slice(0, 1), detailedPlans: draft.detailedPlans.slice(1, 2), expectedEffects: draft.expectedEffects.slice(0, 1), budget: [], meta: { ...draft.meta, budgetStatus: 'confirmed_none' as const } };
  for (const pages of [1, 2] as const) test(`${pages}쪽 문서의 실제 표·전체 본문·재열기`, () => {
    const doc = new HwpDocument(readFileSync(`${assets}blank.hwpx`));
    const plan = pages === 1 ? compact : draft;
    try {
      writeOfficialDocument(doc, planToOfficialDocument(plan, plan.title, pages), fonts);
      const bytes = checkedHwpxExport(doc);
      const xml = strFromU8(unzipSync(bytes)['Contents/section0.xml']);
      expect((xml.match(/<hp:tbl\b/g) ?? []).length).toBe(pages === 1 ? 1 : 2);
      const reopened = new HwpDocument(bytes);
      try {
        expect(reopened.pageCount()).toBeLessThanOrEqual(pages);
        const text = JSON.parse(reopened.getTextFileText()) as string;
        for (const line of [...plan.purpose, ...plan.policies, ...plan.expectedEffects, ...plan.detailedPlans.flatMap(p => [p.subTitle, ...p.details])]) expect(text).toContain(line);
        for (const row of plan.schedule) expect(text).toContain(row.task);
        expect(text).toContain(pages === 1 ? '비예산' : '합계 금200,000원(금이십만원)');
      } finally { reopened.free(); }
      mkdirSync('test-results/rhwp-implementation', { recursive: true });
      writeFileSync(`test-results/rhwp-implementation/wasm-${pages}page.hwpx`, bytes);
    } finally { doc.free(); }
  });
  test('제목과 첫 목차 사이를 띄우고, 하위 항목이 있는 제목은 쪽 끝에 홀로 남기지 않는다(미리보기·한글 모두)', () => {
    const doc = new HwpDocument(readFileSync(`${assets}blank.hwpx`));
    try {
      const document = planToOfficialDocument(uccDraft, uccDraft.title, 2);
      writeOfficialDocument(doc, document, fonts);
      const reopened = new HwpDocument(checkedHwpxExport(doc));
      try {
        const page = (p: number, at: number) => (JSON.parse(reopened.getCursorRect(0, p, at)) as { pageIndex: number }).pageIndex;
        const lines = layoutOfficialDocument(document);
        expect(reopened.pageCount()).toBe(3);
        lines.forEach((line, p) => {
          if (line.kind !== 'item' || !line.keepWithNext || p + 1 >= lines.length) return;
          expect([line.text, page(p, reopened.getParagraphLength(0, p))]).toEqual([line.text, page(p + 1, 0)]);
        });
        const header = strFromU8(unzipSync(checkedHwpxExport(reopened))['Contents/header.xml']);
        expect(header).toContain('keepWithNext="1"');
      } finally { reopened.free(); }
    } finally { doc.free(); }
    expect(TITLE_GAP).toBeGreaterThanOrEqual(2800);
  });
  test('분량을 넘어도 내용과 글자 크기를 줄이지 않고 만들며, 넘친 쪽 수를 알린다', () => {
    const doc = new HwpDocument(readFileSync(`${assets}blank.hwpx`));
    try {
      const long = { ...draft, detailedPlans: draft.detailedPlans.map(p => ({ ...p, details: p.details.map(d => d.repeat(4)) })) };
      const volume = writeOfficialDocument(doc, planToOfficialDocument(long, draft.title, 1), fonts);
      expect(volume.fills.length).toBeGreaterThan(1);
      const text = JSON.parse(doc.getTextFileText()) as string;
      expect(text.replace(/\s/g, '')).toContain(long.detailedPlans[0].details[0].replace(/\s/g, ''));
      expect(pageVolumeIssues(volume, 1)).toEqual([expect.objectContaining({ where: '분량', message: expect.stringContaining('선택한 1쪽보다') })]);
    } finally { doc.free(); }
  });
});
