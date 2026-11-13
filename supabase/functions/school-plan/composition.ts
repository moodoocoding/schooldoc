import type { PlanPages, PlanSection } from '../_shared/schoolPlan.ts';
import type { PlanReferenceType } from '../_shared/schoolPlanReferences.ts';
import { PLAN_AUTHORING_PROFILES } from './authoringProfiles.ts';

// The provider writes activity procedures and outputs separately. The client
// keeps its existing PlanDraft contract, saved drafts and editable HWPX path.
const text = (maxLength: number) => ({ type: 'string', minLength: 1, maxLength });
const refs = { type: 'array', maxItems: 24, items: text(80) };
const object = <T extends Record<string, unknown>>(properties: T) => ({ type: 'object', additionalProperties: false, properties, required: Object.keys(properties) });
const block = (count: number, length: number) => object({ paragraphs: { type: 'array', minItems: 1, maxItems: count, items: text(length) }, requirementIds: refs });
interface PlanPageBudget {
  minActivities: number; minBodyChars: number; targetBodyChars: number; followUpCount: number; effects: number; effectLength: number;
  purpose: number; overview: number; overviewLength: number; activities: number;
  name: number; procedure: number; result: number; followUp: number;
  schedule: number; when: number; scheduleActivity: number; owner: number;
  budget: number; item: number; unknowns: number; unknownLength: number;
}
/**
 * 출력 분량별 글자·항목 한도. 공문 서식(휴먼명조 13pt·줄간격 160%, A4)에서 rhwp로 조판해,
 * 실제 쪽 수는 생성 후 한글 조판 결과로 확인한다.
 * 쪽수마다 내용의 깊이와 목표 분량을 늘린다. 빈 페이지로 분량을 맞추지 않는다.
 * 일반 유형은 별도 후속 목차가 없으므로 활동 절차 한도로 목표 분량을 담는다(3~5쪽 절차 280~340자).
 */
