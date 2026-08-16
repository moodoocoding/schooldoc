import type { ConsentDocumentAnalysis } from './types';

const MAX_FILE_SIZE = 30 * 1024 * 1024;
const cleanFileTitle = (name: string) => name.replace(/\.pdf$/i, '').trim();
const compactText = (value: string) => value.replace(/[\t ]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

const ensurePdf = (file: File) => {
  if (!/\.pdf$/i.test(file.name)) throw new Error('PDF 파일만 올릴 수 있습니다.');
  if (file.size === 0) throw new Error('내용이 없는 파일은 올릴 수 없습니다.');
  if (file.size > MAX_FILE_SIZE) throw new Error('원본 PDF는 30MB 이하만 올릴 수 있습니다.');
};

export const analyzeConsentDocument = async (file: File): Promise<ConsentDocumentAnalysis> => {
  ensurePdf(file);
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  let document;
  try {
    document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  } catch {
    throw new Error('PDF를 읽지 못했습니다. 손상되거나 암호화된 파일인지 확인해 주세요.');
  }
  const pageTexts: string[] = [];
  const pageSizes: Array<{ width: number; height: number }> = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    pageSizes.push({ width: viewport.width, height: viewport.height });
    if (pageNumber <= 3) {
      const content = await page.getTextContent();
      pageTexts.push(content.items.flatMap((item) => ('str' in item ? [item.str] : [])).join(' '));
    }
  }
  let metadataTitle = '';
  try {
    const metadata = await document.getMetadata();
    const info = metadata.info as { Title?: unknown };
    metadataTitle = typeof info.Title === 'string' ? info.Title.trim() : '';
  } catch {
    // A missing metadata block does not make an otherwise valid PDF unusable.
  }
  const textPreview = compactText(pageTexts.join('\n\n')).slice(0, 2400);
  return {
    fileName: file.name,
    fileSize: file.size,
    title: metadataTitle || cleanFileTitle(file.name) || '가정통신문',
    pageCount: document.numPages,
    pageCountLabel: `${document.numPages}쪽`,
    textPreview,
    warnings: textPreview ? [] : ['텍스트가 없는 스캔 PDF입니다. 원본 화면을 확인해 주세요.'],
    pageSizes,
  };
};

export const consentDocumentAccept = '.pdf,application/pdf';
