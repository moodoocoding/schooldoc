import { useEffect, useState } from "react";
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
  useEffect(() => {
    let cancelled = false;
    setBoard(null);
    setError("");
    setSaved(false);
    if (!userId && !isRolesDemo) return;
    loadRoleBoard()
      .then((b) => {
        if (!cancelled) {
          setBoard(b);
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
    if (!board) return;
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
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
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
        <>
          <RoleField label="학생 명단 (한 줄에 번호와 이름)">
            <textarea
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
          <button
            type="button"
            className={roleButton}
            disabled={busy}
            onClick={() => void save()}
          >
            {busy ? "저장 중…" : "학생 명단 저장"}
          </button>
          {saved && <p role="status">학생 명단을 저장했습니다.</p>}
        </>
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
