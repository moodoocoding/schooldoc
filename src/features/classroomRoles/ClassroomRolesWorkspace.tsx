import { useEffect, useState } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  ClipboardCheck,
  History,
  ListChecks,
  Settings2,
  Users,
} from "lucide-react";
import { useTeacherAuth } from "../../auth/teacherAuth";
import {
  activeRolePeriod,
  isRoleDay,
  isRolesDemo,
  loadRoleBoard,
  roleToday,
  saveRoleBoard,
  type RoleBoard,
  type RoleState,
} from "./roleApi";
import {
  RoleError,
  roleButton,
  rolePanel,
  roleSecondary,
} from "./RoleControls";
import { useRoleRecords } from "./useRoleRecords";
import { RoleAssignmentPage } from "./RoleAssignmentPage";
import { RoleCatalogPage, RoleSettingsPage } from "./RoleConfigurationPages";
import { RolePracticePage, RoleHistoryPage } from "./RoleRecordPages";
export const ROLES_ROOT = "/tools/classroom-roles";
export type RolePageProps = {
  board: RoleBoard;
  save: (state: RoleState, rotateToken?: boolean) => Promise<boolean>;
  busy: boolean;
};
const tiles = [
  [
    "board",
    "오늘의 실천판",
    "오늘의 기록 확인 · 학생 화면 열기와 공유",
    ClipboardCheck,
  ],
  ["records", "실천 기록", "선택한 달의 학생별 기록과 날짜별 상세", History],
  ["assign", "학생 역할 배정", "명단 확인 후 학생별 역할을 정해요", Users],
  ["roles", "역할 목록", "우리 반에 필요한 역할과 정원을 관리해요", ListChecks],
  [
    "rotate",
    "역할 교체",
    "이전 배정을 참고해 다음 기간을 준비해요",
    CalendarClock,
  ],
  [
    "settings",
    "운영 설정",
    "실천 요일 · 제외일 · 학생 화면 공개 설정",
    Settings2,
  ],
] as const;

