import { useEffect, useRef, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { useDialogFocus } from '../registry/useDialogFocus';
import { BOOKING_LABEL_MAX } from './specialRoomWeek';

interface BookingSheetProps {
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
}: BookingSheetProps) {
  const [draft, setDraft] = useState(current);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useDialogFocus(dialogRef, onClose, inputRef);

  // 다른 칸을 눌러 시트가 이어서 열리면 그 칸의 값으로 갈아 끼운다.
  useEffect(() => setDraft(current), [current, cellName]);

  const over = draft.length > BOOKING_LABEL_MAX;

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