export const PLAN_PAGE_BUDGETS = {
  1: { minActivities: 2, minBodyChars: 250, targetBodyChars: 400, followUpCount: 1, effects: 2, effectLength: 40, purpose: 65, overview: 1, overviewLength: 70, activities: 2, name: 16, procedure: 75, result: 32, followUp: 60, schedule: 3, when: 18, scheduleActivity: 28, owner: 15, budget: 2, item: 24, unknowns: 1, unknownLength: 50 },
  2: { minActivities: 2, minBodyChars: 850, targetBodyChars: 1200, followUpCount: 2, effects: 2, effectLength: 60, purpose: 110, overview: 2, overviewLength: 120, activities: 4, name: 24, procedure: 180, result: 65, followUp: 150, schedule: 5, when: 30, scheduleActivity: 65, owner: 30, budget: 4, item: 50, unknowns: 3, unknownLength: 80 },
  3: { minActivities: 4, minBodyChars: 1800, targetBodyChars: 2300, followUpCount: 3, effects: 3, effectLength: 70, purpose: 150, overview: 3, overviewLength: 180, activities: 5, name: 28, procedure: 280, result: 75, followUp: 200, schedule: 6, when: 30, scheduleActivity: 80, owner: 30, budget: 5, item: 50, unknowns: 3, unknownLength: 80 },
  4: { minActivities: 6, minBodyChars: 2900, targetBodyChars: 3400, followUpCount: 3, effects: 3, effectLength: 80, purpose: 180, overview: 3, overviewLength: 220, activities: 7, name: 28, procedure: 340, result: 75, followUp: 220, schedule: 7, when: 30, scheduleActivity: 80, owner: 30, budget: 6, item: 50, unknowns: 3, unknownLength: 80 },
  5: { minActivities: 8, minBodyChars: 4100, targetBodyChars: 4600, followUpCount: 4, effects: 3, effectLength: 90, purpose: 200, overview: 4, overviewLength: 240, activities: 8, name: 28, procedure: 340, result: 75, followUp: 240, schedule: 8, when: 30, scheduleActivity: 80, owner: 30, budget: 6, item: 50, unknowns: 3, unknownLength: 80 },
} satisfies Record<PlanPages, PlanPageBudget>;
const budgetOf = (pages: PlanPages = 2): PlanPageBudget => PLAN_PAGE_BUDGETS[pages];
const planBody = (pages?: PlanPages) => {
  const b = budgetOf(pages);
  return object({
    purpose: block(1, b.purpose),
    overview: block(b.overview, b.overviewLength),
    activities: { type: 'array', minItems: b.minActivities, maxItems: b.activities, items: object({
      name: text(b.name), procedure: text(b.procedure), result: text(b.result),
      methodKind: { type: 'string', enum: ['source', 'proposal'] }, requirementIds: refs,
    }) },
    followUp: block(b.followUpCount, b.followUp),
    effects: block(b.effects, b.effectLength),
  });
};
export const planBodySchema = planBody(2);
/** 분량 지침: 응답 형식의 항목 수와 함께 쓴다. */
export function pageInstructions(pages: PlanPages = 2) {
  const b = budgetOf(pages);
  const depth = {
    1: '핵심 목표·운영 조건·활동·결과 확인을 압축한 요약형이다.',
    2: '활동별 진행 순서·담당 역할·산출물과 결과 확인까지 작성하는 기본 실행안이다.',
    3: '실행 방법에 더해 준비 자료·세부 단계·참여 지원·점검 기준을 작성한다.',
    4: '단계별 실행과 역할 분담, 예상되는 어려움의 대응, 중간 점검과 후속 활용을 구체화한다.',
    5: '과제별 준비·실행·지원·확인 절차와 기록 항목, 중간 보완·인수인계 또는 후속 적용까지 갖춘 상세 실행안이다.',
  }[pages];
  return `[분량 설계] 출력 분량은 A4 ${pages}쪽이다. ${depth}
본문(목차·일정·예산표 제외)은 약 ${b.targetBodyChars}자를 목표로 한다. 최소 ${b.minBodyChars}자이며 이보다 짧은 초안은 보완 대상이다. 핵심 활동은 ${b.minActivities}~${b.activities}개다.
활동 수를 채우기 위해 다른 사업을 추가하지 않는다. 같은 과제를 실제 준비·실행·관찰·피드백 단계로 나누어 깊이를 더한다. 제목만 바꾼 반복 문장은 금지한다.
본문 뒤에 일정·예산을 연결한다. 실제 지면은 달라질 수 있으므로 빈 페이지·큰 여백·임의 쪽 나눔으로 맞추지 않는다.
각 문단·활동의 한도는 응답 형식에 따른다. 목표 분량이 전체 상한의 합을 모두 채우라는 뜻은 아니다. 확인 사항은 ${b.unknowns}개·각 ${b.unknownLength}자 이내다. 이미 작성할 수 있는 활동을 확인 사항으로 미루지 않는다.`;
}
const contestRulesSchema = object({
  criteria: { type: 'array', minItems: 1, maxItems: 6, items: object({ name: text(15), check: text(80), maxScore: { anyOf: [{ type: 'integer', minimum: 1, maximum: 10000 }, { type: 'null' }] } }) },
  evaluationMethod: text(160),
  exclusions: { type: 'array', minItems: 1, maxItems: 2, items: text(50) },
  tieBreakPriority: { type: 'array', minItems: 1, maxItems: 6, items: text(15) },
  finalTie: text(60),
  methodKind: { type: 'string', enum: ['source', 'proposal'] }, requirementIds: refs,
});
function bodySchema(type: PlanReferenceType, pages?: PlanPages) {
  const roles = planBody(pages).properties;
  const properties: Record<string, unknown> = Object.fromEntries(PLAN_AUTHORING_PROFILES[type].sections.map(s => [s.key, { ...roles[s.role], description: `${s.heading}: ${s.requiredContent}` }]));
  if (type === 'contest') properties.selectionRules = contestRulesSchema;
  return object(properties);
}
export const getComposedDraftSchema = (type: PlanReferenceType, pages?: PlanPages) => object({
  title: text(100), body: bodySchema(type, pages),
  schedule: { type: 'array', minItems: 1, maxItems: budgetOf(pages).schedule, items: object({ when: text(budgetOf(pages).when), activity: text(budgetOf(pages).scheduleActivity), owner: text(budgetOf(pages).owner), requirementIds: refs }) },
  budget: { type: 'array', maxItems: budgetOf(pages).budget, items: object({ item: text(budgetOf(pages).item), unitPrice: { type: 'integer', minimum: 0, maximum: 100000000 }, quantity: { type: 'integer', minimum: 1, maximum: 10000 }, requirementIds: refs }) },
  unknowns: { type: 'array', maxItems: budgetOf(pages).unknowns, items: text(budgetOf(pages).unknownLength) },
});
export const getComposedBodyRevisionSchema = (type: PlanReferenceType, pages?: PlanPages) => object({ body: bodySchema(type, pages) });

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid composition');
  return value as Record<string, unknown>;
}
function string(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new Error('Invalid composition text');
  return value.trim();
}
function array(value: unknown, min: number, max: number): unknown[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) throw new Error('Invalid composition list');
  return value;
}
const ids = (value: unknown) => array(value, 0, 24).map(v => string(v, 80));
const fragment = (value: string) => value.replace(/[.。]+$/u, '');
function section(value: unknown, id: string, heading: string, count: number, length: number): PlanSection {
  const b = record(value);
  return { id, heading, paragraphs: array(b.paragraphs, 1, count).map(p => string(p, length)), requirementIds: ids(b.requirementIds) };
}
export function composePlanBody(value: unknown, type: PlanReferenceType, pages: PlanPages = 2): PlanSection[] {
  const b = budgetOf(pages);
  const body = record(value);
  const sections: PlanSection[] = PLAN_AUTHORING_PROFILES[type].sections.map(s => {
    if (s.role !== 'activities') {
      const count = s.role === 'purpose' ? 1 : s.role === 'overview' ? b.overview : s.role === 'effects' ? b.effects : b.followUpCount;
      const length = s.role === 'purpose' ? b.purpose : s.role === 'overview' ? b.overviewLength : s.role === 'effects' ? b.effectLength : b.followUp;
      return section(body[s.key], s.key, s.heading, count, length);
    }
    const activities = array(body[s.key], 1, b.activities).map(value => {
      const a = record(value);
      if (a.methodKind !== 'source' && a.methodKind !== 'proposal') throw new Error('Invalid activity basis');
      return {
        paragraph: `${string(a.name, b.name)}${a.methodKind === 'proposal' ? '(방법안)' : ''}: ${string(a.procedure, b.procedure).replace(/\s*\(방법안\)\s*[.。]?$/u, '')} 결과·확인: ${string(a.result, b.result)}`,
        requirementIds: ids(a.requirementIds),
      };
    });
    return { id: s.key, heading: s.heading, paragraphs: activities.map(a => a.paragraph), requirementIds: [...new Set(activities.flatMap(a => a.requirementIds))] };
  });
  if (type === 'contest') {
    const rules = record(body.selectionRules);
    if (rules.methodKind !== 'source' && rules.methodKind !== 'proposal') throw new Error('Invalid selection basis');
    const criteria = array(rules.criteria, 1, 6).map(value => {
      const c = record(value);
      if (c.maxScore !== null && (!Number.isSafeInteger(c.maxScore) || Number(c.maxScore) < 1 || Number(c.maxScore) > 10000)) throw new Error('Invalid criterion score');
      return { name: string(c.name, 15), check: string(c.check, 80), maxScore: c.maxScore as number | null };
    });
    const scored = criteria.every(c => c.maxScore !== null);
    if (!scored && criteria.some(c => c.maxScore !== null)) throw new Error('Mixed scoring methods');
    const priority = array(rules.tieBreakPriority, 1, 6).map(v => string(v, 15));
    if (new Set(criteria.map(c => c.name)).size !== criteria.length || new Set(priority).size !== priority.length || priority.some(name => !criteria.some(c => c.name === name))) throw new Error('Invalid tie-break criteria');
    // Three full criteria fit in one paragraph without forcing the model to
    // truncate Korean words; six criteria still fit the four-paragraph contract.
    const criteriaParagraphs: string[] = [];
    for (let i = 0; i < criteria.length; i += 3) criteriaParagraphs.push(`평가 항목: ${criteria.slice(i, i + 3).map(c => `${c.name}${c.maxScore === null ? '' : `(${c.maxScore}점)`}: ${fragment(c.check)}`).join('; ')}.`);
    sections.splice(sections.findIndex(s => s.id === 'publication'), 0, {
      id: 'selection_rules', heading: `심사·선정 세부 기준${rules.methodKind === 'proposal' ? '(안)' : ''}`,
      paragraphs: [
        ...criteriaParagraphs,
        `평가 방법: ${scored ? `항목별 만점 합계 ${criteria.reduce((sum, c) => sum + c.maxScore!, 0)}점. ` : ''}${string(rules.evaluationMethod, 160)} 제외 기준: ${array(rules.exclusions, 1, 2).map(v => fragment(string(v, 50))).join('; ')}.`,
        `동점 처리: ${priority.join(' → ')}의 평가 결과 순으로 비교한다. 이후에도 동점이면 ${string(rules.finalTie, 60)}`,
      ], requirementIds: ids(rules.requirementIds),
    });
  }
  return sections;
}
export function composePlanDraft(value: unknown, type: PlanReferenceType, pages: PlanPages = 2) {
  const d = record(value);
  return { title: d.title, sections: composePlanBody(d.body, type, pages), schedule: d.schedule, budget: d.budget, unknowns: d.unknowns };
}

