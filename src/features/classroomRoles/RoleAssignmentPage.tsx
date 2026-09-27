import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
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

export function RoleAssignmentPage({
  board,
  save,
  busy,
  rotate = false,
}: RolePageProps & { rotate?: boolean }) {
  const navigate = useNavigate();
  const previous = [...board.state.periods].sort((a, b) =>
    b.end.localeCompare(a.end),
  )[0];
  const initialRoster = board.state.roster.length
    ? board.state.roster
    : (previous?.students ?? []);
  const initialStart = previous
    ? new Date(Date.parse(`${previous.end}T00:00:00Z`) + 86400000)
        .toISOString()
        .slice(0, 10)
    : roleMonthRange(roleToday().slice(0, 7)).start;
  const [step, setStep] = useState(1);
  const [text, setText] = useState(
    initialRoster.map((s) => `${s.number} ${s.name}`).join("\n"),
  );
  const [students, setStudents] = useState<RoleStudent[]>(() =>
    [...initialRoster].sort((a, b) => a.number - b.number),
  );
  const [editingRoster, setEditingRoster] = useState(!initialRoster.length);
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
  const [roles, setRoles] = useState<ClassroomRole[]>(
    structuredClone(board.state.roles),
  );
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(roleMonthRange(initialStart.slice(0, 7)).end);
  const [error, setError] = useState("");
  const [newRole, setNewRole] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const remaining = (role: ClassroomRole) =>
    role.capacity -
    Object.values(assignments).filter((id) => id === role.id).length;
  const unassigned = students.filter((s) => !assignments[s.id]).length;
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
      setConfirmed(false);
      setError("");
      rosterFocus.current = true;
      setEditingRoster(false);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const next = () => {
    if (editingRoster || !students.length) return;
    setStep(2);
    setError("");
  };
  const publish = async () => {
    const state = {
      ...board.state,
      roster: students,
      roles,
      periods: [
        ...board.state.periods,
        {
          id: crypto.randomUUID(),
          start,
          end,
          students,
          roles: structuredClone(roles),
          assignments,
        },
      ],
    };
    try {
      validateRoleStateChange(board.state, state);
      setError("");
      if (await save(state)) navigate("/tools/classroom-roles/board");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div className="space-y-5">
      <ol className="grid grid-cols-2 gap-2 text-sm" aria-label="배정 단계">
        {["학생 명단 확인", "역할별 학생 선택"].map((label, i) => (
          <li
            aria-current={step === i + 1 ? "step" : undefined}
            className={`rounded-xl border p-4 ${step === i + 1 ? "border-[#0F6CBD] bg-[#EFF6FC] font-bold" : "border-[#DCE3EA]"}`}
            key={label}
          >
            {i + 1}단계 · {label}
          </li>
        ))}
      </ol>
      {rotate && (
        <p className="text-sm text-[#526174]">
          {previous
            ? `이전 배정 ${previous.start} ~ ${previous.end}을 참고해 다음 기간을 준비합니다. 확정 전까지 기존 학생 화면은 바뀌지 않습니다.`
            : "첫 배정을 만든 뒤 다음 기간부터 역할 교체를 이용할 수 있습니다."}
        </p>
      )}
      <RoleError message={error} />
      {step === 1 ? (
        <section className={`${rolePanel} space-y-5`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2
              ref={rosterHeadingRef}
              tabIndex={-1}
              className="text-xl font-bold focus:outline-none"
            >
              학생 명단을 확인해 주세요
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
          <p className="text-sm text-[#526174]">
            {board.state.roster.length
              ? "설정에 저장된 학생 명단을 자동으로 불러왔습니다."
              : previous?.students.length
                ? "이전 배정의 학생 명단을 불러왔습니다."
                : "한 줄에 번호와 이름을 붙여 넣으세요."}
          </p>
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
              <table className="w-full table-fixed border-collapse text-left text-sm">
                <caption className="sr-only">배정할 학생 명단</caption>
                <thead className="bg-[#F8FAFC]">
                  <tr className="border-b border-[#DCE3EA]">
                    <th scope="col" className="w-20 px-3 py-3">
                      번호
                    </th>
                    <th scope="col" className="px-3 py-3">
                      이름
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr key={student.id} className="border-b border-[#E2E8F0]">
                      <td className="px-3 py-3">{student.number}</td>
                      <td className="break-words px-3 py-3 font-medium">
                        {student.name}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          <p className="text-xs text-[#64748B]">
            동명이인은 번호로 구분합니다. 최대 60명. 명단 변경은 배정을 확정할
            때 설정에도 저장됩니다.
          </p>
          <button
            className={roleButton}
            disabled={editingRoster || !students.length}
            onClick={next}
          >
            다음: 역할 설정
          </button>
        </section>
      ) : (
        <>
          <section className={`${rolePanel} space-y-4`}>
            <h2 className="text-xl font-bold">
              배정 기간과 역할을 정해 주세요
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <RoleField label="시작일">
                <input
                  type="date"
                  className={roleInput}
                  value={start}
                  onChange={(e) => {
                    setStart(e.target.value);
                    setConfirmed(false);
                  }}
                />
              </RoleField>
              <RoleField label="종료일">
                <input
                  type="date"
                  className={roleInput}
                  value={end}
                  onChange={(e) => {
                    setEnd(e.target.value);
                    setConfirmed(false);
                  }}
                />
              </RoleField>
            </div>
            <p className="text-xs text-[#526174]">
              월 단위가 기본이며 주간·직접 기간도 가능합니다. 기존 확정 기간과
              겹칠 수 없습니다.
            </p>
            <div
              className="flex flex-wrap gap-3 rounded-xl bg-[#EFF6FC] p-4 text-sm font-bold"
              role="status"
            >
              <span>미배정 학생 {unassigned}명</span>
              <span>
                남은 역할 자리 {roles.reduce((n, r) => n + remaining(r), 0)}개
              </span>
              <span>
                자리 남은 역할 {roles.filter((r) => remaining(r) > 0).length}
                종류
              </span>
            </div>
            {unassigned > 0 && (
              <p className="break-words text-sm leading-6 text-[#526174]">
                미배정:{" "}
                {students
                  .filter((student) => !assignments[student.id])
                  .map((student) => `${student.number}번 ${student.name}`)
                  .join(", ")}
              </p>
            )}
            <details>
              <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">
                새 역할 추가
              </summary>
              <div className="mt-4 flex flex-wrap gap-2">
                <label className="grow">
                  <span className="text-sm">새 역할 이름</span>
                  <input
                    className={roleInput}
                    value={newRole}
                    maxLength={40}
                    onChange={(e) => setNewRole(e.target.value)}
                  />
                </label>
                <button
                  className={`${roleSecondary} self-end`}
                  disabled={!newRole.trim() || roles.length >= 60}
                  onClick={() => {
                    setRoles([
                      ...roles,
                      {
                        id: crypto.randomUUID(),
                        name: newRole.trim(),
                        description: "",
                        capacity: 1,
                        weekdays: [1, 2, 3, 4, 5],
                      },
                    ]);
                    setNewRole("");
                    setConfirmed(false);
                  }}
                >
                  역할 추가
                </button>
              </div>
            </details>
          </section>
          <RoleStudentPicker
            students={students}
            roles={roles}
            assignments={assignments}
            previous={rotate ? previous : undefined}
            disabled={busy}
            onChange={(nextAssignments) => {
              setAssignments(nextAssignments);
              setConfirmed(false);
            }}
            onCapacityChange={(roleId, capacity) => {
              setRoles((current) =>
                current.map((role) =>
                  role.id === roleId ? { ...role, capacity } : role,
                ),
              );
              setConfirmed(false);
            }}
          />
          <label className="flex items-start gap-3 text-sm leading-6">
            <input
              type="checkbox"
              aria-label="배정 내용 확인"
              className="mt-1 h-5 w-5"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span>
              기간과 역할을 확인했습니다. 확정한 배정은 기록 보존을 위해
              수정하지 않으며, 해당 기간이 되면 같은 학생 링크에 적용됩니다.
            </span>
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              disabled={busy}
              className={roleSecondary}
              onClick={() => setStep(1)}
            >
              이전: 명단 확인
            </button>
            <button
              disabled={busy || unassigned > 0 || !confirmed}
              className={roleButton}
              onClick={() => void publish()}
            >
              {busy ? "확정 중…" : "배정 확정하기"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
