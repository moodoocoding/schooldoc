import { useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, FileCheck2, Plus, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTeacherAuth } from '../../auth/teacherAuth';
import { dataCollectOwnerId } from './dataCollectConfig';
import { listDataCollections, subscribeDataCollections } from './dataCollectService';
import type { DataCollection } from './types';

export function DataCollectListPage() {
  const navigate = useNavigate();
  const { user } = useTeacherAuth();
  const ownerId = dataCollectOwnerId(user?.id);
  const [collections, setCollections] = useState<DataCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try { setError(''); setCollections(await listDataCollections(ownerId)); }
      catch (listError) { if (active) setError(listError instanceof Error ? listError.message : '자료 수합을 불러오지 못했습니다.'); }
      finally { if (active) setLoading(false); }
    };
    void refresh();
    const unsubscribe = subscribeDataCollections(() => void refresh());
    return () => { active = false; unsubscribe(); };
  }, [ownerId]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-12">
      <div className="flex items-center justify-between border-b border-[#DCE3EA] pb-4"><button type="button" onClick={() => navigate('/')} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[#334155] hover:bg-white hover:text-[#0F6CBD]"><ArrowLeft className="h-5 w-5" />업무 도구로</button><span className="rounded-md border border-[#DCE3EA] bg-white px-3 py-1.5 text-xs font-semibold text-[#526174]">교사 전용</span></div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold text-[#0F6CBD]">파일을 원본 그대로</p><h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">자료 수합</h1><p className="mt-2 text-sm text-[#526174]">제목과 안내를 직접 작성하고 확인 또는 수정본을 한곳에서 받습니다.</p></div><button type="button" onClick={() => navigate('/tools/data-collect/new')} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#0F6CBD] px-5 text-sm font-bold text-white hover:bg-[#0B5B9F]"><Plus className="h-4 w-4" />새 자료 수합</button></div>
      {error ? <p role="alert" className="border-y border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-[#B42318]">{error}</p> : null}
      {loading ? <div className="py-20 text-center text-sm font-semibold text-[#526174]">자료 수합을 불러오는 중입니다.</div> : collections.length === 0 ? <div className="border-y border-[#DCE3EA] bg-white py-20 text-center"><FileCheck2 className="mx-auto h-9 w-9 text-[#94A3B8]" /><h2 className="mt-4 text-lg font-bold">아직 자료 수합이 없습니다</h2><p className="mt-2 text-sm text-[#526174]">배포할 파일과 명단으로 첫 수합을 만들어 보세요.</p><button type="button" onClick={() => navigate('/tools/data-collect/new')} className="mt-5 min-h-[44px] rounded-lg border border-[#0F6CBD] px-5 text-sm font-bold text-[#0F6CBD] hover:bg-[#EFF6FC]">첫 자료 수합 만들기</button></div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{collections.map((collection) => {
        const responded = new Set(collection.submissions.map((submission) => submission.targetId)).size;
        return <button key={collection.id} type="button" onClick={() => navigate(`/tools/data-collect/${collection.id}`)} className="rounded-lg border border-[#DCE3EA] bg-white p-5 text-left shadow-sm hover:border-[#0F6CBD] hover:shadow-md"><div className="flex items-center justify-between gap-3"><span className={`rounded-md px-2.5 py-1 text-xs font-bold ${collection.status === 'open' ? 'bg-[#E6F4EA] text-[#126B32]' : 'bg-[#EEF1F4] text-[#526174]'}`}>{collection.status === 'open' ? '수합 중' : '종료'}</span><span className="text-xs font-semibold text-[#526174]">{collection.mode === 'custom' ? '명단 없음' : '명단 있음'}</span></div><h2 className="mt-4 min-h-12 line-clamp-2 text-lg font-bold">{collection.title}</h2><div className="mt-4 space-y-2 text-sm text-[#526174]"><p className="flex items-center gap-2"><Users className="h-4 w-4" />{responded}/{collection.targets.length} 회신</p><p className="flex items-center gap-2"><CalendarDays className="h-4 w-4" />{collection.dueAt ? `${new Date(collection.dueAt).toLocaleDateString('ko-KR')}까지` : '기한 없음'}</p></div><div className="mt-5 border-t border-[#EEF1F4] pt-4 text-right text-xs font-bold text-[#0F6CBD]">현황 보기</div></button>;
      })}</div>}
    </div>
  );
}
