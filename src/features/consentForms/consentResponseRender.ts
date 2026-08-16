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

const openDocument = async (file: File) => {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  return pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
};

/** 원본 페이지는 응답마다 다시 그릴 필요가 없으므로 한 번만 렌더해 재사용한다. */
const renderBasePage = async (source: Awaited<ReturnType<typeof openDocument>>, pageNumber: number) => {
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
  return canvas;
};

const loadSignatures = async (fields: ConsentFieldDraft[], response: ConsentResponseRecord) => {
  const signatures = new Map<string, ImageBitmap>();
  for (const field of fields) {
    const value = response.values[field.id];
    if (field.kind === 'signature' && value) signatures.set(field.id, await loadImage(value));
  }
  return signatures;
};

const drawPageValues = (
  context: CanvasRenderingContext2D,
  fields: ConsentFieldDraft[],
  response: ConsentResponseRecord,
  signatures: Map<string, ImageBitmap>,
  pageIndex: number,
  pageWidth: number,
  pageHeight: number,
) => {
  fields.filter((field) => field.pageIndex === pageIndex).forEach((field) => {
    const value = response.values[field.id] ?? '';
    if (!value) return;
    const rect = fieldRect(field, pageWidth, pageHeight);
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
};

/**
 * 응답들을 원본 PDF 위에 합성해 하나의 PDF Blob으로 돌려준다.
 * 응답 한 건이 원본 전체 쪽수를 차지하므로 결과는 응답 순서대로 이어 붙는다.
 */
export const renderConsentResponsesPdf = async ({ file, fields, responses, onProgress }: {
  file: File;
  fields: ConsentFieldDraft[];
  responses: ConsentResponseRecord[];
  onProgress?: (done: number, total: number) => void;
}) => {
  if (!responses.length) throw new Error('내려받을 응답이 없습니다.');
  const [source, { jsPDF }] = await Promise.all([openDocument(file), import('jspdf')]);
  if (!source.numPages) throw new Error('원본 PDF에서 페이지를 찾지 못했습니다.');

  const basePages: HTMLCanvasElement[] = [];
  for (let pageNumber = 1; pageNumber <= source.numPages; pageNumber += 1) {
    basePages.push(await renderBasePage(source, pageNumber));
  }

  const work = document.createElement('canvas');
  let pdf: InstanceType<typeof jsPDF> | null = null;
  try {
    for (let index = 0; index < responses.length; index += 1) {
      const response = responses[index];
      onProgress?.(index, responses.length);
      const signatures = await loadSignatures(fields, response);
      try {
        basePages.forEach((base, pageIndex) => {
          // 크기를 다시 지정하면 캔버스가 초기화되므로 작업용 캔버스 하나를 계속 재사용한다.
          work.width = base.width;
          work.height = base.height;
          const context = work.getContext('2d');
          if (!context) throw new Error('PDF 합성 화면을 준비하지 못했습니다.');
          context.drawImage(base, 0, 0);
          drawPageValues(context, fields, response, signatures, pageIndex, work.width, work.height);

          const pageWidth = work.width / RENDER_SCALE;
          const pageHeight = work.height / RENDER_SCALE;
          const orientation = pageWidth > pageHeight ? 'landscape' : 'portrait';
          if (pdf) pdf.addPage([pageWidth, pageHeight], orientation);
          else pdf = new jsPDF({ unit: 'pt', format: [pageWidth, pageHeight], orientation, compress: true });
          pdf.addImage(work.toDataURL('image/png'), 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
        });
      } finally {
        signatures.forEach((image) => image.close());
      }
    }
  } finally {
    basePages.forEach((canvas) => { canvas.width = 0; canvas.height = 0; });
    work.width = 0;
    work.height = 0;
  }

  onProgress?.(responses.length, responses.length);
  if (!pdf) throw new Error('원본 PDF에서 페이지를 찾지 못했습니다.');
  return (pdf as InstanceType<typeof jsPDF>).output('blob');
};

/** 응답 한 건을 원본 PDF 위에 합성해 PDF Blob으로 돌려준다. */
export const renderConsentResponsePdf = ({ file, fields, response }: {
  file: File;
  fields: ConsentFieldDraft[];
  response: ConsentResponseRecord;
}) => renderConsentResponsesPdf({ file, fields, responses: [response] });

const safeFileTitle = (title: string) => title.replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 60) || '가정통신문';

export const consentResponseFileName = (title: string, index: number) => (
  `${safeFileTitle(title)}_응답${String(index).padStart(3, '0')}.pdf`
);

export const consentQrFileName = (title: string) => `${safeFileTitle(title)}_응답QR.png`;

/** 화면의 QR SVG를 인쇄에 쓸 수 있는 크기의 PNG로 변환한다. */
export const svgToPngBlob = async (svg: SVGSVGElement, size: number) => {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(size));
  clone.setAttribute('height', String(size));
  const markup = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = new Image();
    image.decoding = 'sync';
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('QR 이미지를 만들지 못했습니다.'));
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('QR 이미지를 만들지 못했습니다.');
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, size, size);
    context.drawImage(image, 0, 0, size, size);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('QR 이미지를 만들지 못했습니다.')), 'image/png');
    });
  } finally {
    URL.revokeObjectURL(url);
  }
};

export const consentResponsesFileName = (title: string, count: number) => (
  `${safeFileTitle(title)}_응답모음_${count}건.pdf`
);

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
