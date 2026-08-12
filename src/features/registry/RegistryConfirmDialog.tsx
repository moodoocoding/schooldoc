import { useRef } from 'react';
import { AlertTriangle, ArchiveRestore, X } from 'lucide-react';
import { useDialogFocus } from './useDialogFocus';

interface RegistryConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  onCancel: () => void;
  onConfirm: () => void;
}

export function RegistryConfirmDialog({
  title,
  description,
  confirmLabel,
  tone = 'danger',
  onCancel,
  onConfirm,
}: RegistryConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  useDialogFocus(dialogRef, onCancel, cancelButtonRef);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0F172A]/45 p-4 sm:p-5">
      <div ref={dialogRef} tabIndex={-1} className="w-full max-w-sm rounded-lg border border-[#DCE3EA] bg-white p-5 shadow-2xl" role="alertdialog" aria-modal="true" aria-labelledby="registry-confirm-title" aria-describedby="registry-confirm-description">
        <div className="flex items-start justify-between gap-4">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone === 'danger' ? 'bg-[#FEF2F2] text-[#B42318]' : 'bg-[#EFF6FC] text-[#0F6CBD]'}`}>
            {tone === 'danger' ? <AlertTriangle className="h-5 w-5" /> : <ArchiveRestore className="h-5 w-5" />}
          </span>
          <button type="button" onClick={onCancel} className="flex h-10 w-10 items-center justify-center rounded-lg text-[#526174] hover:bg-[#F6F8FB]" aria-label="확인 창 닫기">
            <X className="h-5 w-5" />
          </button>
        </div>
        <h2 id="registry-confirm-title" className="mt-4 text-lg font-extrabold text-[#0F172A]">{title}</h2>
        <p id="registry-confirm-description" className="mt-2 text-sm leading-6 text-[#526174]">{description}</p>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button ref={cancelButtonRef} type="button" onClick={onCancel} className="min-h-[44px] rounded-lg border border-[#DCE3EA] text-sm font-bold text-[#334155] hover:bg-[#F6F8FB]">취소</button>
          <button type="button" onClick={onConfirm} className={`min-h-[44px] rounded-lg text-sm font-bold text-white ${tone === 'danger' ? 'bg-[#B42318] hover:bg-[#8F1C14]' : 'bg-[#0F6CBD] hover:bg-[#0B5B9F]'}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
