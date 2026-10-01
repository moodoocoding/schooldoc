import { createPortal } from "react-dom";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ClipboardCopy,
  Download,
  ImageDown,
  RefreshCw,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useNavigate, useParams } from "react-router-dom";
import { useTeacherAuth } from "../../auth/teacherAuth";
import { getPublicAppOrigin } from "../../utils/publicAppOrigin";
import { qrImageFileName, saveQrImage } from "../../utils/qrImage";
import { dataCollectOwnerId } from "./dataCollectConfig";
import {
  cleanupDataCollectionUploads,
  clearDataCollectQueryCache,
  getDataCollectionOverview,
  getDataCollectionHistory,
  getDataCollectionDownload,
  getDataCollectionExport,
  subscribeDataCollections,
  updateDataCollectionDue,
  setDataCollectionStatus,
} from "./dataCollectService";
import {
  collectionDecisionLabel,
  collectionStateLabel,
} from "./dataCollectUtils";
import {
  dataCollectZip,
  exportDataCollectExcel,
  safeCollectionFileName,
  saveDataCollectBlob,
} from "./dataCollectExport";
import type {
  DataCollectionExport,
  DataCollectionHistoryItem,
  DataCollectionOverview,
  DataCollectionTargetStatus,
} from "./types";

const button =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-[#C8D0DA] bg-white px-3 text-sm font-bold text-[#334155] disabled:opacity-50";
const message = (e: unknown) =>
  e instanceof Error
    ? e.message
    : "요청을 처리하지 못했습니다. 다시 시도해 주세요.";
const dateInput = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};

