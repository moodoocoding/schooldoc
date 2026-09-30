import { useEffect, useRef, useState } from "react";
import { Plus, Search, X } from "lucide-react";
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
  onEditRoster: () => void;
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
  onEditRoster,
  focusUnassignedSignal,
}: Props) {
  const [activeId, setActiveId] = useState(roles[0]?.id ?? "");
  const [activeGroup, setActiveGroup] = useState<"available" | "filled">(
    () => roles[0] && roleAssignedCount(assignments, roles[0].id) >= roles[0].capacity ? "filled" : "available",
  );
  const [search, setSearch] = useState("");
  const [candidateFilter, setCandidateFilter] = useState<"unassigned" | "all">("unassigned");
  const [error, setError] = useState("");
  const [capacityEditing, setCapacityEditing] = useState(false);
  const [previousShown, setPreviousShown] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [movingStudent, setMovingStudent] = useState<RoleStudent | null>(null);
  const [newRole, setNewRole] = useState("");
  const [newRoleError, setNewRoleError] = useState("");
  const panelRef = useRef<HTMLElement>(null);
  const desktopPanelRef = useRef<HTMLElement>(null);
  const roleDialogRef = useRef<HTMLDialogElement>(null);
  const moveDialogRef = useRef<HTMLDialogElement>(null);
  const roleTriggerRef = useRef<HTMLButtonElement>(null);
  const roleChosenRef = useRef(false);
  const lastFocusSignalRef = useRef(0);
  const movingStudentIdRef = useRef<string | null>(null);
  const studentInputsRef = useRef(new Map<string, HTMLInputElement>());
  const candidateButtonsRef = useRef(new Map<string, HTMLButtonElement>());
  const candidateHeadingRef = useRef<HTMLHeadingElement>(null);
  const activeRole = roles.find((role) => role.id === activeId) ?? roles[0];
  const sorted = [...students].sort((a, b) => a.number - b.number);
  const unassigned = sorted.filter((student) => !assignments[student.id]);
  const selected = activeRole ? roleAssignedCount(assignments, activeRole.id) : 0;
  const remaining = activeRole ? activeRole.capacity - selected : 0;
  // 두 목록의 예상 행 수가 크게 다르면 상하 배치로 빈 옆 패널을 피한다.
  const desktopSideBySide = roles.length >= 6 && students.length >= 8 &&
    Math.abs(Math.ceil(roles.length / 2) - Math.ceil(students.length / 3)) <= 3;
  const query = search.trim();
  const visible = sorted.filter(
    (student) => !query || `${student.number} ${student.name}`.includes(query),
  );
  const desktopCandidates = visible.filter(
    (student) => candidateFilter === "all" || !assignments[student.id],
  );
  const selectedStudents = activeRole
    ? sorted.filter((student) => assignments[student.id] === activeRole.id)
    : [];
  const availableRoles = roles.filter((role) => role.id === activeRole?.id
    ? activeGroup === "available" : roleAssignedCount(assignments, role.id) < role.capacity);
  const filledRoles = roles.filter((role) => role.id === activeRole?.id
    ? activeGroup === "filled" : roleAssignedCount(assignments, role.id) >= role.capacity);
  const firstUnassignedId = unassigned[0]?.id;

  useEffect(() => {
    if (!focusUnassignedSignal || focusUnassignedSignal === lastFocusSignalRef.current) return;
    lastFocusSignalRef.current = focusUnassignedSignal;
    if (!firstUnassignedId) return;
    setSearch("");
    requestAnimationFrame(() => {
      const input = studentInputsRef.current.get(firstUnassignedId);
      input?.scrollIntoView({ behavior: "smooth", block: "center" });
      input?.focus();
    });
  }, [focusUnassignedSignal, firstUnassignedId]);

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
    const chosen = roles.find((role) => role.id === roleId);
    setActiveGroup(chosen && roleAssignedCount(assignments, roleId) >= chosen.capacity ? "filled" : "available");
    setActiveId(roleId);
    setSearch("");
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
    if (existing && existing.id !== activeRole?.id) {
      movingStudentIdRef.current = student.id;
      setMovingStudent(student);
      return;
    }
    if (existing) return;
    const at = desktopCandidates.findIndex((item) => item.id === student.id);
    const next = desktopCandidates[at + 1] ?? desktopCandidates[at - 1];
    choose([student.id], true);
    requestAnimationFrame(() => {
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
  const roleChoices = (fromDialog: boolean) => (
    <div className={fromDialog ? "space-y-2" : `grid gap-2 md:grid-cols-3 lg:grid-cols-4 ${desktopSideBySide ? "xl:flex-1 xl:grid-cols-2 xl:auto-rows-fr" : ""}`}>
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
            onClick={() => chooseRole(role.id, fromDialog)}
            className={`flex min-h-12 w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-base focus-visible:outline-2 focus-visible:outline-[#0F6CBD] ${active ? "border-2 border-[#0F6CBD] bg-[#D9ECFD] font-bold text-[#0B589D] shadow-sm" : "border-[#BDD8EC] bg-white/80 font-medium hover:border-[#0F6CBD] hover:bg-white"}`}
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
      <div className="md:hidden">
        <button
          ref={roleTriggerRef}
          type="button"
          className={`${compactButton} flex w-full items-center justify-between gap-3 text-left`}
          aria-haspopup="dialog"
          aria-label={activeRole ? `역할 변경: ${activeRole.name}` : "역할 변경"}
          disabled={disabled}
          onClick={() => setRoleMenuOpen(true)}
        >
          <span>역할 목록</span>
          <span className="shrink-0 text-sm text-[#0F6CBD]">열기</span>
        </button>
      </div>
      <div className={`grid overflow-hidden rounded-xl border border-[#DCE3EA] bg-white lg:hidden ${desktopSideBySide ? "xl:grid-cols-[minmax(0,39%)_minmax(0,1fr)]" : ""}`}>
        <section className={`hidden min-w-0 flex-col border-b border-[#BDD8EC] bg-[#EAF3FB] p-4 md:flex md:p-5 ${desktopSideBySide ? "xl:border-b-0 xl:border-r" : ""}`} aria-label="역할 목록">
          <div className="flex min-h-12 items-start justify-between gap-2">
            <h2 className="text-lg font-bold leading-7 text-[#25415B]">역할 선택</h2>
            <span className="text-sm leading-7 text-[#526174]">배정/정원</span>
          </div>
          {roleChoices(false)}
          {addRoleControls()}
        </section>
        <section
          ref={panelRef}
          tabIndex={-1}
          className="min-w-0 bg-white p-4 focus-visible:outline-2 focus-visible:outline-[#0F6CBD] md:p-5"
          aria-label="담당 학생 선택"
        >
          {activeRole ? (
            <div className="space-y-3">
              <div className="flex min-h-12 items-start justify-between gap-2">
                <h2 className="min-w-0 break-words text-xl font-bold leading-7">
                  {activeRole.name} <span className="text-sm font-medium text-[#526174]">{selected}/{activeRole.capacity}명</span>
                </h2>
                <button
                  type="button"
                  className="min-h-11 shrink-0 px-2 text-sm font-semibold text-[#0F6CBD]"
                  disabled={disabled}
                  onClick={() => setCapacityEditing((value) => !value)}
                >
                  정원 변경
                </button>
              </div>
              {activeRole.description && (
                <p className="whitespace-pre-wrap break-words text-sm text-[#526174]">
                  {activeRole.description}
                </p>
              )}
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
              {remaining === 0 && (
                <p className="text-sm text-[#0F6CBD]">이 역할의 정원이 찼습니다. 다른 역할을 선택하거나 정원을 변경하세요.</p>
              )}
              <RoleField label="학생 찾기">
                <input
                  type="search"
                  className={roleInput}
                  placeholder="이름·번호"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </RoleField>
              {previous && (
                <button type="button" className="min-h-11 text-sm font-semibold text-[#0F6CBD]" onClick={() => setPreviousShown((value) => !value)}>
                  이전 역할 {previousShown ? "숨기기" : "보기"}
                </button>
              )}
              <fieldset>
                <legend className="sr-only">{activeRole.name} 담당 학생</legend>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,10rem),1fr))] gap-2 md:grid-cols-[repeat(auto-fill,minmax(min(100%,11rem),1fr))]">
                  {visible.map((student) => {
                    const checked = assignments[student.id] === activeRole.id;
                    const current = roles.find((role) => role.id === assignments[student.id]);
                    const unavailable = disabled || (!checked && remaining <= 0);
                    const assignmentState = checked ? "current" : current ? "other" : "unassigned";
                    const stateText = checked ? "이 역할 담당" : current ? `배정됨 · ${current.name}` : "미배정";
                    return (
                      <label
                        key={student.id}
                        data-assignment-state={assignmentState}
                        className={`flex min-h-14 min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-base ${checked ? "border-[#0F6CBD] bg-[#EAF3FF]" : current ? "border-[#CBD5E1] bg-[#F2F4F7]" : "border-[#E8C57A] bg-[#FFF9EB]"} ${unavailable ? "cursor-not-allowed" : "cursor-pointer hover:border-[#0F6CBD]"}`}
                      >
                        <input
                          ref={(element) => {
                            if (element) studentInputsRef.current.set(student.id, element);
                            else studentInputsRef.current.delete(student.id);
                          }}
                          type="checkbox"
                          className="h-5 w-5 shrink-0"
                          aria-label={`${student.number}번 ${student.name} 선택`}
                          aria-describedby={`role-student-state-${student.id}`}
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
                          <span
                            id={`role-student-state-${student.id}`}
                            className={`block text-sm font-medium ${checked ? "text-[#0B589D]" : current ? "text-[#475569]" : "text-[#92400E]"}`}
                          >
                            {stateText}
                          </span>
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
                {!visible.length && <p className="py-4 text-sm text-[#64748B]">검색 결과가 없습니다.</p>}
              </fieldset>
            </div>
          ) : (
            <p className="text-sm text-[#526174]">역할을 먼저 추가해 주세요.</p>
          )}
        </section>
      </div>

      <div className="mx-auto hidden w-full max-w-[1488px] grid-cols-[minmax(238px,270px)_minmax(0,1fr)] bg-white lg:grid 2xl:grid-cols-[minmax(270px,320px)_minmax(0,1fr)]" data-role-desktop-picker>
        <section className="min-w-0 border-r border-[#E4E5E0] px-5 py-9" aria-label="역할 목록">
          <h2 className="mb-8 px-2 text-xl font-medium text-[#252824]">역할 배정</h2>
          {availableRoles.length > 0 && (
            <div className="mb-6">
              <h3 className="mb-3 px-2 text-sm font-medium text-[#686D66]">배정 중</h3>
              <div className="space-y-1">
                {availableRoles.map((role) => {
                  const active = activeRole?.id === role.id;
                  return (
                    <button key={role.id} type="button" aria-label={`${role.name} 학생 선택`} aria-pressed={active} disabled={disabled}
                      onClick={() => chooseRole(role.id)}
                      className={`flex min-h-12 w-full min-w-0 items-center gap-3 rounded-md px-3 text-left text-[length:var(--sd-text-lg)] ${active ? 'bg-[#FCEDE8] text-[#252824]' : 'text-[#343833] hover:bg-[#F7F6F3]'}`}>
                      <span aria-hidden="true" className={`h-4 w-3 shrink-0 rounded-sm ${active ? 'bg-[#B9472F]' : 'bg-transparent'}`} />
                      <span className="min-w-0 flex-1 break-words">{role.name}</span>
                      <span className="shrink-0 text-sm tabular-nums text-[#4F544F]">{roleAssignedCount(assignments, role.id)}/{role.capacity}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {filledRoles.length > 0 && (
            <div className="border-t border-[#E4E5E0] pt-6">
              <h3 className="mb-3 px-2 text-sm font-medium text-[#686D66]">배정 완료</h3>
              <div className="space-y-0.5">
                {filledRoles.map((role) => {
                  const active = activeRole?.id === role.id;
                  return <button key={role.id} type="button" aria-label={`${role.name} 학생 선택`} aria-pressed={active} disabled={disabled}
                    onClick={() => chooseRole(role.id)}
                    className={`flex min-h-11 w-full items-center rounded-md px-3 text-left text-[length:var(--sd-text-lg)] ${active ? 'bg-[#FCEDE8] font-medium text-[#252824]' : 'text-[#4F544F] hover:bg-[#F7F6F3]'}`}>
                    {role.name}
                  </button>;
                })}
              </div>
            </div>
          )}
          {roles.length === 0 && <p className="px-2 text-sm text-[#686D66]">역할을 추가해 주세요.</p>}
          {addRoleControls()}
          <button type="button" onClick={onEditRoster} disabled={disabled} className="mt-3 min-h-11 w-full px-2 text-left text-sm text-[#4F544F] hover:text-[#252824]">명단 수정</button>
        </section>
        <section ref={desktopPanelRef} tabIndex={-1} className="min-w-0 px-10 pb-16 pt-10 focus-visible:outline-2 2xl:px-[54px]" aria-label="담당 학생 선택">
          {activeRole ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="min-w-0 break-words text-[length:var(--sd-text-4xl)] font-medium leading-tight text-[#252824] 2xl:text-[length:calc(var(--sd-text-4xl)*1.15)]">{activeRole.name}</h2>
                <button type="button" disabled={disabled} onClick={() => setCapacityEditing((value) => !value)} className="min-h-11 rounded-md px-3 text-sm text-[#4F544F] hover:bg-[#F7F6F3]">정원 변경</button>
              </div>
              {activeRole.description && <details className="mt-2 text-sm text-[#4F544F]"><summary className="min-h-11 cursor-pointer py-3">역할 설명</summary><p className="whitespace-pre-wrap break-words pb-2">{activeRole.description}</p></details>}
              {capacityEditing && <div className="mt-4 max-w-40"><RoleField label={`${activeRole.name} 정원`}><input type="number" className={roleInput} min={Math.max(1, selected)} max={60} value={activeRole.capacity} disabled={disabled} onChange={(event) => {
                const capacity = Number(event.target.value);
                if (!Number.isInteger(capacity) || capacity < 1 || capacity > 60) setError("정원은 1~60명으로 입력해 주세요.");
                else if (capacity < selected) setError(`이미 선택한 ${selected}명보다 정원을 줄일 수 없습니다.`);
                else { setError(""); onCapacityChange(activeRole.id, capacity); }
              }} /></RoleField></div>}
              <RoleError message={error} />
              <div className="mt-7">
                <h3 className="mb-3 text-base font-medium text-[#686D66]">담당 학생</h3>
                {selectedStudents.length ? <div className="flex flex-wrap gap-2">
                  {selectedStudents.map((student) => <div key={student.id} className="inline-flex min-h-12 max-w-full items-center gap-3 rounded-full bg-[#F4F4F2] pl-4 pr-1 text-[length:var(--sd-text-lg)] text-[#252824]">
                    <span className="shrink-0 tabular-nums text-[#4F544F]">{student.number}</span><span className="min-w-0 break-words">{student.name}</span>
                    <button type="button" disabled={disabled} aria-label={`${student.number}번 ${student.name} 배정 해제`} onClick={() => {
                      choose([student.id], false);
                      requestAnimationFrame(() => (candidateButtonsRef.current.get(student.id) ?? candidateHeadingRef.current)?.focus());
                    }} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-[#E8E8E4]"><X size={18} aria-hidden="true" /></button>
                  </div>)}
                </div> : <p className="text-sm text-[#686D66]">담당 학생이 없습니다.</p>}
              </div>
              <div className="mt-9 border-t border-[#E4E5E0] pt-7">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
                  <h3 ref={candidateHeadingRef} tabIndex={-1} className="text-xl font-medium text-[#252824] focus:outline-none">학생 추가</h3>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="sr-only" htmlFor="role-candidate-filter">학생 범위</label>
                    <select id="role-candidate-filter" value={candidateFilter} onChange={(event) => setCandidateFilter(event.target.value as "unassigned" | "all")} className="min-h-11 min-w-32 rounded-md border border-[#D8DBD5] bg-white px-3 text-sm text-[#252824]">
                      <option value="unassigned">미배정</option><option value="all">전체 학생</option>
                    </select>
                    <label className="relative flex min-h-11 min-w-56 items-center rounded-md border border-[#D8DBD5] bg-white pl-3 pr-2 text-[#686D66]">
                      <Search size={18} aria-hidden="true" className="mr-2 shrink-0" />
                      <span className="sr-only">학생 찾기</span>
                      <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="이름 또는 번호" className="min-w-0 flex-1 bg-transparent py-2 text-sm text-[#252824] outline-none" />
                    </label>
                  </div>
                </div>
                {previous && <button type="button" onClick={() => setPreviousShown((value) => !value)} className="mb-3 min-h-11 text-sm text-[#4F544F]">이전 역할 {previousShown ? '숨기기' : '보기'}</button>}
                {desktopCandidates.length ? <div className="border-t border-[#E4E5E0]">
                  {desktopCandidates.map((student) => {
                    const current = roles.find((role) => role.id === assignments[student.id]);
                    const isCurrent = current?.id === activeRole.id;
                    const unavailable = disabled || !!isCurrent || remaining <= 0;
                    return <button key={student.id} type="button" ref={(element) => {
                      if (element) candidateButtonsRef.current.set(student.id, element);
                      else candidateButtonsRef.current.delete(student.id);
                    }} disabled={unavailable} aria-label={`${student.number}번 ${student.name} ${isCurrent ? '담당 중' : current ? '역할 이동' : '추가'}`}
                      onClick={() => addDesktopStudent(student)}
                      className="flex min-h-[86px] w-full min-w-0 items-center gap-5 border-b border-[#E4E5E0] px-3 text-left text-[length:var(--sd-text-lg)] text-[#252824] hover:bg-[#FAF9F7] disabled:cursor-not-allowed disabled:opacity-60">
                      <span className="w-10 shrink-0 tabular-nums text-[#4F544F]">{student.number}</span>
                      <span className="min-w-0 flex-1 break-words font-medium">{student.name}{current && <span className="ml-3 text-sm font-normal text-[#686D66]">{isCurrent ? '담당 중' : `배정됨 · ${current.name}`}</span>}{previous && previousShown && <span className="ml-3 text-sm font-normal text-[#686D66]">이전: {roleForStudent(previous, student.id)?.name ?? '없음'}</span>}</span>
                      <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#D8DBD5] bg-[#FAFAF9] text-[#4F544F]"><Plus size={20} /></span>
                    </button>;
                  })}
                </div> : <div className="border-t border-[#E4E5E0] py-8 text-sm text-[#686D66]">{search ? '검색 결과가 없습니다.' : candidateFilter === 'unassigned' ? <><p>추가할 미배정 학생이 없습니다.</p><button type="button" className="mt-2 min-h-11 text-[#B9472F]" onClick={() => setCandidateFilter('all')}>전체 학생 보기</button></> : '학생이 없습니다.'}</div>}
              </div>
            </>
          ) : <p className="text-sm text-[#686D66]">역할을 먼저 추가해 주세요.</p>}
        </section>
      </div>

      <dialog
        ref={roleDialogRef}
        aria-labelledby="role-picker-heading"
        className="m-auto w-[min(92vw,420px)] max-h-[80vh] overflow-y-auto rounded-xl border border-[#DCE3EA] bg-white p-4 shadow-xl backdrop:bg-black/40"
        onClose={() => {
          setRoleMenuOpen(false);
          if (roleChosenRef.current) {
            roleChosenRef.current = false;
            panelRef.current?.focus();
          } else roleTriggerRef.current?.focus();
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 id="role-picker-heading" className="text-lg font-bold">역할 선택</h2>
          <button type="button" className={compactButton} onClick={() => setRoleMenuOpen(false)}>닫기</button>
        </div>
        <div className="mt-3">{roleChoices(true)}{addRoleControls()}</div>
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
