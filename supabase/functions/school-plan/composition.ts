import type { PlanPages, PlanSection } from '../_shared/schoolPlan.ts';
import type { PlanReferenceType } from '../_shared/schoolPlanReferences.ts';

// The provider writes activity procedures and outputs separately. The client
// keeps its existing PlanDraft contract, saved drafts and editable HWPX path.
const text = (maxLength: number) => ({ type: 'string', minLength: 1, maxLength });
const refs = { type: 'array', maxItems: 24, items: text(80) };
const object = (properties: Record<string, unknown>) => ({ type: 'object', additionalProperties: false, properties, required: Object.keys(properties) });
const block = (count: number, length: number) => object({ paragraphs: { type: 'array', minItems: 1, maxItems: count, items: text(length) }, requirementIds: refs });
interface PlanPageBudget {
  purpose: number; overview: number; overviewLength: number; activities: number;
  name: number; procedure: number; result: number; followUp: number;
  schedule: number; when: number; scheduleActivity: number; owner: number;
  budget: number; item: number; unknowns: number; unknownLength: number;
}
/**
 * 출력 분량별 글자·항목 한도. 공문 서식(휴먼명조 13pt·줄간격 160%, A4)에서 rhwp로 조판해,
 * 실제 쪽 수는 생성 후 한글 조판 결과로 확인한다.
 * 1쪽은 전체 요약, 2~5쪽은 본문을 앞쪽에 두고 일정·예산·확인 사항을 마지막 쪽에 모은다.
 */
