import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { qrImageFileName, saveQrImage } from "../../utils/qrImage";
import {
  activeRolePeriod,
  isRoleDay,
  ROLE_STATUS_LABELS,
  roleForStudent,
  roleMonthRange,
  rolePublicUrl,
  roleToday,
  roleWeekDates,
  writeRoleRecord,
  type RoleRecord,
  type RoleStudent,
} from "./roleApi";
import type { RolePageProps } from "./ClassroomRolesWorkspace";
import { RoleError, roleInput, rolePanel, roleSecondary } from "./RoleControls";
import { useRoleRecords } from "./useRoleRecords";

const weekdays = ["월", "화", "수", "목", "금", "토", "일"];
type Cell = { symbol: string; label: string; tone: string };
function recordCell(record: RoleRecord | undefined, eligible: boolean, future = false): Cell {
  if (future) return { symbol: "·", label: "아직 오지 않은 날", tone: "text-[#94A3B8]" };
  if (record?.status === "done") return { symbol: "O", label: "했어요", tone: "text-[#117447]" };
  if (record?.status === "not_done") return { symbol: "X", label: "못했어요", tone: "text-[#AD4D2C]" };
  if (record?.status === "exempt" || !eligible) return { symbol: "·", label: "실천일 아님", tone: "text-[#94A3B8]" };
  return { symbol: "—", label: "미기록", tone: "text-[#64748B]" };
}

