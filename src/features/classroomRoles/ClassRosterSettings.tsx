import { useEffect, useRef, useState } from "react";
import { ClassRosterImporter } from "./ClassRosterImporter";
import { useTeacherAuth } from "../../auth/teacherAuth";
import {
  isRolesDemo,
  loadRoleBoard,
  parseRoleRoster,
  saveRoleBoard,
  type RoleBoard,
} from "./roleApi";
import {
  RoleError,
  RoleField,
  roleButton,
  roleInput,
  roleSecondary,
} from "./RoleControls";

export function ClassRosterSettings() {
  const { user } = useTeacherAuth();
  const userId = user?.id;
  const [board, setBoard] = useState<RoleBoard | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reload, setReload] = useState(0);
  const [importPending, setImportPending] = useState(false);
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const summaryRef = useRef<HTMLHeadingElement>(null);
  const focusTarget = useRef<"editor" | "summary" | null>(null);
  useEffect(() => {
    if (focusTarget.current === "editor") textareaRef.current?.focus();
    if (focusTarget.current === "summary") summaryRef.current?.focus();
    focusTarget.current = null;
  }, [editing]);
  useEffect(() => {
    let cancelled = false;
    setBoard(null);
    setError("");
    setSaved(false);
    setText("");
    setImportPending(false);
    setEditing(false);
    if (!userId && !isRolesDemo) return;
    loadRoleBoard()
      .then((b) => {
        if (!cancelled) {
          setBoard(b);
          setEditing(b.state.roster.length === 0);
          setText(
            b.state.roster.map((s) => `${s.number} ${s.name}`).join("\n"),
          );
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, reload]);
  if (!user && !isRolesDemo)
    return (
      <p className="text-sm">교사 로그인 후 학생 명단을 등록할 수 있습니다.</p>
    );
  const save = async () => {
    if (!board || busy || importPending) return;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const next = await saveRoleBoard(board, {
        ...board.state,
        roster: parseRoleRoster(text, board.state.roster),
      });
      setBoard(next);
      setSaved(true);
      focusTarget.current = "summary";
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const edit = () => {
    if (!board) return;
    setText(board.state.roster.toSorted((a, b) => a.number - b.number)
      .map((student) => `${student.number} ${student.name}`).join("\n"));
    setSaved(false);
    setError("");
    setImportPending(false);
    focusTarget.current = "editor";
    setEditing(true);
  };
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">학급 학생 명단</h2>
        <p className="mt-2 text-sm text-[#64748B]">
          1인 1역 배정 1단계에 자동 적용됩니다. 명단을 수정해도 이미 확정한
          배정과 기록은 바뀌지 않습니다.
        </p>
      </div>
      <RoleError message={error} />
      {board ? (
        editing ? <>
          <ClassRosterImporter
            key={userId ?? "demo"}
            disabled={busy}
            onPendingChange={(pending) => {
              setImportPending(pending);
              if (pending) setSaved(false);
            }}
            onApply={(nextText) => {
              setText(nextText);
              setSaved(false);
              setError("");
              textareaRef.current?.focus();
            }}
          />
          <RoleField label="학생 명단 (한 줄에 번호와 이름)">
            <textarea
              ref={textareaRef}
              disabled={busy}
              className={roleInput}
              rows={10}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setSaved(false);
              }}
              placeholder={"1 김하늘\n2 이바다"}
            />
          </RoleField>
          <p className="text-xs text-[#64748B]">
            번호는 중복 없이 입력해 주세요. 같은 이름은 번호로 구분합니다.{" "}
            {isRolesDemo
              ? "데모: 이 브라우저에만 저장됩니다."
              : "교사 계정에 암호화해 저장됩니다."}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={roleButton}
              disabled={busy || importPending}
              onClick={() => void save()}
            >
              {busy ? "저장 중…" : "학생 명단 저장"}
            </button>
            <button
              type="button"
              className={roleSecondary}
              disabled={busy}
              onClick={() => {
                setError("");
                setImportPending(false);
                focusTarget.current = "summary";
                setEditing(false);
              }}
            >
              수정 취소
            </button>
          </div>
        </>
        : <div className="space-y-4 rounded-2xl border border-[#DCE3EA] bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 ref={summaryRef} tabIndex={-1} className="font-bold focus:outline-none">등록된 학생 명단</h3>
              <p className="mt-1 text-sm text-[#526174]">총 {board.state.roster.length}명 · 번호순</p>
            </div>
            <button type="button" className={roleSecondary} onClick={edit}>
              {board.state.roster.length ? "명단 수정" : "학생 등록"}
            </button>
          </div>
          {saved ? <p role="status" className="text-sm font-semibold text-[#16803C]">학생 명단을 저장했습니다.</p> : null}
          {board.state.roster.length ? <table className="w-full table-fixed border-collapse text-left text-sm">
            <caption className="sr-only">저장된 학급 명단</caption>
            <thead className="bg-[#F8FAFC]"><tr className="border-b border-[#DCE3EA]">
              <th scope="col" className="w-20 px-3 py-3">번호</th>
              <th scope="col" className="px-3 py-3">이름</th>
            </tr></thead>
            <tbody>{board.state.roster.toSorted((a, b) => a.number - b.number).map((student) => (
              <tr key={student.id} className="border-b border-[#E2E8F0] last:border-0">
                <td className="px-3 py-3 text-[#526174]">{student.number}</td>
                <td className="break-words px-3 py-3 font-medium">{student.name}</td>
              </tr>
            ))}</tbody>
          </table> : <p className="py-4 text-sm text-[#64748B]">등록된 학생이 없습니다. 학생 등록을 눌러 명단을 추가해 주세요.</p>}
          <p className="text-xs text-[#64748B]">{isRolesDemo ? "데모: 이 브라우저에만 저장됩니다." : "교사 계정에 암호화해 저장됩니다."}</p>
        </div>
      ) : error ? (
        <button
          className={roleSecondary}
          onClick={() => setReload((n) => n + 1)}
        >
          다시 불러오기
        </button>
      ) : (
        <p role="status">명단을 불러오는 중…</p>
      )}
    </section>
  );
}
