import { supabase } from '../../utils/supabaseClient';
import { isVerifiedPreviewAdmin } from '../../../supabase/functions/_shared/previewAccess';
import { validatePlanDocument } from '../../../supabase/functions/_shared/planDocumentV2';
import { validatePlanAnalysis, type PlanRequest, type PlanAnalysis, type PlanDraft } from '../../../supabase/functions/_shared/schoolPlan';

export async function runPlanAi(request: PlanRequest, signal?: AbortSignal, consent = false): Promise<{ analysis?: PlanAnalysis; draft?: PlanDraft }> {
  if (!consent) throw new Error('AI 전송 안내를 확인하고 동의한 뒤 진행해 주세요.');
  if (!supabase) throw new Error('서버 연결이 필요합니다. 로그인 후 다시 시도해 주세요.');
  const { data: auth, error: authError } = await supabase.auth.getSession();
  if (authError || !auth.session?.user?.id || auth.session.user.is_anonymous) throw new Error('교사 계정으로 로그인한 뒤 AI 작성을 사용할 수 있습니다.');
  if (!isVerifiedPreviewAdmin(auth.session.user)) throw new Error('현재 학교 문서 작성은 관리자 계정에서만 사용할 수 있습니다.');
  signal?.throwIfAborted();
  const { data, error } = await supabase.functions.invoke('school-plan', {
    // Called only after the wizard's explicit, source-specific transmission consent.
    body: { ...request, consent: true },
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(150_000)]) : AbortSignal.timeout(150_000),
  });
  signal?.throwIfAborted();
  if (error) {
    let message = 'AI 작성 서버에 연결하지 못했습니다. 로그인과 함수 연결 상태를 확인하고 다시 시도해 주세요.';
    if (error.context instanceof Response) {
      try { const result = await error.context.json(); if (typeof result.error === 'string' && result.error.length <= 300) message = result.error; } catch { /* Gateway errors use the safe fallback. */ }
    }
    throw new Error(message);
  }
  if (request.action === 'analyze') return { analysis: validatePlanAnalysis(data?.analysis, request.sources) };
  return { draft: validatePlanDocument(data?.draft, request) };
}