export function RolePracticeBoardPage({ board }: RolePageProps) {
  const today = roleToday();
  const week = roleWeekDates(today);
  const month = roleMonthRange(today.slice(0, 7));
  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "students" ? "students" : "all";
  const [selectedId, setSelectedId] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingQr, setSavingQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const qrRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  const period = activeRolePeriod(board.state, today);
  const url = rolePublicUrl(board.public_token);
  const { records, error: loadError, loading, refresh } = useRoleRecords(
    week[0] < month.start ? week[0] : month.start,
    today,
    board.version,
  );
  const students = [...(period?.students ?? [])].sort((a, b) => a.number - b.number);
  const selected = students.find((student) => student.id === selectedId);
  useEffect(() => {
    if (view === "students" && selected) {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      detailRef.current?.focus({ preventScroll: true });
    }
  }, [view, selectedId, selected]);
  const dayData = (student: RoleStudent, date: string) => {
    const dayPeriod = activeRolePeriod(board.state, date);
    if (!dayPeriod?.students.some((item) => item.id === student.id))
      return { record: undefined, eligible: false };
    return {
      record: records.find((record) => record.period_id === dayPeriod.id && record.student_id === student.id && record.record_date === date),
      eligible: isRoleDay(board.state, dayPeriod, student.id, date),
    };
  };
  const monthlyCount = (student: RoleStudent) => records.filter((record) => {
    if (record.student_id !== student.id || record.record_date < month.start || record.status !== "done") return false;
    const dayPeriod = board.state.periods.find((item) => item.id === record.period_id);
    return Boolean(dayPeriod && isRoleDay(board.state, dayPeriod, student.id, record.record_date));
  }).length;
  const change = async (student: RoleStudent, status: string) => {
    if (!period || saving) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await writeRoleRecord({ periodId: period.id, studentId: student.id, date: today, status, version: board.version });
      refresh();
      setMessage(`${student.number}번 ${student.name}의 교사 정정을 저장했습니다.`);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const openStudent = (id: string) => {
    setSelectedId(id);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError("주소를 복사하지 못했습니다. 주소 칸에서 직접 복사해 주세요.");
    }
  };
  const downloadQr = async () => {
    setSavingQr(true);
    setError("");
    try {
      await saveQrImage(qrRef.current, qrImageFileName(board.state.settings.title, "학생화면_QR", "1인1역"));
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setSavingQr(false);
    }
  };
  return (
    <div className="space-y-5">
      <section className={`${rolePanel} space-y-3`} aria-label="실천 현황 메뉴">
        <nav className="flex flex-wrap gap-2" aria-label="실천 현황 보기">
          <button type="button" onClick={() => setParams({ view: "all" })} aria-current={view === "all" ? "page" : undefined} className={`min-h-11 rounded-lg px-4 text-sm font-bold ${view === "all" ? "bg-[#182B40] text-white" : "border border-[#CAD4DD] text-[#253B4D]"}`}>주간 표</button>
          <button type="button" onClick={() => setParams({ view: "students" })} aria-current={view === "students" ? "page" : undefined} className={`min-h-11 rounded-lg px-4 text-sm font-bold ${view === "students" ? "bg-[#182B40] text-white" : "border border-[#CAD4DD] text-[#253B4D]"}`}>학생별</button>
          <Link to="/tools/classroom-roles/records" className="inline-flex min-h-11 items-center rounded-lg border border-[#CAD4DD] px-4 text-sm font-bold text-[#253B4D]">지난 기록</Link>
          <Link to="/tools/classroom-roles/manage" className="inline-flex min-h-11 items-center rounded-lg border border-[#CAD4DD] px-4 text-sm font-bold text-[#253B4D]">배정 관리</Link>
        </nav>
        <details className="rounded-lg border border-[#DCE3EA] bg-[#F8FAFC] px-4 py-2">
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold text-[#0F6CBD]">학생용 링크 · 교실 표시 · 게시판 안내문</summary>
          <div className="space-y-3 border-t border-[#DCE3EA] pt-3">
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
              <label htmlFor="role-public-url" className="shrink-0 text-sm font-semibold text-[#526174]">학생용 주소</label>
              <input id="role-public-url" aria-label="학생 공용 주소" className={`${roleInput} min-w-0 flex-1 text-sm`} readOnly value={url} onFocus={(event) => event.target.select()} />
              <button type="button" className={`${roleSecondary} shrink-0`} onClick={() => void copy()}>{copied ? "복사됨" : "주소 복사"}</button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <a href={url} target="_blank" rel="noopener noreferrer" className={roleSecondary}>학생 화면 열기</a>
              <a href={`${url}?view=display`} target="_blank" rel="noopener noreferrer" className={roleSecondary}>교실 표시 열기</a>
              <Link to="/tools/classroom-roles/print" className={roleSecondary}>게시판 안내문 인쇄</Link>
              <div ref={qrRef} className="rounded-md bg-white p-1"><QRCodeSVG value={url} size={88} level="M" aria-label="학생화면 URL QR 코드" /></div>
              <button type="button" disabled={savingQr} onClick={() => void downloadQr()} className="min-h-11 text-sm font-bold text-[#0F6CBD] disabled:opacity-50">{savingQr ? "저장 중…" : "QR 이미지 저장"}</button>
            </div>
            {!board.state.settings.publicEnabled && <p className="text-sm text-[#9A5610]">학생 화면과 입력이 중지되어 있습니다.</p>}
          </div>
        </details>
      </section>
      <RoleError message={error || loadError} />
      {message && <p role="status" className="text-sm font-semibold text-[#117447]">{message}</p>}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">{view === "all" ? "이번 주 실천 기록" : "학생별 오늘 기록"}</h2>
        <button type="button" className="min-h-11 text-sm font-semibold text-[#0F6CBD]" onClick={refresh}>기록 새로고침</button>
      </div>
      {loading ? <p role="status">기록을 불러오는 중…</p> : loadError ? <p>기록을 다시 불러와 주세요.</p> : !period ? <section className={rolePanel}>오늘 배정된 역할이 없습니다. <Link className="font-bold text-[#0F6CBD] underline" to="/tools/classroom-roles/manage">배정 관리</Link></section> : view === "all" ? (
        <section className={`${rolePanel} p-0 sm:p-0`} aria-label="학생별 이번 주 실천과 이번 달 횟수">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[820px] border-collapse text-left text-sm">
              <caption className="sr-only">이번 주 날짜별 실천과 이번 달 활동 횟수. O는 했어요, X는 못했어요, —는 미기록, ·은 실천일 아님 또는 미래 날짜입니다.</caption>
              <thead className="bg-[#F3F6F8] text-[#526174]"><tr>
                <th className="px-4 py-3 font-semibold" scope="col">번호</th><th className="px-3 py-3 font-semibold" scope="col">이름</th><th className="px-3 py-3 font-semibold" scope="col">역할</th>
                {week.map((date, index) => <th key={date} scope="col" className={`px-2 py-3 text-center font-semibold ${date === today ? "bg-[#E7F1F7] text-[#173A52]" : ""}`}><span className="block">{weekdays[index]}</span><span className="block text-xs">{date.slice(5).replace("-", "/")}</span></th>)}
                <th className="whitespace-nowrap px-4 py-3 text-right font-semibold" scope="col">이번 달</th>
              </tr></thead>
              <tbody>{students.map((student) => <tr key={student.id} className="border-t border-[#E3E8EC] hover:bg-[#F8FAFB]">
                <td className="px-4 py-3 tabular-nums">{student.number}</td>
                <td className="px-3 py-2"><button type="button" className="min-h-11 text-left font-semibold text-[#163B56] underline-offset-2 hover:underline focus-visible:underline" onClick={() => { setParams({ view: "students" }); openStudent(student.id); }}>{student.name}</button></td>
                <td className="max-w-[200px] px-3 py-3 text-[#34485A]">{roleForStudent(period, student.id)?.name ?? "—"}</td>
                {week.map((date) => { const data = dayData(student, date); const cell = recordCell(data.record, data.eligible, date > today); return <td key={date} className={`px-2 py-3 text-center text-base font-bold ${date === today ? "bg-[#F4F9FC]" : ""} ${cell.tone}`} aria-label={`${date} ${cell.label}`} title={`${date} ${cell.label}`}>{cell.symbol}</td>; })}
                <td className="px-4 py-3 text-right font-bold tabular-nums">{monthlyCount(student)}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <div className="divide-y divide-[#E3E8EC] md:hidden">
            {students.map((student) => <article key={student.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><button type="button" className="min-h-11 text-left font-semibold text-[#163B56]" onClick={() => { setParams({ view: "students" }); openStudent(student.id); }}>{student.number} {student.name}</button><p className="break-words text-xs text-[#526174]">{roleForStudent(period, student.id)?.name ?? "역할 없음"}</p></div>
                <div className="shrink-0 text-right"><span className="block text-[11px] text-[#64748B]">이번 달</span><strong className="text-base tabular-nums">{monthlyCount(student)}</strong></div>
              </div>
              <div className="mt-2 grid grid-cols-7 gap-1" aria-label={`${student.number}번 ${student.name} 이번 주`}>
                {week.map((date, index) => { const data = dayData(student, date); const cell = recordCell(data.record, data.eligible, date > today); return <div key={date} className={`rounded-md py-1 text-center ${date === today ? "bg-[#E7F1F7]" : "bg-[#F7F9FA]"}`} aria-label={`${date} ${cell.label}`}><span className="block text-[10px] text-[#64748B]">{weekdays[index]}</span><span className={`block text-sm font-bold ${cell.tone}`}>{cell.symbol}</span></div>; })}
              </div>
            </article>)}
          </div>
          {students.length === 0 && <p className="p-5 text-sm text-[#526174]">배정된 학생이 없습니다.</p>}
        </section>
      ) : <>
        {selected && <section ref={detailRef} tabIndex={-1} className={`${rolePanel} space-y-4`} aria-label={`${selected.number}번 ${selected.name} 실천 상세`}>
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-[#526174]">{selected.number}번 {selected.name}</p><h3 className="mt-1 text-xl font-bold">{roleForStudent(period, selected.id)?.name ?? "역할 없음"}</h3></div><button type="button" className={roleSecondary} onClick={() => setSelectedId("")}>상세 닫기</button></div>
          <div><p className="text-sm font-semibold">이번 주</p><div className="mt-2 flex flex-wrap gap-2">{week.map((date, index) => { const data = dayData(selected, date); const cell = recordCell(data.record, data.eligible, date > today); return <div key={date} className="min-w-12 rounded-lg border border-[#DCE3EA] px-2 py-2 text-center"><span className="block text-xs text-[#526174]">{weekdays[index]}</span><span className={`text-lg font-bold ${cell.tone}`} title={cell.label}>{cell.symbol}</span></div>; })}</div></div>
          <div className="flex flex-wrap items-center gap-3 border-t border-[#E3E8EC] pt-4"><p className="text-sm font-semibold">오늘 {recordCell(dayData(selected, today).record, dayData(selected, today).eligible).label}</p><select aria-label={`${selected.number}번 ${selected.name} 기록 정정`} className={`${roleInput} max-w-52`} value={dayData(selected, today).record?.status ?? "missing"} disabled={saving} onChange={(event) => void change(selected, event.target.value)}>{Object.entries(ROLE_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        </section>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="학생 선택">
          {students.map((student) => { const data = dayData(student, today); const cell = recordCell(data.record, data.eligible); return <button key={student.id} type="button" aria-pressed={selectedId === student.id} onClick={() => openStudent(student.id)} className={`min-w-0 rounded-xl border bg-white p-4 text-left focus-visible:outline-2 focus-visible:outline-[#0F6CBD] ${selectedId === student.id ? "border-[#0F6CBD] ring-1 ring-[#0F6CBD]" : "border-[#DCE3EA] hover:border-[#0F6CBD]"}`}><span className="block text-xs text-[#64748B]">{student.number}번</span><span className="mt-1 block break-words text-base font-bold">{student.name}</span><span className="mt-2 block break-words text-xs text-[#526174]">{roleForStudent(period, student.id)?.name ?? "역할 없음"}</span><span className={`mt-3 block text-sm font-bold ${cell.tone}`}>오늘 {cell.label}</span></button>; })}
        </div>
      </>}
      <p className="text-xs text-[#64748B]">O 했어요 · X 못했어요 · — 미기록 · · 실천일 아님/미래</p>
    </div>
  );
}
