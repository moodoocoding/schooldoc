import { supabase } from '../../utils/supabaseClient';
import type { ConsentRecipientRecord } from './types';

/**
 * 명단은 평문으로 오가면 안 되므로 전용 Edge Function을 통해서만 다룬다.
 * 아직 배포·설정이 안 된 환경에서도 공용 링크 수합은 그대로 쓸 수 있어야 하므로,
 * 명단 기능이 준비되지 않은 경우는 오류가 아니라 '사용 불가'로 구분해 돌려준다.
 */
export class ConsentRecipientsUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConsentRecipientsUnavailableError';
  }
}

const invoke = async <T>(body: Record<string, unknown>): Promise<T> => {
  if (!supabase) throw new ConsentRecipientsUnavailableError('가정통신문 서버 연결 정보가 없습니다.');
  const { data, error } = await supabase.functions.invoke('consent-forms-admin', { body });
  if (error) {
    const context = error.context as Response | undefined;
    let message = error.message || '수신자 명단 요청에 실패했습니다.';
    if (context) {
      try {
        const parsed = await context.clone().json() as { error?: string };
        if (parsed.error) message = parsed.error;
      } catch { /* 게이트웨이가 HTML을 돌려주면 기본 문구를 쓴다. */ }
      // 함수가 없거나(404) 키가 없으면(503) 명단 기능만 접어 두고 나머지는 계속 쓴다.
      if (context.status === 404 || context.status === 503) throw new ConsentRecipientsUnavailableError(message);
    } else {
      throw new ConsentRecipientsUnavailableError(message);
    }
    throw new Error(message);
  }
  return data as T;
};

export const replaceConsentRecipients = async (
  formId: string,
  recipients: Array<{ name: string; studentKey: string }>,
) => (await invoke<{ saved: number }>({ action: 'replace', formId, recipients })).saved;

export const listConsentRecipients = async (formId: string) => (
  await invoke<{ recipients: ConsentRecipientRecord[] }>({ action: 'list', formId })
).recipients;

export const isRecipientsUnavailable = (error: unknown) => error instanceof ConsentRecipientsUnavailableError;
