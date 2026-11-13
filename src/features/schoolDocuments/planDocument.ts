import type { PlanConditions, PlanDraft, PlanPages } from '../../../supabase/functions/_shared/schoolPlan';
import { planBudgetRowAmount, planBudgetSum } from '../../../supabase/functions/_shared/planDocumentV2';
import { draftBodyText } from '../officialDocument/draftBody';
import { checkOfficialDocument, normalizeDates, officialAmount, type OfficialCheck } from '../officialDocument/lint';
import { item, note, table, type OfficialDocument, type OfficialNode } from '../officialDocument/model';

/** 운영계획서의 6개 대목차. 내용(AI)과 순서·이름(서식)을 분리한다. */
export type PlanSlot = 'purpose' | 'overview' | 'policies' | 'detailedPlans' | 'budget' | 'expectedEffects';
/**
 * 문서 서식. 공문·학교가 지정한 서식이 있으면 대목차 이름·순서를 여기서 바꾼다(AI가 목차를 바꾸지 않는다).
 * 서식은 시스템이 신뢰하는 설정이어야 한다. 공문 본문의 문장을 서식으로 승격하지 않는다.
 */
export interface PlanTemplate {
  order: PlanSlot[];
  headings: Record<PlanSlot, string>;
  /** 세부 추진 계획 끝에 붙는 일정표 중항목 이름. */
  scheduleHeading: string;
}
export const STANDARD_PLAN_TEMPLATE: PlanTemplate = {
  order: ['purpose', 'overview', 'policies', 'detailedPlans', 'budget', 'expectedEffects'],
  headings: { purpose: '추진 목적', overview: '운영 개요', policies: '운영 방침', detailedPlans: '세부 추진 계획', budget: '소요 예산', expectedEffects: '기대 효과' },
  scheduleHeading: '추진 일정',
};

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;
const lines = (texts: string[]) => texts.map(text => item(text));

/** 대목차별 본문. 일정은 세부 추진 계획의 마지막 중항목 표, 예산은 소요 예산 표로 둔다. */
function slotBody(draft: PlanDraft, slot: PlanSlot, template: PlanTemplate): OfficialNode[] {
  switch (slot) {
    case 'purpose': return lines(draft.purpose);
    case 'overview': {
      const o = draft.overview;
      const rows = ([['기간', o.period], ['대상', o.target], ['장소', o.venue], ['내용', o.summary]] as const).filter(([, v]) => v);
      return rows.length ? rows.map(([k, v]) => item(`${k}: ${v}`)) : [note('운영 개요 미정(검토 필요)')];
    }
    case 'policies': return lines(draft.policies);
    case 'detailedPlans': return [
      ...draft.detailedPlans.map(p => item(p.subTitle, lines(p.details))),
      // 일정이 없으면 빈 표를 그리지 않는다.
      ...(draft.schedule.length ? [item(template.scheduleHeading, [table(
        [{ label: '단계', width: 6000 }, { label: '추진 내용', width: 19100 }, { label: '시기', width: 14000 }, { label: '담당', width: 9000 }],
        draft.schedule.map(s => [s.step, s.task, s.date ?? '미정', s.owner ?? '미정']),
      )])] : []),
    ];
    case 'budget': {
      const status = draft.meta.budgetStatus;
      if (status === 'confirmed_none') return [item('비예산')];
      if (status === 'unconfirmed' || !draft.budget.length) return [note('예산 미정(검토 필요): 금액 확정 후 집행 기준에 따라 작성')];
      const unknown = draft.budget.some(b => planBudgetRowAmount(b) === null);
      return [
        table([{ label: '항목', width: 8000 }, { label: '산출 내역', width: 12600 }, { label: '단가', width: 7000, align: 'right' }, { label: '수량', width: 4500, align: 'right' }, { label: '금액', width: 8500, align: 'right' }, { label: '비고', width: 7500 }],
          draft.budget.map(b => { const amount = planBudgetRowAmount(b); return [b.item, b.spec, b.unitPrice === null ? '미정' : won(b.unitPrice), b.quantity === null ? '미정' : String(b.quantity), amount === null ? '미정' : won(amount), b.note ?? '']; })),
        note(`합계 ${officialAmount(planBudgetSum(draft))}${unknown ? '(미정 항목 제외)' : ''}. 단가는 실제 견적·집행 기준 확인 필요`),
      ];
    }
    case 'expectedEffects': return lines(draft.expectedEffects);
  }
}

