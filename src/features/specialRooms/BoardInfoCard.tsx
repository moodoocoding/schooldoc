import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, LoaderCircle, Pencil } from 'lucide-react';
import {
  DESCRIPTION_MAX,
  TITLE_MAX,
  boardInfoChanged,
  checkBoardInfo,
  type BoardInfoDraft,
} from './specialRoomsBoardInfo';
import type { SpecialRoomBoard } from './types';

interface BoardInfoCardProps {
  board: SpecialRoomBoard;
  onSave: (info: BoardInfoDraft) => Promise<void>;
}

/**
 * 제목과 안내 문구를 보고 고친다.
 *
 * 예전에는 만들 때 적은 뒤로 담당자 화면 어디에도 나오지 않았다. 안내 문구는 공개 화면에만
 * 보이므로, 적었는지조차 배부한 링크를 직접 열어 봐야 알 수 있었다. 오타 하나에 예약판을
 * 새로 만들어야 했다.
 *
 * 안내 문구는 비워도 된다. 비면 공개 화면에서 그 자리가 사라진다는 것을 옆에 적어 둔다.
 * 빈 칸을 보고 "안 적으면 안 되나" 하고 망설이지 않게 한다.
 */
export function BoardInfoCard({ board, onSave }: BoardInfoCardProps) {
  const saved: BoardInfoDraft = { title: board.title, description: board.description };
  const [draft, setDraft] = useState<BoardInfoDraft>(saved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  // 실시간 갱신으로 서버 값이 바뀌면 따라간다. 다만 적던 것을 지우면 안 되므로, 손대지
  // 않은 상태일 때만 갈아 끼운다. `seen`은 마지막으로 반영한 서버 값이다.
  const seen = useRef(saved);
  useEffect(() => {
    const next = { title: board.title, description: board.description };
    if (next.title === seen.current.title && next.description === seen.current.description) return;
    setDraft((current) => (boardInfoChanged(seen.current, current) ? current : next));
    seen.current = next;
  }, [board.title, board.description]);

  const changed = boardInfoChanged(saved, draft);

  const submit = async () => {
    if (saving || !changed) return;
    const checked = checkBoardInfo(draft);
    if (!checked.ok) {
      setError(checked.error);
      setDone(false);
      document.getElementById(`board-info-${checked.field}`)?.focus();
      return;
    }
    setSaving(true);
    setError('');
    setDone(false);
    try {
      await onSave(checked.value);
      setDraft(checked.value);
      seen.current = checked.value;
      setDone(true);
      window.setTimeout(() => setDone(false), 2400);
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : '저장하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-lg border border-[#DCE3EA] bg-white px-4 py-5 sm:px-5">
      <h2 className="flex items-center gap-2 text-base font-bold text-[#0F172A]">
        <Pencil className="h-4 w-4 text-[#0F6CBD]" />예약판 정보
      </h2>
      <p className="mt-1 text-xs leading-5 text-[#526174]">예약 화면 맨 위에 보이는 내용입니다.</p>

      <div className="mt-4 grid gap-3">
        <label className="grid gap-1.5 text-xs font-bold text-[#334155]" htmlFor="board-info-title">
          예약판 이름
          <input
            id="board-info-title"
            value={draft.title}
            maxLength={TITLE_MAX}
            onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
            className="min-h-[44px] w-full rounded-lg border border-[#C8D0DA] px-3 text-sm font-normal"
          />
        </label>

        <label className="grid gap-1.5 text-xs font-bold text-[#334155]" htmlFor="board-info-description">
          안내 문구 <span className="font-normal text-[#64748B]">(비워 두면 예약 화면에 나오지 않습니다)</span>
          <textarea
            id="board-info-description"
            value={draft.description}
            maxLength={DESCRIPTION_MAX}
            rows={3}
            placeholder="예: 사용 후 정리 부탁드립니다"
            onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
            className="w-full resize-y rounded-lg border border-[#C8D0DA] px-3 py-2 text-sm font-normal leading-6"
          />
        </label>

        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] text-[#94A3B8]">{draft.description.length} / {DESCRIPTION_MAX}자</span>
          <button
            type="button"
            disabled={saving || !changed}
            onClick={() => void submit()}
            className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg bg-[#0F6CBD] px-4 text-xs font-bold text-white hover:bg-[#0B5B9F] disabled:bg-[#AAB7C4]"
          >
            {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {saving ? '저장 중' : '저장'}
          </button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-3 flex items-start gap-1.5 rounded-md bg-[#FEF2F2] px-2.5 py-2 text-xs font-semibold leading-5 text-[#B42318]">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{error}
        </p>
      ) : null}
      {done ? (
        <p role="status" aria-live="polite" className="mt-3 flex items-start gap-1.5 rounded-md bg-[#E7F3EA] px-2.5 py-2 text-xs font-semibold leading-5 text-[#166534]">
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />예약판 정보를 저장했습니다.
        </p>
      ) : null}
    </section>
  );
}
