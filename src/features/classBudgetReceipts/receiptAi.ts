import { supabase } from '../../utils/supabaseClient';
import type { ReceiptAnalysisDraft } from './types';

export const AI_FILE_LIMIT = 10 * 1024 * 1024;
export const RECEIPT_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';

export const receiptBase64 = (file: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1]);
  reader.onerror = () => reject(new Error('영수증 파일을 읽지 못했습니다.'));
  reader.readAsDataURL(file);
});

export async function analyzeReceiptWithAi(file: File, signal?: AbortSignal): Promise<ReceiptAnalysisDraft[]> {
  if (!supabase) throw new Error('서버 연결이 필요합니다. 로그인 후 다시 시도해 주세요.');
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) throw new Error('AI 분석은 로그인 후 사용할 수 있습니다.');
  if (file.size > AI_FILE_LIMIT || !RECEIPT_ACCEPT.split(',').includes(file.type)) throw new Error('JPG·PNG·WebP·PDF 파일당 10MB까지 분석할 수 있습니다.');
  const { data, error } = await supabase.functions.invoke('receipt-analyze', {
    body: { mimeType: file.type, data: await receiptBase64(file) },
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(110_000)]) : AbortSignal.timeout(110_000),
  });
  if (error) {
    let message = 'AI 분석 서버에 연결하지 못했습니다. 로그인 또는 함수 배포 상태를 확인해 주세요.';
    if (error.context instanceof Response) {
      try { const body = await error.context.json(); if (typeof body.error === 'string') message = body.error; } catch { /* gateway response */ }
    }
    throw new Error(message);
  }
  if (!Array.isArray(data?.receipts) || !data.receipts.length) throw new Error('분석 결과가 없습니다. 원본을 확인하고 직접 입력해 주세요.');
  return data.receipts.map((row: { spentAt: string | null; merchant: string | null; amount: number | null; description: string | null; page: number | null; warnings: string[] }) => ({
    spentAt: row.spentAt ?? '', merchant: row.merchant ?? '', amount: row.amount,
    description: row.description ?? '', page: row.page, warnings: row.warnings,
    source: 'openai' as const, confidence: 0, // 정확도로 오해할 수 있는 임의 신뢰도는 표시하지 않는다.
  }));
}
