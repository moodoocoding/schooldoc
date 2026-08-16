import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, Check, FileText, LoaderCircle, RotateCcw, Upload } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { analyzeConsentDocument, consentDocumentAccept } from './consentDocumentImport';
import { ConsentFieldEditor } from './ConsentFieldEditor';
import { ConsentRecipientsStep } from './ConsentRecipientsStep';
import { ConsentShareStep } from './ConsentShareStep';
import { addConsentLocalDraft, getConsentLocalDraft, hashConsentPassword, updateConsentLocalDraft } from './consentFormsLocalStore';
import { createRemoteConsentForm, getRemoteConsentForm, getRemoteConsentSourceFile, updateRemoteConsentForm } from './consentFormsRepository';
import { isConsentFormsDemoMode } from './consentFormsConfig';
import type { ConsentDocumentAnalysis, ConsentFieldDraft, ConsentLocalDraft, ConsentRecipientDraft, ConsentRecipientMode, ConsentShareSettings } from './types';

const formatBytes = (bytes: number) => bytes < 1024 * 1024
  ? `${Math.max(1, Math.round(bytes / 1024))}KB`
  : `${(bytes / 1024 / 1024).toFixed(1)}MB`;

const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result ?? ''));
  reader.onerror = () => reject(new Error('원본 PDF를 준비하지 못했습니다.'));
  reader.readAsDataURL(file);
});

