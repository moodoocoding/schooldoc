import { supabase } from '../../utils/supabaseClient';
import type { DataCollection, DataCollectionDraft } from './types';

export class DataCollectAdminUnavailableError extends Error {
  constructor(message: string) { super(message); this.name = 'DataCollectAdminUnavailableError'; }
}

const invoke = async <T>(body: Record<string, unknown>): Promise<T> => {
  if (!supabase) throw new DataCollectAdminUnavailableError('자료 수합 서버 연결 정보가 없습니다.');
  const { data, error } = await supabase.functions.invoke('data-collect-admin', { body });
  if (!error) return data as T;
  const context = error.context as Response | undefined;
  let message = error.message || '자료 수합 관리 요청에 실패했습니다.';
  if (context) {
    try { const parsed = await context.clone().json() as { error?: string }; if (parsed.error) message = parsed.error; } catch { /* 기본 문구를 유지한다. */ }
  }
  if (context?.status === 404 || context?.status === 503) throw new DataCollectAdminUnavailableError(message);
  throw new Error(message);
};

export const isDataCollectAdminUnavailable = (error: unknown) => error instanceof DataCollectAdminUnavailableError;

const uploadSigned = async (path: string, token: string, file: File, bucket: string) => {
  if (!supabase) throw new DataCollectAdminUnavailableError('자료 수합 서버 연결 정보가 없습니다.');
  const result = await supabase.storage.from(bucket).uploadToSignedUrl(path, token, file);
  if (result.error) throw new Error(`파일을 저장하지 못했습니다: ${result.error.message}`);
};

export const listRemoteDataCollections = async () => {
  const result = await invoke<{ collections: DataCollection[] }>({ action: 'list' });
  return result.collections;
};

export const getRemoteDataCollection = async (id: string) => {
  const result = await invoke<{ collection: DataCollection }>({ action: 'get', id });
  return result.collection;
};

export const createRemoteDataCollection = async (draft: DataCollectionDraft, sourceFile?: File) => {
  if (!supabase) throw new DataCollectAdminUnavailableError('자료 수합 서버 연결 정보가 없습니다.');
  const auth = await supabase.auth.getUser();
  if (auth.error || !auth.data.user) throw new Error('Google 로그인이 필요합니다.');
  const id = crypto.randomUUID();
  let templatePath = '';
  if (sourceFile) {
    templatePath = `${auth.data.user.id}/${id}/template/${crypto.randomUUID()}-${sourceFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const upload = await invoke<{ path: string; token: string }>({ action: 'create-upload-url', path: templatePath });
    await uploadSigned(upload.path, upload.token, sourceFile, 'data-collect-templates');
  }
  const result = await invoke<{ collection: DataCollection }>({ action: 'create', id, title: draft.title, description: draft.description, kind: draft.kind, mode: 'fixed', allowWalkIn: false, dueAt: draft.dueAt, password: draft.password, allowResubmit: draft.allowResubmit, retentionMonths: draft.retentionMonths, targets: draft.targets, templatePath, templateName: sourceFile?.name ?? '', templateSize: sourceFile?.size ?? 0, templateMime: sourceFile?.type ?? '' });
  return result.collection;
};

export const updateRemoteDataCollectionStatus = async (id: string, status: DataCollection['status']) => {
  const result = await invoke<{ collection: DataCollection }>({ action: 'status', id, status });
  return result.collection;
};

export const deleteRemoteDataCollection = async (id: string) => { await invoke({ action: 'delete', id }); };
