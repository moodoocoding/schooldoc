import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, Upload } from "lucide-react";
import { useParams, useSearchParams } from "react-router-dom";
import { isDataCollectDemoMode } from "./dataCollectConfig";
import {
  getDataCollectionByToken,
  submitDataCollectionReview,
  subscribeDataCollections,
} from "./dataCollectStore";
import {
  DataCollectPublicRequestError,
  getRemoteDataCollectMetadata,
  getRemoteDataCollectTemplate,
  resumeRemoteDataCollect,
  searchRemoteDataCollectTargets,
  submitRemoteDataCollectReview,
  type DataCollectPublicMetadata,
  type DataCollectPublicTarget,
} from "./dataCollectPublicApi";
import {
  collectionDecisionLabel,
  hashCollectionPassword,
  isCollectionOpen,
  maskTargetLabel,
  validateCollectionFile,
} from "./dataCollectUtils";
import { saveDataCollectBlob } from "./dataCollectExport";
import type { DataCollectionSubmission } from "./types";

type Decision = DataCollectionSubmission["decision"];
const button =
  "min-h-[48px] rounded-lg border border-[#C8D0DA] px-4 text-sm font-bold disabled:opacity-50";
const errorMessage = (e: unknown) =>
  e instanceof Error
    ? e.message
    : "요청을 처리하지 못했습니다. 다시 시도해 주세요.";
function PublicShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#F6F8FB] px-4 py-8 text-[#0F172A]">
      <section className="mx-auto max-w-xl rounded-xl border border-[#DCE3EA] bg-white p-5 shadow-sm sm:p-8">
        {children}
      </section>
    </main>
  );
}
export function PublicDataCollectPage() {
  const { token = "" } = useParams();
  const [params] = useSearchParams();
  return (
    <PublicCollection
      key={token + ":" + (params.get("r") ?? "")}
      token={token}
      personalLink={params.get("r") ?? ""}
    />
  );
}
function PublicCollection({
  token,
  personalLink,
}: {
  token: string;
  personalLink: string;
}) {
  const [metadata, setMetadata] = useState<DataCollectPublicMetadata>();
  const [password, setPassword] = useState(""),
    [query, setQuery] = useState(""),
    [name, setName] = useState("");
  const [targets, setTargets] = useState<DataCollectPublicTarget[]>([]),
    [selected, setSelected] = useState<DataCollectPublicTarget>();
  const [receipt, setReceipt] = useState(
    () => sessionStorage.getItem("schooldoc_data_receipt:" + token) ?? "",
  );
  const [recovery, setRecovery] = useState(""),
    [searched, setSearched] = useState(false);
  const [latest, setLatest] = useState<{
    revision: number;
    decision: Decision;
  } | null>(null);
  const [decision, setDecision] = useState<Decision>(),
    [file, setFile] = useState<File>(),
    [note, setNote] = useState("");
  const [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [working, setWorking] = useState(false);
  const [complete, setComplete] = useState(false),
    [now, setNow] = useState(Date.now()),
    [copied, setCopied] = useState(false);
  const attempt = useRef<
    { payload: string; file?: File; id: string } | undefined
  >(undefined);
  const sessionKey = "schooldoc_data_receipt:" + token;
  const readMetadata = useCallback(
    async (entered?: string) => {
      if (!isDataCollectDemoMode)
        return getRemoteDataCollectMetadata(token, entered);
      const c = getDataCollectionByToken(token);
      if (!c) throw new Error("자료 수합을 찾을 수 없습니다.");
      const summary = {
        title: c.title,
        status: c.status,
        dueAt: c.dueAt,
        passwordRequired: Boolean(c.passwordHash),
      };
      if (c.passwordHash && entered === undefined)
        return {
          ...summary,
          accessGranted: false,
        } as DataCollectPublicMetadata;
      if (
        c.passwordHash &&
        (await hashCollectionPassword(entered ?? "")) !== c.passwordHash
      )
        throw new Error("비밀번호가 맞지 않습니다.");
      return {
        ...summary,
        accessGranted: true,
        description: c.description,
        kind: c.kind,
        mode: c.mode,
        allowResubmit: c.allowResubmit,
        hasTemplate: Boolean(c.sourceFile),
        template: c.sourceFile
          ? {
              name: c.sourceFile.originalName,
              size: c.sourceFile.byteSize,
              mimeType: c.sourceFile.mimeType,
              url: "",
            }
          : null,
      } as DataCollectPublicMetadata;
    },
    [token],
  );
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setMetadata(await readMetadata(password || undefined));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [readMetadata, password]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    void readMetadata()
      .then((v) => {
        if (active) setMetadata(v);
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [readMetadata]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 10000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!isDataCollectDemoMode) return;
    return subscribeDataCollections(() => {
      const c = getDataCollectionByToken(token);
      if (c)
        setMetadata((m) =>
          m ? { ...m, status: c.status, dueAt: c.dueAt } : m,
        );
    });
  }, [token]);
  const resume = useCallback(
    async (personal: string) => {
      if (!isDataCollectDemoMode)
        return resumeRemoteDataCollect(token, personal, password);
      const c = getDataCollectionByToken(token);
      const t = c?.targets.find((t) => t.personalToken === personal);
      if (!t) throw new Error("복구 코드에 해당하는 제출을 찾을 수 없습니다.");
      const s = c!.submissions.filter((s) => s.targetId === t.id).at(-1);
      return {
        target: {
          label: maskTargetLabel(t.label),
          owner: maskTargetLabel(t.owner),
        },
        submission: s ? { revision: s.revision, decision: s.decision } : null,
      };
    },
    [token, password],
  );
  const access = metadata?.accessGranted === true;
  const custom = access && metadata.mode === "custom";
  useEffect(() => {
    if (!access) return;
    const personal = personalLink || (custom ? receipt : "");
    if (!personal) return;
    let active = true;
    void resume(personal)
      .then((r) => {
        if (!active) return;
        setSelected({ token: personal, ...r.target });
        setLatest(r.submission);
        if (custom && r.submission) {
          setName(r.target.label);
          setDecision(r.submission.decision);
          setComplete(true);
        }
      })
      .catch((e) => {
        if (active && personalLink) setError(errorMessage(e));
      });
    return () => {
      active = false;
    };
  }, [access, custom, personalLink, receipt, resume]);
  const choose = async (t: DataCollectPublicTarget) => {
    setSelected(t);
    setLatest(null);
    setError("");
    try {
      setLatest((await resume(t.token)).submission);
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSearched(false);
    if (query.trim().length < 2) {
      setError("두 글자 이상 입력해 주세요.");
      return;
    }
    setWorking(true);
    try {
      const result = isDataCollectDemoMode
        ? (getDataCollectionByToken(token)
            ?.targets.filter((t) =>
              (t.label + " " + t.owner)
                .toLowerCase()
                .includes(query.trim().toLowerCase()),
            )
            .slice(0, 10)
            .map((t) => ({
              token: t.personalToken,
              label: maskTargetLabel(t.label),
              owner: maskTargetLabel(t.owner),
            })) ?? [])
        : await searchRemoteDataCollectTargets(token, query, password);
      setTargets(result);
      setSearched(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setWorking(false);
    }
  };
  const recover = async (e: React.FormEvent) => {
    e.preventDefault();
    setWorking(true);
    setError("");
    try {
      const r = await resume(recovery.trim());
      if (!r.submission) throw new Error("아직 제출된 회신이 없습니다.");
      setReceipt(recovery.trim());
      sessionStorage.setItem(sessionKey, recovery.trim());
      setSelected({ token: recovery.trim(), ...r.target });
      setLatest(r.submission);
      setName(r.target.label);
      setDecision(r.submission.decision);
      setComplete(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setWorking(false);
    }
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!metadata?.accessGranted) return;
    const effective = metadata.hasTemplate ? decision : "submitted";
    if (!selected && !custom) {
      setError("제출 대상을 선택해 주세요.");
      return;
    }
    if (custom && !name.trim()) {
      setError("제출자 이름을 입력해 주세요.");
      return;
    }
    if (!effective) {
      setError("회신 방법을 선택해 주세요.");
      return;
    }
    if (effective !== "confirmed" && !file) {
      setError(
        effective === "corrected"
          ? "수정한 파일을 선택해 주세요."
          : "제출할 파일을 선택해 주세요.",
      );
      return;
    }
    setWorking(true);
    setError("");
    try {
      if (file && effective !== "confirmed") await validateCollectionFile(file);
      const personal = selected?.token || receipt || crypto.randomUUID();
      if (custom) {
        setReceipt(personal);
        sessionStorage.setItem(sessionKey, personal);
      }
      const payload = JSON.stringify({ personal, effective, note, name });
      if (
        !attempt.current ||
        attempt.current.payload !== payload ||
        attempt.current.file !== file
      )
        attempt.current = { payload, file, id: crypto.randomUUID() };
      let result;
      if (isDataCollectDemoMode) {
        const c = getDataCollectionByToken(token)!;
        const target = c.targets.find((t) => t.personalToken === personal);
        result = await submitDataCollectionReview(
          c.id,
          target?.id ?? personal,
          effective,
          effective === "confirmed" ? undefined : file,
          note,
          name,
        );
      } else
        result = await submitRemoteDataCollectReview(
          token,
          personal,
          effective,
          password,
          effective === "confirmed" ? undefined : file,
          note,
          name,
          attempt.current.id,
        );
      setLatest({ revision: result.revision, decision: effective });
      setDecision(effective);
      setComplete(true);
      attempt.current = undefined;
    } catch (e) {
      if (
        e instanceof DataCollectPublicRequestError &&
        [400, 404, 409, 410, 422].includes(e.status)
      )
        attempt.current = undefined;
      setError(errorMessage(e));
    } finally {
      setWorking(false);
    }
  };
  const download = async () => {
    setWorking(true);
    setError("");
    try {
      const link = isDataCollectDemoMode
        ? (() => {
            const f = getDataCollectionByToken(token)?.sourceFile;
            if (!f) throw new Error("배포 파일이 없습니다.");
            return { url: f.dataUrl, name: f.originalName };
          })()
        : await getRemoteDataCollectTemplate(token, password);
      const response = await fetch(link.url);
      if (!response.ok)
        throw new Error("배포 파일을 받지 못했습니다. 다시 눌러 주세요.");
      saveDataCollectBlob(await response.blob(), link.name);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setWorking(false);
    }
  };
  const otherPerson = () => {
    sessionStorage.removeItem(sessionKey);
    setReceipt("");
    setSelected(undefined);
    setLatest(null);
    setComplete(false);
    setName("");
    setFile(undefined);
    setNote("");
    setDecision(undefined);
    attempt.current = undefined;
  };
  if (loading)
    return (
      <PublicShell>
        <p role="status">자료 수합을 불러오는 중입니다.</p>
      </PublicShell>
    );
  if (!metadata)
    return (
      <PublicShell>
        <h1 className="text-xl font-bold">자료 수합을 찾을 수 없습니다</h1>
        <p role="alert" className="mt-3 text-sm">
          {error}
        </p>
        <button className={button + " mt-4"} onClick={() => void load()}>
          다시 불러오기
        </button>
      </PublicShell>
    );
  if (!isCollectionOpen(metadata.status, metadata.dueAt, new Date(now)))
    return (
      <PublicShell>
        <h1 className="text-xl font-bold">자료 수합이 종료되었습니다</h1>
        <p className="mt-3 text-sm text-[#526174]">
          추가 제출이 필요하면 보낸 분에게 문의해 주세요.
        </p>
        <p className="mt-3 text-sm text-[#526174]">
          기한이 연장되었거나 수합을 다시 열었다면 상태를 확인해 주세요. 작성
          중인 파일과 메모는 유지됩니다.
        </p>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-[#B42318]">
            {error}
          </p>
        ) : null}
        <button className={button + " mt-4"} onClick={() => void load()}>
          상태 다시 확인
        </button>
      </PublicShell>
    );
  if (!metadata.accessGranted)
    return (
      <PublicShell>
        <h1 className="text-xl font-bold">{metadata.title}</h1>
        <form
          className="mt-6"
          onSubmit={(e) => {
            e.preventDefault();
            setWorking(true);
            setError("");
            void readMetadata(password)
              .then(setMetadata)
              .catch((e) => setError(errorMessage(e)))
              .finally(() => setWorking(false));
          }}
        >
          <label className="text-sm font-bold">
            공개 비밀번호
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 min-h-[48px] w-full rounded-lg border border-[#C8D0DA] px-3"
            />
          </label>
          {error ? (
            <p role="alert" className="mt-3 text-sm text-[#B42318]">
              {error}
            </p>
          ) : null}
          <button
            className={button + " mt-4 w-full bg-[#0F6CBD] text-white"}
            disabled={working}
          >
            확인
          </button>
        </form>
      </PublicShell>
    );
  if (complete)
    return (
      <PublicShell>
        <CheckCircle2 size={40} className="text-[#126B32]" />
        <h1 className="mt-4 text-xl font-bold">회신을 제출했습니다</h1>
        <p className="mt-3 text-sm">
          {selected?.label ?? name} ·{" "}
          {collectionDecisionLabel(decision, metadata.hasTemplate)} ·{" "}
          {latest?.revision}차
        </p>
        {custom ? (
          <div className="mt-5 rounded-lg bg-[#F1F5F9] p-4">
            <label className="text-sm font-bold">
              제출 복구 코드
              <input
                readOnly
                value={receipt}
                className="mt-2 min-h-[44px] w-full rounded-lg border border-[#C8D0DA] px-2 text-xs"
              />
            </label>
            <p className="mt-2 text-sm text-[#526174]">
              이 코드를 보관하면 다른 기기에서도 내 제출을 다시 찾을 수
              있습니다. 다른 사람에게 공유하지 마세요.
            </p>
            <button
              className={button + " mt-3"}
              onClick={() =>
                void navigator.clipboard
                  .writeText(receipt)
                  .then(() => setCopied(true))
                  .catch(() => setError("코드를 직접 복사해 주세요."))
              }
            >
              {copied ? "복사됨" : "복구 코드 복사"}
            </button>
          </div>
        ) : null}
        {metadata.allowResubmit ? (
          <button
            className={button + " mt-6 w-full border-[#0F6CBD] text-[#0F6CBD]"}
            onClick={() => {
              setComplete(false);
              setDecision(undefined);
              setFile(undefined);
              setNote("");
              setError("");
            }}
          >
            다시 회신하기
          </button>
        ) : (
          <p className="mt-5 text-sm">제출이 끝나 바꿀 수 없습니다.</p>
        )}
        {custom ? (
          <button className={button + " mt-3 w-full"} onClick={otherPerson}>
            다른 사람 제출
          </button>
        ) : null}
        {error ? (
          <p role="alert" className="mt-3">
            {error}
          </p>
        ) : null}
      </PublicShell>
    );
  return (
    <PublicShell>
      <p className="text-xs font-bold text-[#0F6CBD]">자료 확인 및 제출</p>
      <h1 className="mt-2 break-words text-2xl font-bold">{metadata.title}</h1>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#526174]">
        {metadata.description}
      </p>
      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#B42318]"
        >
          {error}
        </p>
      ) : null}
      {!selected && !custom ? (
        <section className="mt-7">
          <h2 className="font-bold">내 제출 대상 찾기</h2>
          <form onSubmit={search} className="mt-3 flex gap-2">
            <input
              aria-label="제출 대상 이름"
              placeholder="제출 대상 이름 2글자 이상"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearched(false);
                setTargets([]);
              }}
              className="min-h-[48px] min-w-0 flex-1 rounded-lg border border-[#C8D0DA] px-3"
            />
            <button
              className={button + " bg-[#0F6CBD] text-white"}
              disabled={working}
            >
              {working ? "찾는 중" : "찾기"}
            </button>
          </form>
          <div className="mt-3 space-y-2">
            {targets.map((t) => (
              <button
                key={t.token}
                className={
                  button + " flex w-full items-center justify-between text-left"
                }
                onClick={() => void choose(t)}
              >
                {t.label}
                <span className="text-sm font-normal text-[#526174]">
                  {t.owner}
                </span>
              </button>
            ))}
          </div>
          {searched && !targets.length ? (
            <p role="status" className="mt-3 text-sm text-[#526174]">
              일치하는 대상이 없습니다. 이름이나 담당자 정보를 확인해 주세요.
            </p>
          ) : null}
        </section>
      ) : (
        <form onSubmit={submit} className="mt-7 space-y-5">
          <div className="rounded-lg bg-[#F1F5F9] p-4">
            {custom ? (
              <label className="text-sm font-bold">
                제출자 이름
                <input
                  maxLength={120}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-2 min-h-[48px] w-full rounded-lg border border-[#C8D0DA] px-3"
                />
              </label>
            ) : (
              <p className="font-bold">
                {selected?.label} {selected?.owner}
              </p>
            )}
            {latest ? (
              <p className="mt-2 text-sm text-[#8A5A00]">
                이미 {latest.revision}차 회신이 있습니다.
                {metadata.allowResubmit
                  ? " 새 회신은 이전 기록을 남기고 추가됩니다."
                  : " 다시 제출할 수 없습니다."}
              </p>
            ) : null}
          </div>
          {metadata.template ? (
            <section>
              <h2 className="font-bold">1. 배포 파일 확인</h2>
              <button
                type="button"
                disabled={working}
                className={
                  button +
                  " mt-3 w-full break-all border-[#0F6CBD] text-left text-[#0F6CBD]"
                }
                onClick={() => void download()}
              >
                {metadata.template.name}
              </button>
              <h2 className="mt-6 font-bold">2. 확인 결과</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  aria-pressed={decision === "confirmed"}
                  onClick={() => {
                    setDecision("confirmed");
                    setFile(undefined);
                  }}
                  className={
                    button +
                    (decision === "confirmed"
                      ? " border-[#16803C] bg-[#E6F4EA] text-[#126B32]"
                      : "")
                  }
                >
                  이상 없음
                </button>
                <button
                  type="button"
                  aria-pressed={decision === "corrected"}
                  onClick={() => setDecision("corrected")}
                  className={
                    button +
                    (decision === "corrected"
                      ? " border-[#B7791F] bg-[#FFFBEB] text-[#8A5A00]"
                      : "")
                  }
                >
                  수정본 제출
                </button>
              </div>
            </section>
          ) : (
            <h2 className="font-bold">제출 파일</h2>
          )}
          {decision === "corrected" || !metadata.hasTemplate ? (
            <div>
              <p className="mb-2 text-sm text-[#526174]">
                HWP · HWPX · DOCX · XLSX · PDF · PNG · JPG / 최대 50MiB
              </p>
              <label className="flex min-h-[88px] cursor-pointer items-center justify-center gap-3 rounded-lg border border-dashed border-[#94A3B8] bg-[#F8FAFC] px-4 text-sm font-bold focus-within:outline focus-within:outline-[3px] focus-within:outline-[#0F6CBD]">
                <Upload size={20} className="shrink-0 text-[#0F6CBD]" />
                <span className="min-w-0 break-all">
                  {file?.name ?? "파일 선택"}
                </span>
                <input
                  aria-label="제출 파일 선택"
                  type="file"
                  className="sr-only"
                  accept=".hwp,.hwpx,.docx,.xlsx,.pdf,.png,.jpg,.jpeg"
                  onChange={(e) => setFile(e.target.files?.[0])}
                />
              </label>
            </div>
          ) : null}
          <label className="block text-sm font-bold">
            전달 사항 <span className="font-normal text-[#526174]">(선택)</span>
            <textarea
              maxLength={4000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-2 min-h-24 w-full rounded-lg border border-[#C8D0DA] p-3 font-normal"
            />
          </label>
          <button
            className={button + " w-full bg-[#0F6CBD] text-white"}
            disabled={working || (!metadata.allowResubmit && Boolean(latest))}
          >
            {working
              ? "제출하는 중"
              : latest
                ? "새 버전으로 회신"
                : "회신 제출"}
          </button>
          {!custom ? (
            <button
              type="button"
              className={button + " w-full"}
              onClick={() => {
                setSelected(undefined);
                setLatest(null);
                setFile(undefined);
                setDecision(undefined);
                setNote("");
                setError("");
              }}
            >
              다른 대상 선택
            </button>
          ) : null}
        </form>
      )}
      {custom && !latest ? (
        <details className="mt-6 border-t border-[#DCE3EA] pt-4">
          <summary className="cursor-pointer text-sm font-bold">
            이전에 제출한 자료 찾기
          </summary>
          <form onSubmit={recover} className="mt-3 space-y-3">
            <label className="text-sm">
              제출 복구 코드
              <input
                value={recovery}
                onChange={(e) => setRecovery(e.target.value)}
                className="mt-2 min-h-[48px] w-full rounded-lg border border-[#C8D0DA] px-3"
              />
            </label>
            <button className={button} disabled={working}>
              내 제출 찾기
            </button>
          </form>
        </details>
      ) : null}
    </PublicShell>
  );
}
