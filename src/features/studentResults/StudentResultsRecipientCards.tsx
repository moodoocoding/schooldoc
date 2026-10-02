import { Check, Clock3, Copy, Eye, EyeOff, MessageSquareText, RefreshCw } from 'lucide-react';
import { resultStatusLabel } from './studentResultsUtils';
import type { ResultRecipient, StudentResultEvent } from './types';

const statusStyle = (status: string) => ({
  confirmed: 'bg-[#E6F4EA] text-[#126B32]',
  disputed: 'bg-[#FEF3F2] text-[#B42318]',
  reconfirm: 'bg-[#FFF7E6] text-[#8A4B08]',
  replied: 'bg-[#E6F4EA] text-[#126B32]',
  viewed: 'bg-[#EFF6FC] text-[#0F6CBD]',
}[status] ?? 'bg-[#EEF1F4] text-[#526174]');

export function StudentResultsStatusBadge({ status }: { status: ResultRecipient['status'] }) {
  return <span className={`inline-flex rounded-md px-2 py-1 text-xs font-bold ${statusStyle(status)}`}>{resultStatusLabel(status)}</span>;
}

interface StatusCardsProps {
  event: StudentResultEvent;
  recipients: ResultRecipient[];
  reply: Record<string, string>;
  editingReplyId: string | null;
  pending: string;
  formatActivity: (recipient: ResultRecipient) => string;
  onCorrect: (recipient: ResultRecipient) => void;
  onReplyChange: (recipientId: string, value: string) => void;
  onReplySave: (recipient: ResultRecipient) => void;
  onReplyEdit: (recipient: ResultRecipient) => void;
  onReplyCancel: () => void;
}

