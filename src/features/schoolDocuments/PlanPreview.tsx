import { planBudgetTotal, type PlanAnalysis, type PlanDraft } from '../../../supabase/functions/_shared/schoolPlan';
const won = (value: number) => `${value.toLocaleString('ko-KR')}원`;
export function PlanPreview({ draft, analysis }: {
    draft: PlanDraft;
    analysis: PlanAnalysis | null;
}) {
    const refs = (ids: string[]) => ids.length > 0 ? <p className="mt-2 text-xs leading-5 text-slate-600">공문 근거: {ids.map(id => analysis?.requirements.find(r => r.id === id)?.text).filter(Boolean).join(' · ')}</p> : <p className="mt-2 text-xs text-slate-600">학교 입력 조건을 바탕으로 작성한 제안</p>;
    return <article aria-label="운영계획서 초안" className="space-y-7 break-words rounded-xl border border-slate-200 bg-white p-5 sm:p-8">
    <div><p className="mb-2 text-sm font-bold text-amber-800">AI 작성 초안 · 학교 확인 전</p><h2 className="text-xl font-bold leading-relaxed text-slate-900">{draft.title}</h2></div>
    {draft.sections.map((section, index) => <section key={section.id}><h3 className="mb-3 text-base font-bold">{index + 1}. {section.heading}</h3><div className="space-y-2 text-[15px] leading-7 text-slate-800">{section.paragraphs.map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}</div>{refs(section.requirementIds)}</section>)}
    <section><h3 className="mb-3 text-base font-bold">세부추진 일정안</h3><div className="space-y-3">{draft.schedule.map((s, i) => <div key={i} className="rounded-lg bg-slate-50 p-4 text-sm leading-6"><p className="font-bold">{s.when}</p><p>{s.activity}</p><p className="text-slate-600">담당: {s.owner}</p>{refs(s.requirementIds)}</div>)}</div></section>
    <section><h3 className="mb-3 text-base font-bold">예산안</h3>{draft.budget.length ? <><ul className="space-y-3">{draft.budget.map((b, i) => <li key={i} className="text-sm leading-6"><p className="flex flex-wrap justify-between gap-x-4"><span>{b.item} · {won(b.unitPrice)} × {b.quantity}</span><strong>{won(b.unitPrice * b.quantity)}</strong></p>{refs(b.requirementIds)}</li>)}</ul><p className="mt-4 border-t border-slate-200 pt-3 text-right font-bold">합계 {won(planBudgetTotal(draft))}</p><p className="mt-2 text-sm leading-6 text-slate-600">단가와 배분은 제안입니다. 실제 견적과 집행 가능 항목을 확인해 주세요.</p></> : <p className="text-sm leading-6 text-slate-600">예산이 없거나 미정이어서 금액표를 만들지 않았습니다.</p>}</section>
    {draft.unknowns.length > 0 && <section className="rounded-lg border border-amber-200 bg-amber-50 p-4"><h3 className="font-bold text-amber-950">학교에서 확인할 사항</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-amber-950">{draft.unknowns.map((u, i) => <li key={i}>{u}</li>)}</ul></section>}
  </article>;
}
