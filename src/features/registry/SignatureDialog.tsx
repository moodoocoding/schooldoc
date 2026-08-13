import { useRef, useState } from 'react';
import { Check, LoaderCircle, PenLine, X } from 'lucide-react';
import { SignatureCanvas } from './SignatureCanvas';
import type { Registry, RegistryParticipant, SignatureSource } from './types';
import { useDialogFocus } from './useDialogFocus';

interface SignatureDialogProps {
  registry: Registry;
  participant: RegistryParticipant;
  onClose: () => void;
  onSubmit: (dataUrl: string, source: SignatureSource, values: Record<string, string>) => void | Promise<void>;
}

const inputClass = 'min-h-[48px] w-full rounded-lg border border-[#DCE3EA] bg-white px-3.5 text-base text-[#0F172A] focus:border-[#0F6CBD] focus:outline-none focus:ring-2 focus:ring-[#0F6CBD]/15';

export function SignatureDialog({ registry, participant, onClose, onSubmit }: SignatureDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [drawDataUrl, setDrawDataUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [values, setValues] = useState<Record<string, string>>(participant.values);
  useDialogFocus(dialogRef, onClose, closeButtonRef);

  const handleSubmit = async () => {
    if (!drawDataUrl || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError('');
    try {
      await onSubmit(drawDataUrl, 'draw', values);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : '서명을 제출하지 못했습니다.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0F172A]/50 sm:items-center sm:p-5">
      <div ref={dialogRef} tabIndex={-1} className="max-h-[100dvh] w-full overflow-y-auto bg-white shadow-2xl sm:max-h-[92dvh] sm:max-w-2xl sm:rounded-lg" role="dialog" aria-modal="true" aria-labelledby="signature-dialog-title" aria-describedby="signature-dialog-description">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#DCE3EA] bg-white px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-bold text-[#0F6CBD]">서명자 확인</p>
            <h2 id="signature-dialog-title" className="mt-1 text-xl font-extrabold text-[#0F172A]">{participant.name}님 서명</h2>
            <p id="signature-dialog-description" className="sr-only">참석 정보를 확인하고 서명 입력 영역에 직접 서명합니다.</p>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[#526174] hover:bg-[#F6F8FB]" aria-label="서명 창 닫기">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
          {registry.columns.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {registry.columns.map((column) => (
                <label key={column.id} className="grid gap-2 text-sm font-bold text-[#334155]">
                  {column.label}
                  <input
                    className={inputClass}
                    value={values[column.id] ?? ''}
                    onChange={(event) => setValues((current) => ({ ...current, [column.id]: event.target.value }))}
                    placeholder={column.label}
                  />
                </label>
              ))}
            </div>
          ) : null}

          <section aria-labelledby="direct-signature-title" className="rounded-lg border border-[#DCE3EA] bg-[#F8FAFC] p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#E8F2FA] text-[#0F6CBD]" aria-hidden="true">
                <PenLine className="h-5 w-5" />
              </span>
              <div>
                <h3 id="direct-signature-title" className="text-sm font-extrabold text-[#0F172A]">직접 서명</h3>
                <p id="signature-canvas-help" className="mt-0.5 text-xs leading-5 text-[#526174]">아래 칸에 손가락이나 마우스로 서명해 주세요.</p>
              </div>
            </div>
            <div className="mt-4">
              <SignatureCanvas onChange={setDrawDataUrl} />
            </div>
          </section>
        </div>

        <div className="sticky bottom-0 border-t border-[#DCE3EA] bg-white p-4 sm:px-6">
          {submitError ? <p role="alert" className="mb-3 text-sm font-semibold text-[#B42318]">{submitError}</p> : null}
          <button
            type="button"
            disabled={!drawDataUrl || isSubmitting}
            onClick={() => void handleSubmit()}
            className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-lg bg-[#0F6CBD] px-5 text-base font-bold text-white hover:bg-[#0B5B9F] disabled:cursor-not-allowed disabled:bg-[#AAB7C4]"
          >
            {isSubmitting ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />} {isSubmitting ? '제출 중' : '서명 제출'}
          </button>
        </div>
      </div>
    </div>
  );
}
