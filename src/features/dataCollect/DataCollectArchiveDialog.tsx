import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  deleteDataCollection,
  previewDataCollectionPurge,
  reopenDataCollection,
} from "./dataCollectService";
import type { DataCollectionPurgePreview } from "./types";

const field =
  "mt-1 block min-h-[44px] w-full rounded-lg border border-[#C8D0DA] bg-white px-3 text-sm";
const secondary =
  "min-h-[44px] rounded-lg border border-[#C8D0DA] bg-white px-4 text-sm font-bold disabled:opacity-50";
const describeError = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "요청을 처리하지 못했습니다. 다시 시도해 주세요.";

export function DataCollectArchiveDialog({
  action,
  owner,
  id,
  title,
  initialDue,
  onClose,
  onDone,
  onDeleteError,
}: {
  action: "reopen" | "delete";
  owner: string;
  id: string;
  title: string;
  initialDue: string;
  onClose: () => void;
  onDone: () => void;
  onDeleteError: () => void;
}) {
  const deleting = action === "delete";
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [due, setDue] = useState(initialDue);
  const [noDue, setNoDue] = useState(false);
  const [preview, setPreview] = useState<DataCollectionPurgePreview>();
  const [reviewRequest, setReviewRequest] = useState(0);
  const [loading, setLoading] = useState(deleting);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const dialog = ref.current;
    const focused = document.activeElement;
    dialog?.showModal();
    cancelRef.current?.focus();
    return () => {
      dialog?.close();
      if (focused instanceof HTMLElement && focused.isConnected)
        focused.focus();
    };
  }, []);
  useEffect(() => {
    if (!deleting) return;
    let active = true;
    void previewDataCollectionPurge(owner, id)
      .then((value) => {
        if (active) setPreview(value);
      })
      .catch((e: unknown) => {
        if (active) setError(describeError(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [deleting, owner, id, reviewRequest]);

  const waiting =
    preview && !preview.pending && Date.parse(preview.availableAt) > Date.now();
  const reviewAgain = () => {
    setPreview(undefined);
    setConfirmed(false);
    setLoading(true);
    setError("");
    setReviewRequest((value) => value + 1);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || (deleting && (!preview || !confirmed || waiting))) return;
    setBusy(true);
    setError("");
    try {
      if (deleting && preview) await deleteDataCollection(owner, id, preview);
      if (!deleting) {
        const time = new Date(due);
        if (
          !noDue &&
          (!Number.isFinite(time.getTime()) || time.getTime() <= Date.now())
        )
          throw new Error("마감 시각은 현재보다 뒤로 설정해 주세요.");
        await reopenDataCollection(
          owner,
          id,
          noDue ? null : time.toISOString(),
        );
      }
      onDone();
    } catch (e) {
      setError(describeError(e));
      if (deleting) {
        setPreview(undefined);
        setConfirmed(false);
        onDeleteError();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-xl border border-[#DCE3EA] bg-white p-5 text-[#0F172A] shadow-xl backdrop:bg-slate-900/45 sm:p-6"
    >
      <form className="space-y-4" onSubmit={(event) => void submit(event)}>
        <div>
          <h2 id={titleId} className="text-lg font-extrabold">
            {deleting ? "자료 수합 영구 삭제" : "자료 수합 다시 열기"}
          </h2>
          <p className="mt-2 break-words text-sm font-bold">{title}</p>
          <p
            id={descriptionId}
            className="mt-2 text-sm leading-6 text-[#526174]"
          >
            {deleting
              ? "제출 대상, 회신 이력, 배포·제출 파일을 지웁니다. 삭제한 내용은 복구할 수 없습니다."
              : "기존 공개 링크와 회신은 유지됩니다. 기한을 정하면 같은 링크에서 다시 제출할 수 있습니다."}
          </p>
        </div>
        {deleting ? (
          <>
            {loading ? (
              <p role="status" className="text-sm">
                삭제할 수량을 확인하고 있습니다.
              </p>
            ) : null}
            {preview ? (
              <>
                <dl className="space-y-1 rounded-lg bg-[#F1F5F9] p-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt>제출 대상</dt>
                    <dd>{preview.targetCount}명</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>회신 이력</dt>
                    <dd>{preview.responseCount}건</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>{preview.pending ? "남은 저장 파일" : "저장 파일"}</dt>
                    <dd>{preview.fileCount}개</dd>
                  </div>
                </dl>
                {preview.pending ? (
                  <p className="text-sm text-[#8A4B08]">
                    앞서 시작한 삭제입니다. 남은 파일을 지운 뒤 기록을
                    정리합니다.
                  </p>
                ) : null}
                {waiting ? (
                  <p className="text-sm leading-6 text-[#8A4B08]">
                    기존 업로드 링크가 만료된 뒤 삭제할 수 있습니다.{" "}
                    <strong>
                      {new Date(preview.availableAt).toLocaleString("ko-KR")}{" "}
                      이후
                    </strong>{" "}
                    수량을 다시 확인해 주세요.
                  </p>
                ) : (
                  <label className="flex min-h-[44px] items-center gap-3 text-sm leading-6">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      disabled={busy}
                      onChange={(event) => setConfirmed(event.target.checked)}
                      className="h-5 w-5 shrink-0 accent-[#B42318]"
                    />
                    대상과 수량을 확인했으며 영구 삭제에 동의합니다.
                  </label>
                )}
              </>
            ) : null}
            {!loading && (!preview || waiting) ? (
              <button type="button" onClick={reviewAgain} className={secondary}>
                수량 다시 확인
              </button>
            ) : null}
          </>
        ) : (
          <>
            <label className="block text-sm font-bold">
              다시 열 때 기한
              <select
                value={noDue ? "none" : "date"}
                disabled={busy}
                onChange={(event) => {
                  setNoDue(event.target.value === "none");
                  setError("");
                }}
                className={field}
              >
                <option value="date">마감 시각 지정</option>
                <option value="none">기한 없음</option>
              </select>
            </label>
            {!noDue ? (
              <label className="block text-sm font-bold">
                새 마감 시각
                <input
                  type="datetime-local"
                  value={due}
                  required
                  disabled={busy}
                  onChange={(event) => {
                    setDue(event.target.value);
                    setError("");
                  }}
                  className={field}
                />
              </label>
            ) : null}
          </>
        )}
        {error ? (
          <p
            role="alert"
            className="rounded-lg bg-[#FEF2F2] p-3 text-sm text-[#B42318]"
          >
            {error}
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            ref={cancelRef}
            disabled={busy}
            className={secondary}
            onClick={onClose}
          >
            취소
          </button>
          <button
            type="submit"
            disabled={
              busy || (deleting && (!preview || !confirmed || Boolean(waiting)))
            }
            className={
              "min-h-[44px] rounded-lg px-4 text-sm font-bold text-white disabled:opacity-50 " +
              (deleting ? "bg-[#B42318]" : "bg-[#0F6CBD]")
            }
          >
            {busy
              ? deleting
                ? "삭제 중"
                : "다시 여는 중"
              : deleting
                ? "영구 삭제"
                : "다시 열기"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
