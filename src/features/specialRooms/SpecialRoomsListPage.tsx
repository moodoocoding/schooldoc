import { useEffect, useState } from 'react';
import { AlertCircle, CalendarClock, DoorOpen, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTeacherAuth } from '../../auth/teacherAuth';
import { RegistryConfirmDialog } from '../registry/RegistryConfirmDialog';
import { isSpecialRoomsDemoMode } from './specialRoomsConfig';
import * as service from './specialRoomsService';
import type { SpecialRoomBoard } from './types';

export function SpecialRoomsListPage() {
  const navigate = useNavigate();
  const { user } = useTeacherAuth();
  const ownerId = user?.id ?? (isSpecialRoomsDemoMode ? 'local-demo-teacher' : '');
  const [boards, setBoards] = useState<SpecialRoomBoard[]>([]);
  const [pendingDelete, setPendingDelete] = useState<SpecialRoomBoard | null>(null);
  const [actionError, setActionError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!ownerId) { setBoards([]); return; }
      try {
        const next = await service.listBoards(ownerId);
        if (active) { setBoards(next); setActionError(''); }
      } catch (error) {
        if (active) setActionError(error instanceof Error ? error.message : '예약판을 불러오지 못했습니다.');
      }
    };
    void load();
    const stop = service.subscribeSpecialRooms(() => void load());
    return () => { active = false; stop(); };
  }, [ownerId]);

  const remove = async () => {
    if (!ownerId || !pendingDelete || deleting) return;
    setDeleting(true);
    setActionError('');
    try {
      await service.deleteBoard(ownerId, pendingDelete.id);
      setPendingDelete(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '예약판을 지우지 못했습니다.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-12">
      <div className="flex flex-col gap-4 border-b border-[#DCE3EA] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold text-[#0F6CBD]">공유 예약</p>
          <h1 className="mt-1 text-2xl font-extrabold text-[#0F172A] sm:text-3xl">특별실 예약</h1>
          <p className="mt-2 text-sm text-[#526174]">예약판을 만들고 링크를 뿌리면 교직원이 시간표에서 바로 잡습니다.</p>
        </div>
        <button type="button" onClick={() => navigate('/tools/special-rooms/new')} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#0F6CBD] px-5 text-sm font-bold text-white hover:bg-[#0B5B9F]">
          <Plus className="h-4 w-4" />새 예약판
        </button>
      </div>

      {actionError ? <p role="alert" className="border-y border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-[#B42318]"><AlertCircle className="mr-1 inline h-4 w-4" />{actionError}</p> : null}

      {boards.length === 0 ? (
        <div className="border-y border-[#DCE3EA] bg-white py-20 text-center">
          <CalendarClock className="mx-auto h-9 w-9 text-[#94A3B8]" />
          <h2 className="mt-4 text-lg font-bold">아직 예약판이 없습니다</h2>
          <p className="mt-2 text-sm text-[#526174]">특별실 목록을 넣어 첫 예약판을 만들어 보세요.</p>
          <button type="button" onClick={() => navigate('/tools/special-rooms/new')} className="mt-5 min-h-[44px] rounded-lg border border-[#0F6CBD] px-5 text-sm font-bold text-[#0F6CBD] hover:bg-[#EFF6FC]">첫 예약판 만들기</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {boards.map((board) => (
            <article key={board.id} className="relative rounded-lg border border-[#DCE3EA] bg-white p-5 shadow-sm hover:border-[#0F6CBD]">
              <button type="button" onClick={() => navigate(`/tools/special-rooms/${board.id}`)} className="block w-full text-left">
                <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-bold ${board.status === 'open' ? 'bg-[#E6F4EA] text-[#126B32]' : 'bg-[#EEF1F4] text-[#526174]'}`}>
                  {board.status === 'open' ? '예약 중' : '종료'}
                </span>
                <h2 className="mt-4 min-h-12 line-clamp-2 text-lg font-bold text-[#0F172A]">{board.title}</h2>
                <p className="mt-3 flex items-center gap-2 text-sm text-[#526174]">
                  <DoorOpen className="h-4 w-4" />특별실 {board.rooms.length}곳 · 예약 {board.bookings.length}건
                </p>
              </button>
              <button type="button" onClick={() => setPendingDelete(board)} aria-label={`${board.title} 삭제`} title="삭제" className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-[#FEF3F2] hover:text-[#B42318]">
                <Trash2 className="h-4 w-4" />
              </button>
            </article>
          ))}
        </div>
      )}

      {pendingDelete ? (
        <RegistryConfirmDialog
          title={`“${pendingDelete.title}” 예약판을 지울까요?`}
          description={`특별실 ${pendingDelete.rooms.length}곳과 예약 ${pendingDelete.bookings.length}건이 함께 사라집니다. 지운 뒤에는 되돌릴 수 없고 배부한 링크도 열리지 않습니다.`}
          confirmLabel={deleting ? '지우는 중' : '영구 삭제'}
          onCancel={() => { if (!deleting) setPendingDelete(null); }}
          onConfirm={() => void remove()}
        />
      ) : null}
    </div>
  );
}
