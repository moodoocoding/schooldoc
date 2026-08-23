import { useState } from 'react';
import {
  CalendarDays,
  MapPin,
  PenLine,
  Plus,
  RefreshCw,
  Trash2,
  Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ToolListHeader } from '../../components/ToolListHeader';
import { RegistryConfirmDialog } from './RegistryConfirmDialog';
import { isRegistryDemoMode } from './registryConfig';
import { deleteRegistry } from './registryService';
import { describeRegistryDeletion } from './registryUtils';
import type { Registry } from './types';
import { useRegistries } from './useRegistries';

export function RegistryListPage() {
  const navigate = useNavigate();
  const { data: registries, loading, error, refresh } = useRegistries();
  const [pendingDelete, setPendingDelete] = useState<Registry | null>(null);
  const [actionError, setActionError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setActionError('');
    try {
      await deleteRegistry(pendingDelete.id);
      setPendingDelete(null);
      await refresh();
    } catch (deleteError) {
      setActionError(deleteError instanceof Error ? deleteError.message : '등록부를 삭제하지 못했습니다.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-12">
      <ToolListHeader
        eyebrow="수합 · 서명"
        title="등록부 서명"
        description="회의와 행사 참석자의 서명을 모아 등록부로 출력합니다."
        toolbar={(
          <div className="flex items-center gap-2">
          {isRegistryDemoMode ? (
            <span className="rounded-md border border-[#DCE3EA] bg-white px-3 py-1.5 text-xs font-semibold text-[#526174]">로컬 데모</span>
          ) : null}
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#DCE3EA] bg-white text-[#526174] hover:text-[#0F6CBD] disabled:opacity-50"
            aria-label="등록부 목록 새로고침"
            title="새로고침"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          </div>
        )}
        action={(
        <button
          type="button"
          onClick={() => navigate('/tools/registry-sign/new')}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#0F6CBD] px-5 text-sm font-bold text-white hover:bg-[#0B5B9F]"
        >
          <Plus className="h-4 w-4" />
          새 등록부
        </button>
        )}
      />

      {error || actionError ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border-y border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-[#B42318]">
          <span>{actionError || error}</span>
          <button type="button" onClick={() => void refresh()} className="rounded-lg border border-[#FECACA] px-3 py-2 text-xs font-bold hover:bg-white">다시 시도</button>
        </div>
      ) : null}

      {loading && registries.length === 0 ? (
        <div className="border-y border-[#DCE3EA] bg-white py-20 text-center">
          <RefreshCw className="mx-auto h-8 w-8 animate-spin text-[#0F6CBD]" />
          <p className="mt-4 text-sm font-semibold text-[#526174]">등록부를 불러오고 있습니다.</p>
        </div>
      ) : registries.length === 0 ? (
        <div className="border-y border-[#DCE3EA] bg-white py-20 text-center">
          <PenLine className="mx-auto h-9 w-9 text-[#94A3B8]" />
          <h2 className="mt-4 text-lg font-bold text-[#0F172A]">등록부가 없습니다</h2>
          <button
            type="button"
            onClick={() => navigate('/tools/registry-sign/new')}
            className="mt-5 min-h-[44px] rounded-lg border border-[#0F6CBD] px-5 text-sm font-bold text-[#0F6CBD] hover:bg-[#EFF6FC]"
          >
            첫 등록부 만들기
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {registries.map((registry) => {
            const signedCount = registry.participants.filter((participant) => participant.signature).length;
            return (
              <article key={registry.id} className="group relative rounded-lg border border-[#DCE3EA] bg-white p-5 shadow-sm transition hover:border-[#0F6CBD] hover:shadow-md">
                <button
                  type="button"
                  onClick={() => navigate(`/tools/registry-sign/${registry.id}`)}
                  className="block w-full rounded-md text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F6CBD] focus-visible:ring-offset-2"
                  aria-label={`${registry.title} 등록부 열기`}
                >
                  <div className="flex items-start justify-between gap-4 pr-8">
                    <span className={`rounded-md px-2.5 py-1 text-xs font-bold ${registry.status === 'open' ? 'bg-[#E6F4EA] text-[#126B32]' : 'bg-[#EEF1F4] text-[#526174]'}`}>
                      {registry.status === 'open' ? '수합 중' : '종료'}
                    </span>
                    <span className="text-xs font-semibold text-[#526174]">{registry.mode === 'fixed' ? '사전 명단' : '현장 입력'}</span>
                  </div>
                  <h2 className="mt-4 line-clamp-2 min-h-12 text-lg font-bold text-[#0F172A]">{registry.title}</h2>
                  <div className="mt-4 space-y-2 text-sm text-[#526174]">
                    <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4" />{registry.leftHeader || '일시 미입력'}</p>
                    <p className="flex items-center gap-2"><MapPin className="h-4 w-4" />{registry.rightHeader || '장소 미입력'}</p>
                  </div>
                  <div className="mt-5 flex items-center justify-between border-t border-[#EEF1F4] pt-4">
                    <span className="flex items-center gap-2 text-sm font-semibold text-[#334155]"><Users className="h-4 w-4 text-[#0F6CBD]" />{signedCount}/{registry.participants.length}명 서명</span>
                    <span className="text-xs font-bold text-[#0F6CBD]">관리하기</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDelete(registry)}
                  className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-[#FEF3F2] hover:text-[#B42318]"
                  aria-label={`${registry.title} 삭제`}
                  title="등록부 삭제"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </article>
            );
          })}
        </div>
      )}

      {pendingDelete ? (
        <RegistryConfirmDialog
          title="등록부를 삭제할까요?"
          description={describeRegistryDeletion(pendingDelete)}
          confirmLabel={deleting ? '삭제 중' : '등록부 삭제'}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void handleDelete()}
        />
      ) : null}
    </div>
  );
}
