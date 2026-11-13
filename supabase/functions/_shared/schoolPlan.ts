import { PLAN_REFERENCE_VERSION, validatePlanReferenceChoice, type PlanReferenceChoice } from './schoolPlanReferences.ts';
import type { PlanDocumentV2 } from './planDocumentV2.ts';
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
/** 현재 초안 형식. 정의는 planDocumentV2.ts. */
export type PlanDraft = PlanDocumentV2;
/** 2026-11-14 이전(v1) 초안: AI가 정한 목차(sections). 읽기·보존만 한다. */
export interface PlanSection { id: string; heading: string; paragraphs: string[]; requirementIds: string[] }
export interface PlanDraftV1 {
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
  | ({ action: 'revise'; draft: PlanDraft; revision: { area: 'body' | 'schedule' | 'budget'; instruction: string } } & PlanContext);

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
export const legacyPlanBudgetTotal = (draft: Pick<PlanDraftV1, 'budget'>) => draft.budget.reduce((sum, b) => sum + b.unitPrice * b.quantity, 0);
/** 이전(v1) 초안을 보존용으로 읽는다. 형식만 확인하고 다시 검증·변환하지 않는다. */
export function validateLegacyPlanDraft(value: unknown): PlanDraftV1 {
  const d = obj(value);
  const sections = list(d.sections, 8).map(v => { const s = obj(v); return { id: text(s.id, 80), heading: text(s.heading, 40), paragraphs: list(s.paragraphs, 10).map(v => text(v, 2500)), requirementIds: list(s.requirementIds, 24).map(v => text(v, 80)) }; });
  const schedule = list(d.schedule, 8).map(v => { const s = obj(v); return { when: text(s.when, 80), activity: text(s.activity, 180), owner: text(s.owner, 60), requirementIds: list(s.requirementIds, 24).map(v => text(v, 80)) }; });
  const budget = list(d.budget, 6).map(v => { const b = obj(v); return { item: text(b.item, 80), unitPrice: money(b.unitPrice), quantity: Number.isSafeInteger(b.quantity) ? Number(b.quantity) : fail(), requirementIds: list(b.requirementIds, 24).map(v => text(v, 80)) }; });
  return { title: text(d.title, 100), sections, schedule, budget, unknowns: list(d.unknowns, 9).map(v => text(v, 200)) };
}
export const planContextKey = (context: PlanContext) => JSON.stringify(context);

const string = { type: 'string' };
const object = (properties: Record<string, unknown>) => ({ type: 'object', additionalProperties: false, properties, required: Object.keys(properties) });
const array = (properties: Record<string, unknown>) => ({ type: 'array', items: object(properties) });
export const planAnalysisSchema = object({ title: string, summary: string,
  requirements: array({ id: string, text: string, kind: { type: 'string', enum: ['required', 'recommended', 'example'] }, sourceId: string, partId: string, quote: string }),
  questions: array({ id: string, label: string, hint: string }),
  budgetLimit: { anyOf: [object({ amount: { type: 'integer' }, requirementId: string }), { type: 'null' }] },
});
