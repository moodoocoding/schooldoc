import { useState } from 'react';
import { AlertCircle, ArrowLeft, BarChart3, CalendarDays, LoaderCircle, Plus, Trash2, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTeacherAuth } from '../../auth/teacherAuth';
import { deleteStudentResultEvent } from './studentResultsService';
import { studentResultsOwnerId } from './studentResultsConfig';
import { resultStatusLabel } from './studentResultsUtils';
import { StudentResultConfirmDialog } from './StudentResultConfirmDialog';
import { useStudentResultEvents } from './useStudentResults';

interface PendingDelete {
  id: string;
  title: string;
  recipientCount: number;
  disputeCount: number;
}

/** 지우면 무엇이 함께 사라지는지 숫자로 밝힌다. 되돌릴 수 없는 행동이다. */
const deleteDescription = ({ recipientCount, disputeCount }: PendingDelete) => [
  `학생 ${recipientCount}명의 점수와 피드백이 함께 지워집니다.`,
  disputeCount > 0 ? `접수된 이의 ${disputeCount}건도 사라집니다.` : '',
  '지운 뒤에는 되돌릴 수 없고, 배부한 링크와 QR도 열리지 않습니다.',
].filter(Boolean).join(' ');

export function StudentResultsListPage() {
  const navigate = useNavigate();
  const { user } = useTeacherAuth();
  const { data: events, loading, error, refresh } = useStudentResultEvents();

  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const remove = async () => {
    const ownerId = studentResultsOwnerId(user?.id);
    if (!ownerId || !pendingDelete || deleting) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteStudentResultEvent(ownerId, pendingDelete.id);
      await refresh();
      setPendingDelete(null);
    } catch (removeError) {
      setDeleteError(removeError instanceof Error ? removeError.message : '결과 안내를 지우지 못했습니다.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-12">
      <div className="flex items-center justify-between border-b border-[#DCE3EA] pb-4">
        <button type="button" onClick={() => navigate('/')} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[#334155] hover:bg-white hover:text-[#0F6CBD]"><ArrowLeft className="h-5 w-5" />업무 도구로</button>
        <span className="rounded-md border border-[#DCE3EA] bg-white px-3 py-1.5 text-xs font-semibold text-[#526174]">교사 전용</span>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold text-[#0F6CBD]">개별 안내</p>
          <h1 className="mt-1 text-2xl font-extrabold text-[#0F172A] sm:text-3xl">학생 결과 안내</h1>
          <p className="mt-2 text-sm text-[#526174]">학생별 결과를 안전하게 안내하고 확인과 이의 현황을 관리합니다.</p>
        </div>
        <button type="button" onClick={() => navigate('/tools/student-results/new')} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#0F6CBD] px-5 text-sm font-bold text-white hover:bg-[#0B5B9F]"><Plus className="h-4 w-4" />새 결과 안내</button>
      </div>

      {error || deleteError ? <div role="alert" className="flex items-start gap-2 border-y border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-[#B42318]"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error || deleteError}</div> : null}
      {loading ? (
        <div className="flex min-h-52 items-center justify-center gap-2 text-sm font-semibold text-[#526174]"><LoaderCircle className="h-5 w-5 animate-spin" />결과 안내를 불러오는 중입니다.</div>
      ) : events.length === 0 ? (
        <div className="border-y border-[#DCE3EA] bg-white py-20 text-center">
          <BarChart3 className="mx-auto h-9 w-9 text-[#94A3B8]" />
          <h2 className="mt-4 text-lg font-bold">아직 결과 안내가 없습니다</h2>
          <p className="mt-2 text-sm text-[#526174]">직접 입력한 학생 자료로 첫 안내 흐름을 만들어 보세요.</p>
          <button type="button" onClick={() => navigate('/tools/student-results/new')} className="mt-5 min-h-[44px] rounded-lg border border-[#0F6CBD] px-5 text-sm font-bold text-[#0F6CBD] hover:bg-[#EFF6FC]">첫 결과 안내 만들기</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {events.map((event) => {
            const confirmed = event.recipients.filter((recipient) => recipient.status === 'confirmed').length;
            const disputed = event.recipients.filter((recipient) => recipient.status === 'disputed').length;
            return (
              <article key={event.id} className="relative rounded-lg border border-[#DCE3EA] bg-white p-5 shadow-sm hover:border-[#0F6CBD] hover:shadow-md">
                <button type="button" onClick={() => navigate(`/tools/student-results/${event.id}`)} className="block w-full text-left">
                  <div className="flex items-center justify-between gap-3 pr-8"><span className={`rounded-md px-2.5 py-1 text-xs font-bold ${event.status === 'open' ? 'bg-[#E6F4EA] text-[#126B32]' : 'bg-[#EEF1F4] text-[#526174]'}`}>{event.status === 'open' ? '안내 중' : '종료'}</span>{disputed > 0 ? <span className="text-xs font-bold text-[#B42318]">이의 {disputed}건</span> : null}</div>
                  <h2 className="mt-4 min-h-12 line-clamp-2 text-lg font-bold text-[#0F172A]">{event.title}</h2>
                  <div className="mt-4 space-y-2 text-sm text-[#526174]"><p className="flex items-center gap-2"><CalendarDays className="h-4 w-4" />{new Date(event.createdAt).toLocaleDateString('ko-KR')}</p><p className="flex items-center gap-2"><Users className="h-4 w-4" />{event.recipients.length}명 · 확인 {confirmed}명</p></div>
                  <div className="mt-5 flex items-center justify-between border-t border-[#EEF1F4] pt-4"><span className="text-xs font-semibold text-[#526174]">최근 상태: {resultStatusLabel(event.recipients.at(-1)?.status ?? 'unviewed')}</span><span className="text-xs font-bold text-[#0F6CBD]">현황 보기</span></div>
                </button>
                <button type="button" onClick={() => setPendingDelete({ id: event.id, title: event.title, recipientCount: event.recipients.length, disputeCount: disputed })} className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-[#FEF3F2] hover:text-[#B42318]" aria-label={`${event.title} 삭제`} title="삭제"><Trash2 className="h-4 w-4" /></button>
              </article>
            );
          })}
        </div>
      )}

      {pendingDelete ? (
        <StudentResultConfirmDialog
          title={`“${pendingDelete.title}” 결과 안내를 지울까요?`}
          description={deleteDescription(pendingDelete)}
          confirmLabel={deleting ? '지우는 중' : '영구 삭제'}
          onCancel={() => { if (!deleting) { setPendingDelete(null); setDeleteError(''); } }}
          onConfirm={() => void remove()}
        />
      ) : null}
    </div>
  );
}