/** New generation only: previously saved drafts remain valid and editable. */
export function planDepthIssues(sections: PlanSection[], type: PlanReferenceType, pages: PlanPages): string[] {
  const b = budgetOf(pages);
  const chars = sections.reduce((n, s) => n + s.paragraphs.reduce((m, p) => m + p.length, 0), 0);
  const issues: string[] = [];
  if (chars < b.minBodyChars) issues.push(`본문 ${chars}자: ${pages}쪽 목표에 필요한 최소 ${b.minBodyChars}자보다 부족함. 유형별 실행 절차·역할·자료·확인 방법을 보완할 것`);
  const normalized = sections.flatMap(s => s.paragraphs).map(p => p.replace(/[\s\p{P}]/gu, ''));
  if (new Set(normalized).size !== normalized.length) issues.push('같은 문단이 반복됨. 서로 다른 실행 내용으로 작성할 것');
  for (const s of PLAN_AUTHORING_PROFILES[type].sections) {
    if (!sections.some(v => v.id === s.key)) issues.push(`필수 목차 누락: ${s.heading}`);
    if (s.role === 'activities' && (sections.find(v => v.id === s.key)?.paragraphs.length ?? 0) < b.minActivities) issues.push(`${s.heading}: 실행 단계 ${b.minActivities}개 이상으로 구체화할 것`);
  }
  return issues;
}

