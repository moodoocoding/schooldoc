import { planBudgetTotal, type PlanConditions, type PlanDraft, type PlanPages } from '../../../supabase/functions/_shared/schoolPlan';
import { EFFECTS_KEY } from '../../../supabase/functions/school-plan/authoringProfiles';
import { parseParagraphItems, type PlanItemNode } from '../../../supabase/functions/_shared/planItems';
import { draftBodyText } from '../officialDocument/draftBody';
import { checkOfficialDocument, normalizeDates, officialAmount, type OfficialCheck } from '../officialDocument/lint';
import { item, note, table, type OfficialDocument } from '../officialDocument/model';

/**
 * 운영계획서 초안 → 공문 문서 모델. 무엇을 어떤 순서로 쓸지만 정하고,
 * 항목 기호·들여쓰기·글꼴은 공통 출력 계층(officialDocument)이 정한다.
 */
export function planToOfficialDocument(draft: PlanDraft, title: string, _pages: PlanPages): OfficialDocument {
  if (!title.trim() || title.length > 100 || [...title].some(c => c.charCodeAt(0) < 32)) throw new Error('문서 제목을 100자 이내로 확인해 주세요.');
  const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;
  const budget = draft.budget.length
    ? [
      table([{ label: '항목', width: 20500 }, { label: '단가', width: 10000, align: 'right' }, { label: '수량', width: 6500, align: 'right' }, { label: '금액', width: 11100, align: 'right' }],
        draft.budget.map(b => [b.item, won(b.unitPrice), String(b.quantity), won(b.unitPrice * b.quantity)])),
      note(`합계 ${officialAmount(planBudgetTotal(draft))}. 단가와 배분은 제안이며 집행 기준·실제 견적 확인 필요`),
    ]
    : [note('예산 없음 또는 미정: 금액 확정 후 집행 기준에 따라 확인')];
  // 문단 안의 들여 쓴 줄은 하위 항목이다(가. 활동 → 1) 운영 방법 → 가) 단계).
  const node = (n: PlanItemNode): ReturnType<typeof item> => item(n.text, n.children.map(node));
  const section = (s: PlanDraft['sections'][number]) => item(s.heading, s.paragraphs.map(p => node(parseParagraphItems(p))));
  return {
    kind: 'attachment-plan',
    title: title.trim(),
    body: [
      ...draft.sections.filter(s => s.id !== EFFECTS_KEY).map(section),
      // 본문과 표는 자연스럽게 이어 조판한다. 빈 페이지나 강제 나눔으로 희망 분량을 채우지 않는다.
      item('세부추진 일정(안)', draft.schedule.length ? [table([{ label: '시기', width: 11600 }, { label: '활동', width: 23500 }, { label: '담당', width: 13000 }], draft.schedule.map(s => [s.when, s.activity, s.owner]))] : []),
      item('소요 예산(안)', budget),
      // 기대 효과는 예산 뒤 마지막 목차다. 학교 확인 사항(unknowns)은 문서에 넣지 않고 검토 화면에만 보여 준다.
      ...draft.sections.filter(s => s.id === EFFECTS_KEY).map(section),
    ],
  };
}

/** 저장 전에 공문 표기를 점검하고 기호·날짜 표기를 고친 문서를 돌려준다. */
export const checkedPlanDocument = (draft: PlanDraft, title: string, pages: PlanPages): OfficialCheck => checkOfficialDocument(planToOfficialDocument(draft, title, pages));

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
    ...(draft.budget.length ? [item(`소요 예산: ${officialAmount(planBudgetTotal(draft))}`)] : conditions.budget === 0 ? [item('소요 예산: 없음')] : []),
  ];
  const sentence = `「${name}」${objectParticle(name)} ${details.length ? '다음과 같이' : '붙임과 같이'} 수립하여 시행하고자 합니다.`;
  const attachments = [`${name} 1부.`];
  // 편람 61쪽: 본문 문장 아래 항목은 1.부터. 관련 공문이 있으면 "1. 관련", "2. 위 관련으로 …" 아래에 가. 나.로 둔다.
  return related
    ? draftBodyText({ items: [item(`관련: ${DRAFT_PLACEHOLDER}`), item(`위 관련으로 ${sentence}`, details)], attachments })
    : draftBodyText({ lead: sentence, items: details, attachments });
}
