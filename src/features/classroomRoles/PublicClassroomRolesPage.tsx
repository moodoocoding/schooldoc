import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  isRolesDemo,
  loadPublicRoleBoard,
  ROLE_STATUS_LABELS,
  writeRoleRecord,
  type PublicRoleBoard,
} from "./roleApi";
import {
  RoleError,
  roleButton,
  rolePanel,
  roleSecondary,
} from "./RoleControls";

export function PublicClassroomRolesPage() {
  const { token = "" } = useParams();
  const [params] = useSearchParams();
  const display = params.get("view") === "display";
  const [board, setBoard] = useState<PublicRoleBoard | null>(null);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    setLoading(true);
    setError("");
    const refresh = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const next = await loadPublicRoleBoard(token, selected || undefined);
        if (!cancelled) {
          setBoard(next);
          setError("");
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        inFlight = false;
        if (!cancelled) setLoading(false);
      }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 30000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [token, selected, retry]);
  const student = board?.students.find((s) => s.id === selected);
  const submit = async (status: "done" | "not_done") => {
    if (!student || !board?.periodId || busy || loading || error) return;
    setBusy(true);
    setError("");
    try {
      await writeRoleRecord({
        token,
        periodId: board.periodId,
        studentId: student.id,
        date: board.today,
        status,
      });
      setMessage(
        `${student.number}번 ${student.name}: '${ROLE_STATUS_LABELS[status]}' 기록을 저장했어요.`,
      );
      setSelected("");
      setRetry((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const masked = (name: string) =>
    name.length <= 1 ? "○" : name[0] + "○".repeat(name.length - 1);
  return (
    <main className="min-h-screen bg-[#F6F8FB] px-4 py-8 text-[#0F172A] sm:px-8">
      <div
        className={`mx-auto space-y-6 ${display ? "max-w-7xl" : "max-w-3xl"}`}
      >
        <header>
          <p className="text-sm font-semibold text-[#0F6CBD]">
            스스로, 함께 가꾸는 우리 반
          </p>
          <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">
            {board?.title ?? "우리 반 1인 1역"}
          </h1>
          <p className="mt-2 text-sm text-[#526174]">
            {board?.today}{" "}
            {display ? "· 전자칠판 보기 (입력 없음)" : "· 오늘의 실천 체크"}
          </p>
          {isRolesDemo && (
            <p className="mt-2 text-xs">
              개발 데모 · 같은 브라우저에서만 동작합니다.
            </p>
          )}
        </header>
        <RoleError message={error} />
        {error && (
          <button
            className={roleSecondary}
            onClick={() => setRetry((n) => n + 1)}
          >
            다시 불러오기
          </button>
        )}
        {message && (
          <p
            role="status"
            className="rounded-xl bg-emerald-50 p-4 font-semibold text-emerald-800"
          >
            {message}
          </p>
        )}
        {loading ? (
          <p role="status">불러오는 중…</p>
        ) : error ? null : !board?.periodId ? (
          <section className={rolePanel}>
            {board?.message || "사용할 수 없는 학급 화면입니다."}
          </section>
        ) : display ? (
          <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-4">
            {board.students.map((s) => (
              <article key={s.id} className={`${rolePanel} text-center`}>
                <h2 className="text-xl font-bold">{s.role.name}</h2>
                <p className="mt-3 text-lg">
                  {s.number}번{" "}
                  {board.maskDisplayNames ? masked(s.name) : s.name}
                </p>
                {board.showStatus && (
                  <p className="mt-3 font-semibold text-[#0F6CBD]">
                    {
                      ROLE_STATUS_LABELS[
                        s.status ?? (s.eligible ? "missing" : "exempt")
                      ]
                    }
                  </p>
                )}
              </article>
            ))}
          </div>
        ) : student ? (
          <section className={`${rolePanel} space-y-6`}>
            <button
              className={roleSecondary}
              disabled={busy}
              onClick={() => setSelected("")}
            >
              ← 이름 다시 선택
            </button>
            <div>
              <p className="text-sm text-[#526174]">
                {student.number}번 {student.name}의 역할
              </p>
              <h2 className="mt-2 text-3xl font-extrabold">
                {student.role.name}
              </h2>
              <p className="mt-4 whitespace-pre-wrap text-base leading-7">
                {student.role.description ||
                  "우리 반에서 약속한 역할을 실천해요."}
              </p>
            </div>
            {student.status && (
              <p>
                오늘 기록: <strong>{ROLE_STATUS_LABELS[student.status]}</strong>{" "}
                · 다시 누르면 수정돼요.
              </p>
            )}
            {student.eligible ? (
              <div className="grid grid-cols-2 gap-3">
                <button
                  className="min-h-28 rounded-2xl bg-[#0F6CBD] px-4 text-xl font-bold text-white disabled:opacity-50"
                  disabled={busy}
                  onClick={() => void submit("done")}
                >
                  {busy ? "저장 중…" : "했어요"}
                </button>
                <button
                  className="min-h-28 rounded-2xl border-2 border-[#CBD5E1] bg-white px-4 text-xl font-bold disabled:opacity-50"
                  disabled={busy}
                  onClick={() => void submit("not_done")}
                >
                  {busy ? "저장 중…" : "못했어요"}
                </button>
              </div>
            ) : (
              <p className="rounded-xl bg-[#EFF6FC] p-4">
                오늘은 이 역할을 하지 않는 날이에요.
              </p>
            )}
            <p className="text-sm text-[#64748B]">
              버튼을 누르면 바로 저장돼요. 결석 등으로 역할이 없었다면 선생님께
              알려 주세요.
            </p>
          </section>
        ) : (
          <section className="space-y-4">
            <h2 className="text-xl font-bold">내 이름을 선택해 주세요</h2>
            <p className="text-sm text-[#526174]">
              자신의 번호와 이름을 확인해요. 친구의 기록은 바꾸지 않아요.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {board.students.map((s) => (
                <button
                  className={`${rolePanel} min-h-24 text-center hover:border-[#0F6CBD]`}
                  key={s.id}
                  onClick={() => {
                    setMessage("");
                    setSelected(s.id);
                  }}
                >
                  <span className="text-sm text-[#64748B]">{s.number}번</span>
                  <span className="mt-1 block text-lg font-bold">{s.name}</span>
                  {board.showStatus && (
                    <span className="mt-2 block text-xs text-[#0F6CBD]">
                      {
                        ROLE_STATUS_LABELS[
                          s.status ?? (s.eligible ? "missing" : "exempt")
                        ]
                      }
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>
        )}
        {display && (
          <button
            className={roleButton}
            onClick={() =>
              void document.documentElement
                .requestFullscreen?.()
                .catch(() =>
                  setError("전체 화면을 지원하지 않는 브라우저입니다."),
                )
            }
          >
            전체 화면
          </button>
        )}
        <footer className="text-center text-xs text-[#64748B]">
          학급 공용 화면 · 학생 자기보고 · 개인정보가 포함된 링크를 학급 밖에
          공유하지 마세요.
        </footer>
      </div>
    </main>
  );
}
