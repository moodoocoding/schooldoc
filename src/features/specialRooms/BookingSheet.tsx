import { useRef, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { useDialogFocus } from '../registry/useDialogFocus';
import { SpecialRoomError } from './types';
import { repeatRangeError } from '../../../supabase/functions/_shared/specialRooms';
import { BOOKING_LABEL_MAX } from './specialRoomWeek';
import {
  REPEAT_PRESETS,
  repeatDates,
  repeatPreview,
  repeatResultNotice,
  repeatUntilFromWeeks,
  type RepeatOutcome,
} from './specialRoomsRepeat';

/**
 * 마지막 글자에 받침이 있는지 본다. `이/가` 조사를 고르는 데 쓴다.
 * 한글이 아니면(숫자·영문으로 끝나는 이름 등) 받침이 있는 쪽으로 본다 — `6-1반`, `3팀`처럼
 * 학교에서 흔한 이름은 받침 있는 글자로 끝나는 경우가 많다.
 */
export const hasBatchim = (text: string) => {
  const last = text.trim().at(-1);
  if (!last) return true;
  const code = last.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return true;
  return code % 28 !== 0;
};

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
  initialDraft?: string;
  readOnly?: boolean;
  onDraftChange?: (draft: string) => void;
  onConfirmCurrent?: () => void;
  onSubmit: (label: string) => Promise<void>;
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
 *
 * 이미 잡힌 칸을 열면 곧바로 고칠 수 있게 하지 않는다. 누구나 남의 예약을 고치고 지울 수
 * 있는 화면이라, 실수로 옆 칸을 눌러 남의 것을 덮는 사고가 난다. 이름을 붙여 누구 것인지
 * 보여 주는 대신(개인정보가 되고, 가입 없이 쓰는 취지와도 안 맞는다), 바꾸기 전에
 * "이미 '6-1반'이 잡혀 있습니다. 바꿀까요?"를 한 번 묻는다. 자기 것을 고치러 왔어도 똑같이
 * 묻는다 — 누구 것인지 구분할 방법이 없으니, 그 정도는 감수하기로 했다.
 */
export function BookingSheet({
  cellName,
  title,
  roomName,
  current,
  saving,
  onSubmit,
  onClose,
  date,
  weekdayLabel,
  period,
  termEndDate,
  onRepeat,
  initialDraft,
  readOnly = false,
  onDraftChange,
  onConfirmCurrent,
}: BookingSheetProps) {
  const [draft, setDraft] = useState(initialDraft ?? current);
  const [confirmed, setConfirmed] = useState(!current);
  const [repeating, setRepeating] = useState(false);
  const [until, setUntil] = useState(date);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // 확인이 필요 없으면 입력칸에, 필요하면 안전한 `취소`에 처음 초점을 둔다.
  useDialogFocus(dialogRef, onClose, confirmed ? inputRef : cancelRef);

  // 셀별 key로 새 시트를 열며 외부 current 갱신은 입력 초안을 덮지 않는다.
  const over = draft.length > BOOKING_LABEL_MAX;
  const rangeError = repeatRangeError(date, until);
  const dates = rangeError ? [] : repeatDates(date, until);
  const preview = repeatPreview(dates, weekdayLabel, period);
  // 반복 패널이 실제로 보이는 동안만 `저장`을 감춘다. `repeating` 자체가 아니라 이걸 써야
  // 하는 이유는, 반복이 성공하면 지금 칸도 막 채워져 `current`가 생기고 그 순간 반복
  // 패널이 사라지는데(아래 `{current ? null : (반복 패널)}`), 그때는 이 칸을 보통 칸처럼
  // 다시 고칠 수 있어야 하므로 `저장`이 돌아와야 한다.
  const repeatPanelVisible = repeating && !current;

  const runRepeat = async () => {
    if (saving || busy || readOnly || !draft.trim() || rangeError) return;
    setBusy(true);
    setResult('');
    setFailure('');
    try {
      setResult(repeatResultNotice(await onRepeat(draft, until)));
    } catch (thrown) {
      setFailure(
        thrown instanceof Error ? thrown.message : '반복해서 잡지 못했습니다.',
      );
    } finally {
      setBusy(false);
    }
  };

  const [failure, setFailure] = useState('');
  const [conflict, setConflict] = useState(false);
  const submit = async (value = draft) => {
    if (saving || busy || readOnly) return;
    setFailure('');
    setConflict(false);
    setBusy(true);
    try {
      await onSubmit(value);
    } catch (error) {
      setFailure(
        error instanceof Error ? error.message : '예약을 저장하지 못했습니다.',
      );
      setConflict(
        error instanceof SpecialRoomError && error.code === 'BOOKING_CONFLICT',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#0F172A]/45 p-0 sm:items-center sm:p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-sheet-title"
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto w-full rounded-t-lg bg-white p-5 shadow-2xl sm:max-w-sm sm:rounded-lg"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2
              id="booking-sheet-title"
              className="text-lg font-extrabold text-[#0F172A]"
            >
              {title}
            </h2>
            {roomName ? (
              <p className="mt-0.5 truncate text-xs font-semibold text-[#0F6CBD]">
                {roomName}
              </p>
            ) : null}
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

        {readOnly ? (
          <p className="mt-4 whitespace-pre-wrap break-words text-base leading-7 text-[#24312C]">
            {current || '빈 칸입니다.'}
          </p>
        ) : !confirmed ? (
          <div className="mt-4">
            <p className="text-sm leading-6 text-[#334155]">
              이미 <span className="font-bold text-[#0F172A]">{current}</span>
              {hasBatchim(current) ? '이' : '가'} 잡혀 있습니다. 바꿀까요?
            </p>
            <div className="mt-4 flex items-center gap-2">
              <button
                ref={cancelRef}
                type="button"
                onClick={onClose}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-[#C8D0DA] px-4 text-sm font-bold text-[#334155] hover:bg-[#F6F8FB]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => setConfirmed(true)}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-[#0F6CBD] px-4 text-sm font-bold text-white hover:bg-[#0B5B9F]"
              >
                바꾸기
              </button>
            </div>
          </div>
        ) : (
          <>
            <label className="mt-4 grid gap-1.5 text-xs font-bold text-[#334155]">
              사용할 학급이나 용도
              <input
                ref={inputRef}
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  onDraftChange?.(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    // 반복 패널이 보이는 동안은 엔터도 반복해서 잡기를 실행한다. 화면에 없는
                    // `저장` 버튼이 몰래 눌리면 안 된다.
                    if (repeatPanelVisible) void runRepeat();
                    else void submit();
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
            <p
              className={`mt-1.5 text-[11px] ${over ? 'font-semibold text-[#B42318]' : 'text-[#526174]'}`}
            >
              {draft.length} / {BOOKING_LABEL_MAX}자
              {over ? ' · 예전에 적힌 긴 이름입니다. 줄여 주세요' : ''}
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
                    onChange={(event) => {
                      setRepeating(event.target.checked);
                      setResult('');
                    }}
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

                    <label
                      className="grid gap-1.5 text-xs font-bold text-[#334155]"
                      htmlFor="booking-repeat-until"
                    >
                      마지막 날짜
                      <input
                        id="booking-repeat-until"
                        type="date"
                        value={until}
                        min={date}
                        max={repeatUntilFromWeeks(date, 52)}
                        aria-invalid={Boolean(rangeError)}
                        aria-describedby="booking-repeat-preview"
                        onChange={(event) => setUntil(event.target.value)}
                        className="min-h-[44px] w-full rounded-lg border border-[#C8D0DA] px-3 text-sm font-normal"
                      />
                    </label>

                    <p
                      id="booking-repeat-preview"
                      role={rangeError ? 'alert' : undefined}
                      aria-live="polite"
                      className="rounded-md bg-[#EFF6FC] px-2.5 py-2 text-xs font-semibold leading-5 text-[#1E4E79]"
                    >
                      {rangeError || preview}
                    </p>

                    <button
                      type="button"
                      disabled={
                        saving || busy || !draft.trim() || Boolean(rangeError)
                      }
                      onClick={() => void runRepeat()}
                      className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#0F6CBD] px-4 text-sm font-bold text-white hover:bg-[#0B5B9F] disabled:bg-[#AAB7C4]"
                    >
                      {busy ? '잡는 중' : '반복해서 잡기'}
                    </button>
                  </div>
                ) : null}
              </div>
            )}

            {failure ? (
              <div
                role="alert"
                className="mt-3 rounded-lg bg-[#FEF2F2] p-3 text-sm text-[#B42318]"
              >
                <p>{failure}</p>
                {conflict ? (
                  <>
                    <p className="mt-2">
                      현재 예약: {current || '빈 칸'} · 내 입력:{' '}
                      {draft || '예약 지우기'}
                    </p>
                    <button
                      type="button"
                      className="mt-2 min-h-[44px] rounded-lg border border-[#B42318] px-3 font-bold"
                      onClick={() => {
                        onConfirmCurrent?.();
                        setConflict(false);
                        setFailure(
                          '현재 내용을 확인했습니다. 저장을 눌러 다시 시도해 주세요.',
                        );
                      }}
                    >
                      현재 예약 확인
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}
            {/*
          결과는 반복 영역 밖에 둔다. 반복이 끝나면 그 칸에 예약이 생겨 `current`가 채워지고,
          반복 영역이 통째로 사라진다. 안에 두면 결과 문구까지 같이 없어져 몇 번 잡혔는지
          알 수 없다.
        */}
            {result ? (
              <p
                role="status"
                className="mt-3 rounded-md bg-[#E7F3EA] px-2.5 py-2 text-xs font-semibold leading-5 text-[#166534]"
              >
                {result}
              </p>
            ) : null}

            {/*
          반복 패널이 보이는 동안은 `저장`을 감춘다. 그대로 두면 `반복해서 잡기`와 `저장`
          두 개가 동시에 보여, 반복을 다 골라 놓고도 `저장`을 눌러 이 하루만 조용히
          저장해 버리는 실수가 난다. 실행 버튼은 그 순간 하나여야 한다.
        */}
            {repeatPanelVisible ? null : (
              <div className="mt-4 flex items-center gap-2">
                {current ? (
                  <button
                    type="button"
                    disabled={saving || busy}
                    onClick={() => void submit('')}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[#F0C4C0] px-3 text-sm font-bold text-[#B42318] hover:bg-[#FEF2F2] disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    예약 지우기
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void submit()}
                  className="ml-auto inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-[#0F6CBD] px-4 text-sm font-bold text-white hover:bg-[#0B5B9F] disabled:bg-[#AAB7C4] sm:flex-none"
                >
                  {saving || busy ? '저장 중' : '저장'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
