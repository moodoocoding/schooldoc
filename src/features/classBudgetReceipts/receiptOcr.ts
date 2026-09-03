import type { ReceiptAnalysisDraft, ReceiptAnalysisSource } from './types';

export interface ReceiptAnalysisProgress { stage: 'reading' | 'ocr' | 'parsing'; progress: number; label: string }

const datePatterns = [
  /((?:19|20)\d{2})\s*[년./-]\s*(\d{1,2})\s*[월./-]\s*(\d{1,2})\s*일?/,
  /\b(\d{2})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{1,2})\b/,
];
const totalLabelPattern = /(결제\s*금액|승인\s*금액|받을\s*금액|합\s*계|총\s*액|총\s*금액|TOTAL|AMOUNT)/i;
const excludedAmountLabelPattern = /(부가세|과세|면세|공급가|거스름|잔액|할인|VAT|TAX|CHANGE|SUBTOTAL)/i;
const merchantLabelPattern = /(?:상호|가맹점명|가맹점|업체명|사업자명|매장명|STORE|MERCHANT)\s*[:：]?\s*(.+)/i;
const merchantExcludedPattern = /(영수증|매출전표|카드전표|사업자|대표자|전화|TEL|FAX|주소|승인|거래|일시|날짜|DATE|합계|총액|TOTAL|금액|AMOUNT|부가세|공급가|카드|현금|고객용)/i;
const normalizeLines = (text: string) => text.replace(/\r/g, '\n').split('\n').map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
const validDate = (year: number, month: number, day: number) => { const date = new Date(Date.UTC(year, month - 1, day)); return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day; };
const findSpentAt = (lines: string[]) => { for (const line of lines) for (const [index, pattern] of datePatterns.entries()) { const match = line.match(pattern); if (!match) continue; const year = index === 1 ? 2000 + Number(match[1]) : Number(match[1]); const month = Number(match[2]); const day = Number(match[3]); if (validDate(year, month, day)) return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`; } return ''; };
const moneyValues = (line: string) => Array.from(line.matchAll(/(?:₩|￦|W)?\s*(-?\d{1,3}(?:,\d{3})+|-?\d{2,9})\s*원?/g)).map((match) => Number(match[1].replace(/,/g, ''))).filter((value) => Number.isSafeInteger(value) && value > 0 && value <= 100_000_000);
const explicitMoneyValues = (line: string) => Array.from(line.matchAll(/(?:[₩￦W]\s*)?(\d{1,3}(?:,\d{3})+)(?:\s*원)?|(\d{3,8})\s*원/g))
  .map((match) => Number((match[1] ?? match[2]).replace(/,/g, '')))
  .filter((value) => Number.isSafeInteger(value) && value > 0 && value <= 100_000_000);
const findAmount = (lines: string[]) => { const labeled = lines.filter((line) => totalLabelPattern.test(line) && !excludedAmountLabelPattern.test(line)).flatMap(moneyValues); if (labeled.length) return Math.max(...labeled); const fallback = lines.filter((line) => !excludedAmountLabelPattern.test(line) && !datePatterns.some((pattern) => pattern.test(line))).flatMap(explicitMoneyValues).filter((value) => value >= 100); return fallback.length ? Math.max(...fallback) : null; };
const cleanMerchant = (value: string) => value.replace(/^[-\s:：]+/, '').replace(/\s+(?:사업자|대표자|TEL|전화|주소).*$/i, '').trim().slice(0, 80);
const findMerchant = (lines: string[]) => { for (const line of lines.slice(0, 18)) { const match = line.match(merchantLabelPattern); const labeled = match ? cleanMerchant(match[1]) : ''; if (labeled.length >= 2) return labeled; } return lines.slice(0, 12).map(cleanMerchant).find((line) => line.length >= 2 && line.length <= 80 && /[가-힣A-Za-z]/.test(line) && !merchantExcludedPattern.test(line) && !datePatterns.some((pattern) => pattern.test(line)) && moneyValues(line).length === 0 && line.split(/\s+/).filter((token) => /^[A-Za-z]{1,2}$/.test(token)).length < 3) ?? ''; };

export const parseReceiptText = (text: string, source: ReceiptAnalysisSource, ocrConfidence = 1): ReceiptAnalysisDraft => {
  const lines = normalizeLines(text); const spentAt = findSpentAt(lines); const merchant = findMerchant(lines); const amount = findAmount(lines); const warnings: string[] = [];
  if (!spentAt) warnings.push('사용 날짜를 찾지 못했습니다.'); if (!merchant) warnings.push('사용처를 찾지 못했습니다.'); if (amount === null) warnings.push('결제 금액을 찾지 못했습니다.'); warnings.push('사용 목적은 직접 입력해야 합니다.');
  const foundRatio = [Boolean(spentAt), Boolean(merchant), amount !== null].filter(Boolean).length / 3;
  return { spentAt, merchant, amount, confidence: Math.max(0, Math.min(1, foundRatio * Math.max(0.45, Math.min(1, ocrConfidence)))), source, warnings };
};

const openPdf = async (file: File) => { const pdfjs = await import('pdfjs-dist'); pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString(); return pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise; };
const extractPdfText = async (file: File, onProgress?: (progress: ReceiptAnalysisProgress) => void) => {
  const pdfDocument = await openPdf(file); const pages = Math.min(pdfDocument.numPages, 10); const chunks: string[] = [];
  for (let index = 1; index <= pages; index += 1) {
    onProgress?.({ stage: 'reading', progress: index / pages, label: `PDF 글자 읽는 중 ${index}/${pages}` });
    const page = await pdfDocument.getPage(index); const content = await page.getTextContent();
    const rows = content.items.filter((item): item is typeof item & { str: string; transform: number[] } => 'str' in item && 'transform' in item && Boolean(item.str.trim())).map((item) => ({ text: item.str.trim(), x: item.transform[4], y: item.transform[5] })).sort((a, b) => Math.abs(b.y - a.y) > 3 ? b.y - a.y : a.x - b.x).reduce<Array<{ y: number; parts: Array<{ x: number; text: string }> }>>((lines, item) => { const line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= 3); if (line) line.parts.push({ x: item.x, text: item.text }); else lines.push({ y: item.y, parts: [{ x: item.x, text: item.text }] }); return lines; }, []).sort((a, b) => b.y - a.y).map((line) => line.parts.sort((a, b) => a.x - b.x).map((part) => part.text).join(' '));
    chunks.push(rows.join('\n'));
  }
  return { document: pdfDocument, text: chunks.join('\n').trim() };
};
const createOcrWorker = async (onProgress?: (progress: ReceiptAnalysisProgress) => void) => { const { createWorker } = await import('tesseract.js'); return createWorker(['kor', 'eng'], undefined, { logger: (message) => { if (message.status === 'recognizing text') onProgress?.({ stage: 'ocr', progress: message.progress, label: `영수증 글자 인식 중 ${Math.round(message.progress * 100)}%` }); } }); };
const recognizeImage = async (source: File | HTMLCanvasElement, onProgress?: (progress: ReceiptAnalysisProgress) => void) => { const worker = await createOcrWorker(onProgress); try { const result = await worker.recognize(source, { rotateAuto: true }); return { text: result.data.text, confidence: result.data.confidence / 100 }; } finally { await worker.terminate(); } };
const recognizePdf = async (pdfDocument: Awaited<ReturnType<typeof openPdf>>, onProgress?: (progress: ReceiptAnalysisProgress) => void) => { const texts: string[] = []; let confidence = 0; const limit = Math.min(pdfDocument.numPages, 3); for (let index = 1; index <= limit; index += 1) { const page = await pdfDocument.getPage(index); const viewport = page.getViewport({ scale: 2 }); const canvas = document.createElement('canvas'); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height); const context = canvas.getContext('2d'); if (!context) throw new Error('PDF 화면을 준비하지 못했습니다.'); await page.render({ canvas, canvasContext: context, viewport }).promise; const result = await recognizeImage(canvas, onProgress); texts.push(result.text); confidence += result.confidence; } return { text: texts.join('\n'), confidence: limit ? confidence / limit : 0 }; };

export const analyzeReceiptFile = async (file: File, onProgress?: (progress: ReceiptAnalysisProgress) => void) => {
  onProgress?.({ stage: 'reading', progress: 0, label: '영수증 파일 확인 중' });
  if (file.type === 'application/pdf') { const pdf = await extractPdfText(file, onProgress); if (pdf.text.replace(/\s/g, '').length >= 20) return parseReceiptText(pdf.text, 'pdf-text'); const recognized = await recognizePdf(pdf.document, onProgress); return parseReceiptText(recognized.text, 'browser-ocr', recognized.confidence); }
  const recognized = await recognizeImage(file, onProgress); return parseReceiptText(recognized.text, 'browser-ocr', recognized.confidence);
};
