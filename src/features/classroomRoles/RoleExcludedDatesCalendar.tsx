import { useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { roleMonthRange, roleToday } from "./roleApi";

const weekdays = ["월", "화", "수", "목", "금", "토", "일"];

function shiftMonth(month: string, offset: number) {
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number - 1 + offset, 1))
    .toISOString()
    .slice(0, 7);
}

export function RoleExcludedDatesCalendar({
  dates,
  onChange,
  initialMonth,
  busy,
}: {
  dates: string[];
  onChange: (dates: string[]) => void;
  initialMonth: string;
  busy: boolean;
}) {
  const [month, setMonth] = useState(initialMonth);
  const [year, number] = month.split("-").map(Number);
  const firstWeekday =
    (new Date(`${month}-01T00:00:00Z`).getUTCDay() + 6) % 7;
  const daysInMonth = Number(roleMonthRange(month).end.slice(-2));
  const selectedDates = [...dates].sort();
  const today = roleToday();
  const toggle = (date: string) =>
    onChange(
      dates.includes(date)
        ? dates.filter((selected) => selected !== date)
        : [...dates, date].sort(),
    );

  return (
    <div className="space-y-4">
      <div className="flex max-w-[490px] items-center justify-between gap-3">
        <h3 className="text-base font-bold">실천 제외일</h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-[#334155] hover:bg-[#F1F5F9] focus-visible:outline-2 focus-visible:outline-[#0F6CBD]"
            aria-label="이전 달"
            onClick={() => setMonth(shiftMonth(month, -1))}
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <span className="min-w-28 text-center text-sm font-semibold" aria-live="polite">
            {year}년 {number}월
          </span>
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-[#334155] hover:bg-[#F1F5F9] focus-visible:outline-2 focus-visible:outline-[#0F6CBD]"
            aria-label="다음 달"
            onClick={() => setMonth(shiftMonth(month, 1))}
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="max-w-[490px] overflow-x-auto">
        <div className="grid min-w-[308px] grid-cols-7 gap-1" aria-label="실천 제외일 달력">
          {weekdays.map((day) => (
            <span
              key={day}
              className="py-2 text-center text-xs font-semibold text-[#64748B]"
              aria-hidden="true"
            >
              {day}
            </span>
          ))}
          {Array.from({ length: firstWeekday }, (_, i) => (
            <span key={`blank-${i}`} aria-hidden="true" />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const date = `${month}-${String(i + 1).padStart(2, "0")}`;
            const selected = dates.includes(date);
            return (
              <button
                key={date}
                type="button"
                disabled={busy || (!selected && dates.length >= 366)}
                aria-label={`${year}년 ${number}월 ${i + 1}일 실천 제외${selected ? " 취소" : ""}`}
                aria-pressed={selected}
                onClick={() => toggle(date)}
                className={`flex min-h-11 min-w-0 flex-col items-center justify-center rounded-lg border text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F6CBD] disabled:opacity-50 ${
                  selected
                    ? "border-[#B9472F] bg-[#FFF1EB] font-bold text-[#8F3421]"
                    : "border-transparent text-[#253247] hover:border-[#CBD5E1] hover:bg-[#F8FAFC]"
                } ${date === today ? "underline underline-offset-4" : ""}`}
              >
                {i + 1}
                {selected && <span className="text-[10px] leading-3">제외</span>}
              </button>
            );
          })}
        </div>
      </div>
      {selectedDates.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">선택한 날짜 {selectedDates.length}일</p>
          <div className="flex flex-wrap gap-2">
            {selectedDates.map((date) => (
              <button
                key={date}
                type="button"
                disabled={busy}
                onClick={() => toggle(date)}
                aria-label={`${date} 실천 제외 취소`}
                className="inline-flex min-h-11 items-center gap-1 rounded-full border border-[#E5B8A7] bg-[#FFF8F5] px-3 text-sm font-medium text-[#7C2D1C] hover:bg-[#FFECE4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F6CBD] disabled:opacity-50"
              >
                {date}
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
