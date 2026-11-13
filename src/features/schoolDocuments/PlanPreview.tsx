import { legacyPlanBudgetTotal, type PlanDraft, type PlanDraftV1 } from '../../../supabase/functions/_shared/schoolPlan';
import { planBudgetRowAmount, planBudgetSum } from '../../../supabase/functions/_shared/planDocumentV2';
import { STANDARD_PLAN_TEMPLATE } from './planDocument';

const won = (value: number) => `${value.toLocaleString('ko-KR')}원`;
const h = 'mb-2 text-base font-bold';
const List = ({ items }: { items: string[] }) => <ul className="list-disc space-y-1 pl-5">{items.map((t, i) => <li key={i}>{t}</li>)}</ul>;

/** 수정안 비교용 본문 미리보기. 목차 이름·순서는 문서 출력과 같은 표준 서식을 쓴다. */
export function PlanPreview({ draft }: { draft: PlanDraft }) {
  const t = STANDARD_PLAN_TEMPLATE.headings, o = draft.overview;
  const overview = ([['기간', o.period], ['대상', o.target], ['장소', o.venue], ['내용', o.summary]] as const).filter(([, v]) => v);
  return <article aria-label="운영계획서 초안" className="space-y-6 break-words rounded-xl border border-slate-200 bg-white p-5 text-[15px] leading-7 text-slate-800 sm:p-8">
    <h2 className="text-xl font-bold leading-relaxed text-slate-900">{draft.title}</h2>
    <section><h3 className={h}>1. {t.purpose}</h3><List items={draft.purpose}/></section>
    <section><h3 className={h}>2. {t.overview}</h3>{overview.length ? <List items={overview.map(([k, v]) => `${k}: ${v}`)}/> : <p className="text-slate-600">미정</p>}</section>
    <section><h3 className={h}>3. {t.policies}</h3>{draft.policies.length ? <List items={draft.policies}/> : <p className="text-slate-600">없음</p>}</section>
    <section><h3 className={h}>4. {t.detailedPlans}</h3><div className="space-y-3">{draft.detailedPlans.map((p, i) => <div key={i}><p className="font-bold">{p.subTitle}</p><List items={p.details}/></div>)}
      {draft.schedule.length > 0 && <div><p className="font-bold">{STANDARD_PLAN_TEMPLATE.scheduleHeading}</p><List items={draft.schedule.map(s => `${s.step} · ${s.task} · ${s.date ?? '시기 미정'} · ${s.owner ?? '담당 미정'}`)}/></div>}</div></section>
    <section><h3 className={h}>5. {t.budget}</h3>{draft.meta.budgetStatus === 'specified' && draft.budget.length
      ? <><List items={draft.budget.map(b => { const a = planBudgetRowAmount(b); return `${b.item}(${b.spec}) ${a === null ? '금액 미정' : won(a)}`; })}/><p className="mt-2 font-bold">합계 {won(planBudgetSum(draft))}</p></>
      : <p>{draft.meta.budgetStatus === 'confirmed_none' ? '비예산' : '예산 미정(검토 필요)'}</p>}</section>
    <section><h3 className={h}>6. {t.expectedEffects}</h3><List items={draft.expectedEffects}/></section>
  </article>;
}

/** 이전(v1) 형식 초안. 보존한 원문을 그대로 보여 준다. */
export function LegacyPlanPreview({ draft }: { draft: PlanDraftV1 }) {
  return <div className="space-y-5 break-words text-[15px] leading-7 text-slate-800">
    <h3 className="text-lg font-bold">{draft.title}</h3>
    {draft.sections.map((s, i) => <section key={s.id}><h4 className="font-bold">{i + 1}. {s.heading}</h4>{s.paragraphs.map((p, j) => <p key={j} className="whitespace-pre-wrap">{p}</p>)}</section>)}
    {draft.schedule.length > 0 && <section><h4 className="font-bold">일정</h4><List items={draft.schedule.map(s => `${s.when} · ${s.activity} · ${s.owner}`)}/></section>}
    {draft.budget.length > 0 && <section><h4 className="font-bold">예산</h4><List items={draft.budget.map(b => `${b.item} ${won(b.unitPrice * b.quantity)}`)}/><p className="font-bold">합계 {won(legacyPlanBudgetTotal(draft))}</p></section>}
  </div>;
}