export const PLAN_PAGE_BUDGETS = {
  1: { purpose: 50, overview: 1, overviewLength: 60, activities: 2, name: 12, procedure: 60, result: 25, followUp: 50, schedule: 3, when: 9, scheduleActivity: 18, owner: 8, budget: 2, item: 16, unknowns: 0, unknownLength: 40 },
  2: { purpose: 80, overview: 2, overviewLength: 70, activities: 3, name: 16, procedure: 100, result: 40, followUp: 80, schedule: 5, when: 9, scheduleActivity: 36, owner: 8, budget: 4, item: 16, unknowns: 3, unknownLength: 60 },
  3: { purpose: 90, overview: 3, overviewLength: 90, activities: 4, name: 18, procedure: 140, result: 60, followUp: 100, schedule: 5, when: 9, scheduleActivity: 36, owner: 8, budget: 4, item: 16, unknowns: 3, unknownLength: 60 },
  4: { purpose: 110, overview: 3, overviewLength: 110, activities: 6, name: 22, procedure: 180, result: 75, followUp: 120, schedule: 5, when: 9, scheduleActivity: 36, owner: 8, budget: 4, item: 16, unknowns: 3, unknownLength: 60 },
  5: { purpose: 120, overview: 4, overviewLength: 120, activities: 8, name: 26, procedure: 230, result: 100, followUp: 140, schedule: 5, when: 9, scheduleActivity: 36, owner: 8, budget: 4, item: 16, unknowns: 3, unknownLength: 60 },
} satisfies Record<PlanPages, PlanPageBudget>;
const budgetOf = (pages: PlanPages = 2): PlanPageBudget => PLAN_PAGE_BUDGETS[pages];
const planBody = (pages?: PlanPages) => {
  const b = budgetOf(pages);
  return object({
    purpose: block(1, b.purpose),
    overview: block(b.overview, b.overviewLength),
    activities: { type: 'array', minItems: 2, maxItems: b.activities, items: object({
      name: text(b.name), procedure: text(b.procedure), result: text(b.result),
      methodKind: { type: 'string', enum: ['source', 'proposal'] }, requirementIds: refs,
    }) },
    followUp: block(1, b.followUp),
  });
};
export const planBodySchema = planBody(2);
/** 분량 지침: 응답 형식의 항목 수와 함께 쓴다. */
export function pageInstructions(pages: PlanPages = 2) {
  const b = budgetOf(pages);
  const where = pages === 1
    ? '본문·일정표·예산표·확인 사항이 모두 한 쪽에 들어가야 한다'
    : '본문은 앞의 ' + (pages - 1) + '쪽에 쓰고, 일정표·예산표·확인 사항은 마지막 ' + pages + '쪽에 모은다';
  const unknowns = b.unknowns ? `확인 사항(unknowns)은 ${b.unknowns}개·각 ${b.unknownLength}자 이내다.` : '1쪽에는 확인 사항(unknowns) 칸이 없으므로 빈 배열로 두고, 미정 사항은 본문에 "(학교 확인)"으로 짧게 표시한다.';
  return `출력 분량은 A4 ${pages}쪽이다. ${where}. 응답 형식의 글자 수·항목 수 한도 안에서 짧은 문장으로 쓰고, 같은 내용을 반복하지 않는다.
일정 activity는 ${b.scheduleActivity}자 이내다. ${unknowns} 필수 조건은 빼지 않고 짧게 쓴다.`;
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
  const b = budgetOf(pages);
  const regularBody = planBody(pages);
  const contestActivity = object({ procedure: text(b.procedure), result: text(b.result), methodKind: { type: 'string', enum: ['source', 'proposal'] }, requirementIds: refs });
  return type === 'contest' ? object({ purpose: regularBody.properties.purpose, overview: regularBody.properties.overview,
    intake: contestActivity, publication: contestActivity, selectionRules: contestRulesSchema,
  }) : regularBody;
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
  const activityValues = type === 'contest'
    ? [{ ...record(body.intake), name: '응모와 접수' }, { ...record(body.publication), name: '결과 발표와 활용' }]
    : array(body.activities, 2, b.activities);
  const activities = activityValues.map(value => {
    const a = record(value);
    if (a.methodKind !== 'source' && a.methodKind !== 'proposal') throw new Error('Invalid activity basis');
    return {
      paragraph: `${string(a.name, b.name)}${a.methodKind === 'proposal' ? '(방법안)' : ''}: ${string(a.procedure, b.procedure).replace(/\s*\(방법안\)\s*[.。]?$/u, '')} 결과·확인: ${string(a.result, b.result)}`,
      requirementIds: ids(a.requirementIds),
    };
  });
  const sections = [
    section(body.purpose, 'purpose', '추진 목적', 1, b.purpose),
    section(body.overview, 'overview', '운영 개요', b.overview, b.overviewLength),
    { id: 'implementation', heading: '세부 추진 계획', paragraphs: activities.map(a => a.paragraph), requirementIds: [...new Set(activities.flatMap(a => a.requirementIds))] },
  ];
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
    sections.push({
      id: 'selection_rules', heading: `심사·선정 세부 기준${rules.methodKind === 'proposal' ? '(안)' : ''}`,
      paragraphs: [
        ...criteriaParagraphs,
        `평가 방법: ${scored ? `항목별 만점 합계 ${criteria.reduce((sum, c) => sum + c.maxScore!, 0)}점. ` : ''}${string(rules.evaluationMethod, 160)} 제외 기준: ${array(rules.exclusions, 1, 2).map(v => fragment(string(v, 50))).join('; ')}.`,
        `동점 처리: ${priority.join(' → ')}의 평가 결과 순으로 비교한다. 이후에도 동점이면 ${string(rules.finalTie, 60)}`,
      ], requirementIds: ids(rules.requirementIds),
    });
  }
  if (type !== 'contest') sections.push(section(body.followUp, 'follow_up', '결과 정리와 활용', 1, b.followUp));
  return sections;
}
export function composePlanDraft(value: unknown, type: PlanReferenceType, pages: PlanPages = 2) {
  const d = record(value);
  return { title: d.title, sections: composePlanBody(d.body, type, pages), schedule: d.schedule, budget: d.budget, unknowns: d.unknowns };
}

