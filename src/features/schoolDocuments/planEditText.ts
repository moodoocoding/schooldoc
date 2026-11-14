import type { PlanDraft } from '../../../supabase/functions/_shared/schoolPlan';
import { STANDARD_PLAN_TEMPLATE } from './planDocument';

/** 교사가 직접 고치는 본문 영역. 일정·예산은 표라서 따로 고친다. */
export const PLAN_EDIT_PARTS = ['background', 'purpose', 'overview', 'policies', 'detailedPlans', 'expectedEffects'] as const;
export type PlanEditPart = typeof PLAN_EDIT_PARTS[number];
export const planEditLabel = (part: PlanEditPart) => STANDARD_PLAN_TEMPLATE.headings[part];
export const PLAN_EDIT_HINTS: Record<PlanEditPart, string> = {
  background: '한 줄에 한 항목씩 씁니다. 필요 없으면 모두 비울 수 있습니다.',
  purpose: '한 줄에 한 항목씩 씁니다.',
  overview: '"기간:", "대상:", "장소:", "내용:"으로 시작하는 줄을 씁니다. 빈 칸이나 "미정"으로 쓰면 미정 항목으로 표시됩니다.',
  policies: '한 줄에 한 항목씩 씁니다.',
  detailedPlans: '중항목 이름을 한 줄에 쓰고, 그 아래 세부 내용은 줄 앞에 공백 2칸을 넣어 씁니다.',
  expectedEffects: '한 줄에 한 항목씩 씁니다.',
};
const OVERVIEW = [['period', '기간'], ['target', '대상'], ['venue', '장소'], ['summary', '내용']] as const;
const rows = (text: string) => text.replace(/\r\n?/g, '\n').split('\n');

export function planPartText(draft: PlanDraft, part: PlanEditPart): string {
  switch (part) {
    case 'overview': return OVERVIEW.some(([k]) => draft.overview[k])
      ? OVERVIEW.map(([k, label]) => `${label}: ${draft.overview[k] ?? '미정'}`).join('\n')
      : '';
    case 'detailedPlans': return draft.detailedPlans.map(p => [p.subTitle, ...p.details.map(d => `  ${d}`)].join('\n')).join('\n');
    default: return (draft[part] ?? []).join('\n');
  }
}

/** 고친 글을 초안에 넣는다. 형식 검사는 호출한 쪽(validatePlanDocument)이 한다. */
export function applyPlanPartText(draft: PlanDraft, part: PlanEditPart, text: string): PlanDraft {
  const lines = rows(text).map(l => l.trim()).filter(Boolean);
  switch (part) {
    case 'overview': {
      const overview = { period: null, target: null, venue: null, summary: null } as PlanDraft['overview'];
      for (const l of lines) {
        const hit = OVERVIEW.find(([, label]) => l.startsWith(`${label}:`));
        if (!hit) throw new Error(`운영 개요는 ${OVERVIEW.map(([, label]) => `"${label}:"`).join(', ')}으로 시작하는 줄만 쓸 수 있습니다.`);
        const value = l.slice(hit[1].length + 1).trim();
        overview[hit[0]] = !value || value === '미정' ? null : value;
      }
      return { ...draft, overview };
    }
    case 'detailedPlans': {
      const plans: PlanDraft['detailedPlans'] = [];
      for (const raw of rows(text)) {
        if (!raw.trim()) continue;
        if (/^\s{2,}/.test(raw)) {
          if (!plans.length) throw new Error('세부 내용 위에 중항목 이름을 먼저 써 주세요.');
          plans[plans.length - 1].details.push(raw.trim());
        } else plans.push({ subTitle: raw.trim(), details: [] });
      }
      if (plans.some(p => !p.details.length)) throw new Error('중항목마다 공백 2칸을 들인 세부 내용을 한 줄 이상 써 주세요.');
      return { ...draft, detailedPlans: plans };
    }
    default: return { ...draft, [part]: lines };
  }
}
