import { beforeAll, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import init, { HwpDocument } from '@rhwp/core';
import { writeOfficialDocument } from '../../src/features/officialDocument/rhwpWriter';
import { planToOfficialDocument } from '../../src/features/schoolDocuments/planDocument';
import { composePlanDraft, PLAN_PAGE_BUDGETS } from '../../supabase/functions/school-plan/composition';
import { PLAN_PAGE_OPTIONS } from '../../supabase/functions/_shared/schoolPlan';

beforeAll(async () => { await init({ module_or_path: readFileSync('node_modules/@rhwp/core/rhwp_bg.wasm') }); });
// 가상 문장으로 칸마다 글자 수 한도를 꽉 채운다. 단가·수량은 학교 예산에서 흔한 자릿수로 둔다.
const hangul = (n: number) => '가상 학교에서 학생들이 참여하는 활동을 운영하고 결과를 정리한다 '.repeat(40).slice(0, n);

for (const pages of PLAN_PAGE_OPTIONS) test(`AI 응답 형식의 한도를 모두 채워도 ${pages}쪽 안에 들어간다`, () => {
  const b = PLAN_PAGE_BUDGETS[pages], title = hangul(30);
  const body = {
    purpose: { paragraphs: [hangul(b.purpose)], requirementIds: [] },
    overview: { paragraphs: Array.from({ length: b.overview }, () => hangul(b.overviewLength)), requirementIds: [] },
    activities: Array.from({ length: b.activities }, () => ({ name: hangul(b.name), procedure: hangul(b.procedure), result: hangul(b.result), methodKind: 'proposal', requirementIds: [] })),
    effects: { paragraphs: Array.from({ length: b.effects }, () => hangul(b.effectLength)), requirementIds: [] },
  };
  const draft = composePlanDraft({
    title, body,
    schedule: Array.from({ length: b.schedule }, () => ({ when: hangul(b.when), activity: hangul(b.scheduleActivity), owner: hangul(b.owner), requirementIds: [] })),
    budget: Array.from({ length: b.budget }, () => ({ item: hangul(b.item), unitPrice: 15000, quantity: 30, requirementIds: [] })),
    unknowns: [],
  }, 'general') as Parameters<typeof planToOfficialDocument>[0];
  const doc = new HwpDocument(readFileSync('src/features/officialDocument/assets/blank.hwpx'));
  try {
    const volume = writeOfficialDocument(doc, planToOfficialDocument(draft, title, pages), {});
    expect(volume.fills.length).toBe(pages);
  } finally { doc.free(); }
}, 20000);
