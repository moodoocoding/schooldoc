import { createClient } from 'npm:@supabase/supabase-js@2.110.8';
import { authorizeNeisRequest, NeisError, selectNeisAiModel } from '../neis-helper/core.ts';
import { createBehaviorHandler, requestBehaviorStream } from './core.ts';

const db = createClient(Deno.env.get('SUPABASE_URL')!, (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY'))!, { auth: { persistSession: false, autoRefreshToken: false } });
Deno.serve(createBehaviorHandler({
  authorize: async (req) => {
    const owner = await authorizeNeisRequest(req, (token) => db.auth.getUser(token));
    if (!Deno.env.get('OPENAI_API_KEY')) throw new NeisError(503, 'AI 서버 설정이 필요합니다.');
    return owner;
  },
  consumeQuota: async (owner) => {
    // Share the existing account-wide NEIS quota; the new endpoint cannot bypass it.
    for (const [key, seconds, max] of [[`neis-ai:minute:${owner}`, 60, 80], [`neis-ai:day:${owner}`, 86400, 400], ['neis-ai:global:day', 86400, 1200]] as const) {
      const { data, error } = await db.rpc('consume_registry_rate_limit', { p_request_key: key, p_window_seconds: seconds, p_max_requests: max });
      if (error) throw new NeisError(503, 'AI 사용량을 확인하지 못해 중단했습니다. 잠시 후 다시 시도해 주세요.');
      if (data !== true) return false;
    }
    return true;
  },
  generate: (input, signal) => requestBehaviorStream(input, Deno.env.get('OPENAI_API_KEY')!, selectNeisAiModel('generate-class', { model: Deno.env.get('NEIS_HELPER_AI_MODEL'), commentModel: Deno.env.get('NEIS_HELPER_COMMENT_MODEL') }), signal),
}));
