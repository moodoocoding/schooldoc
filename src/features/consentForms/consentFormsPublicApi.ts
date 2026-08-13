import { supabase } from '../../utils/supabaseClient';
import type { ConsentPublicDocument, ConsentPublicMetadata } from './types';

const invoke = async <T>(body: Record<string, unknown>) => {
  if (!supabase) throw new Error('가정통신문 서버 연결 정보가 없습니다.');
  const { data, error } = await supabase.functions.invoke('consent-forms-public', { body });
  if (error) {
    const context = error.context as Response | undefined;
    if (context) {
      try {
        const response = await context.clone().json() as { error?: string };
        if (response.error) throw new Error(response.error);
      } catch (contextError) {
        if (contextError instanceof Error && contextError.message !== 'Unexpected end of JSON input') throw contextError;
      }
    }
    throw new Error(error.message || '가정통신문 서버 요청에 실패했습니다.');
  }
  return data as T;
};

export const getConsentPublicMetadata = async (token: string) => (
  await invoke<{ form: ConsentPublicMetadata }>({ action: 'metadata', token })
).form;

export const getConsentPublicDocument = async (token: string, password = '') => (
  await invoke<{ form: ConsentPublicDocument }>({ action: 'document', token, password })
).form;

export const submitConsentPublicResponse = async (token: string, password: string, values: Record<string, string>) => {
  await invoke({ action: 'submit', token, password, values });
};
