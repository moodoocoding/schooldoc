import type { jsPDF } from 'jspdf';
import { loadPdfJs } from '../../utils/pdfjs';
import { buildReceiptExportData, receiptExportFileName } from './receiptExportData';
import { getReceiptOriginal } from './receiptOriginalStore';
import type { ReceiptBook } from './types';

type ExportData = ReturnType<typeof buildReceiptExportData>;
type Evidence = ExportData['evidence'][number];
export interface ReceiptPdfOptions {
  signal?: AbortSignal;
  onProgress?: (message: string) => void;
}

// A4, about 150dpi. Release each page canvas after adding it to the PDF.
const WIDTH = 1240;
const HEIGHT = 1754;
const MARGIN = 74;
const CONTENT_WIDTH = WIDTH - MARGIN * 2;
const BOTTOM = HEIGHT - 110;
const FONT = '"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
const INK = '#172B4D';
const MUTED = '#526174';
const LINE = '#DCE3EA';
const COLUMNS = [56, 144, 198, 348, 158, 188];
const HEADERS = ['번호', '날짜', '사용처', '사용 목적', '금액 (원)', '증빙 번호'];
const money = (value: number) => value.toLocaleString('ko-KR');

function checkCancelled(options: ReceiptPdfOptions) {
  if (options.signal?.aborted) throw new DOMException('내려받기를 취소했습니다.', 'AbortError');
}

async function yieldToBrowser(options: ReceiptPdfOptions) {
  await new Promise<void>(resolve => window.setTimeout(resolve, 0));
  checkCancelled(options);
}

function setFont(context: CanvasRenderingContext2D, size = 22, bold = false) {
  context.font = `${bold ? 700 : 400} ${size}px ${FONT}`;
  context.textBaseline = 'top';
  context.fillStyle = INK;
}

function wrap(context: CanvasRenderingContext2D, value: string, width: number) {
  const lines: string[] = [];
  for (const paragraph of value.replace(/\r\n?/g, '\n').split('\n')) {
    let line = '';
    for (const character of paragraph) {
      if (line && context.measureText(line + character).width > width) {
        lines.push(line);
        line = character;
      } else line += character;
    }
    lines.push(line);
  }
  return lines;
}

function textLines(context: CanvasRenderingContext2D, lines: string[], x: number, y: number, lineHeight = 31) {
  lines.forEach((line, index) => context.fillText(line, x, y + index * lineHeight));
}

function pageCanvas(pageNumber: number) {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('PDF를 그리지 못했습니다. 다른 브라우저에서 다시 시도해 주세요.');
  context.fillStyle = '#FFFFFF';
  context.fillRect(0, 0, WIDTH, HEIGHT);
  setFont(context, 18);
  context.fillStyle = MUTED;
  context.fillText('SchoolDoc', MARGIN, HEIGHT - 60);
  context.textAlign = 'right';
  context.fillText(String(pageNumber), WIDTH - MARGIN, HEIGHT - 60);
  context.textAlign = 'left';
  return { canvas, context };
}

