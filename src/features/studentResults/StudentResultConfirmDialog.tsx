import { useEffect, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface StudentResultConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function StudentResultConfirmDialog({
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
}: StudentResultConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? []);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      returnFocus?.focus();
    };
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0F172A]/45 p-4">
      <div ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby="student-result-confirm-title" aria-describedby="student-result-confirm-description" className="w-full max-w-sm rounded-lg border border-[#DCE3EA] bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#FEF2F2] text-[#B42318]"><AlertTriangle className="h-5 w-5" /></span>
          <button type="button" onClick={onCancel} className="flex h-10 w-10 items-center justify-center rounded-lg text-[#526174] hover:bg-[#F6F8FB]" aria-label="확인 창 닫기"><X className="h-5 w-5" /></button>
        </div>
        <h2 id="student-result-confirm-title" className="mt-4 text-lg font-extrabold">{title}</h2>
        <p id="student-result-confirm-description" className="mt-2 text-sm leading-6 text-[#526174]">{description}</p>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button ref={cancelRef} type="button" onClick={onCancel} className="min-h-[44px] rounded-lg border border-[#DCE3EA] text-sm font-bold">취소</button>
          <button type="button" onClick={onConfirm} className="min-h-[44px] rounded-lg bg-[#B42318] text-sm font-bold text-white hover:bg-[#8F1C14]">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
