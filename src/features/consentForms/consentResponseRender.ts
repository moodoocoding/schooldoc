import { fieldRect } from './consentFieldLayout';
import type { ConsentFieldDraft, ConsentResponseRecord } from './types';

/**
 * 원본 PDF 페이지를 캔버스에 렌더한 뒤 응답 값을 같은 캔버스 위에 그린다.
 * 캔버스가 한글 글꼴을 직접 처리하므로 PDF에 한글 폰트를 임베드할 필요가 없다.
 * 대신 결과가 래스터라 텍스트 선택은 되지 않는다.
 */
const RENDER_SCALE = 2;
const FONT_STACK = '"Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", "Nanum Gothic", sans-serif';
const TEXT_COLOR = '#111827';
const PADDING_RATIO = 0.12;
/** 값이 입력칸을 꽉 채우면 원본 본문보다 커 보인다. 채워 넣은 글씨처럼 보이도록 기준 크기를 낮춘다. */
const TEXT_HEIGHT_RATIO = 0.5;

export const formatConsentValue = (field: ConsentFieldDraft, value: string) => {
  if (field.kind !== 'date') return value;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  return match ? `${match[1]}. ${Number(match[2])}. ${Number(match[3])}.` : value;
};

/** 필드 안에 들어가도록 글꼴 크기를 줄여가며 줄바꿈 결과를 찾는다. */
export const fitTextLines = (
  measure: (text: string, fontSize: number) => number,
  text: string,
  maxWidth: number,
  maxHeight: number,
  startSize: number,
) => {
  for (let fontSize = startSize; fontSize >= 5; fontSize -= 0.5) {
    const lineHeight = fontSize * 1.25;
    const lines: string[] = [];
    let current = '';
    for (const character of text) {
      const candidate = current + character;
      if (current && measure(candidate, fontSize) > maxWidth) {
        lines.push(current);
        current = character;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
    if (lines.length * lineHeight <= maxHeight && lines.every((line) => measure(line, fontSize) <= maxWidth)) {
      return { fontSize, lineHeight, lines };
    }
  }
  return { fontSize: 5, lineHeight: 6.25, lines: [text] };
};

const loadImage = async (source: string) => {
  const response = await fetch(source);
  if (!response.ok) throw new Error('서명 이미지를 불러오지 못했습니다.');
  return createImageBitmap(await response.blob());
};

const drawText = (context: CanvasRenderingContext2D, text: string, rect: ReturnType<typeof fieldRect>) => {
  const padding = Math.min(rect.height * PADDING_RATIO, 6);
  const innerWidth = Math.max(rect.width - padding * 2, 1);
  const innerHeight = Math.max(rect.height - padding * 2, 1);
  const measure = (value: string, fontSize: number) => {
    context.font = `600 ${fontSize}px ${FONT_STACK}`;
    return context.measureText(value).width;
  };
  const { fontSize, lineHeight, lines } = fitTextLines(measure, text, innerWidth, innerHeight, innerHeight * TEXT_HEIGHT_RATIO);
  context.font = `600 ${fontSize}px ${FONT_STACK}`;
  context.fillStyle = TEXT_COLOR;
  context.textAlign = 'left';
  context.textBaseline = 'middle';
  const blockTop = rect.top + rect.height / 2 - (lines.length * lineHeight) / 2;
  lines.forEach((line, index) => {
    context.fillText(line, rect.left + padding, blockTop + lineHeight * (index + 0.5));
  });
};

const drawCheckbox = (context: CanvasRenderingContext2D, label: string, rect: ReturnType<typeof fieldRect>) => {
  const padding = Math.min(rect.height * PADDING_RATIO, 6);
  const box = Math.min(rect.height - padding * 2, 18);
  const boxLeft = rect.left + padding;
  const boxTop = rect.top + rect.height / 2 - box / 2;
  context.strokeStyle = TEXT_COLOR;
  context.lineWidth = Math.max(box * 0.09, 1);
  context.strokeRect(boxLeft, boxTop, box, box);
  context.beginPath();
  context.lineWidth = Math.max(box * 0.14, 1.4);
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.moveTo(boxLeft + box * 0.21, boxTop + box * 0.53);
  context.lineTo(boxLeft + box * 0.43, boxTop + box * 0.75);
  context.lineTo(boxLeft + box * 0.81, boxTop + box * 0.25);
  context.stroke();
  if (!label) return;
  drawText(context, label, {
    left: boxLeft + box + padding,
    top: rect.top,
    width: Math.max(rect.width - box - padding * 3, 1),
    height: rect.height,
  });
};

const drawSignature = (context: CanvasRenderingContext2D, image: ImageBitmap, rect: ReturnType<typeof fieldRect>) => {
  const padding = Math.min(rect.height * PADDING_RATIO, 4);
  const innerWidth = Math.max(rect.width - padding * 2, 1);
  const innerHeight = Math.max(rect.height - padding * 2, 1);
  const ratio = Math.min(innerWidth / image.width, innerHeight / image.height);
  const width = image.width * ratio;
  const height = image.height * ratio;
  context.drawImage(
    image,
    rect.left + rect.width / 2 - width / 2,
    rect.top + rect.height / 2 - height / 2,
    width,
    height,
  );
};

/** 응답 한 건을 원본 PDF 위에 합성해 PDF Blob으로 돌려준다. */
export const renderConsentResponsePdf = async ({ file, fields, response }: {
  file: File;
  fields: ConsentFieldDraft[];
  response: ConsentResponseRecord;
}) => {
  const [pdfjs, { jsPDF }] = await Promise.all([import('pdfjs-dist'), import('jspdf')]);
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  const source = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;

  const signatures = new Map<string, ImageBitmap>();
  for (const field of fields) {
    const value = response.values[field.id];
    if (field.kind === 'signature' && value) signatures.set(field.id, await loadImage(value));
  }

  let pdf: InstanceType<typeof jsPDF> | null = null;
  try {
    for (let pageNumber = 1; pageNumber <= source.numPages; pageNumber += 1) {
      const page = await source.getPage(pageNumber);
      const viewport = page.getViewport({ scale: RENDER_SCALE });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('PDF 합성 화면을 준비하지 못했습니다.');
      context.fillStyle = '#FFFFFF';
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: context, viewport }).promise;

      fields.filter((field) => field.pageIndex === pageNumber - 1).forEach((field) => {
        const value = response.values[field.id] ?? '';
        if (!value) return;
        const rect = fieldRect(field, canvas.width, canvas.height);
        if (field.kind === 'signature') {
          const image = signatures.get(field.id);
          if (image) drawSignature(context, image, rect);
          return;
        }
        if (field.kind === 'checkbox') {
          if (value === 'true') drawCheckbox(context, field.label, rect);
          return;
        }
        drawText(context, formatConsentValue(field, value), rect);
      });

      const pageWidth = canvas.width / RENDER_SCALE;
      const pageHeight = canvas.height / RENDER_SCALE;
      const orientation = pageWidth > pageHeight ? 'landscape' : 'portrait';
      if (pdf) pdf.addPage([pageWidth, pageHeight], orientation);
      else pdf = new jsPDF({ unit: 'pt', format: [pageWidth, pageHeight], orientation, compress: true });
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
    }
  } finally {
    signatures.forEach((image) => image.close());
  }

  if (!pdf) throw new Error('원본 PDF에서 페이지를 찾지 못했습니다.');
  return pdf.output('blob');
};

export const consentResponseFileName = (title: string, index: number) => {
  const safeTitle = title.replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 60) || '가정통신문';
  return `${safeTitle}_응답${String(index).padStart(3, '0')}.pdf`;
};

export const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // 즉시 해제하면 브라우저가 저장을 시작하기 전에 URL이 사라질 수 있다.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
};
