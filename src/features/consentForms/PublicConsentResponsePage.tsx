import { AlertCircle, CheckCircle2, LoaderCircle, LockKeyhole } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ConsentResponseForm } from './ConsentResponseForm';
import { consentChoiceConfigError, consentResponseError } from '../../../supabase/functions/_shared/consentQuestions';
import { DocumentPreparingError, retryLoad } from './consentDocumentReady';
import { isConsentFormsDemoMode } from './consentFormsConfig';
import { addConsentLocalResponse, getConsentLocalDraftByToken, hashConsentPassword } from './consentFormsLocalStore';
import { getConsentPublicDocument, getConsentPublicMetadata, submitConsentPublicResponse } from './consentFormsPublicApi';
import type { ConsentPublicDocument, ConsentPublicMetadata } from './types';

const asFile = async (url: string, title: string) => {
  const response = await fetch(url);
  // 서명 URL은 발급됐지만 객체가 아직 없으면 스토리지가 400/404로 답한다.
  if (response.status === 400 || response.status === 404) throw new DocumentPreparingError();
  if (!response.ok) throw new Error('원본 PDF를 불러오지 못했습니다.');
  return new File([await response.blob()], `${title}.pdf`, { type: 'application/pdf' });
};

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

  const submit = async () => {
    if (!document || submitting) return;
    const issue = consentResponseError(document.fields, values);
    if (issue) { setError(issue); return; }
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

  const choiceError = consentChoiceConfigError(document.fields);
  if (choiceError) return <CenterMessage icon={<AlertCircle className="mx-auto h-8 w-8 text-[#B42318]" />} title="선택 질문 설정 확인이 필요합니다" description={`${choiceError} 담당 선생님께 문의해 주세요.`} />;
  return <ConsentResponseForm document={document} file={pdfFile} values={values} setValues={setValues} submitting={submitting} serverError={error} onSubmit={submit} />;
}
