import { useEffect, useRef, useState } from 'react';
import type { ShapeImpact } from './specialRoomsService';
import { AlertCircle, Check, LoaderCircle, Pencil } from 'lucide-react';
import { hiddenBookingsNotice, hiddenByShape } from './specialRoomsSchedule';
import { PERIOD_COUNT_MAX, PERIOD_COUNT_MIN } from './types';
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
  onSave: (info: BoardInfoDraft, expectedRevision: number) => Promise<void>;
  onImpact?: (info: BoardInfoDraft) => Promise<ShapeImpact>;
}

/**
 * 제목과 안내 문구를 보고 고친다.
 *
 * 예전에는 만들 때 적은 뒤로 담당자 화면 어디에도 나오지 않았다. 안내 문구는 공개 화면에만
 * 보이므로, 적었는지조차 배부한 링크를 직접 열어 봐야 알 수 있었다. 오타 하나에 예약표를
 * 새로 만들어야 했다.
 *
 * 안내 문구는 비워도 된다. 비면 공개 화면에서 그 자리가 사라진다는 것을 옆에 적어 둔다.
 * 빈 칸을 보고 "안 적으면 안 되나" 하고 망설이지 않게 한다.
 */
export function BoardInfoCard({ board, onSave, onImpact }: BoardInfoCardProps) {
  const saved: BoardInfoDraft = {
    title: board.title,
    description: board.description,
    periodCount: board.periodCount,
    includeSaturday: board.includeSaturday,
  };
  const [draft, setDraft] = useState<BoardInfoDraft>(saved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  // 실시간 갱신으로 서버 값이 바뀌면 따라간다. 다만 적던 것을 지우면 안 되므로, 손대지
  // 않은 상태일 때만 갈아 끼운다. `seen`은 마지막으로 반영한 서버 값이다.
  const seen = useRef(saved);
  const expectedRevision = useRef(board.metadataRevision ?? 1);
  const [conflict, setConflict] = useState(false);
  const conflictRef = useRef(conflict);
  conflictRef.current = conflict;
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const [impact, setImpact] = useState<ShapeImpact | null>(null);
  const [impactError, setImpactError] = useState(false);
  const [impactRetry, setImpactRetry] = useState(0);
  useEffect(() => {
    const next: BoardInfoDraft = {
      title: board.title,
      description: board.description,
      periodCount: board.periodCount,
      includeSaturday: board.includeSaturday,
    };
    if (!boardInfoChanged(seen.current, next)) {
      expectedRevision.current = board.metadataRevision ?? 1;
      return;
    }
    const previous = seen.current;
    const current = draftRef.current;
    let collided = false;
    const merged = { ...current };
    for (const key of [
      'title',
      'description',
      'periodCount',
      'includeSaturday',
    ] as const) {
      if (current[key] === previous[key])
        Object.assign(merged, { [key]: next[key] });
      else if (next[key] !== previous[key]) collided = true;
    }
    setDraft(merged);
    if (collided) setConflict(true);
    if (!collided && !conflictRef.current)
      expectedRevision.current = board.metadataRevision ?? 1;
    seen.current = next;
  }, [
    board.title,
    board.description,
    board.periodCount,
    board.includeSaturday,
    board.metadataRevision,
  ]);

  const changed = boardInfoChanged(saved, draft);
  // 저장을 누르기 전에 무엇이 가려지는지 보여 준다. 누른 뒤에 알리면 늦다.
  const impactRef = useRef(onImpact);
  impactRef.current = onImpact;
  const impactDraftRef = useRef(draft);
  impactDraftRef.current = draft;
  useEffect(() => {
    const draft = impactDraftRef.current;
    const onImpact = impactRef.current;
    let active = true;
    setImpactError(false);
    if (
      draft.periodCount >= board.periodCount &&
      (draft.includeSaturday || !board.includeSaturday)
    ) {
      setImpact({ count: 0, periods: [], saturdayCount: 0 });
      return;
    }
    if (!onImpact || !checkBoardInfo(draft).ok) {
      setImpact(null);
      return;
    }
    setImpact(null);
    const timer = window.setTimeout(() => {
      void onImpact(draft)
        .then((count) => {
          if (active) setImpact(count);
        })
        .catch(() => {
          if (active) setImpactError(true);
        });
    }, 400);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    draft.periodCount,
    draft.includeSaturday,
    board.periodCount,
    board.includeSaturday,
    board.metadataRevision,
    impactRetry,
  ]);
  const impactRequired =
    Boolean(onImpact) &&
    (draft.periodCount < board.periodCount ||
      (board.includeSaturday && !draft.includeSaturday));
  const impactPending = impactRequired && (impact === null || impactError);
  const hiddenNotice = onImpact
    ? impactError
      ? '영향받는 예약 수를 확인하지 못했습니다. 다시 확인한 뒤 저장해 주세요.'
      : impact === null
        ? '영향받는 예약 수를 확인 중입니다.'
        : impact.count > 0
          ? [
              impact.periods.length
                ? impact.periods.map((p) => p.period).join('·') +
                  '교시 예약 ' +
                  impact.periods.reduce((n, p) => n + p.count, 0) +
                  '건'
                : '',
              impact.saturdayCount
                ? '토요일 예약 ' + impact.saturdayCount + '건'
                : '',
            ]
              .filter(Boolean)
              .join('과 ') +
            '이 표에서 보이지 않게 됩니다. 지워지는 것은 아니라, 되돌리면 다시 나타납니다.'
          : ''
    : hiddenBookingsNotice(hiddenByShape(board.bookings, draft));

  const submit = async () => {
    if (saving || !changed || conflict || impactPending) return;
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
      await onSave(checked.value, expectedRevision.current);
      setDraft(checked.value);
      seen.current = checked.value;
      setDone(true);
      window.setTimeout(() => setDone(false), 2400);
    } catch (thrown) {
      if (thrown instanceof Error && thrown.message.includes('설정이 변경'))
        setConflict(true);
      setError(
        thrown instanceof Error
          ? thrown.message
          : '저장하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-lg border border-[#DCE3EA] bg-white px-4 py-5 sm:px-5">
      <h2 className="flex items-center gap-2 text-base font-bold text-[#0F172A]">
        <Pencil className="h-4 w-4 text-[#0F6CBD]" />
        예약표 정보
      </h2>
      <p className="mt-1 text-xs leading-5 text-[#526174]">
        예약 화면 맨 위에 보이는 내용입니다.
      </p>

      <div className="mt-4 grid gap-3">
        <label
          className="grid gap-1.5 text-xs font-bold text-[#334155]"
          htmlFor="board-info-title"
        >
          예약표 이름
          <input
            id="board-info-title"
            value={draft.title}
            maxLength={TITLE_MAX}
            onChange={(event) =>
              setDraft((current) => ({ ...current, title: event.target.value }))
            }
            className="min-h-[44px] w-full rounded-lg border border-[#C8D0DA] px-3 text-sm font-normal"
          />
        </label>

        <label
          className="grid gap-1.5 text-xs font-bold text-[#334155]"
          htmlFor="board-info-description"
        >
          안내 문구{' '}
          <span className="font-normal text-[#64748B]">
            (비워 두면 예약 화면에 나오지 않습니다)
          </span>
          <textarea
            id="board-info-description"
            value={draft.description}
            maxLength={DESCRIPTION_MAX}
            rows={3}
            placeholder="예: 사용 후 정리 부탁드립니다"
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
            className="w-full resize-y rounded-lg border border-[#C8D0DA] px-3 py-2 text-sm font-normal leading-6"
          />
        </label>

        {/*
          학교마다 하루가 다르다. 줄이면 그 너머 예약이 표에서 사라지므로 몇 건이 가려지는지
          미리 알린다. 지우지는 않는다. 규칙은 `specialRoomsSchedule`에 있다.
        */}
        <div className="grid gap-3 sm:grid-cols-2">
          <label
            className="grid gap-1.5 text-xs font-bold text-[#334155]"
            htmlFor="board-info-periods"
          >
            하루 교시 수
            <select
              id="board-info-periods"
              value={draft.periodCount}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  periodCount: Number(event.target.value),
                }))
              }
              className="min-h-[44px] w-full rounded-lg border border-[#C8D0DA] bg-white px-3 text-sm font-normal"
            >
              {Array.from(
                { length: PERIOD_COUNT_MAX - PERIOD_COUNT_MIN + 1 },
                (_, index) => PERIOD_COUNT_MIN + index,
              ).map((count) => (
                <option key={count} value={count}>
                  {count}교시까지
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-1.5 text-xs font-bold text-[#334155]">
            토요일
            <label className="flex min-h-[44px] items-center gap-2 rounded-lg border border-[#C8D0DA] px-3 text-sm font-normal">
              <input
                type="checkbox"
                checked={draft.includeSaturday}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    includeSaturday: event.target.checked,
                  }))
                }
                className="h-4 w-4"
              />
              토요일도 예약받기
            </label>
          </div>
        </div>

        {hiddenNotice ? (
          <p className="flex items-start gap-1.5 rounded-md bg-[#FFF7ED] px-2.5 py-2 text-xs font-semibold leading-5 text-[#9A3412]">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {hiddenNotice}
          </p>
        ) : null}

        {impactError ? (
          <button
            type="button"
            onClick={() => setImpactRetry((v) => v + 1)}
            className="min-h-[44px] self-start rounded-lg border px-3 text-xs font-bold"
          >
            영향 수 다시 확인
          </button>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] text-[#94A3B8]">
            {draft.description.length} / {DESCRIPTION_MAX}자
          </span>
          <button
            type="button"
            disabled={saving || !changed || conflict || impactPending}
            onClick={() => void submit()}
            className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg bg-[#0F6CBD] px-4 text-xs font-bold text-white hover:bg-[#0B5B9F] disabled:bg-[#AAB7C4]"
          >
            {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {saving ? '저장 중' : '저장'}
          </button>
        </div>
      </div>

      {conflict ? (
        <div
          role="alert"
          className="mt-3 rounded-lg bg-[#FFF7ED] p-3 text-xs text-[#9A3412]"
        >
          <p>
            수정 중인 설정이 다른 화면에서도 변경되었습니다. 내 입력은
            유지했습니다.
          </p>
          <button
            type="button"
            onClick={() => {
              expectedRevision.current = board.metadataRevision ?? 1;
              setConflict(false);
            }}
            className="mt-2 min-h-[44px] border px-3 font-bold"
          >
            최신 설정 확인
          </button>
        </div>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="mt-3 flex items-start gap-1.5 rounded-md bg-[#FEF2F2] px-2.5 py-2 text-xs font-semibold leading-5 text-[#B42318]"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : null}
      {done ? (
        <p
          role="status"
          aria-live="polite"
          className="mt-3 flex items-start gap-1.5 rounded-md bg-[#E7F3EA] px-2.5 py-2 text-xs font-semibold leading-5 text-[#166534]"
        >
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          예약표 정보를 저장했습니다.
        </p>
      ) : null}
    </section>
  );
}