function RolesHome({ board }: { board: RoleBoard }) {
  const today = roleToday();
  const period = activeRolePeriod(board.state, today);
  const { records, error, loading, refresh } = useRoleRecords(
    today,
    today,
    board.version,
  );
  const relevant =
    period?.students.filter((s) =>
      isRoleDay(board.state, period, s.id, today),
    ) ?? [];
  const count = (status: string) =>
    relevant.filter(
      (s) =>
        records.find((r) => r.period_id === period!.id && r.student_id === s.id)
          ?.status === status,
    ).length;
  const missing = relevant.filter(
    (s) =>
      !records.some((r) => r.period_id === period!.id && r.student_id === s.id),
  ).length;
  return (
    <>
      <section
        className={`${rolePanel} bg-[#EFF6FC]`}
        aria-label="오늘의 간단한 현황"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold">
            오늘의 현황{" "}
            <span className="ml-2 text-sm font-normal">{today}</span>
          </h2>
          <Link
            to={`${ROLES_ROOT}/board`}
            className="text-sm font-bold text-[#0F6CBD]"
          >
            실천판 보기 →
          </Link>
        </div>
        <RoleError message={error} />
        {error ? (
          <button className={roleSecondary} onClick={refresh}>
            현황 다시 불러오기
          </button>
        ) : loading ? (
          <p role="status" className="mt-4">
            오늘 기록을 불러오는 중…
          </p>
        ) : !period ? (
          <p className="mt-4 text-sm">
            오늘 배정된 역할이 없습니다. 학생 역할 배정에서 시작해 주세요.
          </p>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                ["했어요", count("done")],
                ["못했어요", count("not_done")],
                ["미기록", missing],
                [
                  "해당 없음",
                  period.students.length - relevant.length + count("exempt"),
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-sm text-[#526174]">{label}</p>
                  <p className="mt-1 text-2xl font-extrabold">
                    {value}
                    <span className="ml-1 text-sm font-normal">명</span>
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-[#526174]">
              학생 자기보고 기준 · 미기록은 미실천이 아닙니다.
            </p>
          </>
        )}
      </section>
      <section aria-label="1인 1역 기능">
        <h2 className="mb-4 text-lg font-bold">1인 1역 기능</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map(([path, title, desc, Icon], index) => (
            <Link
              to={`${ROLES_ROOT}/${path}`}
              className={`${rolePanel} group transition hover:border-[#0F6CBD] hover:shadow-sm focus-visible:outline-2 focus-visible:outline-[#0F6CBD]`}
              key={path}
            >
              <div className="flex justify-between">
                <Icon className="h-7 w-7 text-[#0F6CBD]" aria-hidden="true" />
                <span className="text-xs text-[#64748B]">
                  {index < 3 ? "학급 실천" : "운영 관리"}
                </span>
              </div>
              <h3 className="mt-5 text-lg font-bold">{title}</h3>
              <p className="mt-2 min-h-10 text-sm leading-6 text-[#526174]">
                {desc}
              </p>
              <ArrowRight
                className="mt-3 h-4 w-4 text-[#64748B] group-hover:text-[#0F6CBD]"
                aria-hidden="true"
              />
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

export function ClassroomRolesWorkspace() {
  const {
    configured,
    loading,
    user,
    signIn,
    error: authError,
  } = useTeacherAuth();
  const location = useLocation();
  const userId = user?.id;
  const [board, setBoard] = useState<RoleBoard | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setBoard(null);
    setError("");
    if (!userId && !isRolesDemo) return;
    loadRoleBoard()
      .then((b) => {
        if (!cancelled) setBoard(b);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, revision]);
  const save = async (state: RoleState, rotateToken = false) => {
    if (!board || busy) return false;
    setBusy(true);
    setError("");
    try {
      setBoard(await saveRoleBoard(board, state, rotateToken));
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  if (!isRolesDemo && loading)
    return <p role="status">로그인을 확인하고 있습니다.</p>;
  if (!isRolesDemo && !user)
    return (
      <section className={`${rolePanel} mx-auto my-16 max-w-xl space-y-4`}>
        <h1 className="text-2xl font-bold">1인 1역</h1>
        <p>교사 계정으로 로그인해 우리 반의 역할과 실천을 관리하세요.</p>
        <button
          className={roleButton}
          disabled={!configured}
          onClick={() => void signIn(ROLES_ROOT)}
        >
          {configured ? "Google로 로그인" : "서버 연결 설정 필요"}
        </button>
        <RoleError message={authError} />
      </section>
    );
  const current = tiles.find(
    ([path]) => location.pathname === `${ROLES_ROOT}/${path}`,
  );
  const props = board ? { board, busy, save } : null;
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-3">
        {current && (
          <Link
            className="inline-flex min-h-11 items-center gap-2 text-sm text-[#526174]"
            to={ROLES_ROOT}
          >
            <ArrowLeft className="h-4 w-4" />
            1인 1역 홈
          </Link>
        )}
        <p className="text-sm font-semibold text-[#0F6CBD]">
          스스로, 함께 가꾸는 우리 반
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold sm:text-3xl">
            {current?.[1] ?? "1인 1역"}
          </h1>
          {board && (
            <span className="text-sm text-[#526174]">
              {board.state.settings.title}
            </span>
          )}
        </div>
        {isRolesDemo && (
          <p className="text-xs text-[#64748B]">
            개발 데모 · 이 브라우저에만 저장됩니다. 다른 기기와 공유되지
            않습니다.
          </p>
        )}
      </header>
      <RoleError message={error} />
      {error && (
        <button
          className={roleSecondary}
          onClick={() => {
            if (
              !board ||
              window.confirm(
                "저장하지 않은 입력은 사라집니다. 서버 정보를 다시 불러올까요?",
              )
            )
              setRevision((n) => n + 1);
          }}
        >
          서버 정보 다시 불러오기
        </button>
      )}
      {!props ? (
        !error && <p role="status">우리 반 정보를 불러오는 중…</p>
      ) : (
        <Routes>
          <Route index element={<RolesHome board={props.board} />} />
          <Route
            path="assign"
            element={<RoleAssignmentPage key="assign" {...props} />}
          />
          <Route
            path="rotate"
            element={<RoleAssignmentPage key="rotate" {...props} rotate />}
          />
          <Route path="roles" element={<RoleCatalogPage {...props} />} />
          <Route path="settings" element={<RoleSettingsPage {...props} />} />
          <Route path="board" element={<RolePracticePage {...props} />} />
          <Route path="records" element={<RoleHistoryPage {...props} />} />
          <Route path="*" element={<RolesHome board={props.board} />} />
        </Routes>
      )}
    </div>
  );
}
