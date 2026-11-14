import type { PlanPages } from '../../supabase/functions/_shared/schoolPlan';
import type { PlanDocumentV2 } from '../../supabase/functions/_shared/planDocumentV2';
import { PLAN_PAGE_TARGETS } from '../../supabase/functions/school-plan/prompt';

// Synthetic Korean text measures layout/transport, not live model quality.
const measuredText = (length: number, label: string) => (label + ' 참여 학생은 자료에서 중요한 내용을 찾아 기록하고 짝과 비교함. 담당 교사는 어려운 부분을 확인하여 안내 자료를 보완함.'.repeat(10)).slice(0, length);
/** 쪽 수별 목표 분량만큼 채운 가상 v2 계획서(표 제외 본문 기준). */
export function volumeFixture(pages: PlanPages): PlanDocumentV2 {
  const target = PLAN_PAGE_TARGETS[pages].bodyChars;
  const few = pages === 1, plans = few ? 1 : Math.min(5, pages + 1), details = pages >= 3 ? 4 : few ? 2 : 3;
  // 배경 8%·목적 8%·개요 10%·방침 10%·기대 효과 8%, 나머지 56%를 세부 추진 계획에 배정한다.
  const detail = Math.max(12, Math.floor((target * 0.56) / plans / details) - 6);
  const pairChar = Math.max(10, Math.floor(target * (few ? 0.08 : 0.04)));
  const policyChar = Math.max(10, Math.floor(target * (few ? 0.05 : 0.10 / 3)));
  return {
    schemaVersion: '2.0', title: '가상 학교 활동 운영계획',
    background: (few ? [1] : [1, 2]).map(i => measuredText(pairChar, `배경 ${i}:`)),
    purpose: (few ? [1] : [1, 2]).map(i => measuredText(pairChar, `목적 ${i}:`)),
    overview: { period: '2026. 3. 2.∼7. 17.', target: '전교 학생', venue: '각 학급 교실', summary: measuredText(Math.max(12, Math.min(280, Math.floor(target * 0.10) - 30)), '내용:') },
    policies: (few ? [1, 2] : [1, 2, 3]).map(i => measuredText(policyChar, `방침 ${i}:`)),
    detailedPlans: Array.from({ length: plans }, (_, i) => ({ subTitle: `실행 과제 ${i + 1}`, details: Array.from({ length: details }, (_, j) => measuredText(detail, `방법 ${j + 1}:`)) })),
    schedule: [{ step: '준비', task: '참여 안내와 자료 준비', date: '3월 첫째 주', owner: '담당 교사' }, { step: '운영', task: '활동 실행과 결과 확인', date: '3∼7월', owner: '담당 교사' }],
    budget: [],
    expectedEffects: (few ? [1] : [1, 2]).map(i => measuredText(pairChar, `효과 ${i}:`)),
    meta: { requirementIds: [], unknowns: [], budgetStatus: 'confirmed_none' },
  };
}
