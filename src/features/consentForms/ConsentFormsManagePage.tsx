import { ArrowLeft, Check, Copy, Download, ImageDown, ExternalLink, FilePenLine, Inbox, LoaderCircle, LockKeyhole, PauseCircle, PlayCircle, CopyPlus, QrCode, RefreshCw, Save, Settings2, Sheet, Trash2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { RegistryConfirmDialog } from '../registry/RegistryConfirmDialog';
import { deleteConsentLocalDraft, duplicateConsentLocalDraft, getConsentLocalDraft, hashConsentPassword, listConsentLocalResponses, listConsentLocalRecipients, listConsentLocalHistory, reissueConsentLocalToken, updateConsentLocalDraft } from './consentFormsLocalStore';
import { getConsentPublicOrigin, isConsentFormsDemoMode } from './consentFormsConfig';
import { getConsentManagementBundle, getRemoteConsentSourceFile, reissueConsentPublicToken, updateRemoteConsentForm } from './consentFormsRepository';
import { listConsentResponses, getConsentResponse, listConsentResponseHistory, listConsentResponseHeaders } from './consentResponsesApi';
import { consentQrFileName, consentResponseFileName, consentResponsesFileName, downloadBlob, formatConsentValue, renderConsentResponsePdf, renderConsentResponsesPdf, svgToPngBlob } from './consentResponseRender';
import { listConsentRecipients, listConsentRecipientsPage } from './consentRecipientsApi';
import { downloadConsentResponsesExcel } from './consentResponsesExcel';
import { filterRecipients, type ConsentRecipientFilter } from './consentRecipientSheet';
import { purgeConsentForms } from './consentPurgeApi';
import { duplicateConsentForm } from './consentDuplicateApi';
import { DUPLICATE_CLEARED_LABELS } from './consentDuplicate';
import { DEFAULT_RETENTION_MONTHS, retentionMonthsOf } from './consentPurgeSelection';
import type { ConsentLocalDraft, ConsentRecipientRecord, ConsentResponseRecord } from './types';

const submittedLabel = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
};

const sourceFileOf = async (draft: ConsentLocalDraft) => {
  if (!isConsentFormsDemoMode) return getRemoteConsentSourceFile(draft);
  if (!draft.sourcePdfDataUrl) throw new Error('이 수합에는 원본 PDF가 저장되지 않았습니다.');
  const response = await fetch(draft.sourcePdfDataUrl);
  return new File([await response.blob()], `${draft.title}.pdf`, { type: 'application/pdf' });
};

