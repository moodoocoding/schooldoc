import { supabase } from '../../utils/supabaseClient';
import { loadPdfJs } from '../../utils/pdfjs';
import {
  NEIS_MAX_PAGES,
  validatePlan,
  validateGradeBook,
  validateGeneratedComment,
} from '../../../supabase/functions/_shared/neisHelper';
import type {
  AssessmentPlan,
  GradeBook,
  CommentInput,
  GeneratedComment,
} from '../../../supabase/functions/_shared/neisHelper';
import { checkFile } from './subjectFiles';
import { reconcileSourcePages } from './sourcePages';

async function invoke(body: Record<string, unknown>, signal: AbortSignal): Promise<unknown> {
  if (!supabase) throw new Error('서버 연결이 필요합니다. 로그인 후 다시 시도해 주세요.');
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) throw new Error('로그인 후 다시 시도해 주세요.');
  const { data, error } = await supabase.functions.invoke('neis-helper', {
    body,
    signal: AbortSignal.any([signal, AbortSignal.timeout(125_000)]),
  });
  if (error) {
    let message = 'Neis Helper 서버에 연결하지 못했습니다. 로그인 또는 함수 배포 상태를 확인해 주세요.';
    if (error.context instanceof Response)
      try {
        const detail = await error.context.json();
        if (typeof detail.error === 'string') message = detail.error;
      } catch {
        /* gateway */
      }
    throw new Error(message);
  }
  if (signal.aborted) throw new DOMException('취소됨', 'AbortError');
  if (!data?.result) throw new Error('분석 결과가 없습니다. 원본을 확인하고 다시 시도해 주세요.');
  return data.result;
}
async function pdfData(file: File, signal: AbortSignal, readPageText = false) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pageTexts: string[] = [];
  const pdfjs = await loadPdfJs();
  const task = pdfjs.getDocument({ data: bytes.slice() });
  const abort = () => {
    void task.destroy();
  };
  signal.addEventListener('abort', abort, { once: true });
  try {
    const doc = await task.promise;
    if (doc.numPages > NEIS_MAX_PAGES) throw new Error(`PDF는 ${NEIS_MAX_PAGES}쪽 이하로 나누어 주세요.`);
    if (readPageText) {
      for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
        if (signal.aborted) throw new DOMException('취소됨', 'AbortError');
        try {
          const page = await doc.getPage(pageNumber);
          const text = await page.getTextContent();
          pageTexts.push(text.items.map((item) => 'str' in item ? item.str : '').join(' '));
          page.cleanup();
        } catch {
          if (signal.aborted) throw new DOMException('취소됨', 'AbortError');
          // 스캔 PDF나 텍스트 추출 실패는 쪽 번호를 확인 불가로 표시하고 원본 대조를 제공한다.
          pageTexts.push('');
        }
      }
    }
  } catch (e) {
    if (signal.aborted) throw new DOMException('취소됨', 'AbortError');
    if (e instanceof Error && e.message.includes('쪽 이하')) throw e;
    throw new Error('잠기거나 손상된 PDF는 읽을 수 없습니다. PDF로 다시 저장해 주세요.');
  } finally {
    signal.removeEventListener('abort', abort);
    await task.destroy();
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i += 32768)
    binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return { data: btoa(binary), pageTexts };
}
export async function analyzePlan(file: File, signal: AbortSignal): Promise<AssessmentPlan> {
  checkFile(file, 'plan');
  const { data, pageTexts } = await pdfData(file, signal, true);
  const result = await invoke({ action: 'plan', data }, signal);
  return reconcileSourcePages(validatePlan(result), pageTexts);
}
export async function analyzeGradePdf(file: File, signal: AbortSignal): Promise<GradeBook> {
  checkFile(file, 'grades');
  const { data } = await pdfData(file, signal);
  const result = (await invoke({ action: 'grades', data }, signal)) as GradeBook;
  return validateGradeBook({ ...result, columns: result.columns?.map((c) => c.label) });
}
export async function generateComment(input: CommentInput, signal: AbortSignal): Promise<GeneratedComment> {
  return validateGeneratedComment(await invoke({ action: 'generate', input }, signal), input);
}