function addCanvas(pdf: jsPDF, canvas: HTMLCanvasElement) {
  pdf.addImage(canvas, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
  canvas.width = 0;
  canvas.height = 0;
}

function ledgerHeader(context: CanvasRenderingContext2D, data: ExportData) {
  setFont(context, 22, true);
  context.fillStyle = '#0F6CBD';
  context.fillText('학급 운영비 지출대장', MARGIN, 70);
  setFont(context, 34, true);
  const title = wrap(context, data.title, CONTENT_WIDTH);
  textLines(context, title, MARGIN, 111, 44);
  let y = 123 + title.length * 44;
  setFont(context, 22);
  const subtitle = wrap(context, `${data.schoolYear}학년도 · ${data.classLabel}`, CONTENT_WIDTH);
  textLines(context, subtitle, MARGIN, y);
  y += subtitle.length * 31 + 22;
  context.fillStyle = '#EFF6FC';
  context.fillRect(MARGIN, y, CONTENT_WIDTH, 92);
  const summaries = [['전체 예산', data.totalBudget], ['사용 금액', data.usedAmount], ['남은 금액', data.remainingAmount]] as const;
  summaries.forEach(([label, amount], index) => {
    const x = MARGIN + index * CONTENT_WIDTH / 3 + 18;
    setFont(context, 19); context.fillStyle = MUTED; context.fillText(label, x, y + 14);
    setFont(context, 27, true); context.fillText(`${money(amount)}원`, x, y + 44);
  });
  y += 112;
  setFont(context, 18); context.fillStyle = MUTED;
  context.fillText(`장부 반영 ${data.rows.length}건 · 휴지통·검토 중인 분석 제외 · 증빙 ${data.evidence.length}개`, MARGIN, y);
  y += 38;
  context.fillStyle = '#EAF1F7'; context.fillRect(MARGIN, y, CONTENT_WIDTH, 48);
  setFont(context, 20, true);
  let x = MARGIN;
  HEADERS.forEach((label, index) => { context.fillText(label, x + 10, y + 13); x += COLUMNS[index]; });
  return y + 48;
}

async function addLedger(pdf: jsPDF, data: ExportData, options: ReceiptPdfOptions) {
  let current = pageCanvas(1);
  let y = ledgerHeader(current.context, data);
  const headerBottom = y;
  if (y > BOTTOM - 150) throw new Error('장부 제목이나 학급명이 너무 길어 PDF를 만들 수 없습니다.');
  const nextPage = async () => {
    addCanvas(pdf, current.canvas);
    await yieldToBrowser(options);
    pdf.addPage();
    current = pageCanvas(pdf.getNumberOfPages());
    y = ledgerHeader(current.context, data);
  };
  for (const row of data.rows) {
    checkCancelled(options);
    const values = [String(row.number), row.spentAt, row.merchant, row.purpose, money(row.amount), row.evidenceNumbers.length ? row.evidenceNumbers.map(n => `증빙 ${n}`).join(', ') : '없음'];
    setFont(current.context);
    const cells = values.map((value, index) => wrap(current.context, value, COLUMNS[index] - 20));
    const count = Math.max(...cells.map(cell => cell.length));
    const height = Math.max(58, count * 31 + 26);
    if (y + height > BOTTOM && y > headerBottom) await nextPage();
    let offset = 0;
    while (offset < count) {
      const available = Math.floor((BOTTOM - y - 26) / 31);
      if (available < 1) { await nextPage(); continue; }
      const length = Math.min(count - offset, available);
      const segmentHeight = Math.max(58, length * 31 + 26);
      const context = current.context;
      if (row.number % 2 === 0) { context.fillStyle = '#F8FAFC'; context.fillRect(MARGIN, y, CONTENT_WIDTH, segmentHeight); }
      setFont(context);
      let x = MARGIN;
      cells.forEach((lines, index) => {
        context.textAlign = index === 4 ? 'right' : 'left';
        textLines(context, lines.slice(offset, offset + length), index === 4 ? x + COLUMNS[index] - 10 : x + 10, y + 13);
        x += COLUMNS[index];
      });
      context.textAlign = 'left';
      context.strokeStyle = LINE; context.beginPath(); context.moveTo(MARGIN, y + segmentHeight); context.lineTo(WIDTH - MARGIN, y + segmentHeight); context.stroke();
      y += segmentHeight;
      offset += length;
      if (offset < count) await nextPage();
    }
  }
  if (y + 68 > BOTTOM) await nextPage();
  const context = current.context;
  context.fillStyle = '#EAF1F7'; context.fillRect(MARGIN, y, CONTENT_WIDTH, 58);
  setFont(context, 23, true); context.fillText('합계', MARGIN + 12, y + 16);
  context.textAlign = 'right'; context.fillText(`${money(data.usedAmount)}원`, WIDTH - MARGIN - 12, y + 16);
  context.textAlign = 'left';
  addCanvas(pdf, current.canvas);
}

async function originalFor(book: ReceiptBook, evidence: Evidence): Promise<Blob> {
  const file = evidence.file;
  const missing = () => new Error(`증빙 ${evidence.number}의 원본을 찾을 수 없습니다. 해당 지출을 열어 원본을 다시 연결한 뒤 내려받아 주세요.`);
  if (!file || file.bookId !== book.id) throw missing();
  let original: File | undefined;
  try { original = await getReceiptOriginal(book.ownerId, book.id, file.id); }
  catch { throw new Error(`증빙 ${evidence.number}의 원본을 읽지 못했습니다. 브라우저 저장 공간을 확인한 뒤 다시 시도해 주세요.`); }
  if (original) return original;
  if (/^data:(image\/(jpeg|png|webp)|application\/pdf);base64,/.test(file.previewUrl)) {
    return (await fetch(file.previewUrl)).blob();
  }
  throw missing();
}

function attachmentHeader(context: CanvasRenderingContext2D, evidence: Evidence, page: number, total: number) {
  setFont(context, 32, true);
  context.fillText(`증빙 ${evidence.number}`, MARGIN, 70);
  setFont(context, 20);
  const details = wrap(context, `지출 번호 ${evidence.entryNumbers.join(', ')} · 원본 ${page}/${total}쪽`, CONTENT_WIDTH);
  textLines(context, details, MARGIN, 120, 29);
  const name = wrap(context, evidence.file?.originalName ?? '', CONTENT_WIDTH);
  const nameY = 130 + details.length * 29;
  context.fillStyle = MUTED; textLines(context, name, MARGIN, nameY, 29);
  const top = nameY + name.length * 29 + 28;
  if (top > BOTTOM - 200) throw new Error(`증빙 ${evidence.number}의 파일명이 너무 길어 PDF를 만들 수 없습니다.`);
  return { top, height: BOTTOM - top };
}

function attachmentPage(pdf: jsPDF, evidence: Evidence, page: number, total: number) {
  pdf.addPage();
  const current = pageCanvas(pdf.getNumberOfPages());
  return { ...current, ...attachmentHeader(current.context, evidence, page, total) };
}

async function addImageEvidence(pdf: jsPDF, blob: Blob, evidence: Evidence, options: ReceiptPdfOptions) {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve(); image.onerror = () => reject(new Error('Image decode failed'));
      image.src = url;
    });
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('Empty image');
    await yieldToBrowser(options);
    options.onProgress?.(`증빙 ${evidence.number} · 1/1쪽 만드는 중`);
    const page = attachmentPage(pdf, evidence, 1, 1);
    // 사진 원본 한 장은 길이·여백과 관계없이 자르지 않고 한 A4 쪽에 비율을 유지해 넣는다.
    const scale = Math.min(CONTENT_WIDTH / image.naturalWidth, page.height / image.naturalHeight);
    const width = image.naturalWidth * scale;
    page.context.imageSmoothingQuality = 'high';
    page.context.drawImage(image, MARGIN + (CONTENT_WIDTH - width) / 2, page.top,
      width, image.naturalHeight * scale);
    addCanvas(pdf, page.canvas);
  } finally { URL.revokeObjectURL(url); }
}

