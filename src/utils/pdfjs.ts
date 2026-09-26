/** 화면과 worker 모두 같은 호환 빌드를 사용한다. worker는 별도의 실행 환경이다. */
export const loadPdfJs = async () => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();
  return pdfjs;
};
