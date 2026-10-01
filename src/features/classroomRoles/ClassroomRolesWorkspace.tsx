import { useEffect, useState } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ClipboardCheck,
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
import { RoleHistoryPage } from "./RoleRecordPages";
import { RolePracticeBoardPage } from "./RolePracticeBoardPage";
import { RolePosterPrintPage } from "./RolePosterPrintPage";
export const ROLES_ROOT = "/tools/classroom-roles";
export type RolePageProps = {
  board: RoleBoard;
  save: (state: RoleState, rotateToken?: boolean) => Promise<boolean>;
  busy: boolean;
};
const tiles = [
  ["board", "실천 현황", "오늘 · 주간 · 지난 기록", ClipboardCheck],
  ["manage", "배정 관리", "현재 배정 변경 · 다음 기간 준비", Users],
  ["roles", "역할 관리", "역할 · 할 일 · 정원", ListChecks],
  ["settings", "운영 설정", "요일 · 제외일 · 공개 화면", Settings2],
] as const;

function RoleAssignmentManagement({ board }: { board: RoleBoard }) {
  const today = roleToday();
  const current = activeRolePeriod(board.state, today);
  const periods = [...board.state.periods].sort((a, b) => b.start.localeCompare(a.start));
  return (
    <div className="space-y-5">
      <section className={`${rolePanel} space-y-3`}>
        <h2 className="text-lg font-bold">{current ? "현재 배정" : "배정 시작"}</h2>
        <p className="text-sm leading-6 text-[#526174]">
          {current
            ? `${current.start} ~ ${current.end} · ${current.students.length}명 · 적용된 배정과 기록은 날짜별로 보존됩니다.`
            : "학생 명단과 역할을 준비해 첫 배정을 확정하세요."}
        </p>
        <div className="flex flex-wrap gap-2">
          {!periods.length && <Link className={roleButton} to={`${ROLES_ROOT}/assign`}>첫 배정 만들기</Link>}
          {current && current.end > today && (
            <Link className={roleButton} to={`${ROLES_ROOT}/assign?mode=current`}>현재 배정 변경</Link>
          )}
          {!!periods.length && (
            <Link className={current ? roleSecondary : roleButton} to={`${ROLES_ROOT}/rotate`}>다음 기간 준비</Link>
          )}
        </div>
        {current && current.end > today && <p className="text-xs text-[#526174]">현재 배정 변경은 적용일부터 새 배정을 만들며, 그 전 날짜와 기록은 그대로 둡니다.</p>}
      </section>
      {!!periods.length && (
        <section className={`${rolePanel} space-y-3`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold">운영 기간</h2>
            <Link className="text-sm font-semibold text-[#0F6CBD]" to={`${ROLES_ROOT}/settings`}>기간 수정·삭제 →</Link>
          </div>
          <ul className="divide-y divide-[#E2E8F0] text-sm">
            {periods.map((period) => (
              <li key={period.id} className="flex flex-wrap justify-between gap-2 py-3">
                <span className="font-semibold">{period.start} ~ {period.end}</span>
                <span className="text-[#526174]">{period.students.length}명 · {period.end < today ? "지난 기간" : period.start > today ? "예정" : "진행 중"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

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
            실천 현황 보기 →
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
            오늘 배정된 역할이 없습니다. 배정 관리에서 시작해 주세요.
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
        <div className="grid gap-4 sm:grid-cols-2">
          {tiles.map(([path, title, desc, Icon]) => (
            <Link
              to={`${ROLES_ROOT}/${path}`}
              className={`${rolePanel} group transition hover:border-[#0F6CBD] hover:shadow-sm focus-visible:outline-2 focus-visible:outline-[#0F6CBD]`}
              key={path}
            >
              <Icon className="h-7 w-7 text-[#0F6CBD]" aria-hidden="true" />
              <h3 className="mt-4 text-lg font-bold">{title}</h3>
              <p className="mt-1 text-sm leading-6 text-[#526174]">
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
  const isPosterRoute = location.pathname === `${ROLES_ROOT}/print`;
  const isAssignment = location.pathname === `${ROLES_ROOT}/assign` || location.pathname === `${ROLES_ROOT}/rotate`;
  const props = board ? { board, busy, save } : null;
  return (
    <div className={`mx-auto space-y-6 ${isAssignment ? 'max-w-6xl lg:max-w-none lg:space-y-0' : 'max-w-6xl'}`}>
      <header className={`${current ? "space-y-1" : "space-y-3"} ${isAssignment ? 'lg:hidden' : ''}`}>
        {(current || isPosterRoute) && (
          <Link
            className="inline-flex min-h-11 items-center gap-2 text-sm text-[#526174]"
            to={ROLES_ROOT}
          >
            <ArrowLeft className="h-4 w-4" />
            1인 1역 홈
          </Link>
        )}
        {!current && !isPosterRoute && (
          <p className="text-sm font-semibold text-[#0F6CBD]">
            스스로, 함께 가꾸는 우리 반
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold sm:text-3xl">
            {isPosterRoute ? "게시판 안내문 인쇄" : current?.[1] ?? (isAssignment ? "배정 관리" : location.pathname === `${ROLES_ROOT}/records` ? "실천 기록" : "1인 1역")}
          </h1>
          {board && !current && (
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
          <Route path="manage" element={<RoleAssignmentManagement board={props.board} />} />
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
          <Route path="board" element={<RolePracticeBoardPage {...props} />} />
          <Route path="print" element={<RolePosterPrintPage {...props} />} />
          <Route path="records" element={<RoleHistoryPage {...props} />} />
          <Route path="*" element={<RolesHome board={props.board} />} />
        </Routes>
      )}
    </div>
  );
}
