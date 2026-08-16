import { ArrowLeft, Check, Copy, Download, ImageDown, ExternalLink, FilePenLine, Inbox, LoaderCircle, LockKeyhole, PauseCircle, PlayCircle, QrCode, Save, Settings2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getConsentLocalDraft, hashConsentPassword, listConsentLocalResponses, updateConsentLocalDraft } from './consentFormsLocalStore';
import { getConsentPublicOrigin, isConsentFormsDemoMode } from './consentFormsConfig';
import { getRemoteConsentForm, getRemoteConsentSourceFile, listRemoteConsentResponses, updateRemoteConsentForm } from './consentFormsRepository';
import { consentQrFileName, consentResponseFileName, consentResponsesFileName, downloadBlob, formatConsentValue, renderConsentResponsePdf, renderConsentResponsesPdf, svgToPngBlob } from './consentResponseRender';
import type { ConsentLocalDraft, ConsentResponseRecord } from './types';

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
  const [title, setTitle] = useState(draft?.title ?? '');
  const [deadline, setDeadline] = useState(draft?.deadline ?? '');
  const [allowResubmission, setAllowResubmission] = useState(draft?.allowResubmission ?? false);
  const [passwordEnabled, setPasswordEnabled] = useState(draft?.passwordEnabled ?? false);
  const [newPassword, setNewPassword] = useState('');
  const [copied, setCopied] = useState(false);
  const [responses, setResponses] = useState<ConsentResponseRecord[]>(() => isConsentFormsDemoMode ? listConsentLocalResponses(id) : []);
  const [responsesLoading, setResponsesLoading] = useState(!isConsentFormsDemoMode);
  const [responseError, setResponseError] = useState('');
  const [downloadingId, setDownloadingId] = useState('');
  const [bulkProgress, setBulkProgress] = useState('');
  const [qrError, setQrError] = useState('');
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isConsentFormsDemoMode) {
      setResponses(listConsentLocalResponses(id));
      return;
    }
    let active = true;
    listRemoteConsentResponses(id)
      .then((rows) => { if (active) setResponses(rows); })
      .catch((error) => { if (active) setResponseError(error instanceof Error ? error.message : '응답을 불러오지 못했습니다.'); })
      .finally(() => { if (active) setResponsesLoading(false); });
    getRemoteConsentForm(id).then((form) => {
      if (!active) return;
      setDraft(form);
      setTitle(form?.title ?? '');
      setDeadline(form?.deadline ?? '');
      setAllowResubmission(form?.allowResubmission ?? false);
      setPasswordEnabled(form?.passwordEnabled ?? false);
    }).catch((error) => {
      if (active) setLoadError(error instanceof Error ? error.message : '수합을 불러오지 못했습니다.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  if (loading) return <div className="py-20 text-center text-sm font-semibold text-[#526174]">수합을 불러오고 있습니다.</div>;
  if (!draft) return <div className="mx-auto max-w-xl py-20 text-center"><h1 className="text-xl font-extrabold">수합을 찾을 수 없습니다</h1>{loadError ? <p className="mt-3 text-sm font-semibold text-[#B42318]">{loadError}</p> : null}<button type="button" onClick={() => navigate('/tools/consent-forms')} className="mt-5 min-h-[44px] rounded-lg border border-[#C8D0DA] px-4 text-sm font-bold">목록으로</button></div>;
  const publicLink = `${getConsentPublicOrigin()}/s/consent/${draft.publicToken}`;

  const save = async () => {
    if (!isConsentFormsDemoMode) {
      const updated = await updateRemoteConsentForm(draft.id, { title: title.trim() || draft.title, deadline, allowResubmission, passwordEnabled, password: newPassword });
      if (updated) setDraft(updated);
      setNewPassword('');
      setEditing(false);
      return;
    }
    const passwordHash = passwordEnabled && newPassword.trim() ? await hashConsentPassword(newPassword.trim()) : passwordEnabled ? draft.passwordHash : '';
    const updated = updateConsentLocalDraft(draft.id, { title: title.trim() || draft.title, deadline, allowResubmission, passwordEnabled, passwordHash });
    if (updated) setDraft(updated);
    setNewPassword('');
    setEditing(false);
  };

  const toggleStatus = async () => {
    if (!isConsentFormsDemoMode) {
      const updated = await updateRemoteConsentForm(draft.id, { status: draft.status === 'open' ? 'closed' : 'open' });
      if (updated) setDraft(updated);
      return;
    }
    const updated = updateConsentLocalDraft(draft.id, { status: draft.status === 'open' ? 'closed' : 'open' });
    if (updated) setDraft(updated);
  };

  const downloadResponse = async (response: ConsentResponseRecord, index: number) => {
    setDownloadingId(response.id);
    setResponseError('');
    try {
      const file = await sourceFileOf(draft);
      const blob = await renderConsentResponsePdf({ file, fields: draft.fields, response });
      downloadBlob(blob, consentResponseFileName(draft.title, index + 1));
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
      const blob = await renderConsentResponsesPdf({
        file,
        fields: draft.fields,
        responses,
        onProgress: (done, total) => setBulkProgress(`${done} / ${total}`),
      });
      downloadBlob(blob, consentResponsesFileName(draft.title, responses.length));
    } catch (error) {
      setResponseError(error instanceof Error ? error.message : '응답 PDF를 만들지 못했습니다.');
    } finally {
      setBulkProgress('');
    }
  };

  const downloadQrImage = async () => {
    setQrError('');
    try {
      const svg = qrRef.current?.querySelector('svg');
      if (!svg) throw new Error('QR 코드를 찾지 못했습니다.');
      downloadBlob(await svgToPngBlob(svg, 1024), consentQrFileName(draft.title));
    } catch (error) {
      setQrError(error instanceof Error ? error.message : 'QR 이미지를 저장하지 못했습니다.');
    }
  };

  const summarize = (response: ConsentResponseRecord) => draft.fields
    .map((field) => {
      const value = response.values[field.id] ?? '';
      if (!value) return '';
      if (field.kind === 'signature') return `${field.label}: 서명함`;
      if (field.kind === 'checkbox') return value === 'true' ? `${field.label}: 예` : '';
      return `${field.label}: ${formatConsentValue(field, value)}`;
    })
    .filter(Boolean)
    .join(' · ');

  return <div className="mx-auto w-full max-w-6xl space-y-4 pb-10">
    <header className="flex items-center justify-between gap-3 border-b border-[#DCE3EA] pb-3"><button type="button" onClick={() => navigate('/tools/consent-forms')} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[#334155] hover:bg-white hover:text-[#0F6CBD]"><ArrowLeft className="h-5 w-5" />목록으로</button><span className={`rounded-md px-2.5 py-1 text-xs font-bold ${draft.status === 'open' ? 'bg-[#E6F4EA] text-[#126B32]' : 'bg-[#EEF1F4] text-[#526174]'}`}>{draft.status === 'open' ? '수합 중' : '종료'}</span></header>

    <section className="min-w-0 py-2">
      <p className="text-xs font-bold text-[#0F6CBD]">가정통신문 수합 관리</p>
      <h1 className="mt-1 max-w-4xl break-words text-xl font-extrabold leading-8 sm:text-2xl">{draft.title}</h1>
      <p className="mt-1.5 max-w-3xl truncate text-xs text-[#64748B]" title={draft.fileName}>{draft.fileName}</p>
    </section>

    <nav aria-label="수합 관리 작업" className="flex flex-wrap items-center gap-2 border-y border-[#DCE3EA] bg-white px-3 py-2.5">
      <button type="button" onClick={() => navigate(`/tools/consent-forms/new?edit=${draft.id}`)} className="inline-flex min-h-[40px] items-center gap-2 rounded-lg px-3 text-xs font-bold text-[#334155] hover:bg-[#EFF6FC] hover:text-[#0F6CBD]"><FilePenLine className="h-4 w-4" />원본·필드 수정</button>
      <button type="button" onClick={() => setEditing((value) => !value)} className={`inline-flex min-h-[40px] items-center gap-2 rounded-lg px-3 text-xs font-bold ${editing ? 'bg-[#EFF6FC] text-[#0F6CBD]' : 'text-[#334155] hover:bg-[#EFF6FC] hover:text-[#0F6CBD]'}`}><Settings2 className="h-4 w-4" />설정 수정</button>
      <span className="hidden h-5 w-px bg-[#DCE3EA] sm:block" />
      <button type="button" onClick={toggleStatus} className={`inline-flex min-h-[40px] items-center gap-2 rounded-lg px-3 text-xs font-bold ${draft.status === 'open' ? 'text-[#B42318] hover:bg-[#FEF2F2]' : 'text-[#126B32] hover:bg-[#E6F4EA]'}`}>{draft.status === 'open' ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}{draft.status === 'open' ? '수합 종료' : '수합 재개'}</button>
    </nav>

    {editing ? <section className="border-y border-[#DCE3EA] bg-white px-5 py-5"><h2 className="text-sm font-bold">수합 설정 수정</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-xs font-bold">제목<input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2 min-h-[44px] w-full rounded-lg border border-[#C8D0DA] px-3 text-sm font-normal" /></label><label className="text-xs font-bold">응답 기한<input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} className="mt-2 min-h-[44px] w-full rounded-lg border border-[#C8D0DA] px-3 text-sm font-normal" /></label></div><div className="mt-4 grid gap-2 sm:grid-cols-2"><label className="flex min-h-[44px] items-center gap-3 text-sm font-bold"><input type="checkbox" checked={allowResubmission} onChange={(event) => setAllowResubmission(event.target.checked)} className="h-4 w-4" />제출 후 수정 허용</label><label className="flex min-h-[44px] items-center gap-3 text-sm font-bold"><input type="checkbox" checked={passwordEnabled} onChange={(event) => setPasswordEnabled(event.target.checked)} className="h-4 w-4" />공개 링크 비밀번호 사용</label></div>{passwordEnabled ? <label className="mt-3 block max-w-sm text-xs font-bold">새 비밀번호<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder={draft.passwordHash ? '변경할 때만 입력' : '4자 이상 입력'} className="mt-2 min-h-[44px] w-full rounded-lg border border-[#C8D0DA] px-3 text-sm font-normal" /></label> : null}<div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setEditing(false)} className="min-h-[44px] rounded-lg px-4 text-sm font-bold">취소</button><button type="button" disabled={passwordEnabled && !draft.passwordHash && newPassword.trim().length < 4} onClick={() => void save()} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#0F6CBD] px-4 text-sm font-bold text-white disabled:bg-[#AAB7C4]"><Save className="h-4 w-4" />저장</button></div></section> : null}

    <section aria-label="수합 요약" className="grid grid-cols-2 border-y border-[#DCE3EA] bg-white sm:grid-cols-4">
      <div className="border-b border-r border-[#EEF1F4] px-4 py-3 sm:border-b-0"><span className="text-[11px] font-semibold text-[#64748B]">응답</span><strong className="mt-0.5 block text-xl tabular-nums">{draft.responseCount}건</strong></div>
      <div className="border-b border-[#EEF1F4] px-4 py-3 sm:border-b-0 sm:border-r"><span className="text-[11px] font-semibold text-[#64748B]">응답 필드</span><strong className="mt-0.5 block text-xl tabular-nums">{draft.fieldCount}개</strong></div>
      <div className="border-r border-[#EEF1F4] px-4 py-3"><span className="text-[11px] font-semibold text-[#64748B]">대상</span><strong className="mt-1 block truncate text-sm">{draft.recipientMode === 'named' ? `명단 ${draft.recipientCount}명` : '공개 수합'}</strong></div>
      <div className="px-4 py-3"><span className="text-[11px] font-semibold text-[#64748B]">응답 기한</span><strong className="mt-1 block text-sm tabular-nums">{draft.deadline || '기한 없음'}</strong></div>
    </section>

    <section aria-label="제출 현황" className="border-y border-[#DCE3EA] bg-white px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-bold">제출 현황<span className="ml-2 text-xs font-semibold text-[#64748B]">{responses.length}건</span></h2><p className="mt-1 text-xs text-[#64748B]">응답을 원본 가정통신문 위에 합성한 PDF로 내려받습니다.</p></div>{responses.length > 0 ? <button type="button" disabled={Boolean(bulkProgress) || Boolean(downloadingId)} onClick={() => void downloadAllResponses()} className="inline-flex min-h-[40px] shrink-0 items-center gap-2 rounded-lg bg-[#0F6CBD] px-4 text-xs font-bold text-white hover:bg-[#0B5B9F] disabled:bg-[#AAB7C4]">{bulkProgress ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{bulkProgress ? `합치는 중 ${bulkProgress}` : '전체 PDF 내려받기'}</button> : null}</div>
      {responseError ? <p role="alert" className="mt-3 border-l-2 border-[#B42318] bg-[#FEF2F2] px-3 py-2.5 text-xs font-semibold leading-5 text-[#B42318]">{responseError}</p> : null}
      {responsesLoading
        ? <p className="mt-4 flex items-center gap-2 text-xs font-semibold text-[#526174]"><LoaderCircle className="h-4 w-4 animate-spin text-[#0F6CBD]" />제출된 응답을 불러오고 있습니다.</p>
        : responses.length === 0
          ? <div className="mt-4 border border-dashed border-[#C8D0DA] py-10 text-center"><Inbox className="mx-auto h-7 w-7 text-[#94A3B8]" /><p className="mt-3 text-sm font-bold">아직 제출된 응답이 없습니다</p><p className="mt-1.5 text-xs text-[#64748B]">응답 링크나 QR을 배부하면 여기에 쌓입니다.</p></div>
          : <ul className="mt-4 divide-y divide-[#EEF1F4] border-y border-[#EEF1F4]">{responses.map((response, index) => <li key={response.id} className="flex flex-wrap items-center gap-3 py-3">
            <span className="w-7 shrink-0 text-xs font-bold tabular-nums text-[#64748B]">{index + 1}</span>
            <div className="min-w-0 flex-1"><p className="text-xs font-bold tabular-nums text-[#334155]">{submittedLabel(response.submittedAt)}</p><p className="mt-1 truncate text-xs text-[#64748B]" title={summarize(response)}>{summarize(response) || '입력된 값이 없습니다.'}</p></div>
            <button type="button" disabled={Boolean(downloadingId) || Boolean(bulkProgress)} onClick={() => void downloadResponse(response, index)} className="inline-flex min-h-[40px] shrink-0 items-center gap-2 rounded-lg border border-[#0F6CBD] px-3 text-xs font-bold text-[#0F6CBD] hover:bg-[#EFF6FC] disabled:border-[#C8D0DA] disabled:text-[#94A3B8]" aria-label={`${index + 1}번째 응답 PDF 내려받기`}>{downloadingId === response.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{downloadingId === response.id ? '만드는 중' : 'PDF'}</button>
          </li>)}</ul>}
    </section>

    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <section className="border-y border-[#DCE3EA] bg-white px-4 py-4 sm:px-5"><h2 className="text-sm font-bold">응답 링크</h2><p className="mt-1 text-xs text-[#64748B]">보호자에게 링크를 보내거나 오른쪽 QR을 배부하세요.</p><div className="mt-3 flex gap-2"><input readOnly value={publicLink} className="min-h-[42px] min-w-0 flex-1 rounded-lg border border-[#C8D0DA] bg-[#F6F8FB] px-3 text-xs" /><button type="button" onClick={async () => { await navigator.clipboard.writeText(publicLink); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }} className="inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg border border-[#C8D0DA] text-[#0F6CBD]" aria-label="응답 링크 복사" title="링크 복사">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</button><a href={publicLink} target="_blank" rel="noreferrer" className="inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg border border-[#C8D0DA] text-[#0F6CBD]" aria-label="응답 화면 열기" title="새 창에서 열기"><ExternalLink className="h-4 w-4" /></a></div>{draft.passwordEnabled ? <p className="mt-3 flex items-center gap-2 text-xs text-[#526174]"><LockKeyhole className="h-4 w-4 text-[#0F6CBD]" />비밀번호로 보호된 링크입니다.</p> : null}{draft.recipientMode === 'named' ? <p className="mt-4 border-l-2 border-[#E6A700] bg-[#FFF9ED] px-3 py-2.5 text-xs leading-5 text-[#76520E]">현재 로컬 모드에서는 공용 링크만 제공합니다. 대상별 제출 매칭은 서버 저장 연결 후 사용할 수 있습니다.</p> : null}</section>
      <aside className="border-y border-[#DCE3EA] bg-white px-4 py-4 text-center"><div className="mb-3 flex items-center justify-center gap-2 text-xs font-bold"><QrCode className="h-4 w-4 text-[#0F6CBD]" />응답 QR 코드</div><div ref={qrRef} className="inline-block border border-[#DCE3EA] bg-white p-2"><QRCodeSVG value={publicLink} size={176} level="M" includeMargin aria-label="가정통신문 응답 링크 QR 코드" /></div><p className="mx-auto mt-2 max-w-[210px] text-[11px] leading-4 text-[#64748B]">응답 링크만 포함합니다.</p><button type="button" onClick={() => void downloadQrImage()} className="mx-auto mt-3 inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-[#0F6CBD] px-3 text-xs font-bold text-[#0F6CBD] hover:bg-[#EFF6FC]"><ImageDown className="h-4 w-4" />QR 이미지 저장</button>{qrError ? <p role="alert" className="mt-2 text-[11px] font-semibold text-[#B42318]">{qrError}</p> : null}</aside>
    </div>
  </div>;
}
