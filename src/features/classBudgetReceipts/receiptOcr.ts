import type { ReceiptAnalysisDraft, ReceiptAnalysisSource } from './types';

export interface ReceiptAnalysisProgress {
  stage: 'reading' | 'ocr' | 'parsing';
  progress: number;
  label: string;
}

interface ImageRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

const datePatterns = [
  /((?:19|20)\d{2})\s*[년./-]\s*(\d{1,2})\s*[월./-]\s*(\d{1,2})\s*일?/,
  /\b(\d{2})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{1,2})\b/,
];
const totalLabelPattern = /(결제\s*금액|승인\s*금액|받을\s*금액|합\s*계|총\s*액|총\s*금액|TOTAL|AMOUNT)/i;
const excludedAmountLabelPattern = /(부가세|과세|면세|공급가|거스름|잔액|할인|VAT|TAX|CHANGE|SUBTOTAL)/i;
const merchantLabelPattern = /(?:상호|가맹점명|가맹점|업체명|사업자명|매장명|STORE|MERCHANT)\s*[:：]?\s*(.+)/i;
const merchantExcludedPattern = /(영수증|매출전표|카드전표|사업자|대표자|전화|TEL|FAX|주소|승인|거래|일시|날짜|DATE|합계|총액|TOTAL|금액|AMOUNT|부가세|공급가|카드|현금|고객용|메뉴|단가|수량)/i;

const normalizeLines = (text: string) => text
  .replace(/\r/g, '\n')
  .split('\n')
  .map((line) => line.replace(/\s+/g, ' ').trim())
  .filter(Boolean);