export function ConsentFormsManagePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<ConsentLocalDraft | null>(() => isConsentFormsDemoMode ? getConsentLocalDraft(id) : null);
  const [loading, setLoading] = useState(!isConsentFormsDemoMode);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState(false);
  const [responsesExpanded, setResponsesExpanded] = useState(true);
  const [recipientsExpanded, setRecipientsExpanded] = useState(true);
  const [title, setTitle] = useState(draft?.title ?? '');
  const [deadline, setDeadline] = useState(draft?.deadline ?? '');
  const [allowResubmission, setAllowResubmission] = useState(draft?.allowResubmission ?? false);
  const [passwordEnabled, setPasswordEnabled] = useState(draft?.passwordEnabled ?? false);
  const [newPassword, setNewPassword] = useState('');
  const [retentionMonths, setRetentionMonths] = useState(DEFAULT_RETENTION_MONTHS);
  const [copied, setCopied] = useState(false);
  const [responses, setResponses] = useState<ConsentResponseRecord[]>(() => isConsentFormsDemoMode ? listConsentLocalResponses(id) : []);
  const [responsesLoading, setResponsesLoading] = useState(!isConsentFormsDemoMode);
  const [responseError, setResponseError] = useState('');
  const [downloadingId, setDownloadingId] = useState('');
  const [bulkProgress, setBulkProgress] = useState('');
  const [recipients, setRecipients] = useState<ConsentRecipientRecord[]>([]);
  const [recipientsNotice, setRecipientsNotice] = useState('');
  const [copiedRecipient, setCopiedRecipient] = useState('');
  const [recipientQuery, setRecipientQuery] = useState('');
  const [recipientFilter, setRecipientFilter] = useState<ConsentRecipientFilter>('all');
  const [confirmingReissue, setConfirmingReissue] = useState(false);
  const [reissuing, setReissuing] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [qrError, setQrError] = useState('');
  const [savingQr, setSavingQr] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [settingsError,setSettingsError]=useState('');
  const [settingsNotice,setSettingsNotice]=useState('');
  const [changingStatus,setChangingStatus]=useState(false);
  const [pageLoading,setPageLoading]=useState(false);
  const [history,setHistory]=useState<ConsentResponseRecord[]>([]);
  const [historyRecipient,setHistoryRecipient]=useState('');
  const [historyCursor,setHistoryCursor]=useState<unknown>(null);
  const detailCache=useRef(new Map<string,{expires:number;response:ConsentResponseRecord}>());

  // 복제처럼 관리 화면에서 다른 수합으로 옮겨갈 수 있다.
  // 컴포넌트가 그대로 남으므로 id가 바뀌면 화면 상태를 다시 맞춰야 한다.
  useEffect(() => {
    setEditing(false);
    setResponsesExpanded(true);
    setRecipientsExpanded(true);
    setNewPassword('');
    setRecipients([]);
    setRecipientsNotice('');
    setResponseError('');setSettingsError('');setSettingsNotice('');setHistory([]);setHistoryRecipient('');detailCache.current.clear();
    if (isConsentFormsDemoMode) {
      const local = getConsentLocalDraft(id);
      setDraft(local);
      setTitle(local?.title ?? '');
      setDeadline(local?.deadline ?? '');
      setAllowResubmission(local?.allowResubmission ?? false);
      setPasswordEnabled(local?.passwordEnabled ?? false);
      if (local) setRetentionMonths(retentionMonthsOf(local));
      setResponses(listConsentLocalResponses(id));
      setRecipients(listConsentLocalRecipients(id));
      return;
    }
    setLoading(true);
    let active = true;
    getConsentManagementBundle(id).then(bundle=>{
      if(!active) return;
      const form=bundle.form;setDraft(form);setRecipients(bundle.recipients);setResponses(bundle.responses);
      setTitle(form.title);setDeadline(form.deadline);setAllowResubmission(form.allowResubmission);setPasswordEnabled(form.passwordEnabled);setRetentionMonths(retentionMonthsOf(form));
    }).catch(error=>{if(active) setLoadError(error instanceof Error?error.message:'수합을 불러오지 못했습니다.');})
      .finally(()=>{if(active){setLoading(false);setResponsesLoading(false);}});
    return () => { active = false; };
  }, [id]);

  if (loading) return <div className="py-20 text-center text-sm font-semibold text-[#526174]">수합을 불러오고 있습니다.</div>;
  if (!draft) return <div className="mx-auto max-w-xl py-20 text-center"><h1 className="text-xl font-extrabold">수합을 찾을 수 없습니다</h1>{loadError ? <p className="mt-3 text-sm font-semibold text-[#B42318]">{loadError}</p> : null}<button type="button" onClick={() => navigate('/tools/consent-forms')} className="mt-5 min-h-[44px] rounded-lg border border-[#C8D0DA] px-4 text-sm font-bold">목록으로</button></div>;
  const publicLink = `${getConsentPublicOrigin()}/s/consent/${draft.publicToken}`;

  const save = async () => {
    if (savingSettings) return;
    setSavingSettings(true);setSettingsError('');setSettingsNotice('');
    try {
    if (!isConsentFormsDemoMode) {
      const updated = await updateRemoteConsentForm(draft.id, { title: title.trim() || draft.title, deadline, allowResubmission, passwordEnabled, password: newPassword, retentionMonths });
      if (updated) setDraft(updated);
      setNewPassword('');
      setEditing(false);setSettingsNotice('설정을 저장했습니다.');
      return;
    }
    const passwordHash = passwordEnabled && newPassword.trim() ? await hashConsentPassword(newPassword.trim()) : passwordEnabled ? draft.passwordHash : '';
    const updated = updateConsentLocalDraft(draft.id, { title: title.trim() || draft.title, deadline, allowResubmission, passwordEnabled, passwordHash, retentionMonths });
    if (updated) setDraft(updated);
    setNewPassword('');
    setEditing(false);
    } catch(error){setSettingsError(error instanceof Error?error.message:'설정을 저장하지 못했습니다. 입력을 유지했습니다.');}
    finally {
      setSavingSettings(false);
    }
  };

  const toggleStatus=async()=>{
    if(changingStatus) return;setChangingStatus(true);setSettingsError('');setSettingsNotice('');
    try{
      const closing=draft.status==='open';
      const updated=isConsentFormsDemoMode?updateConsentLocalDraft(draft.id,{status:closing?'closed':'open',closedAt:closing?new Date().toISOString():undefined}):await updateRemoteConsentForm(draft.id,{status:closing?'closed':'open'});
      if(updated) setDraft(updated);setSettingsNotice(closing?'수합을 종료했습니다.':'수합을 재개했습니다.');
    }catch(error){setSettingsError(error instanceof Error?error.message:'상태를 변경하지 못했습니다. 다시 시도해 주세요.');}
    finally{setChangingStatus(false);}
  };
  const detailsOf=async(response:ConsentResponseRecord)=>{
    if(isConsentFormsDemoMode) return response;
    const cached=detailCache.current.get(response.id);if(cached && cached.expires>Date.now())return cached.response;
    const detail=await getConsentResponse(id,response.id);detailCache.current.set(response.id,{expires:Date.now()+9*60000,response:detail});return detail;
  };
  const showDetails=async(response:ConsentResponseRecord)=>{
    setDownloadingId(response.id);setResponseError('');
    try{const detail=await detailsOf(response);setResponses(rows=>rows.map(r=>r.id===detail.id?detail:r));setHistory(rows=>rows.map(r=>r.id===detail.id?detail:r));}
    catch(error){setResponseError(error instanceof Error?error.message:'응답을 불러오지 못했습니다.');}finally{setDownloadingId('');}
  };
  const loadMoreResponses=async()=>{
    if(pageLoading || !responses.length)return;setPageLoading(true);setResponseError('');
    try{const last=responses.at(-1)!;const page=await listConsentResponseHeaders(id,{at:last.submittedAt,id:last.id});setResponses(rows=>[...rows,...page.responses.filter(r=>!rows.some(old=>old.id===r.id))]);}
    catch(error){setResponseError(error instanceof Error?error.message:'응답을 불러오지 못했습니다.');}finally{setPageLoading(false);}
  };
  const loadMoreRecipients=async(all=false)=>{
    if(pageLoading)return;setPageLoading(true);setRecipientsNotice('');
    try{
      if(all){setRecipients(await listConsentRecipients(id));return;}
      const last=recipients.at(-1) as (ConsentRecipientRecord & {createdAt:string}) | undefined;
      const page=await listConsentRecipientsPage(id,last?{at:last.createdAt,id:last.id}:null);
      setRecipients(rows=>[...rows,...page.recipients.filter(r=>!rows.some(old=>old.id===r.id))]);
    }catch(error){setRecipientsNotice(error instanceof Error?error.message:'명단을 불러오지 못했습니다.');}finally{setPageLoading(false);}
  };
  const showHistory=async(recipientId:string,more=false)=>{
    setPageLoading(true);setResponseError('');
    try{
      if(isConsentFormsDemoMode){setHistory(listConsentLocalHistory(id,recipientId));setHistoryCursor(null);}
      else{const page=await listConsentResponseHistory(id,recipientId,more?historyCursor:null);setHistory(rows=>more?[...rows,...page.responses]:page.responses);setHistoryCursor(page.nextCursor);}
      setHistoryRecipient(recipientId);
    }catch(error){setResponseError(error instanceof Error?error.message:'이력을 불러오지 못했습니다.');}finally{setPageLoading(false);}
  };

  const downloadResponse = async (response: ConsentResponseRecord, index: number) => {
    setDownloadingId(response.id);
    setResponseError('');
    try {
      const file = await sourceFileOf(draft);
      const detail = await detailsOf(response);
      const blob = await renderConsentResponsePdf({ file, fields: draft.fields, response:detail });
      const named = recipientOf(detail);
      downloadBlob(blob, consentResponseFileName(named ? `${draft.title}_${named.name}` : draft.title, index + 1));
    } catch (error) {
      setResponseError(error instanceof Error ? error.message : '응답 PDF를 만들지 못했습니다.');
    } finally {
      setDownloadingId('');
    }
  };

  const downloadAllResponses = async () => {
    setBulkProgress(`0 / ${responses.length}`);
    setResponseError('');
    try {
      const file = await sourceFileOf(draft);
      const allResponses=isConsentFormsDemoMode?responses:await listConsentResponses(id);
      const blob = await renderConsentResponsesPdf({
        file,
        fields: draft.fields,
        responses:allResponses,
        onProgress: (done, total) => setBulkProgress(`${done} / ${total}`),
      });
      downloadBlob(blob, consentResponsesFileName(draft.title, allResponses.length));
    } catch (error) {
      setResponseError(error instanceof Error ? error.message : '응답 PDF를 만들지 못했습니다.');
    } finally {
      setBulkProgress('');
    }
  };

  const duplicateForm = async () => {
    if (duplicating) return;
    setDuplicating(true);
    setResponseError('');
    try {
      const copyId = isConsentFormsDemoMode
        ? duplicateConsentLocalDraft(draft.id)?.id
        : (await duplicateConsentForm(draft.id)).id;
      if (!copyId) throw new Error('복제한 수합을 확인하지 못했습니다.');
      navigate(`/tools/consent-forms/${copyId}`);
    } catch (error) {
      setResponseError(error instanceof Error ? error.message : '수합을 복제하지 못했습니다.');
    } finally {
      setDuplicating(false);
    }
  };

  const reissueLink = async () => {
    if (reissuing) return;
    setReissuing(true);
    setResponseError('');
    try {
      const publicToken = isConsentFormsDemoMode ? reissueConsentLocalToken(draft.id) : await reissueConsentPublicToken(draft.id);
      setDraft({ ...draft, publicToken });
      setConfirmingReissue(false);
    } catch (error) {
      setResponseError(error instanceof Error ? error.message : '응답 링크를 재발급하지 못했습니다.');
    } finally {
      setReissuing(false);
    }
  };

  const deleteForm = async () => {
    if (deleting) return;
    setDeleting(true);
    setResponseError('');
    try {
      if (isConsentFormsDemoMode) deleteConsentLocalDraft(draft.id);
      else {
        const result = await purgeConsentForms([draft.id],{[draft.id]:draft.responseCount});
        if (result.failed.length) throw new Error(result.failed[0].error);
      }
      navigate('/tools/consent-forms');
    } catch (error) {
      setResponseError(error instanceof Error ? error.message : '가정통신문을 삭제하지 못했습니다.');
      setConfirmingDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  const downloadQrImage = async () => {
    if (savingQr) return;
    setSavingQr(true);
    setQrError('');
    try {
      const svg = qrRef.current?.querySelector('svg');
      if (!svg) throw new Error('QR 코드를 찾지 못했습니다.');
      downloadBlob(await svgToPngBlob(svg, 1024), consentQrFileName(draft.title));
    } catch (error) {
      setQrError(error instanceof Error ? error.message : 'QR 이미지를 저장하지 못했습니다.');
    } finally {
      setSavingQr(false);
    }
  };

  const recipientOf = (response: ConsentResponseRecord) => recipients.find((entry) => entry.id===response.recipientId || entry.responseId === response.id) ?? (response.recipientName ? {name:response.recipientName} : null);
  const submittedCount = draft.currentResponseCount ?? recipients.filter((entry) => entry.submittedAt).length;
  const pendingCount = Math.max(0,draft.recipientCount-submittedCount);
  const visibleRecipients = filterRecipients(recipients, recipientFilter, recipientQuery);

  const exportExcel = async () => {
    if (exportingExcel) return;
    setExportingExcel(true);
    setResponseError('');
    try {
      await downloadConsentResponsesExcel(draft.title,draft.fields,isConsentFormsDemoMode?responses:await listConsentResponses(id),isConsentFormsDemoMode?recipients:await listConsentRecipients(id));
    } catch (error) {
      setResponseError(error instanceof Error ? error.message : '결과 표를 만들지 못했습니다.');
    } finally {
      setExportingExcel(false);
    }
  };

  const summarize = (response: ConsentResponseRecord) => draft.fields
    .map((field) => {
      const value = response.values[field.id] ?? '';
      if (!value) return '';
      if (field.kind === 'signature') return `${field.label}: 서명함`;
      if (field.kind === 'checkbox') return value === 'true' ? field.choice ? `${field.choice.label}: ${field.label}` : `${field.label}: 체크함` : '';
      return `${field.label}: ${formatConsentValue(field, value)}`;
    })
    .filter(Boolean)
    .join(' · ');

  return <div className="mx-auto w-full max-w-6xl space-y-4 consent-manage pb-10">
    <header className="flex items-center justify-between gap-3 border-b border-[#DCE3EA] pb-3"><button type="button" onClick={() => navigate('/tools/consent-forms')} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[#334155] hover:bg-white hover:text-[#0F6CBD]"><ArrowLeft className="h-5 w-5" />목록으로</button><span className={`rounded-md px-2.5 py-1 text-xs font-bold ${draft.status === 'open' ? 'bg-[#E6F4EA] text-[#126B32]' : 'bg-[#EEF1F4] text-[#526174]'}`}>{draft.status === 'open' ? '수합 중' : '종료'}</span></header>

    <section className="min-w-0 py-2">
      <p className="text-xs font-bold text-[#526174]">가정통신문 수합 관리</p>
      <h1 className="mt-1 max-w-4xl break-words text-xl font-extrabold leading-8 sm:text-2xl">{draft.title}</h1>
      <p className="mt-1.5 max-w-3xl truncate text-xs text-[#526174]" title={draft.fileName}>{draft.fileName}</p>
    </section>

    <nav aria-label="수합 관리 작업" className="flex flex-wrap items-center gap-2 border-y border-[#DCE3EA] bg-white px-3 py-2.5">
      <button type="button" disabled={draft.responseCount>0 || draft.publicationState==='purging'} title={draft.responseCount>0?'응답을 받은 원본은 수합을 복제해 수정해 주세요':undefined} onClick={() => navigate(`/tools/consent-forms/new?edit=${draft.id}`)} className="inline-flex min-h-[40px] items-center gap-2 rounded-lg px-3 text-xs font-bold text-[#334155] hover:bg-[#EFF6FC] hover:text-[#0F6CBD]"><FilePenLine className="h-4 w-4" />원본·필드 수정</button>
      <button type="button" disabled={duplicating} onClick={() => void duplicateForm()} className="inline-flex min-h-[40px] items-center gap-2 rounded-lg px-3 text-xs font-bold text-[#334155] hover:bg-[#EFF6FC] hover:text-[#0F6CBD] disabled:text-[#94A3B8]" title={`원본 PDF와 필드, 명단을 그대로 가져옵니다. ${DUPLICATE_CLEARED_LABELS.join('·')}은 비웁니다.`}>{duplicating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CopyPlus className="h-4 w-4" />}{duplicating ? '복제 중' : '이 수합 복제'}</button>
      <button type="button" onClick={() => setEditing((value) => !value)} className={`inline-flex min-h-[40px] items-center gap-2 rounded-lg px-3 text-xs font-bold ${editing ? 'bg-[#EFF6FC] text-[#0F6CBD]' : 'text-[#334155] hover:bg-[#EFF6FC] hover:text-[#0F6CBD]'}`}><Settings2 className="h-4 w-4" />설정 수정</button>
      <span className="hidden h-5 w-px bg-[#DCE3EA] sm:block" />
      <button type="button" disabled={changingStatus || draft.publicationState==='purging'} onClick={() => void toggleStatus()} className={`inline-flex min-h-[40px] items-center gap-2 rounded-lg px-3 text-xs font-bold ${draft.status === 'open' ? 'text-[#B42318] hover:bg-[#FEF2F2]' : 'text-[#126B32] hover:bg-[#E6F4EA]'}`}>{draft.status === 'open' ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}{draft.status === 'open' ? '수합 종료' : '수합 재개'}</button>
      <button type="button" disabled={draft.status!=='closed'} title={draft.status==='open'?'먼저 수합을 종료해 주세요':undefined} onClick={() => setConfirmingDelete(true)} className="inline-flex min-h-[40px] items-center gap-2 rounded-lg px-3 text-xs font-bold text-[#B42318] hover:bg-[#FEF2F2] sm:ml-auto"><Trash2 className="h-4 w-4" />수합 삭제</button>
    </nav>

    {settingsError ? <p role="alert" className="break-words bg-[#FEF2F2] p-3 text-sm text-[#B42318]">{settingsError}</p> : null}
    {settingsNotice ? <p role="status" className="bg-[#E6F4EA] p-3 text-sm text-[#126B32]">{settingsNotice}</p> : null}
    {draft.publicationState==='preparing' ? <p role="status" className="bg-[#FFF9ED] p-3 text-sm">준비 중인 수합입니다. 생성 화면에서 명단과 공유 설정 저장을 완료해야 공개 링크가 열립니다.</p> : null}
    {editing ? <section className="border-y border-[#DCE3EA] bg-white px-5 py-5"><h2 className="text-sm font-bold">수합 설정 수정</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-xs font-bold">제목<input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2 min-h-[44px] w-full rounded-lg border border-[#C8D0DA] px-3 text-sm font-normal" /></label><label className="text-xs font-bold">응답 기한<input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} className="mt-2 min-h-[44px] w-full rounded-lg border border-[#C8D0DA] px-3 text-sm font-normal" /></label><label className="text-xs font-bold">보관 기간<span className="ml-2 font-semibold text-[#64748B]">지나면 정리 목록에 모입니다. 자동으로 지워지지 않습니다.</span><div className="mt-2 flex items-center gap-2"><input type="number" min="1" max="120" value={retentionMonths} onChange={(event) => setRetentionMonths(Math.max(1, Math.min(120, Math.round(Number(event.target.value)) || DEFAULT_RETENTION_MONTHS)))} className="min-h-[44px] w-24 rounded-lg border border-[#C8D0DA] px-3 text-sm font-normal tabular-nums" /><span className="text-sm font-semibold text-[#526174]">개월</span></div></label></div><div className="mt-4 grid gap-2 sm:grid-cols-2"><label className="flex min-h-[44px] items-center gap-3 text-sm font-bold"><input type="checkbox" checked={allowResubmission} onChange={(event) => setAllowResubmission(event.target.checked)} className="h-4 w-4" />제출 후 수정 허용</label><label className="flex min-h-[44px] items-center gap-3 text-sm font-bold"><input type="checkbox" checked={passwordEnabled} onChange={(event) => setPasswordEnabled(event.target.checked)} className="h-4 w-4" />공개 링크 비밀번호 사용</label></div>{passwordEnabled ? <label className="mt-3 block max-w-sm text-xs font-bold">새 비밀번호<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder={draft.passwordHash ? '변경할 때만 입력' : '4자 이상 입력'} className="mt-2 min-h-[44px] w-full rounded-lg border border-[#C8D0DA] px-3 text-sm font-normal" /></label> : null}<div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setEditing(false)} className="min-h-[44px] rounded-lg px-4 text-sm font-bold">취소</button><button type="button" disabled={savingSettings || (passwordEnabled && !draft.passwordHash && newPassword.trim().length < 4)} onClick={() => void save()} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#0F6CBD] px-4 text-sm font-bold text-white disabled:bg-[#AAB7C4]">{savingSettings ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{savingSettings ? '저장 중' : '설정 저장'}</button></div></section> : null}

    <section aria-label="수합 요약" className="grid grid-cols-2 border-y border-[#DCE3EA] bg-white sm:grid-cols-4">
      <div className="border-b border-r border-[#EEF1F4] px-4 py-3 sm:border-b-0"><span className="text-[11px] font-semibold text-[#64748B]">응답</span><strong className="mt-0.5 block text-xl tabular-nums">{draft.currentResponseCount ?? draft.responseCount}건</strong><span className="text-xs text-[#526174]">전체 제출 이력 {draft.responseCount}건</span></div>
      <div className="border-b border-[#EEF1F4] px-4 py-3 sm:border-b-0 sm:border-r"><span className="text-[11px] font-semibold text-[#64748B]">응답 필드</span><strong className="mt-0.5 block text-xl tabular-nums">{draft.fieldCount}개</strong></div>
      <div className="border-r border-[#EEF1F4] px-4 py-3"><span className="text-[11px] font-semibold text-[#64748B]">대상</span><strong className="mt-1 block break-words text-sm">{draft.recipientMode === 'named' ? `명단 ${draft.recipientCount}명` : '공개 수합'}</strong></div>
      <div className="px-4 py-3"><span className="text-[11px] font-semibold text-[#64748B]">응답 기한</span><strong className="mt-1 block text-sm tabular-nums">{draft.deadline || '기한 없음'}</strong></div>
    </section>

    <section aria-label="공유와 배부" data-testid="consent-share-panel" className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <section className="min-w-0 border-y border-[#DCE3EA] bg-white px-4 py-4 sm:px-5"><h2 className="text-sm font-bold">응답 링크</h2><p className="mt-1 text-xs text-[#64748B]">링크를 복사해 전달하거나 QR을 배부하세요.</p><div className="mt-3 flex min-w-0 flex-wrap gap-2"><input aria-label="공용 응답 링크" readOnly value={publicLink} className="min-h-[44px] w-full min-w-0 basis-full rounded-lg border border-[#C8D0DA] bg-[#F6F8FB] px-3 text-xs" /><button type="button" onClick={async () => { await navigator.clipboard.writeText(publicLink); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }} className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-lg border border-[#C8D0DA] px-3 text-xs font-bold text-[#0F6CBD]" aria-label="응답 링크 복사" title="링크 복사">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}링크 복사</button><a href={publicLink} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-lg border border-[#C8D0DA] px-3 text-xs font-bold text-[#0F6CBD]" aria-label="응답 화면 열기" title="새 창에서 열기"><ExternalLink className="h-4 w-4" />응답 화면 열기</a><button type="button" onClick={() => setConfirmingReissue(true)} className="inline-flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-lg border border-[#C8D0DA] text-[#526174] hover:border-[#B42318] hover:text-[#B42318]" aria-label="응답 링크 재발급" title="링크 재발급"><RefreshCw className="h-4 w-4" /></button></div>{draft.recipientMode === 'named' && draft.recipientCount > 0 ? <div className="mt-4 border-t border-[#EEF1F4] pt-4"><p className="text-xs font-bold text-[#334155]">개인별 배부 · 제출 {submittedCount}명 / 미제출 {pendingCount}명</p><div className="mt-2 flex flex-wrap gap-2">        <button type="button" onClick={() => navigate(`/tools/consent-forms/${draft.id}/qr`)} className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-[#0F6CBD] px-3 text-xs font-bold text-[#0F6CBD] hover:bg-[#EFF6FC]"><QrCode className="h-4 w-4" />개인 QR 배부 자료</button>
        {pendingCount > 0 ? <button type="button" onClick={() => navigate(`/tools/consent-forms/${draft.id}/qr?target=pending`)} className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-[#E6A700] bg-[#FFF9ED] px-3 text-xs font-bold text-[#76520E] hover:bg-[#FEF3C7]"><QrCode className="h-4 w-4" />미제출자 {pendingCount}명 재배부</button> : null}</div></div>: null}{draft.passwordEnabled ? <p className="mt-3 flex items-center gap-2 text-xs text-[#526174]"><LockKeyhole className="h-4 w-4 text-[#0F6CBD]" />비밀번호로 보호된 링크입니다.</p> : null}{isConsentFormsDemoMode ? <p className="mt-4 text-xs text-[#526174]">데모 자료는 이 브라우저에만 저장됩니다.</p> : null}</section>
      <aside className="min-w-0 border-y border-[#DCE3EA] bg-white px-4 py-4 text-center"><div className="mb-3 flex items-center justify-center gap-2 text-xs font-bold"><QrCode className="h-4 w-4 text-[#0F6CBD]" />응답 QR 코드</div><div ref={qrRef} className="inline-block max-w-full border border-[#DCE3EA] bg-white p-2"><QRCodeSVG value={publicLink} size={176} level="M" includeMargin aria-label="가정통신문 응답 링크 QR 코드" /></div><p className="mx-auto mt-2 max-w-[210px] text-[11px] leading-4 text-[#64748B]">응답 링크만 포함합니다.</p><button type="button" disabled={savingQr} onClick={() => void downloadQrImage()} className="mx-auto mt-3 inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-[#0F6CBD] px-3 text-xs font-bold text-[#0F6CBD] hover:bg-[#EFF6FC] disabled:border-[#C8D0DA] disabled:text-[#94A3B8]">{savingQr ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ImageDown className="h-4 w-4" />}{savingQr ? '저장 중' : 'QR 이미지 저장'}</button>{qrError ? <p role="alert" className="mt-2 text-[11px] font-semibold text-[#B42318]">{qrError}</p> : null}</aside>
    </section>

    <section aria-label="받은 응답" className="border-y border-[#DCE3EA] bg-white px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-bold">받은 응답<span className="ml-2 text-xs font-semibold text-[#64748B]">{draft.currentResponseCount ?? responses.length}건</span></h2><p className="mt-1 text-xs text-[#64748B]">응답을 원본 가정통신문 위에 합성한 PDF로 내려받습니다.</p></div><div className="flex min-w-0 flex-wrap items-center gap-2">{responses.length > 0 ? <button type="button" disabled={exportingExcel || Boolean(bulkProgress)} onClick={() => void exportExcel()} className="inline-flex min-h-[40px] shrink-0 items-center gap-2 rounded-lg border border-[#C8D0DA] px-3 text-xs font-bold text-[#334155] hover:border-[#0F6CBD] hover:text-[#0F6CBD] disabled:border-[#DCE3EA] disabled:text-[#94A3B8]">{exportingExcel ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sheet className="h-4 w-4" />}{exportingExcel ? '만드는 중' : '결과 표(xlsx)'}</button> : null}{responses.length > 0 ? <button type="button" disabled={Boolean(bulkProgress) || Boolean(downloadingId)} onClick={() => void downloadAllResponses()} className="inline-flex min-h-[40px] shrink-0 items-center gap-2 rounded-lg bg-[#0F6CBD] px-4 text-xs font-bold text-white hover:bg-[#0B5B9F] disabled:bg-[#AAB7C4]">{bulkProgress ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{bulkProgress ? `합치는 중 ${bulkProgress}` : '전체 PDF 내려받기'}</button> : null}</div></div>
      <button type="button" onClick={() => setResponsesExpanded(value => !value)} aria-expanded={responsesExpanded} aria-controls="consent-response-list" className="mt-3 min-h-[44px] rounded-lg border border-[#C8D0DA] px-3 text-xs font-bold text-[#334155]">{responsesExpanded ? '응답 목록 접기' : '응답 목록 펼치기'}</button>
      {responseError ? <p role="alert" className="mt-3 border-l-2 border-[#B42318] bg-[#FEF2F2] px-3 py-2.5 text-xs font-semibold leading-5 text-[#B42318]">{responseError}</p> : null}
      <div id="consent-response-list" hidden={!responsesExpanded}>
      {responsesLoading
        ? <p className="mt-4 flex items-center gap-2 text-xs font-semibold text-[#526174]"><LoaderCircle className="h-4 w-4 animate-spin text-[#0F6CBD]" />제출된 응답을 불러오고 있습니다.</p>
        : responses.length === 0
          ? <div className="mt-4 border border-dashed border-[#C8D0DA] py-10 text-center"><Inbox className="mx-auto h-7 w-7 text-[#94A3B8]" /><p className="mt-3 text-sm font-bold">아직 제출된 응답이 없습니다</p><p className="mt-1.5 text-xs text-[#64748B]">응답 링크나 QR을 배부하면 여기에 쌓입니다.</p></div>
          : <ul className="mt-4 divide-y divide-[#EEF1F4] border-y border-[#EEF1F4]">{responses.map((response, index) => <li key={response.id} className="consent-response-row py-3">
            <span className="w-7 shrink-0 text-xs font-bold tabular-nums text-[#64748B]">{index + 1}</span>
            <div className="min-w-0 flex-1"><p className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#334155]">{recipientOf(response) ? <span className="rounded bg-[#EFF6FC] px-1.5 py-0.5 text-[11px] text-[#0F6CBD]">{recipientOf(response)?.name}</span> : response.recipientId ? <span className="text-[#526174]">명단 대상 · 내용 보기로 이름 확인</span> : null}<span className="tabular-nums">{submittedLabel(response.submittedAt)}</span></p><p className="mt-1 truncate text-xs text-[#64748B]" title={summarize(response)}>{response.detailsLoaded===false?'내용 보기를 눌러 응답을 확인하세요.':summarize(response) || '입력된 값이 없습니다.'}</p></div>
            <button type="button" disabled={Boolean(downloadingId)} onClick={() => void showDetails(response)} className="min-h-[44px] rounded-lg border border-[#C8D0DA] px-3 text-xs font-bold">내용 보기</button>
            <button type="button" disabled={Boolean(downloadingId) || Boolean(bulkProgress)} onClick={() => void downloadResponse(response, index)} className="inline-flex min-h-[40px] shrink-0 items-center gap-2 rounded-lg border border-[#0F6CBD] px-3 text-xs font-bold text-[#0F6CBD] hover:bg-[#EFF6FC] disabled:border-[#C8D0DA] disabled:text-[#94A3B8]" aria-label={`${index + 1}번째 응답 PDF 내려받기`}>{downloadingId === response.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{downloadingId === response.id ? '만드는 중' : 'PDF'}</button>
          </li>)}</ul>}
    {responses.length < (draft.currentResponseCount ?? responses.length) ? <button type="button" disabled={pageLoading} onClick={()=>void loadMoreResponses()} className="min-h-[44px] border px-4 text-sm">응답 더 보기 (현재 {responses.length}건)</button>:null}
      </div>
    </section>


    {historyRecipient ? <section aria-label="재제출 이력" className="border-y bg-white p-4"><h2 className="font-bold">{recipients.find(r=>r.id===historyRecipient)?.name} 제출 이력</h2><p className="text-xs text-[#526174]">최신 응답은 결과 표와 전체 PDF에 한 번만 포함됩니다.</p><ul>{history.map((r,index)=><li key={r.id} className="flex flex-wrap gap-2 border-b py-3"><span className="text-sm">{index===0?'최신 · ':''}{submittedLabel(r.submittedAt)}</span><button type="button" onClick={()=>void showDetails(r)} className="min-h-[44px] border px-3 text-xs">내용 보기</button><button type="button" onClick={()=>void downloadResponse(r,index)} className="min-h-[44px] border px-3 text-xs">이력 PDF</button>{r.detailsLoaded?<p className="w-full break-words text-xs">{summarize(r)}</p>:null}</li>)}</ul>{historyCursor?<button type="button" disabled={pageLoading} onClick={()=>void showHistory(historyRecipient,true)} className="min-h-[44px] border px-3">이력 더 보기</button>:null}<button type="button" onClick={()=>setHistoryRecipient('')} className="min-h-[44px] px-3 text-xs">이력 닫기</button></section>:null}
    {recipients.length > 0 ? <section aria-label="명단 제출 현황" className="border-y border-[#DCE3EA] bg-white px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-bold">명단 제출 현황<span className="ml-2 text-xs font-semibold text-[#64748B]">현재 명단 {recipients.length} / {draft.recipientCount}명 · 전체 제출 {submittedCount}명</span></h2><p className="mt-1 text-xs text-[#64748B]">보호자마다 다른 개인 링크가 발급되어 누가 제출했는지 확인할 수 있습니다.</p></div><div className="flex min-w-0 flex-wrap gap-2">
        <button type="button" onClick={() => setRecipientsExpanded(value => !value)} aria-expanded={recipientsExpanded} aria-controls="consent-recipient-list" className="min-h-[44px] rounded-lg border border-[#C8D0DA] px-3 text-xs font-bold text-[#334155]">{recipientsExpanded ? '명단 목록 접기' : '명단 목록 펼치기'}</button>
      </div></div>
      <div id="consent-recipient-list" hidden={!recipientsExpanded}>
      {recipients.length<draft.recipientCount ? <div className="mt-3 flex flex-wrap items-center gap-2"><p role="status" className="text-xs">현재 불러온 {recipients.length}명에서 검색합니다.</p><button type="button" disabled={pageLoading} onClick={()=>void loadMoreRecipients()} className="min-h-[44px] border px-3 text-xs">명단 더 보기</button><button type="button" disabled={pageLoading} onClick={()=>void loadMoreRecipients(true)} className="min-h-[44px] border px-3 text-xs">전체 명단 불러와 검색</button></div>:null}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="min-w-0 flex-1"><span className="sr-only">이름 또는 식별값으로 찾기</span><input value={recipientQuery} onChange={(event) => setRecipientQuery(event.target.value)} placeholder="이름 또는 식별값으로 찾기" className="min-h-[40px] w-full min-w-0 rounded-lg border border-[#C8D0DA] px-3 text-xs" /></label>
        <div className="flex min-w-0 flex-wrap gap-1" role="group" aria-label="제출 상태 filter">
          {([['all', '전체'], ['pending', '미제출'], ['submitted', '제출']] as const).map(([value, label]) => (
            <button key={value} type="button" aria-pressed={recipientFilter === value} onClick={() => setRecipientFilter(value)} className={`min-h-[40px] rounded-lg border px-3 text-xs font-bold ${recipientFilter === value ? 'border-[#0F6CBD] bg-[#EFF6FC] text-[#0F6CBD]' : 'border-[#C8D0DA] text-[#334155]'}`}>{label}</button>
          ))}
        </div>
      </div>
      {visibleRecipients.length === 0 ? <p className="mt-4 border border-dashed border-[#C8D0DA] py-8 text-center text-xs font-semibold text-[#64748B]">조건에 맞는 대상이 없습니다.</p> : null}
      <ul className="mt-4 divide-y divide-[#EEF1F4] border-y border-[#EEF1F4]">{visibleRecipients.map((recipient) => {
        const personalLink = `${publicLink}?r=${recipient.token}`;
        return <li key={recipient.id} className="consent-recipient-row py-3">
          <span className={`inline-flex min-w-[52px] justify-center rounded-md px-2 py-1 text-[11px] font-bold ${recipient.submittedAt ? 'bg-[#E6F4EA] text-[#126B32]' : 'bg-[#FEF3F2] text-[#B42318]'}`}>{recipient.submittedAt ? '제출' : '미제출'}</span>
          <div className="min-w-0 flex-1"><p className="text-xs font-bold text-[#334155]">{recipient.name}{recipient.studentKey ? <span className="ml-2 font-semibold text-[#64748B]">{recipient.studentKey}</span> : null}</p><p className="mt-1 text-[11px] tabular-nums text-[#64748B]">{recipient.submittedAt ? submittedLabel(recipient.submittedAt) : '아직 제출하지 않았습니다.'}</p></div>
          {recipient.responseId ? <button type="button" disabled={pageLoading} onClick={()=>void showHistory(recipient.id)} className="min-h-[44px] rounded-lg border px-3 text-xs font-bold" aria-label={`${recipient.name} 제출 이력`}>제출 이력</button>:null}
          <button type="button" onClick={async () => { await navigator.clipboard.writeText(personalLink); setCopiedRecipient(recipient.id); window.setTimeout(() => setCopiedRecipient(''), 1500); }} className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-lg border border-[#C8D0DA] px-2.5 text-[11px] font-bold text-[#334155] hover:border-[#0F6CBD] hover:text-[#0F6CBD]" aria-label={`${recipient.name} 개인 링크 복사`}>{copiedRecipient === recipient.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}개인 링크</button>
        </li>;
      })}</ul>
      </div>
    </section> : null}
    {recipientsNotice ? <p role="status" className="border-l-2 border-[#E6A700] bg-[#FFF9ED] px-3 py-2.5 text-xs font-semibold leading-5 text-[#76520E]">{recipientsNotice}</p> : null}


    {confirmingReissue ? <RegistryConfirmDialog
      title="응답 링크를 재발급할까요?"
      description="이전 링크와 QR, 이미 배부한 개인 링크가 모두 열리지 않습니다. 새 링크를 다시 배부해야 합니다."
      confirmLabel={reissuing ? '재발급 중' : '링크 재발급'}
      onCancel={() => { if (!reissuing) setConfirmingReissue(false); }}
      onConfirm={() => void reissueLink()}
    /> : null}
    {confirmingDelete ? <RegistryConfirmDialog
      title="가정통신문 수합을 삭제할까요?"
      description={`“${draft.title}”의 원본 PDF와 제출된 응답 ${draft.responseCount}건이 모두 삭제됩니다. 되돌릴 수 없습니다.`}
      confirmLabel={deleting ? '삭제 중' : '영구 삭제'}
      onCancel={() => { if (!deleting) setConfirmingDelete(false); }}
      onConfirm={() => void deleteForm()}
    /> : null}
  </div>;
}
