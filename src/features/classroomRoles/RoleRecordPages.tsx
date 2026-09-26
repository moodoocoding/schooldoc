import { useState } from "react";
import { Link } from "react-router-dom";
import {
  activeRolePeriod,
  isRoleDay,
  ROLE_STATUS_LABELS,
  roleDates,
  roleForStudent,
  roleMonthRange,
  rolePublicUrl,
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
  roleButton,
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

export function RolePracticePage({ board }: RolePageProps) {
  const [date, setDate] = useState(roleToday());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const {
    records,
    error: loadError,
    loading,
    refresh,
  } = useRoleRecords(date, date, board.version);
  const period = activeRolePeriod(board.state, date);
  const url = rolePublicUrl(board.public_token);
  const change = async (studentId: string, status: string) => {
    if (!period || saving) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await writeRoleRecord({
        periodId: period.id,
        studentId,
        date,
        status,
        version: board.version,
      });
      refresh();
      setMessage("교사 정정을 저장했습니다.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError("복사하지 못했습니다. 아래 주소를 선택해 복사해 주세요.");
    }
  };
  return (
    <div className="space-y-5">
      <section className={`${rolePanel} space-y-4`}>
        <div>
          <h2 className="text-lg font-bold">하나의 화면, 두 가지 사용 방식</h2>
          <p className="mt-2 text-sm text-[#526174]">
            학생 입력은 이름 선택 → 실천 체크, 전자칠판 보기는 입력 없는
            표시용입니다. 모든 학생이 같은 링크를 사용합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            className={roleButton}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
          >
            학생 화면 열기
          </a>
          <button className={roleSecondary} onClick={() => void copy()}>
            {copied ? "링크 복사됨" : "학생 공용 링크 복사"}
          </button>
          <a
            className={roleSecondary}
            href={`${url}?view=display`}
            target="_blank"
            rel="noopener noreferrer"
          >
            전자칠판 보기
          </a>
        </div>
        <RoleField label="학생 공용 주소">
          <input
            readOnly
            value={url}
            className={roleInput}
            onFocus={(e) => e.target.select()}
          />
        </RoleField>
        {!board.state.settings.publicEnabled && (
          <p className="text-sm text-amber-800">
            운영 설정에서 학생 입력을 중지한 상태입니다.
          </p>
        )}
      </section>
      <section className={`${rolePanel} space-y-4`}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <RoleField label="확인할 날짜">
            <input
              type="date"
              className={roleInput}
              value={date}
              max={roleToday()}
              onChange={(e) => {
                if (e.target.value) {
                  setDate(e.target.value);
                  setMessage("");
                }
              }}
            />
          </RoleField>
          <button
            className={roleSecondary}
            onClick={() => setDate(roleToday())}
          >
            오늘로
          </button>
          <button className={roleSecondary} onClick={refresh}>
            기록 새로고침
          </button>
        </div>
        <p className="text-sm text-[#526174]">
          학생 자기보고입니다. 미기록은 아직 제출하지 않은 상태입니다. 결석·역할
          없음은 ‘해당 없음’으로 정정할 수 있습니다. 30초마다 갱신됩니다.
        </p>
        <RoleError message={error || loadError} />
        {message && (
          <p role="status" className="text-sm text-emerald-800">
            {message}
          </p>
        )}
        {loading ? (
          <p role="status">기록을 불러오는 중…</p>
        ) : loadError ? (
          <p>새로고침하여 기록을 확인해 주세요.</p>
        ) : !period ? (
          <p>
            이 날짜에 배정된 역할이 없습니다.{" "}
            <Link
              className="text-[#0F6CBD] underline"
              to="/tools/classroom-roles/assign"
            >
              학생 역할 배정
            </Link>
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {period.students.map((s) => {
              const record = statusFor(records, period, s, date);
              const eligible = isRoleDay(board.state, period, s.id, date);
              return (
                <article
                  key={s.id}
                  className="rounded-xl border border-[#DCE3EA] p-4"
                >
                  <div className="flex justify-between gap-2">
                    <h3 className="font-bold">
                      {s.number}번 {s.name}
                    </h3>
                    <StatusBadge
                      status={
                        record?.status ?? (eligible ? "missing" : "exempt")
                      }
                    />
                  </div>
                  <p className="mt-2 text-sm text-[#526174]">
                    {roleForStudent(period, s.id)?.name}
                  </p>
                  {!eligible && (
                    <p className="mt-1 text-xs text-[#64748B]">
                      실천일 아님{record ? " · 기존 제출 기록 표시" : ""}
                    </p>
                  )}
                  <RecordSelect
                    label={`${s.number}번 ${s.name} 기록 정정`}
                    value={record?.status ?? "missing"}
                    disabled={saving || date > roleToday()}
                    onChange={(status) => void change(s.id, status)}
                  />
                  {record && (
                    <p className="mt-2 text-xs text-[#64748B]">
                      {record.source === "teacher"
                        ? "교사 정정"
                        : "학생 자기보고"}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export function RoleHistoryPage({ board }: RolePageProps) {
  const [month, setMonth] = useState(roleToday().slice(0, 7));
  const [selected, setSelected] = useState("");
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
  return (
    <div className="space-y-5">
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
                  <StatusBadge
                    status={record?.status ?? (eligible ? "missing" : "exempt")}
                  />
                </div>
              ))}
              <Link
                className="inline-block text-sm font-bold text-[#0F6CBD]"
                to="/tools/classroom-roles/board"
              >
                실천판에서 기록 정정 →
              </Link>
            </section>
          )}
        </>
      )}
    </div>
  );
}
