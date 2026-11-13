import { createClient } from 'npm:@supabase/supabase-js@2.110.8';
import { authorizePlanRequest, createPlanHandler, PlanError } from './core.ts';
import { requestPlanAi, selectPlanAiModel } from './openai.ts';
import { consumePlanQuota } from './quota.ts';

const db = createClient(Deno.env.get('SUPABASE_URL')!, (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY'))!, { auth: { persistSession: false, autoRefreshToken: false } });
Deno.serve(createPlanHandler({
  authorize: async request => {
    const userId = await authorizePlanRequest(request, token => db.auth.getUser(token));
    if (!Deno.env.get('OPENAI_API_KEY')) throw new PlanError(503, 'AI 작성 서버의 연결 설정이 필요합니다.');
    return userId;
  },
  consumeQuota: userId => consumePlanQuota(userId, (key, seconds, max) => db.rpc('consume_registry_rate_limit', {
    p_request_key: key, p_window_seconds: seconds, p_max_requests: max,
  })),
  run: (request, signal) => requestPlanAi(request, Deno.env.get('OPENAI_API_KEY')!, selectPlanAiModel(request.action, {
    model: Deno.env.get('SCHOOL_PLAN_AI_MODEL'), writingModel: Deno.env.get('SCHOOL_PLAN_WRITING_MODEL'),
  }), fetch, signal),
}));
