import { useEffect, useRef, useState } from "react";
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
  const [error, setError] = useState("");
  const [capacityEditing, setCapacityEditing] = useState(false);
  const [previousShown, setPreviousShown] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [movingStudent, setMovingStudent] = useState<RoleStudent | null>(null);
  const [newRole, setNewRole] = useState("");
  const [newRoleError, setNewRoleError] = useState("");
  const panelRef = useRef<HTMLElement>(null);
  const roleDialogRef = useRef<HTMLDialogElement>(null);
  const moveDialogRef = useRef<HTMLDialogElement>(null);
  const roleTriggerRef = useRef<HTMLButtonElement>(null);
  const roleChosenRef = useRef(false);
  const lastFocusSignalRef = useRef(0);
  const movingStudentIdRef = useRef<string | null>(null);
  const studentInputsRef = useRef(new Map<string, HTMLInputElement>());
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
      <div className={`grid overflow-hidden rounded-xl border border-[#DCE3EA] bg-white ${desktopSideBySide ? "xl:grid-cols-[minmax(0,39%)_minmax(0,1fr)]" : ""}`}>
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
          if (movingStudentIdRef.current) studentInputsRef.current.get(movingStudentIdRef.current)?.focus();
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
