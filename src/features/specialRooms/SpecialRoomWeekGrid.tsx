import { useEffect, useState } from 'react';
import { LoaderCircle, X } from 'lucide-react';
import { BookingSheet } from './BookingSheet';
import type { RepeatOutcome } from './specialRoomsRepeat';
import { closureAt } from './specialRoomsClosure';
import {
  periodsFor,
  weekdaysFor,
  bookingKey,
  formatDayLabel,
  toDateKey,
  indexBookings,
  indexSchoolDays,
  weekDates,
} from './specialRoomWeek';
import type { Period, SchoolDay, SpecialRoomBooking, SpecialRoomClosure } from './types';

interface SpecialRoomWeekGridProps {
  mondayKey: string;
  roomId: string;
  /** 시트 제목에 쓴다. 어느 방을 잡는지 표를 떠나서도 알아야 한다. */
  roomName?: string;
  /** 이 예약표가 쓰는 교시 수. 학교마다 다르다. */
  periodCount: number;
  /** 토요일까지 보여 줄지. */
  includeSaturday: boolean;
  /** 이번 학기 마지막 날. 반복 예약의 `학기 말까지`에 쓴다. */
  termEndDate?: string;
  /** 담당자가 건 휴관. 그 칸은 회색으로 덮고 누를 수 없다. */
  closures?: SpecialRoomClosure[];
  /** 매주 반복해서 잡는다. 없으면 시트에 반복 영역이 나오지 않는다. */
  onRepeat?: (date: string, period: Period, label: string, until: string) => Promise<RepeatOutcome>;
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
/** 점심이 오는 자리. 교시 수와 무관하게 4교시 뒤가 보통이다. */
const LUNCH_AFTER_PERIOD = 4;

export function SpecialRoomWeekGrid({
  mondayKey,
  roomId,
  roomName,
  periodCount,
  includeSaturday,
  termEndDate = '',
  closures = [],
  onRepeat,
  bookings,
  schoolDays,
  readOnly = false,
  savingCell = '',
  onSave,
  onClear,
}: SpecialRoomWeekGridProps) {
  const [editing, setEditing] = useState<{ date: string; period: Period } | null>(null);

  const weekdays = weekdaysFor(includeSaturday);
  const periods = periodsFor(periodCount);
  const dates = weekDates(mondayKey, includeSaturday);
  const booked = indexBookings(bookings, roomId);
  const days = indexSchoolDays(schoolDays);

  // 주가 바뀌거나 특별실을 바꾸면 시트를 접는다. 엉뚱한 칸에 저장되지 않게 한다.
  useEffect(() => setEditing(null), [mondayKey, roomId, periodCount, includeSaturday]);

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
          {weekdays.map((day) => <col key={day} style={{ width: `${100 / weekdays.length}%` }} />)}
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
                      {weekdays[index]}
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
          {periods.map((period) => {
            // 점심 자리에 선을 하나 두면 몇 교시인지 세지 않고도 위아래를 가늠한다.
            // 6교시 학교는 4교시 뒤, 8~9교시 학교도 4교시 뒤가 보통이다.
            const afterLunch = period === LUNCH_AFTER_PERIOD ? 'border-b-2 border-b-[#C8D0DA]' : 'border-b border-b-[#EEF1F4]';
            const lastRow = period === periods[periods.length - 1] ? 'border-b-0' : '';
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
                  const closed = closureAt(closures, roomId, date);
                  const tone = closed ? 'bg-[#EEF1F4]' : note?.isOffDay ? 'bg-[#F1F3F6]' : 'bg-white';
                  const todayEdge = isToday ? 'border-l-2 border-l-[#0F6CBD]' : 'border-l border-l-[#EEF1F4]';

                  return (
                    <td key={key} className={`${todayEdge} p-0 ${tone} ${afterLunch} ${lastRow}`}>
                      <button
                        type="button"
                        disabled={readOnly || isSaving || Boolean(closed)}
                        onClick={() => openCell(date, period)}
                        aria-label={closed
                          ? `${cellName} 휴관${closed.reason ? ` · ${closed.reason}` : ''}`
                          : booking ? `${cellName} ${booking.label} 고치기` : `${cellName} 예약하기`}
                        title={closed?.reason || undefined}
                        className={`flex h-[44px] w-full items-center justify-center px-0.5 sm:h-[52px] sm:px-1.5 ${
                          readOnly ? 'cursor-default' : 'cursor-pointer hover:bg-[#F1F6FB]'
                        } ${editingKey === key ? 'ring-2 ring-inset ring-[#0F6CBD]' : ''} disabled:cursor-wait`}
                      >
                        {/*
                          빈 칸에는 아무것도 그리지 않는다. 한 주에 40칸이라 표시 하나를
                          두면 그것이 마흔 개가 되어, 정작 눈에 들어와야 할 예약을 덮는다.
                          누를 수 있다는 것은 표 아래 안내와 커서·hover가 알린다.
                          보조기기에는 칸의 접근 가능한 이름(`… 예약하기`)이 알린다.
                        */}
                        {isSaving ? (
                          <LoaderCircle className="h-4 w-4 animate-spin text-[#0F6CBD]" />
                        ) : closed ? (
                          // 휴관은 예약을 덮는다. 예약이 남아 있어도 그날 오면 안 되기 때문이다.
                          // 지우지는 않으므로 휴관을 풀면 그대로 돌아온다.
                          <span className="w-full truncate rounded px-1 text-[10px] font-bold text-[#8A94A6] sm:text-xs">
                            {closed.reason || '휴관'}
                          </span>
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
                        ) : null}
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
          title={`${weekdays[dates.indexOf(editing.date)]} ${formatDayLabel(editing.date)} · ${editing.period}교시`}
          roomName={roomName}
          date={editing.date}
          weekdayLabel={weekdays[dates.indexOf(editing.date)] ?? ''}
          period={editing.period}
          termEndDate={termEndDate}
          onRepeat={(label, until) => (
            onRepeat
              ? onRepeat(editing.date, editing.period, label, until)
              : Promise.resolve({ created: [], skippedOffDay: [], skippedTaken: [] })
          )}
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
