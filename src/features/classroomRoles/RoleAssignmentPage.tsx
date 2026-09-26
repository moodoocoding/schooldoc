import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  parseRoleRoster,
  roleForStudent,
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
  const [students, setStudents] = useState<RoleStudent[]>([]);
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
  const next = () => {
    try {
      const parsed = parseRoleRoster(text, [...students, ...initialRoster]);
      if (!parsed.length) throw new Error("학생을 한 명 이상 입력해 주세요.");
      setStudents(parsed);
      setAssignments((a) =>
        Object.fromEntries(
          Object.entries(a).filter(([id]) => parsed.some((s) => s.id === id)),
        ),
      );
      setStep(2);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
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
        {["학생 명단 받기", "학생별 역할 설정하기"].map((label, i) => (
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
          <h2 className="text-xl font-bold">학생 명단을 확인해 주세요</h2>
          <p className="text-sm text-[#526174]">
            {board.state.roster.length
              ? "설정에 저장된 학생 명단을 자동으로 불러왔습니다."
              : "한 줄에 번호와 이름을 붙여 넣으세요. 배정을 확정하면 설정의 명단에도 저장됩니다."}
          </p>
          <RoleField label="학생 명단">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className={roleInput}
              rows={12}
              placeholder={"1 김하늘\n2 이바다"}
            />
          </RoleField>
          <p className="text-xs text-[#64748B]">
            동명이인은 번호로 구분합니다. 최대 60명.
          </p>
          <button className={roleButton} onClick={next}>
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
            <details>
              <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">
                역할 추가 / 정원 조정 / 남은 자리 확인
              </summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {roles.map((r) => (
                  <label
                    key={r.id}
                    className="flex items-center justify-between gap-3 rounded-lg bg-[#F8FAFC] p-3 text-sm"
                  >
                    <span>
                      {r.name}
                      <small className="block text-[#526174]">
                        남은 자리 {remaining(r)}개
                      </small>
                    </span>
                    <input
                      type="number"
                      aria-label={`${r.name} 정원`}
                      min={1}
                      max={60}
                      className={`${roleInput} max-w-20`}
                      value={r.capacity}
                      onChange={(e) => {
                        setRoles(
                          roles.map((item) =>
                            item.id === r.id
                              ? { ...r, capacity: Number(e.target.value) }
                              : item,
                          ),
                        );
                        setConfirmed(false);
                      }}
                    />
                  </label>
                ))}
              </div>
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
          <section
            className={`${rolePanel} space-y-3`}
            aria-label="학생별 역할 배정"
          >
            {students.map((s) => (
              <div
                key={s.id}
                className="grid gap-2 border-b border-[#E2E8F0] py-3 sm:grid-cols-2"
              >
                <div>
                  <p className="font-bold">
                    {s.number}번 {s.name}
                  </p>
                  {rotate && previous && (
                    <p className="mt-1 text-xs text-[#526174]">
                      이전 역할:{" "}
                      {roleForStudent(previous, s.id)?.name ?? "이전 배정 없음"}
                    </p>
                  )}
                </div>
                <label className="text-sm">
                  <span className="sr-only">
                    {s.number}번 {s.name} 역할
                  </span>
                  <select
                    aria-label={`${s.number}번 ${s.name} 역할`}
                    className={roleInput}
                    value={assignments[s.id] ?? ""}
                    onChange={(e) => {
                      setAssignments({
                        ...assignments,
                        [s.id]: e.target.value,
                      });
                      setConfirmed(false);
                    }}
                  >
                    <option value="">역할을 선택하세요</option>
                    {roles.map((r) => (
                      <option
                        key={r.id}
                        value={r.id}
                        disabled={
                          remaining(r) <= 0 && assignments[s.id] !== r.id
                        }
                      >
                        {r.name} · 남은 {remaining(r)}자리
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ))}
          </section>
          <label className="flex items-start gap-3 text-sm leading-6">
            <input
              type="checkbox"
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
