import { createClient } from 'npm:@supabase/supabase-js@2.110.8';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';
import { authorizeNeisRequest, createNeisHandler, NeisError, requestNeisAi, requestNeisClassStream, selectNeisAiModel } from './core.ts';

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY'))!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
Deno.serve(
  createNeisHandler({
    authorize: async (req) => {
      const id = await authorizeNeisRequest(req, (token) => db.auth.getUser(token));
      if (!Deno.env.get('OPENAI_API_KEY'))
        throw new NeisError(503, 'AI 서버 설정이 필요합니다. 관리자에게 문의해 주세요.');
      return id;
    },
    consumeQuota: async (id) => {
      for (const [key, seconds, max] of [
        [`neis-ai:minute:${id}`, 60, 80],
        [`neis-ai:day:${id}`, 86400, 400],
        ['neis-ai:global:day', 86400, 1200],
      ] as const) {
        const { data, error } = await db.rpc('consume_registry_rate_limit', {
          p_request_key: key,
          p_window_seconds: seconds,
          p_max_requests: max,
        });
        if (error)
          throw new NeisError(503, 'AI 사용량을 확인하지 못해 중단했습니다. 잠시 후 다시 시도해 주세요.');
        if (data !== true) return false;
      }
      return true;
    },
    checkPdf: async (base64, maxPages) => {
      try {
        const pdf = await PDFDocument.load(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)));
        if (pdf.getPageCount() < 1 || pdf.getPageCount() > maxPages)
          throw new NeisError(422, `PDF는 ${maxPages}쪽 이하로 나누어 주세요.`);
      } catch (error) {
        if (error instanceof NeisError) throw error;
        throw new NeisError(422, '잠기거나 손상된 PDF는 읽을 수 없습니다. PDF로 다시 저장해 주세요.');
      }
    },
    analyze: (request) =>
      requestNeisAi(
        request,
        Deno.env.get('OPENAI_API_KEY')!,
        selectNeisAiModel(request.action, { model: Deno.env.get('NEIS_HELPER_AI_MODEL'), commentModel: Deno.env.get('NEIS_HELPER_COMMENT_MODEL') }),
      ),
    streamClass: (request, signal) => requestNeisClassStream(
      request,
      Deno.env.get('OPENAI_API_KEY')!,
      selectNeisAiModel(request.action, { model: Deno.env.get('NEIS_HELPER_AI_MODEL'), commentModel: Deno.env.get('NEIS_HELPER_COMMENT_MODEL') }),
      signal,
    ),
  }),
);
