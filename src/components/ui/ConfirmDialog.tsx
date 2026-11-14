import { useId, useRef } from 'react';
import { AlertTriangle, ArchiveRestore, X } from 'lucide-react';
import { Button } from './Button';
import { useDialogFocus } from './useDialogFocus';

export interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** 되돌릴 수 없는 삭제·파기는 danger, 그 밖의 확인은 primary. */
  tone?: 'danger' | 'primary';
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * 교사용·공개 화면의 공통 확인 창. window.confirm 대신 이것을 쓴다.
 * 처음 포커스는 취소에 두어 Enter 한 번으로 삭제되지 않게 하고, Esc와 바깥 포커스 이동을 막는다.
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel = '취소',
  tone = 'danger',
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useDialogFocus(dialogRef, onCancel, cancelButtonRef);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0F172A]/45 p-4 sm:p-5">
      <div ref={dialogRef} tabIndex={-1} className="w-full max-w-sm rounded-lg border border-[#DCE3EA] bg-white p-5 shadow-2xl" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>
        <div className="flex items-start justify-between gap-4">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone === 'danger' ? 'bg-[#FEF2F2] text-[#B42318]' : 'bg-[#EFF6FC] text-[#0F6CBD]'}`}>
            {tone === 'danger' ? <AlertTriangle className="h-5 w-5" aria-hidden="true" /> : <ArchiveRestore className="h-5 w-5" aria-hidden="true" />}
          </span>
          <button type="button" onClick={onCancel} className="flex h-11 w-11 items-center justify-center rounded-lg text-[#526174] hover:bg-[#F6F8FB]" aria-label="확인 창 닫기">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <h2 id={titleId} className="mt-4 text-lg font-extrabold text-[#0F172A]">{title}</h2>
        <p id={descriptionId} className="mt-2 break-keep text-sm leading-6 text-[#526174]">{description}</p>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <Button ref={cancelButtonRef} variant="secondary" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
