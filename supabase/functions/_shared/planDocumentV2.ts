/**
 * 운영계획서 v2 계약(PlanDocumentV2). 브라우저와 Edge Function이 같은 정의를 쓴다.
 *
 * AI는 의미가 정해진 고정 필드에 내용만 쓴다. 목차 이름·순서·번호·표는 렌더러(src/features/schoolDocuments/planDocument.ts)가 정한다.
 * - 구조 검사(validatePlanDocument): 형식이 틀리면 예외. 초안으로 받지 않는다.
 * - 의미 검사(checkPlanDocument): 예산·일정·필수 조건·근거 없는 내용을 찾아 교사 검토 화면에 알린다. 자동으로 고치지 않는다.
 */
import type { PlanContext, PlanRequirement } from './schoolPlan.ts';

export const PLAN_SCHEMA_VERSION = '2.0';
export type BudgetStatus = 'specified' | 'confirmed_none' | 'unconfirmed';
export interface PlanOverview { period: string | null; target: string | null; venue: string | null; summary: string | null }
export interface PlanDetailedPlan { subTitle: string; details: string[] }
export interface PlanScheduleRow { step: string; task: string; date: string | null; owner: string | null }
export interface PlanBudgetRow { item: string; spec: string; unitPrice: number | null; quantity: number | null; total: number | null; note: string | null }
export interface PlanDocumentV2 {
  schemaVersion: typeof PLAN_SCHEMA_VERSION;
  title: string;
  purpose: string[];
  overview: PlanOverview;
  policies: string[];
  detailedPlans: PlanDetailedPlan[];
  schedule: PlanScheduleRow[];
  budget: PlanBudgetRow[];
  expectedEffects: string[];
  meta: { requirementIds: string[]; unknowns: string[]; budgetStatus: BudgetStatus };
}

/** 길이·개수 한도의 유일한 출처. 응답 스키마와 구조 검사가 함께 쓴다. */
export const PLAN_V2_LIMITS = {
  title: 100, line: 300, purpose: 4, policies: 6, plans: 8, subTitle: 40, details: 10,
  schedule: 10, step: 20, task: 160, date: 60, owner: 50,
  budget: 8, item: 60, spec: 120, note: 80, money: 100_000_000, quantity: 10_000,
  effects: 5, ids: 24, unknowns: 8, unknown: 200,
} as const;
const L = PLAN_V2_LIMITS;

// ── 응답 스키마(OpenAI Structured Outputs strict 부분집합) ──
const str = (maxLength: number) => ({ type: 'string', minLength: 1, maxLength });
const nullable = (schema: Record<string, unknown>) => ({ ...schema, type: [schema.type, 'null'] });
const obj = (properties: Record<string, unknown>) => ({ type: 'object', additionalProperties: false, properties, required: Object.keys(properties) });
const arr = (items: unknown, maxItems: number, minItems = 0) => ({ type: 'array', minItems, maxItems, items });
const fields = {
  purpose: arr(str(L.line), L.purpose, 1),
  overview: obj({ period: nullable(str(L.line)), target: nullable(str(L.line)), venue: nullable(str(L.line)), summary: nullable(str(L.line)) }),
  policies: arr(str(L.line), L.policies),
  detailedPlans: arr(obj({ subTitle: str(L.subTitle), details: arr(str(L.line), L.details, 1) }), L.plans, 1),
  schedule: arr(obj({ step: str(L.step), task: str(L.task), date: nullable(str(L.date)), owner: nullable(str(L.owner)) }), L.schedule),
  budget: arr(obj({
    item: str(L.item), spec: str(L.spec),
    unitPrice: { type: ['integer', 'null'], minimum: 0, maximum: L.money },
    quantity: { type: ['integer', 'null'], minimum: 1, maximum: L.quantity },
    total: { type: ['integer', 'null'], minimum: 0, maximum: L.money },
    note: nullable(str(L.note)),
  }), L.budget),
  expectedEffects: arr(str(L.line), L.effects, 1),
  meta: obj({ requirementIds: arr(str(80), L.ids), unknowns: arr(str(L.unknown), L.unknowns), budgetStatus: { type: 'string', enum: ['specified', 'confirmed_none', 'unconfirmed'] } }),
};
export const planDocumentSchema = obj({ schemaVersion: { type: 'string', enum: [PLAN_SCHEMA_VERSION] }, title: str(L.title), ...fields });

