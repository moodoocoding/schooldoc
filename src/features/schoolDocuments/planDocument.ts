import { planBudgetTotal, type PlanDraft } from '../../../supabase/functions/_shared/schoolPlan';
import { checkOfficialDocument, officialAmount, type OfficialCheck } from '../officialDocument/lint';
import { item, note, table, type OfficialDocument } from '../officialDocument/model';

/**
 * 운영계획서 초안 → 공문 문서 모델. 무엇을 어떤 순서로 쓸지만 정하고,
 * 항목 기호·들여쓰기·글꼴은 공통 출력 계층(officialDocument)이 정한다.
 */
export function planToOfficialDocument(draft: PlanDraft, title: string, pages: 1 | 2): OfficialDocument {
  if (!title.trim() || title.length > 100 || [...title].some(c => c.charCodeAt(0) < 32)) throw new Error('문서 제목을 100자 이내로 확인해 주세요.');
  const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;
  const budget = draft.budget.length
    ? [
      table([{ label: '항목', width: 20500 }, { label: '단가', width: 10000, align: 'right' }, { label: '수량', width: 6500, align: 'right' }, { label: '금액', width: 11100, align: 'right' }],
        draft.budget.map(b => [b.item, won(b.unitPrice), String(b.quantity), won(b.unitPrice * b.quantity)])),
      note(`합계 ${officialAmount(planBudgetTotal(draft))}. 단가와 배분은 제안이며 집행 기준·실제 견적 확인 필요`),
    ]
    : [note('예산 없음 또는 미정: 금액 확정 후 집행 기준에 따라 확인')];
  return {
    kind: 'attachment-plan',
    title: title.trim(),
    body: [
      ...draft.sections.map(section => item(section.heading, section.paragraphs.map(p => item(p)))),
      // 2쪽 출력은 본문(1쪽)과 일정·예산(2쪽)으로 나눈다.
      item('세부추진 일정(안)', draft.schedule.length ? [table([{ label: '시기', width: 11600 }, { label: '활동', width: 23500 }, { label: '담당', width: 13000 }], draft.schedule.map(s => [s.when, s.activity, s.owner]))] : [], { pageBreakBefore: pages === 2 }),
      item('소요 예산(안)', budget),
      ...(draft.unknowns.length ? [item('학교 확인 사항', draft.unknowns.map(note))] : []),
    ],
  };
}

/** 저장 전에 공문 표기를 점검하고 기호·날짜 표기를 고친 문서를 돌려준다. */
export const checkedPlanDocument = (draft: PlanDraft, title: string, pages: 1 | 2): OfficialCheck => checkOfficialDocument(planToOfficialDocument(draft, title, pages));
