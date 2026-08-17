import { supabase } from '../../utils/supabaseClient';

/**
 * 교사 전용 관리 함수(`consent-forms-admin`) 호출 통로.
 * 명단과 파기가 같은 함수를 쓰므로 오류 처리를 한곳에 둔다.
 */
export class ConsentAdminUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConsentAdminUnavailableError';
  }
}

export const invokeConsentAdmin = async <T>(body: Record<string, unknown>): Promise<T> => {
  if (!supabase) throw new ConsentAdminUnavailableError('가정통신문 서버 연결 정보가 없습니다.');
  const { data, error } = await supabase.functions.invoke('consent-forms-admin', { body });
  if (error) {
    const context = error.context as Response | undefined;
    let message = error.message || '관리 요청에 실패했습니다.';
    if (context) {
      try {
        const parsed = await context.clone().json() as { error?: string };
        if (parsed.error) message = parsed.error;
      } catch { /* 게이트웨이가 HTML을 돌려주면 기본 문구를 쓴다. */ }
      // 함수가 없거나(404) 키가 없으면(503) 해당 기능만 접어 두고 나머지는 계속 쓴다.
      if (context.status === 404 || context.status === 503) throw new ConsentAdminUnavailableError(message);
    } else {
      throw new ConsentAdminUnavailableError(message);
    }
    throw new Error(message);
  }
  return data as T;
};

export const isConsentAdminUnavailable = (error: unknown) => error instanceof ConsentAdminUnavailableError;