export function DataCollectManagePage() {
  const { user } = useTeacherAuth();
  const { id = "" } = useParams();
  const owner = dataCollectOwnerId(user?.id);
  return <ManageCollection key={owner + ":" + id} owner={owner} id={id} />;
}
function ManageCollection({ owner, id }: { owner: string; id: string }) {
  const navigate = useNavigate();
  const [data, setData] = useState<DataCollectionOverview>();
  const [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [after, setAfter] = useState(0),
    [back, setBack] = useState<number[]>([]);
  const [unsubmitted, setUnsubmitted] = useState(false),
    [auto, setAuto] = useState(false);
  const [loadedAt, setLoadedAt] = useState(""),
    [now, setNow] = useState(Date.now());
  const [due, setDue] = useState(""),
    [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false),
    [savingQr, setSavingQr] = useState(false);
  const [historyTarget, setHistoryTarget] =
    useState<DataCollectionTargetStatus>();
  const [history, setHistory] = useState<DataCollectionHistoryItem[]>([]);
  const [historyError, setHistoryError] = useState(""),
    [historyLoading, setHistoryLoading] = useState(false);
  const [nextRevision, setNextRevision] = useState<number | null>(null);
  const [exportData, setExportData] = useState<DataCollectionExport>();
  const exportSnapshot = useRef<DataCollectionExport | undefined>(undefined);
  const [selected, setSelected] = useState<
    Map<string, DataCollectionTargetStatus>
  >(new Map());
  const [cleanupResult, setCleanupResult] = useState("");
  const [zipProgress, setZipProgress] = useState("");
  const zipAbort = useRef<AbortController | undefined>(undefined);
  const abortZip = useCallback(() => zipAbort.current?.abort(), []);
  const [shareInitiallyOpen] = useState(() => window.innerWidth >= 768);
  const qrRef = useRef<HTMLDivElement>(null),
    dialogRef = useRef<HTMLDialogElement>(null);
  const alive = useRef(true);
  const generation = useRef(0);
  const stopRefresh = useCallback(() => {
    alive.current = false;
    generation.current++;
  }, []);
  const refresh = useCallback(
    async (force = false) => {
      const request = ++generation.current;
      setLoading(true);
      setError("");
      try {
        const value = await getDataCollectionOverview(
          owner,
          id,
          after,
          unsubmitted,
          force,
        );
        if (!alive.current || request !== generation.current) return;
        setData(value);
        setLoadedAt(new Date().toLocaleTimeString("ko-KR"));
        setDue(dateInput(value.collection.dueAt));
        exportSnapshot.current = undefined;
        setExportData(undefined);
        setSelected(new Map());
      } catch (e) {
        if (alive.current && request === generation.current)
          setError(message(e));
      } finally {
        if (alive.current && request === generation.current) setLoading(false);
      }
    },
    [owner, id, after, unsubmitted],
  );
  useEffect(() => {
    alive.current = true;
    void refresh();
    const unsubscribe = subscribeDataCollections(() => void refresh(true));
    return () => {
      stopRefresh();
      unsubscribe();
      clearDataCollectQueryCache();
      abortZip();
    };
  }, [refresh, abortZip, stopRefresh]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 10000);
    return () => window.clearInterval(timer);
  }, []);
  const open = data
    ? collectionStateLabel(
        data.collection.status,
        data.collection.dueAt,
        now,
      ) === "수합 중"
    : false;
  useEffect(() => {
    if (!auto || !open) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh(true);
    }, 60000);
    return () => window.clearInterval(timer);
  }, [auto, open, refresh]);
  const download = async (fileId?: string) => {
    try {
      const link = await getDataCollectionDownload(owner, id, fileId);
      const response = await fetch(link.url);
      if (!response.ok)
        throw new Error("파일을 내려받지 못했습니다. 다시 눌러 주세요.");
      saveDataCollectBlob(await response.blob(), link.name);
    } catch (e) {
      setError(message(e));
    }
  };
  const loadHistory = async (
    target: DataCollectionTargetStatus,
    before?: number,
  ) => {
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const result = await getDataCollectionHistory(
        owner,
        id,
        target.id,
        before,
      );
      setHistory((h) =>
        before ? [...h, ...result.submissions] : result.submissions,
      );
      setNextRevision(result.nextRevision);
    } catch (e) {
      setHistoryError(message(e));
    } finally {
      setHistoryLoading(false);
    }
  };
  const showHistory = (target: DataCollectionTargetStatus) => {
    setHistoryTarget(target);
    setHistory([]);
    setNextRevision(null);
    dialogRef.current?.showModal();
    void loadHistory(target);
  };
  const snapshot = async () => {
    if (!exportSnapshot.current)
      exportSnapshot.current = await getDataCollectionExport(owner, id);
    setExportData(exportSnapshot.current);
    return exportSnapshot.current;
  };
  const exportRows = async (kind: "excel" | "print") => {
    try {
      setBusy(true);
      setError("");
      const value = await snapshot();
      if (kind === "excel") await exportDataCollectExcel(value);
      else window.setTimeout(() => window.print(), 100);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  const exportZip = async () => {
    if (!selected.size) return;
    const rows = [...selected.values()],
      bytes = rows.reduce((sum, r) => sum + (r.submission?.byteSize ?? 0), 0);
    if (bytes > 100 * 1024 * 1024) {
      setError("ZIP 한 번에 받기는 100MiB 이하로 선택해 주세요.");
      return;
    }
    const controller = new AbortController();
    zipAbort.current = controller;
    setBusy(true);
    setError("");
    try {
      const entries = [];
      for (const [i, row] of rows.entries()) {
        setZipProgress(i + 1 + " / " + rows.length + "개 다운로드");
        const link = await getDataCollectionDownload(
          owner,
          id,
          row.submission!.id,
        );
        const response = await fetch(link.url, { signal: controller.signal });
        if (!response.ok)
          throw new Error(
            row.rowNumber +
              "번 파일을 받지 못했습니다. 선택을 유지했으니 다시 시도해 주세요.",
          );
        entries.push({
          name: safeCollectionFileName(row.rowNumber + "_" + link.name),
          bytes: new Uint8Array(await response.arrayBuffer()),
        });
      }
      saveDataCollectBlob(
        dataCollectZip(entries),
        safeCollectionFileName(
          (data?.collection.title ?? "자료") + "_제출파일.zip",
        ),
      );
      setZipProgress("ZIP 저장 완료");
    } catch (e) {
      if (!controller.signal.aborted) setError(message(e));
      else setZipProgress("다운로드를 취소했습니다.");
    } finally {
      setBusy(false);
      zipAbort.current = undefined;
    }
  };
  if (!data && loading)
    return <p className="py-16 text-center">자료 수합을 불러오는 중입니다.</p>;
  if (!data)
    return (
      <div className="py-16 text-center">
        <p role="alert">{error || "자료 수합을 찾을 수 없습니다."}</p>
        <button className={button + " mt-4"} onClick={() => void refresh(true)}>
          다시 불러오기
        </button>
      </div>
    );
  const c = data.collection,
    publicUrl = getPublicAppOrigin() + "/s/data/" + c.publicToken;
  const selectedBytes = [...selected.values()].reduce(
    (sum, r) => sum + (r.submission?.byteSize ?? 0),
    0,
  );
  return (
    <>
      <div className="mx-auto w-full max-w-7xl space-y-5 pb-12">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DCE3EA] pb-3">
          <button
            className={button}
            onClick={() => navigate("/tools/data-collect")}
          >
            <ArrowLeft size={18} />
            자료 수합 목록
          </button>
          <span className="rounded-md bg-[#EEF1F4] px-3 py-2 text-sm font-bold">
            {collectionStateLabel(c.status, c.dueAt, now)}
          </span>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold text-[#0F6CBD]">
              {c.mode === "custom" ? "명단 없음" : "명단 있음"}
            </p>
            <h1 className="mt-1 break-words text-2xl font-extrabold sm:text-3xl">
              {c.title}
            </h1>
            <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-[#526174]">
              {c.description || "별도 안내가 없습니다."}
            </p>
          </div>
          <button
            className={button}
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void setDataCollectionStatus(
                owner,
                id,
                c.status === "open" ? "closed" : "open",
              )
                .then(() => refresh(true))
                .catch((e) => setError(message(e)))
                .finally(() => setBusy(false));
            }}
          >
            {c.status === "open" ? "수합 종료" : "다시 열기"}
          </button>
        </div>
        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-4 text-sm text-[#B42318]"
          >
            {error}
          </p>
        ) : null}
        <section
          aria-label="수합 요약"
          className="grid grid-cols-3 gap-px rounded-lg border border-[#DCE3EA] bg-[#DCE3EA]"
        >
          {[
            [c.total, "전체 대상"],
            [c.responded, "회신 완료"],
            [
              c.total - c.responded - c.needsRepair,
              c.hasTemplate ? "미확인" : "미제출",
            ],
          ].map(([n, label]) => (
            <div key={label} className="bg-white p-4">
              <p className="text-xs font-semibold text-[#526174]">{label}</p>
              <p className="mt-2 text-2xl font-extrabold">{n}</p>
            </div>
          ))}
        </section>
        {c.needsRepair > 0 ? (
          <p
            role="status"
            className="rounded-lg border border-[#FECACA] bg-white p-4 text-sm text-[#B42318]"
          >
            기존 현황 {c.needsRepair}명의 확인이 필요합니다. 해당 대상의 제출
            이력을 확인해 주세요. 현재 제출과 과거 기록을 자동으로 바꾸지
            않았습니다.
          </p>
        ) : null}
        <details
          open={shareInitiallyOpen}
          className="rounded-lg border border-[#DCE3EA] bg-white p-5"
        >
          <summary className="cursor-pointer text-lg font-bold">
            공유 링크와 QR
          </summary>
          <div className="mt-4 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,190px)]">
            <div className="min-w-0">
              <p className="text-sm text-[#526174]">
                링크나 QR을 받은 사람은 본인을 찾고 자료를 제출합니다.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  readOnly
                  value={publicUrl}
                  aria-label="자료 수합 공개 링크"
                  className="min-h-[44px] min-w-0 flex-[1_1_220px] rounded-lg border border-[#C8D0DA] px-3 text-sm"
                />
                <button
                  className={button}
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(publicUrl)
                      .then(() => {
                        setCopied(true);
                        window.setTimeout(() => setCopied(false), 1500);
                      })
                      .catch(() =>
                        setError(
                          "링크를 복사하지 못했습니다. 주소를 직접 복사해 주세요.",
                        ),
                      )
                  }
                >
                  <ClipboardCopy size={16} />
                  {copied ? "복사됨" : "링크 복사"}
                </button>
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={button}
                >
                  열기
                </a>
              </div>
              {c.hasTemplate ? (
                <button
                  className={button + " mt-4 max-w-full break-all text-left"}
                  onClick={() => void download()}
                >
                  <Download size={16} />
                  배포 파일: {c.templateName}
                </button>
              ) : (
                <p className="mt-4 text-sm text-[#526174]">
                  배포 파일 없이 제출 파일만 받습니다.
                </p>
              )}
            </div>
            <div className="flex min-w-0 flex-col items-center">
              <div ref={qrRef} className="w-full max-w-[160px] bg-white p-2">
                <QRCodeSVG
                  value={publicUrl}
                  size={144}
                  className="h-auto w-full"
                  title="자료 수합 공개 링크 QR 코드"
                  role="img"
                  level="M"
                />
              </div>
              <button
                className={button + " mt-2"}
                disabled={savingQr}
                onClick={() => {
                  setSavingQr(true);
                  void saveQrImage(
                    qrRef.current,
                    qrImageFileName(c.title, "자료수합_QR", "자료수합"),
                  )
                    .catch((e) => setError(message(e)))
                    .finally(() => setSavingQr(false));
                }}
              >
                <ImageDown size={16} />
                QR 이미지 저장
              </button>
            </div>
          </div>
        </details>
        <details className="rounded-lg border border-[#DCE3EA] bg-white p-5">
          <summary className="cursor-pointer font-bold">
            마감 기한 변경 ·{" "}
            {c.dueAt ? new Date(c.dueAt).toLocaleString("ko-KR") : "기한 없음"}
          </summary>
          {!open && c.status === "open" ? (
            <p className="mt-3 text-sm font-bold text-[#8A5A00]">
              기한이 지났습니다. 기한을 연장하면 다시 제출할 수 있습니다.
            </p>
          ) : null}
          <form
            className="mt-4 flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              setBusy(true);
              void updateDataCollectionDue(
                owner,
                id,
                due ? new Date(due).toISOString() : "",
              )
                .then(() => refresh(true))
                .catch((err) => setError(message(err)))
                .finally(() => setBusy(false));
            }}
          >
            <label className="text-sm font-bold">
              새 마감 시각
              <input
                type="datetime-local"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                className="mt-2 block min-h-[44px] max-w-full rounded-lg border border-[#C8D0DA] px-3"
              />
            </label>
            <button type="button" className={button} onClick={() => setDue("")}>
              기한 없음
            </button>
            <button type="submit" className={button} disabled={busy}>
              기한 저장
            </button>
          </form>
          <p className="mt-3 text-xs text-[#526174]">
            수합 종료한 업무는 기한을 바꾼 뒤에도 ‘다시 열기’를 눌러야 제출할 수
            있습니다.
          </p>
        </details>
        <section className="rounded-lg border border-[#DCE3EA] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DCE3EA] p-5">
            <div>
              <h2 className="text-lg font-bold">회신 현황</h2>
              <p className="mt-1 text-sm text-[#526174]">
                {loadedAt} 확인 · 한 페이지 50명
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                className={button}
                disabled={loading}
                onClick={() => void refresh(true)}
              >
                <RefreshCw size={16} />
                {loading ? "조회 중" : "현황 새로고침"}
              </button>
              <label className="flex min-h-[44px] items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={auto}
                  onChange={(e) => setAuto(e.target.checked)}
                />
                60초 자동 갱신
              </label>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <label className="flex min-h-[44px] items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={unsubmitted}
                onChange={(e) => {
                  setAfter(0);
                  setBack([]);
                  setUnsubmitted(e.target.checked);
                }}
              />
              {c.hasTemplate ? "미확인만 보기" : "미제출만 보기"}
            </label>
            <p className="text-xs text-[#526174]">
              자동 갱신은 수합 중이고 이 화면이 보일 때만 동작합니다.
            </p>
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-[#F8FAFC] text-xs text-[#526174]">
                <tr>
                  <th className="p-3">ZIP 선택</th>
                  <th className="p-3">번호</th>
                  <th className="p-3">제출 대상</th>
                  <th className="p-3">현재 상태</th>
                  <th className="p-3">최근 회신</th>
                  <th className="p-3">파일 · 이력</th>
                </tr>
              </thead>
              <tbody>
                {data.targets.map((t) => (
                  <tr key={t.id} className="border-t border-[#EEF1F4]">
                    <td className="p-3">
                      {t.submission?.hasFile ? (
                        <input
                          type="checkbox"
                          aria-label={t.rowNumber + "번 파일 ZIP 선택"}
                          checked={selected.has(t.id)}
                          onChange={(e) =>
                            setSelected((old) => {
                              const next = new Map(old);
                              if (e.target.checked) next.set(t.id, t);
                              else next.delete(t.id);
                              return next;
                            })
                          }
                        />
                      ) : null}
                    </td>
                    <td className="p-3 text-[#526174]">{t.rowNumber}</td>
                    <td className="max-w-[260px] break-words p-3 font-bold">
                      {t.label}
                      {t.owner ? (
                        <p className="mt-1 text-xs font-normal text-[#526174]">
                          {t.owner}
                        </p>
                      ) : null}
                    </td>
                    <td className="p-3">
                      <span
                        className={
                          t.needsRepair
                            ? "font-bold text-[#B42318]"
                            : t.submission
                              ? t.submission.decision === "corrected"
                                ? "font-bold text-[#8A5A00]"
                                : "font-bold text-[#126B32]"
                              : "text-[#526174]"
                        }
                      >
                        {t.needsRepair
                          ? "현황 확인 필요"
                          : collectionDecisionLabel(
                              t.submission?.decision,
                              c.hasTemplate,
                            )}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-[#526174]">
                      {t.submission
                        ? new Date(t.submission.uploadedAt).toLocaleString(
                            "ko-KR",
                          ) +
                          " · " +
                          t.submission.revision +
                          "차"
                        : "-"}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        {t.submission?.hasFile ? (
                          <button
                            className={button}
                            onClick={() => void download(t.submission!.id)}
                          >
                            제출 파일 받기
                          </button>
                        ) : null}
                        {t.submission || t.needsRepair ? (
                          <button
                            className={button}
                            onClick={() => showHistory(t)}
                          >
                            {t.submission?.hasNote
                              ? "전달 사항 있음 · 이력"
                              : "제출 이력"}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {!data.targets.length ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-[#526174]">
                      {unsubmitted
                        ? "아직 회신하지 않은 대상이 없습니다."
                        : "아직 제출 대상이 없습니다."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="md:hidden">
            {data.targets.map((t) => (
              <article key={t.id} className="border-t border-[#DCE3EA] p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="min-w-0 break-words font-bold">
                    {t.rowNumber}. {t.label}
                  </h3>
                  <span
                    className={
                      t.needsRepair
                        ? "shrink-0 font-bold text-[#B42318]"
                        : t.submission?.decision === "corrected"
                          ? "shrink-0 font-bold text-[#8A5A00]"
                          : t.submission
                            ? "shrink-0 font-bold text-[#126B32]"
                            : "shrink-0 text-[#526174]"
                    }
                  >
                    {t.needsRepair
                      ? "현황 확인 필요"
                      : collectionDecisionLabel(
                          t.submission?.decision,
                          c.hasTemplate,
                        )}
                  </span>
                </div>
                {t.owner ? (
                  <p className="mt-1 text-sm text-[#526174]">{t.owner}</p>
                ) : null}
                {t.submission ? (
                  <p className="mt-2 text-xs text-[#526174]">
                    {new Date(t.submission.uploadedAt).toLocaleString("ko-KR")}{" "}
                    · {t.submission.revision}차
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {t.submission?.hasFile ? (
                    <>
                      <label className="inline-flex min-h-[44px] items-center gap-2 px-2 text-sm">
                        <input
                          type="checkbox"
                          aria-label={t.rowNumber + "번 파일 ZIP 선택"}
                          checked={selected.has(t.id)}
                          onChange={(e) =>
                            setSelected((old) => {
                              const next = new Map(old);
                              if (e.target.checked) next.set(t.id, t);
                              else next.delete(t.id);
                              return next;
                            })
                          }
                        />
                        ZIP 선택
                      </label>
                      <button
                        className={button}
                        onClick={() => void download(t.submission!.id)}
                      >
                        제출 파일 받기
                      </button>
                    </>
                  ) : null}
                  {t.submission || t.needsRepair ? (
                    <button className={button} onClick={() => showHistory(t)}>
                      {t.submission?.hasNote
                        ? "전달 사항 있음 · 이력"
                        : "제출 이력"}
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
            {!data.targets.length ? (
              <p className="p-6 text-sm text-[#526174]">
                {unsubmitted
                  ? "아직 회신하지 않은 대상이 없습니다."
                  : "아직 제출 대상이 없습니다."}
              </p>
            ) : null}
          </div>
          <div className="flex items-center justify-between p-4">
            <button
              className={button}
              disabled={!back.length || loading}
              onClick={() => {
                setAfter(back.at(-1) ?? 0);
                setBack((b) => b.slice(0, -1));
              }}
            >
              이전 50명
            </button>
            <span className="text-sm">{back.length + 1}페이지</span>
            <button
              className={button}
              disabled={data.nextAfter === null || loading}
              onClick={() => {
                setBack((b) => [...b, after]);
                setAfter(data.nextAfter!);
              }}
            >
              다음 50명
            </button>
          </div>
        </section>
        <section className="rounded-lg border border-[#DCE3EA] bg-white p-5">
          <h2 className="font-bold">현재 현황 내보내기</h2>
          <p className="mt-2 text-sm text-[#526174]">
            전체 명단의 현재 상태와 전달 사항을 내보냅니다. 현황을 새로고침하면
            출력 자료도 갱신됩니다.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className={button}
              disabled={busy}
              onClick={() => void exportRows("excel")}
            >
              Excel 저장
            </button>
            <button
              className={button}
              disabled={busy}
              onClick={() => void exportRows("print")}
            >
              A4 인쇄 · PDF
            </button>
          </div>
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-bold">
              실패한 임시 업로드 정리
            </summary>
            <p className="mt-2 text-sm text-[#526174]">
              2시간 지난 미완료 업로드와 삭제 실패 기록을 한 번에 최대 50개
              정리합니다.
            </p>
            <button
              className={button + " mt-3"}
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void cleanupDataCollectionUploads(owner, id)
                  .then((r) =>
                    setCleanupResult(
                      "정리 " +
                        r.removed +
                        "개 · 실패 " +
                        r.failed +
                        "개" +
                        (r.failed ? " · 다시 시도해 주세요." : ""),
                    ),
                  )
                  .catch((e) => setError(message(e)))
                  .finally(() => setBusy(false));
              }}
            >
              임시 업로드 정리
            </button>
            {cleanupResult ? (
              <p role="status" className="mt-2 text-sm">
                {cleanupResult}
              </p>
            ) : null}
          </details>
          <p className="mt-4 text-sm font-semibold">
            ZIP 선택 {selected.size}개 ·{" "}
            {(selectedBytes / 1024 / 1024).toFixed(2)}MiB / 100MiB
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              className={button}
              disabled={busy}
              onClick={() =>
                setSelected(
                  new Map(
                    data.targets
                      .filter((t) => t.submission?.hasFile)
                      .map((t) => [t.id, t]),
                  ),
                )
              }
            >
              이 페이지 파일 선택
            </button>
            <button
              className={button}
              disabled={busy || !selected.size}
              onClick={() => void exportZip()}
            >
              선택 파일 ZIP 저장
            </button>
            {zipAbort.current ? (
              <button
                className={button}
                onClick={() => zipAbort.current?.abort()}
              >
                다운로드 취소
              </button>
            ) : null}
          </div>
          {zipProgress ? (
            <p role="status" className="mt-3 text-sm">
              {zipProgress}
            </p>
          ) : null}
        </section>
      </div>
      <dialog
        ref={dialogRef}
        aria-labelledby="data-history-title"
        onClose={() => setHistoryTarget(undefined)}
        className="max-h-[80vh] w-[min(92vw,640px)] overflow-y-auto rounded-xl border border-[#DCE3EA] p-5 backdrop:bg-black/40"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="data-history-title" className="text-lg font-bold">
            {historyTarget?.label} · 제출 이력
          </h2>
          <button className={button} onClick={() => dialogRef.current?.close()}>
            닫기
          </button>
        </div>
        {historyLoading ? (
          <p role="status" className="mt-4">
            이력을 불러오는 중입니다.
          </p>
        ) : null}
        {historyError ? (
          <div className="mt-4">
            <p role="alert">{historyError}</p>
            <button
              className={button}
              onClick={() => historyTarget && void loadHistory(historyTarget)}
            >
              다시 불러오기
            </button>
          </div>
        ) : null}
        {!historyLoading && !historyError && !history.length ? (
          <p className="mt-4">
            저장된 이력이 없습니다. 기존 현황을 확인해 주세요.
          </p>
        ) : null}
        {history.map((h) => (
          <article key={h.id} className="mt-4 border-t border-[#DCE3EA] pt-4">
            <h3 className="font-bold">
              {h.revision}차 ·{" "}
              {collectionDecisionLabel(h.decision, c.hasTemplate)}
            </h3>
            <p className="mt-1 text-xs text-[#526174]">
              {new Date(h.uploadedAt).toLocaleString("ko-KR")}
            </p>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm">
              {h.note || "전달 사항 없음"}
            </p>
            {h.hasFile ? (
              <button
                className={button + " mt-3 max-w-full break-all"}
                onClick={() => void download(h.id)}
              >
                {h.fileName}
              </button>
            ) : null}
          </article>
        ))}
        {nextRevision !== null ? (
          <button
            className={button + " mt-4"}
            disabled={historyLoading}
            onClick={() =>
              historyTarget && void loadHistory(historyTarget, nextRevision)
            }
          >
            이전 10건 더 보기
          </button>
        ) : null}
      </dialog>
      {exportData
        ? createPortal(
            <section className="data-collect-print-root hidden print:block">
              <style media="print">
                {
                  "@page { size: A4 portrait; margin: 12mm; } @page :first { margin: 12mm; } @page :left { margin: 12mm; } @page :right { margin: 12mm; }"
                }
              </style>
              <h1>{exportData.title}</h1>
              <p>
                현재 현황 ·{" "}
                {new Date(exportData.exportedAt).toLocaleString("ko-KR")} · 전체{" "}
                {exportData.rows.length}명
              </p>
              <table>
                <thead>
                  <tr>
                    <th>번호</th>
                    <th>제출 대상 · 구분</th>
                    <th>상태 · 버전</th>
                    <th>파일명 · 전달 사항</th>
                  </tr>
                </thead>
                <tbody>
                  {exportData.rows.map((t) => (
                    <tr key={t.id}>
                      <td>{t.rowNumber}</td>
                      <td>
                        {t.label}
                        <br />
                        {t.owner}
                      </td>
                      <td>
                        {t.needsRepair
                          ? "현황 확인 필요"
                          : collectionDecisionLabel(
                              t.submission?.decision,
                              exportData.hasTemplate,
                            )}
                        {t.submission ? (
                          <>
                            <br />
                            {t.submission.revision}차<br />
                            {new Date(t.submission.uploadedAt).toLocaleString(
                              "ko-KR",
                            )}
                          </>
                        ) : null}
                      </td>
                      <td>
                        {t.fileName || "-"}
                        <br />
                        {t.note && t.note.length > 240
                          ? t.note.slice(0, 120) +
                            "… (" +
                            t.rowNumber +
                            "번 전달 사항 별지)"
                          : t.note || "전달 사항 없음"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {exportData.rows.some((t) => (t.note?.length ?? 0) > 240) ? (
                <section className="data-collect-print-notes">
                  <h2>긴 전달 사항 별지</h2>
                  {exportData.rows
                    .filter((t) => (t.note?.length ?? 0) > 240)
                    .map((t) => (
                      <article key={t.id}>
                        <h3>
                          {t.rowNumber}번 · {t.label} · {t.submission?.revision}
                          차
                        </h3>
                        <p>{t.note}</p>
                      </article>
                    ))}
                </section>
              ) : null}
              {!exportData.rows.length ? (
                <p>아직 제출 대상이 없습니다.</p>
              ) : null}
            </section>,
            document.body,
          )
        : null}
    </>
  );
}
