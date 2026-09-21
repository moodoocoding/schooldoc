import { useMemo, useRef, useState } from 'react';
import { Check, PenLine, X } from 'lucide-react';
import { consentQuestions, consentQuestionError, consentResponseError, setConsentChoice } from '../../../supabase/functions/_shared/consentQuestions';
import { SignatureCanvas } from '../registry/SignatureCanvas';
import { ConsentPdfPage } from './ConsentPdfPage';
import { fieldStyle, pageAspectRatio } from './consentFieldLayout';
import type { ConsentFieldDraft, ConsentPublicDocument } from './types';

const control = 'min-h-[48px] rounded-lg border border-[#C8D0DA] bg-white px-4 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0F6CBD]';

export function ConsentResponseForm({ document, file, values, setValues, submitting, serverError, onSubmit }: {
  document: ConsentPublicDocument;
  file: File;
  values: Record<string, string>;
  setValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  submitting: boolean;
  serverError: string;
  onSubmit: () => Promise<void>;
}) {
  const questions = useMemo(() => consentQuestions(document.fields), [document.fields]);
  const [step, setStep] = useState(-1);
  const [error, setError] = useState('');
  const [signatureField, setSignatureField] = useState<ConsentFieldDraft | null>(null);
  const [signatureDraft, setSignatureDraft] = useState<string | null>(null);
  const panel = useRef<HTMLElement>(null);
  const current = questions[step];
  const reviewing = step === questions.length;
  const activeIds = new Set(current?.fields.map(field => field.id) ?? []);
  const required = questions.filter(question => question.required);
  const complete = required.filter(question => !consentQuestionError(question, values)).length;
  const move = (index: number) => {
    setError('');
    setStep(index);
    panel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    panel.current?.focus({ preventScroll: true });
  };
  const advance = () => {
    if (current) {
      const issue = consentQuestionError(current, values);
      if (issue) { setError(issue); return; }
    }
    move(Math.min(step + 1, questions.length));
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    if (!reviewing) { advance(); return; }
    const issue = consentResponseError(document.fields, values);
    if (issue) { setError(issue); return; }
    await onSubmit();
  };
  const focusInput = (field: ConsentFieldDraft) => requestAnimationFrame(() => globalThis.document.getElementById(`consent-response-${field.id}`)?.focus());
  return <main className="min-h-screen bg-[#E6E9ED] pb-28 text-[#0F172A]">
    <header className="sticky top-0 z-40 border-b border-[#DCE3EA] bg-white/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-[940px] items-center justify-between gap-4"><div className="min-w-0"><p className="text-[11px] font-bold text-[#526174]">{document.recipientName ? `${document.recipientName} 학생 보호자용` : '가정통신문 응답'}</p><h1 className="truncate text-sm font-extrabold sm:text-base">{document.title}</h1></div><p className="shrink-0 text-xs">필수 질문 <strong>{complete}/{required.length}</strong></p></div>
    </header>
    {document.description ? <p className="mx-auto max-w-[940px] bg-white px-4 py-3 text-sm">{document.description}</p> : null}
    <form inert={Boolean(signatureField)} onSubmit={event => void submit(event)}>
      <section ref={panel} tabIndex={-1} aria-label="단계별 응답" className="mx-auto max-w-[940px] scroll-mt-24 border-b border-[#C8D0DA] bg-white p-5 outline-none">
        {step < 0 ? <><h2 className="text-lg font-bold">가정통신문을 읽어 주세요</h2><p className="mt-2 text-sm text-[#526174]">아래 원본을 확인한 뒤 {questions.length}개 질문에 차례로 답합니다.</p></> : reviewing ? <>
          <h2 className="text-lg font-bold">제출 전 확인</h2>
          <ul className="mt-3 divide-y divide-[#DCE3EA]">{questions.map((question, index) => <li key={question.id} className="flex items-center justify-between gap-4 py-3"><div className="min-w-0"><p className="break-words text-sm font-bold">{question.label}</p><p className="mt-1 break-words text-sm text-[#526174]">{question.choice ? question.fields.filter(field => values[field.id] === 'true').map(field => field.label).join(', ') || '선택 안 함' : question.fields[0].kind === 'signature' ? values[question.fields[0].id] ? '서명 완료' : '서명 안 함' : question.fields[0].kind === 'checkbox' ? values[question.fields[0].id] === 'true' ? '체크함' : '체크 안 함' : values[question.fields[0].id] || '입력 안 함'}</p></div><button type="button" disabled={submitting} onClick={() => move(index)} className={`${control} shrink-0`} aria-label={`${question.label} 수정`}>수정</button></li>)}</ul>
        </> : current ? <>
          <p className="text-xs font-semibold text-[#526174]" aria-live="polite">질문 {step + 1} / {questions.length} · {current.required ? '필수' : '선택'}</p>
          <fieldset className="mt-2"><legend className="mb-3 text-lg font-bold">{current.label}</legend>
            {current.choice ? <p className="mb-3 text-sm text-[#526174]">{current.choice.mode === 'single' ? '하나만 선택해 주세요.' : current.required ? `${current.choice.minSelections}개 이상 선택해 주세요.` : '해당하는 항목을 선택해 주세요.'}</p> : null}
            <div className="flex flex-col gap-2">{current.fields.map(field => {
              const value = values[field.id] ?? '';
              if (field.kind === 'checkbox') return <label key={field.id} style={{ backgroundColor: value === 'true' ? '#EFF6FF' : '#FFFFFF', borderColor: value === 'true' ? '#0F6CBD' : '#C8D0DA' }} className={`${control} flex cursor-pointer items-center gap-3 py-3 ${value === 'true' ? 'border-[#0F6CBD] bg-[#EFF6FF]' : ''}`}><input id={`consent-response-${field.id}`} type={current.choice?.mode === 'single' ? 'radio' : 'checkbox'} name={current.choice ? current.id : field.id} checked={value === 'true'} onChange={event => { setError(''); setValues(previous => setConsentChoice(document.fields, previous, field.id, event.target.checked)); }} className="h-5 w-5 shrink-0 accent-[#0F6CBD]" /><span className="break-words">{field.label}</span></label>;
              if (field.kind === 'signature') return <button key={field.id} id={`consent-response-${field.id}`} type="button" onClick={() => { setSignatureDraft(null); setSignatureField(field); }} className={`${control} flex items-center justify-center gap-2 py-3`}>{value ? <img src={value} alt={`${field.label} 서명`} className="max-h-20 max-w-full" /> : <PenLine className="h-5 w-5" />}{value ? '서명 수정' : `${field.label} 작성`}</button>;
              return <label key={field.id} className="text-sm font-semibold"><span className="sr-only">{field.label}{field.required ? ' 필수' : ''}</span><input id={`consent-response-${field.id}`} type={field.kind === 'date' ? 'date' : 'text'} value={value} maxLength={5000} onChange={event => { setError(''); setValues(previous => ({ ...previous, [field.id]: event.target.value })); }} className={`${control} w-full min-w-0 text-base`} /></label>;
            })}</div>
            {!current.required ? <button type="button" onClick={() => { setValues(previous => { const next = { ...previous }; current.fields.forEach(field => { next[field.id] = ''; }); return next; }); move(step + 1); }} className="mt-2 min-h-[44px] text-sm text-[#526174]">선택 없이 건너뛰기</button> : null}
          </fieldset>
          <button type="button" onClick={() => globalThis.document.getElementById(`consent-original-${current.fields[0].id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })} className="mt-2 min-h-[44px] text-sm font-semibold text-[#0F6CBD]">원본 위치 보기</button>
        </> : null}
        {error || serverError ? <p role="alert" className="mt-3 text-sm font-semibold text-[#B42318]">{error || serverError}</p> : null}
      </section>
      <div className="mx-auto max-w-[940px] space-y-5 px-2 py-4 sm:px-5 sm:py-6">
        {Array.from({ length: document.pageCount }, (_, pageIndex) => {
          const pageSize = document.pageSizes[pageIndex];
          return <section key={pageIndex} aria-label={`${pageIndex + 1}쪽`} style={{ aspectRatio: pageAspectRatio(pageSize?.width, pageSize?.height) }} className="relative mx-auto w-full max-w-[794px] overflow-hidden bg-white shadow-sm">
            <ConsentPdfPage file={file} pageNumber={pageIndex + 1} />
            {document.fields.filter(field => field.pageIndex === pageIndex).map(field => {
              const active = activeIds.has(field.id);
              const value = values[field.id] ?? '';
              return <button key={field.id} id={`consent-original-${field.id}`} type="button" disabled={!active} tabIndex={-1} onClick={() => focusInput(field)} aria-label={`${field.label} 원본 위치`} data-testid="consent-original-field" data-kind={field.kind} style={{ ...fieldStyle(field), containerType: 'size' }} className={`absolute z-20 flex min-h-0 min-w-0 items-center justify-center overflow-hidden bg-transparent p-0 ${active ? 'border border-[#0F6CBD] outline outline-2 outline-[#0F6CBD]/30' : 'border border-dashed border-[#64748B]/40'}`}>
                {field.kind === 'checkbox' ? value === 'true' ? <Check className="h-full w-full text-[#0F172A]" strokeWidth={3} /> : null : field.kind === 'signature' ? value ? <img src={value} alt="" className="h-full w-full object-contain" /> : null : <span style={{ fontSize: 'min(12px, 75cqh)', lineHeight: 1 }} className="block w-full truncate px-1 text-left font-semibold">{value}</span>}
              </button>;
            })}
          </section>;
        })}
      </div>
      <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-[#C8D0DA] bg-white px-4 py-3"><div className="mx-auto flex max-w-[940px] items-center justify-between gap-3">
        {step >= 0 ? <button type="button" disabled={submitting} onClick={() => move(step - 1)} className={control}>이전</button> : <span className="text-xs text-[#526174]">원본 확인 후 시작하세요.</span>}
        <button type="submit" disabled={submitting} className="min-h-[48px] rounded-lg bg-[#0F6CBD] px-5 text-sm font-bold text-white disabled:opacity-50">{submitting ? '제출 중' : step < 0 ? '입력 시작' : reviewing ? '작성 완료' : step === questions.length - 1 ? '응답 확인' : '다음'}</button>
      </div></footer>
    </form>
    {signatureField ? <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0F172A]/55 p-2 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="signature-title" onKeyDown={event => {
      if (event.key === 'Escape') { setSignatureField(null); focusInput(signatureField); }
      if (event.key === 'Tab') {
        const controls = event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && globalThis.document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && globalThis.document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }}><section className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-lg bg-white p-5"><div className="flex items-center justify-between"><h2 id="signature-title" className="text-lg font-bold">{signatureField.label}</h2><button type="button" autoFocus onClick={() => { setSignatureField(null); focusInput(signatureField); }} className="flex h-11 w-11 items-center justify-center" aria-label="서명 창 닫기"><X /></button></div><p id="signature-canvas-help" className="mb-3 text-sm text-[#526174]">서명을 그린 뒤 적용해 주세요. 닫으면 기존 서명은 유지됩니다.</p><SignatureCanvas onChange={setSignatureDraft} /><button type="button" disabled={!signatureDraft} onClick={() => { setError(''); setValues(previous => ({ ...previous, [signatureField.id]: signatureDraft ?? '' })); setSignatureField(null); focusInput(signatureField); }} className={`${control} mt-4 w-full`}>서명 적용</button></section></div> : null}
  </main>;
}