export function ConsentFormsCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit') ?? '';
  const localEditDraft = editId && isConsentFormsDemoMode ? getConsentLocalDraft(editId) : null;
  const [remoteEditDraft, setRemoteEditDraft] = useState<ConsentLocalDraft | null>(null);
  const editDraft = localEditDraft ?? remoteEditDraft;
  const inputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(editDraft?.title ?? '');
  const [description, setDescription] = useState(editDraft?.description ?? '');
  const [analysis, setAnalysis] = useState<ConsentDocumentAnalysis | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [objectUrl, setObjectUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<'document' | 'fields' | 'recipients' | 'sharing'>('document');
  const [fields, setFields] = useState<ConsentFieldDraft[]>(editDraft?.fields ?? []);
  const [recipientMode, setRecipientMode] = useState<ConsentRecipientMode>(editDraft?.recipientMode ?? 'named');
  const [recipients, setRecipients] = useState<ConsentRecipientDraft[]>([]);
  const [shareSettings, setShareSettings] = useState<ConsentShareSettings>({ deadline: editDraft?.deadline ?? '', passwordEnabled: editDraft?.passwordEnabled ?? false, password: '', allowResubmission: editDraft?.allowResubmission ?? false });

  useEffect(() => () => { if (objectUrl) URL.revokeObjectURL(objectUrl); }, [objectUrl]);

  const selectFile = async (file?: File) => {
    if (!file || analyzing) return;
    setAnalyzing(true);
    setError('');
    try {
      const nextAnalysis = await analyzeConsentDocument(file);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setObjectUrl(URL.createObjectURL(file));
      setAnalysis(nextAnalysis);
      setSourceFile(file);
      setStep('document');
      setFields(editDraft?.fields ?? []);
      setRecipients([]);
      setFileName(file.name);
      if (!title.trim()) setTitle(nextAnalysis.title);
    } catch (analysisError) {
      setAnalysis(null);
      setSourceFile(null);
      setFileName('');
      setError(analysisError instanceof Error ? analysisError.message : '문서를 분석하지 못했습니다.');
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    if (!editId || isConsentFormsDemoMode) return;
    let active = true;
    const load = async () => {
      setAnalyzing(true);
      setError('');
      try {
        const form = await getRemoteConsentForm(editId);
        if (!form) throw new Error('수정할 가정통신문을 찾을 수 없습니다.');
        const file = await getRemoteConsentSourceFile(form);
        const nextAnalysis = await analyzeConsentDocument(file);
        if (!active) return;
        setRemoteEditDraft(form);
        setTitle(form.title);
        setDescription(form.description);
        setFields(form.fields);
        setRecipientMode(form.recipientMode);
        setShareSettings({ deadline: form.deadline, passwordEnabled: form.passwordEnabled, password: '', allowResubmission: form.allowResubmission });
        setSourceFile(file);
        setFileName(file.name);
        setAnalysis(nextAnalysis);
        setObjectUrl(URL.createObjectURL(file));
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : '수합을 불러오지 못했습니다.');
      } finally { if (active) setAnalyzing(false); }
    };
    void load();
    return () => { active = false; };
  }, [editId]);

  const resetFile = () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    setObjectUrl('');
    setAnalysis(null);
    setSourceFile(null);
    setFileName('');
    setError('');
    setStep('document');
    setFields(editDraft?.fields ?? []);
    setRecipients([]);
    if (inputRef.current) inputRef.current.value = '';
  };

  if (step === 'fields' && analysis && sourceFile) return (
    <div className="mx-auto w-full max-w-[1500px] pb-12">
      <ConsentFieldEditor analysis={analysis} file={sourceFile} fields={fields} onFieldsChange={setFields} onBack={() => setStep('document')} onNext={() => setStep(editDraft ? 'sharing' : 'recipients')} />
    </div>
  );

  if (step === 'recipients') return <ConsentRecipientsStep mode={recipientMode} recipients={recipients} onModeChange={setRecipientMode} onRecipientsChange={setRecipients} onBack={() => setStep('fields')} onNext={() => setStep('sharing')} />;

  if (step === 'sharing' && analysis && sourceFile) return <ConsentShareStep title={title} fileName={analysis.fileName} fieldCount={fields.length} recipientMode={recipientMode} recipientCount={editDraft?.recipientCount ?? recipients.length} settings={shareSettings} hasExistingPassword={Boolean(editDraft?.passwordHash)} saving={saving} error={error} onSettingsChange={setShareSettings} onBack={() => setStep(editDraft ? 'fields' : 'recipients')} onCreate={async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      if (!isConsentFormsDemoMode) {
        if (editDraft) {
          await updateRemoteConsentForm(editDraft.id, { title: title.trim() || editDraft.title, description: description.trim(), fields, pageCount: analysis.pageCount, pageSizes: analysis.pageSizes, fileName: sourceFile.name, sourceFile, deadline: shareSettings.deadline, allowResubmission: shareSettings.allowResubmission, passwordEnabled: shareSettings.passwordEnabled, password: shareSettings.password });
          navigate(`/tools/consent-forms/${editDraft.id}`);
        } else {
          const created = await createRemoteConsentForm({ title, description, fields, pageSizes: analysis.pageSizes, recipientMode, recipientCount: recipients.length, settings: shareSettings, sourceFile });
          if (!created) throw new Error('생성한 가정통신문을 확인하지 못했습니다.');
          navigate(`/tools/consent-forms/${created.id}`);
        }
        return;
      }
      const passwordHash = shareSettings.passwordEnabled ? shareSettings.password.trim() ? await hashConsentPassword(shareSettings.password.trim()) : editDraft?.passwordHash ?? '' : '';
      if (editDraft) {
        updateConsentLocalDraft(editDraft.id, { title, fileName: analysis.fileName, fieldCount: fields.length, description, fields, pageCount: analysis.pageCount, pageSizes: analysis.pageSizes, deadline: shareSettings.deadline, passwordEnabled: shareSettings.passwordEnabled, passwordHash: passwordHash || editDraft.passwordHash, allowResubmission: shareSettings.allowResubmission, sourcePdfDataUrl: await fileToDataUrl(sourceFile) });
        navigate(`/tools/consent-forms/${editDraft.id}`);
      } else {
        addConsentLocalDraft({ id: crypto.randomUUID(), title, fileName: analysis.fileName, fieldCount: fields.length, recipientMode, recipientCount: recipientMode === 'named' ? recipients.length : 0, createdAt: new Date().toISOString(), description, fields, publicToken: crypto.randomUUID(), deadline: shareSettings.deadline, passwordEnabled: shareSettings.passwordEnabled, passwordHash, allowResubmission: shareSettings.allowResubmission, responseCount: 0, status: 'open', pageCount: analysis.pageCount, pageSizes: analysis.pageSizes, sourcePdfDataUrl: await fileToDataUrl(sourceFile) });
        navigate('/tools/consent-forms');
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '가정통신문 수합을 만들지 못했습니다.');
    } finally {
      setSaving(false);
    }
  }} />;

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5 pb-12">
      <header className="flex items-center justify-between border-b border-[#DCE3EA] pb-4">
        <button type="button" onClick={() => navigate('/tools/consent-forms')} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[#334155] hover:bg-white hover:text-[#0F6CBD]"><ArrowLeft className="h-5 w-5" />목록으로</button>
        <span className="text-xs font-semibold text-[#526174]">1. 원본 문서</span>
      </header>

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="space-y-5">
          <section>
            <p className="text-xs font-bold text-[#0F6CBD]">{editDraft ? '가정통신문 수합 수정' : '새 가정통신문 수합'}</p>
            <h1 className="mt-1 text-2xl font-extrabold">{editDraft ? '원본 PDF 다시 확인' : '원본 문서 준비'}</h1>
            <p className="mt-2 text-sm leading-6 text-[#526174]">{editDraft ? '개인정보 보호를 위해 원본 PDF는 로컬에 보관하지 않습니다. 같은 PDF를 다시 올리면 기존 필드 위치를 불러옵니다.' : '한글 문서는 PDF로 저장한 뒤 올리고, 문서가 올바르게 분석됐는지 확인합니다.'}</p>
          </section>

          <section className="border-y border-[#DCE3EA] bg-white px-4 py-5 sm:px-5">
            <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold text-[#0F6CBD]">먼저 할 일</p><h2 className="mt-1 text-sm font-bold">원본 PDF 올리기</h2><p className="mt-1 text-xs text-[#64748B]">PDF · 최대 30MB</p></div>{analysis ? <button type="button" onClick={resetFile} className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[#526174] hover:bg-[#F6F8FB]" aria-label="원본 파일 다시 선택" title="다시 선택"><RotateCcw className="h-4 w-4" /></button> : null}</div>
            <input ref={inputRef} type="file" accept={consentDocumentAccept} className="sr-only" onChange={(event) => void selectFile(event.target.files?.[0])} aria-label="가정통신문 PDF 파일" />
            {!analysis ? (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => { event.preventDefault(); setDragging(false); void selectFile(event.dataTransfer.files[0]); }}
                className={`mt-4 flex min-h-44 w-full flex-col items-center justify-center border border-dashed px-5 text-center ${dragging ? 'border-[#0F6CBD] bg-[#EFF6FC]' : 'border-[#AAB7C4] bg-[#F9FAFB] hover:border-[#0F6CBD]'}`}
              >
                {analyzing ? <LoaderCircle className="h-7 w-7 animate-spin text-[#0F6CBD]" /> : <Upload className="h-7 w-7 text-[#0F6CBD]" />}
                <strong className="mt-3 text-sm">{analyzing ? '문서를 분석하고 있습니다' : '파일 선택'}</strong>
                <span className="mt-1 text-xs text-[#64748B]">또는 이곳에 파일을 놓으세요</span>
              </button>
            ) : (
              <div className="mt-4 border border-[#B9D9F2] bg-[#F5FAFE] p-4">
                <div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white text-[#0F6CBD]"><FileText className="h-5 w-5" /></span><div className="min-w-0"><strong className="block truncate text-sm">{fileName}</strong><p className="mt-1 text-xs text-[#526174]">PDF · {formatBytes(analysis.fileSize)} · {analysis.pageCountLabel}</p></div></div>
                <div className="mt-4 flex items-center gap-2 text-xs font-bold text-[#126B32]"><Check className="h-4 w-4" />문서 분석 완료</div>
              </div>
            )}
            {error ? <p role="alert" className="mt-3 flex items-start gap-2 text-sm font-semibold text-[#B42318]"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p> : null}
          </section>

          {analysis ? <section className="border-y border-[#DCE3EA] bg-white px-4 py-5 sm:px-5">
            <h2 className="text-sm font-bold">안내 정보</h2>
            <p className="mt-1 text-xs text-[#64748B]">문서 분석 결과를 바탕으로 제목을 채웠습니다.</p>
            <div className="mt-4 space-y-4">
              <label className="block text-xs font-bold text-[#334155]">제목<input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2 min-h-[44px] w-full rounded-lg border border-[#C8D0DA] px-3 text-sm font-normal" placeholder="예: 현장체험학습 참가 동의서" /></label>
              <label className="block text-xs font-bold text-[#334155]">보호자 안내<textarea value={description} onChange={(event) => setDescription(event.target.value)} className="mt-2 min-h-24 w-full rounded-lg border border-[#C8D0DA] p-3 text-sm font-normal" placeholder="응답 기한이나 작성 안내를 입력하세요." /></label>
            </div>
          </section> : null}

          {analysis?.warnings.map((warning) => <p key={warning} className="border-y border-[#F5D08A] bg-[#FFF9ED] px-4 py-3 text-xs leading-5 text-[#76520E]">{warning}</p>)}

          <div className="flex justify-end gap-3"><button type="button" onClick={() => navigate('/tools/consent-forms')} className="min-h-[44px] rounded-lg border border-[#C8D0DA] px-4 text-sm font-bold">취소</button><button type="button" disabled={!analysis || !title.trim()} onClick={() => setStep('fields')} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#0F6CBD] px-5 text-sm font-bold text-white disabled:bg-[#AAB7C4]"><Check className="h-4 w-4" />확인 후 필드 배치</button></div>
        </div>

        <section className="min-w-0 border-y border-[#DCE3EA] bg-white">
          <div className="flex items-center justify-between border-b border-[#DCE3EA] px-5 py-4"><div><h2 className="text-sm font-bold">문서 미리보기</h2><p className="mt-1 text-xs text-[#64748B]">원본 내용과 방향을 확인하세요.</p></div>{analysis ? <span className="rounded-md bg-[#EFF6FC] px-2.5 py-1 text-xs font-bold text-[#0F6CBD]">{analysis.pageCountLabel}</span> : null}</div>
          <div className="min-h-[720px] bg-[#E9EDF2] p-4 sm:p-7">
            {!analysis ? <div className="grid min-h-[660px] place-items-center text-center"><div><FileText className="mx-auto h-10 w-10 text-[#94A3B8]" /><p className="mt-4 text-sm font-semibold text-[#526174]">원본 PDF를 올리면 여기에 표시됩니다.</p></div></div> : (
              <iframe src={`${objectUrl}#toolbar=0&navpanes=0&view=FitH`} title={`${analysis.title} PDF 미리보기`} className="mx-auto h-[760px] w-full max-w-[920px] border-0 bg-white shadow-[0_8px_28px_rgba(15,23,42,0.15)]" />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