export const compositionInstructions = `응답의 body는 유형별 지침과 스키마의 키로 작성한다. 서버가 같은 유형의 실제 목차로 조립한다.
목적·개요·후속·기대 효과 항목은 paragraphs와 requirementIds를 갖는다. 기대 효과(body.effects)는 문서의 마지막 목차다. 핵심 실행 항목은 name·procedure·result·methodKind·requirementIds를 가진 활동 배열이다.
procedure는 진행 주체가 어떤 자료와 순서로 무엇을 하는지, result는 남길 구체적인 산출물이나 관찰·점검할 행동이다. 두 필드에서 같은 말을 반복하지 않는다.
methodKind는 공문에 해당 진행 방법까지 명시된 경우만 source, AI가 방법을 구체화하면 proposal이다. 서버가 proposal 활동에 '(방법안)'을 붙인다. 원문의 대상·날짜·의무는 방법 제안을 이유로 바꾸지 않는다.
그 외 문단도 새로 제안한 방법에만 '(안)'을 붙인다. body의 각 항목·활동에는 반영한 실제 requirementIds만 연결한다.
unknowns는 문서에 출력하지 않고 교사의 검토 화면에만 보인다. 미정 사실은 본문 해당 자리에도 확정처럼 쓰지 않는다. 운영 방법을 제안해야 한다면 실제 초안으로 작성한다. unknowns에 '양식 마련 여부 확인', '내용 확정 후 계획 수립'처럼 방금 작성해야 할 일을 미루지 않는다.
budget은 사용 가능한 상한을 채우는 표가 아니다. 필요한 품목의 단위와 수량을 알 수 있으면 해당 산출식을 제안하고, 품목별 산출 자체가 불가능하면 빈 배열과 확인 사유를 반환한다. 인쇄비·재료비 총액을 임의로 각각 1회로 나눠 예산 전액을 소진하지 않는다.`;

