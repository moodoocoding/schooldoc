import { useRef, useState } from "react";
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
  rolePanel,
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
};

export function RoleStudentPicker({
  students,
  roles,
  assignments,
  previous,
  disabled,
  onChange,
  onCapacityChange,
}: Props) {
  const [activeId, setActiveId] = useState(roles[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const panelRef = useRef<HTMLElement>(null);
  const roleButtons = useRef(new Map<string, HTMLButtonElement>());
  const activeRole = roles.find((role) => role.id === activeId) ?? roles[0];
  const sorted = [...students].sort((a, b) => a.number - b.number);
  const unassigned = sorted.filter((student) => !assignments[student.id]);
  const selected = activeRole
    ? roleAssignedCount(assignments, activeRole.id)
    : 0;
  const remaining = activeRole ? activeRole.capacity - selected : 0;
  const query = search.trim();
  const visible = sorted.filter(
    (student) => !query || `${student.number} ${student.name}`.includes(query),
  );
  const choose = (ids: string[], checked: boolean) => {
    if (!activeRole || disabled) return;
    try {
      onChange(selectRoleStudents(assignments, activeRole, ids, checked));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <section className="space-y-4" aria-label="역할별 학생 배정">
      <div>
        <h2 className="text-xl font-bold">
          역할을 고르고 학생을 여러 명 선택하세요
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#526174]">
          이름을 누르면 바로 배정되고, 다시 누르면 해제됩니다. 아직 확정되지
          않은 배정입니다.
        </p>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section
          className={`${rolePanel} min-w-0 space-y-4`}
          aria-label="배정할 역할 목록"
        >
          <h3 className="font-bold">1. 역할 선택</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {roles.map((role) => {
              const members = sorted.filter(
                (student) => assignments[student.id] === role.id,
              );
              const active = activeRole?.id === role.id;
              return (
                <button
                  key={role.id}
                  ref={(element) => {
                    if (element) roleButtons.current.set(role.id, element);
                    else roleButtons.current.delete(role.id);
                  }}
                  type="button"
                  aria-label={`${role.name} 학생 선택`}
                  aria-pressed={active}
                  disabled={disabled}
                  onClick={() => {
                    setActiveId(role.id);
                    setSearch("");
                    setError("");
                    if (window.matchMedia("(max-width: 1023px)").matches)
                      panelRef.current?.focus();
                  }}
                  className={`min-h-24 min-w-0 rounded-xl border p-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F6CBD] disabled:opacity-50 ${active ? "border-[#0F6CBD] bg-[#EFF6FC]" : "border-[#DCE3EA] bg-white hover:border-[#0F6CBD]"}`}
                >
                  <span className="block break-words font-bold">
                    {role.name}
                  </span>
                  <span className="mt-1 block text-xs text-[#526174]">
                    배정 {members.length}/{role.capacity}명 · 남은{" "}
                    {role.capacity - members.length}자리
                  </span>
                  <span
                    className={`mt-3 block break-words text-sm ${members.length ? "text-[#0F6CBD]" : "text-[#64748B]"}`}
                  >
                    {members.length
                      ? members
                          .map(
                            (student) => `${student.number}번 ${student.name}`,
                          )
                          .join(", ")
                      : "담당 학생을 선택하세요"}
                  </span>
                </button>
              );
            })}
          </div>
          {!roles.length && (
            <p className="text-sm text-[#526174]">역할을 먼저 추가해 주세요.</p>
          )}
        </section>
        <section
          ref={panelRef}
          tabIndex={-1}
          className={`${rolePanel} min-w-0 space-y-4 focus-visible:outline-2 focus-visible:outline-[#0F6CBD]`}
          aria-label="담당 학생 선택"
        >
          {activeRole ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-[#526174]">2. 담당 학생 선택</p>
                  <h3 className="mt-1 break-words text-xl font-bold">
                    {activeRole.name}
                  </h3>
                </div>
                <button
                  type="button"
                  disabled={disabled}
                  className={`${roleSecondary} lg:hidden`}
                  onClick={() =>
                    roleButtons.current.get(activeRole.id)?.focus()
                  }
                >
                  다른 역할 선택
                </button>
              </div>
              {activeRole.description && (
                <p className="whitespace-pre-wrap break-words text-sm text-[#526174]">
                  {activeRole.description}
                </p>
              )}
              <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl bg-[#F8FAFC] p-3">
                <p aria-live="polite" className="pb-2 text-sm font-semibold">
                  선택 {selected}명 · 남은 {remaining}자리
                </p>
                <div className="w-28">
                  <RoleField label={`${activeRole.name} 정원`}>
                    <input
                      type="number"
                      className={roleInput}
                      min={Math.max(1, selected)}
                      max={60}
                      value={activeRole.capacity}
                      disabled={disabled}
                      onChange={(e) => {
                        const capacity = Number(e.target.value);
                        if (
                          !Number.isInteger(capacity) ||
                          capacity < 1 ||
                          capacity > 60
                        ) {
                          setError("정원은 1~60명으로 입력해 주세요.");
                        } else if (capacity < selected) {
                          setError(
                            `이미 선택한 ${selected}명보다 정원을 줄일 수 없습니다. 먼저 선택을 해제해 주세요.`,
                          );
                        } else {
                          setError("");
                          onCapacityChange(activeRole.id, capacity);
                        }
                      }}
                    />
                  </RoleField>
                </div>
              </div>
              <p className="text-xs leading-5 text-[#526174]">
                다른 역할에 배정된 학생을 선택하면 기존 역할에서 이 역할로
                이동합니다. 한 학생에게는 한 역할만 배정됩니다.
              </p>
              <RoleError message={error} />
              {remaining === 0 && (
                <p className="text-sm font-semibold text-[#0F6CBD]">
                  정원이 찼습니다. 더 선택하려면 정원을 늘리거나 선택을 해제해
                  주세요.
                </p>
              )}
              <RoleField label="학생 이름 또는 번호 검색">
                <input
                  type="search"
                  className={roleInput}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </RoleField>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={roleSecondary}
                  disabled={
                    disabled ||
                    !unassigned.length ||
                    unassigned.length > remaining
                  }
                  onClick={() =>
                    choose(
                      unassigned.map((s) => s.id),
                      true,
                    )
                  }
                >
                  미배정 {unassigned.length}명 모두 선택
                </button>
                <button
                  type="button"
                  className={roleSecondary}
                  disabled={disabled || !selected}
                  onClick={() =>
                    choose(
                      students.map((s) => s.id),
                      false,
                    )
                  }
                >
                  이 역할 선택 해제
                </button>
              </div>
              <fieldset>
                <legend className="sr-only">{activeRole.name} 담당 학생</legend>
                <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
                  {visible.map((student) => {
                    const checked = assignments[student.id] === activeRole.id;
                    const current = roles.find(
                      (role) => role.id === assignments[student.id],
                    );
                    const unavailable =
                      disabled || (!checked && remaining <= 0);
                    return (
                      <label
                        key={student.id}
                        className={`flex min-h-16 min-w-0 items-start gap-3 rounded-xl border p-3 ${checked ? "border-[#0F6CBD] bg-[#EFF6FC]" : "border-[#DCE3EA]"} ${unavailable ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                      >
                        <input
                          type="checkbox"
                          className="mt-1 h-5 w-5 shrink-0"
                          aria-label={`${student.number}번 ${student.name} 선택`}
                          checked={checked}
                          disabled={unavailable}
                          onChange={(e) =>
                            choose([student.id], e.target.checked)
                          }
                        />
                        <span className="min-w-0 break-words text-sm">
                          <span className="block font-semibold">
                            {student.number}번 {student.name}
                          </span>
                          <span className="mt-1 block text-xs text-[#526174]">
                            {checked
                              ? "선택됨"
                              : current
                                ? `현재: ${current.name} · 선택 시 이동`
                                : "미배정"}
                          </span>
                          {previous && (
                            <span className="mt-1 block text-xs text-[#526174]">
                              이전 역할:{" "}
                              {roleForStudent(previous, student.id)?.name ??
                                "이전 배정 없음"}
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {!visible.length && (
                  <p className="py-4 text-sm text-[#64748B]">
                    검색 결과가 없습니다.
                  </p>
                )}
              </fieldset>
            </>
          ) : (
            <p className="text-sm text-[#526174]">
              역할을 추가하면 학생을 선택할 수 있습니다.
            </p>
          )}
        </section>
      </div>
    </section>
  );
}
