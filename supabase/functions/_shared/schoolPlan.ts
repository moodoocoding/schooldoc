import { PLAN_REFERENCE_VERSION, validatePlanReferenceChoice, type PlanReferenceChoice } from './schoolPlanReferences.ts';
// Browser and Edge Function share the same bounded, source-grounded contract.
export interface PlanSourcePart { id: string; label: string; text: string }
export interface PlanSource { id: string; name: string; parts: PlanSourcePart[] }
export interface PlanRequirement {
  id: string; text: string; kind: 'required' | 'recommended' | 'example';
  sourceId: string; partId: string; quote: string;
}
export interface PlanAnalysis {
  title: string; summary: string; requirements: PlanRequirement[];
  questions: { id: string; label: string; hint: string }[];
  budgetLimit: { amount: number; requirementId: string } | null;
}
export interface PlanConditions { topic: string; timing: string; budget: number | null }
export interface PlanSection { id: string; heading: string; paragraphs: string[]; requirementIds: string[] }
export interface PlanDraft {
  title: string; sections: PlanSection[];
  schedule: { when: string; activity: string; owner: string; requirementIds: string[] }[];
  budget: { item: string; unitPrice: number; quantity: number; requirementIds: string[] }[];
  unknowns: string[];
}
export interface PlanContext {
  sources: PlanSource[]; analysis: PlanAnalysis | null;
  answers: Record<string, string>; conditions: PlanConditions;
  referenceType?: PlanReferenceChoice; referenceVersion?: string;
  /** 처음에 고른 출력 분량. AI가 이 분량에 맞춰 쓴다. */
  pages?: PlanPages;
}
export const PLAN_PAGE_OPTIONS = [1, 2, 3, 4, 5] as const;
export type PlanPages = typeof PLAN_PAGE_OPTIONS[number];
export const isPlanPages = (value: unknown): value is PlanPages => typeof value === 'number' && PLAN_PAGE_OPTIONS.includes(value as PlanPages);
export type PlanRequest = { action: 'analyze'; sources: PlanSource[] }
  | ({ action: 'draft' } & PlanContext)
  | ({ action: 'revise'; draft: PlanDraft; revision: { area: string; instruction: string } } & PlanContext);

