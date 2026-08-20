import { useState } from 'react';
import {
  ArrowLeft,
  Check,
  Clock3,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Link2,
  MessageSquareText,
  QrCode,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTeacherAuth } from '../../auth/teacherAuth';
import { getStudentResultsPublicOrigin, studentResultsOwnerId } from './studentResultsConfig';
import {
  regenerateStudentResultPersonalToken,
  replyToStudentDispute,
  setStudentResultEventStatus,
} from './studentResultsService';
import { resultStatusLabel } from './studentResultsUtils';
import { StudentResultConfirmDialog } from './StudentResultConfirmDialog';
import { useStudentResultEvent } from './useStudentResults';

type ManageView = 'status' | 'access';
type StatusFilter = 'all' | 'unviewed' | 'viewed' | 'confirmed' | 'disputed' | 'reconfirm';

const statusStyle = (status: string) => ({
  confirmed: 'bg-[#E6F4EA] text-[#126B32]',
  disputed: 'bg-[#FEF3F2] text-[#B42318]',
  reconfirm: 'bg-[#FFF7E6] text-[#8A4B08]',
  viewed: 'bg-[#EFF6FC] text-[#0F6CBD]',
}[status] ?? 'bg-[#EEF1F4] text-[#526174]');

const activityAt = (recipient: {
  viewedAt?: string;
  confirmedAt?: string;
  dispute?: { submittedAt: string; repliedAt?: string };
}) => recipient.dispute?.repliedAt
  ?? recipient.dispute?.submittedAt
  ?? recipient.confirmedAt
  ?? recipient.viewedAt;

const formatActivityAt = (value?: string) => value
  ? new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
  : '활동 없음';

