import { useEffect, useRef, useState } from 'react';
import { LoaderCircle, X } from 'lucide-react';
import {
  WEEKDAYS,
  bookingKey,
  formatDayLabel,
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

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <caption className="sr-only">월요일부터 금요일까지 1교시부터 8교시까지의 특별실 예약 표</caption>
        <thead>
          <tr className="bg-[#F6F8FB]">
            <th scope="col" className="w-16 border border-[#DCE3EA] p-2 text-xs font-bold text-[#526174]">교시</th>
            {dates.map((date, index) => {
              const note = days.get(date);
              return (
                <th key={date} scope="col" className={`border border-[#DCE3EA] p-2 ${note?.isOffDay ? 'bg-[#EEF1F4]' : ''}`}>
                  <span className="block text-sm font-bold text-[#0F172A]">{WEEKDAYS[index]}</span>
                  <span className="mt-0.5 block text-xs font-semibold text-[#64748B]">{formatDayLabel(date)}</span>
                  {note?.events.length ? (
                    <span className={`mt-1 block truncate text-[11px] font-semibold ${note.isOffDay ? 'text-[#B42318]' : 'text-[#0F6CBD]'}`}>
                      {note.events.join(' · ')}
                    </span>
                  ) : null}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {PERIODS.map((period) => (
            <tr key={period}>
              <th scope="row" className="border border-[#DCE3EA] bg-[#F6F8FB] p-2 text-xs font-bold text-[#526174]">
                {period}교시
              </th>
              {dates.map((date) => {
                const key = bookingKey(date, period);
                const booking = booked.get(key);
                const note = days.get(date);
                const isSaving = savingCell === key;
                const cellName = `${formatDayLabel(date)} ${period}교시`;

                if (editing === key) {
                  return (
                    <td key={key} className="border border-[#0F6CBD] p-0">
                      <input
                        ref={inputRef}
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onBlur={() => commit(date, period)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') commit(date, period);
                          if (event.key === 'Escape') setEditing('');
                        }}
                        maxLength={40}
                        aria-label={`${cellName} 사용 내용`}
                        placeholder="6-1반"
                        className="h-11 w-full min-w-0 px-2 text-sm outline-none"
                      />
                    </td>
                  );
                }

                return (
                  <td key={key} className={`border border-[#DCE3EA] p-0 ${note?.isOffDay ? 'bg-[#F6F8FB]' : ''}`}>
                    <button
                      type="button"
                      disabled={readOnly || isSaving}
                      onClick={() => openCell(key, booking?.label ?? '')}
                      aria-label={booking ? `${cellName} ${booking.label} 고치기` : `${cellName} 예약하기`}
                      className={`flex h-11 w-full items-center justify-center px-2 text-sm ${
                        booking
                          ? 'bg-[#EFF6FC] font-bold text-[#0F6CBD]'
                          : 'text-[#94A3B8] hover:bg-[#F6F8FB]'
                      } ${readOnly ? 'cursor-default' : 'cursor-pointer'} disabled:cursor-wait`}
                    >
                      {isSaving
                        ? <LoaderCircle className="h-4 w-4 animate-spin" />
                        : <span className="truncate">{booking?.label ?? (readOnly ? '' : '+')}</span>}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
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
