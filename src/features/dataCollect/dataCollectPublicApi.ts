import { supabase } from '../../utils/supabaseClient';
import type { DataCollectionSubmission } from './types';

const invoke = async <T>(body: Record<string, unknown>) => {
  if (!supabase) throw new Error('자료 수합 공개 서버 연결 정보가 없습니다.');
  const { data, error } = await supabase.functions.invoke('data-collect-public', { body });
  if (!error) return data as T;
  const context = error.context as Response | undefined;
  let message = error.message || '자료 수합 요청에 실패했습니다.';
  if (context) { try { const parsed = await context.clone().json() as { error?: string }; if (parsed.error) message = parsed.error; } catch { /* 기본 문구를 유지한다. */ } }
  throw new Error(message);
};
interface DataCollectPublicMetadataSummary {
  accessGranted: false; title: string; status: 'open' | 'closed'; dueAt: string; passwordRequired: boolean;
}
export interface DataCollectPublicMetadataDetails {
  accessGranted: true; title: string; description: string; kind: string; mode: 'fixed' | 'custom'; status: 'open' | 'closed'; dueAt: string; passwordRequired: boolean; allowResubmit: boolean; hasTemplate: boolean; template: { name: string; size: number; mimeType: string; url: string } | null;
}
export type DataCollectPublicMetadata = DataCollectPublicMetadataSummary | DataCollectPublicMetadataDetails;
export interface DataCollectPublicTarget { token: string; label: string; owner: string; }

export const getRemoteDataCollectMetadata = async (token: string, password?: string) => {
  const body: Record<string, unknown> = { action: 'metadata', token };
  // undefined는 최초 공개 조회이고, 빈 문자열을 포함한 string은 사용자의 검증 시도다.
  if (password !== undefined) body.password = password;
  const result = await invoke<{ collection: DataCollectPublicMetadata }>(body);
  return result.collection;
};

export const searchRemoteDataCollectTargets = async (token: string, query: string, password: string, personalToken = '') => {
  const result = await invoke<{ targets: DataCollectPublicTarget[] }>({ action: 'search', token, query, password, personalToken });
  return result.targets;
};

export const submitRemoteDataCollectReview = async (token: string, targetToken: string, decision: DataCollectionSubmission['decision'], password: string, file?: File, note = '', respondentName = '') => {
  let storagePath = '';
  if (file) {
    const prepared = await invoke<{ path: string; token: string }>({ action: 'prepare-upload', token, personalToken: targetToken, password, respondentName, fileName: file.name });
    if (!supabase) throw new Error('자료 수합 공개 서버 연결 정보가 없습니다.');
    const upload = await supabase.storage.from('data-collect-files').uploadToSignedUrl(prepared.path, prepared.token, file);
    if (upload.error) throw new Error(`파일을 저장하지 못했습니다: ${upload.error.message}`);
    storagePath = prepared.path;
  }
  return invoke<{ submitted: boolean; revision: number; decision: DataCollectionSubmission['decision']; personalToken?: string }>({ action: 'submit', token, personalToken: targetToken, password, respondentName, decision, storagePath, fileName: file?.name ?? '', note });
};