const validDate = (year: number, month: number, day: number) => {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const findSpentAt = (lines: string[]) => {
  for (const line of lines) {
    for (const [index, pattern] of datePatterns.entries()) {
      const match = line.match(pattern);
      if (!match) continue;
      const year = index === 1 ? 2000 + Number(match[1]) : Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      if (validDate(year, month, day)) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
  }
  return '';
};

const parseMoney = (value: string) => Number(value.replace(/[,.\s]/g, ''));
const moneyPattern = /(?:₩|￦|W)?\s*(-?\d{1,3}(?:(?:,|\.)\s*\d{3})+|-?\d{2,9})\s*원?/g;
const explicitMoneyPattern = /(?:[₩￦W]\s*)?(\d{1,3}(?:(?:,|\.)\s*\d{3})+)(?:\s*원)?|(\d{3,8})\s*원/g;

const moneyValues = (line: string) => Array.from(line.matchAll(moneyPattern))
  .map((match) => parseMoney(match[1]))
  .filter((value) => Number.isSafeInteger(value) && value > 0 && value <= 100_000_000);

const explicitMoneyValues = (line: string) => Array.from(line.matchAll(explicitMoneyPattern))
  .map((match) => parseMoney(match[1] ?? match[2]))
  .filter((value) => Number.isSafeInteger(value) && value > 0 && value <= 100_000_000);

const findAmount = (lines: string[]) => {
  const labeled = lines
    .filter((line) => totalLabelPattern.test(line) && !excludedAmountLabelPattern.test(line))
    .flatMap(moneyValues);
  if (labeled.length) return Math.max(...labeled);

  const fallback = lines
    .filter((line) => !excludedAmountLabelPattern.test(line) && !datePatterns.some((pattern) => pattern.test(line)))
    .flatMap(explicitMoneyValues)
    .filter((value) => value >= 100);
  if (!fallback.length) return null;
  const frequencies = fallback.reduce<Map<number, number>>((counts, value) => {
    counts.set(value, (counts.get(value) ?? 0) + 1);
    return counts;
  }, new Map());
  const repeated = [...frequencies.entries()]
    .filter(([, count]) => count >= 2)
    .sort(([leftValue, leftCount], [rightValue, rightCount]) => rightValue - leftValue || rightCount - leftCount);
  return repeated[0]?.[0] ?? Math.max(...fallback);
};

const cleanMerchant = (value: string) => value
  .replace(/^[-\s:：]+/, '')
  .replace(/\s+(?:사업자|대표자|TEL|전화|주소).*$/i, '')
  .trim()
  .slice(0, 80);

const findMerchant = (lines: string[]) => {
  for (const line of lines.slice(0, 18)) {
    const match = line.match(merchantLabelPattern);
    const labeled = match ? cleanMerchant(match[1]) : '';
    if (labeled.length >= 2) return labeled;
  }
  return lines.slice(0, 12)
    .map(cleanMerchant)
    .find((line) => line.length >= 2
      && line.length <= 80
      && /[가-힣A-Za-z]/.test(line)
      && !merchantExcludedPattern.test(line)
      && !datePatterns.some((pattern) => pattern.test(line))
      && moneyValues(line).length === 0
      && line.split(/\s+/).filter((token) => /^[A-Za-z]{1,2}$/.test(token)).length < 3) ?? '';
};

export const parseReceiptText = (
  text: string,
  source: ReceiptAnalysisSource,
  ocrConfidence = 1,
): ReceiptAnalysisDraft => {
  const lines = normalizeLines(text);
  const spentAt = findSpentAt(lines);
  const merchant = findMerchant(lines);
  const amount = findAmount(lines);
  const warnings: string[] = [];
  if (!spentAt) warnings.push('사용 날짜를 찾지 못했습니다.');
  if (!merchant) warnings.push('사용처를 찾지 못했습니다.');
  if (amount === null) warnings.push('결제 금액을 찾지 못했습니다.');
  warnings.push('사용 목적은 직접 입력해야 합니다.');
  const foundRatio = [Boolean(spentAt), Boolean(merchant), amount !== null].filter(Boolean).length / 3;
  return {
    spentAt,
    merchant,
    amount,
    confidence: Math.max(0, Math.min(1, foundRatio * Math.max(0.45, Math.min(1, ocrConfidence)))),
    source,
    warnings,
  };
};

const openPdf = async (file: File) => {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  return pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
};

const extractPdfText = async (file: File, onProgress?: (progress: ReceiptAnalysisProgress) => void) => {
  const pdfDocument = await openPdf(file);
  const pages = Math.min(pdfDocument.numPages, 10);
  const pageTexts: string[] = [];
  for (let index = 1; index <= pages; index += 1) {
    onProgress?.({ stage: 'reading', progress: index / pages, label: `PDF 글자 읽는 중 ${index}/${pages}` });
    const page = await pdfDocument.getPage(index);
    const content = await page.getTextContent();
    const rows = content.items
      .filter((item): item is typeof item & { str: string; transform: number[] } => 'str' in item && 'transform' in item && Boolean(item.str.trim()))
      .map((item) => ({ text: item.str.trim(), x: item.transform[4], y: item.transform[5] }))
      .sort((a, b) => Math.abs(b.y - a.y) > 3 ? b.y - a.y : a.x - b.x)
      .reduce<Array<{ y: number; parts: Array<{ x: number; text: string }> }>>((lines, item) => {
        const line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= 3);
        if (line) line.parts.push({ x: item.x, text: item.text });
        else lines.push({ y: item.y, parts: [{ x: item.x, text: item.text }] });
        return lines;
      }, [])
      .sort((a, b) => b.y - a.y)
      .map((line) => line.parts.sort((a, b) => a.x - b.x).map((part) => part.text).join(' '));
    pageTexts.push(rows.join('\n'));
  }
  return { document: pdfDocument, pageTexts };
};

const createOcrWorker = async (onProgress?: (progress: ReceiptAnalysisProgress) => void) => {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker(['kor', 'eng'], undefined, {
    logger: (message) => {
      if (message.status === 'recognizing text') {
        onProgress?.({
          stage: 'ocr',
          progress: message.progress,
          label: `영수증 글자 인식 중 ${Math.round(message.progress * 100)}%`,
        });
      }
    },
  });
  await worker.setParameters({
    preserve_interword_spaces: '1',
    user_defined_dpi: '300',
  });
  return worker;
};

const findRuns = (values: number[], threshold: number) => {
  const runs: Array<{ start: number; end: number }> = [];
  let start = -1;
  values.forEach((value, index) => {
    if (value >= threshold && start < 0) start = index;
    if ((value < threshold || index === values.length - 1) && start >= 0) {
      runs.push({ start, end: value >= threshold && index === values.length - 1 ? index : index - 1 });
      start = -1;
    }
  });
  return runs;
};

const mergeRuns = (runs: Array<{ start: number; end: number }>, maxGap: number) => runs.reduce<typeof runs>((merged, run) => {
  const previous = merged.at(-1);
  if (previous && run.start - previous.end <= maxGap) previous.end = run.end;
  else merged.push({ ...run });
  return merged;
}, []);

const detectReceiptRegions = (canvas: HTMLCanvasElement): ImageRegion[] => {
  const sampleWidth = Math.min(800, canvas.width);
  const scale = sampleWidth / canvas.width;
  const sampleHeight = Math.max(1, Math.round(canvas.height * scale));
  const sample = document.createElement('canvas');
  sample.width = sampleWidth;
  sample.height = sampleHeight;
  const context = sample.getContext('2d', { willReadFrequently: true });
  if (!context) return [{ x: 0, y: 0, width: canvas.width, height: canvas.height }];
  context.drawImage(canvas, 0, 0, sampleWidth, sampleHeight);
  const pixels = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
  const columns = new Array<number>(sampleWidth).fill(0);
  const rows = new Array<number>(sampleHeight).fill(0);

  for (let y = 0; y < sampleHeight; y += 1) {
    for (let x = 0; x < sampleWidth; x += 1) {
      const offset = (y * sampleWidth + x) * 4;
      const red = pixels[offset];
      const green = pixels[offset + 1];
      const blue = pixels[offset + 2];
      const average = (red + green + blue) / 3;
      const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);
      if (average >= 128 && chroma <= 55) {
        columns[x] += 1;
        rows[y] += 1;
      }
    }
  }

  const columnRatios = columns.map((count) => count / sampleHeight);
  const horizontal = mergeRuns(findRuns(columnRatios, 0.12), Math.round(sampleWidth * 0.008))
    .filter((run) => run.end - run.start + 1 >= sampleWidth * 0.14);
  if (horizontal.length < 2) return [{ x: 0, y: 0, width: canvas.width, height: canvas.height }];

  const paddingX = Math.round(sampleWidth * 0.012);
  const paddingY = Math.round(sampleHeight * 0.012);
  return horizontal.map((column) => {
    const rowRatios = rows.map((_count, y) => {
      let count = 0;
      for (let x = column.start; x <= column.end; x += 1) {
        const offset = (y * sampleWidth + x) * 4;
        const red = pixels[offset];
        const green = pixels[offset + 1];
        const blue = pixels[offset + 2];
        const average = (red + green + blue) / 3;
        const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);
        if (average >= 128 && chroma <= 55) count += 1;
      }
      return count / Math.max(1, column.end - column.start + 1);
    });
    const vertical = mergeRuns(findRuns(rowRatios, 0.24), Math.round(sampleHeight * 0.02));
    const top = Math.max(0, (vertical[0]?.start ?? 0) - paddingY);
    const bottom = Math.min(sampleHeight - 1, (vertical.at(-1)?.end ?? sampleHeight - 1) + paddingY);
    const left = Math.max(0, column.start - paddingX);
    const right = Math.min(sampleWidth - 1, column.end + paddingX);
    return {
      x: Math.round(left / scale),
      y: Math.round(top / scale),
      width: Math.round((right - left + 1) / scale),
      height: Math.round((bottom - top + 1) / scale),
    };
  }).filter((region) => region.width > 0 && region.height > 0);
};

