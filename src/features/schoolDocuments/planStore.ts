import { validatePlanAnalysis, validatePlanDraft, validatePlanSources, type PlanAnalysis, type PlanConditions, type PlanDraft, type PlanSource } from '../../../supabase/functions/_shared/schoolPlan';
import { validatePlanReferenceChoice, type PlanReferenceChoice } from '../../../supabase/functions/_shared/schoolPlanReferences';

export interface PlanState {
  version: 1; step: number; sourceMode: 'files' | 'paste' | 'none'; pasted: string;
  sources: PlanSource[]; analysis: PlanAnalysis | null; answers: Record<string, string>;
  conditions: PlanConditions; draft: PlanDraft | null; draftContext: string;
  questionPage: number; consent: boolean; title: string; pages: 1 | 2;
  referenceType: PlanReferenceChoice;
}
export const emptyPlanState = (): PlanState => ({ version: 1, step: 0, sourceMode: 'files', pasted: '', sources: [], analysis: null, answers: {}, conditions: { topic: '', timing: '', budget: null }, draft: null, draftContext: '', questionPage: 0, consent: false, title: '', pages: 2, referenceType: 'auto' });
export const planStorageKey = (ownerId: string) => `schooldoc:school-plan:v1:${ownerId}`;
export function loadPlanState(ownerId: string, storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage): { state: PlanState; warning: string } {
  const key = planStorageKey(ownerId);
  let raw: string | null = null;
  try {
    raw = storage.getItem(key); if (!raw) return { state: emptyPlanState(), warning: '' };
    const s = JSON.parse(raw) as PlanState;
    if (s.version !== 1 || !Number.isInteger(s.step) || s.step < 0 || s.step > 5 || !['files', 'paste', 'none'].includes(s.sourceMode) || typeof s.pasted !== 'string' || s.pasted.length > 40000 || typeof s.consent !== 'boolean' || ![1, 2].includes(s.pages) || typeof s.title !== 'string' || s.title.length > 100 || !Number.isInteger(s.questionPage) || s.questionPage < 0 || s.questionPage > 2) throw new Error();
    const sources = validatePlanSources(s.sources);
    const analysis = s.analysis === null ? null : validatePlanAnalysis(s.analysis, sources);
    if (!s.conditions || typeof s.conditions.topic !== 'string' || s.conditions.topic.length > 100 || typeof s.conditions.timing !== 'string' || s.conditions.timing.length > 200 || (s.conditions.budget !== null && (!Number.isSafeInteger(s.conditions.budget) || s.conditions.budget < 0 || s.conditions.budget > 100000000))) throw new Error();
    if (!s.answers || typeof s.answers !== 'object' || Object.values(s.answers).some(v => typeof v !== 'string' || v.length > 500) || typeof s.draftContext !== 'string') throw new Error();
    // Keep an earlier draft when inputs change; validate it against the context
    // it was actually generated from, not the teacher's newly edited conditions.
    let draft = null;
    if (s.draft) {
      const draftContext = JSON.parse(s.draftContext);
      if (draftContext.referenceType !== undefined) validatePlanReferenceChoice(draftContext.referenceType);
      draft = validatePlanDraft(s.draft, draftContext);
    }
    const referenceType = validatePlanReferenceChoice(s.referenceType ?? 'auto');
    return { state: { ...s, sources, analysis, draft, referenceType, step: s.step >= 4 && !draft ? 3 : s.step }, warning: '' };
  } catch {
    try { if (raw) storage.setItem(`${key}:recovery`, raw); } catch { return { state: emptyPlanState(), warning: '이전 초안을 읽거나 보존하지 못했습니다. 자동 저장을 사용하지 말고 브라우저 저장 공간을 확인해 주세요.' }; }
    return { state: emptyPlanState(), warning: '읽지 못한 이전 기록은 이 기기의 복구용 사본으로 보존했습니다. 새 초안으로 시작합니다.' };
  }
}
export function savePlanState(ownerId: string, state: PlanState, storage: Pick<Storage, 'setItem'> = localStorage) {
  try { storage.setItem(planStorageKey(ownerId), JSON.stringify(state)); return true; } catch { return false; }
}