/** 부분 수정 영역별로 AI가 다시 쓰는 필드. meta는 근거·미정 사항·예산 상태가 함께 바뀌므로 늘 같이 받는다. */
export const PLAN_REVISION_FIELDS = {
  body: ['purpose', 'overview', 'policies', 'detailedPlans', 'expectedEffects', 'meta'],
  schedule: ['schedule', 'meta'],
  budget: ['budget', 'meta'],
} as const satisfies Record<string, (keyof typeof fields)[]>;
export type PlanRevisionArea = keyof typeof PLAN_REVISION_FIELDS;
export const planRevisionSchema = (area: PlanRevisionArea) => obj(Object.fromEntries(PLAN_REVISION_FIELDS[area].map(k => [k, fields[k]])));

// ── 구조 검사 ──
const fail = (message = '초안 형식을 확인해 주세요.'): never => { throw new Error(message); };
const record = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : fail();
const badChars = (v: string) => [...v].some(c => c.charCodeAt(0) < 32 && c !== '\n');
// 출력 프로그램이 붙이는 항목 기호. 내용 앞에 들어오면 뗀다(날짜·학년 같은 실제 숫자는 그대로 둔다).
const MARKER = /^\s*(?:\d{1,2}[.)]\s+(?!\d)|[가-하][.)]\s+|\((?:\d{1,2}|[가-하])\)\s*|[①-⑳㉮-㉻□■○●◦◯ㆍ·•▪▶►※\-–—*]\s*)/u;
export const stripPlanMarker = (v: string) => v.replace(MARKER, '').trim();
const line = (v: unknown, max: number): string => {
  if (typeof v !== 'string') fail();
  const s = stripPlanMarker((v as string).replace(/\s+/g, ' '));
  return s && s.length <= max && !badChars(s) ? s : fail();
};
const maybe = (v: unknown, max: number) => v === null ? null : line(v, max);
const list = <T>(v: unknown, max: number, min: number, map: (x: unknown) => T): T[] => Array.isArray(v) && v.length >= min && v.length <= max ? v.map(map) : fail();
const int = (v: unknown, min: number, max: number) => v === null ? null : Number.isSafeInteger(v) && Number(v) >= min && Number(v) <= max ? Number(v) : fail('예산 금액·수량은 정수로 입력해 주세요.');

export const isPlanDocumentV2 = (v: unknown): v is PlanDocumentV2 => !!v && typeof v === 'object' && (v as { schemaVersion?: unknown }).schemaVersion === PLAN_SCHEMA_VERSION;

/** 형식이 맞는 v2 초안만 돌려준다. 공문 분석에 없는 근거 ID(참고 사례 ID·지어낸 ID)는 지운다. */
export function validatePlanDocument(value: unknown, context: Pick<PlanContext, 'analysis'>): PlanDocumentV2 {
  const d = record(value);
  if (d.schemaVersion !== PLAN_SCHEMA_VERSION) fail('이전 형식의 초안입니다. 초안을 다시 작성해 주세요.');
  const o = record(d.overview), m = record(d.meta);
  const known = new Set(context.analysis?.requirements.map(r => r.id) ?? []);
  if (!['specified', 'confirmed_none', 'unconfirmed'].includes(String(m.budgetStatus))) fail();
  return {
    schemaVersion: PLAN_SCHEMA_VERSION,
    title: line(d.title, L.title),
    purpose: list(d.purpose, L.purpose, 1, v => line(v, L.line)),
    overview: { period: maybe(o.period, L.line), target: maybe(o.target, L.line), venue: maybe(o.venue, L.line), summary: maybe(o.summary, L.line) },
    policies: list(d.policies, L.policies, 0, v => line(v, L.line)),
    detailedPlans: list(d.detailedPlans, L.plans, 1, v => { const p = record(v); return { subTitle: line(p.subTitle, L.subTitle), details: list(p.details, L.details, 1, x => line(x, L.line)) }; }),
    schedule: list(d.schedule, L.schedule, 0, v => { const s = record(v); return { step: line(s.step, L.step), task: line(s.task, L.task), date: maybe(s.date, L.date), owner: maybe(s.owner, L.owner) }; }),
    budget: list(d.budget, L.budget, 0, v => { const b = record(v); return { item: line(b.item, L.item), spec: line(b.spec, L.spec), unitPrice: int(b.unitPrice, 0, L.money), quantity: int(b.quantity, 1, L.quantity), total: int(b.total, 0, L.money), note: maybe(b.note, L.note) }; }),
    expectedEffects: list(d.expectedEffects, L.effects, 1, v => line(v, L.line)),
    meta: {
      requirementIds: [...new Set(list(m.requirementIds, L.ids, 0, v => typeof v === 'string' ? v : fail()))].filter(id => known.has(id)),
      unknowns: list(m.unknowns, L.unknowns, 0, v => line(v, L.unknown)),
      budgetStatus: m.budgetStatus as BudgetStatus,
    },
  };
}

