import fontUrl from '../officialDocument/assets/fonts/NanumGothic-Regular.ttf?url';
import { NEIS_MAX_FILE_BYTES } from '../../../supabase/functions/_shared/neisHelper';
import type { HangulPage, HangulRequest, HangulResponse } from './hangulDocument.worker';

const conversionError = '한글 문서의 지면을 만들지 못했습니다. 다시 시도하거나 PDF로 저장해 올려 주세요.';
const sizeError = '변환한 PDF가 10MB를 넘습니다. 한글 문서를 나누거나 PDF로 저장해 올려 주세요.';
// Leave room for the searchable text, embedded font, and PDF structure.
const imageBudget = Math.floor(NEIS_MAX_FILE_BYTES * 0.85);

async function readFont(signal: AbortSignal) {
  const response = await fetch(fontUrl, { signal });
  if (!response.ok) throw new Error(conversionError);
  const font = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error(conversionError));
    reader.readAsDataURL(font);
  });
}

function requestPage(worker: Worker, request: HangulRequest, signal: AbortSignal) {
  signal.throwIfAborted();
  return new Promise<HangulResponse>((resolve, reject) => {
    const finish = () => signal.removeEventListener('abort', abort);
    const abort = () => reject(signal.reason);
    const failure = () => {
      finish();
      reject(new Error(conversionError));
    };
    signal.addEventListener('abort', abort, { once: true });
    worker.onerror = failure;
    worker.onmessageerror = failure;
    worker.onmessage = ({ data }: MessageEvent<HangulResponse>) => {
      finish();
      if ('error' in data) reject(new Error(data.error));
      else resolve(data);
    };
    try {
      worker.postMessage(request);
    } catch {
      failure();
    }
  });
}

async function renderPage(canvas: HTMLCanvasElement, page: HangulPage, font: string, budget: number) {
  const svg = new DOMParser().parseFromString(page.svg, 'image/svg+xml');
  if (svg.documentElement.localName !== 'svg' || svg.querySelector('parsererror')) throw new Error(conversionError);
  const style = svg.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = `@font-face{font-family:NeisHangul;src:url(data:font/ttf;base64,${font}) format('truetype');}`;
  svg.documentElement.prepend(style);
  for (const element of Array.from(svg.querySelectorAll('[font-family]'))) {
    const family = element.getAttribute('font-family') ?? '';
    element.setAttribute('font-family', family.replace(/(,\s*(?:serif|sans-serif|monospace))?$/, ',NeisHangul$1'));
  }
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }));
  const encode = (quality: number) => new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error(conversionError)), 'image/jpeg', quality);
  });
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error(conversionError);
    const draw = (scale: number) => {
      canvas.width = Math.max(1, Math.round(page.width * scale));
      canvas.height = Math.max(1, Math.round(page.height * scale));
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    const scale = Math.min(1.8, 2400 / Math.max(page.width, page.height));
    draw(scale);
    const detailed = await encode(0.88);
    if (detailed.size <= budget) return detailed;
    const compressed = await encode(0.65);
    if (compressed.size <= budget) return compressed;
    draw(scale * Math.max(0.55, Math.sqrt(budget / compressed.size) * 0.9));
    return await encode(0.65);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function convertHangulToPdf(file: File, signal: AbortSignal) {
  signal.throwIfAborted();
  const worker = new Worker(new URL('./hangulDocument.worker.ts', import.meta.url), { type: 'module' });
  const timeout = AbortSignal.timeout(90_000);
  const active = AbortSignal.any([signal, timeout]);
  const canvas = document.createElement('canvas');
  try {
    const [info, font, { jsPDF }] = await Promise.all([
      requestPage(worker, { file }, active), readFont(active), import('jspdf'),
    ]);
    if (!('count' in info)) throw new Error(conversionError);
    let pdf: InstanceType<typeof jsPDF> | undefined;
    let imageBytes = 0;
    const pageTexts: string[] = [];
    for (let index = 0; index < info.count; index++) {
      const result = await requestPage(worker, { index }, active);
      if (!('page' in result)) throw new Error(conversionError);
      const { page } = result;
      const width = page.width * 0.75;
      const height = page.height * 0.75;
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
        throw new Error(conversionError);
      const format: [number, number] = [width, height];
      const orientation = width > height ? 'landscape' : 'portrait';
      if (pdf) pdf.addPage(format, orientation);
      else {
        pdf = new jsPDF({ unit: 'pt', format, orientation, compress: true, putOnlyUsedFonts: true });
        pdf.addFileToVFS('NanumGothic.ttf', font);
        pdf.addFont('NanumGothic.ttf', 'NanumGothic', 'normal');
        pdf.setFont('NanumGothic');
      }
      const remainingBudget = Math.max(0, imageBudget - imageBytes);
      const image = await renderPage(canvas, page, font, remainingBudget / (info.count - index));
      const bytes = new Uint8Array(await image.arrayBuffer());
      active.throwIfAborted();
      imageBytes += bytes.length;
      if (imageBytes >= NEIS_MAX_FILE_BYTES) throw new Error(sizeError);
      pdf.addImage(bytes, 'JPEG', 0, 0, width, height, `page-${index}`);
      // Keep the page text searchable without painting over the table layout.
      for (const run of page.runs) {
        if (!run.text.trim() || run.fontSize <= 0) continue;
        pdf.setFontSize(run.fontSize * 0.75);
        const fontWidth = pdf.getTextWidth(run.text);
        pdf.text(run.text, run.x * 0.75, run.y * 0.75, {
          baseline: 'top',
          horizontalScale: fontWidth > 0 && run.w > 0 ? (run.w * 0.75) / fontWidth : 1,
          renderingMode: 'invisible',
        });
      }
      pageTexts.push(page.runs.map((run) => run.text).join(' '));
    }
    const output = pdf?.output('blob');
    if (!output) throw new Error(conversionError);
    if (output.size > NEIS_MAX_FILE_BYTES) throw new Error(sizeError);
    return { pdf: new File([output], file.name.replace(/\.hwpx?$/i, '.pdf'), { type: 'application/pdf' }), pageTexts };
  } catch (error) {
    if (timeout.aborted && !signal.aborted) throw new Error('한글 문서 변환 시간이 초과됐습니다. 다시 시도하거나 PDF로 저장해 올려 주세요.');
    if (error instanceof Error && /[가-힣]/.test(error.message)) throw error;
    throw new Error(conversionError);
  } finally {
    worker.terminate();
    canvas.width = 0;
    canvas.height = 0;
  }
}