export const compositionInstructions = `작성 응답은 화면 문단을 직접 나열하는 sections 대신 body에 구조화한다.
body.purpose: 목적 한 문단. body.overview: 대상·일시·장소·운영 역할과 필수 집행 조건을 짧은 항목 문단으로 쓴다. 활동 설명·결과 제출·예산 배분액을 여기서 반복하지 않는다.
body.activities: 이번 사업의 핵심 활동. 각 name은 활동 이름, procedure는 누가 어떤 자료와 순서로 무엇을 하는지, result는 남길 구체적인 산출물 또는 확인할 행동·내용이다. 모든 항목의 개수와 글자 수는 응답 형식의 한도(출력 분량에 맞춘 값)를 지킨다. procedure와 result를 같은 말로 반복하지 않는다.
methodKind는 공문에 해당 진행 방법까지 명시된 경우만 source, AI가 방법을 구체화하면 proposal이다. 서버가 proposal 활동에 '(방법안)'을 붙인다. 원문의 대상·날짜·의무는 방법 제안을 이유로 바꾸지 않는다.
body.followUp: 결과의 수합·점검 담당, 제출 기한과 활용을 한 문단으로 적는다. body의 각 항목·활동에는 반영한 실제 requirementIds만 연결한다.
운영 방법을 제안해야 한다면 실제 초안으로 작성한다. unknowns에 '양식 마련 여부 확인', '내용 확정 후 계획 수립'처럼 방금 작성해야 할 일을 미루지 않는다.
budget은 사용 가능한 상한을 채우는 표가 아니다. 필요한 품목의 단위와 수량을 알 수 있으면 해당 산출식을 제안하고, 품목별 산출 자체가 불가능하면 빈 배열과 확인 사유를 반환한다. 인쇄비·재료비 총액을 임의로 각각 1회로 나눠 예산 전액을 소진하지 않는다.`;

export const contestCompositionInstructions = `이번 유형은 공모전이다. 일반 유형의 activities와 followUp 대신 body.intake와 body.publication을 작성한다. 각각 procedure·result·methodKind·requirementIds를 갖는다. intake는 응모자가 작성할 항목과 접수·누락 확인 방법, publication은 결과 수합·발표 기한·공개 범위·선정작 활용을 적는다. 심사는 selectionRules에만 작성해 서로 다른 규칙이 중복되지 않게 한다.
selectionRules.criteria는 이번 공문의 평가 항목별 실제로 살펴볼 내용을 name·check로 적는다. evaluationMethod는 항목별 평가 결과를 어떻게 종합해 선정하는지, exclusions는 제외할 구체적인 표현·출품 조건을 쓴다.
점수로 심사하면 각 criteria.maxScore에 실제로 사용할 만점 정수를 제안한다. 서버가 항목별 배점과 합계를 표시한다. '점수를 합산한다'만 쓰고 배점을 다시 학교가 만들게 하지 않는다. 원문이 투표·정성 비교 등 점수 없는 방식을 정했다면 모든 maxScore를 null로 두고 evaluationMethod에 그 선정 절차를 적는다. 글자 제한에 맞추느라 낱말을 잘라 쓰지 말고 완결된 짧은 문장으로 다시 쓴다.
tieBreakPriority는 criteria에 있는 항목 이름을 비교할 순서대로 1~6개 나열한다. finalTie에는 그 순서로 비교해도 같을 때 적용할 실제 절차를 적는다(예: 심사자가 작품별 근거를 논의하고 선정 이유를 기록). '추후 정한다', '기준 마련', '학교 확인'은 처리 규칙이 아니다.
공문에 이미 정해진 규칙은 그대로 사용한다. 공문에 없는 평가 방식·동점 순서·제외 규칙은 합리적으로 직접 제안하고 methodKind를 proposal로 한다. 예문의 배점·인원·시상 규모를 복사하지 않는다. 무예산·시상 없음·비공개 조건을 지키고, 이미 제안한 규칙을 unknowns에서 다시 작성하라고 요구하지 않는다.
필수 근거의 연결은 budget이 비어 있어도 필요하다. 무예산·시상 없음 같은 공문 조건은 overview에 명시하고 그 항목의 requirementIds를 연결한다. 원문에 없는 심사자를 확정된 인물이나 인원으로 쓰지 않는다.`;
