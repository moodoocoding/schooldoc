import { supabase } from '../../utils/supabaseClient';
import type { ConsentPublicDocument, ConsentPublicMetadata } from './types';

class ConsentPublicRequestError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ConsentPublicRequestError';
    this.status = status;
  }
}

const request = async <T>(body: Record<string, unknown>) => {
  if (!supabase) throw new Error('가정통신문 서버 연결 정보가 없습니다.');
  const { data, error } = await supabase.functions.invoke('consent-forms-public', { body });
  if (error) {
    const context = error.context instanceof Response ? error.context : undefined;
    if (context) {
      let message = error.message || '가정통신문 서버 요청에 실패했습니다.';
      try {
        const response = await context.clone().json() as { error?: string };
        if (response.error) message = response.error;
      } catch { /* HTML gateway responses use the fallback message. */ }
      throw new ConsentPublicRequestError(message, context.status);
    }
    throw new ConsentPublicRequestError('서버에 연결하지 못했습니다. 입력은 유지됩니다. 잠시 후 다시 제출해 주세요.');
  }
  return data as T;
};

const reading=new Map<string,Promise<unknown>>();
const invoke=async<T>(body:Record<string,unknown>):Promise<T>=>{
 if(body.action==='submit')return request<T>(body);
 const key=JSON.stringify(body);const old=reading.get(key);if(old)return old as Promise<T>;
 const pending=request<T>(body);reading.set(key,pending);
 try{return await pending;}finally{if(reading.get(key)===pending)reading.delete(key);}
};

export const openConsentPublicDocument = async(token:string,recipientToken='') => (await invoke<{form:ConsentPublicMetadata | ConsentPublicDocument}>({action:'open',token,recipientToken})).form;

export const getConsentPublicMetadata = async (token: string, recipientToken = '') => (
  await invoke<{ form: ConsentPublicMetadata }>({ action: 'metadata', token, recipientToken })
).form;

export const getConsentPublicDocument = async (token: string, password = '', recipientToken = '') => (
  await invoke<{ form: ConsentPublicDocument }>({ action: 'document', token, password, recipientToken })
).form;

export const submitConsentPublicResponse = async (
  token: string, password: string, values: Record<string, string>, recipientToken = '', options?: {requestId:string;documentRevision:number;expectedResponseId:string|null;reuseSignatureFields:string[]},
) => {
  await invoke({ action: 'submit', token, password, values, recipientToken, ...options });
};
