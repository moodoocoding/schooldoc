import { legacyPlanBudgetTotal, type PlanDraft, type PlanDraftV1 } from '../../../supabase/functions/_shared/schoolPlan';
import { planBudgetRowAmount, planBudgetSum } from '../../../supabase/functions/_shared/planDocumentV2';
import { STANDARD_PLAN_TEMPLATE } from './planDocument';

const won = (value: number) => `${value.toLocaleString('ko-KR')}원`;
const List = ({ items }: { items: string[] }) => <ul className="list-disc space-y-1 pl-5">{items.map((t, i) => <li key={i}>{t}</li>)}</ul>;

/** 비교용 목차별 줄. 문서 출력과 같은 목차 이름·순서를 쓴다. */
function planSections(draft: PlanDraft): { title: string; lines: string[] }[] {
  const t = STANDARD_PLAN_TEMPLATE.headings, o = draft.overview;
  const overviewEntries = [['기간', o.period], ['대상', o.target], ['장소', o.venue], ['내용', o.summary]] as const;
  const overviewLines = overviewEntries.some(([, v]) => v)
    ? overviewEntries.map(([k, v]) => `${k}: ${v ?? '미정'}`)
    : ['운영 개요 미정(검토 필요)'];
  return [
    { title: t.background, lines: draft.background ?? [] },
    { title: t.purpose, lines: draft.purpose },
    { title: t.policies, lines: draft.policies },
    { title: t.detailedPlans, lines: [`[${t.overview}]`, ...overviewLines, ...draft.detailedPlans.flatMap(p => [`[${p.subTitle}]`, ...p.details])] },
    { title: STANDARD_PLAN_TEMPLATE.scheduleHeading, lines: draft.schedule.map(s => `${s.step} · ${s.task} · ${s.date ?? '시기 미정'} · ${s.owner ?? '담당 미정'}`) },
    { title: t.budget, lines: draft.meta.budgetStatus === 'specified' && draft.budget.length
      ? [...draft.budget.map(b => { const a = planBudgetRowAmount(b); return `${b.item}(${b.spec}) ${b.unitPrice === null ? '미정' : won(b.unitPrice)} × ${b.quantity ?? '미정'} = ${a === null ? '금액 미정' : won(a)}${b.note ? ` · ${b.note}` : ''}`; }), `합계 ${won(planBudgetSum(draft))}`]
      : [draft.meta.budgetStatus === 'confirmed_none' ? '비예산' : '예산 미정(검토 필요)'] },
    { title: t.expectedEffects, lines: draft.expectedEffects },
  ];
}

/** 수정안 비교: 바뀐 목차만 기존·수정안을 나란히 보이고, 빠진 줄과 새 줄을 표시한다. */
export function PlanChanges({ before, after }: { before: PlanDraft; after: PlanDraft }) {
  const old = planSections(before), next = planSections(after);
  const changed = next.flatMap((section, i) => JSON.stringify(section.lines) === JSON.stringify(old[i].lines) ? [] : [{ title: section.title, before: old[i].lines, after: section.lines }]);
  if (!changed.length) return <p className="rounded-xl border border-slate-200 bg-white p-5 text-slate-700">바뀐 내용이 없습니다.</p>;
  const side = (label: string, lines: string[], other: string[], mark: 'del' | 'ins') => <div className="min-w-0">
    <p className="mb-2 text-sm font-bold text-slate-600">{label}</p>
    {lines.length ? <ul className="space-y-1">{lines.map((line, i) => {
      if (other.includes(line)) return <li key={i} className="px-2 text-slate-700">{line}</li>;
      return mark === 'del'
        ? <li key={i}><del className="block rounded bg-red-50 px-2 text-red-800">{line}</del></li>
        : <li key={i}><ins className="block rounded bg-emerald-50 px-2 font-medium text-emerald-900 no-underline">{line}</ins></li>;
    })}</ul> : <p className="px-2 text-slate-500">없음</p>}
  </div>;
  return <div role="group" className="space-y-4" aria-label="수정안에서 바뀐 목차">
    {changed.map(c => <section key={c.title} className="rounded-xl border border-slate-200 bg-white p-5 text-[15px] leading-7 break-words">
      <h3 className="mb-3 text-base font-bold text-slate-900">{c.title}</h3>
      <div className="grid gap-5 lg:grid-cols-2">{side('기존 초안', c.before, c.after, 'del')}{side('AI 수정안', c.after, c.before, 'ins')}</div>
    </section>)}
  </div>;
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
