import { useState } from 'react';
import { AlertCircle, CalendarOff, Plus, Trash2 } from 'lucide-react';
import {
  CLOSURE_ALL_ROOMS,
  CLOSURE_REASON_MAX,
  checkClosure,
  closureLabel,
  closureNotice,
  hiddenByClosures,
  type ClosureDraft,
} from './specialRoomsClosure';
import type { SpecialRoomBoard } from './types';

interface ClosureCardProps {
  board: SpecialRoomBoard;
  onAdd: (draft: ClosureDraft) => Promise<void>;
  onRemove: (closureId: string) => Promise<void>;
}

/**
 * 특별실을 못 쓰는 기간을 담당자가 건다.
 *
 * 담당 교사 출장·연가, 시설 점검, 시험 기간에 쓴다. 예전에는 그날 칸을 하나씩 `출장`이라고
 * 채우는 수밖에 없었는데, 8교시면 여덟 칸이고 그것도 예약으로 보일 뿐 누구나 지울 수 있었다.
 *
 * 그 기간의 예약은 **감추고 또 알린다.** 감추는 이유는 예약이 보이면 그 사람이 그날 오기
 * 때문이고, 알리는 이유는 담당자가 그 사람들에게 따로 연락해야 하기 때문이다. 이 앱에는
 * 예약한 사람에게 알릴 수단이 없다.
 */
export function ClosureCard({ board, onAdd, onRemove }: ClosureCardProps) {
  const [draft, setDraft] = useState<ClosureDraft>({
    roomId: CLOSURE_ALL_ROOMS, startDate: '', endDate: '', reason: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const roomName = (roomId: string) => board.rooms.find((room) => room.id === roomId)?.name ?? '';

  // 걸기 전에 무엇이 가려지는지 보여 준다. 누른 뒤에 알리면 늦다.
  const preview = draft.startDate && draft.endDate && draft.endDate >= draft.startDate
    ? closureNotice(hiddenByClosures(board.bookings, [{ id: 'preview', ...draft }]))
    : '';

  const submit = async () => {
    if (saving) return;
    const checked = checkClosure(draft);
    if (!checked.ok) {
      setError(checked.error);
      document.getElementById(`closure-${checked.field}`)?.focus();
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onAdd({ ...draft, reason: draft.reason.trim() });
      setDraft({ roomId: CLOSURE_ALL_ROOMS, startDate: '', endDate: '', reason: '' });
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : '휴관을 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-lg border border-[#DCE3EA] bg-white px-4 py-5 sm:px-5">
      <h2 className="flex items-center gap-2 text-base font-bold text-[#0F172A]">
        <CalendarOff className="h-4 w-4 text-[#0F6CBD]" />휴관
      </h2>
      <p className="mt-1 text-xs leading-5 text-[#526174]">
        담당 교사 출장이나 시설 점검처럼 특별실을 쓸 수 없는 날을 막습니다. 그 기간에는 아무도 예약할 수 없습니다.
      </p>

      {board.closures.length > 0 ? (
        <ul className="mt-4 divide-y divide-[#EEF1F4] border-y border-[#EEF1F4]">
          {board.closures.map((closure) => (
            <li key={closure.id} className="flex items-center justify-between gap-2 py-2">
              <span className="min-w-0 truncate text-xs font-semibold text-[#334155]">
                {closureLabel(closure, roomName(closure.roomId))}
              </span>
              <button
                type="button"
                onClick={() => void onRemove(closure.id)}
                aria-label={`${closureLabel(closure, roomName(closure.roomId))} 휴관 풀기`}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#94A3B8] hover:text-[#B42318]"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-md bg-[#F6F8FB] px-2.5 py-2 text-xs text-[#64748B]">막아 둔 날이 없습니다.</p>
      )}

      <div className="mt-4 grid gap-3">
        <label className="grid gap-1.5 text-xs font-bold text-[#334155]" htmlFor="closure-room">
          어느 특별실
          <select
            id="closure-room"
            value={draft.roomId}
            onChange={(event) => setDraft((current) => ({ ...current, roomId: event.target.value }))}
            className="min-h-[44px] w-full rounded-lg border border-[#C8D0DA] bg-white px-3 text-sm font-normal"
          >
            <option value={CLOSURE_ALL_ROOMS}>모든 특별실</option>
            {board.rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
          </select>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-xs font-bold text-[#334155]" htmlFor="closure-startDate">
            시작 날짜
            <input
              id="closure-startDate"
              type="date"
              value={draft.startDate}
              onChange={(event) => setDraft((current) => ({
                ...current,
                startDate: event.target.value,
                // 하루짜리가 흔하므로 마지막 날짜를 같이 채워 준다. 두 번 고르는 수고를 던다.
                endDate: current.endDate && current.endDate >= event.target.value ? current.endDate : event.target.value,
              }))}
              className="min-h-[44px] w-full rounded-lg border border-[#C8D0DA] px-3 text-sm font-normal"
            />
          </label>
          <label className="grid gap-1.5 text-xs font-bold text-[#334155]" htmlFor="closure-endDate">
            마지막 날짜
            <input
              id="closure-endDate"
              type="date"
              value={draft.endDate}
              min={draft.startDate || undefined}
              onChange={(event) => setDraft((current) => ({ ...current, endDate: event.target.value }))}
              className="min-h-[44px] w-full rounded-lg border border-[#C8D0DA] px-3 text-sm font-normal"
            />
          </label>
        </div>

        <label className="grid gap-1.5 text-xs font-bold text-[#334155]" htmlFor="closure-reason">
          사유 <span className="font-normal text-[#64748B]">(비워 둬도 됩니다)</span>
          <input
            id="closure-reason"
            value={draft.reason}
            maxLength={CLOSURE_REASON_MAX}
            placeholder="예: 담당 교사 출장"
            onChange={(event) => setDraft((current) => ({ ...current, reason: event.target.value }))}
            className="min-h-[44px] w-full rounded-lg border border-[#C8D0DA] px-3 text-sm font-normal"
          />
        </label>

        {preview ? (
          <p className="flex items-start gap-1.5 rounded-md bg-[#FFF7ED] px-2.5 py-2 text-xs font-semibold leading-5 text-[#9A3412]">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{preview}
          </p>
        ) : null}

        <button
          type="button"
          disabled={saving}
          onClick={() => void submit()}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 self-start rounded-lg bg-[#0F6CBD] px-4 text-sm font-bold text-white hover:bg-[#0B5B9F] disabled:bg-[#AAB7C4]"
        >
          <Plus className="h-4 w-4" />{saving ? '저장 중' : '휴관 추가'}
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-3 flex items-start gap-1.5 rounded-md bg-[#FEF2F2] px-2.5 py-2 text-xs font-semibold leading-5 text-[#B42318]">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{error}
        </p>
      ) : null}
    </section>
  );
}