const imageCanvas = async (file: File) => {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('영수증 이미지를 준비하지 못했습니다.');
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
};

const prepareRegionForOcr = (source: HTMLCanvasElement, region: ImageRegion) => {
  const scale = Math.min(1.6, 1300 / region.width, 2800 / region.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(region.width * scale));
  canvas.height = Math.max(1, Math.round(region.height * scale));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('영수증 영역을 준비하지 못했습니다.');
  context.drawImage(source, region.x, region.y, region.width, region.height, 0, 0, canvas.width, canvas.height);

  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const histogram = new Array<number>(256).fill(0);
  for (let index = 0; index < image.data.length; index += 4) {
    const gray = Math.round(image.data[index] * 0.299 + image.data[index + 1] * 0.587 + image.data[index + 2] * 0.114);
    histogram[gray] += 1;
  }
  const pixelCount = canvas.width * canvas.height;
  const percentile = (ratio: number) => {
    let accumulated = 0;
    for (let index = 0; index < histogram.length; index += 1) {
      accumulated += histogram[index];
      if (accumulated >= pixelCount * ratio) return index;
    }
    return 255;
  };
  const dark = percentile(0.04);
  const light = Math.max(dark + 1, percentile(0.96));
  for (let index = 0; index < image.data.length; index += 4) {
    const gray = image.data[index] * 0.299 + image.data[index + 1] * 0.587 + image.data[index + 2] * 0.114;
    const adjusted = Math.max(0, Math.min(255, ((gray - dark) * 255) / (light - dark)));
    image.data[index] = adjusted;
    image.data[index + 1] = adjusted;
    image.data[index + 2] = adjusted;
  }
  context.putImageData(image, 0, 0);
  return canvas;
};