export const contestCompositionInstructions = `이번 유형은 공모전이다. body.intake는 활동 배열이고 body.publication은 paragraphs·requirementIds를 갖는다. intake는 응모자가 작성할 항목과 접수·누락 확인 방법, publication은 결과 수합·발표 기한·공개 범위·선정작 활용을 적는다. 심사는 selectionRules에만 작성해 서로 다른 규칙이 중복되지 않게 한다.
selectionRules.criteria는 이번 공문의 평가 항목별 실제로 살펴볼 내용을 name·check로 적는다. evaluationMethod는 항목별 평가 결과를 어떻게 종합해 선정하는지, exclusions는 제외할 구체적인 표현·출품 조건을 쓴다.
점수로 심사하면 각 criteria.maxScore에 실제로 사용할 만점 정수를 제안한다. 서버가 항목별 배점과 합계를 표시한다. '점수를 합산한다'만 쓰고 배점을 다시 학교가 만들게 하지 않는다. 원문이 투표·정성 비교 등 점수 없는 방식을 정했다면 모든 maxScore를 null로 두고 evaluationMethod에 그 선정 절차를 적는다. 글자 제한에 맞추느라 낱말을 잘라 쓰지 말고 완결된 짧은 문장으로 다시 쓴다.
tieBreakPriority는 criteria에 있는 항목 이름을 비교할 순서대로 1~6개 나열한다. finalTie에는 그 순서로 비교해도 같을 때 적용할 실제 절차를 적는다(예: 심사자가 작품별 근거를 논의하고 선정 이유를 기록). '추후 정한다', '기준 마련', '학교 확인'은 처리 규칙이 아니다.
공문에 이미 정해진 규칙은 그대로 사용한다. 공문에 없는 평가 방식·동점 순서·제외 규칙은 합리적으로 직접 제안하고 methodKind를 proposal로 한다. 예문의 배점·인원·시상 규모를 복사하지 않는다. 무예산·시상 없음·비공개 조건을 지키고, 이미 제안한 규칙을 unknowns에서 다시 작성하라고 요구하지 않는다.
필수 근거의 연결은 budget이 비어 있어도 필요하다. 무예산·시상 없음 같은 공문 조건은 overview에 명시하고 그 항목의 requirementIds를 연결한다. 원문에 없는 심사자를 확정된 인물이나 인원으로 쓰지 않는다.`;
