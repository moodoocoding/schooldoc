import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import {
  roleForStudent,
  type ClassroomRole,
  type RolePeriod,
  type RoleStudent,
} from "./roleApi";
import { roleAssignedCount, selectRoleStudents } from "./roleAssignmentDraft";
import {
  RoleError,
  RoleField,
  roleInput,
  roleSecondary,
} from "./RoleControls";

type Props = {
  students: RoleStudent[];
  roles: ClassroomRole[];
  assignments: Record<string, string>;
  previous?: RolePeriod;
  disabled: boolean;
  onChange: (assignments: Record<string, string>) => void;
  onCapacityChange: (roleId: string, capacity: number) => void;
  onAddRole: (role: ClassroomRole) => void;
  focusUnassignedSignal: number;
};

const compactButton =
  "min-h-11 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm font-semibold text-[#334155] hover:bg-[#F1F5F9] focus-visible:outline-2 focus-visible:outline-[#0F6CBD] disabled:opacity-50";

export function RoleStudentPicker({
  students,
  roles,
  assignments,
  previous,
  disabled,
  onChange,
  onCapacityChange,
  onAddRole,
  focusUnassignedSignal,
}: Props) {
  const [activeId, setActiveId] = useState(roles[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [candidateFilter, setCandidateFilter] = useState<"unassigned" | "all">("all");
  const [mobileFilter, setMobileFilter] = useState<"available" | "all">("available");
  const [error, setError] = useState("");
  const [capacityEditing, setCapacityEditing] = useState(false);
  const [previousShown, setPreviousShown] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [movingStudent, setMovingStudent] = useState<RoleStudent | null>(null);
  const [newRole, setNewRole] = useState("");
  const [newRoleError, setNewRoleError] = useState("");
  const panelRef = useRef<HTMLElement>(null);
  const mobileHeaderRef = useRef<HTMLDivElement>(null);
  const desktopPanelRef = useRef<HTMLElement>(null);
  const roleDialogRef = useRef<HTMLDialogElement>(null);
  const moveDialogRef = useRef<HTMLDialogElement>(null);
  const roleTriggerRef = useRef<HTMLButtonElement>(null);
  const roleChosenRef = useRef(false);
  const lastFocusSignalRef = useRef(0);
  const pendingFocusStudentRef = useRef<string | null>(null);
  const movingStudentIdRef = useRef<string | null>(null);
  const studentInputsRef = useRef(new Map<string, HTMLInputElement>());
  const candidateButtonsRef = useRef(new Map<string, HTMLButtonElement>());
  const candidateHeadingRef = useRef<HTMLHeadingElement>(null);
  const activeRole = roles.find((role) => role.id === activeId) ?? roles[0];
  const sorted = [...students].sort((a, b) => a.number - b.number);
  const unassigned = sorted.filter((student) => !assignments[student.id]);
  const selected = activeRole ? roleAssignedCount(assignments, activeRole.id) : 0;
  const remaining = activeRole ? activeRole.capacity - selected : 0;
  const query = search.trim();
  const visible = sorted.filter(
    (student) => !query || `${student.number} ${student.name}`.includes(query),
  );
  const desktopCandidates = visible.filter(
    (student) => candidateFilter === "all" || !assignments[student.id],
  );
  const mobileCandidates = visible.filter((student) =>
    query || mobileFilter === "all" || assignments[student.id] === activeRole?.id ||
    (!assignments[student.id] && remaining > 0),
  );
  const activeIndex = roles.findIndex((role) => role.id === activeRole?.id);
  const nextOpenRole = [...roles.slice(activeIndex + 1), ...roles.slice(0, activeIndex)]
    .find((role) => roleAssignedCount(assignments, role.id) < role.capacity);
  const manyRoles = roles.length >= 40 && roles.length > students.length;
  const firstUnassignedId = unassigned[0]?.id;

  useEffect(() => {
    if (!focusUnassignedSignal || focusUnassignedSignal === lastFocusSignalRef.current) return;
    lastFocusSignalRef.current = focusUnassignedSignal;
    if (!firstUnassignedId) return;
    const targetRole = activeRole && remaining > 0
      ? activeRole
      : roles.find((role) => roleAssignedCount(assignments, role.id) < role.capacity);
    if (!targetRole) {
      roleTriggerRef.current?.focus();
      return;
    }
    pendingFocusStudentRef.current = firstUnassignedId;
    setActiveId(targetRole.id);
    setMobileFilter("available");
    setSearch("");
  }, [focusUnassignedSignal, firstUnassignedId, activeRole, remaining, roles, assignments]);

  useEffect(() => {
    const studentId = pendingFocusStudentRef.current;
    const input = studentId && studentInputsRef.current.get(studentId);
    if (!input) return;
    pendingFocusStudentRef.current = null;
    requestAnimationFrame(() => {
      input.scrollIntoView({ behavior: "smooth", block: "center" });
      input.focus();
    });
  }, [activeId, assignments, mobileFilter, search]);

  useEffect(() => {
    const dialog = roleDialogRef.current;
    if (roleMenuOpen && dialog && !dialog.open) dialog.showModal();
    if (!roleMenuOpen && dialog?.open) dialog.close();
  }, [roleMenuOpen]);
  useEffect(() => {
    const dialog = moveDialogRef.current;
    if (movingStudent && dialog && !dialog.open) dialog.showModal();
    if (!movingStudent && dialog?.open) dialog.close();
  }, [movingStudent]);

  const chooseRole = (roleId: string, fromDialog = false) => {
    setActiveId(roleId);
    setSearch("");
    setMobileFilter("available");
    setError("");
    setCapacityEditing(false);
    if (fromDialog) {
      roleChosenRef.current = true;
      setRoleMenuOpen(false);
      requestAnimationFrame(() => panelRef.current?.focus());
    }
  };
  const choose = (ids: string[], checked: boolean) => {
    if (!activeRole || disabled) return;
    try {
      onChange(selectRoleStudents(assignments, activeRole, ids, checked));
      setError("");
    } catch (cause) {
      setError((cause as Error).message);
    }
  };
  const addDesktopStudent = (student: RoleStudent) => {
    const existing = roles.find((role) => role.id === assignments[student.id]);
    if (existing?.id === activeRole?.id) {
      choose([student.id], false);
      return;
    }
    if (existing && existing.id !== activeRole?.id) {
      movingStudentIdRef.current = student.id;
      setMovingStudent(student);
      return;
    }
    const at = desktopCandidates.findIndex((item) => item.id === student.id);
    const next = desktopCandidates[at + 1] ?? desktopCandidates[at - 1];
    choose([student.id], true);
    if (candidateFilter === "unassigned") requestAnimationFrame(() => {
      (remaining > 1 && next ? candidateButtonsRef.current.get(next.id) : candidateHeadingRef.current)?.focus();
    });
  };
  const addRole = () => {
    if (!newRole.trim() || roles.length >= 60) return;
    if (roles.some((role) => role.name === newRole.trim())) {
      setNewRoleError("같은 이름의 역할이 있습니다.");
      return;
    }
    const role: ClassroomRole = {
      id: crypto.randomUUID(),
      name: newRole.trim(),
      description: "",
      capacity: 1,
      weekdays: [1, 2, 3, 4, 5],
    };
    onAddRole(role);
    chooseRole(role.id, roleMenuOpen);
    setNewRole("");
    setNewRoleError("");
  };
  const roleChoices = () => (
    <div className="grid grid-cols-2 gap-2">
      {roles.map((role) => {
        const count = roleAssignedCount(assignments, role.id);
        const active = activeRole?.id === role.id;
        return (
          <button
            key={role.id}
            type="button"
            aria-label={`${role.name} 학생 선택`}
            aria-pressed={active}
            disabled={disabled}
            onClick={() => chooseRole(role.id, true)}
            className={`flex min-h-14 w-full min-w-0 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-[#0F6CBD] ${active ? "border-2 border-[#0F6CBD] bg-[#D9ECFD] font-bold text-[#0B589D]" : "border-[#DCE3EA] bg-white font-medium hover:border-[#0F6CBD]"}`}
          >
            <span className="min-w-0 break-words">{role.name}</span>
            <span className="shrink-0 text-sm tabular-nums text-[#526174]">
              {count}/{role.capacity}
            </span>
          </button>
        );
      })}
    </div>
  );
  const addRoleControls = () => (
    <details className="mt-3 border-t border-[#E2E8F0] pt-2">
      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-[#0F6CBD]">
        + 역할 추가
      </summary>
      <div className="flex flex-wrap gap-2 pb-2">
        <RoleField label="새 역할 이름">
          <input
            className={roleInput}
            maxLength={40}
            value={newRole}
            onChange={(event) => {
              setNewRole(event.target.value);
              setNewRoleError("");
            }}
          />
        </RoleField>
        <button
          type="button"
          className={compactButton}
          disabled={!newRole.trim() || roles.length >= 60 || disabled}
          onClick={addRole}
        >
          역할 추가
        </button>
      </div>
      <RoleError message={newRoleError} />
    </details>
  );

  return (
    <section className="space-y-3" aria-label="역할별 학생 배정">
      <div ref={mobileHeaderRef} data-role-mobile-header className="sticky top-0 z-20 rounded-xl border border-[#DCE3EA] bg-white px-3 py-1 shadow-sm lg:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <button
            ref={roleTriggerRef}
            type="button"
            className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md text-left font-bold text-[#0F172A] focus-visible:outline-2 focus-visible:outline-[#0F6CBD]"
            aria-haspopup="dialog"
            aria-label={activeRole ? `역할 변경: ${activeRole.name}` : "역할 변경"}
            disabled={disabled}
            onClick={() => setRoleMenuOpen(true)}
          >
            <span className="min-w-0 break-words text-base">{activeRole?.name ?? "역할 선택"}</span>
            <ChevronDown size={18} className="shrink-0 text-[#0F6CBD]" aria-hidden="true" />
          </button>
          {activeRole && <span className="shrink-0 text-sm tabular-nums text-[#526174]">{selected}/{activeRole.capacity}</span>}
          {nextOpenRole && <button type="button" aria-label={`다음 역할: ${nextOpenRole.name}`} className="role-assignment-next-role min-h-11 shrink-0 border-l border-[#DCE3EA] pl-3 text-sm font-semibold text-[#0F6CBD]" disabled={disabled} onClick={() => {
            chooseRole(nextOpenRole.id);
            mobileHeaderRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}>
            다음 →
          </button>}
        </div>
      </div>
      <div data-role-mobile-picker className="rounded-xl border border-[#DCE3EA] bg-white lg:hidden">
        <section
          ref={panelRef}
          tabIndex={-1}
          className="min-w-0 scroll-mt-28 p-3 focus-visible:outline-2 focus-visible:outline-[#0F6CBD] sm:p-5"
          aria-label="담당 학생 선택"
        >
          {activeRole ? (
            <div className="space-y-3">
              <div className="flex min-h-11 items-center justify-between gap-2">
                <h2 className="text-base font-semibold">학생 선택</h2>
                <button
                  type="button"
                  className="min-h-11 shrink-0 rounded-md px-2 text-sm font-semibold text-[#0F6CBD]"
                  disabled={disabled}
                  onClick={() => setCapacityEditing((value) => !value)}
                >
                  정원 변경
                </button>
              </div>
              {capacityEditing && (
                <div className="max-w-36">
                  <RoleField label={`${activeRole.name} 정원`}>
                    <input
                      type="number"
                      className={roleInput}
                      min={Math.max(1, selected)}
                      max={60}
                      value={activeRole.capacity}
                      disabled={disabled}
                      onChange={(event) => {
                        const capacity = Number(event.target.value);
                        if (!Number.isInteger(capacity) || capacity < 1 || capacity > 60)
                          setError("정원은 1~60명으로 입력해 주세요.");
                        else if (capacity < selected)
                          setError(`이미 선택한 ${selected}명보다 정원을 줄일 수 없습니다.`);
                        else {
                          setError("");
                          onCapacityChange(activeRole.id, capacity);
                        }
                      }}
                    />
                  </RoleField>
                </div>
              )}
              <RoleError message={error} />
              <input
                type="search"
                aria-label="학생 찾기"
                className={`${roleInput} mt-0`}
                placeholder="이름·번호로 학생 찾기"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  if (event.target.value.trim()) setMobileFilter("all");
                }}
              />
              <div className="flex gap-2" role="group" aria-label="학생 범위">
                <button type="button" aria-pressed={mobileFilter === "available"} onClick={() => setMobileFilter("available")}
                  className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${mobileFilter === "available" ? "border-[#0F6CBD] bg-[#EAF3FF] text-[#0B589D]" : "border-[#DCE3EA] text-[#526174]"}`}>
                  배정 가능
                </button>
                <button type="button" aria-pressed={mobileFilter === "all"} onClick={() => setMobileFilter("all")}
                  className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${mobileFilter === "all" ? "border-[#0F6CBD] bg-[#EAF3FF] text-[#0B589D]" : "border-[#DCE3EA] text-[#526174]"}`}>
                  전체 학생
                </button>
              </div>
              {previous && (
                <button type="button" className="min-h-11 text-sm font-semibold text-[#0F6CBD]" onClick={() => setPreviousShown((value) => !value)}>
                  이전 역할 {previousShown ? "숨기기" : "보기"}
                </button>
              )}
              <fieldset>
                <legend className="sr-only">{activeRole.name} 담당 학생</legend>
                <div className="role-assignment-mobile-grid grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {mobileCandidates.map((student) => {
                    const checked = assignments[student.id] === activeRole.id;
                    const current = roles.find((role) => role.id === assignments[student.id]);
                    const unavailable = disabled || (!checked && remaining <= 0);
                    const assignmentState = checked ? "current" : current ? "other" : "unassigned";
                    return (
                      <label
                        key={student.id}
                        data-assignment-state={assignmentState}
                        className={`flex min-h-14 min-w-0 items-center gap-2 rounded-lg border px-2 py-2 text-sm ${checked ? "border-[#0F6CBD] bg-[#EAF3FF]" : current ? "border-[#CBD5E1] bg-[#F2F4F7]" : "border-[#DCE3EA] bg-white"} ${unavailable ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-[#0F6CBD]"}`}
                      >
                        <input
                          ref={(element) => {
                            if (element) studentInputsRef.current.set(student.id, element);
                            else studentInputsRef.current.delete(student.id);
                          }}
                          type="checkbox"
                          className="h-5 w-5 shrink-0"
                          aria-label={`${student.number}번 ${student.name} 선택`}
                          aria-describedby={current && !checked ? `role-student-state-${student.id}` : undefined}
                          checked={checked}
                          disabled={unavailable}
                          onChange={(event) => {
                            if (event.target.checked && current && current.id !== activeRole.id) {
                              movingStudentIdRef.current = student.id;
                              setMovingStudent(student);
                              return;
                            }
                            choose([student.id], event.target.checked);
                          }}
                        />
                        <span className="min-w-0 break-words font-medium">
                          {student.number} {student.name}
                          {current && !checked && <span id={`role-student-state-${student.id}`} className="block break-words text-xs font-normal text-[#526174]">{current.name}</span>}
                          {previous && previousShown && (
                            <span className="block text-xs font-normal text-[#526174]">
                              이전: {roleForStudent(previous, student.id)?.name ?? "없음"}
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {!mobileCandidates.length && <div className="py-4 text-sm text-[#64748B]">
                  {query ? "검색 결과가 없습니다." : mobileFilter === "available" ? (
                    <button type="button" className="min-h-11 font-semibold text-[#0F6CBD]" onClick={() => setMobileFilter("all")}>배정 가능한 학생 없음 · 전체 학생 보기</button>
                  ) : "학생이 없습니다."}
                </div>}
              </fieldset>
            </div>
          ) : (
            <p className="text-sm text-[#526174]">역할을 먼저 추가해 주세요.</p>
          )}
        </section>
      </div>

      <div className={`mx-auto hidden w-full max-w-[1488px] overflow-hidden rounded-xl border border-[#E4E5E0] lg:grid ${manyRoles ? "lg:grid-cols-[minmax(0,54%)_minmax(0,1fr)]" : "lg:grid-cols-[minmax(370px,40%)_minmax(0,1fr)] xl:grid-cols-[minmax(320px,35%)_minmax(0,1fr)]"}`} data-role-desktop-picker>
        <section className="min-w-0 border-r border-[#E4E5E0] bg-[#F7F8F6] px-6 pb-10 pt-5" aria-label="역할 목록">
          <div className="flex min-h-16 items-start justify-between gap-2 border-b border-[#E4E5E0] pb-3" data-role-pane-header>
            <h2 className="break-words text-[length:var(--sd-text-xl)] font-semibold leading-7">역할 선택</h2>
            <span className="pt-1 text-xs text-[#686D66]">배정 / 정원</span>
          </div>
          {roles.length > 0 ? <div className={`mt-4 grid grid-cols-2 gap-2 ${manyRoles ? "xl:grid-cols-4" : ""}`}>
            {roles.map((role) => {
              const count = roleAssignedCount(assignments, role.id);
              const active = activeRole?.id === role.id;
              return <button key={role.id} type="button" aria-label={`${role.name} 학생 선택`} aria-pressed={active} data-complete={count >= role.capacity} disabled={disabled}
                onClick={() => chooseRole(role.id)}
                className="role-assignment-role-card flex min-h-14 min-w-0 items-center justify-between gap-2 rounded-lg px-3 py-2 text-left">
                <span className="min-w-0 break-words text-sm font-medium leading-5">{role.name}</span>
                <span className="shrink-0 text-xs tabular-nums">{count}/{role.capacity}</span>
              </button>;
            })}
          </div> : <p className="py-4 text-sm text-[#686D66]">역할을 추가해 주세요.</p>}
          {addRoleControls()}
        </section>
        <section ref={desktopPanelRef} tabIndex={-1} className="min-w-0 px-6 pb-10 pt-5 focus-visible:outline-2" aria-label="담당 학생 선택">
          {activeRole ? <>
            <div className="flex min-h-16 items-start justify-between gap-3 border-b border-[#E4E5E0] pb-3" data-role-pane-header>
              <h2 className="min-w-0 break-words text-[length:var(--sd-text-xl)] font-semibold leading-7">{activeRole.name}</h2>
              <button type="button" disabled={disabled} onClick={() => setCapacityEditing((value) => !value)} className="min-h-11 rounded-md px-3 text-sm text-[#4F544F] hover:bg-[#F7F6F3]">정원 변경</button>
            </div>
            {capacityEditing && <div className="mt-3 max-w-40"><RoleField label={`${activeRole.name} 정원`}><input type="number" className={roleInput} min={Math.max(1, selected)} max={60} value={activeRole.capacity} disabled={disabled} onChange={(event) => {
              const capacity = Number(event.target.value);
              if (!Number.isInteger(capacity) || capacity < 1 || capacity > 60) setError("정원은 1~60명으로 입력해 주세요.");
              else if (capacity < selected) setError(`이미 선택한 ${selected}명보다 정원을 줄일 수 없습니다.`);
              else { setError(""); onCapacityChange(activeRole.id, capacity); }
            }} /></RoleField></div>}
            <RoleError message={error} />
            <div className="mb-4 mt-4 flex flex-wrap items-center justify-between gap-3">
              <h3 ref={candidateHeadingRef} tabIndex={-1} className="text-base font-semibold focus:outline-none">학생 선택</h3>
              <div className="flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor="role-candidate-filter">학생 범위</label>
                <select id="role-candidate-filter" value={candidateFilter} onChange={(event) => setCandidateFilter(event.target.value as "unassigned" | "all")} className="min-h-11 rounded-md border border-[#D8DBD5] bg-white px-3 text-sm">
                  <option value="all">전체 학생</option><option value="unassigned">미배정</option>
                </select>
                <label className="flex min-h-11 min-w-44 items-center rounded-md border border-[#D8DBD5] bg-white px-3 text-[#686D66]">
                  <Search size={17} aria-hidden="true" className="mr-2 shrink-0" />
                  <span className="sr-only">학생 찾기</span>
                  <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="이름 또는 번호" className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none" />
                </label>
              </div>
            </div>
            {previous && <button type="button" onClick={() => setPreviousShown((value) => !value)} className="mb-3 min-h-11 text-sm text-[#4F544F]">이전 역할 {previousShown ? '숨기기' : '보기'}</button>}
            {desktopCandidates.length ? <div className={`grid grid-cols-2 gap-2 ${manyRoles ? "" : "xl:grid-cols-3"}`}>
              {desktopCandidates.map((student) => {
                const current = roles.find((role) => role.id === assignments[student.id]);
                const isCurrent = current?.id === activeRole.id;
                const assignmentState = isCurrent ? "current" : current ? "other" : "unassigned";
                return <button key={student.id} type="button" ref={(element) => {
                  if (element) candidateButtonsRef.current.set(student.id, element);
                  else candidateButtonsRef.current.delete(student.id);
                }} data-assignment-state={assignmentState} aria-pressed={isCurrent}
                  aria-label={`${student.number}번 ${student.name} ${isCurrent ? '배정 해제' : current ? '역할 이동' : '추가'}`}
                  disabled={disabled || (!isCurrent && remaining <= 0)} onClick={() => addDesktopStudent(student)}
                  className="role-assignment-student-card flex min-h-[62px] min-w-0 items-center gap-3 rounded-lg px-3 py-2 text-left">
                  <span aria-hidden="true" className="role-assignment-check flex h-5 w-5 shrink-0 items-center justify-center rounded border">{isCurrent && <Check size={14} strokeWidth={3} />}</span>
                  <span className="min-w-0 flex-1 break-words text-sm font-medium"><span className="mr-1 tabular-nums">{student.number}</span> {student.name}
                    {current && !isCurrent && <span className="block break-words text-xs font-normal text-[#686D66]">{current.name}</span>}
                    {previous && previousShown && <span className="block break-words text-xs font-normal text-[#686D66]">이전: {roleForStudent(previous, student.id)?.name ?? '없음'}</span>}
                  </span>
                </button>;
              })}
            </div> : <div className="border-t border-[#E4E5E0] py-8 text-sm text-[#686D66]">{search ? '검색 결과가 없습니다.' : candidateFilter === 'unassigned' ? <><p>추가할 미배정 학생이 없습니다.</p><button type="button" className="mt-2 min-h-11 text-[#B9472F]" onClick={() => setCandidateFilter('all')}>전체 학생 보기</button></> : '학생이 없습니다.'}</div>}
          </> : <p className="text-sm text-[#686D66]">역할을 먼저 추가해 주세요.</p>}
        </section>
      </div>

      <dialog
        ref={roleDialogRef}
        data-role-mobile-dialog
        aria-labelledby="role-picker-heading"
        className="m-auto w-[min(94vw,440px)] max-h-[80dvh] overflow-y-auto rounded-xl border border-[#DCE3EA] bg-white p-4 shadow-xl backdrop:bg-black/40"
        onClose={() => {
          setRoleMenuOpen(false);
          if (roleChosenRef.current) {
            roleChosenRef.current = false;
            panelRef.current?.focus();
          } else roleTriggerRef.current?.focus();
        }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-white pb-2">
          <h2 id="role-picker-heading" className="text-lg font-bold">역할 선택</h2>
          <button type="button" className={compactButton} onClick={() => setRoleMenuOpen(false)}>닫기</button>
        </div>
        <div className="mt-3">{roleChoices()}{addRoleControls()}</div>
      </dialog>

      <dialog
        ref={moveDialogRef}
        aria-labelledby="role-move-heading"
        className="m-auto w-[min(92vw,420px)] rounded-xl border border-[#DCE3EA] bg-white p-5 shadow-xl backdrop:bg-black/40"
        onClose={() => {
          setMovingStudent(null);
          if (movingStudentIdRef.current) (candidateButtonsRef.current.get(movingStudentIdRef.current) ?? studentInputsRef.current.get(movingStudentIdRef.current))?.focus();
          movingStudentIdRef.current = null;
        }}
      >
        <h2 id="role-move-heading" className="text-lg font-bold">역할 이동</h2>
        {movingStudent && activeRole && (
          <p className="mt-3 text-sm leading-6">
            {movingStudent.number}번 {movingStudent.name}: {roles.find((role) => role.id === assignments[movingStudent.id])?.name} → {activeRole.name}로 옮길까요?
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className={roleSecondary} onClick={() => setMovingStudent(null)}>취소</button>
          <button type="button" className={compactButton} disabled={disabled} onClick={() => {
            if (movingStudent) choose([movingStudent.id], true);
            setMovingStudent(null);
          }}>옮기기</button>
        </div>
      </dialog>
    </section>
  );
}