export const PLAN_LIMITS = { files: 3, sourceChars: 40000, parts: 150, partChars: 8000, fileBytes: 10 * 1024 * 1024 };
export const PLAN_PROFILE = { id: 'operating-plan', version: 1, name: '운영계획서' } as const;
const fail = (message = '문서 데이터 형식을 확인해 주세요.'): never => { throw new Error(message); };
const obj = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : fail();
export const hasInvalidPlanChars = (v: string) => [...v].some(c => c.charCodeAt(0) < 32 && ![9, 10, 13].includes(c.charCodeAt(0)));
const text = (v: unknown, max: number, empty = false): string => typeof v === 'string' && v.length <= max && (empty || !!v.trim()) && !hasInvalidPlanChars(v) ? v : fail();
const list = (v: unknown, max: number): unknown[] => Array.isArray(v) && v.length <= max ? v : fail();
const unique = (ids: string[]) => { if (new Set(ids).size !== ids.length) fail('중복된 문서 항목이 있습니다.'); };
const id = (v: unknown) => { const result = text(v, 80); if (!/^[a-zA-Z0-9_-]+$/.test(result)) fail(); return result; };
const money = (v: unknown): number => Number.isSafeInteger(v) && Number(v) >= 0 && Number(v) <= 100_000_000 ? Number(v) : fail('예산은 0원부터 1억원까지 정수로 입력해 주세요.');
export const normalizePlanQuote = (v: string) => v.replace(/\s+/g, '');
export function validatePlanSources(value: unknown): PlanSource[] {
  let total = 0;
  const result = list(value, PLAN_LIMITS.files).map(v => {
    const s = obj(v);
    const parts = list(s.parts, PLAN_LIMITS.parts).map(v => {
      const p = obj(v), body = text(p.text, PLAN_LIMITS.partChars);
      total += body.length;
      return { id: id(p.id), label: text(p.label, 120), text: body };
    });
    if (!parts.length) fail('읽을 수 있는 본문이 없습니다. 본문을 붙여 넣어 주세요.');
    unique(parts.map(p => p.id));
    return { id: id(s.id), name: text(s.name, 200), parts };
  });
  unique(result.map(s => s.id));
  if (total > PLAN_LIMITS.sourceChars) fail('공문과 붙임의 전체 본문은 4만 자 이내로 나누어 주세요.');
  return result;
}
export function validatePlanAnalysis(value: unknown, sources: PlanSource[]): PlanAnalysis {
  const a = obj(value);
  const requirements = list(a.requirements, 24).map(v => {
    const r = obj(v);
    const sourceId = id(r.sourceId), partId = id(r.partId), quote = text(r.quote, 500);
    const part = sources.find(s => s.id === sourceId)?.parts.find(p => p.id === partId);
    if (!part || !normalizePlanQuote(part.text).includes(normalizePlanQuote(quote))) fail('분석 결과의 인용문을 원문에서 찾지 못했습니다. 공문을 다시 분석해 주세요.');
    if (!['required', 'recommended', 'example'].includes(String(r.kind))) fail();
    return { id: id(r.id), text: text(r.text, 500), kind: r.kind as PlanRequirement['kind'], sourceId, partId, quote };
  });
  unique(requirements.map(r => r.id));
  const questions = list(a.questions, 9).map(v => { const q = obj(v); return { id: id(q.id), label: text(q.label, 180), hint: text(q.hint, 300, true) }; });
  unique(questions.map(q => q.id));
  let budgetLimit: PlanAnalysis['budgetLimit'] = null;
  if (a.budgetLimit !== null) {
    const b = obj(a.budgetLimit), amount = money(b.amount), requirementId = id(b.requirementId);
    const quote = requirements.find(r => r.id === requirementId && r.kind === 'required')?.quote ?? '';
    const amounts = [...quote.matchAll(/([\d,]+(?:\.\d+)?)\s*(백만|만|천)?\s*원/g)].map(m => Number(m[1].replaceAll(',', '')) * ({ 백만: 1000000, 만: 10000, 천: 1000 }[m[2]] ?? 1));
    if (!amounts.includes(amount)) fail('예산 상한의 금액을 원문 인용과 대조하지 못했습니다. 공문을 다시 분석해 주세요.');
    budgetLimit = { amount, requirementId };
  }
  return { title: text(a.title, 100), summary: text(a.summary, 1000), requirements, questions, budgetLimit };
}
export function validatePlanContext(value: unknown): PlanContext {
  const c = obj(value), sources = validatePlanSources(c.sources);
  const analysis = c.analysis === null && !sources.length ? null : validatePlanAnalysis(c.analysis, sources);
  const conditions = obj(c.conditions);
  const answers: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj(c.answers))) {
    if (!analysis?.questions.some(q => q.id === key)) fail();
    Object.defineProperty(answers, key, { value: text(value, 500, true), enumerable: true });
  }
  const budget = conditions.budget === null ? null : money(conditions.budget);
  if (budget !== null && analysis?.budgetLimit && budget > analysis.budgetLimit.amount) fail('학교 예산이 공문에서 확인한 상한을 넘습니다. 예산을 확인해 주세요.');
  const referenceType = c.referenceType === undefined ? undefined : validatePlanReferenceChoice(c.referenceType);
  if (c.pages !== undefined && !isPlanPages(c.pages)) fail('출력 분량을 확인해 주세요.');
  if (c.referenceVersion !== undefined && c.referenceVersion !== PLAN_REFERENCE_VERSION) fail('작성 기준이 갱신되었습니다. 입력을 보존한 뒤 화면을 새로고침해 주세요.');
  return { sources, analysis, answers, conditions: { topic: text(conditions.topic, 100), timing: text(conditions.timing, 200, true), budget },
    ...(referenceType === undefined ? {} : { referenceType }),
    ...(c.referenceVersion === undefined ? {} : { referenceVersion: PLAN_REFERENCE_VERSION }),
    ...(c.pages === undefined ? {} : { pages: c.pages as PlanPages }) };
}
/**
 * AI가 붙인 근거 ID 중 공문 분석에 없는 것(참고 사례 ID, 지어낸 ID)은 버린다.
 * 확인하지 않은 근거를 남기지 않으면서도 초안 전체를 실패시키지 않는다. 필수 요구사항 연결 검사는 validatePlanDraft가 그대로 한다.
 */
