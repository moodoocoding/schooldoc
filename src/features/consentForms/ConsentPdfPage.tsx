import { useEffect, useRef, useState } from 'react';
import { LoaderCircle } from 'lucide-react';

export function ConsentPdfPage({ file, pageNumber }: { file: File; pageNumber: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const render = async () => {
      setLoading(true);
      setError('');
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
        const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
        const page = await document.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = canvasRef.current;
        if (!canvas || !active) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('PDF 화면을 준비하지 못했습니다.');
        await page.render({ canvas, canvasContext: context, viewport }).promise;
      } catch (renderError) {
        if (active) setError(renderError instanceof Error ? renderError.message : 'PDF 페이지를 표시하지 못했습니다.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void render();
    return () => { active = false; };
  }, [file, pageNumber]);

  return <div className="relative h-full w-full bg-white">{loading ? <div className="absolute inset-0 z-10 grid place-items-center bg-white"><LoaderCircle className="h-7 w-7 animate-spin text-[#0F6CBD]" /></div> : null}{error ? <div role="alert" className="absolute inset-0 z-10 grid place-items-center bg-white px-6 text-center text-sm font-semibold text-[#B42318]">{error}</div> : null}<canvas ref={canvasRef} className="h-full w-full object-contain" /></div>;
}
