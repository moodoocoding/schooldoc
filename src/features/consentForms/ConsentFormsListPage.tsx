import { Archive, FileCheck2, FileText, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ToolHeaderBadge, ToolListHeader } from '../../components/ToolListHeader';
import { RegistryConfirmDialog } from '../registry/RegistryConfirmDialog';
import { isConsentFormsDemoMode } from './consentFormsConfig';
import { deleteConsentLocalDraft, getConsentLocalDrafts } from './consentFormsLocalStore';
import { listRemoteConsentForms } from './consentFormsRepository';
import { purgeConsentForms } from './consentPurgeApi';
import { isPastRetention, selectPurgeCandidates, summarizePurge } from './consentPurgeSelection';
import type { ConsentLocalDraft } from './types';

export function ConsentFormsListPage() {
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<ConsentLocalDraft[]>(() => isConsentFormsDemoMode ? getConsentLocalDrafts() : []);
  const [loading, setLoading] = useState(!isConsentFormsDemoMode);
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<ConsentLocalDraft | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expiredOnly, setExpiredOnly] = useState(false);
  const [purging, setPurging] = useState(false);
  const [purgeNotice, setPurgeNotice] = useState('');
  const [confirmingPurge, setConfirmingPurge] = useState(false);

  const now = new Date();
  const expiredCount = selectPurgeCandidates(drafts, now).length;
  const visibleDrafts = expiredOnly ? drafts.filter((draft) => isPastRetention(draft, now)) : drafts;
  const selectedDrafts = drafts.filter((draft) => selectedIds.includes(draft.id));
  const selectedSummary = summarizePurge(selectedDrafts);

  const toggleSelected = (id: string) => setSelectedIds((current) => (
    current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
  ));

  const purgeSelected = async () => {
    if (!selectedDrafts.length || purging) return;
    setPurging(true);
    setActionError('');
    setPurgeNotice('');
    try {
      if (isConsentFormsDemoMode) {
        selectedDrafts.forEach((draft) => deleteConsentLocalDraft(draft.id));
        setDrafts((current) => current.filter((draft) => !selectedIds.includes(draft.id)));
        setPurgeNotice(`${selectedDrafts.length}개를 지웠습니다.`);
      } else {
        const result = await purgeConsentForms(selectedIds);
        const purgedIds = result.purged.map((entry) => entry.id);
        setDrafts((current) => current.filter((draft) => !purgedIds.includes(draft.id)));
        // 부분 실패는 조용히 넘어가지 않는다. 남은 건은 다시 시도할 수 있다.
        setPurgeNotice(result.failed.length
          ? `${result.purged.length}개를 지웠고 ${result.failed.length}개는 지우지 못했습니다: ${result.failed[0].error}`
          : `${result.purged.length}개를 지웠습니다.`);
      }
      setSelectedIds([]);
      setConfirmingPurge(false);
    } catch (purgeError) {
      setActionError(purgeError instanceof Error ? purgeError.message : '수합을 지우지 못했습니다.');
    } finally {
      setPurging(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    setActionError('');
    try {
      if (isConsentFormsDemoMode) deleteConsentLocalDraft(pendingDelete.id);
      else {
        const result = await purgeConsentForms([pendingDelete.id]);
        if (result.failed.length) throw new Error(result.failed[0].error);
      }
      setDrafts((current) => current.filter((draft) => draft.id !== pendingDelete.id));
      setPendingDelete(null);
    } catch (deleteError) {
      setActionError(deleteError instanceof Error ? deleteError.message : '가정통신문을 삭제하지 못했습니다.');
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (isConsentFormsDemoMode) return;
    let active = true;
    listRemoteConsentForms()
      .then((forms) => { if (active) setDrafts(forms); })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : '목록을 불러오지 못했습니다.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return <div className="mx-auto w-full max-w-7xl space-y-6 pb-12">
    <ToolListHeader
      eyebrow="보호자 응답 수합"
      title="가정통신문 수합"
      description="기존 문서에 응답 항목을 배치하고 제출 현황과 결과 문서를 관리합니다."
      toolbar={<ToolHeaderBadge>PDF</ToolHeaderBadge>}
      action={<button type="button" onClick={() => navigate('/tools/consent-forms/new')} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#0F6CBD] px-5 text-sm font-bold text-white hover:bg-[#0B5B9F]"><Plus className="h-4 w-4" />새 수합 만들기</button>}
    />
    {loading ? <section className="border-y border-[#DCE3EA] bg-white py-20 text-center text-sm font-semibold text-[#526174]">수합 목록을 불러오고 있습니다.</section>
      : error ? <section role="alert" className="border-y border-[#FECACA] bg-[#FEF2F2] px-5 py-8 text-center text-sm font-semibold text-[#B42318]">{error}</section>
        : drafts.length === 0 ? <section className="border-y border-[#DCE3EA] bg-white py-20 text-center"><FileCheck2 className="mx-auto h-9 w-9 text-[#94A3B8]" /><h2 className="mt-4 text-lg font-bold">아직 가정통신문 수합이 없습니다</h2><p className="mt-2 text-sm text-[#526174]">가정통신문을 PDF로 저장한 뒤 첫 수합을 준비해 보세요.</p><button type="button" onClick={() => navigate('/tools/consent-forms/new')} className="mt-5 min-h-[44px] rounded-lg border border-[#0F6CBD] px-5 text-sm font-bold text-[#0F6CBD] hover:bg-[#EFF6FC]">원본 PDF 올리기</button></section>
          : <section><div className="mb-3 flex flex-wrap items-center gap-2"><h2 className="text-sm font-bold">내 수합</h2><span className="text-xs font-semibold text-[#64748B]">{visibleDrafts.length}개</span>
          {expiredCount > 0 ? <button type="button" aria-pressed={expiredOnly} onClick={() => setExpiredOnly((value) => !value)} className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-2.5 text-xs font-bold ${expiredOnly ? 'border-[#0F6CBD] bg-[#EFF6FC] text-[#0F6CBD]' : 'border-[#C8D0DA] text-[#334155]'}`}><Archive className="h-3.5 w-3.5" />보관 기간 지남 {expiredCount}개</button> : null}
          <div className="ml-auto flex items-center gap-2">
            {selectedIds.length > 0 ? <><span className="text-xs font-semibold text-[#0F6CBD]">{selectedIds.length}개 선택</span><button type="button" onClick={() => setSelectedIds([])} className="min-h-[36px] rounded-lg px-2 text-xs font-bold text-[#526174]">선택 해제</button><button type="button" disabled={purging} onClick={() => setConfirmingPurge(true)} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#B42318] px-2.5 text-xs font-bold text-[#B42318] hover:bg-[#FEF2F2] disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" />선택 삭제</button></> : <button type="button" onClick={() => setSelectedIds(visibleDrafts.map((draft) => draft.id))} className="min-h-[36px] rounded-lg px-2 text-xs font-bold text-[#526174]">모두 선택</button>}
          </div></div>
        {purgeNotice ? <p role="status" className="mb-3 border-l-2 border-[#0F6CBD] bg-[#EFF6FC] px-3 py-2.5 text-xs font-semibold leading-5 text-[#1E4E79]">{purgeNotice}</p> : null}<div className="grid gap-3 md:grid-cols-2">{visibleDrafts.map((draft) => <article key={draft.id} className="relative border border-[#DCE3EA] bg-white p-5 pt-12"><label className="absolute left-3 top-3 flex min-h-[36px] min-w-[36px] cursor-pointer items-center justify-center"><input type="checkbox" checked={selectedIds.includes(draft.id)} onChange={() => toggleSelected(draft.id)} className="h-4 w-4" aria-label={`${draft.title} 선택`} /></label><button type="button" onClick={() => setPendingDelete(draft)} className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-[#FEF3F2] hover:text-[#B42318]" aria-label={`${draft.title} 삭제`} title="수합 삭제"><Trash2 className="h-4 w-4" /></button><div className="flex items-start gap-3"><FileText className="mt-0.5 h-5 w-5 shrink-0 text-[#0F6CBD]" /><div className="min-w-0 flex-1"><span className={`rounded-md px-2 py-1 text-[11px] font-bold ${draft.status === 'open' ? 'bg-[#E6F4EA] text-[#126B32]' : 'bg-[#EEF1F4] text-[#526174]'}`}>{draft.status === 'open' ? '수합 중' : '종료'}</span><h3 className="mt-3 break-words pr-9 text-base font-bold">{draft.title}</h3><p className="mt-2 truncate text-xs text-[#64748B]">{draft.fileName}</p><p className="mt-3 text-xs font-semibold text-[#526174]">응답 {draft.responseCount}건 · 필드 {draft.fieldCount}개 · {draft.recipientMode === 'named' ? `명단 ${draft.recipientCount}명` : '공개 수합'}</p><button type="button" onClick={() => navigate(`/tools/consent-forms/${draft.id}`)} className="mt-5 min-h-[40px] rounded-lg border border-[#0F6CBD] px-4 text-xs font-bold text-[#0F6CBD] hover:bg-[#EFF6FC]">관리·공유</button></div></div></article>)}</div></section>}
    {actionError ? <p role="alert" className="border-l-2 border-[#B42318] bg-[#FEF2F2] px-3 py-2.5 text-xs font-semibold text-[#B42318]">{actionError}</p> : null}
    {confirmingPurge ? <RegistryConfirmDialog
      title={`선택한 수합 ${selectedSummary.forms}개를 삭제할까요?`}
      description={`원본 PDF와 제출된 응답 ${selectedSummary.responses}건이 모두 삭제됩니다. 되돌릴 수 없습니다.`}
      confirmLabel={purging ? '삭제 중' : `${selectedSummary.forms}개 삭제`}
      onCancel={() => { if (!purging) setConfirmingPurge(false); }}
      onConfirm={() => void purgeSelected()}
    /> : null}
    {pendingDelete ? <RegistryConfirmDialog
      title="가정통신문 수합을 삭제할까요?"
      description={`“${pendingDelete.title}”의 원본 PDF와 제출된 응답 ${pendingDelete.responseCount}건이 모두 삭제됩니다. 되돌릴 수 없습니다.`}
      confirmLabel={deleting ? '삭제 중' : '영구 삭제'}
      onCancel={() => { if (!deleting) { setPendingDelete(null); setActionError(''); } }}
      onConfirm={() => void handleDelete()}
    /> : null}
  </div>;
}
