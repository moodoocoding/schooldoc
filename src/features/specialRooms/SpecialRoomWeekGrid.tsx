import { useEffect, useRef, useState } from 'react';
import { LoaderCircle, X } from 'lucide-react';
import {
  WEEKDAYS,
  BOOKING_LABEL_MAX,
  bookingKey,
  formatDayLabel,
  toDateKey,
  indexBookings,
  indexSchoolDays,
  weekDates,
} from './specialRoomWeek';
import { PERIODS, type Period, type SchoolDay, type SpecialRoomBooking } from './types';

interface SpecialRoomWeekGridProps {
  mondayKey: string;
  roomId: string;
  bookings: SpecialRoomBooking[];
  schoolDays: SchoolDay[];
  readOnly?: boolean;
  savingCell?: string;
  onSave?: (date: string, period: Period, label: string) => void;
  onClear?: (date: string, period: Period) => void;
}

/**
 * 월~금 × 1~8교시 표.
 *
 * 시간표와 같은 모양이라 교사가 설명 없이 읽는다. 빈 칸을 누르면 그 자리에서 바로 입력한다.
 * 별도 창을 띄우지 않는 이유는, 한 번에 여러 칸을 채우는 일이 흔하기 때문이다.
 *
 * 휴업일은 회색으로 덮되 예약을 막지는 않는다. 재량휴업일에 행사 준비로 쓰는 경우가 있다.
 */
