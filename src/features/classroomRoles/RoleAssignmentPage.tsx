import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  activeRolePeriod,
  parseRoleRoster,
  roleMonthRange,
  roleToday,
  validateRoleStateChange,
  type ClassroomRole,
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
import { RoleStudentPicker } from "./RoleStudentPicker";
import { useUnsavedRoleChanges } from "./useUnsavedRoleChanges";

const mobileRosterPreviewCount = 6;

export function RoleAssignmentPage({
  board,
  save,
  busy,
  rotate = false,
}: RolePageProps & { rotate?: boolean }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const changeCurrent = !rotate && searchParams.get("mode") === "current";
  const today = roleToday();
  const active = activeRolePeriod(board.state, today);
  const previous = [...board.state.periods].sort((a, b) =>
    b.end.localeCompare(a.end),
  )[0];
  const initialRoster = board.state.roster.length
    ? board.state.roster
    : (changeCurrent ? active?.students : previous?.students) ?? [];
  const initialStart = previous
    ? new Date(Date.parse(`${previous.end}T00:00:00Z`) + 86400000)
        .toISOString()
        .slice(0, 10)
    : roleMonthRange(today.slice(0, 7)).start;
  const suggestedStart = changeCurrent
    ? new Date(Date.parse(`${today}T00:00:00Z`) + 86400000).toISOString().slice(0, 10)
    : rotate && initialStart < today ? today : initialStart;
  const [step, setStep] = useState(() => rotate ? 1 : searchParams.get("step") === "roles" && initialRoster.length > 0 ? 2 : 1);
  const [text, setText] = useState(
    initialRoster.map((s) => `${s.number} ${s.name}`).join("\n"),
  );
  const [students, setStudents] = useState<RoleStudent[]>(() =>
    [...initialRoster].sort((a, b) => a.number - b.number),
  );
  const [editingRoster, setEditingRoster] = useState(!initialRoster.length);
  const [rosterExpanded, setRosterExpanded] = useState(false);
  const rosterInputRef = useRef<HTMLTextAreaElement>(null);
  const rosterHeadingRef = useRef<HTMLHeadingElement>(null);
  const rosterFocus = useRef(false);
  useEffect(() => {
    if (!rosterFocus.current) return;
    (editingRoster
      ? rosterInputRef.current
      : rosterHeadingRef.current
    )?.focus();
    rosterFocus.current = false;
  }, [editingRoster]);
  const [roles, setRoles] = useState<ClassroomRole[]>(() => {
    const catalog = structuredClone(board.state.roles);
    if (!changeCurrent || !active) return catalog;
    for (const role of active.roles)
      if (!catalog.some((item) => item.id === role.id)) catalog.push(role);
    return catalog;
  });
  const [assignments, setAssignments] = useState<Record<string, string>>(() =>
    changeCurrent && active
      ? Object.fromEntries(
          initialRoster
            .filter((student) => active.assignments[student.id])
            .map((student) => [student.id, active.assignments[student.id]]),
        )
      : {},
  );
  const [start, setStart] = useState(suggestedStart);
  const [end, setEnd] = useState(changeCurrent && active ? active.end : roleMonthRange(suggestedStart.slice(0, 7)).end);
  const [error, setError] = useState("");
  const [periodError, setPeriodError] = useState("");
  const [periodEditing, setPeriodEditing] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [focusUnassignedSignal, setFocusUnassignedSignal] = useState(0);
  const [draftChanged, setDraftChanged] = useState(false);
  const reviewDialogRef = useRef<HTMLDialogElement>(null);
  const reviewButtonRef = useRef<HTMLButtonElement>(null);
  const mobileReviewButtonRef = useRef<HTMLButtonElement>(null);
  const unassigned = students.filter((s) => !assignments[s.id]).length;
  const monthlyRange = start ? roleMonthRange(start.slice(0, 7)) : null;
  const periodLabel = start && monthlyRange && start === monthlyRange.start && end === monthlyRange.end
    ? `${Number(start.slice(5, 7))}월`
    : start && end ? `${start} ~ ${end}` : "기간 미정";
  const seatShortage = Math.max(
    0,
    students.length - roles.reduce((total, role) => total + role.capacity, 0),
  );
  const reviewRows = roles.map((role) => ({
    role,
    members: students.filter((student) => assignments[student.id] === role.id),
  })).filter(({ members }) => members.length > 0);
  useEffect(() => {
    const dialog = reviewDialogRef.current;
    if (reviewOpen && dialog && !dialog.open) dialog.showModal();
    if (!reviewOpen && dialog?.open) dialog.close();
  }, [reviewOpen]);
  useUnsavedRoleChanges(
    draftChanged || (editingRoster && text !== students.map((student) => `${student.number} ${student.name}`).join("\n")),
  );
  const applyRoster = () => {
    try {
      const parsed = parseRoleRoster(text, [
        ...students,
        ...initialRoster,
      ]).sort((a, b) => a.number - b.number);
      if (!parsed.length) throw new Error("학생을 한 명 이상 입력해 주세요.");
      setStudents(parsed);
      setAssignments((current) =>
        Object.fromEntries(
          Object.entries(current).filter(([id]) =>
            parsed.some((student) => student.id === id),
          ),
        ),
      );
      setText(
        parsed.map((student) => `${student.number} ${student.name}`).join("\n"),
      );
      setDraftChanged(true);
      setError("");
      rosterFocus.current = true;
      setEditingRoster(false);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const next = () => {
    if (editingRoster || !students.length) return;
    if (changeCurrent && (!active || start <= today || start > active.end || end !== active.end)) {
      setPeriodError("현재 배정의 남은 기간 안에서 새 배정 적용일을 선택해 주세요.");
      return;
    }
    if (rotate && (!start || !end || start < suggestedStart || start > end)) {
      setPeriodError("기존 배정과 겹치지 않는 시작일과 종료일을 선택해 주세요.");
      return;
    }
    setPeriodError("");
    setStep(2);
    setError("");
  };
  const draftState = () => ({
    ...board.state,
    roster: students,
    roles,
    periods: [
      ...board.state.periods.map((period) =>
        changeCurrent && period.id === active?.id
          ? { ...period, end: new Date(Date.parse(`${start}T00:00:00Z`) - 86400000).toISOString().slice(0, 10) }
          : period,
      ),
      {
        id: crypto.randomUUID(),
        start,
        end,
        students,
        roles: structuredClone(roles),
        assignments,
      },
    ],
  });
  const openReview = () => {
    try {
      if (changeCurrent && active &&
        JSON.stringify({ students, roles, assignments }) ===
          JSON.stringify({ students: active.students, roles: active.roles, assignments: active.assignments }))
        throw new Error("변경한 명단·역할·배정이 없습니다. 바꿀 내용을 먼저 선택해 주세요.");
      validateRoleStateChange(board.state, draftState());
      setError("");
      setReviewOpen(true);
    } catch (cause) {
      setError((cause as Error).message);
    }
  };
  const publish = async () => {
    const state = draftState();
    try {
      validateRoleStateChange(board.state, state);
      setError("");
      if (await save(state)) {
        setDraftChanged(false);
        navigate("/tools/classroom-roles/board");
      } else {
        setError("저장하지 못했습니다. 배정은 유지되니 오류를 확인하고 다시 시도해 주세요.");
        setReviewOpen(false);
      }
    } catch (e) {
      setError((e as Error).message);
      setReviewOpen(false);
    }
  };
  const periodFields = (
    <div className="grid gap-3 sm:grid-cols-2">
      <RoleField label={changeCurrent ? "새 배정 적용일" : "시작일"}>
        <input
          type="date"
          className={roleInput}
          value={start}
          min={changeCurrent ? suggestedStart : rotate ? suggestedStart : undefined}
          max={changeCurrent ? active?.end : undefined}
          disabled={busy}
          onChange={(event) => {
            const nextStart = event.target.value;
            setStart(nextStart);
            if (!changeCurrent && nextStart && end < nextStart) {
              setEnd(roleMonthRange(nextStart.slice(0, 7)).end);
            }
            setDraftChanged(true);
            setPeriodError("");
            setError("");
          }}
        />
      </RoleField>
      <RoleField label={changeCurrent ? "기존 종료일 유지" : "종료일"}>
        <input
          type="date"
          className={roleInput}
          value={end}
          min={rotate || changeCurrent ? start || suggestedStart : undefined}
          disabled={busy || changeCurrent}
          onChange={(event) => {
            setEnd(event.target.value);
            setDraftChanged(true);
            setPeriodError("");
            setError("");
          }}
        />
      </RoleField>
    </div>
  );
  return (
    <div className="space-y-3 lg:space-y-0" data-role-assignment-step={step}>
      <div data-role-topbar className="hidden lg:flex min-h-[84px] items-center justify-between gap-5 border-b border-[#E4E5E0] bg-white px-10">
        <h1 className="sr-only">{changeCurrent ? "현재 배정 변경" : rotate ? "역할 교체" : "학생 역할 배정"}</h1>
        <div className="flex min-w-0 items-center gap-9">
          <Link to="/" className="inline-flex min-h-11 shrink-0 items-center gap-3 text-xl font-semibold tracking-tight text-[#252824]">
            <span aria-hidden="true" className="inline-block h-5 w-4 rounded-sm bg-[#B9472F]" />
            SchoolDoc
          </Link>
          <Link to="/tools/classroom-roles" className="inline-flex min-h-11 items-center gap-3 text-base text-[#4F544F]">
            <span aria-hidden="true">←</span> 1인 1역
          </Link>
        </div>
        <div className="flex min-w-0 items-center gap-7">
          <span className="truncate text-sm text-[#4F544F]">{board.state.settings.title} · {periodLabel}</span>
          {step === 2 && (
            <button type="button" disabled={busy} onClick={() => {
              setStep(1);
              requestAnimationFrame(() => rosterHeadingRef.current?.focus());
            }} className="min-h-11 shrink-0 px-2 text-sm text-[#4F544F]">명단 수정</button>
          )}
          {step === 2 && !rotate && (
            <button type="button" onClick={() => setPeriodEditing((value) => !value)} className="min-h-11 shrink-0 px-2 text-sm text-[#4F544F]">기간 변경</button>
          )}
          {step === 2 && (
            <button
              data-role-review-button
              ref={reviewButtonRef}
              type="button"
              className={`min-h-11 min-w-36 rounded-md px-5 text-sm font-semibold ${busy || unassigned > 0 ? 'cursor-not-allowed bg-[#D6D7D3] text-[#545954]' : 'bg-[#252824] text-white hover:bg-[#3A3E39]'}`}
              aria-disabled={busy || unassigned > 0}
              aria-describedby={unassigned > 0 ? 'role-review-reason' : undefined}
              onClick={busy || unassigned > 0 ? undefined : openReview}
            >
              배정 확인
            </button>
          )}
        </div>
      </div>
      {step === 2 && unassigned > 0 && <p id="role-review-reason" className="sr-only">모든 학생을 배정한 뒤 확인할 수 있습니다.</p>}
      <ol className={`${step === 2 ? "hidden sm:flex" : "flex"} flex-wrap gap-2 text-sm lg:hidden`} aria-label="배정 단계">
        {(rotate ? ["기간·명단", "역할 배정"] : ["명단 확인", "역할 배정"]).map((label, i) => (
          <li
            aria-current={step === i + 1 ? "step" : undefined}
            className={`rounded-full border px-3 py-1 ${step === i + 1 ? "border-[#0F6CBD] bg-[#EFF6FC] font-bold" : "border-[#DCE3EA]"}`}
            key={label}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>
      {(rotate || changeCurrent) && step === 1 && (
        <section className={`${rolePanel} space-y-3 lg:mx-auto lg:mt-8 lg:max-w-4xl`} aria-label="교체 기간">
          <h2 className="text-xl font-bold">{changeCurrent ? "현재 배정 변경" : "교체 기간"}</h2>
          <p className="text-sm text-[#526174]">
            {changeCurrent
              ? active
                ? `오늘까지의 배정과 기록은 유지합니다. ${suggestedStart}부터 ${active.end} 사이에 새 배정을 적용할 날짜를 정하세요. 기존 학생의 역할은 채워 두었습니다.`
                : "오늘 적용 중인 배정이 없습니다. 첫 배정을 시작해 주세요."
              : previous
              ? `현재 배정 ${previous.start} ~ ${previous.end} · 새 역할의 시작일과 종료일을 정하세요.`
              : "첫 배정의 시작일과 종료일을 정하세요."}
          </p>
          {changeCurrent && (!active || active.end <= today) && (
            <p role="alert" className="text-sm text-amber-800">남은 운영 기간이 없어 변경할 수 없습니다. 다음 기간을 준비해 주세요.</p>
          )}
          {periodFields}
          <RoleError message={periodError} />
          {!changeCurrent && previous && previous.end >= today && (
            <p className="text-sm text-[#526174]">
              운영 중에도 교체할 수 있습니다. 더 일찍 시작하려면 {" "}
              <Link to="/tools/classroom-roles/settings" className="font-semibold text-[#0F6CBD] underline underline-offset-2">
                운영 설정에서 기존 종료일을 오늘로 변경
              </Link>
              한 뒤 새 배정을 내일부터 시작해 주세요. 오늘까지의 배정과 기록은 유지됩니다.
            </p>
          )}
        </section>
      )}
      {step === 1 ? (
        <section className={`${rolePanel} space-y-4 lg:mx-auto ${rotate || changeCurrent ? "lg:mt-4" : "lg:mt-8"} lg:max-w-4xl`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2
              ref={rosterHeadingRef}
              tabIndex={-1}
              className="text-xl font-bold focus:outline-none"
            >
              학생 명단
            </h2>
            {!editingRoster && (
              <button
                className={roleSecondary}
                onClick={() => {
                  setError("");
                  rosterFocus.current = true;
                  setEditingRoster(true);
                }}
              >
                명단 수정
              </button>
            )}
          </div>
          <p className={`text-sm text-[#526174] ${students.length && !editingRoster ? "hidden sm:block" : ""}`}>
            {board.state.roster.length
              ? "설정 명단을 불러왔습니다."
              : previous?.students.length
                ? "이전 배정 명단을 불러왔습니다."
                : "한 줄에 번호와 이름을 입력하세요."}
          </p>
          <RoleError message={error} />
          {editingRoster ? (
            <>
              <RoleField label="학생 명단">
                <textarea
                  ref={rosterInputRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className={roleInput}
                  rows={8}
                  placeholder={"1 김하늘\n2 이바다"}
                />
              </RoleField>
              <div className="flex flex-wrap gap-2">
                <button className={roleSecondary} onClick={applyRoster}>
                  명단 적용
                </button>
                {!!students.length && (
                  <button
                    className={roleSecondary}
                    onClick={() => {
                      setText(
                        students
                          .map((student) => `${student.number} ${student.name}`)
                          .join("\n"),
                      );
                      setError("");
                      rosterFocus.current = true;
                      setEditingRoster(false);
                    }}
                  >
                    수정 취소
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="font-semibold text-[#0F6CBD]">
                총 {students.length}명 · 번호순
              </p>
              <ul
                aria-label="배정할 학생 명단"
                className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,8.5rem),1fr))] gap-x-4 text-sm lg:grid-cols-4"
              >
                {students.map((student, index) => (
                  <li
                    key={student.id}
                    className={`min-h-11 min-w-0 items-center gap-2 border-b border-[#E2E8F0] py-2 ${index >= mobileRosterPreviewCount && !rosterExpanded ? "hidden sm:flex" : "flex"}`}
                  >
                    <span className="w-7 shrink-0 font-semibold text-[#526174]">
                      {student.number}
                    </span>
                    <span className="min-w-0 break-words font-medium">
                      {student.name}
                    </span>
                  </li>
                ))}
              </ul>
              {students.length > mobileRosterPreviewCount && (
                <button
                  type="button"
                  className="min-h-11 text-sm font-semibold text-[#0F6CBD] sm:hidden"
                  aria-expanded={rosterExpanded}
                  onClick={() => setRosterExpanded((value) => !value)}
                >
                  {rosterExpanded ? "명단 접기" : "전체 명단 보기"}
                </button>
              )}
            </>
          )}
          <p className={`text-xs text-[#64748B] ${editingRoster ? "" : "hidden sm:block"}`}>
            {editingRoster
              ? "최대 60명 · 같은 이름은 번호로 구분합니다."
              : "명단 변경은 배정을 확정할 때 저장됩니다."}
          </p>
          <button
            className={`${roleButton} w-full sm:w-auto`}
            disabled={editingRoster || !students.length || (changeCurrent && (!active || active.end <= today))}
            onClick={next}
          >
            다음: 역할 배정
          </button>
        </section>
      ) : (
        <>
          <section className={`px-1 lg:mx-auto lg:mt-5 lg:max-w-[1488px] lg:rounded-xl lg:border lg:border-[#DCE3EA] lg:bg-white lg:px-4 lg:py-2 ${rotate || changeCurrent || periodEditing ? 'lg:block' : 'lg:hidden'}`} aria-label={rotate || changeCurrent ? "교체 기간" : "배정 기간"}>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="font-semibold">{changeCurrent ? "변경 적용 기간" : rotate ? "교체 기간" : "배정 기간"}</span>
              <span className="sm:hidden">{periodLabel}</span>
              <span className="hidden sm:inline">{start} ~ {end}</span>
              {!rotate && <button
                type="button"
                className="min-h-11 font-semibold text-[#0F6CBD]"
                disabled={busy}
                onClick={() => setPeriodEditing((value) => !value)}
              >
                기간 변경
              </button>}
            </div>
            {(rotate || changeCurrent || periodEditing) && (
              <div className="border-t border-[#E2E8F0] py-3">
                {periodFields}
              </div>
            )}
          </section>
          {seatShortage > 0 && (
            <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              역할 자리가 {seatShortage}개 부족합니다. 역할의 정원을 늘려 주세요.
            </p>
          )}
          <RoleStudentPicker
            students={students}
            roles={roles}
            assignments={assignments}
            previous={changeCurrent ? active : rotate ? previous : undefined}
            disabled={busy}
            focusUnassignedSignal={focusUnassignedSignal}
            onChange={(nextAssignments) => {
              setAssignments(nextAssignments);
              setDraftChanged(true);
            }}
            onCapacityChange={(roleId, capacity) => {
              setRoles((current) =>
                current.map((role) =>
                  role.id === roleId ? { ...role, capacity } : role,
                ),
              );
              setDraftChanged(true);
            }}
            onAddRole={(role) => {
              setRoles((current) => [...current, role]);
              setDraftChanged(true);
            }}
          />
          <RoleError message={error} />
          <div className="h-28 lg:hidden" aria-hidden="true" />
          <div data-role-mobile-actions className="fixed inset-x-0 bottom-0 z-30 border-t border-[#DCE3EA] bg-white px-3 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] shadow-[0_-4px_18px_rgba(15,23,42,0.08)] lg:hidden">
            <div className="mx-auto grid max-w-6xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
              <button
                disabled={busy}
                className={`${roleSecondary} shrink-0 px-3`}
                onClick={() => setStep(1)}
              >
                이전
              </button>
              {unassigned > 0 ? (
              <button
                type="button"
                className="min-h-11 min-w-0 text-sm font-semibold text-[#0F6CBD]"
                aria-label={`미배정 ${unassigned}명 찾기`}
                onClick={() => setFocusUnassignedSignal((value) => value + 1)}
              >
                {unassigned}명 남음
              </button>
              ) : <span role="status" className="text-center text-sm font-semibold text-[#16803C]">배정 완료</span>}
              <button
                ref={mobileReviewButtonRef}
                disabled={busy || unassigned > 0}
                aria-describedby={unassigned > 0 ? "role-review-reason" : undefined}
                className={`${roleButton} shrink-0`}
                onClick={openReview}
              >
                배정 확인
              </button>
            </div>
          </div>
          <dialog
            ref={reviewDialogRef}
            aria-labelledby="role-review-heading"
            className="fixed left-0 right-0 top-1/2 m-auto h-fit w-[min(94vw,1040px)] max-h-[88dvh] max-w-none -translate-y-1/2 overflow-hidden rounded-xl border border-[#DCE3EA] bg-white p-0 shadow-xl backdrop:bg-black/40"
            onClose={() => {
              setReviewOpen(false);
              (window.matchMedia('(min-width: 1024px)').matches ? reviewButtonRef : mobileReviewButtonRef).current?.focus();
            }}
          >
            <div className="flex max-h-[min(88dvh,800px)] flex-col">
              <header className="shrink-0 border-b border-[#E2E8F0] px-5 pb-4 pt-5 sm:px-6">
                <h2 id="role-review-heading" className="text-xl font-bold">배정 확인</h2>
                <p className="mt-1 text-sm text-[#526174]">{start} ~ {end} · {students.length}명 · {reviewRows.length}개 역할</p>
                {start > roleToday() && <p className="mt-1 text-sm text-[#526174]">학생 화면에는 {start}부터 새 역할이 표시됩니다.</p>}
              </header>
              <div className="min-h-0 overflow-y-auto px-5 py-2 sm:px-6" data-role-review-list>
                <ul aria-label="역할별 배정" className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
                  {reviewRows.map(({ role, members }) => (
                    <li key={role.id} className="min-w-0 border-b border-[#E2E8F0] py-3">
                      <h3 className="break-words text-sm font-semibold">{role.name}</h3>
                      <p className="mt-1 break-words text-sm text-[#526174]">
                        {members.map((student) => `${student.number} ${student.name}`).join(" · ")}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
              <footer className="shrink-0 border-t border-[#E2E8F0] bg-white px-5 py-4 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:px-6">
                <p className="text-sm text-[#9A3412]">{changeCurrent ? "새 배정은 적용일부터 표시됩니다. 이전 기록은 유지됩니다." : "변경이 필요하면 새 적용일을 정해 배정을 이어 갈 수 있습니다."}</p>
                <div className="mt-3 flex flex-wrap justify-end gap-2 sm:mt-0">
                  <button type="button" disabled={busy} className={roleSecondary} onClick={() => setReviewOpen(false)}>돌아가기</button>
                  <button type="button" disabled={busy} className={roleButton} onClick={() => void publish()}>
                    {busy ? "확정 중…" : "확정하기"}
                  </button>
                </div>
              </footer>
            </div>
          </dialog>
        </>
      )}
    </div>
  );
}
