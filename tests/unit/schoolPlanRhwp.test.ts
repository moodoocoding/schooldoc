import { beforeAll, describe, expect, test } from 'vitest';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import init, { HwpDocument } from '@rhwp/core';
import { unzipSync, strFromU8 } from 'fflate';
import { layoutOfficialDocument } from '../../src/features/officialDocument/format';
import { pageVolumeIssues } from '../../src/features/officialDocument/lint';
import { checkedHwpxExport, relieveStretchedLines, TITLE_GAP, writeOfficialDocument, type OfficialFonts } from '../../src/features/officialDocument/rhwpWriter';
import { checkedPlanDocument, planToOfficialDocument } from '../../src/features/schoolDocuments/planDocument';
import { draft } from '../fixtures/schoolPlan';
import { uccDraft } from '../fixtures/schoolPlanUcc';
import { uccRecheckDraft } from '../fixtures/schoolPlanUccRecheck';

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
    const at = lines.indexOf('다. 개별 읽기 기록');
    expect(lines.slice(at, at + 3)).toEqual(['다. 개별 읽기 기록', `1) ${draft.detailedPlans[1].details[0]}`, `2) ${draft.detailedPlans[1].details[1]}`]);
    expect(lines).toContain('가. 운영 개요');
    expect(lines).toContain(`1) 기간: ${draft.overview.period}`);
    expect(lines).toContain('바. 추진 일정');
    expect(lines.join('\n')).not.toMatch(/[□◦○]/);
  });
  test('기대 효과는 소요 예산 뒤 마지막 목차이고, 확인 사항은 문서에 넣지 않는다', () => {
    const document = planToOfficialDocument(draft, draft.title, 2);
    const headings = document.body.flatMap(n => n.kind === 'item' ? [n.text] : []);
    expect(headings).toEqual(['추진 배경', '추진 목적', '운영 방침', '세부 추진 계획', '소요 예산', '기대 효과']);
    expect(headings.slice(-2)).toEqual(['소요 예산', '기대 효과']);
    const json = JSON.stringify(document);
    for (const u of draft.meta.unknowns) expect(json).not.toContain(u);
  });
  test('AI 표시 없이 제목·목차·항목·일정·예산을 트리로 담는다', () => {
    const document = planToOfficialDocument(draft, draft.title, 2);
    expect(document).toMatchObject({ kind: 'attachment-plan', title: draft.title });
    const text = layoutOfficialDocument(document).flatMap(l => l.kind === 'table' ? [] : [l.text]);
    expect(text).toEqual(expect.arrayContaining(['1. 추진 배경', '2. 추진 목적', '3. 운영 방침', '4. 세부 추진 계획', '5. 소요 예산', '6. 기대 효과']));
    expect(text).toContain(`가. ${draft.purpose[0]}`);
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
    const purpose = document.body[1];
    expect(purpose.kind === 'item' && purpose.children?.map(c => c.kind !== 'table' && c.text)).toEqual(['2026. 11. 2.부터 운영한다.', '오후 3시에 모인다.']);
    expect(issues.map(i => [i.where, i.fixed, i.message.split(/[(']/)[0]])).toEqual([
      ['본문 2 > 1', true, '앞의 항목 기호를 지웠습니다'], ['본문 2 > 1', true, '날짜를 공문 표기'],
      ['본문 2 > 2', true, '앞의 항목 기호를 지웠습니다'], ['본문 2 > 2', false, '시각은 24시각제로 씁니다'],
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
  test('어절 단위 줄 나눔으로 낱말 사이가 크게 벌어지는 문단만 글자 단위로 나눈다(미리보기·한글 모두)', () => {
    // 운영 재검수 초안: '업무관리시스템으로'가 통째로 다음 줄로 넘어가 앞 줄 빈칸이 크게 벌어졌다.
    const doc = new HwpDocument(readFileSync(`${assets}blank.hwpx`));
    try {
      const document = planToOfficialDocument(uccRecheckDraft, uccRecheckDraft.title, 2);
      writeOfficialDocument(doc, document, fonts);
      const lines = layoutOfficialDocument(document);
      const unit = (text: string) => JSON.parse(doc.getParaPropertiesAt(0, lines.findIndex(l => l.kind !== 'table' && l.text.startsWith(text)))).koreanBreakUnit;
      expect(unit('2) 교육지원청 제출')).toBe(1);
      // 보통 문단은 어절 단위를 유지한다.
      expect(unit('가. 공문에 정한 대상')).toBe(0);
      expect(unit('2) 심사 기준')).toBe(0);
      const bodies = lines.flatMap((l, p) => l.kind === 'item' || l.kind === 'note' ? [p] : []);
      expect(bodies.filter(p => JSON.parse(doc.getParaPropertiesAt(0, p)).koreanBreakUnit === 1).length).toBeLessThanOrEqual(3);
      // 다시 재도 벌어진 줄이 남지 않는다.
      expect(relieveStretchedLines(doc, bodies)).toEqual([]);
      expect(doc.pageCount()).toBe(2);
      // 한글에서도 같은 문단이 글자 단위로 열리도록 파일에 남는다.
      const reopened = new HwpDocument(checkedHwpxExport(doc));
      try {
        expect(JSON.parse(reopened.getParaPropertiesAt(0, lines.findIndex(l => l.kind !== 'table' && l.text.startsWith('2) 교육지원청 제출')))).koreanBreakUnit).toBe(1);
      } finally { reopened.free(); }
    } finally { doc.free(); }
  });
  test('글자 단위 줄 나눔으로 1글자 조사나 (안)이 다음 줄에 홀로 남으면 어절 단위로 복구하고, "…으 / 로" 분할은 유지한다', () => {
    // 1글자 조사('…아이디어 / 를')·'(안)'('…안내 / (안)') 고아 줄바꿈은 koreanBreakUnit을 0으로 되돌리고,
    // 기존 uccRecheckDraft의 '2) 교육지원청 제출'('…으 / 로 제출')은 계속 1을 유지한다.
    const orphanDraft = {
      ...uccRecheckDraft,
      detailedPlans: [
        {
          subTitle: '사전 안내 및 의견 수렴',
          details: [
            '의견 수렴: 학급별 독서 활동에 참여하는 학생들의 다양한 독서아이디어를 모아 공유함',
            '사전 안내: 참가 학생에게 제출 방법과 일정을 미리 학급별사전참여안내(안) 배부함',
          ],
        },
        ...uccRecheckDraft.detailedPlans.slice(2),
      ],
    };
    const doc = new HwpDocument(readFileSync(`${assets}blank.hwpx`));
    try {
      const document = planToOfficialDocument(orphanDraft, orphanDraft.title, 2);
      writeOfficialDocument(doc, document, fonts);
      const lines = layoutOfficialDocument(document);
      const idx = (prefix: string) => lines.findIndex(l => l.kind !== 'table' && l.text.startsWith(prefix));
      const unit = (p: number) => JSON.parse(doc.getParaPropertiesAt(0, p)).koreanBreakUnit;
      const pParticle = idx('1) 의견 수렴');
      const pProposal = idx('2) 사전 안내');
      const pKeep = idx('2) 교육지원청 제출');
      expect(unit(pParticle)).toBe(0);
      expect(unit(pProposal)).toBe(0);
      expect(unit(pKeep)).toBe(1);

      // 실제로 koreanBreakUnit: 1 상태에서는 다음 줄 첫 토큰이 각각 '를 ...', '(안)...'이 되어 복구 조건을 밟았음을 확인한다.
      const lineTexts = (p: number) => {
        const grouped = new Map<number, { x: number; text: string }[]>();
        for (let page = 0; page < doc.pageCount(); page++) {
          for (const run of (JSON.parse(doc.getPageTextLayout(page)) as { runs: { paraIdx: number; x: number; y: number; text: string }[] }).runs) {
            if (run.paraIdx !== p) continue;
            grouped.set(run.y, [...(grouped.get(run.y) ?? []), { x: run.x, text: run.text }]);
          }
        }
        return [...grouped.entries()].sort((a, b) => a[0] - b[0]).map(([, rs]) => rs.sort((a, b) => a.x - b.x).map(r => r.text).join(''));
      };
      doc.applyParaFormat(0, pParticle, JSON.stringify({ koreanBreakUnit: 1 }));
      doc.applyParaFormat(0, pProposal, JSON.stringify({ koreanBreakUnit: 1 }));
      doc.reflowLinesegs();
      expect(lineTexts(pParticle)[1]?.trimStart()).toMatch(/^를(?:\s|$)/);
      expect(lineTexts(pProposal)[1]?.trimStart()).toMatch(/^\(안\)(?:\s|$)/);
    } finally { doc.free(); }
  });
  test('표 아래 소요 예산과 비예산을 저장 후 다시 열어도 제목-본문 줄 간격이 벌어지지 않는다', () => {
    const noBudget = { ...draft, budget: [], meta: { ...draft.meta, budgetStatus: 'confirmed_none' as const } };
    const doc = new HwpDocument(readFileSync(`${assets}blank.hwpx`));
    try {
      const document = planToOfficialDocument(noBudget, noBudget.title, 2);
      writeOfficialDocument(doc, document, fonts);
      const reopened = new HwpDocument(checkedHwpxExport(doc));
      try {
        expect(reopened.pageCount()).toBeGreaterThanOrEqual(2);
        const lines = layoutOfficialDocument(document);
        const pBudget = lines.findIndex(l => l.kind !== 'table' && l.text === '5. 소요 예산');
        const pNone = lines.findIndex(l => l.kind !== 'table' && l.text === '비예산');
        const pEffects = lines.findIndex(l => l.kind !== 'table' && l.text === '6. 기대 효과');
        const pEffectItem = lines.findIndex(l => l.kind !== 'table' && l.text === `가. ${noBudget.expectedEffects[0]}`);
        const yOf = (p: number) => {
          for (let page = 0; page < reopened.pageCount(); page++) {
            const run = (JSON.parse(reopened.getPageTextLayout(page)) as { runs: { paraIdx: number; y: number }[] }).runs.find(r => r.paraIdx === p);
            if (run) return { page, y: run.y };
          }
          throw new Error(`paragraph ${p} not found in layout`);
        };
        const budgetPos = yOf(pBudget);
        const nonePos = yOf(pNone);
        const effectsPos = yOf(pEffects);
        const effectItemPos = yOf(pEffectItem);
        const budgetGap = nonePos.y - budgetPos.y;
        const normalHeadingGap = effectItemPos.y - effectsPos.y;
        expect(nonePos.page).toBe(budgetPos.page);
        expect(Math.abs(budgetGap - 30.4)).toBeLessThanOrEqual(1);
        expect(Math.abs(budgetGap - normalHeadingGap)).toBeLessThanOrEqual(1);
      } finally { reopened.free(); }
    } finally { doc.free(); }
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