export function SpecialRoomWeekGrid({
  mondayKey,
  roomId,
  bookings,
  schoolDays,
  readOnly = false,
  savingCell = '',
  onSave,
  onClear,
}: SpecialRoomWeekGridProps) {
  const [editing, setEditing] = useState('');
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const dates = weekDates(mondayKey);
  const booked = indexBookings(bookings, roomId);
  const days = indexSchoolDays(schoolDays);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  // 주가 바뀌거나 특별실을 바꾸면 편집을 접는다. 엉뚱한 칸에 저장되지 않게 한다.
  useEffect(() => setEditing(''), [mondayKey, roomId]);

  const openCell = (key: string, current: string) => {
    if (readOnly) return;
    setEditing(key);
    setDraft(current);
  };

  const commit = (date: string, period: Period) => {
    const key = bookingKey(date, period);
    const current = booked.get(key)?.label ?? '';
    const next = draft.trim();
    setEditing('');
    if (next === current.trim()) return;
    if (!next) {
      if (current) onClear?.(date, period);
      return;
    }
    onSave?.(date, period, next);
  };

  const today = toDateKey(new Date());

  return (
    <div className="overflow-x-auto rounded-md border border-[#EEF1F4]">
      <table className="w-full min-w-[720px] table-fixed border-collapse text-sm">
        <caption className="sr-only">월요일부터 금요일까지 1교시부터 8교시까지의 특별실 예약 표</caption>
        {/* 칸 내용이나 편집 상태에 따라 열이 흔들리지 않도록 폭을 고정한다. */}
        <colgroup>
          <col className="w-[68px]" />
          {WEEKDAYS.map((day) => <col key={day} className="w-1/5" />)}
        </colgroup>
        <thead>
          <tr>
            {/* 좁은 화면에서 옆으로 밀 때 몇 교시인지 놓치지 않게 교시 열을 붙여 둔다. */}
            <th scope="col" className="sticky left-0 z-20 border-b border-[#C8D0DA] bg-[#F6F8FB] p-2 text-[11px] font-bold text-[#64748B]">
              교시
            </th>
            {dates.map((date, index) => {
              const note = days.get(date);
              const isToday = date === today;
              return (
                <th
                  key={date}
                  scope="col"
                  aria-current={isToday ? 'date' : undefined}
                  className={`border-b border-l border-[#C8D0DA] px-2 py-2.5 align-top ${
                    note?.isOffDay ? 'bg-[#F1F3F6]' : 'bg-[#F6F8FB]'
                  } ${isToday ? 'border-t-2 border-t-[#0F6CBD]' : 'border-t-2 border-t-transparent'}`}
                >
                  {/*
                    달력과 시간표에서 휴업일은 빨강이다. 교사가 이미 아는 관례라 설명이 필요
                    없다. 예전에는 오히려 회색으로 흐려 놨는데 관례의 반대였다.
                    오늘은 면을 칠하지 않고 위쪽 선으로 표시한다. 옅은 배경을 두 가지 쓰면
                    밝기 차이가 1% 밖에 나지 않아 둘 다 흰색으로 보인다.
                  */}
                  <span className="flex items-center justify-center gap-1.5">
                    <span className={`text-sm font-bold ${note?.isOffDay ? 'text-[#C0261B]' : 'text-[#0F172A]'}`}>
                      {WEEKDAYS[index]}
                    </span>
                    <span className={`text-xs font-semibold ${note?.isOffDay ? 'text-[#C0261B]' : 'text-[#64748B]'}`}>
                      {formatDayLabel(date)}
                    </span>
                  </span>
                  {/* 색만으로 알리지 않는다. 흑백으로 봐도 글자로 구분된다. */}
                  {isToday ? (
                    <span className="mx-auto mt-1 block w-fit rounded bg-[#0F6CBD] px-1.5 py-0.5 text-[10px] font-bold text-white">오늘</span>
                  ) : null}
                  {note?.events.length ? (
                    <span
                      title={note.events.join(' · ')}
                      className={`mx-auto mt-1 block w-fit max-w-full truncate rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        note.isOffDay ? 'bg-[#FBE4E2] text-[#8C1D18]' : 'bg-[#E7EDF4] text-[#41566E]'
                      }`}
                    >
                      {note.events.join(' · ')}
                    </span>
                  ) : null}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {PERIODS.map((period) => {
            // 초등 시간표는 4교시 뒤에 점심이 온다. 그 자리에 선을 하나 두면 몇 교시인지
            // 세지 않고도 위아래를 가늠한다.
            const afterLunch = period === 4 ? 'border-b-2 border-b-[#C8D0DA]' : 'border-b border-b-[#EEF1F4]';
            const lastRow = period === PERIODS[PERIODS.length - 1] ? 'border-b-0' : '';
            return (
              <tr key={period}>
                <th scope="row" className={`sticky left-0 z-10 bg-[#F6F8FB] p-2 text-[11px] font-bold text-[#64748B] ${afterLunch} ${lastRow}`}>
                  {period}교시
                </th>
                {dates.map((date) => {
                  const key = bookingKey(date, period);
                  const booking = booked.get(key);
                  const note = days.get(date);
                  const isSaving = savingCell === key;
                  const isToday = date === today;
                  const cellName = `${formatDayLabel(date)} ${period}교시`;
                  // 휴업일만 실제로 보이는 회색으로 덮는다. 오늘은 왼쪽 선으로 알린다.
                  // 밝기가 4밖에 차이 나지 않는 배경은 아무 것도 알리지 못한다.
                  const tone = note?.isOffDay ? 'bg-[#F1F3F6]' : 'bg-white';
                  const todayEdge = isToday ? 'border-l-2 border-l-[#0F6CBD]' : 'border-l border-l-[#EEF1F4]';

                  if (editing === key) {
                    return (
                      <td key={key} className={`${todayEdge} p-0 ring-2 ring-inset ring-[#0F6CBD] ${afterLunch} ${lastRow}`}>
                        <input
                          ref={inputRef}
                          value={draft}
                          onChange={(event) => setDraft(event.target.value)}
                          onBlur={() => commit(date, period)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') commit(date, period);
                            if (event.key === 'Escape') setEditing('');
                          }}
                          maxLength={BOOKING_LABEL_MAX}
                          aria-label={`${cellName} 사용 내용`}
                          placeholder="6-1반"
                          className="h-[52px] w-full min-w-0 bg-white px-2 text-sm outline-none"
                        />
                      </td>
                    );
                  }

                  return (
                    <td key={key} className={`${todayEdge} p-0 ${tone} ${afterLunch} ${lastRow}`}>
                      <button
                        type="button"
                        disabled={readOnly || isSaving}
                        onClick={() => openCell(key, booking?.label ?? '')}
                        aria-label={booking ? `${cellName} ${booking.label} 고치기` : `${cellName} 예약하기`}
                        className={`flex h-[52px] w-full items-center justify-center px-1.5 ${
                          readOnly ? 'cursor-default' : 'cursor-pointer hover:bg-[#F1F6FB]'
                        } disabled:cursor-wait`}
                      >
                        {isSaving ? (
                          <LoaderCircle className="h-4 w-4 animate-spin text-[#0F6CBD]" />
                        ) : booking ? (
                          // 예약은 칸을 통째로 칠하지 않고 블록으로 얹는다. 시간표처럼 읽힌다.
                          // 한 줄로 자르면 `6학년 1반 과학 실험…`처럼 40%만 읽혔다. 두 줄까지
                          // 보여 주고, 그래도 넘치면 전체를 툴팁으로 준다.
                          <span
                            title={booking.label}
                            className="line-clamp-2 w-full break-all rounded-md border border-[#BBD6EE] bg-[#EFF6FC] px-1.5 py-1 text-[11px] font-bold leading-4 text-[#0F5B9E]"
                          >
                            {booking.label}
                          </span>
                        ) : (
                          // 빈 칸도 비었다는 것이 보여야 한다. 아무것도 없으면 고장으로 읽힌다.
                          <span aria-hidden="true" className={readOnly ? 'text-sm text-[#DCE3EA]' : 'text-base text-[#C8D0DA]'}>
                            {readOnly ? '·' : '+'}
                          </span>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>

      {!readOnly ? (
        <p className="mt-3 text-xs text-[#64748B]">
          빈 칸을 눌러 사용할 학급이나 용도를 적습니다. 내용을 지우고 저장하면 예약이 취소됩니다.
          <X className="mx-1 inline h-3 w-3" />
          누구나 고치고 지울 수 있으니 남의 예약을 확인한 뒤 바꿔 주세요.
        </p>
      ) : null}
    </div>
  );
}