/** 단가×수량으로 계산한 행 금액. 금액을 알 수 없는 행은 null. */
export const planBudgetRowAmount = (b: PlanBudgetRow) => b.unitPrice !== null && b.quantity !== null ? b.unitPrice * b.quantity : null;
export const planBudgetSum = (doc: Pick<PlanDocumentV2, 'budget'>) => doc.budget.reduce((sum, b) => sum + (planBudgetRowAmount(b) ?? 0), 0);

/** 문서 본문의 모든 문장(검색·대조용). */
export function planDocumentLines(doc: PlanDocumentV2): { where: string; text: string }[] {
  const o = doc.overview;
  return [
    ...doc.purpose.map(text => ({ where: '추진 목적', text })),
    ...([['기간', o.period], ['대상', o.target], ['장소', o.venue], ['내용', o.summary]] as const).flatMap(([k, v]) => v ? [{ where: `운영 개요(${k})`, text: v }] : []),
    ...doc.policies.map(text => ({ where: '운영 방침', text })),
    ...doc.detailedPlans.flatMap(p => [{ where: '세부 추진 계획', text: p.subTitle }, ...p.details.map(text => ({ where: `세부 추진 계획(${p.subTitle})`, text }))]),
    ...doc.schedule.map((s, i) => ({ where: `추진 일정 ${i + 1}행`, text: [s.step, s.task, s.date, s.owner].filter(Boolean).join(' ') })),
    ...doc.budget.map((b, i) => ({ where: `소요 예산 ${i + 1}행`, text: [b.item, b.spec, b.note].filter(Boolean).join(' ') })),
    ...doc.expectedEffects.map(text => ({ where: '기대 효과', text })),
  ];
}

// ── 의미 검사 ──
export type PlanIssueLevel = 'block' | 'warn' | 'confirm' | 'suggest';
export interface PlanIssue { level: PlanIssueLevel; where: string; message: string }
export const PLAN_ISSUE_LABELS: Record<PlanIssueLevel, string> = { block: '저장 전 고칠 점', warn: '검증 경고', confirm: '확정 필요', suggest: '제안 사항(승인 전)' };

const squash = (v: string) => v.replace(/[\s\p{P}]/gu, '');
interface PlanDate { y: number | null; m: number; d: number; weekday: string | null }
/** 2026. 11. 9.(월), 2026-11-09, 11. 9., 11월 9일 꼴의 날짜를 찾는다. */
export function findPlanDates(v: string, year: number | null = null): PlanDate[] {
  const out: PlanDate[] = [];
  const re = /(?:(\d{4})\s*[.-]\s*)?(\d{1,2})\s*[.-]\s*(\d{1,2})\s*\.?(?:\s*\(([월화수목금토일])\))?|(?:(\d{4})년\s*)?(\d{1,2})월\s*(\d{1,2})일(?:\s*\(([월화수목금토일])\))?/gu;
  for (const m of v.matchAll(re)) {
    const y = m[1] ?? m[5], mo = Number(m[2] ?? m[6]), d = Number(m[3] ?? m[7]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) continue;
    // "3.5%" 같은 소수와 구분: 연도도 요일도 없고 뒤에 점이 없으면 날짜로 보지 않는다.
    if (!y && !m[4] && !m[8] && m[2] && !/\.\s*$/.test(m[0]) && !/^\s*\./.test(v.slice((m.index ?? 0) + m[0].length))) continue;
    // '2027. 4. 1. ~ 4. 3.'의 뒤 날짜처럼 연도가 없으면 앞 날짜의 연도를 잇는다.
    out.push({ y: y ? Number(y) : out.at(-1)?.y ?? year, m: mo, d, weekday: m[4] ?? m[8] ?? null });
  }
  return out;
}
/** '추진 목적과', '운영 방침과'처럼 받침에 맞는 '과/와'를 붙인다. 괄호 앞 낱말을 기준으로 한다. */
const withGwa = (word: string) => {
  const last = word.replace(/\s*\([^)]*\)\s*$/u, '').trim().at(-1) ?? '';
  const code = last.charCodeAt(0) - 0xac00;
  return `${word}${code >= 0 && code < 11172 && code % 28 === 0 ? '와' : '과'}`;
};
const dayNumber = (p: PlanDate) => (p.y ?? 2000) * 400 + p.m * 32 + p.d;
const WEEKDAYS = '일월화수목금토';
// 운영 기간의 '~까지'와 구분해 제출·신청 마감만 본다.
const DEADLINE = /마감|기한|제출|신청/u;
const SUBMISSION = /제출|보고|신청|접수|등록/u;
// 사업에 필요하지 않으면 습관적으로 들어가기 쉬운 제도·행사.
const HABITUAL = ['시상', '심사', '위원회', 'TF', '발표회', '전시회', '우승', '수업 적용', '의무 시수', '자율과제'];
// 방법 없이 미루기만 하는 표현.
const VACUOUS = /(사전에|미리|추후|별도로?|나중에)\s*(정해|정하여|정한\s*뒤|결정|확정|안내\s*후)|정해\s*안내|안내\s*후\s*운영|방안\s*마련/u;
const COUNTED = /(\d[\d,]*)\s*(명|점|시간|차시|회|개교|팀|부|만\s*원|원)/gu;

