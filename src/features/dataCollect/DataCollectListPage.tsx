import { useEffect, useRef, useState } from "react";
import { CalendarDays, FileCheck2, Plus, Users, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  ToolHeaderBadge,
  ToolListHeader,
} from "../../components/ToolListHeader";
import { useTeacherAuth } from "../../auth/teacherAuth";
import { dataCollectOwnerId } from "./dataCollectConfig";
import {
  cleanupDataCollectTemplates,
  clearDataCollectQueryCache,
  listDataCollectionSummaries,
  subscribeDataCollections,
} from "./dataCollectService";
import { collectionStateLabel } from "./dataCollectUtils";
import type { DataCollectionListCursor, DataCollectionSummary } from "./types";

export function DataCollectListPage() {
  const { user } = useTeacherAuth();
  return (
    <DataCollectList
      owner={dataCollectOwnerId(user?.id)}
      key={dataCollectOwnerId(user?.id)}
    />
  );
}
function DataCollectList({ owner }: { owner: string }) {
  const navigate = useNavigate();
  const [collections, setCollections] = useState<DataCollectionSummary[]>([]);
  const [cursors, setCursors] = useState<
    Array<DataCollectionListCursor | undefined>
  >([undefined]);
  const [next, setNext] = useState<DataCollectionListCursor | null>(null);
  const [cleanupMessage, setCleanupMessage] = useState("");
  const [cleaning, setCleaning] = useState(false);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const forceNextLoad = useRef(false);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const updateTime = () => setNow(Date.now());
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") updateTime();
    };
    const timer = window.setInterval(updateTime, 10_000);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);
  const cursor = cursors.at(-1);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const load = async (force = false) => {
      try {
        const result = await listDataCollectionSummaries(owner, cursor, force);
        if (active) {
          setCollections(result.collections);
          setNext(result.nextCursor);
        }
      } catch (e) {
        if (active)
          setError(
            e instanceof Error
              ? e.message
              : "목록을 불러오지 못했습니다. 다시 시도해 주세요.",
          );
      } finally {
        if (active) setLoading(false);
      }
    };
    const force = forceNextLoad.current;
    forceNextLoad.current = false;
    void load(force);
    const unsubscribe = subscribeDataCollections(() => void load(true));
    return () => {
      active = false;
      unsubscribe();
    };
  }, [owner, cursor, refresh]);
  useEffect(() => () => clearDataCollectQueryCache(), [owner]);
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-12">
      <ToolListHeader
        eyebrow="파일을 원본 그대로"
        title="자료 수합"
        description="명단 또는 공개 링크로 파일과 회신을 받고 제출 현황을 확인합니다."
        toolbar={<ToolHeaderBadge>교사 전용</ToolHeaderBadge>}
        action={
          <button
            type="button"
            onClick={() => navigate("/tools/data-collect/new")}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#0F6CBD] px-5 text-sm font-bold text-white"
          >
            <Plus className="h-4 w-4" />새 자료 수합
          </button>
        }
      />
      <button
        type="button"
        disabled={loading}
        onClick={() => {
          forceNextLoad.current = true;
          setRefresh((v) => v + 1);
        }}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[#C8D0DA] bg-white px-4 text-sm font-bold"
      >
        <RefreshCw className="h-4 w-4" />
        목록 새로고침
      </button>
      {error ? (
        <p
          role="alert"
          className="rounded-lg bg-[#FEF2F2] p-4 text-sm font-semibold text-[#B42318]"
        >
          {error}
        </p>
      ) : null}
      {loading ? (
        <p role="status" className="py-10 text-center text-sm">
          목록을 불러오는 중입니다.
        </p>
      ) : !collections.length ? (
        <div className="border-y border-[#DCE3EA] bg-white py-16 text-center">
          <FileCheck2 className="mx-auto h-9 w-9 text-[#94A3B8]" />
          <h2 className="mt-4 text-lg font-bold">아직 자료 수합이 없습니다</h2>
          <p className="mt-3 text-sm text-[#526174]">
            파일 제출 또는 배포 자료 검토 요청을 만들어 보세요.
          </p>
          <button
            type="button"
            onClick={() => navigate("/tools/data-collect/new")}
            className="mt-4 min-h-[44px] rounded-lg border border-[#0F6CBD] px-5 text-sm font-bold text-[#0F6CBD]"
          >
            첫 자료 수합 만들기
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {collections.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => navigate("/tools/data-collect/" + c.id)}
              className="rounded-lg border border-[#DCE3EA] bg-white p-5 text-left hover:border-[#0F6CBD]"
            >
              <div className="flex flex-wrap justify-between gap-2 text-xs font-bold">
                <span className="rounded-md bg-[#F1F5F9] px-2 py-1">
                  {collectionStateLabel(c.status, c.dueAt, now)}
                </span>
                <span>{c.mode === "custom" ? "명단 없음" : "명단 있음"}</span>
              </div>
              <h2 className="mt-4 min-h-12 line-clamp-2 text-lg font-bold">
                {c.title}
              </h2>
              <p className="mt-3 flex items-center gap-2 text-sm text-[#526174]">
                <Users className="h-4 w-4" />
                {c.responded}/{c.total} 회신
              </p>
              <p className="mt-2 flex items-center gap-2 text-sm text-[#526174]">
                <CalendarDays className="h-4 w-4" />
                {c.dueAt
                  ? new Date(c.dueAt).toLocaleString("ko-KR") + "까지"
                  : "기한 없음"}
              </p>
              <p className="mt-4 border-t border-[#EEF1F4] pt-3 text-right text-xs font-bold text-[#0F6CBD]">
                현황 보기
              </p>
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={cursors.length === 1 || loading}
          onClick={() => setCursors((v) => v.slice(0, -1))}
          className="min-h-[44px] rounded-lg border px-4 text-sm font-bold disabled:opacity-40"
        >
          이전 목록
        </button>
        <p className="text-sm">{cursors.length}페이지 · 최대 20개씩</p>
        <button
          type="button"
          disabled={!next || loading}
          onClick={() => {
            if (next) setCursors((v) => [...v, next]);
          }}
          className="min-h-[44px] rounded-lg border px-4 text-sm font-bold disabled:opacity-40"
        >
          다음 목록
        </button>
      </div>
      <details className="rounded-lg border border-[#DCE3EA] bg-white p-4">
        <summary className="cursor-pointer text-sm font-bold">
          미완료 배포 파일 정리
        </summary>
        <p className="mt-2 text-sm text-[#526174]">
          업무 만들기가 끝나지 않은 배포 파일 중 2시간 지난 항목을 최대 50개
          정리합니다.
        </p>
        <button
          disabled={cleaning}
          className="mt-3 min-h-[44px] rounded-lg border border-[#C8D0DA] px-3 text-sm font-bold"
          onClick={() => {
            setCleaning(true);
            void cleanupDataCollectTemplates()
              .then((r) =>
                setCleanupMessage(
                  "정리 " + r.removed + "개 · 실패 " + r.failed + "개",
                ),
              )
              .catch((e) =>
                setError(
                  e instanceof Error
                    ? e.message
                    : "정리하지 못했습니다. 다시 시도해 주세요.",
                ),
              )
              .finally(() => setCleaning(false));
          }}
        >
          미완료 배포 파일 정리하기
        </button>
        {cleanupMessage ? (
          <p role="status" className="mt-2 text-sm">
            {cleanupMessage}
          </p>
        ) : null}
      </details>
    </div>
  );
}