export function dropUnknownRequirementIds<T>(draft: T, context: Pick<PlanContext, 'analysis'>): T {
  if (!draft || typeof draft !== 'object') return draft;
  const known = new Set(context.analysis?.requirements.map(r => r.id) ?? []);
  const clean = (rows: unknown) => Array.isArray(rows) ? rows.map(row => row && typeof row === 'object' && Array.isArray((row as { requirementIds?: unknown }).requirementIds)
    ? { ...row, requirementIds: (row as { requirementIds: unknown[] }).requirementIds.filter(id => typeof id === 'string' && known.has(id)) } : row) : rows;
  const d = draft as Record<string, unknown>;
  return { ...d, sections: clean(d.sections), schedule: clean(d.schedule), budget: clean(d.budget) } as T;
}
export const planBudgetTotal = (draft: Pick<PlanDraft, 'budget'>) => draft.budget.reduce((sum, b) => sum + b.unitPrice * b.quantity, 0);
export function validatePlanDraft(value: unknown, context: PlanContext): PlanDraft {
  const d = obj(value), known = new Set(context.analysis?.requirements.map(r => r.id) ?? []);
  const refs = (v: unknown) => list(v, 24).map(v => { const result = id(v); if (!known.has(result)) fail('초안에 확인하지 않은 공문 근거가 있습니다.'); return result; });
  const sections = list(d.sections, 6).map(v => { const s = obj(v); const paragraphs = list(s.paragraphs, 8).map(v => text(v, 480)); if (!paragraphs.length) fail(); return { id: id(s.id), heading: text(s.heading, 40), paragraphs, requirementIds: refs(s.requirementIds) }; });
  if (sections.length < 2) fail('초안 본문이 부족합니다. 다시 작성해 주세요.');
  unique(sections.map(s => s.id));
  const schedule = list(d.schedule, 8).map(v => { const s = obj(v); return { when: text(s.when, 80), activity: text(s.activity, 180), owner: text(s.owner, 60), requirementIds: refs(s.requirementIds) }; });
  if (!schedule.length) fail('세부추진 일정이 없습니다. 다시 작성해 주세요.');
  const budget = list(d.budget, 6).map(v => { const b = obj(v); if (!Number.isSafeInteger(b.quantity) || Number(b.quantity) < 1 || Number(b.quantity) > 10000) fail(); return { item: text(b.item, 80), unitPrice: money(b.unitPrice), quantity: Number(b.quantity), requirementIds: refs(b.requirementIds) }; });
  const result = { title: text(d.title, 100), sections, schedule, budget, unknowns: list(d.unknowns, 9).map(v => text(v, 200)) };
  const total = planBudgetTotal(result);
  if (!Number.isSafeInteger(total) || total > 100_000_000) fail('예산 합계가 허용 범위를 넘습니다.');
  if ((context.conditions.budget === null || context.conditions.budget === 0) && budget.length) fail('예산이 미정이거나 없는 계획에는 임의의 금액표를 만들 수 없습니다.');
  if (context.conditions.budget !== null && total > context.conditions.budget) fail('초안의 예산안이 학교 예산을 넘습니다. 다시 작성해 주세요.');
  if (context.analysis?.budgetLimit && total > context.analysis.budgetLimit.amount) fail('초안의 예산안이 공문 상한을 넘습니다.');
  const covered = new Set([...sections, ...schedule, ...budget].flatMap(s => s.requirementIds));
  if (context.analysis?.requirements.some(r => r.kind === 'required' && !covered.has(r.id))) fail('공문의 필수 요구사항을 초안에 모두 연결하지 못했습니다. 다시 작성해 주세요.');
  return result;
}
export const planContextKey = (context: PlanContext) => JSON.stringify(context);

const string = { type: 'string' }, strings = { type: 'array', items: string };
const object = (properties: Record<string, unknown>) => ({ type: 'object', additionalProperties: false, properties, required: Object.keys(properties) });
const array = (properties: Record<string, unknown>) => ({ type: 'array', items: object(properties) });
export const planAnalysisSchema = object({ title: string, summary: string,
  requirements: array({ id: string, text: string, kind: { type: 'string', enum: ['required', 'recommended', 'example'] }, sourceId: string, partId: string, quote: string }),
  questions: array({ id: string, label: string, hint: string }),
  budgetLimit: { anyOf: [object({ amount: { type: 'integer' }, requirementId: string }), { type: 'null' }] },
});
export const planDraftSchema = object({ title: string,
  sections: array({ id: string, heading: string, paragraphs: strings, requirementIds: strings }),
  schedule: array({ when: string, activity: string, owner: string, requirementIds: strings }),
  budget: array({ item: string, unitPrice: { type: 'integer' }, quantity: { type: 'integer' }, requirementIds: strings }), unknowns: strings,
});
