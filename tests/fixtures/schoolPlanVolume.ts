import type { PlanPages } from '../../supabase/functions/_shared/schoolPlan';
import type { PlanReferenceType } from '../../supabase/functions/_shared/schoolPlanReferences';
import { PLAN_AUTHORING_PROFILES } from '../../supabase/functions/school-plan/authoringProfiles';
import { PLAN_PAGE_BUDGETS } from '../../supabase/functions/school-plan/composition';

// Synthetic Korean text measures layout/transport, not live model quality.
const measuredText = (length: number, label: string) => (label + ' 참여 학생은 자료에서 중요한 내용을 찾아 기록하고 짝과 비교한다. 담당 교사는 어려운 부분을 확인하여 안내 자료를 보완한다.'.repeat(10)).slice(0, length);
export function volumeFixture(pages: PlanPages, type: PlanReferenceType = 'general') {
  const b = PLAN_PAGE_BUDGETS[pages];
  const followUp = PLAN_AUTHORING_PROFILES[type].sections.some(s => s.role === 'followUp') ? b.followUpCount * b.followUp : 0;
  const capacity = b.purpose + b.overview * b.overviewLength + b.activities * (b.procedure + b.result + 30) + followUp + b.effects * b.effectLength;
  const ratio = Math.min(1, b.targetBodyChars / capacity);
  const content = (max: number, label: string) => measuredText(Math.max(label.length, Math.floor(max * ratio)), label);
  const roles = {
    purpose: { paragraphs: [content(b.purpose, '활동 목적:')], requirementIds: [] },
    overview: { paragraphs: Array.from({ length: b.overview }, (_, i) => content(b.overviewLength, `운영 조건 ${i + 1}:`)), requirementIds: [] },
    activities: Array.from({ length: b.activities }, (_, i) => ({ name: `실행 단계 ${i + 1}`, procedure: content(b.procedure, `과제 ${i + 1}의 절차:`), result: content(b.result, `확인 ${i + 1}:`), methodKind: 'proposal', requirementIds: [] })),
    followUp: { paragraphs: Array.from({ length: b.followUpCount }, (_, i) => content(b.followUp, `후속 확인 ${i + 1}:`)), requirementIds: [] },
    effects: { paragraphs: Array.from({ length: b.effects }, (_, i) => content(b.effectLength, `기대 효과 ${i + 1}:`)), requirementIds: [] },
  };
  const body: Record<string, unknown> = Object.fromEntries(PLAN_AUTHORING_PROFILES[type].sections.map(s => [s.key, structuredClone(roles[s.role])]));
  if (type === 'contest') body.selectionRules = {
    criteria: [{ name: '적합성', check: '학교생활의 목적에 맞는 내용을 담았는지 확인', maxScore: 60 }, { name: '표현력', check: '제안의 의미를 이해하기 쉽게 표현했는지 확인', maxScore: 40 }],
    evaluationMethod: '항목별 평가를 합산하여 높은 점수순으로 선정한다.', exclusions: ['다른 사람의 작품을 그대로 제출한 경우'],
    tieBreakPriority: ['적합성', '표현력'], finalTie: '심사자가 작품의 근거를 함께 검토하고 선정 이유를 기록한다.', methodKind: 'proposal', requirementIds: [],
  };
  return { title: '가상 학교 활동 운영계획', body,
    schedule: [{ when: '운영 전(안)', activity: '참여 안내와 자료 준비', owner: '담당 교사(안)', requirementIds: [] }, { when: '운영 중(안)', activity: '활동 실행과 결과 확인', owner: '담당 교사(안)', requirementIds: [] }],
    budget: [], unknowns: [],
  };
}
