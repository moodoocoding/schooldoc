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
  const [periodEditing, setPeriodEditing] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [focusUnassignedSignal, setFocusUnassignedSignal] = useState(0);
  const [draftChanged, setDraftChanged] = useState(false);
  const reviewDialogRef = useRef<HTMLDialogElement>(null);
  const reviewButtonRef = useRef<HTMLButtonElement>(null);
  const unassigned = students.filter((s) => !assignments[s.id]).length;
  const seatShortage = Math.max(
    0,
    students.length - roles.reduce((total, role) => total + role.capacity, 0),
  );
  useEffect(() => {
    const dialog = reviewDialogRef.current;
    if (reviewOpen && dialog && !dialog.open) dialog.showModal();
    if (!reviewOpen && dialog?.open) dialog.close();
  }, [reviewOpen]);
  useEffect(() => {
    if (!draftChanged) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [draftChanged]);
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
    setStep(2);
    setError("");
  };
  const draftState = () => ({
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
  });
  const openReview = () => {
    try {
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
  return (
    <div className="space-y-3">
      <ol className="flex flex-wrap gap-2 text-sm" aria-label="배정 단계">
        {["명단 확인", "역할 배정"].map((label, i) => (
          <li
            aria-current={step === i + 1 ? "step" : undefined}
            className={`rounded-full border px-3 py-1 ${step === i + 1 ? "border-[#0F6CBD] bg-[#EFF6FC] font-bold" : "border-[#DCE3EA]"}`}
            key={label}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>
      {rotate && (
        <p className="text-sm text-[#526174]">
          {previous
            ? `이전 배정 ${previous.start} ~ ${previous.end} · 새 기간을 준비합니다.`
            : "첫 배정을 만든 뒤 다음 기간부터 역할을 교체할 수 있습니다."}
        </p>
      )}
      {step === 1 ? (
        <section className={`${rolePanel} space-y-4`}>
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
          <p className="text-sm text-[#526174]">
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
            {editingRoster
              ? "최대 60명 · 같은 이름은 번호로 구분합니다."
              : "명단 변경은 배정을 확정할 때 저장됩니다."}
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
          <section className="rounded-xl border border-[#DCE3EA] bg-white px-4 py-2" aria-label="배정 기간">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="font-semibold">배정 기간</span>
              <span>{start} ~ {end}</span>
              <button
                type="button"
                className="min-h-11 font-semibold text-[#0F6CBD]"
                disabled={busy}
                onClick={() => setPeriodEditing((value) => !value)}
              >
                기간 변경
              </button>
            </div>
            {periodEditing && (
              <div className="grid gap-3 border-t border-[#E2E8F0] py-3 sm:grid-cols-2">
                <RoleField label="시작일">
                  <input
                    type="date"
                    className={roleInput}
                    value={start}
                    disabled={busy}
                    onChange={(event) => {
                      setStart(event.target.value);
                      setDraftChanged(true);
                    }}
                  />
                </RoleField>
                <RoleField label="종료일">
                  <input
                    type="date"
                    className={roleInput}
                    value={end}
                    disabled={busy}
                    onChange={(event) => {
                      setEnd(event.target.value);
                      setDraftChanged(true);
                    }}
                  />
                </RoleField>
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
            previous={rotate ? previous : undefined}
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
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#DCE3EA] bg-white p-3">
            <button
              disabled={busy}
              className={roleSecondary}
              onClick={() => setStep(1)}
            >
              이전
            </button>
            {unassigned > 0 ? (
              <button
                type="button"
                className="min-h-11 text-sm font-semibold text-[#0F6CBD]"
                onClick={() => setFocusUnassignedSignal((value) => value + 1)}
              >
                미배정 {unassigned}명
              </button>
            ) : <span role="status" className="text-sm font-semibold text-[#16803C]">모두 배정됨</span>}
            <button
              ref={reviewButtonRef}
              disabled={busy || unassigned > 0}
              className={roleButton}
              onClick={openReview}
            >
              배정 확인
            </button>
          </div>
          <dialog
            ref={reviewDialogRef}
            aria-labelledby="role-review-heading"
            className="m-auto w-[min(92vw,580px)] max-h-[80vh] overflow-y-auto rounded-xl border border-[#DCE3EA] bg-white p-5 shadow-xl backdrop:bg-black/40"
            onClose={() => {
              setReviewOpen(false);
              reviewButtonRef.current?.focus();
            }}
          >
            <h2 id="role-review-heading" className="text-xl font-bold">배정 확인</h2>
            <p className="mt-2 text-sm">{start} ~ {end} · {students.length}명</p>
            {start > roleToday() && <p className="mt-1 text-sm text-[#526174]">학생 화면에는 {start}부터 새 역할이 표시됩니다.</p>}
            <div className="mt-4 space-y-3">
              {roles.filter((role) => students.some((student) => assignments[student.id] === role.id)).map((role) => (
                <section key={role.id} className="rounded-lg border border-[#DCE3EA] p-3">
                  <h3 className="font-semibold">{role.name}</h3>
                  <p className="mt-1 break-words text-sm text-[#526174]">
                    {students.filter((student) => assignments[student.id] === role.id).map((student) => `${student.number}번 ${student.name}`).join(", ")}
                  </p>
                </section>
              ))}
            </div>
            <p className="mt-4 text-sm font-semibold text-[#9A3412]">확정 후 이 배정은 직접 수정할 수 없습니다.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" disabled={busy} className={roleSecondary} onClick={() => setReviewOpen(false)}>돌아가기</button>
              <button type="button" disabled={busy} className={roleButton} onClick={() => void publish()}>
                {busy ? "확정 중…" : "확정하기"}
              </button>
            </div>
          </dialog>
        </>
      )}
    </div>
  );
}
