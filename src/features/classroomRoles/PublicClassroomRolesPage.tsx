import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  isRolesDemo,
  loadPublicRoleBoard,
  ROLE_STATUS_LABELS,
  writeRoleRecord,
  type PublicRoleBoard,
} from "./roleApi";
import { RoleError, roleSecondary } from "./RoleControls";

const weekdays = ["월", "화", "수", "목", "금", "토", "일"];
type Student = PublicRoleBoard["students"][number];

function maskedName(name: string) {
  return name.length <= 1 ? "○" : name[0] + "○".repeat(name.length - 1);
}

function weekMark(day: PublicRoleBoard["week"][number], today: string) {
  if (day.date > today) {
    return { symbol: "·", label: "아직 오지 않은 날", tone: "text-[#8A97A6]" };
  }
  if (!day.eligible || day.status === "exempt") {
    return { symbol: "·", label: "실천일 아님", tone: "text-[#8A97A6]" };
  }
  if (day.status === "done") {
    return { symbol: "O", label: "했어요", tone: "text-[#117447]" };
  }
  if (day.status === "not_done") {
    return { symbol: "X", label: "못했어요", tone: "text-[#A84B2E]" };
  }
  return { symbol: "—", label: "미기록", tone: "text-[#64748B]" };
}

export function PublicClassroomRolesPage() {
  const { token = "" } = useParams();
  const [params] = useSearchParams();
  const display = params.get("view") === "display";
  const [board, setBoard] = useState<PublicRoleBoard | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [loadedSelectedId, setLoadedSelectedId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [displayPage, setDisplayPage] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const tileRefs = useRef(new Map<string, HTMLButtonElement>());
  const student = board?.students.find((item) => item.id === selectedId);
  const search = query.trim();
  const matchedStudents = board?.students.filter((item) =>
    /^\d+$/.test(search)
      ? item.number === Number(search)
      : `${item.number} ${item.name}`.includes(search),
  ) ?? [];
  const displayPageCount = Math.max(1, Math.ceil((board?.students.length ?? 0) / 25));
  const visibleStudents = display
    ? board?.students.slice(displayPage * 25, displayPage * 25 + 25) ?? []
    : matchedStudents;

  useEffect(() => {
    if (displayPage >= displayPageCount) setDisplayPage(displayPageCount - 1);
  }, [displayPage, displayPageCount]);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    setLoadedSelectedId("");
    const refresh = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const next = await loadPublicRoleBoard(token, selectedId || undefined);
        if (!cancelled) {
          setBoard(next);
          setLoadedSelectedId(selectedId);
          setError("");
        }
      } catch (cause) {
        if (!cancelled) setError((cause as Error).message);
      } finally {
        inFlight = false;
        if (!cancelled) setLoading(false);
      }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 30000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [token, selectedId, retry]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (selectedId && student && !dialog.open) dialog.showModal();
    if ((!selectedId || !student) && dialog.open) dialog.close();
  }, [selectedId, student]);

  const closeDetail = () => dialogRef.current?.close();
  const onDetailClose = () => {
    const id = selectedId;
    setSelectedId("");
    setMessage("");
    window.requestAnimationFrame(() => tileRefs.current.get(id)?.focus());
  };

  const submit = async (status: "done" | "not_done") => {
    if (!student || !board?.periodId || busy || loading || error || !student.eligible || student.teacherConfirmed || loadedSelectedId !== selectedId) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await writeRoleRecord({
        token,
        periodId: board.periodId,
        studentId: student.id,
        date: board.today,
        status,
      });
      setMessage(ROLE_STATUS_LABELS[status] + "로 저장했어요.");
      setRetry((value) => value + 1);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const tileStatus = (item: Student) => {
    if (!item.eligible) return "오늘 실천일 아님";
    if (!board?.showStatus) return "";
    return "오늘 " + ROLE_STATUS_LABELS[item.status ?? "missing"];
  };
  const statusTone = (item: Student) =>
    !item.eligible ? "bg-[#F2F4F6] text-[#566474]"
      : item.status === "done" ? "bg-[#E7F6ED] text-[#176C43]"
        : item.status === "not_done" ? "bg-[#FFF0E8] text-[#A44627]"
          : "bg-[#EDF3F8] text-[#36576E]";
  const tileClass =
    "flex min-h-32 min-w-0 flex-col gap-3 rounded-xl border border-[#DCE3EA] bg-white p-4 text-left" +
    (display ? " justify-center sm:min-h-[14dvh]" : " justify-between");
  const tileContents = (item: Student) => (
    <>
      <span className={"block break-words font-bold leading-snug text-[#152336] " +
        (display ? "text-lg sm:text-2xl" : "text-lg sm:text-xl")}>
        {item.role.name}
      </span>
      <span className="block">
        <span className="block break-words text-sm font-semibold text-[#334155]">
          {item.number}번 {display && board?.maskDisplayNames ? maskedName(item.name) : item.name}
        </span>
        {tileStatus(item) && (
          <span className={"mt-2 inline-block rounded-full px-2.5 py-1 font-bold " +
            (display ? "text-sm sm:text-base " : "text-xs sm:text-sm ") + statusTone(item)}>
            {tileStatus(item)}
          </span>
        )}
      </span>
    </>
  );
  const week = loadedSelectedId === selectedId ? board?.week ?? [] : [];
  const weekDone = week.filter((day) => day.eligible && day.status === "done").length;
  const weekEligible = week.filter(
    (day) => day.eligible && day.status !== "exempt" && day.date <= (board?.today ?? ""),
  ).length;

  return (
    <main className="min-h-screen bg-[#F6F8FB] px-4 py-5 text-[#0F172A] sm:px-8">
      <div className={"mx-auto space-y-4 " + (display ? "max-w-none" : "max-w-7xl")}>
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            {board?.title ?? "우리 반 1인 1역"}
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[#526174]">{board?.today}</span>
            {display && (
              <button
                type="button"
                className={roleSecondary}
                onClick={() =>
                  void document.documentElement.requestFullscreen?.().catch(() =>
                    setError("전체 화면을 지원하지 않는 브라우저입니다."),
                  )
                }
              >
                전체 화면
              </button>
            )}
          </div>
          {isRolesDemo && (
            <p className="w-full text-xs text-[#526174]">
              개발 데모 · 이 브라우저에만 저장됩니다.
            </p>
          )}
        </header>
        {!selectedId && <RoleError message={error} />}
        {error && !selectedId && (
          <button type="button" className={roleSecondary} onClick={() => setRetry((value) => value + 1)}>
            다시 불러오기
          </button>
        )}
        {loading && !board ? (
          <p role="status">불러오는 중…</p>
        ) : !board?.periodId ? (
          <section className="rounded-xl border border-[#DCE3EA] bg-white p-5">
            {board?.message || "사용할 수 없는 학급 화면입니다."}
          </section>
        ) : (
          <section aria-label="학생 역할과 오늘 상태">
            {!display && board.students.length > 12 && (
              <div className="mb-4 max-w-md">
                <label htmlFor="role-student-search" className="block text-sm font-semibold text-[#526174]">내 번호 또는 이름 찾기</label>
                <input
                  id="role-student-search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="번호 또는 이름"
                  className="mt-2 min-h-11 w-full rounded-lg border border-[#CAD4DD] bg-white px-3 text-base focus-visible:outline-2 focus-visible:outline-[#0F6CBD]"
                />
              </div>
            )}
            {display && displayPageCount > 1 && (
              <nav className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white px-4 py-2" aria-label="교실 표시 페이지">
                <span className="text-sm font-bold">{displayPage + 1}/{displayPageCount}쪽 · {board.students.length}명</span>
                <div className="flex gap-2">
                  <button type="button" className={roleSecondary} disabled={displayPage === 0} onClick={() => setDisplayPage((page) => page - 1)}>이전</button>
                  <button type="button" className={roleSecondary} disabled={displayPage >= displayPageCount - 1} onClick={() => setDisplayPage((page) => page + 1)}>다음</button>
                </div>
              </nav>
            )}
            {board.students.length === 0 && (
              <p className="rounded-xl border border-[#DCE3EA] bg-white p-5 text-[#526174]">
                아직 배정된 학생이 없어요.
              </p>
            )}
            {!display && board.students.length > 0 && matchedStudents.length === 0 && (
              <p role="status" className="rounded-xl border border-[#DCE3EA] bg-white p-5 text-sm text-[#526174]">찾는 학생이 없어요. 번호나 이름을 다시 입력해 주세요.</p>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {visibleStudents.map((item) => display ? (
                <article key={item.id} className={tileClass}>
                  {tileContents(item)}
                </article>
              ) : (
                <button
                  key={item.id}
                  type="button"
                  ref={(element) => {
                    if (element) tileRefs.current.set(item.id, element);
                    else tileRefs.current.delete(item.id);
                  }}
                  className={tileClass + " hover:border-[#0F6CBD] hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F6CBD]"}
                  aria-label={item.number + "번 " + item.name}
                  aria-describedby={"student-tile-" + item.id}
                  disabled={Boolean(error)}
                  onClick={() => {
                    setMessage("");
                    setSelectedId(item.id);
                  }}
                >
                  {tileContents(item)}
                  <span id={"student-tile-" + item.id} className="sr-only">
                    {item.role.name} · {tileStatus(item) || "오늘 상태 비공개"}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
      <dialog
        ref={dialogRef}
        onClose={onDetailClose}
        aria-labelledby="public-role-detail-title"
        className="w-[min(94vw,520px)] max-h-[calc(100dvh-24px)] overflow-y-auto rounded-2xl border border-[#DCE3EA] bg-white p-0 text-[#0F172A] shadow-2xl backdrop:bg-[#122032]/50"
      >
        {student && board && (
          <div className="space-y-5 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#526174]">
                  {student.number}번 {student.name}
                </p>
                <h2 id="public-role-detail-title" className="mt-1 break-words text-2xl font-extrabold">
                  {student.role.name}
                </h2>
              </div>
              <button
                type="button"
                className="min-h-11 min-w-11 rounded-lg border border-[#CBD5E1] text-xl focus-visible:outline-2 focus-visible:outline-[#0F6CBD]"
                aria-label="상세 닫기"
                onClick={closeDetail}
              >
                ×
              </button>
            </div>
            {student.role.description.trim() && (
              <p className="rounded-xl bg-[#EFF6FC] px-4 py-3 text-base leading-7 text-[#173A52]">
                <span className="block text-sm font-bold">내가 할 일</span>
                {student.role.description}
              </p>
            )}
            <div className="border-t border-[#E2E8F0] pt-4">
              <p className="text-sm font-semibold">
                이번 주 <strong className="ml-1 text-base">{weekDone}/{weekEligible}일</strong>
              </p>
              {week.length ? (
                <div className="mt-3 grid grid-cols-7 gap-1" aria-label="이번 주 실천 기록">
                  {week.map((day, index) => {
                    const mark = weekMark(day, board.today);
                    return (
                      <div
                        key={day.date}
                        aria-label={day.date + " " + mark.label}
                        className="rounded-lg bg-[#F5F7F9] px-1 py-2 text-center"
                      >
                        <span className="block text-xs text-[#526174]">{weekdays[index]}</span>
                        <span className={"mt-1 block text-lg font-bold " + mark.tone}>{mark.symbol}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p role="status" className="mt-2 text-sm text-[#526174]">주간 기록을 불러오는 중…</p>
              )}
            </div>
            <div className="border-t border-[#E2E8F0] pt-4">
              {student.teacherConfirmed ? (
                <p className="text-sm font-semibold text-[#36576E]">
                  선생님이 오늘 기록을 확인했어요. 수정이 필요하면 선생님께 알려 주세요.
                </p>
              ) : student.eligible ? (
                <>
                  <p className="mb-3 text-sm font-semibold">
                    오늘 <span className="ml-1 text-[#526174]">{ROLE_STATUS_LABELS[student.status ?? "missing"]}</span>
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      aria-pressed={student.status === "done"}
                      className={"min-h-14 rounded-xl border-2 px-3 text-lg font-bold disabled:opacity-50 " +
                        (student.status === "done" ? "border-[#0F6CBD] bg-[#0F6CBD] text-white" : "border-[#B9CBD9] bg-white text-[#173A52]")}
                      disabled={busy || Boolean(error) || loadedSelectedId !== selectedId}
                      onClick={() => void submit("done")}
                    >
                      {busy ? "저장 중…" : "했어요"}
                    </button>
                    <button
                      type="button"
                      aria-pressed={student.status === "not_done"}
                      className={"min-h-14 rounded-xl border-2 px-3 text-lg font-bold disabled:opacity-50 " +
                        (student.status === "not_done" ? "border-[#A84B2E] bg-[#A84B2E] text-white" : "border-[#D2C3BC] bg-white text-[#5D4036]")}
                      disabled={busy || Boolean(error) || loadedSelectedId !== selectedId}
                      onClick={() => void submit("not_done")}
                    >
                      {busy ? "저장 중…" : "못했어요"}
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-sm font-semibold text-[#526174]">
                  오늘은 실천일이 아니에요.
                </p>
              )}
              {message && <p role="status" className="mt-3 text-sm font-semibold text-[#117447]">{message}</p>}
              <RoleError message={error} />
              {error && <button type="button" className={roleSecondary} onClick={() => setRetry((value) => value + 1)}>다시 불러오기</button>}
            </div>
          </div>
        )}
      </dialog>
    </main>
  );
}
