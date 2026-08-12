import { useRef, useState } from 'react';
import { Camera, Check, ImagePlus, LoaderCircle, PenLine, X } from 'lucide-react';
import { SignatureCanvas } from './SignatureCanvas';
import { normalizeSignaturePhoto, type NormalizedSignaturePhoto } from './signatureImage';
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
  const drawTabRef = useRef<HTMLButtonElement>(null);
  const photoTabRef = useRef<HTMLButtonElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<SignatureSource>('draw');
  const [drawDataUrl, setDrawDataUrl] = useState<string | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoMeta, setPhotoMeta] = useState<NormalizedSignaturePhoto | null>(null);
  const [photoError, setPhotoError] = useState('');
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [values, setValues] = useState<Record<string, string>>(participant.values);
  const selectedDataUrl = source === 'draw' ? drawDataUrl : photoDataUrl;
  useDialogFocus(dialogRef, onClose, closeButtonRef);

  const handlePhoto = async (file: File) => {
    setIsProcessingPhoto(true);
    setPhotoError('');
    setPhotoDataUrl(null);
    setPhotoMeta(null);
    try {
      const normalized = await normalizeSignaturePhoto(file);
      setPhotoDataUrl(normalized.dataUrl);
      setPhotoMeta(normalized);
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : '사진을 처리하지 못했습니다.');
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const nextSource = event.key === 'ArrowLeft' || event.key === 'Home' ? 'draw' : 'photo';
    setSource(nextSource);
    window.requestAnimationFrame(() => {
      (nextSource === 'draw' ? drawTabRef.current : photoTabRef.current)?.focus();
    });
  };

  const handleSubmit = async () => {
    if (!selectedDataUrl || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError('');
    try {
      await onSubmit(selectedDataUrl, source, values);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : '서명을 제출하지 못했습니다.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0F172A]/50 sm:items-center sm:p-5">
      <div ref={dialogRef} tabIndex={-1} className="max-h-[100dvh] w-full overflow-y-auto bg-white shadow-2xl sm:max-h-[92dvh] sm:max-w-xl sm:rounded-lg" role="dialog" aria-modal="true" aria-labelledby="signature-dialog-title" aria-describedby="signature-dialog-description">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#DCE3EA] bg-white px-5 py-4">
          <div>
            <p className="text-xs font-bold text-[#0F6CBD]">서명자 확인</p>
            <h2 id="signature-dialog-title" className="mt-1 text-xl font-extrabold text-[#0F172A]">{participant.name}님 서명</h2>
            <p id="signature-dialog-description" className="sr-only">참석 정보를 확인하고 직접 그리거나 사진을 선택해 서명합니다.</p>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[#526174] hover:bg-[#F6F8FB]" aria-label="서명 창 닫기">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 px-5 py-6">
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

          <div>
            <p className="text-sm font-bold text-[#334155]">서명 방법</p>
            <div className="mt-3 grid grid-cols-2 rounded-lg border border-[#DCE3EA] bg-[#F6F8FB] p-1" role="tablist" aria-label="서명 방법">
              <button
                ref={drawTabRef}
                id="draw-signature-tab"
                type="button"
                onClick={() => setSource('draw')}
                onKeyDown={handleTabKeyDown}
                role="tab"
                aria-selected={source === 'draw'}
                aria-controls="draw-signature-panel"
                tabIndex={source === 'draw' ? 0 : -1}
                className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md text-sm font-bold ${source === 'draw' ? 'bg-white text-[#0F6CBD] shadow-sm' : 'text-[#526174]'}`}
              >
                <PenLine className="h-4 w-4" /> 직접 서명
              </button>
              <button
                ref={photoTabRef}
                id="photo-signature-tab"
                type="button"
                onClick={() => setSource('photo')}
                onKeyDown={handleTabKeyDown}
                role="tab"
                aria-selected={source === 'photo'}
                aria-controls="photo-signature-panel"
                tabIndex={source === 'photo' ? 0 : -1}
                className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md text-sm font-bold ${source === 'photo' ? 'bg-white text-[#0F6CBD] shadow-sm' : 'text-[#526174]'}`}
              >
                <Camera className="h-4 w-4" /> 사진 촬영
              </button>
            </div>
          </div>

          {source === 'draw' ? (
            <div id="draw-signature-panel" role="tabpanel" aria-labelledby="draw-signature-tab">
              <p id="signature-canvas-help" className="mb-2 text-xs leading-5 text-[#526174]">아래 칸에 손가락이나 마우스로 서명해 주세요. 키보드를 사용한다면 사진 선택을 이용할 수 있습니다.</p>
              <SignatureCanvas onChange={setDrawDataUrl} />
            </div>
          ) : (
            <div id="photo-signature-panel" role="tabpanel" aria-labelledby="photo-signature-tab" className="space-y-3">
              {isProcessingPhoto ? (
                <div className="flex h-52 flex-col items-center justify-center rounded-lg border border-[#DCE3EA] bg-[#F8FAFC] text-center" role="status">
                  <LoaderCircle className="h-8 w-8 animate-spin text-[#0F6CBD]" />
                  <p className="mt-3 text-sm font-bold text-[#334155]">사진에서 서명을 보정하고 있습니다</p>
                  <p className="mt-1 text-xs text-[#526174]">방향과 여백을 정리하고 용량을 줄입니다.</p>
                </div>
              ) : photoDataUrl ? (
                <div className="flex h-52 items-center justify-center overflow-hidden rounded-lg border border-[#DCE3EA] bg-[#F6F8FB] p-3">
                  <img src={photoDataUrl} alt="보정된 서명 사진" className="max-h-full max-w-full object-contain" />
                </div>
              ) : (
                <div className="flex h-52 flex-col items-center justify-center rounded-lg border border-dashed border-[#AAB7C4] bg-[#F8FAFC] text-center">
                  <ImagePlus className="h-8 w-8 text-[#526174]" />
                  <p className="mt-3 text-sm font-bold text-[#334155]">서명이 잘 보이게 촬영해 주세요</p>
                  <p className="mt-1 text-xs text-[#526174]">밝은 종이가 화면을 가득 채우면 더 정확합니다.</p>
                </div>
              )}
              {photoMeta ? (
                <p className="text-xs font-semibold text-[#126B32]" role="status">
                  사진 보정 완료 · {photoMeta.width}×{photoMeta.height}px · {Math.max(1, Math.round(photoMeta.bytes / 1024))}KB
                </p>
              ) : null}
              {photoError ? <p className="text-sm font-semibold leading-5 text-[#B42318]" role="alert">{photoError}</p> : null}
              <div className="grid grid-cols-2 gap-2">
                <button type="button" disabled={isProcessingPhoto} onClick={() => cameraInputRef.current?.click()} className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-[#334155] px-3 text-sm font-bold text-white hover:bg-[#0F172A] disabled:cursor-wait disabled:opacity-60">
                  <Camera className="h-4 w-4" /> 카메라
                </button>
                <button type="button" disabled={isProcessingPhoto} onClick={() => photoInputRef.current?.click()} className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg border border-[#DCE3EA] px-3 text-sm font-bold text-[#334155] hover:bg-[#F6F8FB] disabled:cursor-wait disabled:opacity-60">
                  <ImagePlus className="h-4 w-4" /> 사진 선택
                </button>
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" tabIndex={-1} aria-hidden="true" className="hidden" onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handlePhoto(file);
                  event.target.value = '';
                }} />
                <input ref={photoInputRef} type="file" accept="image/*" tabIndex={-1} aria-hidden="true" className="hidden" onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handlePhoto(file);
                  event.target.value = '';
                }} />
              </div>
              <p className="text-xs leading-5 text-[#526174]">원본 사진은 저장하지 않고 보정된 서명 이미지만 사용합니다.</p>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 border-t border-[#DCE3EA] bg-white p-4">
          {submitError ? <p role="alert" className="mb-3 text-sm font-semibold text-[#B42318]">{submitError}</p> : null}
          <button
            type="button"
            disabled={!selectedDataUrl || isProcessingPhoto || isSubmitting}
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