export function StudentResultsManagePage() {
  const navigate = useNavigate();
  const { resultId } = useParams();
  const { user } = useTeacherAuth();
  const ownerId = studentResultsOwnerId(user?.id);
  const { data: event, loading, error, refresh } = useStudentResultEvent(resultId);
  const [view, setView] = useState<ManageView>('status');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState('');
  const [notice, setNotice] = useState('');
  const [reply, setReply] = useState<Record<string, string>>({});
  const [visibleCodes, setVisibleCodes] = useState<Set<string>>(new Set());
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<Set<string>>(new Set());
  const [pendingTokenReset, setPendingTokenReset] = useState<{ id: string; name: string } | null>(null);
  const [pending, setPending] = useState('');
  const [actionError, setActionError] = useState('');

  if (loading) return <div className="py-20 text-center text-sm font-semibold text-[#526174]">결과 안내를 불러오는 중입니다.</div>;
  if (!event) {
    return (
      <div className="py-20 text-center">
        <p className="font-bold">{error || '결과 안내를 찾을 수 없습니다.'}</p>
        <button type="button" onClick={() => navigate('/tools/student-results')} className="mt-4 text-sm font-bold text-[#0F6CBD]">목록으로</button>
      </div>
    );
  }

  const publicLink = `${getStudentResultsPublicOrigin()}/s/results/${event.publicToken}`;
  const keyword = query.trim().toLocaleLowerCase('ko-KR');
  const matchesQuery = (name: string, studentKey: string) => !keyword
    || name.toLocaleLowerCase('ko-KR').includes(keyword)
    || studentKey.toLocaleLowerCase('ko-KR').includes(keyword);
  const visibleStatusRecipients = event.recipients.filter((recipient) => (
    (statusFilter === 'all' || recipient.status === statusFilter)
    && matchesQuery(recipient.name, recipient.studentKey)
  ));
  const visibleAccessRecipients = event.recipients.filter((recipient) => matchesQuery(recipient.name, recipient.studentKey));
  const counts = Object.fromEntries(
    ['unviewed', 'viewed', 'confirmed', 'disputed', 'reconfirm'].map((status) => [
      status,
      event.recipients.filter((recipient) => recipient.status === status).length,
    ]),
  );
  const allVisibleSelected = visibleAccessRecipients.length > 0
    && visibleAccessRecipients.every((recipient) => selectedRecipientIds.has(recipient.id));

  const copy = async (value: string, key: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setNotice(successMessage);
      window.setTimeout(() => setCopied(''), 1600);
    } catch {
      setNotice('복사하지 못했습니다. 브라우저 권한을 확인한 뒤 다시 시도해 주세요.');
    }
  };
  const toggleVisibleCode = (recipientId: string) => setVisibleCodes((current) => {
    const next = new Set(current);
    if (next.has(recipientId)) next.delete(recipientId);
    else next.add(recipientId);
    return next;
  });
  const toggleRecipient = (recipientId: string) => setSelectedRecipientIds((current) => {
    const next = new Set(current);
    if (next.has(recipientId)) next.delete(recipientId);
    else next.add(recipientId);
    return next;
  });
  const toggleAllVisible = () => setSelectedRecipientIds((current) => {
    const next = new Set(current);
    visibleAccessRecipients.forEach((recipient) => {
      if (allVisibleSelected) next.delete(recipient.id);
      else next.add(recipient.id);
    });
    return next;
  });
  const openSelectedPdf = () => {
    const params = new URLSearchParams();
    event.recipients.forEach((recipient) => {
      if (selectedRecipientIds.has(recipient.id)) params.append('recipient', recipient.id);
    });
    navigate(`/tools/student-results/${event.id}/qr-print?${params.toString()}`);
  };
  /**
   * 서버를 부르는 동작은 모두 여기를 지난다.
   * 실패하면 화면에 알리고, 끝날 때까지 다른 동작을 막아 같은 요청이 두 번 나가지 않게 한다.
   */
  const run = async (key: string, action: () => Promise<void>, failureMessage: string) => {
    if (pending || !ownerId) return;
    setPending(key);
    setActionError('');
    try {
      await action();
      await refresh();
      return true;
    } catch (runError) {
      setActionError(runError instanceof Error ? runError.message : failureMessage);
      return false;
    } finally {
      setPending('');
    }
  };
  const toggleEventStatus = () => {
    const next = event.status === 'open' ? 'closed' : 'open';
    void run(
      'status',
      () => setStudentResultEventStatus(ownerId, event.id, next),
      next === 'closed' ? '안내를 종료하지 못했습니다.' : '안내를 다시 열지 못했습니다.',
    );
  };
  const resetPersonalToken = async () => {
    if (!pendingTokenReset) return;
    const target = pendingTokenReset;
    const done = await run(
      'token',
      () => regenerateStudentResultPersonalToken(ownerId, event.id, target.id),
      '개인 링크를 재발급하지 못했습니다.',
    );
    if (!done) return;
    setNotice(`${target.name} 학생의 개인 링크를 재발급했습니다.`);
    setPendingTokenReset(null);
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-12">
      <header className="border-b border-[#DCE3EA] pb-5">
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={() => navigate('/tools/student-results')} className="inline-flex min-h-[40px] items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[#334155] hover:bg-white hover:text-[#0F6CBD]"><ArrowLeft className="h-5 w-5" />목록으로</button>
          <button type="button" disabled={pending !== ''} onClick={toggleEventStatus} className="min-h-[40px] shrink-0 rounded-lg border border-[#C8D0DA] bg-white px-4 text-xs font-bold disabled:cursor-wait disabled:text-[#94A3B8]">{pending === 'status' ? '처리 중' : event.status === 'open' ? '안내 종료' : '안내 다시 열기'}</button>
        </div>
        <div className="mt-4 max-w-5xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-md px-2.5 py-1 text-xs font-bold ${event.status === 'open' ? 'bg-[#E6F4EA] text-[#126B32]' : 'bg-[#EEF1F4] text-[#526174]'}`}>{event.status === 'open' ? '안내 중' : '종료'}</span>
            <span className="text-xs text-[#64748B]">보호된 학생 데이터</span>
          </div>
          <h1 className="mt-2 break-words text-xl font-extrabold leading-snug text-[#0F172A] sm:text-2xl">{event.title}</h1>
          {event.description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-[#526174]">{event.description}</p> : null}
        </div>
      </header>

      <div role="tablist" aria-label="학생 결과 관리 보기" className="inline-grid grid-cols-2 rounded-lg border border-[#C8D0DA] bg-white p-1">
        <button type="button" role="tab" aria-selected={view === 'status'} onClick={() => setView('status')} className={`min-h-[40px] rounded-md px-5 text-sm font-bold ${view === 'status' ? 'bg-[#0F6CBD] text-white' : 'text-[#526174] hover:bg-[#F6F8FB]'}`}>현황</button>
        <button type="button" role="tab" aria-selected={view === 'access'} onClick={() => setView('access')} className={`min-h-[40px] rounded-md px-5 text-sm font-bold ${view === 'access' ? 'bg-[#0F6CBD] text-white' : 'text-[#526174] hover:bg-[#F6F8FB]'}`}>접속 정보</button>
      </div>

      {actionError ? <p role="alert" className="border-y border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-[#B42318]">{actionError}</p> : null}
      {notice ? <p role="status" aria-live="polite" className="border-y border-[#B9D9F2] bg-[#EFF6FC] px-4 py-3 text-sm font-semibold text-[#0F6CBD]">{notice}</p> : null}

      {view === 'status' ? (
        <>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ['all', '전체', event.recipients.length],
              ['unviewed', '미조회', counts.unviewed],
              ['viewed', '조회함', counts.viewed],
              ['confirmed', '확인 완료', counts.confirmed],
              ['disputed', '이의 접수', counts.disputed],
              ['reconfirm', '재확인 필요', counts.reconfirm],
            ].map(([key, label, count]) => (
              <button key={String(key)} type="button" aria-pressed={statusFilter === key} onClick={() => setStatusFilter(key as StatusFilter)} className={`min-h-[84px] border p-3 text-left ${statusFilter === key ? 'border-[#0F6CBD] bg-[#EFF6FC]' : 'border-[#DCE3EA] bg-white hover:border-[#8ABBE0]'}`}>
                <span className="text-xs font-semibold text-[#526174]">{label}</span><span className="mt-2 block text-2xl font-extrabold">{count}</span>
              </button>
            ))}
          </section>

          <section className="border-y border-[#DCE3EA] bg-white">
            <div className="flex flex-col gap-3 border-b border-[#DCE3EA] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div><div className="flex items-center gap-2"><Users className="h-5 w-5 text-[#0F6CBD]" /><h2 className="font-bold">학생 현황 ({visibleStatusRecipients.length}명)</h2></div><p className="mt-1 text-xs text-[#64748B]">조회 상태와 이의 처리에 필요한 정보만 표시합니다.</p></div>
              <label className="relative block sm:w-72"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#94A3B8]" /><span className="sr-only">학생 검색</span><input value={query} onChange={(changeEvent) => setQuery(changeEvent.target.value)} className="min-h-[40px] w-full rounded-lg border border-[#C8D0DA] pl-9 pr-3 text-sm" placeholder="성명 또는 식별값 검색" /></label>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full border-collapse text-sm">
                <thead><tr className="bg-[#F6F8FB] text-left text-xs text-[#526174]"><th className="border-b border-[#DCE3EA] p-3">학생</th>{event.columns.map((column) => <th key={column.id} className="border-b border-[#DCE3EA] p-3">{column.label}</th>)}<th className="border-b border-[#DCE3EA] p-3">상태</th><th className="border-b border-[#DCE3EA] p-3">마지막 활동</th><th className="border-b border-[#DCE3EA] p-3">이의 처리</th></tr></thead>
                <tbody>{visibleStatusRecipients.map((recipient) => (
                  <tr key={recipient.id} className="align-top">
                    <td className="border-b border-[#EEF1F4] p-3"><strong className="block">{recipient.name}</strong><span className="mt-1 block text-xs text-[#64748B]">{recipient.studentKey}</span></td>
                    {event.columns.map((column) => <td key={column.id} className="border-b border-[#EEF1F4] p-3">{recipient.values[column.id]} / {column.maxScore}</td>)}
                    <td className="border-b border-[#EEF1F4] p-3"><span className={`inline-flex rounded-md px-2 py-1 text-xs font-bold ${statusStyle(recipient.status)}`}>{resultStatusLabel(recipient.status)}</span></td>
                    <td className="border-b border-[#EEF1F4] p-3 text-xs text-[#526174]"><Clock3 className="mr-1 inline h-3.5 w-3.5" />{formatActivityAt(activityAt(recipient))}</td>
                    <td className="border-b border-[#EEF1F4] p-3">
                      {recipient.dispute ? <div className="max-w-sm"><p className="text-xs text-[#334155]"><MessageSquareText className="mr-1 inline h-3.5 w-3.5" />{recipient.dispute.message}</p>{recipient.dispute.teacherReply ? <p className="mt-2 text-xs font-semibold text-[#0F6CBD]">답변: {recipient.dispute.teacherReply}</p> : <div className="mt-2 flex gap-2"><input value={reply[recipient.id] ?? ''} onChange={(changeEvent) => setReply((current) => ({ ...current, [recipient.id]: changeEvent.target.value }))} className="min-h-[36px] min-w-0 flex-1 rounded-md border border-[#C8D0DA] px-2 text-xs" placeholder="교사 답변" /><button type="button" disabled={!reply[recipient.id]?.trim() || pending !== ''} onClick={() => void run(`reply:${recipient.id}`, () => replyToStudentDispute(ownerId, event.id, recipient.id, reply[recipient.id]), '답변을 저장하지 못했습니다.')} aria-label={`${recipient.name} 학생의 이의에 답변`} className="shrink-0 rounded-md bg-[#0F6CBD] px-3 text-xs font-bold text-white disabled:opacity-40">{pending === `reply:${recipient.id}` ? '저장 중' : '답변'}</button></div>}</div> : <span className="text-xs text-[#94A3B8]">없음</span>}
                    </td>
                  </tr>
                ))}</tbody>
              </table>
              {visibleStatusRecipients.length === 0 ? <div className="px-4 py-12 text-center text-sm text-[#64748B]">조건에 맞는 학생이 없습니다. 검색어나 상태 필터를 변경해 주세요.</div> : null}
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="border-y border-[#F5D08A] bg-[#FFF9ED] px-4 py-4 sm:px-6">
            <div className="flex items-start gap-3"><KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-[#8A4B08]" /><div><h2 className="text-sm font-bold text-[#5F3D08]">접속 정보는 본인 확인 수단입니다</h2><p className="mt-1 text-xs leading-5 text-[#76520E]">확인번호, 개인 링크와 QR은 학생 본인에게만 전달하세요. 개인 링크를 재발급하면 이전 링크는 즉시 사용할 수 없습니다.</p></div></div>
          </section>

          <section className="border-y border-[#DCE3EA] bg-white px-4 py-5 sm:px-6">
            <div className="flex items-center gap-2"><Link2 className="h-5 w-5 text-[#0F6CBD]" /><h2 className="font-bold">공용 조회 링크</h2></div>
            <p className="mt-2 text-xs leading-5 text-[#64748B]">공용 링크에서는 학생이 성명과 확인번호를 입력합니다.</p>
            <div className="mt-4 flex gap-2"><input readOnly value={publicLink} className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-[#C8D0DA] bg-[#F6F8FB] px-3 text-xs text-[#334155]" /><button type="button" onClick={() => void copy(publicLink, 'public', '공용 조회 링크를 복사했습니다.')} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#C8D0DA] text-[#0F6CBD]" aria-label="공용 링크 복사" title="링크 복사">{copied === 'public' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</button><a href={publicLink} target="_blank" rel="noreferrer" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#C8D0DA] text-[#0F6CBD]" aria-label="학생 화면 열기" title="새 창에서 열기"><ExternalLink className="h-4 w-4" /></a></div>
          </section>

          <section className="border-y border-[#DCE3EA] bg-white">
            <div className="flex flex-col gap-4 border-b border-[#DCE3EA] px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
              <div><h2 className="font-bold">학생별 접속 정보</h2><p className="mt-1 text-xs text-[#64748B]">{selectedRecipientIds.size}명 선택 · 확인번호는 기본으로 가려집니다.</p></div>
              <div className="flex flex-col gap-2 sm:flex-row"><label className="relative block sm:w-64"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#94A3B8]" /><span className="sr-only">접속 정보 학생 검색</span><input value={query} onChange={(changeEvent) => setQuery(changeEvent.target.value)} className="min-h-[40px] w-full rounded-lg border border-[#C8D0DA] pl-9 pr-3 text-sm" placeholder="성명 또는 식별값 검색" /></label><button type="button" disabled={selectedRecipientIds.size === 0} onClick={openSelectedPdf} className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg bg-[#0F6CBD] px-4 text-xs font-bold text-white disabled:bg-[#AAB7C4]"><QrCode className="h-4 w-4" />선택 QR PDF ({selectedRecipientIds.size}명)</button></div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[880px] w-full border-collapse text-sm">
                <thead><tr className="bg-[#F6F8FB] text-left text-xs text-[#526174]"><th className="border-b border-[#DCE3EA] p-3"><input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} className="h-4 w-4" aria-label="검색 결과 학생 전체 선택" /></th><th className="border-b border-[#DCE3EA] p-3">학생</th><th className="border-b border-[#DCE3EA] p-3">확인번호</th><th className="border-b border-[#DCE3EA] p-3">개인 링크</th><th className="border-b border-[#DCE3EA] p-3">링크 재발급</th></tr></thead>
                <tbody>{visibleAccessRecipients.map((recipient) => {
                  const personalLink = `${publicLink}?recipient=${recipient.personalToken}`;
                  const isCodeVisible = visibleCodes.has(recipient.id);
                  const codeCopyKey = `code:${recipient.id}`;
                  const linkCopyKey = `link:${recipient.id}`;
                  return <tr key={recipient.id}><td className="border-b border-[#EEF1F4] p-3"><input type="checkbox" checked={selectedRecipientIds.has(recipient.id)} onChange={() => toggleRecipient(recipient.id)} className="h-4 w-4" aria-label={`${recipient.name} 선택`} /></td><td className="border-b border-[#EEF1F4] p-3"><strong className="block">{recipient.name}</strong><span className="mt-1 block text-xs text-[#64748B]">{recipient.studentKey}</span></td><td className="border-b border-[#EEF1F4] p-3"><div className="flex items-center gap-1"><span className="min-w-14 font-mono font-bold tabular-nums">{isCodeVisible ? recipient.verificationCode : '••••'}</span><button type="button" onClick={() => toggleVisibleCode(recipient.id)} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-[#64748B] hover:bg-[#EFF6FC] hover:text-[#0F6CBD]" aria-label={`${recipient.name} 확인번호 ${isCodeVisible ? '숨기기' : '보기'}`} title={isCodeVisible ? '확인번호 숨기기' : '확인번호 보기'}>{isCodeVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button><button type="button" onClick={() => void copy(recipient.verificationCode, codeCopyKey, `${recipient.name} 학생의 확인번호를 복사했습니다.`)} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-[#64748B] hover:bg-[#EFF6FC] hover:text-[#0F6CBD]" aria-label={`${recipient.name} 확인번호 복사`} title="확인번호 복사">{copied === codeCopyKey ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</button></div></td><td className="border-b border-[#EEF1F4] p-3"><button type="button" onClick={() => void copy(personalLink, linkCopyKey, `${recipient.name} 학생의 개인 링크를 복사했습니다.`)} className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-[#C8D0DA] px-3 text-xs font-bold text-[#0F6CBD]">{copied === linkCopyKey ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{recipient.name} 개인 링크 복사</button></td><td className="border-b border-[#EEF1F4] p-3"><button type="button" onClick={() => setPendingTokenReset({ id: recipient.id, name: recipient.name })} aria-label={`${recipient.name} 학생의 개인 링크 재발급`} className="inline-flex min-h-[40px] items-center gap-2 rounded-lg px-3 text-xs font-bold text-[#B42318] hover:bg-[#FEF2F2]"><RefreshCw className="h-4 w-4" />재발급</button></td></tr>;
                })}</tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {pendingTokenReset ? <StudentResultConfirmDialog title={`${pendingTokenReset.name} 학생의 링크를 재발급할까요?`} description="기존 개인 링크와 QR은 즉시 사용할 수 없게 됩니다. 새 링크나 QR을 학생에게 다시 전달해야 합니다." confirmLabel={pending === 'token' ? '재발급 중' : '링크 재발급'} onCancel={() => setPendingTokenReset(null)} onConfirm={() => void resetPersonalToken()} /> : null}
    </div>
  );
}
