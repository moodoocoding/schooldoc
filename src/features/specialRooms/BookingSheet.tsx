import { useEffect, useRef, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { useDialogFocus } from '../registry/useDialogFocus';
import { BOOKING_LABEL_MAX } from './specialRoomWeek';
import {
  REPEAT_PRESETS,
  repeatDates,
  repeatPreview,
  repeatResultNotice,
  repeatUntilFromWeeks,
  type RepeatOutcome,
} from './specialRoomsRepeat';

interface BookingSheetProps {
  /** 반복해서 잡을 때 첫 날짜. `2026-08-25` 꼴이다. */
  date: string;
  weekdayLabel: string;
  period: number;
  /** 이번 학기 마지막 날. 비면 `학기 말까지` 빠른 선택을 감춘다. */
  termEndDate: string;
  /** 매주 반복으로 넣는다. 결과를 그대로 돌려준다. */
  onRepeat: (label: string, until: string) => Promise<RepeatOutcome>;
  /** 접근 가능한 이름의 앞부분. `8/24 3교시` 같은 꼴이다. */
  cellName: string;
  /** 사람이 읽는 제목. `월 8/24 · 3교시` 같은 꼴이다. */
  title: string;
  roomName?: string;
  current: string;
  saving: boolean;
  onSubmit: (label: string) => void;
  onClose: () => void;
}

/**
 * 칸을 눌렀을 때 열리는 입력 시트.
 *
 * 예전에는 칸 안에 입력창을 띄웠다. 데스크톱에서는 됐지만 휴대폰에서 한 칸이 61px이라
 * 글자를 적을 자리가 없었고, 적은 내용도 칸 폭만큼만 보였다. 표는 한 주를 훑는 데 쓰고,
 * 읽고 고치는 일은 시트에서 한다.
 *
 * 비우고 저장하면 예약이 취소된다. 예전 동작을 그대로 두되, 지우려고 온 사람을 위해
 * `예약 지우기`도 따로 둔다. 비우는 것으로만 지울 수 있으면 지우는 방법을 알기 어렵다.
 */
export function BookingSheet({
  cellName, title, roomName, current, saving, onSubmit, onClose,
  date, weekdayLabel, period, termEndDate, onRepeat,
}: BookingSheetProps) {
  const [draft, setDraft] = useState(current);
  const [repeating, setRepeating] = useState(false);
  const [until, setUntil] = useState(date);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useDialogFocus(dialogRef, onClose, inputRef);

  // 다른 칸을 눌러 시트가 이어서 열리면 그 칸의 값으로 갈아 끼운다.
  useEffect(() => setDraft(current), [current, cellName]);

  const over = draft.length > BOOKING_LABEL_MAX;
  const dates = repeatDates(date, until);
  const preview = repeatPreview(dates, weekdayLabel, period);

  const runRepeat = async () => {
    if (saving || busy || !draft.trim()) return;
    setBusy(true);
    setResult('');
    try {
      setResult(repeatResultNotice(await onRepeat(draft, until)));
    } catch (thrown) {
      setResult(thrown instanceof Error ? thrown.message : '반복해서 잡지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    if (saving) return;
    onSubmit(draft);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#0F172A]/45 p-0 sm:items-center sm:p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-sheet-title"
        className="w-full rounded-t-lg bg-white p-5 shadow-2xl sm:max-w-sm sm:rounded-lg"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id="booking-sheet-title" className="text-lg font-extrabold text-[#0F172A]">{title}</h2>
            {roomName ? <p className="mt-0.5 truncate text-xs font-semibold text-[#0F6CBD]">{roomName}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="예약 입력 닫기"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#526174] hover:bg-[#F6F8FB]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="mt-4 grid gap-1.5 text-xs font-bold text-[#334155]">
          사용할 학급이나 용도
          <input
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                event.preventDefault();
                submit();
              }
            }}
            maxLength={BOOKING_LABEL_MAX}
            aria-label={`${cellName} 사용 내용`}
            placeholder="6-1반"
            className="min-h-[44px] w-full rounded-lg border border-[#C8D0DA] px-3 text-sm font-normal"
          />
        </label>
        {/*
          상한을 24자로 낮추기 전에 적힌 예약은 그보다 길 수 있다. 그대로 두면
          `28 / 24자`가 설명 없이 떠 있어 고장으로 읽힌다. 넘친 것을 붉게 알리고
          무엇을 하라는지 말해 준다. 저장 자체는 막지 않는다 — 남의 예약을 열었다가
          손도 못 대는 편이 더 나쁘다.
        */}
        <p className={`mt-1.5 text-[11px] ${over ? 'font-semibold text-[#B42318]' : 'text-[#94A3B8]'}`}>
          {draft.length} / {BOOKING_LABEL_MAX}자{over ? ' · 예전에 적힌 긴 이름입니다. 줄여 주세요' : ''}
        </p>

        {/*
          매주 같은 시간을 한 번에 잡는다. 빠른 선택과 날짜 지정을 함께 두는 것은 자료 수합의
          마감 기한과 같은 모양이다. 거기를 써 본 선생님이 여기서 다시 배울 것이 없다.
          이미 잡힌 칸을 고치는 중이면 반복을 권하지 않는다. 남의 예약을 학기 내내 덮게 된다.
        */}
        {current ? null : (
          <div className="mt-4 border-t border-[#EEF1F4] pt-4">
            <label className="flex items-center gap-2 text-sm font-bold text-[#334155]">
              <input
                type="checkbox"
                checked={repeating}
                onChange={(event) => { setRepeating(event.target.checked); setResult(''); }}
                className="h-4 w-4"
              />
              매주 반복해서 잡기
            </label>

            {repeating ? (
              <div className="mt-3 grid gap-3">
                <div className="flex flex-wrap gap-2">
                  {REPEAT_PRESETS.map((preset) => {
                    const value = repeatUntilFromWeeks(date, preset.weeks);
                    const selected = until === value;
                    return (
                      <button
                        key={preset.weeks}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setUntil(value)}
                        className={`min-h-[40px] rounded-lg border px-3 text-xs font-bold ${selected ? 'border-[#0F6CBD] bg-[#EFF6FC] text-[#0F6CBD]' : 'border-[#C8D0DA] bg-white text-[#334155]'}`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                  {termEndDate ? (
                    <button
                      type="button"
                      aria-pressed={until === termEndDate}
                      onClick={() => setUntil(termEndDate)}
                      className={`min-h-[40px] rounded-lg border px-3 text-xs font-bold ${until === termEndDate ? 'border-[#0F6CBD] bg-[#EFF6FC] text-[#0F6CBD]' : 'border-[#C8D0DA] bg-white text-[#334155]'}`}
                    >
                      학기 말까지
                    </button>
                  ) : null}
                </div>

                <label className="grid gap-1.5 text-xs font-bold text-[#334155]" htmlFor="booking-repeat-until">
                  마지막 날짜
                  <input
                    id="booking-repeat-until"
                    type="date"
                    value={until}
                    min={date}
                    onChange={(event) => setUntil(event.target.value)}
                    className="min-h-[44px] w-full rounded-lg border border-[#C8D0DA] px-3 text-sm font-normal"
                  />
                </label>

                <p aria-live="polite" className="rounded-md bg-[#EFF6FC] px-2.5 py-2 text-xs font-semibold leading-5 text-[#1E4E79]">
                  {preview}
                </p>

                <button
                  type="button"
                  disabled={saving || busy || !draft.trim()}
                  onClick={() => void runRepeat()}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#0F6CBD] px-4 text-sm font-bold text-white hover:bg-[#0B5B9F] disabled:bg-[#AAB7C4]"
                >
                  {busy ? '잡는 중' : '반복해서 잡기'}
                </button>

              </div>
            ) : null}
          </div>
        )}

        {/*
          결과는 반복 영역 밖에 둔다. 반복이 끝나면 그 칸에 예약이 생겨 `current`가 채워지고,
          반복 영역이 통째로 사라진다. 안에 두면 결과 문구까지 같이 없어져 몇 번 잡혔는지
          알 수 없다.
        */}
        {result ? (
          <p role="status" className="mt-3 rounded-md bg-[#E7F3EA] px-2.5 py-2 text-xs font-semibold leading-5 text-[#166534]">
            {result}
          </p>
        ) : null}

        <div className="mt-4 flex items-center gap-2">
          {current ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => { if (!saving) onSubmit(''); }}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[#F0C4C0] px-3 text-sm font-bold text-[#B42318] hover:bg-[#FEF2F2] disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />예약 지우기
            </button>
          ) : null}
          <button
            type="button"
            disabled={saving}
            onClick={submit}
            className="ml-auto inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-[#0F6CBD] px-4 text-sm font-bold text-white hover:bg-[#0B5B9F] disabled:bg-[#AAB7C4] sm:flex-none"
          >
            {saving ? '저장 중' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
