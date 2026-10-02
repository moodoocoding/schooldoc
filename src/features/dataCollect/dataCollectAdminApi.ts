import { normalizeDataCollectDeadline } from "../../../supabase/functions/_shared/dataCollectDeadline";
import { validateCollectionFile } from "./dataCollectUtils";
import { supabase } from "../../utils/supabaseClient";
import type { DataCollection, DataCollectionDraft } from "./types";

export class DataCollectAdminUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataCollectAdminUnavailableError";
  }
}

const invoke = async <T>(body: Record<string, unknown>): Promise<T> => {
  if (!supabase)
    throw new DataCollectAdminUnavailableError(
      "자료 수합 서버 연결 정보가 없습니다.",
    );
  const { data, error } = await supabase.functions.invoke(
    "data-collect-admin",
    { body },
  );
  if (!error) return data as T;
  const context = error.context as Response | undefined;
  let message = error.message || "자료 수합 관리 요청에 실패했습니다.";
  if (context) {
    try {
      const parsed = (await context.clone().json()) as { error?: string };
      if (parsed.error) message = parsed.error;
    } catch {
      /* 기본 문구를 유지한다. */
    }
  }
  if (context?.status === 404 || context?.status === 503)
    throw new DataCollectAdminUnavailableError(message);
  throw new Error(message);
};

const uploadSigned = async (
  path: string,
  token: string,
  file: File,
  bucket: string,
) => {
  if (!supabase)
    throw new DataCollectAdminUnavailableError(
      "자료 수합 서버 연결 정보가 없습니다.",
    );
  const result = await supabase.storage
    .from(bucket)
    .uploadToSignedUrl(path, token, file);
  if (result.error)
    throw new Error(`파일을 저장하지 못했습니다: ${result.error.message}`);
};

export const listRemoteDataCollections = async () => {
  const result = await invoke<{ collections: DataCollection[] }>({
    action: "list",
  });
  return result.collections;
};

export const createRemoteDataCollection = async (
  draft: DataCollectionDraft,
  sourceFile?: File,
) => {
  if (!supabase)
    throw new DataCollectAdminUnavailableError(
      "자료 수합 서버 연결 정보가 없습니다.",
    );
  const dueAt = normalizeDataCollectDeadline(draft.dueAt);
  const auth = await supabase.auth.getUser();
  if (auth.error || !auth.data.user)
    throw new Error("Google 로그인이 필요합니다.");
  const id = crypto.randomUUID();
  let templatePath = "";
  if (sourceFile) {
    await validateCollectionFile(sourceFile, true);
    templatePath =
      auth.data.user.id +
      "/" +
      id +
      "/template/" +
      crypto.randomUUID() +
      "/file." +
      sourceFile.name.split(".").at(-1)!.toLowerCase();
    const upload = await invoke<{ path: string; token: string }>({
      action: "create-upload-url",
      path: templatePath,
    });
    await uploadSigned(
      upload.path,
      upload.token,
      sourceFile,
      "data-collect-templates",
    );
  }
  const result = await invoke<
    DataCollection | { collection: DataCollection } | { id: string }
  >({
    action: "create",
    responseMode: "id",
    id,
    title: draft.title,
    description: draft.description,
    kind: draft.kind,
    mode: draft.mode,
    allowWalkIn: draft.mode === "custom",
    dueAt,
    password: draft.password,
    allowResubmit: draft.allowResubmit,
    retentionMonths: draft.retentionMonths,
    targets: draft.mode === "fixed" ? draft.targets : [],
    templatePath,
    templateName: sourceFile?.name ?? "",
    templateSize: sourceFile?.size ?? 0,
    templateMime: sourceFile?.type ?? "",
  });
  // 운영 Edge Function은 생성 결과를 직접 반환하고, 로컬/기존 응답 경계는
  // `{ collection }`으로 감쌀 수 있다. 두 형식을 모두 받아 중복 생성을 피한다.
  return "collection" in result ? result.collection : result;
};

export const deleteRemoteDataCollection = async (id: string) => {
  await invoke({ action: "delete", id });
};

export const listRemoteDataCollectionSummaries = (
  cursor?: import("./types").DataCollectionListCursor,
) =>
  invoke<{
    collections: import("./types").DataCollectionSummary[];
    nextCursor: import("./types").DataCollectionListCursor | null;
  }>({ action: "summary", ...cursor });
export const getRemoteDataCollectionOverview = (
  id: string,
  after = 0,
  unsubmitted = false,
) =>
  invoke<import("./types").DataCollectionOverview>({
    action: "overview",
    id,
    after,
    unsubmitted,
  });
export const getRemoteDataCollectionHistory = (
  id: string,
  targetId: string,
  beforeRevision?: number,
) =>
  invoke<{
    submissions: import("./types").DataCollectionHistoryItem[];
    nextRevision: number | null;
  }>({ action: "history", id, targetId, beforeRevision });
export const getRemoteDataCollectionDownload = (id: string, fileId?: string) =>
  invoke<{ url: string; name: string }>({
    action: "download",
    id,
    fileId,
    source: !fileId,
  });
export const getRemoteDataCollectionExport = (id: string) =>
  invoke<import("./types").DataCollectionExport>({ action: "export", id });
export const updateRemoteDataCollectionDue = (id: string, dueAt: string) =>
  invoke<import("./types").DataCollectionOverview>({
    action: "due",
    id,
    dueAt: normalizeDataCollectDeadline(dueAt),
  });

export const setRemoteDataCollectionStatus = (
  id: string,
  status: "open" | "closed",
) =>
  invoke<import("./types").DataCollectionOverview>({
    action: "status-lite",
    id,
    status,
  });

export const cleanupRemoteDataCollectionUploads = (id: string) =>
  invoke<{ removed: number; failed: number }>({
    action: "cleanup-uploads",
    id,
  });

export const cleanupRemoteDataCollectTemplates = () =>
  invoke<{ removed: number; failed: number }>({ action: "cleanup-templates" });
