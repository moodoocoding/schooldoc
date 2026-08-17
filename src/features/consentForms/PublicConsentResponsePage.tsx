import { AlertCircle, Check, CheckCircle2, LoaderCircle, LockKeyhole, PenLine, Send, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { SignatureCanvas } from '../registry/SignatureCanvas';
import { ConsentPdfPage } from './ConsentPdfPage';
import { DocumentPreparingError, retryLoad } from './consentDocumentReady';
import { fieldStyle, pageAspectRatio } from './consentFieldLayout';
import { isConsentFormsDemoMode } from './consentFormsConfig';
import { addConsentLocalResponse, getConsentLocalDraftByToken, hashConsentPassword } from './consentFormsLocalStore';
import { getConsentPublicDocument, getConsentPublicMetadata, submitConsentPublicResponse } from './consentFormsPublicApi';
import type { ConsentFieldDraft, ConsentPublicDocument, ConsentPublicMetadata } from './types';

const asFile = async (url: string, title: string) => {
  const response = await fetch(url);
  // 서명 URL은 발급됐지만 객체가 아직 없으면 스토리지가 400/404로 답한다.
  if (response.status === 400 || response.status === 404) throw new DocumentPreparingError();
  if (!response.ok) throw new Error('원본 PDF를 불러오지 못했습니다.');
  return new File([await response.blob()], `${title}.pdf`, { type: 'application/pdf' });
};

const completed = (field: ConsentFieldDraft, value: string | undefined) => (
  field.kind === 'checkbox' ? value === 'true' : Boolean(value)
);

function CenterMessage({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#F3F5F7] p-5"><div className="w-full max-w-md border-y border-[#DCE3EA] bg-white px-6 py-12 text-center">{icon}<h1 className="mt-4 text-xl font-extrabold">{title}</h1><p className="mt-2 text-sm leading-6 text-[#526174]">{description}</p></div></main>;
}

export function PublicConsentResponsePage() {
  const { token = '' } = useParams();
  const [searchParams] = useSearchParams();
  const recipientToken = searchParams.get('r') ?? '';
  const localDraft = useMemo(() => isConsentFormsDemoMode ? getConsentLocalDraftByToken(token) : null, [token]);
  const [metadata, setMetadata] = useState<ConsentPublicMetadata | null>(localDraft ? {
    title: localDraft.title, description: localDraft.description, passwordRequired: localDraft.passwordEnabled,
    status: localDraft.status, deadline: localDraft.deadline,
  } : null);
  const [document, setDocument] = useState<ConsentPublicDocument | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(!localDraft);
  const [password, setPassword] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [signatureField, setSignatureField] = useState<ConsentFieldDraft | null>(null);
  const [preparing, setPreparing] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        if (localDraft) {
          if (localDraft.passwordEnabled) return;
          if (!localDraft.sourcePdfDataUrl) throw new Error('이 수합에는 원본 PDF가 저장되지 않았습니다. 새 수합을 만들어 주세요.');
          const nextDocument: ConsentPublicDocument = {
            title: localDraft.title, description: localDraft.description, passwordRequired: false,
            status: localDraft.status, deadline: localDraft.deadline, fields: localDraft.fields,
            sourceUrl: localDraft.sourcePdfDataUrl, allowResubmission: localDraft.allowResubmission,
            pageCount: localDraft.pageCount ?? 1,
            pageSizes: localDraft.pageSizes ?? Array.from({ length: localDraft.pageCount ?? 1 }, () => ({ width: 210, height: 297 })),
          };
          const file = await asFile(nextDocument.sourceUrl, nextDocument.title);
          if (active) { setDocument(nextDocument); setPdfFile(file); }
          return;
        }
        const nextMetadata = await retryLoad(() => getConsentPublicMetadata(token, recipientToken));
        if (!active) return;
        setMetadata(nextMetadata);
        if (!nextMetadata.passwordRequired) {
          const notePreparing = () => { if (active) setPreparing(true); };
          const nextDocument = await retryLoad(() => getConsentPublicDocument(token, '', recipientToken), { attempts: 15, onPreparing: notePreparing });
          const file = await retryLoad(() => asFile(nextDocument.sourceUrl, nextDocument.title), { attempts: 15, onPreparing: notePreparing });
          if (active) { setDocument(nextDocument); setPdfFile(file); setPreparing(false); }
        }
      } catch (loadError) {
        if (active) {
          setPreparing(false);
          setError(loadError instanceof Error ? loadError.message : '가정통신문을 불러오지 못했습니다.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [localDraft, recipientToken, token]);

  const requiredFields = useMemo(() => document?.fields.filter((field) => field.required) ?? [], [document]);
  const completedCount = requiredFields.filter((field) => completed(field, values[field.id])).length;

  const unlock = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (localDraft) {
        if (await hashConsentPassword(password) !== localDraft.passwordHash) throw new Error('비밀번호가 맞지 않습니다.');
        if (!localDraft.sourcePdfDataUrl) throw new Error('이 수합에는 원본 PDF가 저장되지 않았습니다. 새 수합을 만들어 주세요.');
        const nextDocument: ConsentPublicDocument = { title: localDraft.title, description: localDraft.description, passwordRequired: true, status: localDraft.status, deadline: localDraft.deadline, fields: localDraft.fields, sourceUrl: localDraft.sourcePdfDataUrl, allowResubmission: localDraft.allowResubmission, pageCount: localDraft.pageCount ?? 1, pageSizes: localDraft.pageSizes ?? Array.from({ length: localDraft.pageCount ?? 1 }, () => ({ width: 210, height: 297 })) };
        setDocument(nextDocument);
        setPdfFile(await asFile(nextDocument.sourceUrl, nextDocument.title));
      } else {
        const notePreparing = () => setPreparing(true);
        const nextDocument = await retryLoad(() => getConsentPublicDocument(token, password, recipientToken), { attempts: 15, onPreparing: notePreparing });
        setDocument(nextDocument);
        setPdfFile(await retryLoad(() => asFile(nextDocument.sourceUrl, nextDocument.title), { attempts: 15, onPreparing: notePreparing }));
        setPreparing(false);
      }
    } catch (unlockError) {
      setPreparing(false);
      setError(unlockError instanceof Error ? unlockError.message : '문서를 열지 못했습니다.');
    } finally { setLoading(false); }
  };

  const focusField = (field: ConsentFieldDraft) => {
    const element = globalThis.document.getElementById(`consent-response-${field.id}`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => element?.focus(), 400);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!document || submitting) return;
    const missing = document.fields.find((field) => field.required && !completed(field, values[field.id]));
    if (missing) {
      setError(`${missing.label} 항목을 입력해 주세요.`);
      focusField(missing);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      if (localDraft) addConsentLocalResponse(localDraft.id, values);
      else await submitConsentPublicResponse(token, password, values, recipientToken);
      setSubmitted(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '응답을 제출하지 못했습니다.');
    } finally { setSubmitting(false); }
  };

  if (preparing && !document) return <CenterMessage icon={<LoaderCircle className="mx-auto h-8 w-8 animate-spin text-[#0F6CBD]" />} title="가정통신문을 준비하고 있습니다" description="원본 문서를 올리는 중입니다. 준비되면 자동으로 열립니다." />;
  if (loading && !metadata) return <CenterMessage icon={<LoaderCircle className="mx-auto h-8 w-8 animate-spin text-[#0F6CBD]" />} title="가정통신문을 불러오는 중입니다" description="잠시만 기다려 주세요." />;
  if (!metadata) return <CenterMessage icon={<AlertCircle className="mx-auto h-8 w-8 text-[#B42318]" />} title="가정통신문을 찾을 수 없습니다" description={error || '담당자에게 올바른 링크를 다시 요청해 주세요.'} />;
  const deadlinePassed = Boolean(metadata.deadline && metadata.deadline < new Date().toISOString().slice(0, 10));
  if (metadata.status === 'closed' || deadlinePassed) return <CenterMessage icon={<LockKeyhole className="mx-auto h-8 w-8 text-[#64748B]" />} title="응답이 종료되었습니다" description="추가 제출이 필요하면 담당자에게 문의해 주세요." />;
  if (metadata.passwordRequired && !document) return <main className="grid min-h-screen place-items-center bg-[#F3F5F7] p-5"><form className="w-full max-w-md border-y border-[#DCE3EA] bg-white px-6 py-8" onSubmit={(event) => void unlock(event)}><LockKeyhole className="h-8 w-8 text-[#0F6CBD]" /><h1 className="mt-4 text-xl font-extrabold">문서 비밀번호 입력</h1><p className="mt-2 text-sm text-[#526174]">{metadata.title}</p><label className="mt-6 block text-sm font-bold">비밀번호<input type="password" autoFocus value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 min-h-[48px] w-full rounded-lg border border-[#C8D0DA] px-3 font-normal" /></label>{error ? <p role="alert" className="mt-3 text-sm font-semibold text-[#B42318]">{error}</p> : null}<button type="submit" disabled={loading} className="mt-5 min-h-[48px] w-full rounded-lg bg-[#0F6CBD] text-sm font-bold text-white disabled:bg-[#AAB7C4]">{loading ? '문서 여는 중' : '문서 확인하기'}</button></form></main>;
  if (submitted) return <CenterMessage icon={<CheckCircle2 className="mx-auto h-11 w-11 text-[#126B32]" />} title="응답을 제출했습니다" description="담당자에게 응답 완료 상태가 전달됩니다." />;
  // 안내 정보가 먼저 도착하고 원본은 뒤늦게 도착한다.
  // 이 사이를 오류로 단정하면 정상 대기 중에 오류 화면이 스친다.
  if (loading) return <CenterMessage icon={<LoaderCircle className="mx-auto h-8 w-8 animate-spin text-[#0F6CBD]" />} title="가정통신문을 불러오는 중입니다" description="원본 문서를 여는 중입니다. 잠시만 기다려 주세요." />;
  if (!document || !pdfFile) return <CenterMessage icon={<AlertCircle className="mx-auto h-8 w-8 text-[#B42318]" />} title="원본 PDF를 열지 못했습니다" description={error || '페이지를 새로고침하거나 담당자에게 문의해 주세요.'} />;

  return <main className="min-h-screen bg-[#E6E9ED] pb-28 text-[#0F172A]">
    <header className="sticky top-0 z-40 border-b border-[#DCE3EA] bg-white/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-[940px] items-center justify-between gap-4"><div className="min-w-0"><p className="text-[11px] font-bold text-[#526174]">{document.recipientName ? `${document.recipientName} 학생 보호자용` : '가정통신문 응답'}</p><h1 className="truncate text-sm font-extrabold sm:text-base">{document.title}</h1></div><div className="shrink-0 text-right"><span className="text-[11px] font-semibold text-[#64748B]">필수 항목</span><strong className="ml-2 text-sm tabular-nums text-[#0F6CBD]">{completedCount}/{requiredFields.length}</strong></div></div>
    </header>
    {document.description ? <section className="mx-auto max-w-[940px] border-b border-[#DCE3EA] bg-white px-4 py-3 text-xs leading-5 text-[#526174] sm:px-6">{document.description}</section> : null}
    <form onSubmit={(event) => void submit(event)}>
      <div className="mx-auto max-w-[940px] space-y-5 px-2 py-4 sm:px-5 sm:py-6">
        {Array.from({ length: document.pageCount }, (_, pageIndex) => {
          const pageFields = document.fields.filter((field) => field.pageIndex === pageIndex);
          const pageSize = document.pageSizes[pageIndex];
          return <section key={pageIndex} aria-label={`${pageIndex + 1}쪽`} style={{ aspectRatio: pageAspectRatio(pageSize?.width, pageSize?.height) }} className="relative mx-auto w-full max-w-[794px] overflow-hidden bg-white shadow-[0_5px_20px_rgba(15,23,42,0.18)]">
            <ConsentPdfPage file={pdfFile} pageNumber={pageIndex + 1} />
            {pageFields.map((field) => {
              const value = values[field.id] ?? '';
              const common = `absolute z-20 overflow-hidden border-2 bg-white/95 shadow-sm outline-none transition focus-within:ring-2 focus-within:ring-[#0F6CBD]/30 ${completed(field, value) ? 'border-[#16803C]' : 'border-[#0F6CBD]'}`;
              const style = fieldStyle(field);
              if (field.kind === 'checkbox') return <label key={field.id} style={style} className={`${common} flex cursor-pointer items-center gap-1 px-1 text-[9px] font-bold sm:gap-2 sm:px-2 sm:text-xs`}><input id={`consent-response-${field.id}`} type="checkbox" checked={value === 'true'} onChange={(event) => setValues((current) => ({ ...current, [field.id]: event.target.checked ? 'true' : '' }))} className="h-4 w-4 shrink-0 accent-[#0F6CBD]" /><span className="truncate">{field.label}{field.required ? ' *' : ''}</span></label>;
              if (field.kind === 'signature') return <button key={field.id} id={`consent-response-${field.id}`} type="button" style={style} onClick={() => setSignatureField(field)} className={`${common} flex items-center justify-center p-1 text-[9px] font-bold text-[#0F6CBD] sm:text-xs`}>{value ? <img src={value} alt={`${field.label} 서명`} className="h-full w-full object-contain" /> : <><PenLine className="mr-1 h-3 w-3" />{field.label}{field.required ? ' *' : ''}</>}</button>;
              return <label key={field.id} style={style} className={common}><span className="sr-only">{field.label}{field.required ? ' 필수' : ''}</span><input id={`consent-response-${field.id}`} type={field.kind === 'date' ? 'date' : 'text'} value={value} onChange={(event) => setValues((current) => ({ ...current, [field.id]: event.target.value }))} placeholder={`${field.label}${field.required ? ' *' : ''}`} className="h-full w-full bg-transparent px-1 text-[9px] font-semibold outline-none sm:px-2 sm:text-xs" /></label>;
            })}
            <span className="absolute bottom-2 right-3 z-10 rounded bg-white/80 px-2 py-1 text-[10px] font-semibold text-[#64748B]">{pageIndex + 1} / {document.pageCount}</span>
          </section>;
        })}
      </div>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#C8D0DA] bg-white/95 px-4 py-3 shadow-[0_-6px_22px_rgba(15,23,42,0.12)] backdrop-blur"><div className="mx-auto flex max-w-[940px] items-center gap-3">{error ? <button type="button" onClick={() => { const missing = document.fields.find((field) => field.required && !completed(field, values[field.id])); if (missing) focusField(missing); }} className="min-w-0 flex-1 text-left text-xs font-semibold text-[#B42318]"><span className="line-clamp-2">{error}</span></button> : <p className="min-w-0 flex-1 text-xs text-[#526174]">문서 위 파란 입력란을 모두 작성하세요.</p>}<button type="submit" disabled={submitting} className="inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-lg bg-[#0F6CBD] px-5 text-sm font-bold text-white disabled:bg-[#AAB7C4]"><Send className="h-4 w-4" />{submitting ? '제출 중' : '작성 완료'}</button></div></div>
    </form>
    {signatureField ? <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0F172A]/55 p-0 sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="signature-title"><section className="w-full max-w-xl rounded-t-lg bg-white p-5 shadow-2xl sm:rounded-lg"><div className="flex items-center justify-between"><div><p className="text-xs font-bold text-[#0F6CBD]">문서 서명</p><h2 id="signature-title" className="mt-1 text-lg font-extrabold">{signatureField.label}</h2></div><button type="button" onClick={() => setSignatureField(null)} className="flex h-10 w-10 items-center justify-center rounded-lg" aria-label="서명 창 닫기"><X className="h-5 w-5" /></button></div><div className="mt-4"><SignatureCanvas onChange={(dataUrl) => setValues((current) => ({ ...current, [signatureField.id]: dataUrl ?? '' }))} /></div><button type="button" disabled={!values[signatureField.id]} onClick={() => setSignatureField(null)} className="mt-4 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-[#0F6CBD] text-sm font-bold text-white disabled:bg-[#AAB7C4]"><Check className="h-4 w-4" />서명 적용</button></section></div> : null}
  </main>;
}