const recognizeImage = async (file: File, onProgress?: (progress: ReceiptAnalysisProgress) => void) => {
  const source = await imageCanvas(file);
  const regions = detectReceiptRegions(source);
  const worker = await createOcrWorker(onProgress);
  const drafts: ReceiptAnalysisDraft[] = [];
  try {
    for (const [index, region] of regions.entries()) {
      const canvas = prepareRegionForOcr(source, region);
      onProgress?.({
        stage: 'ocr',
        progress: index / regions.length,
        label: regions.length > 1 ? `영수증 ${index + 1}/${regions.length} 인식 중` : '영수증 글자 인식 중',
      });
      const result = await worker.recognize(canvas, { rotateAuto: true });
      drafts.push(parseReceiptText(result.data.text, 'browser-ocr', result.data.confidence / 100));
    }
  } finally {
    await worker.terminate();
  }
  return drafts;
};

const recognizePdf = async (
  pdfDocument: Awaited<ReturnType<typeof openPdf>>,
  onProgress?: (progress: ReceiptAnalysisProgress) => void,
) => {
  const worker = await createOcrWorker(onProgress);
  const drafts: ReceiptAnalysisDraft[] = [];
  const limit = Math.min(pdfDocument.numPages, 3);
  try {
    for (let index = 1; index <= limit; index += 1) {
      const page = await pdfDocument.getPage(index);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('PDF 화면을 준비하지 못했습니다.');
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      const result = await worker.recognize(canvas, { rotateAuto: true });
      drafts.push(parseReceiptText(result.data.text, 'browser-ocr', result.data.confidence / 100));
    }
  } finally {
    await worker.terminate();
  }
  return drafts;
};

export const analyzeReceiptFile = async (
  file: File,
  onProgress?: (progress: ReceiptAnalysisProgress) => void,
): Promise<ReceiptAnalysisDraft[]> => {
  onProgress?.({ stage: 'reading', progress: 0, label: '영수증 파일 확인 중' });
  if (file.type === 'application/pdf') {
    const pdf = await extractPdfText(file, onProgress);
    const textDrafts = pdf.pageTexts
      .filter((text) => text.replace(/\s/g, '').length >= 20)
      .map((text) => parseReceiptText(text, 'pdf-text'));
    if (textDrafts.length) return textDrafts;
    return recognizePdf(pdf.document, onProgress);
  }
  return recognizeImage(file, onProgress);
};