async function addPdfEvidence(pdf: jsPDF, blob: Blob, evidence: Evidence, options: ReceiptPdfOptions) {
  const pdfjs = await loadPdfJs();
  const task = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) });
  const abort = () => { void task.destroy(); };
  options.signal?.addEventListener('abort', abort, { once: true });
  try {
    const document = await task.promise;
    for (let number = 1; number <= document.numPages; number++) {
      checkCancelled(options);
      options.onProgress?.(`증빙 ${evidence.number} · ${number}/${document.numPages}쪽 만드는 중`);
      const sourcePage = await document.getPage(number);
      const page = attachmentPage(pdf, evidence, number, document.numPages);
      const size = sourcePage.getViewport({ scale: 1 });
      const viewport = sourcePage.getViewport({ scale: Math.min(CONTENT_WIDTH / size.width, page.height / size.height) });
      const source = window.document.createElement('canvas');
      source.width = Math.ceil(viewport.width); source.height = Math.ceil(viewport.height);
      try {
        await sourcePage.render({ canvas: source, viewport }).promise;
        page.context.drawImage(source, MARGIN + (CONTENT_WIDTH - source.width) / 2, page.top);
        addCanvas(pdf, page.canvas);
      } finally { source.width = 0; source.height = 0; sourcePage.cleanup(); }
      await yieldToBrowser(options);
    }
  } finally {
    options.signal?.removeEventListener('abort', abort);
    await task.destroy();
  }
}

/** All referenced originals must render successfully before any download is created. */
export async function buildReceiptBookPdf(book: ReceiptBook, options: ReceiptPdfOptions = {}): Promise<Blob> {
  checkCancelled(options);
  const data = buildReceiptExportData(book);
  if (!data.rows.length) throw new Error('장부에 반영한 지출이 없습니다.');
  const { jsPDF } = await import('jspdf');
  checkCancelled(options);
  await document.fonts.ready;
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  options.onProgress?.('지출대장 만드는 중');
  await addLedger(pdf, data, options);
  for (const evidence of data.evidence) {
    await yieldToBrowser(options);
    options.onProgress?.(`증빙 ${evidence.number}/${data.evidence.length} 불러오는 중`);
    const blob = await originalFor(book, evidence);
    checkCancelled(options);
    try {
      const type = blob.type || evidence.file?.mimeType || '';
      if (type === 'application/pdf') await addPdfEvidence(pdf, blob, evidence, options);
      else if (/^image\/(jpeg|png|webp)$/.test(type)) await addImageEvidence(pdf, blob, evidence, options);
      else throw new Error('Unsupported receipt type');
    } catch {
      checkCancelled(options);
      throw new Error(`증빙 ${evidence.number}을 읽지 못했습니다. 원본 파일을 확인한 뒤 다시 시도해 주세요.`);
    }
  }
  checkCancelled(options);
  return pdf.output('blob');
}

export async function downloadReceiptBookPdf(book: ReceiptBook, options: ReceiptPdfOptions = {}) {
  const blob = await buildReceiptBookPdf(book, options);
  checkCancelled(options);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = receiptExportFileName(book.title, '영수증첨부', 'pdf');
  document.body.append(anchor);
  try { anchor.click(); } finally { anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 30_000); }
}