export function StudentResultsStatusCards({
  event, recipients, reply, editingReplyId, pending, formatActivity,
  onCorrect, onReplyChange, onReplySave, onReplyEdit, onReplyCancel,
}: StatusCardsProps) {
  return (
    <div data-testid="student-results-status-cards" className="space-y-3 p-4">
      {recipients.map((recipient) => (
        <article key={recipient.id} aria-label={`${recipient.name} 학생 현황`} className="min-w-0 rounded-xl border border-[#DCE3EA] p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="break-words font-bold text-[#0F172A]">{recipient.name}</h3>
              <p className="mt-1 break-all text-sm text-[#526174]">{recipient.studentKey}</p>
            </div>
            <StudentResultsStatusBadge status={recipient.status} />
          </div>
          <p className="mt-3 text-xs text-[#526174]"><Clock3 aria-hidden="true" className="mr-1 inline h-3.5 w-3.5" />마지막 활동 · {formatActivity(recipient)}</p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-[#EEF1F4] py-3">
            {event.columns.map((column) => (
              <div key={column.id} className="min-w-0">
                <dt className="break-words text-xs font-semibold text-[#526174]">{column.label}</dt>
                <dd className="mt-1 break-words text-sm font-bold text-[#0F172A]">{recipient.values[column.id]} / {column.maxScore}</dd>
              </div>
            ))}
          </dl>
          {recipient.feedback ? <details className="mt-2 text-sm"><summary className="min-h-[44px] cursor-pointer py-3 font-semibold text-[#334155]">교사 의견 보기</summary><p className="whitespace-pre-wrap break-words pb-3 leading-6 text-[#526174]">{recipient.feedback}</p></details> : null}
          <button type="button" disabled={pending !== ''} onClick={() => onCorrect(recipient)} aria-label={`${recipient.name} 학생 결과 정정`} className="mt-3 min-h-[44px] w-full rounded-lg border border-[#C8D0DA] px-3 text-sm font-bold text-[#0F6CBD] hover:bg-[#EFF6FC] disabled:opacity-50">점수·피드백 수정</button>
          {recipient.dispute ? (
            <section className="mt-4 border-t border-[#DCE3EA] pt-4" aria-label={`${recipient.name} 학생 이의 처리`}>
              <h4 className="flex items-center gap-2 text-sm font-bold text-[#334155]"><MessageSquareText aria-hidden="true" className="h-4 w-4 shrink-0" />학생 이의 내용</h4>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[#334155]">{recipient.dispute.message}</p>
              {recipient.dispute.teacherReply ? <p className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-[#EFF6FC] p-3 text-sm leading-6 text-[#0F6CBD]">답변: {recipient.dispute.teacherReply}</p> : null}
              {!recipient.dispute.teacherReply || editingReplyId === recipient.id ? (
                <div className="mt-3 space-y-2">
                  <label className="block text-sm font-semibold text-[#334155]">교사 답변<textarea value={reply[recipient.id] ?? ''} onChange={(changeEvent) => onReplyChange(recipient.id, changeEvent.target.value)} rows={3} className="mt-2 min-h-[88px] w-full rounded-lg border border-[#C8D0DA] p-3 text-sm font-normal" placeholder="교사 답변" aria-label={`${recipient.name} 학생에게 보낼 답변`} /></label>
                  <div className="flex gap-2">
                    <button type="button" disabled={!reply[recipient.id]?.trim() || pending !== ''} onClick={() => onReplySave(recipient)} aria-label={`${recipient.name} 학생의 이의에 답변`} className="min-h-[44px] flex-1 rounded-lg bg-[#0F6CBD] px-4 text-sm font-bold text-white disabled:opacity-40">{pending === `reply:${recipient.id}` ? '저장 중' : editingReplyId === recipient.id ? '수정 저장' : '답변'}</button>
                    {editingReplyId === recipient.id ? <button type="button" disabled={pending !== ''} onClick={onReplyCancel} className="min-h-[44px] rounded-lg border border-[#C8D0DA] px-4 text-sm font-semibold text-[#526174]">취소</button> : null}
                  </div>
                </div>
              ) : <button type="button" disabled={pending !== ''} onClick={() => onReplyEdit(recipient)} className="mt-2 min-h-[44px] rounded-lg px-3 text-sm font-bold text-[#0F6CBD] hover:bg-[#EFF6FC] disabled:opacity-50">답변 수정</button>}
            </section>
          ) : null}
        </article>
      ))}
    </div>
  );
}

interface AccessCardsProps {
  recipients: ResultRecipient[];
  selectedRecipientIds: ReadonlySet<string>;
  visibleCodes: ReadonlySet<string>;
  allVisibleSelected: boolean;
  copied: string;
  pending: string;
  onSelect: (recipientId: string) => void;
  onSelectAll: () => void;
  onToggleCode: (recipientId: string) => void;
  onCopyCode: (recipient: ResultRecipient) => void;
  onCopyLink: (recipient: ResultRecipient) => void;
  onResetLink: (recipient: ResultRecipient) => void;
}

export function StudentResultsAccessCards({
  recipients, selectedRecipientIds, visibleCodes, allVisibleSelected, copied, pending,
  onSelect, onSelectAll, onToggleCode, onCopyCode, onCopyLink, onResetLink,
}: AccessCardsProps) {
  return (
    <div data-testid="student-results-access-cards" className="space-y-3 p-4">
      <label className="flex min-h-[44px] items-center gap-3 text-sm font-semibold text-[#334155]"><input type="checkbox" checked={allVisibleSelected} disabled={recipients.length === 0} onChange={onSelectAll} className="h-5 w-5 shrink-0" aria-label="검색 결과 학생 전체 선택" />검색 결과 학생 전체 선택</label>
      {recipients.map((recipient) => {
        const selected = selectedRecipientIds.has(recipient.id);
        const isCodeVisible = visibleCodes.has(recipient.id);
        return (
          <article key={recipient.id} aria-label={`${recipient.name} 접속 정보`} className={`min-w-0 rounded-xl border p-4 ${selected ? 'border-[#0F6CBD] bg-[#EFF6FC]' : 'border-[#DCE3EA] bg-white'}`}>
            <div className="flex items-start gap-3">
              <label className="flex h-11 w-11 shrink-0 items-center justify-center"><input type="checkbox" checked={selected} onChange={() => onSelect(recipient.id)} className="h-5 w-5" aria-label={`${recipient.name} 선택`} /></label>
              <div className="min-w-0 pt-1"><h3 className="break-words font-bold text-[#0F172A]">{recipient.name}</h3><p className="mt-1 break-all text-sm text-[#526174]">{recipient.studentKey}</p></div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-y border-[#DCE3EA] py-2">
              <div className="min-w-0"><p className="text-xs font-semibold text-[#526174]">확인번호</p><p className="mt-1 break-all font-mono text-sm font-bold tabular-nums">{isCodeVisible ? recipient.verificationCode : '••••'}</p></div>
              <div className="flex shrink-0 gap-1">
                <button type="button" onClick={() => onToggleCode(recipient.id)} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-[#526174] hover:bg-white hover:text-[#0F6CBD]" aria-label={`${recipient.name} 확인번호 ${isCodeVisible ? '숨기기' : '보기'}`} title={isCodeVisible ? '확인번호 숨기기' : '확인번호 보기'}>{isCodeVisible ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}</button>
                <button type="button" onClick={() => onCopyCode(recipient)} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-[#526174] hover:bg-white hover:text-[#0F6CBD]" aria-label={`${recipient.name} 확인번호 복사`} title="확인번호 복사">{copied === `code:${recipient.id}` ? <Check aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}</button>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              <button type="button" onClick={() => onCopyLink(recipient)} className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-[#C8D0DA] bg-white px-3 text-sm font-bold text-[#0F6CBD]" aria-label={`${recipient.name} 개인 링크 복사`}>{copied === `link:${recipient.id}` ? <Check aria-hidden="true" className="h-4 w-4 shrink-0" /> : <Copy aria-hidden="true" className="h-4 w-4 shrink-0" />}개인 링크 복사</button>
              <button type="button" disabled={pending !== ''} onClick={() => onResetLink(recipient)} aria-label={`${recipient.name} 학생의 개인 링크 재발급`} className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold text-[#B42318] hover:bg-[#FEF2F2] disabled:opacity-50"><RefreshCw aria-hidden="true" className="h-4 w-4 shrink-0" />개인 링크 재발급</button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
