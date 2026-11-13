import { supabase } from '../../utils/supabaseClient';
import { loadPdfJs } from '../../utils/pdfjs';
import {
  NEIS_MAX_PAGES,
  validatePlan,
  validateGradeBook,
} from '../../../supabase/functions/_shared/neisHelper';
import type {
  AssessmentPlan,
  GradeBook,
} from '../../../supabase/functions/_shared/neisHelper';
import type { ClassCommentEvent, ClassCommentInput, ClassCommentResult, ClassCommentRow } from '../../../supabase/functions/_shared/neisClassComments';
import { readJsonEvents } from '../../../supabase/functions/_shared/neisEvents';
import { generateClassWithRepairs } from '../../../supabase/functions/_shared/neisClassGeneration';
import { checkFile, isHangulFile } from './subjectFiles';
import { reconcileSourcePages } from './sourcePages';

/** 시험 배포에서만 neis-helper-* 이름의 별도 함수를 쓴다. 다른 함수 이름은 허용하지 않는다. */
export function neisFunctionName(configured: unknown): string {
  const name = typeof configured === 'string' ? configured.trim() : '';
  return /^neis-helper(?:-[a-z0-9]+)*$/.test(name) ? name : 'neis-helper';
}
const NEIS_FUNCTION = neisFunctionName(import.meta.env.VITE_NEIS_FUNCTION);

async function invoke(body: Record<string, unknown>, signal: AbortSignal, stream = false): Promise<unknown> {
  if (!supabase) throw new Error('서버 연결이 필요합니다. 로그인 후 다시 시도해 주세요.');
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) throw new Error('로그인 후 다시 시도해 주세요.');
  const { data, error } = await supabase.functions.invoke(NEIS_FUNCTION, {
    body,
    ...(stream ? { headers: { Accept: 'text/event-stream' } } : {}),
    signal: AbortSignal.any([signal, AbortSignal.timeout(body.action === 'generate-class' ? 150_000 : 125_000)]),
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
  if (stream && data instanceof Response) return data;
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
          pageTexts.push(text.items.map((item) => 'str' in item ? `${item.str}${item.hasEOL ? '\n' : ' '}` : '').join(''));
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
  return { bytes, pageTexts };
}

function pdfBase64(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 32768)
    binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(binary);
}
async function readDocument(file: File, signal: AbortSignal, readPageText = false) {
  const converted = isHangulFile(file)
    ? await convertHangulFile(file, signal)
    : null;
  const { bytes, pageTexts } = converted
    ? { bytes: new Uint8Array(await converted.pdf.arrayBuffer()), pageTexts: converted.pageTexts }
    : await pdfData(file, signal, readPageText);
  signal.throwIfAborted();
  return { data: pdfBase64(bytes), pageTexts, convertedFile: converted?.pdf ?? null };
}

async function convertHangulFile(file: File, signal: AbortSignal) {
  const { convertHangulToPdf } = await import('./hangulDocumentPdf');
  return convertHangulToPdf(file, signal);
}

export async function readWorksheet(file: File, signal: AbortSignal) {
  checkFile(file, 'worksheet');
  const converted = isHangulFile(file) ? await convertHangulFile(file, signal) : null;
  const { pageTexts } = converted ?? await pdfData(file, signal, true);
  signal.throwIfAborted();
  return { convertedFile: converted?.pdf ?? null, text: pageTexts.join('\n\n').trim() };
}
export async function analyzePlan(file: File, signal: AbortSignal): Promise<{ plan: AssessmentPlan; planPdf: File | null }> {
  checkFile(file, 'plan');
  const { data, pageTexts, convertedFile } = await readDocument(file, signal, true);
  const result = await invoke({ action: 'plan', data }, signal);
  return { plan: reconcileSourcePages(validatePlan(result), pageTexts), planPdf: convertedFile };
}
export async function analyzeGradeDocument(file: File, signal: AbortSignal): Promise<{ book: GradeBook; gradePdf: File | null }> {
  checkFile(file, 'grades');
  const { data, convertedFile } = await readDocument(file, signal);
  const result = (await invoke({ action: 'grades', data }, signal)) as GradeBook;
  return { book: validateGradeBook({ ...result, columns: result.columns?.map((c) => c.label) }), gradePdf: convertedFile };
}
export async function generateClassComments(input: ClassCommentInput, signal: AbortSignal, onRow: (row: ClassCommentRow) => void) {
  await generateClassWithRepairs(input, signal, requestClassOnce, onRow);
}
async function requestClassOnce(input: ClassCommentInput, signal: AbortSignal, onRow: (row: ClassCommentRow) => void) {
  const result = await invoke({ action: 'generate-class', input }, signal, true);
  if (result instanceof Response && result.body) {
    for await (const raw of readJsonEvents(result.body)) {
      signal.throwIfAborted();
      const event = raw as ClassCommentEvent;
      if (event.type === 'row') onRow(event.row);
      else if (event.type === 'done') return;
      else if (event.type === 'error') throw new Error(event.message);
    }
    throw new Error('평어 생성 연결이 중단됐습니다. 도착한 평어는 유지됩니다.');
  }
  const response = result as ClassCommentResult;
  if (!Array.isArray(response.rows)) throw new Error('학급 평어 응답을 확인하지 못했습니다.');
  for (const row of response.rows) {
    signal.throwIfAborted();
    onRow(row);
  }
}
