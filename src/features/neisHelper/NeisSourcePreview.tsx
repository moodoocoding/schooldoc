import { useEffect, useRef, useState } from 'react';
import { loadPdfJs } from '../../utils/pdfjs';

export function NeisSourcePreview({
  file,
  page = 1,
  allowPageSelection = false,
}: {
  file: File | null;
  page?: number;
  allowPageSelection?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [url, setUrl] = useState('');
  const [selectedPage, setSelectedPage] = useState(page);
  const [pageCount, setPageCount] = useState(1);
  const activePage = allowPageSelection ? selectedPage : page;
  useEffect(() => {
    if (!file) return;
    const value = URL.createObjectURL(file);
    setUrl(value);
    return () => URL.revokeObjectURL(value);
  }, [file]);
  useEffect(() => {
    if (!file || !/\.pdf$/i.test(file.name)) return;
    let alive = true;
    let dispose: (() => void) | undefined;
    setLoading(true);
    setError('');
    void (async () => {
      try {
        const pdfjs = await loadPdfJs();
        if (!alive) return;
        const data = await file.arrayBuffer();
        if (!alive) return;
        const task = pdfjs.getDocument({ data });
        dispose = () => {
          void task.destroy();
        };
        const doc = await task.promise;
        if (!alive) return;
        setPageCount(doc.numPages);
        if (activePage < 1 || activePage > doc.numPages) throw new Error('page');
        const original = await doc.getPage(activePage);
        if (!alive || !canvas.current) return;
        const viewport = original.getViewport({ scale: 1.2 });
        const target = canvas.current;
        target.width = viewport.width;
        target.height = viewport.height;
        await original.render({ canvas: target, viewport }).promise;
        if (alive) setLoading(false);
      } catch {
        if (alive) {
          setError('원본 미리보기를 열지 못했습니다. 다시 시도하거나 원본 파일을 열어 확인해 주세요.');
          setLoading(false);
        }
      }
    })();
    return () => {
      alive = false;
      dispose?.();
    };
  }, [file, activePage, retry]);
  if (!file) return null;
  return (
    <aside className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-4" aria-label="원본 자료">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-slate-800">원본 {activePage}쪽</h2>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="min-h-[44px] content-center text-sm font-semibold text-blue-700 underline"
          >
            원본 파일 열기
          </a>
        )}
      </div>
      <p className="mb-3 break-all text-xs text-slate-600">{file.name}</p>
      {allowPageSelection && (
        <label className="mb-3 block text-sm text-slate-700">
          원본 쪽
          <select
            aria-label="원본 쪽"
            className="ml-3 min-h-[44px] rounded-lg border border-slate-300 bg-white px-3"
            value={selectedPage}
            onChange={(e) => setSelectedPage(Number(e.target.value))}
          >
            {Array.from({ length: pageCount }, (_, i) => (
              <option key={i} value={i + 1}>
                {i + 1}쪽
              </option>
            ))}
          </select>
        </label>
      )}
      {loading && (
        <p role="status" className="py-4 text-sm text-slate-600">
          원본을 불러오는 중입니다.
        </p>
      )}
      {error && (
        <div role="alert" className="space-y-2 text-sm text-red-700">
          <p>{error}</p>
          <button type="button" className="min-h-[44px] underline" onClick={() => setRetry((v) => v + 1)}>
            미리보기 다시 시도
          </button>
        </div>
      )}
      <canvas
        ref={canvas}
        className={`h-auto max-h-[640px] w-full object-contain ${loading || error ? 'hidden' : ''}`}
        role="img"
        aria-label={`${file.name} ${activePage}쪽 원본. 자세한 내용은 원본 파일 열기에서 확인할 수 있습니다.`}
      />
    </aside>
  );
}
