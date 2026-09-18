import { createClient } from 'npm:@supabase/supabase-js@2.110.8';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';
import { createReceiptHandler, isReceiptAiAdmin, ReceiptError, requestReceiptAnalysis } from './core.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY');
const db = createClient(url, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
const allowedEmails = new Set(['panthea0@gmail.com', ...(Deno.env.get('RECEIPT_AI_ADMIN_EMAILS') ?? '').split(',')].map(v => v.trim().toLowerCase()).filter(Boolean));

Deno.serve(createReceiptHandler({
  authorize: async (request) => {
    const token = request.headers.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) throw new ReceiptError(401, 'AI 분석은 로그인 후 사용할 수 있습니다.');
    const { data, error } = await db.auth.getUser(token);
    if (error || !data.user) throw new ReceiptError(401, '로그인이 만료되었습니다. 다시 로그인해 주세요.');
    // 클라이언트의 개발 모드/user_metadata 역할은 권한 근거로 사용하지 않는다.
    if (!isReceiptAiAdmin(data.user, allowedEmails)) throw new ReceiptError(403, '영수증 AI 분석은 현재 관리자 미리보기입니다.');
    if (!Deno.env.get('OPENAI_API_KEY')) throw new ReceiptError(503, '서버에 OPENAI_API_KEY를 등록해 주세요.');
    return data.user.id;
  },
  consumeQuota: async (userId) => {
    // 기존 원자적 제한 RPC 재사용. 별도 키 영역으로 등록부 요청과 충돌하지 않는다.
    for (const [key, seconds, max] of [[`receipt-ai:minute:${userId}`, 60, 10], [`receipt-ai:day:${userId}`, 86400, 50], ['receipt-ai:global:day', 86400, 100]] as const) {
      const { data, error } = await db.rpc('consume_registry_rate_limit', { p_request_key: key, p_window_seconds: seconds, p_max_requests: max });
      if (error) throw new ReceiptError(503, 'AI 호출량 제한을 확인하지 못해 분석을 중단했습니다. 관리자에게 문의해 주세요.');
      if (!data) return false;
    }
    return true;
  },
  analyze: async (upload) => {
    if (upload.mimeType === 'application/pdf') {
      try {
        const pdf = await PDFDocument.load(Uint8Array.from(atob(upload.data), c => c.charCodeAt(0)));
        if (pdf.getPageCount() > 10) throw new ReceiptError(422, 'PDF는 10쪽 이하로 나누어 주세요.');
      } catch (e) { if (e instanceof ReceiptError) throw e; throw new ReceiptError(422, '잠금 또는 손상된 PDF는 분석할 수 없습니다.'); }
    }
    return requestReceiptAnalysis(upload, Deno.env.get('OPENAI_API_KEY')!, Deno.env.get('RECEIPT_AI_MODEL')?.trim() || 'gpt-4.1-mini');
  },
}));