/**
 * 운영계획서 초안 → 공문 문서 모델. 무엇을 어떤 순서로 쓸지만 정하고,
 * 항목 기호(1. 가. 1))·들여쓰기·글꼴은 공통 출력 계층(officialDocument)이 정한다.
 * 학교 확인 사항(meta.unknowns)은 문서에 넣지 않고 검토 화면에만 보여 준다.
 */
export function planToOfficialDocument(draft: PlanDraft, title: string, _pages: PlanPages, template: PlanTemplate = STANDARD_PLAN_TEMPLATE): OfficialDocument {
  if (!title.trim() || title.length > 100 || [...title].some(c => c.charCodeAt(0) < 32)) throw new Error('문서 제목을 100자 이내로 확인해 주세요.');
  return {
    kind: 'attachment-plan',
    title: title.trim(),
    body: template.order.map(slot => item(template.headings[slot], slotBody(draft, slot, template))),
  };
}

/** 저장 전에 공문 표기를 점검하고 기호·날짜 표기를 고친 문서를 돌려준다. */
export const checkedPlanDocument = (draft: PlanDraft, title: string, pages: PlanPages, template?: PlanTemplate): OfficialCheck => checkOfficialDocument(planToOfficialDocument(draft, title, pages, template));

/** 마지막 한글 글자에 받침이 있으면 "을", 없으면 "를"(예: "계획(안)" → 안 → 을). 한글이 끝에 없으면 "을(를)". */
function objectParticle(word: string) {
  const last = word.trim().replace(/[)\]」』"'\s]+$/, '').slice(-1);
  const code = last.charCodeAt(0) - 0xac00;
  if (!last || code < 0 || code > 11171) return '을(를)';
  return code % 28 ? '을' : '를';
}
/** 관련 공문 번호·날짜처럼 교사가 채울 자리. */
export const DRAFT_PLACEHOLDER = '○○○-○○○○(○○○○. ○. ○.)';

/**
 * 운영계획서를 붙임으로 올리는 K-에듀파인 기안 본문. 공문을 바탕으로 했으면 "관련:" 줄을 두고 번호·날짜는 교사가 채운다.
 * 운영 시기는 학교 조건, 예산은 초안 예산 합계에서 가져온다.
 */
export function planDraftBody(draft: PlanDraft, title: string, conditions: PlanConditions, related: boolean): string {
  const name = title.trim();
  const details = [
    ...(conditions.timing.trim() ? [item(`운영 시기: ${normalizeDates(conditions.timing.trim())}`)] : []),
    ...(draft.meta.budgetStatus === 'specified' && draft.budget.length ? [item(`소요 예산: ${officialAmount(planBudgetSum(draft))}`)] : draft.meta.budgetStatus === 'confirmed_none' ? [item('소요 예산: 비예산')] : []),
  ];
  const sentence = `「${name}」${objectParticle(name)} ${details.length ? '다음과 같이' : '붙임과 같이'} 수립하여 시행하고자 합니다.`;
  const attachments = [`${name} 1부.`];
  // 편람 61쪽: 본문 문장 아래 항목은 1.부터. 관련 공문이 있으면 "1. 관련", "2. 위 관련으로 …" 아래에 가. 나.로 둔다.
  return related
    ? draftBodyText({ items: [item(`관련: ${DRAFT_PLACEHOLDER}`), item(`위 관련으로 ${sentence}`, details)], attachments })
    : draftBodyText({ lead: sentence, items: details, attachments });
}
