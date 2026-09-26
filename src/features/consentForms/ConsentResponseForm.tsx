import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { consentQuestions, consentQuestionError, consentResponseError, setConsentChoice } from '../../../supabase/functions/_shared/consentQuestions';
import { SignatureCanvas } from '../registry/SignatureCanvas';
import { ConsentPdfPage, type ConsentPdfState } from './ConsentPdfPage';
import { ConsentResponseField } from './ConsentResponseField';
import { pageAspectRatio } from './consentFieldLayout';
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
  const [reviewing, setReviewing] = useState(false);
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 639px)').matches);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [error, setError] = useState('');
  const [pdfState, setPdfState] = useState<{ file: File; pages: Record<number, ConsentPdfState> }>();
  const onPdfStateChange = useCallback((source: File, pageNumber: number, state: ConsentPdfState) => {
    setPdfState(previous => ({ file: source, pages: { ...(previous?.file === source ? previous.pages : {}), [pageNumber]: state } }));
  }, []);
  const pdfPages = pdfState?.file === file ? pdfState.pages : {};
  const pdfReady = document.pageCount > 0 && Array.from({ length: document.pageCount }, (_, index) => pdfPages[index + 1] === 'ready').every(Boolean);
  const pdfFailed = Object.values(pdfPages).includes('error');
  const [signatureField, setSignatureField] = useState<ConsentFieldDraft | null>(null);
  const [signatureDraft, setSignatureDraft] = useState<string | null>(null);
  const review = useRef<HTMLElement>(null);
  const signatureReturn = useRef<HTMLElement | null>(null);
  const current = questions[step];
  const required = questions.filter(question => question.required);
  const complete = required.filter(question => !consentQuestionError(question, values)).length;

  useEffect(() => {
    const query = window.matchMedia('(max-width: 639px)');
    const update = () => { setMobile(query.matches); setDrawerOpen(false); };
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  const updateValue = (field: ConsentFieldDraft, value: string) => {
    if (!pdfReady) return;
    setError('');
    setValues(previous => field.kind === 'checkbox'
      ? setConsentChoice(document.fields, previous, field.id, value === 'true')
      : { ...previous, [field.id]: value });
  };
  const fieldQuestion = (field: ConsentFieldDraft) => questions.findIndex(question => question.fields.some(item => item.id === field.id));
  const focusOriginal = (field: ConsentFieldDraft) => requestAnimationFrame(() => {
    globalThis.document.getElementById(`consent-response-${field.id}`)?.focus({ preventScroll: true });
  });
  const move = (index: number, fieldId?: string, keepError = false) => {
    if (!pdfReady) return;
    if (!questions[index]) return;
    if (!keepError) setError('');
    setStep(index);
    setReviewing(false);
    setDrawerOpen(mobile);
    const field = questions[index].fields.find(item => item.id === fieldId) ?? questions[index].fields[0];
    requestAnimationFrame(() => {
      const element = globalThis.document.getElementById(`consent-original-${field.id}`);
      if (element) {
        // 입력칸 위의 설명과 아래의 모바일 입력창을 함께 볼 수 있는 위치로 이동한다.
        const top = element.getBoundingClientRect().top + window.scrollY - Math.min(window.innerHeight * .35, 280);
        window.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
      }
      const target = mobile ? 'consent-mobile-title' : `consent-response-${field.id}`;
      globalThis.document.getElementById(target)?.focus({ preventScroll: true });
    });
  };
  const openSignature = (field: ConsentFieldDraft) => {
    if (!pdfReady) return;
    signatureReturn.current = globalThis.document.activeElement as HTMLElement | null;
    setSignatureDraft(null);
    setSignatureField(field);
  };
  const closeSignature = () => {
    setSignatureField(null);
    requestAnimationFrame(() => signatureReturn.current?.focus({ preventScroll: true }));
  };
  const checkAndReview = () => {
    if (!pdfReady) return;
    const invalid = questions.findIndex(question => consentQuestionError(question, values));
    if (invalid >= 0) {
      setError(consentQuestionError(questions[invalid], values) ?? '입력 내용을 확인해 주세요.');
      move(invalid, undefined, true);
      return;
    }
    setError('');
    setDrawerOpen(false);
    setReviewing(true);
    requestAnimationFrame(() => { review.current?.scrollIntoView({ block: 'start' }); review.current?.focus({ preventScroll: true }); });
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting || !pdfReady) return;
    if (!reviewing || consentResponseError(document.fields, values)) { checkAndReview(); return; }
    await onSubmit();
  };

  return <main className={`min-h-screen bg-[#E6E9ED] text-[#0F172A] ${mobile && drawerOpen ? 'pb-[380px]' : 'pb-28'}`}>
    <header className="sticky top-0 z-40 border-b border-[#DCE3EA] bg-white/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-[940px] items-center justify-between gap-4"><div className="min-w-0"><p className="text-[11px] font-bold text-[#526174]">{document.recipientName ? `${document.recipientName} 학생 보호자용` : '가정통신문 응답'}</p><h1 className="truncate text-sm font-extrabold sm:text-base">{document.title}</h1></div><p className="shrink-0 text-xs" aria-live="polite">필수 질문 <strong>{complete}/{required.length}</strong></p></div>
    </header>
    <form inert={Boolean(signatureField) || submitting} onSubmit={event => void submit(event)}>
      <div className="mx-auto max-w-[834px] px-4 pt-4 text-sm text-[#526174]">
        {document.description ? <p className="mb-2">{document.description}</p> : null}
        <p>문서를 읽고 회색 입력칸을 눌러 작성해 주세요. 어느 칸이든 다시 수정할 수 있습니다.</p>
      </div>
      {pdfReady && reviewing ? <section ref={review} tabIndex={-1} aria-label="제출 전 확인" className="mx-auto mt-4 max-w-[794px] scroll-mt-24 border border-[#C8D0DA] bg-white p-4 outline-none">
        <h2 className="text-base font-bold">제출 전 확인</h2><p className="mt-1 text-sm text-[#526174]">아래 원본에 작성된 내용을 확인한 후 제출해 주세요.</p>
        <ul className="mt-2 divide-y divide-[#DCE3EA]">{questions.map((question, index) => <li key={question.id} className="flex items-center justify-between gap-3 py-2"><div className="min-w-0 text-sm"><span className="font-bold">{question.label}: </span><span className="break-words">{question.choice ? question.fields.filter(field => values[field.id] === 'true').map(field => field.label).join(', ') || '선택 안 함' : question.fields[0].kind === 'signature' ? values[question.fields[0].id] ? '서명 완료' : '서명 안 함' : question.fields[0].kind === 'checkbox' ? values[question.fields[0].id] === 'true' ? '체크함' : '체크 안 함' : values[question.fields[0].id] || '입력 안 함'}</span></div><button type="button" onClick={() => move(index)} className={`${control} shrink-0`} aria-label={`${question.label} 수정`}>수정</button></li>)}</ul>
      </section> : null}
      <div className="mx-auto max-w-[834px] space-y-5 px-2 py-4 sm:px-5 sm:py-6">
        {Array.from({ length: document.pageCount }, (_, pageIndex) => {
          const pageSize = document.pageSizes[pageIndex];
          return <section key={pageIndex} aria-label={`${pageIndex + 1}쪽`} style={{ aspectRatio: pageAspectRatio(pageSize?.width, pageSize?.height) }} className="relative mx-auto w-full max-w-[794px] overflow-hidden bg-white shadow-sm">
            <ConsentPdfPage file={file} pageNumber={pageIndex + 1} onStateChange={onPdfStateChange} />
            {pdfReady ? document.fields.filter(field => field.pageIndex === pageIndex).map(field => {
              const index = fieldQuestion(field);
              return <ConsentResponseField key={field.id} field={field} value={values[field.id] ?? ''} question={questions[index]} mobile={mobile} active={!reviewing && index === step} onActivate={() => { setStep(index); setReviewing(false); }} onOpen={() => move(index, field.id)} onChange={value => updateValue(field, value)} onSign={() => openSignature(field)} />;
            }) : null}
          </section>;
        })}
      </div>
      <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-[#C8D0DA] bg-white px-3 py-2 shadow-sm">
        {!pdfReady ? <p role="status" className="mx-auto max-w-[794px] py-2 text-sm text-[#526174]">{pdfFailed ? '원본을 확인할 수 없어 입력과 제출이 중단되었습니다. 표시되지 않은 페이지에서 다시 시도해 주세요.' : '원본 문서를 표시하고 있습니다. 모든 페이지가 열리면 작성할 수 있습니다.'}</p> : null}
        {pdfReady && mobile && drawerOpen && current && !reviewing ? <section aria-labelledby="consent-mobile-title" className="mx-auto max-h-[38dvh] max-w-[794px] overflow-y-auto border-b border-[#DCE3EA] pb-3" onKeyDown={event => { if (event.key === 'Escape') { setDrawerOpen(false); focusOriginal(current.fields[0]); } }}>
          <div className="flex items-center justify-between gap-2"><h2 id="consent-mobile-title" tabIndex={-1} className="text-sm font-bold outline-none">{current.label} · {current.required ? '필수' : '선택'}</h2><button type="button" aria-label="입력창 닫고 원본 보기" onClick={() => { setDrawerOpen(false); focusOriginal(current.fields[0]); }} className="flex h-11 w-11 shrink-0 items-center justify-center"><X size={20} /></button></div>
          <fieldset><legend className="sr-only">{current.label}</legend><div className="flex flex-wrap gap-2">{current.fields.map(field => {
            const value = values[field.id] ?? '';
            if (field.kind === 'checkbox') return <label key={field.id} className={`${control} flex flex-1 cursor-pointer items-center gap-2 py-2`}><input type={current.choice?.mode === 'single' ? 'radio' : 'checkbox'} name={`mobile-${current.id}`} checked={value === 'true'} onChange={event => updateValue(field, event.target.checked ? 'true' : '')} className="h-5 w-5 shrink-0 accent-[#0F6CBD]" /><span>{field.label}</span></label>;
            if (field.kind === 'signature') return <button key={field.id} type="button" onClick={() => openSignature(field)} className={`${control} w-full`}>{value ? '서명 수정' : `${field.label} 작성`}</button>;
            return <input key={field.id} aria-label={`${field.label}${field.required ? ' 필수' : ''}`} type={field.kind === 'date' ? 'date' : 'text'} value={value} maxLength={5000} onChange={event => updateValue(field, event.target.value)} className={`${control} w-full min-w-0 text-base`} />;
          })}</div></fieldset>
        </section> : null}
        {error || serverError ? <p role="alert" className="mx-auto max-w-[794px] py-2 text-sm font-semibold text-[#B42318]">{error || serverError}</p> : null}
        <div className="mx-auto max-w-[794px]">
          {pdfReady && !reviewing ? <p className="truncate pb-1 pt-2 text-xs text-[#526174]" aria-live="polite">{current ? `${step + 1}/${questions.length} · ${current.label}${current.choice ? current.choice.mode === 'single' ? ' · 하나만 선택' : ` · ${current.required ? `${current.choice.minSelections}개 이상 선택` : '복수 선택 가능'}` : ''}` : '회색 칸을 누르거나 입력 시작을 선택하세요.'}</p> : null}
          <div className="flex items-center justify-between gap-2">
            <button type="button" disabled={!pdfReady || (step <= 0 && !reviewing)} onClick={() => move(reviewing ? Math.max(0, step) : step - 1)} className={control}>{reviewing ? '계속 수정' : '이전'}</button>
            <div className="flex gap-2">{!reviewing && step < questions.length - 1 ? <button type="button" disabled={!pdfReady} onClick={() => move(step + 1)} className={control}>{step < 0 ? '입력 시작' : '다음'}</button> : null}<button type="submit" disabled={submitting || !pdfReady} className="min-h-[48px] rounded-lg bg-[#0F6CBD] px-4 text-sm font-bold text-white disabled:opacity-50">{submitting ? '제출 중' : reviewing ? '작성 완료' : '응답 확인'}</button></div>
          </div>
        </div>
      </footer>
    </form>
    {pdfReady && signatureField ? <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0F172A]/55 p-2 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="signature-title" onKeyDown={event => {
      if (event.key === 'Escape') { event.stopPropagation(); closeSignature(); }
      if (event.key === 'Tab') {
        const controls = event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && globalThis.document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && globalThis.document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }}><section className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-lg bg-white p-5"><div className="flex items-center justify-between"><h2 id="signature-title" className="text-lg font-bold">{signatureField.label}</h2><button type="button" autoFocus onClick={closeSignature} className="flex h-11 w-11 items-center justify-center" aria-label="서명 창 닫기"><X /></button></div><p id="signature-canvas-help" className="mb-3 text-sm text-[#526174]">서명을 그린 뒤 적용해 주세요. 닫으면 기존 서명은 유지됩니다.</p><SignatureCanvas onChange={setSignatureDraft} /><button type="button" disabled={!signatureDraft} onClick={() => { updateValue(signatureField, signatureDraft ?? ''); closeSignature(); }} className={`${control} mt-4 w-full`}>서명 적용</button></section></div> : null}
  </main>;
}
