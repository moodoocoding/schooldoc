import { validateCollectionFile } from './dataCollectUtils';
import { supabase } from '../../utils/supabaseClient';
import type { DataCollectionSubmission } from './types';

export class DataCollectPublicRequestError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'DataCollectPublicRequestError';
  }
}
const invoke = async <T>(body: Record<string, unknown>) => {
  if (!supabase) throw new Error('자료 수합 공개 서버 연결 정보가 없습니다.');
  const { data, error } = await supabase.functions.invoke(
    'data-collect-public',
    { body },
  );
  if (!error) return data as T;
  const context = error.context as Response | undefined;
  let message = error.message || '자료 수합 요청에 실패했습니다.';
  if (context) {
    try {
      const parsed = (await context.clone().json()) as { error?: string };
      if (parsed.error) message = parsed.error;
    } catch {
      /* 기본 문구를 유지한다. */
    }
  }
  throw new DataCollectPublicRequestError(message, context?.status ?? 500);
};
interface DataCollectPublicMetadataSummary {
  accessGranted: false;
  title: string;
  status: 'open' | 'closed';
  dueAt: string;
  passwordRequired: boolean;
}
export interface DataCollectPublicMetadataDetails {
  accessGranted: true;
  title: string;
  description: string;
  kind: string;
  mode: 'fixed' | 'custom';
  status: 'open' | 'closed';
  dueAt: string;
  passwordRequired: boolean;
  allowResubmit: boolean;
  hasTemplate: boolean;
  template: {
    name: string;
    size: number;
    mimeType: string;
    url: string;
  } | null;
}
export type DataCollectPublicMetadata =
  DataCollectPublicMetadataSummary | DataCollectPublicMetadataDetails;
export interface DataCollectPublicTarget {
  token: string;
  label: string;
  owner: string;
}

export const getRemoteDataCollectMetadata = async (
  token: string,
  password?: string,
) => {
  const body: Record<string, unknown> = {
    action: 'metadata',
    token,
    lazyDownload: true,
  };
  // undefined는 최초 공개 조회이고, 빈 문자열을 포함한 string은 사용자의 검증 시도다.
  if (password !== undefined) body.password = password;
  const result = await invoke<{ collection: DataCollectPublicMetadata }>(body);
  return result.collection;
};

export const searchRemoteDataCollectTargets = async (
  token: string,
  query: string,
  password: string,
  personalToken = '',
) => {
  const result = await invoke<{ targets: DataCollectPublicTarget[] }>({
    action: 'search',
    token,
    query,
    password,
    personalToken,
  });
  return result.targets;
};

export const getRemoteDataCollectTemplate = async (
  token: string,
  password: string,
) =>
  (
    await invoke<{ template: { url: string; name: string } }>({
      action: 'template-download',
      token,
      password,
    })
  ).template;
export const resumeRemoteDataCollect = (
  token: string,
  personalToken: string,
  password: string,
) =>
  invoke<{
    target: { label: string; owner: string };
    submission: {
      revision: number;
      decision: DataCollectionSubmission['decision'];
    } | null;
  }>({ action: 'resume', token, personalToken, password });
const uploadedRequests = new Map<
  string,
  { path: string; personalToken: string }
>();
export const submitRemoteDataCollectReview = async (
  token: string,
  targetToken: string,
  decision: DataCollectionSubmission['decision'],
  password: string,
  file?: File,
  note = '',
  respondentName = '',
  requestId: string = crypto.randomUUID(),
) => {
  let storagePath = '',
    personalToken = targetToken;
  if (file) {
    await validateCollectionFile(file);
    const key = token + ':' + requestId;
    const previous = uploadedRequests.get(key);
    if (previous) {
      storagePath = previous.path;
      personalToken = previous.personalToken;
    } else {
      const prepared = await invoke<{
        path: string;
        token: string;
        personalToken: string;
      }>({
        action: 'prepare-upload',
        token,
        personalToken: targetToken,
        password,
        respondentName,
        fileName: file.name,
        fileSize: file.size,
        requestId,
      });
      if (!supabase)
        throw new Error('자료 수합 공개 서버 연결 정보가 없습니다.');
      const result = await supabase.storage
        .from('data-collect-files')
        .uploadToSignedUrl(prepared.path, prepared.token, file);
      if (result.error)
        throw new Error('파일을 저장하지 못했습니다. 다시 시도해 주세요.');
      storagePath = prepared.path;
      personalToken = prepared.personalToken;
      uploadedRequests.set(key, { path: storagePath, personalToken });
      if (uploadedRequests.size > 20)
        uploadedRequests.delete(uploadedRequests.keys().next().value!);
    }
  }
  try {
    const result = await invoke<{
      submitted: boolean;
      revision: number;
      decision: DataCollectionSubmission['decision'];
      personalToken?: string;
    }>({
      action: 'submit',
      token,
      personalToken,
      password,
      respondentName,
      decision,
      storagePath,
      fileName: file?.name ?? '',
      note,
      requestId,
    });
    uploadedRequests.delete(token + ':' + requestId);
    return result;
  } catch (error) {
    if (
      error instanceof DataCollectPublicRequestError &&
      [400, 404, 409, 410, 422].includes(error.status)
    )
      uploadedRequests.delete(token + ':' + requestId);
    throw error;
  }
};
