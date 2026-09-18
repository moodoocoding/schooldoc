import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { ReceiptOriginal } from './ReceiptOriginal';
import type { ReceiptFile } from './types';

const control = 'inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border border-[#C8D0DA] bg-white px-3 text-sm font-semibold disabled:opacity-40';

export function ReceiptViewer({ ownerId, bookId, files, initialFileId, initialPage, onClose }: {
  ownerId: string;
  bookId: string;
  files: ReceiptFile[];
  initialFileId: string;
  initialPage?: number | null;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [fileId, setFileId] = useState(initialFileId);
  const index = Math.max(0, files.findIndex(file => file.id === fileId));
  const file = files[index];

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    element.showModal();
    closeButton.current?.focus({ preventScroll: true });
    document.body.style.overflow = 'hidden';
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  return <dialog ref={dialog} aria-labelledby="receipt-viewer-heading" onCancel={event => { event.preventDefault(); onClose(); }}
    className="m-auto max-h-[90dvh] w-[calc(100%_-_1rem)] max-w-4xl overflow-y-auto overflow-x-hidden rounded-2xl border border-[#DCE3EA] bg-white p-0 text-[#172B4D] shadow-xl backdrop:bg-black/50">
    <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-[#DCE3EA] bg-white px-4 py-3">
      <h2 id="receipt-viewer-heading" className="text-lg font-bold">영수증 보기</h2>
      <button ref={closeButton} type="button" className={control} onClick={onClose}><X className="h-4 w-4" aria-hidden="true" />닫기</button>
      <nav aria-label="영수증 넘겨 보기" className="flex w-full items-center justify-between gap-2">
        <button type="button" className={control} disabled={index === 0} onClick={() => setFileId(files[index - 1].id)}><ChevronLeft className="h-4 w-4" aria-hidden="true" />이전 영수증</button>
        <span role="status" className="text-sm tabular-nums text-[#526174]">{index + 1} / {files.length}</span>
        <button type="button" className={control} disabled={index >= files.length - 1} onClick={() => setFileId(files[index + 1].id)}>다음 영수증<ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
      </nav>
    </header>
    <div className="p-3 sm:p-5">
      {file ? <ReceiptOriginal key={file.id} ownerId={ownerId} bookId={bookId} file={file} page={file.id === initialFileId ? initialPage : 1} fitToViewport /> : <p>영수증이 없습니다.</p>}
    </div>
  </dialog>;
}
