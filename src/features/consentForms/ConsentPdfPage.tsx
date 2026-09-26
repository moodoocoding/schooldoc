import { useEffect, useRef, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import type { PDFDocumentLoadingTask, RenderTask } from 'pdfjs-dist';
import { loadPdfJs } from '../../utils/pdfjs';

export type ConsentPdfState = 'loading' | 'ready' | 'error';

export function ConsentPdfPage({ file, pageNumber, onStateChange }: {
  file: File;
  pageNumber: number;
  onStateChange?: (file: File, pageNumber: number, state: ConsentPdfState) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ file: File; pageNumber: number; attempt: number; state: ConsentPdfState }>();
  const state = result?.file === file && result.pageNumber === pageNumber && result.attempt === attempt ? result.state : 'loading';

  useEffect(() => {
    let active = true;
    let loadingTask: PDFDocumentLoadingTask | undefined;
    let renderTask: RenderTask | undefined;
    let disposing: Promise<void> | undefined;
    const dispose = () => disposing ??= (loadingTask?.destroy() ?? Promise.resolve());
    const report = (next: ConsentPdfState) => {
      if (!active) return;
      setResult({ file, pageNumber, attempt, state: next });
      onStateChange?.(file, pageNumber, next);
    };
    const render = async () => {
      report('loading');
      try {
        const [pdfjs, data] = await Promise.all([loadPdfJs(), file.arrayBuffer()]);
        if (!active) return;
        loadingTask = pdfjs.getDocument({ data: new Uint8Array(data) });
        const document = await loadingTask.promise;
        const page = await document.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = canvasRef.current;
        if (!canvas || !active) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('PDF canvas unavailable');
        renderTask = page.render({ canvas, canvasContext: context, viewport });
        await renderTask.promise;
        report('ready');
      } catch {
        report('error');
      } finally {
        await dispose().catch(() => undefined);
      }
    };
    void render();
    return () => {
      active = false;
      renderTask?.cancel();
      void dispose().catch(() => undefined);
    };
  }, [file, pageNumber, attempt, onStateChange]);

  const retry = () => {
    onStateChange?.(file, pageNumber, 'loading');
    setAttempt(previous => previous + 1);
  };

  return <div className="relative h-full w-full bg-white" data-pdf-state={state}>
    {state === 'loading' ? <div aria-label="원본 PDF 렌더링 중" className="absolute inset-0 z-10 grid place-items-center bg-white"><LoaderCircle className="h-7 w-7 animate-spin text-[#0F6CBD]" /></div> : null}
    {state === 'error' ? <div role="alert" className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white px-6 text-center text-sm">
      <p className="font-semibold text-[#B42318]">{pageNumber}쪽 원본을 표시하지 못했습니다.</p>
      <p className="text-[#526174]">다시 시도해 주세요. 계속 열리지 않으면 최신 브라우저로 링크를 열어 주세요.</p>
      <button type="button" onClick={retry} className="min-h-[48px] rounded-lg border border-[#C8D0DA] px-4 font-semibold text-[#0F6CBD]">다시 시도</button>
    </div> : null}
    <canvas ref={canvasRef} className="h-full w-full object-contain" />
  </div>;
}