export function checkPlanDocument(doc: PlanDocumentV2, context: PlanContext & { referenceTypeResolved?: string }): PlanIssue[] {
  const issues: PlanIssue[] = [];
  const add = (level: PlanIssueLevel, where: string, message: string) => issues.push({ level, where, message });
  const requirements: PlanRequirement[] = context.analysis?.requirements ?? [];
  const inputs = [context.conditions.topic, context.conditions.timing, ...Object.values(context.answers), context.analysis?.title ?? '', context.analysis?.summary ?? '', ...requirements.flatMap(r => [r.text, r.quote])].join('\n');
  const inputSquash = squash(inputs);
  const lines = planDocumentLines(doc);
  const year = findPlanDates(`${doc.overview.period ?? ''} ${context.conditions.timing}`).find(p => p.y)?.y ?? null;
  const givenDates = new Set(findPlanDates(inputs, year).map(p => `${p.m}. ${p.d}.`));

  // 예산: 상태와 표가 맞는지, 산출식·합계·상한.
  const status = doc.meta.budgetStatus, school = context.conditions.budget, limit = context.analysis?.budgetLimit?.amount ?? null;
  if (status === 'specified' && !doc.budget.length) add('block', '소요 예산', '예산이 있다고 했지만 예산표가 비어 있습니다.');
  if (status !== 'specified' && doc.budget.length) add('block', '소요 예산', '예산 없음·미정으로 표시했지만 예산표가 있습니다.');
  if (school === 0 && status !== 'confirmed_none') add('block', '소요 예산', '학교 예산을 0원(비예산)으로 입력했지만 문서는 비예산이 아닙니다.');
  if (school === null && limit === null && status === 'specified') add('block', '소요 예산', '학교 예산이 정해지지 않았는데 금액표를 만들었습니다. 예산을 입력하거나 예산 미정으로 다시 작성해 주세요.');
  if (school === null && status === 'confirmed_none' && !/비예산|예산\s*(없|미지원|0원)/u.test(inputs)) add('confirm', '소요 예산', '입력에 근거가 없는데 비예산으로 표시했습니다. 비예산이 맞는지 확인해 주세요.');
  if (status === 'unconfirmed') add('confirm', '소요 예산', '예산이 정해지지 않았습니다. 결재 전에 예산을 확정해 주세요.');
  doc.budget.forEach((b, i) => {
    const where = `소요 예산 ${i + 1}행(${b.item})`, amount = planBudgetRowAmount(b);
    const known = [b.unitPrice, b.quantity, b.total].filter(v => v !== null).length;
    if (known === 0) add('confirm', where, '단가·수량이 정해지지 않았습니다.');
    else if (known < 3) add('warn', where, '단가·수량·금액 중 일부만 있습니다. 산출 내역을 확인해 주세요.');
    else if (b.total !== amount) add('block', where, `금액 ${b.total!.toLocaleString('ko-KR')}원이 단가×수량(${amount!.toLocaleString('ko-KR')}원)과 다릅니다.`);
  });
  const sum = planBudgetSum(doc);
  const lump = doc.budget.length === 1 ? doc.budget[0] : null;
  if (status === 'specified' && lump && lump.quantity === 1 && lump.total !== null && (lump.total === school || lump.total === limit)) add('confirm', '소요 예산', '예산이 총액 한 줄입니다. 용도별 산출 내역(단가×수량)으로 나눠 주세요.');
  if (school !== null && school > 0 && sum > school) add('block', '소요 예산', `예산 합계 ${sum.toLocaleString('ko-KR')}원이 학교 예산 ${school.toLocaleString('ko-KR')}원을 넘습니다.`);
  if (limit !== null && sum > limit) add('block', '소요 예산', `예산 합계 ${sum.toLocaleString('ko-KR')}원이 공문 상한 ${limit.toLocaleString('ko-KR')}원을 넘습니다.`);

  // 공문 필수 조건: ID 연결과 실제 본문 반영(날짜·수치가 본문에 있는지).
  const claimed = new Set(doc.meta.requirementIds), allText = lines.map(l => l.text).join(' '), body = squash(allText);
  const dateKey = (p: PlanDate) => `${p.m}. ${p.d}.`;
  const bodyDates = new Set(findPlanDates(allText, year).map(dateKey));
  for (const r of requirements.filter(r => r.kind === 'required')) {
    if (!claimed.has(r.id)) { add('block', '공문 필수 조건', `"${r.text}"을(를) 반영하지 않았습니다.`); continue; }
    const source = `${r.text} ${r.quote}`;
    const facts = [
      ...findPlanDates(source, year).map(p => ({ shown: dateKey(p), found: bodyDates.has(dateKey(p)) })),
      // 금액은 예산표·합계 검사가 따로 맡는다.
      ...[...source.matchAll(/\d[\d,]*\s*(?:명|시간|차시|회|쪽|점)/gu)].map(m => ({ shown: m[0], found: body.includes(squash(m[0])) })),
    ];
    const missing = [...new Set(facts.filter(f => !f.found).map(f => f.shown))];
    if (missing.length) add('warn', '공문 필수 조건', `"${r.text}"의 날짜·수치(${missing.slice(0, 3).join(', ')})를 본문에서 찾지 못했습니다.`);
  }

  // 일정: 순서, 요일, 공문 마감.
  const deadlines = requirements.filter(r => r.kind === 'required' && DEADLINE.test(r.quote)).flatMap(r => findPlanDates(r.quote, year).slice(-1).map(date => ({ r, date })));
  let previous: PlanDate | null = null;
  doc.schedule.forEach((s, i) => {
    const where = `추진 일정 ${i + 1}행`, dates = findPlanDates(s.date ?? '', year);
    for (const p of dates) if (p.y && p.weekday) {
      const actual = WEEKDAYS[new Date(p.y, p.m - 1, p.d).getDay()];
      if (actual !== p.weekday) add('warn', where, `${p.y}. ${p.m}. ${p.d}.은 ${actual}요일입니다(문서: ${p.weekday}요일).`);
    }
    // 공문·입력이 정한 날짜가 아닌데 주말에 시작·종료하는 단계.
    for (const p of dates) if (p.y && !givenDates.has(dateKey(p))) {
      const day = new Date(p.y, p.m - 1, p.d).getDay();
      if (day === 0 || day === 6) add('warn', where, `${p.m}. ${p.d}.은 ${WEEKDAYS[day]}요일입니다. 주말 운영이 아니면 평일로 옮겨 주세요.`);
    }
    const first = dates[0];
    if (first && previous && dayNumber(first) < dayNumber(previous)) add('warn', where, '앞 행보다 이른 날짜입니다. 일정 순서를 확인해 주세요.');
    if (first) previous = first;
    const last = dates.at(-1);
    if (last && SUBMISSION.test(s.task)) for (const { r, date } of deadlines) if (dayNumber(last) > dayNumber(date)) add('warn', where, `공문 마감(${date.m}. ${date.d}.)보다 늦습니다: "${r.text}"`);
    if (!s.date) add('confirm', where, `"${s.task}"의 시기가 정해지지 않았습니다.`);
  });
  const sameDates = new Map<string, number>();
  for (const s of doc.schedule) if (s.date) sameDates.set(squash(s.date), (sameDates.get(squash(s.date)) ?? 0) + 1);
  if ([...sameDates.values()].some(n => n > 1)) add('confirm', '추진 일정', '여러 단계의 시기가 같습니다. 단계별 시기를 나눠 주세요.');

  // 근거 없는 제도·수치·법령.
  const contest = context.referenceTypeResolved === 'contest';
  for (const word of HABITUAL) {
    if (contest && word === '심사') continue;
    if (inputs.includes(word)) continue;
    const hit = lines.find(l => l.text.includes(word) && !l.text.includes('(안)'));
    if (hit) add('warn', hit.where, `공문·입력에 없는 '${word}'이(가) 확정된 내용처럼 들어갔습니다. 필요 없으면 빼고, 제안이면 (안)으로 표시해 주세요.`);
  }
  for (const l of lines) {
    if (l.text.includes('(안)')) continue;
    for (const m of l.text.matchAll(COUNTED)) if (!inputSquash.includes(squash(m[0])) && !l.where.startsWith('소요 예산') && !l.where.startsWith('추진 일정')) add('confirm', l.where, `'${m[0]}'의 근거를 공문·입력에서 찾지 못했습니다.`);
    for (const m of l.text.matchAll(/[가-힣]+법\s*제\s*\d+\s*조|제\s*\d{2,}\s*호/gu)) if (!inputSquash.includes(squash(m[0]))) add('warn', l.where, `'${m[0]}'의 근거를 공문·입력에서 찾지 못했습니다.`);
  }

  // 같은 내용이 여러 목차에 반복되는지. 표현이 조금 달라도 짧은 쪽의 글자 쌍 대부분이 긴 쪽에 있으면 반복으로 본다.
  // 세 목차 이상에 나오는 글자 쌍은 공모 주제처럼 문서 전체의 주제어이므로 비교에서 뺀다.
  const prose = lines.filter(l => !/^(추진 일정|소요 예산|운영 개요|세부 추진 계획$)/u.test(l.where));
  const bigrams = (v: string) => { const t = squash(v.replace(/^[^:]{1,20}:\s*/u, '')); return new Set(Array.from({ length: Math.max(0, t.length - 1) }, (_, i) => t.slice(i, i + 2))); };
  const section = (where: string) => where.split('(')[0];
  const raw = prose.map(l => bigrams(l.text)), spread = new Map<string, Set<string>>();
  raw.forEach((set, i) => set.forEach(g => spread.set(g, (spread.get(g) ?? new Set<string>()).add(section(prose[i].where)))));
  const grams = raw.map(set => new Set([...set].filter(g => spread.get(g)!.size < 3)));
  const reported = new Set<number>();
  prose.forEach((l, i) => {
    for (let j = 0; j < i; j++) {
      // 기대 효과가 추진 목적과 짝을 이루는 것은 계획서의 관례이므로 반복으로 보지 않는다.
      const pair = [section(prose[j].where), section(l.where)].sort().join();
      if (reported.has(i) || section(prose[j].where) === section(l.where) || pair === '기대 효과,추진 목적') continue;
      const [a, b] = grams[i].size <= grams[j].size ? [grams[i], grams[j]] : [grams[j], grams[i]];
      const shared = [...a].filter(g => b.has(g)).length;
      // 거의 같은 문장은 주제어를 빼지 않고도 서로 대부분 겹친다. 세 목차 이상에 되풀이해도 잡는다.
      const [ra, rb] = [raw[i], raw[j]], rawShared = [...ra].filter(g => rb.has(g)).length;
      const same = Math.min(ra.size, rb.size) >= 10 && rawShared / Math.max(ra.size, rb.size) >= 0.75;
      if (same || (a.size >= 10 && shared / a.size >= 0.75)) { add('warn', l.where, `${withGwa(prose[j].where)} 같은 내용을 되풀이합니다. 한 곳에만 써 주세요.`); reported.add(i); }
    }
  });

  // 방법이 없는 제안: '(안)'을 붙였지만 '정해 안내', '추후 결정'처럼 실제 방법이 없는 문장.
  for (const l of lines) if (l.text.includes('(안)') && VACUOUS.test(l.text)) add('warn', l.where, '(안)에 구체적인 방법이 없습니다. 방법을 쓰거나 학교 확인 사항으로 옮겨 주세요.');

  for (const u of doc.meta.unknowns) add('confirm', '학교 확인', u);
  const proposals = lines.filter(l => l.text.includes('(안)'));
  if (proposals.length) add('suggest', '제안', `(안)으로 표시한 제안 ${proposals.length}건: 공문에 없는 방법입니다. 결재 전에 학교에서 채택 여부를 정해 주세요.`);
  return issues;
}
export const hasBlockingPlanIssue = (issues: PlanIssue[]) => issues.some(i => i.level === 'block');
