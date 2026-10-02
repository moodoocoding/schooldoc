import { useState } from "react";
import { Link } from "react-router-dom";
import {
  isRoleDay,
  ROLE_STATUS_LABELS,
  roleDates,
  roleForStudent,
  roleMonthRange,
  roleToday,
  writeRoleRecord,
  type RolePeriod,
  type RoleRecord,
  type RoleStudent,
} from "./roleApi";
import type { RolePageProps } from "./ClassroomRolesWorkspace";
import {
  RoleError,
  RoleField,
  roleInput,
  rolePanel,
  roleSecondary,
} from "./RoleControls";
import { useRoleRecords } from "./useRoleRecords";

function statusFor(
  records: RoleRecord[],
  period: RolePeriod,
  student: RoleStudent,
  date: string,
) {
  return records.find(
    (r) =>
      r.period_id === period.id &&
      r.student_id === student.id &&
      r.record_date === date,
  );
}
function StatusBadge({ status }: { status: string }) {
  const style =
    status === "done"
      ? "bg-emerald-50 text-emerald-800"
      : status === "not_done"
        ? "bg-amber-50 text-amber-900"
        : "bg-slate-100 text-slate-600";
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${style}`}
    >
      {ROLE_STATUS_LABELS[status as keyof typeof ROLE_STATUS_LABELS]}
    </span>
  );
}
function RecordSelect({
  value,
  disabled,
  onChange,
  label,
}: {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <select
      aria-label={label}
      className={roleInput}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      {Object.entries(ROLE_STATUS_LABELS).map(([key, text]) => (
        <option key={key} value={key}>
          {text}
        </option>
      ))}
    </select>
  );
}

export function RoleHistoryPage({ board }: RolePageProps) {
  const [month, setMonth] = useState(roleToday().slice(0, 7));
  const [selected, setSelected] = useState("");
  const [savingDate, setSavingDate] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const range = roleMonthRange(month);
  const { records, error, loading, refresh } = useRoleRecords(
    range.start,
    range.end,
    board.version,
  );
  const periods = board.state.periods.filter(
    (p) => p.start <= range.end && p.end >= range.start,
  );
  const students = [
    ...new Map(
      periods.flatMap((p) => p.students).map((s) => [s.id, s]),
    ).values(),
  ].sort((a, b) => a.number - b.number);
  const entries = (studentId: string) =>
    periods
      .flatMap((p) => {
        if (!p.students.some((s) => s.id === studentId)) return [];
        const student = p.students.find((s) => s.id === studentId)!;
        return roleDates(
          [p.start, range.start].sort().at(-1)!,
          [p.end, range.end, roleToday()].sort()[0],
        ).map((date) => ({
          date,
          period: p,
          record: statusFor(records, p, student, date),
          eligible: isRoleDay(board.state, p, studentId, date),
        }));
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  const student = students.find((s) => s.id === selected);
  const change = async (period: RolePeriod, date: string, status: string) => {
    if (!student || savingDate) return;
    setSavingDate(date);
    setSaveError("");
    setSaveMessage("");
    try {
      await writeRoleRecord({
        periodId: period.id,
        studentId: student.id,
        date,
        status,
        version: board.version,
      });
      refresh();
      setSaveMessage(`${student.number}번 ${student.name}의 ${date} 기록을 저장했습니다.`);
    } catch (cause) {
      setSaveError((cause as Error).message);
    } finally {
      setSavingDate("");
    }
  };
  return (
    <div className="space-y-5">
      <nav className={`${rolePanel} flex flex-wrap gap-2`} aria-label="실천 현황 보기">
        <Link to="/tools/classroom-roles/board" className={roleSecondary}>오늘·주간</Link>
        <span aria-current="page" className="inline-flex min-h-11 items-center rounded-lg bg-[#182B40] px-4 text-sm font-bold text-white">지난 기록</span>
      </nav>
      <section
        className={`${rolePanel} flex flex-wrap items-end justify-between gap-4`}
      >
        <RoleField label="조회 월">
          <input
            type="month"
            className={roleInput}
            value={month}
            onChange={(e) => {
              if (/^20\d{2}-\d{2}$/.test(e.target.value)) {
                setMonth(e.target.value);
                setSelected("");
                setSaveError("");
                setSaveMessage("");
              }
            }}
          />
        </RoleField>
        <p className="text-sm text-[#526174]">
          선택한 달의 기록만 표시합니다. 학생을 누르면 날짜별 상세를 볼 수
          있습니다.
        </p>
      </section>
      <RoleError message={error} />
      <RoleError message={saveError} />
      {saveMessage && <p role="status" className="text-sm font-semibold text-[#117447]">{saveMessage}</p>}
      {error && (
        <button className={roleSecondary} onClick={refresh}>
          다시 불러오기
        </button>
      )}
      {loading ? (
        <p role="status">기록을 불러오는 중…</p>
      ) : error ? null : !students.length ? (
        <section className={rolePanel}>이 달의 배정과 기록이 없습니다.</section>
      ) : (
        <>
          <div
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
            aria-label="학생별 월간 기록"
          >
            {students.map((s) => {
              const days = entries(s.id);
              const eligible = days.filter(
                (d) => d.eligible && d.record?.status !== "exempt",
              );
              const done = eligible.filter(
                (d) => d.record?.status === "done",
              ).length;
              const missed = eligible.filter(
                (d) => d.record?.status === "not_done",
              ).length;
              const missing = eligible.filter((d) => !d.record).length;
              return (
                <button
                  className={`${rolePanel} text-left hover:border-[#0F6CBD] ${selected === s.id ? "ring-2 ring-[#0F6CBD]" : ""}`}
                  key={s.id}
                  aria-pressed={selected === s.id}
                  onClick={() => {
                    setSelected(s.id);
                    window.setTimeout(
                      () =>
                        document
                          .getElementById("role-student-history")
                          ?.focus(),
                      0,
                    );
                  }}
                >
                  <h2 className="text-lg font-bold">
                    {s.number}번 {s.name}
                  </h2>
                  <p className="mt-3 text-sm">
                    했어요 {done} · 못했어요 {missed}
                  </p>
                  <p className="mt-2 text-sm text-[#64748B]">
                    미기록 {missing} · 해당 없음 {days.length - eligible.length}
                  </p>
                  <p className="mt-3 text-sm font-bold text-[#0F6CBD]">
                    날짜별 기록 보기 →
                  </p>
                </button>
              );
            })}
          </div>
          {student && (
            <section
              id="role-student-history"
              tabIndex={-1}
              className={`${rolePanel} space-y-4`}
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold">
                  {student.number}번 {student.name} · {month} 상세
                </h2>
                <button
                  className={roleSecondary}
                  onClick={() => setSelected("")}
                >
                  상세 닫기
                </button>
              </div>
              <p className="text-xs text-[#526174]">
                교사 전용 기록입니다. 미래 날짜는 집계하지 않습니다. 실천일이
                아닌 날의 제출도 상세에는 보존됩니다.
              </p>
              {entries(student.id).map(({ date, period, record, eligible }) => (
                <div
                  key={`${period.id}-${date}`}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] py-3"
                >
                  <div>
                    <p className="text-sm font-semibold">
                      {date} · {roleForStudent(period, student.id)?.name}
                    </p>
                    <p className="mt-1 text-xs text-[#64748B]">
                      {!eligible ? "실천일 아님 · " : ""}
                      {record
                        ? record.source === "teacher"
                          ? "교사 정정"
                          : "학생 자기보고"
                        : "제출 기록 없음"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusBadge status={record?.status ?? (eligible ? "missing" : "exempt")} />
                    <RecordSelect
                      label={`${student.number}번 ${student.name} ${date} 기록 정정`}
                      value={record?.status ?? "missing"}
                      disabled={Boolean(savingDate) || loading}
                      onChange={(status) => void change(period, date, status)}
                    />
                  </div>
                </div>
              ))}
              <p className="text-xs text-[#526174]">날짜별 상태를 이 자리에서 정정할 수 있습니다. 미기록을 선택하면 저장된 기록을 지웁니다.</p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
