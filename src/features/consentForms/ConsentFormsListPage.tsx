import { ArrowLeft, FileCheck2, FileText, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isConsentFormsDemoMode } from './consentFormsConfig';
import { getConsentLocalDrafts } from './consentFormsLocalStore';
import { listRemoteConsentForms } from './consentFormsRepository';
import type { ConsentLocalDraft } from './types';

export function ConsentFormsListPage() {
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<ConsentLocalDraft[]>(() => isConsentFormsDemoMode ? getConsentLocalDrafts() : []);
  const [loading, setLoading] = useState(!isConsentFormsDemoMode);
  const [error, setError] = useState('');

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
    <div className="flex items-center justify-between border-b border-[#DCE3EA] pb-4"><button type="button" onClick={() => navigate('/')} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[#334155] hover:bg-white hover:text-[#0F6CBD]"><ArrowLeft className="h-5 w-5" />업무 도구로</button><span className="rounded-md border border-[#DCE3EA] bg-white px-3 py-1.5 text-xs font-semibold text-[#526174]">PDF</span></div>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold text-[#0F6CBD]">보호자 응답 수합</p><h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">가정통신문 수합</h1><p className="mt-2 text-sm text-[#526174]">기존 문서에 응답 항목을 배치하고 제출 현황과 결과 문서를 관리합니다.</p></div><button type="button" onClick={() => navigate('/tools/consent-forms/new')} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#0F6CBD] px-5 text-sm font-bold text-white hover:bg-[#0B5B9F]"><Plus className="h-4 w-4" />새 수합 만들기</button></div>
    {loading ? <section className="border-y border-[#DCE3EA] bg-white py-20 text-center text-sm font-semibold text-[#526174]">수합 목록을 불러오고 있습니다.</section>
      : error ? <section role="alert" className="border-y border-[#FECACA] bg-[#FEF2F2] px-5 py-8 text-center text-sm font-semibold text-[#B42318]">{error}</section>
        : drafts.length === 0 ? <section className="border-y border-[#DCE3EA] bg-white py-20 text-center"><FileCheck2 className="mx-auto h-9 w-9 text-[#94A3B8]" /><h2 className="mt-4 text-lg font-bold">아직 가정통신문 수합이 없습니다</h2><p className="mt-2 text-sm text-[#526174]">가정통신문을 PDF로 저장한 뒤 첫 수합을 준비해 보세요.</p><button type="button" onClick={() => navigate('/tools/consent-forms/new')} className="mt-5 min-h-[44px] rounded-lg border border-[#0F6CBD] px-5 text-sm font-bold text-[#0F6CBD] hover:bg-[#EFF6FC]">원본 PDF 올리기</button></section>
          : <section><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold">내 수합</h2><span className="text-xs font-semibold text-[#64748B]">{drafts.length}개</span></div><div className="grid gap-3 md:grid-cols-2">{drafts.map((draft) => <article key={draft.id} className="border border-[#DCE3EA] bg-white p-5"><div className="flex items-start gap-3"><FileText className="mt-0.5 h-5 w-5 shrink-0 text-[#0F6CBD]" /><div className="min-w-0 flex-1"><span className={`rounded-md px-2 py-1 text-[11px] font-bold ${draft.status === 'open' ? 'bg-[#E6F4EA] text-[#126B32]' : 'bg-[#EEF1F4] text-[#526174]'}`}>{draft.status === 'open' ? '수합 중' : '종료'}</span><h3 className="mt-3 break-words text-base font-bold">{draft.title}</h3><p className="mt-2 truncate text-xs text-[#64748B]">{draft.fileName}</p><p className="mt-3 text-xs font-semibold text-[#526174]">응답 {draft.responseCount}건 · 필드 {draft.fieldCount}개 · {draft.recipientMode === 'named' ? `명단 ${draft.recipientCount}명` : '공개 수합'}</p><button type="button" onClick={() => navigate(`/tools/consent-forms/${draft.id}`)} className="mt-5 min-h-[40px] rounded-lg border border-[#0F6CBD] px-4 text-xs font-bold text-[#0F6CBD] hover:bg-[#EFF6FC]">관리·공유</button></div></div></article>)}</div></section>}
  </div>;
}
