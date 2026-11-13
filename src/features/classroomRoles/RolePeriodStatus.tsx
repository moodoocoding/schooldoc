import { useState } from "react";
import { Link } from "react-router-dom";
import { RoleCountGrid, RoleError, roleInput, rolePanel, roleSecondary } from "./RoleControls";
import { activeRolePeriod, ROLE_STATUS_LABELS, roleToday, type RoleBoard, type RolePeriod } from "./roleApi";
import { summarizeRolePeriod } from "./rolePeriodStats";
import { useRoleRecords } from "./useRoleRecords";

function StudentResults({ rows, byNumber, setByNumber }: {
  rows: ReturnType<typeof summarizeRolePeriod>;
  byNumber: boolean;
  setByNumber: (value: boolean) => void;
}) {
  const sorted = [...rows].sort((a, b) =>
    (byNumber ? 0 : b.done - a.done) || a.student.number - b.student.number,
  );
  return (
    <>
      <div className="my-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[#526174]">{rows.length}명 · 배정된 실천일 기준</p>
        <div>
          <select
            aria-label="학생 통계 정렬"
            className={roleInput}
            value={byNumber ? "number" : "done"}
            onChange={(event) => setByNumber(event.target.value === "number")}
          >
            <option value="done">성공 횟수순</option>
            <option value="number">학생 번호순</option>
          </select>
        </div>
      </div>
      <div className="-mx-2 sm:mx-0">
        <table className="w-full border-collapse text-center text-sm tabular-nums" aria-label="운영 기간 학생별 실천 횟수">
          <thead className="whitespace-nowrap border-y border-slate-200 bg-slate-50 text-[#334155]">
            <tr>
              <th scope="col" className="w-2/5 px-1 py-2.5 text-left sm:px-3">학생</th>
              <th scope="col" className="px-1 py-2.5">성공 횟수</th>
              <th scope="col" className="px-1 py-2.5">{ROLE_STATUS_LABELS.not_done}</th>
              <th scope="col" className="px-1 py-2.5">{ROLE_STATUS_LABELS.missing}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {sorted.map(({ student, done, notDone, missing }) => (
              <tr key={student.id}>
                <th scope="row" className="px-1 py-2.5 text-left font-semibold [overflow-wrap:anywhere] sm:px-3">
                  <span className="mr-1.5 inline-block font-normal text-[#526174]">{student.number}번</span>
                  {student.name}
                </th>
                <td className="px-1 py-2.5 font-bold">{done}</td>
                <td className="px-1 py-2.5">{notDone}</td>
                <td className="px-1 py-2.5 text-[#526174]">{missing}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PeriodResults({ board, period, today, detail }: {
  board: RoleBoard;
  period: RolePeriod;
  today: string;
  detail: boolean;
}) {
  const through = today < period.end ? today : period.end;
  const { records, error, loading, refresh } = useRoleRecords(period.start, through, board.version, { live: false });
  const [byNumber, setByNumber] = useState(false);
  const rows = error || loading ? [] : summarizeRolePeriod(board.state, period, through, records);
  const totals = rows.reduce((total, row) => ({
    done: total.done + row.done,
    notDone: total.notDone + row.notDone,
    missing: total.missing + row.missing,
  }), { done: 0, notDone: 0, missing: 0 });

  return (
    <>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
        <h2 id="role-period-status-title" className="font-bold">
          {detail ? "학생별 실천 횟수" : "이달의 현황"}
        </h2>
        <p className="col-span-2 row-start-2 text-sm leading-6 text-[#526174] sm:col-span-1 sm:col-start-2 sm:row-start-1">
          {period.end < today && "최근 종료 기간 · "}
          <span className="inline-block">{period.start} ~ {period.end}</span>
          {detail && through < period.end && (
            <span className="block sm:ml-2 sm:inline-block sm:before:mr-2 sm:before:content-['·']">
              {through}까지 집계
            </span>
          )}
        </p>
        {detail ? (
          <button type="button" className={`${roleSecondary} col-start-2 row-start-1 sm:col-start-3`} disabled={loading} onClick={refresh}>
            {error ? "집계 다시 불러오기" : "집계 새로고침"}
          </button>
        ) : (
          <Link
            to="/tools/classroom-roles/period"
            aria-label="이달의 실천 현황 보기"
            className="-my-2 col-start-2 row-start-1 inline-flex min-h-11 items-center text-sm font-bold text-[#0F6CBD] sm:col-start-3"
          >
            실천 현황 보기 →
          </Link>
        )}
      </div>
      {error ? (
        <div className="mt-3 space-y-2">
          <RoleError message={error} />
          {!detail && <button type="button" className={roleSecondary} onClick={refresh}>집계 다시 불러오기</button>}
        </div>
      ) : loading ? (
        <p role="status" className="mt-4 text-sm text-[#526174]">운영 기간의 기록을 불러오는 중…</p>
      ) : detail ? (
        <StudentResults rows={rows} byNumber={byNumber} setByNumber={setByNumber} />
      ) : (
        <>
          <RoleCountGrid unit="회" counts={[
            [ROLE_STATUS_LABELS.done, totals.done],
            [ROLE_STATUS_LABELS.not_done, totals.notDone],
            [ROLE_STATUS_LABELS.missing, totals.missing],
          ]} />
          <p className="mt-4 text-xs text-[#526174]">
            {through < period.end && `${through}까지 집계 · `}배정된 실천일 기준
          </p>
        </>
      )}
    </>
  );
}

export function RolePeriodStatus({ board, today = roleToday(), detail = false }: {
  board: RoleBoard;
  today?: string;
  detail?: boolean;
}) {
  const period = activeRolePeriod(board.state, today) ?? board.state.periods
    .filter(({ end }) => end < today)
    .sort((a, b) => b.end.localeCompare(a.end))[0];

  return (
    <section className={`${rolePanel} ${detail ? "" : "bg-[#EFF6FC]"}`} aria-labelledby="role-period-status-title">
      {period ? (
        <PeriodResults key={`${period.id}:${today}`} board={board} period={period} today={today} detail={detail} />
      ) : (
        <>
          <h2 id="role-period-status-title" className="font-bold">
            {detail ? "학생별 실천 횟수" : "이달의 현황"}
          </h2>
          <p className="mt-4 text-sm text-[#526174]">집계할 운영 기간이 없습니다.</p>
        </>
      )}
    </section>
  );
}
