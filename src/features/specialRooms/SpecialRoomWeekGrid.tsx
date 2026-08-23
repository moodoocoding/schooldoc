import { useEffect, useState } from 'react';
import { LoaderCircle, X } from 'lucide-react';
import { BookingSheet } from './BookingSheet';
import {
  WEEKDAYS,
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
  /** 시트 제목에 쓴다. 어느 방을 잡는지 표를 떠나서도 알아야 한다. */
  roomName?: string;
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
  roomName,
  bookings,
  schoolDays,
  readOnly = false,
  savingCell = '',
  onSave,
  onClear,
}: SpecialRoomWeekGridProps) {
  const [editing, setEditing] = useState<{ date: string; period: Period } | null>(null);

  const dates = weekDates(mondayKey);
  const booked = indexBookings(bookings, roomId);
  const days = indexSchoolDays(schoolDays);

  // 주가 바뀌거나 특별실을 바꾸면 시트를 접는다. 엉뚱한 칸에 저장되지 않게 한다.
  useEffect(() => setEditing(null), [mondayKey, roomId]);

  const openCell = (date: string, period: Period) => {
    if (readOnly) return;
    setEditing({ date, period });
  };

  const commit = (date: string, period: Period, value: string) => {
    const key = bookingKey(date, period);
    const current = booked.get(key)?.label ?? '';
    const next = value.trim();
    setEditing(null);
    if (next === current.trim()) return;
    if (!next) {
      if (current) onClear?.(date, period);
      return;
    }
    onSave?.(date, period, next);
  };

  const today = toDateKey(new Date());
  const editingKey = editing ? bookingKey(editing.date, editing.period) : '';

  return (
    <div className="rounded-md border border-[#EEF1F4]">
      {/*
        한 주가 통째로 보여야 한다. 오늘이 찼으면 다른 날을 잡는 것이 이 화면의 기본
        동작인데, 예전에는 `min-w-[720px]` 때문에 375px 화면에서 5일 중 2일만 보이고
        나머지는 가로 스크롤 뒤에 숨어 있었다. 720px은 필연이 아니라 임의로 정한 값이었다.
        교시 열을 좁히면 요일 열이 61px씩 다섯 개 들어가고, 학교에서 실제로 쓰는 라벨
        (`6-1반`, `과학실험`, `6학년1반`)은 그 폭에 한 줄로 읽힌다.
      */}
      <table className="w-full table-fixed border-collapse text-sm">
        <caption className="sr-only">월요일부터 금요일까지 1교시부터 8교시까지의 특별실 예약 표</caption>
        {/* 칸 내용이나 편집 상태에 따라 열이 흔들리지 않도록 폭을 고정한다. */}
        <colgroup>
          <col className="w-[34px] sm:w-[64px]" />
          {WEEKDAYS.map((day) => <col key={day} className="w-1/5" />)}
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className="border-b border-[#C8D0DA] bg-[#F6F8FB] px-1 py-2 text-[10px] font-bold text-[#64748B] sm:text-[11px]">
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
                  className={`border-b border-l border-[#C8D0DA] px-0.5 py-2 align-top sm:px-2 sm:py-2.5 ${
                    note?.isOffDay ? 'bg-[#F1F3F6]' : 'bg-[#F6F8FB]'
                  } ${isToday ? 'border-t-2 border-t-[#0F6CBD]' : 'border-t-2 border-t-transparent'}`}
                >
                  {/*
                    달력과 시간표에서 휴업일은 빨강이다. 교사가 이미 아는 관례라 설명이 필요
                    없다. 예전에는 오히려 회색으로 흐려 놨는데 관례의 반대였다.
                    오늘은 면을 칠하지 않고 위쪽 선으로 표시한다. 옅은 배경을 두 가지 쓰면
                    밝기 차이가 1% 밖에 나지 않아 둘 다 흰색으로 보인다.
                  */}
                  {/* 좁은 화면에서는 요일 아래 날짜를 두 줄로 눌러 담는다. */}
                  <span className="flex flex-col items-center gap-0 sm:flex-row sm:justify-center sm:gap-1.5">
                    <span className={`text-xs font-bold sm:text-sm ${note?.isOffDay ? 'text-[#C0261B]' : 'text-[#0F172A]'}`}>
                      {WEEKDAYS[index]}
                    </span>
                    <span className={`text-[10px] font-semibold sm:text-xs ${note?.isOffDay ? 'text-[#C0261B]' : 'text-[#64748B]'}`}>
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
                <th scope="row" className={`bg-[#F6F8FB] px-1 py-2 text-[10px] font-bold text-[#64748B] sm:text-[11px] ${afterLunch} ${lastRow}`}>
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

                  return (
                    <td key={key} className={`${todayEdge} p-0 ${tone} ${afterLunch} ${lastRow}`}>
                      <button
                        type="button"
                        disabled={readOnly || isSaving}
                        onClick={() => openCell(date, period)}
                        aria-label={booking ? `${cellName} ${booking.label} 고치기` : `${cellName} 예약하기`}
                        className={`flex h-[44px] w-full items-center justify-center px-0.5 sm:h-[52px] sm:px-1.5 ${
                          readOnly ? 'cursor-default' : 'cursor-pointer hover:bg-[#F1F6FB]'
                        } ${editingKey === key ? 'ring-2 ring-inset ring-[#0F6CBD]' : ''} disabled:cursor-wait`}
                      >
                        {isSaving ? (
                          <LoaderCircle className="h-4 w-4 animate-spin text-[#0F6CBD]" />
                        ) : booking ? (
                          // 예약은 칸을 통째로 칠하지 않고 블록으로 얹는다. 시간표처럼 읽힌다.
                          // 한 줄로 자르고 전체는 시트에서 본다. 61px 칸에 두 줄을 넣으려던
                          // 앞선 시도는 `line-clamp`가 듣지 않아 글자 중간이 잘렸다.
                          <span
                            title={booking.label}
                            className="w-full truncate rounded border border-[#BBD6EE] bg-[#EFF6FC] px-1 py-1 text-[10px] font-bold text-[#0F5B9E] sm:rounded-md sm:px-2 sm:text-xs"
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

      {editing ? (
        <BookingSheet
          cellName={`${formatDayLabel(editing.date)} ${editing.period}교시`}
          title={`${WEEKDAYS[weekDates(mondayKey).indexOf(editing.date)]} ${formatDayLabel(editing.date)} · ${editing.period}교시`}
          roomName={roomName}
          current={booked.get(bookingKey(editing.date, editing.period))?.label ?? ''}
          saving={savingCell === bookingKey(editing.date, editing.period)}
          onSubmit={(label) => commit(editing.date, editing.period, label)}
          onClose={() => setEditing(null)}
        />
      ) : null}

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
