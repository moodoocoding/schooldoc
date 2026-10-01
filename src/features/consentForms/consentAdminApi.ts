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

const requestConsentAdmin = async <T>(body: Record<string, unknown>): Promise<T> => {
  if (!supabase) throw new ConsentAdminUnavailableError('가정통신문 서버 연결 정보가 없습니다.');
  const { data, error } = await supabase.functions.invoke('consent-forms-admin', { body });
  if (error) {
    const context = error.context instanceof Response ? error.context : undefined;
    let message = error.message || '관리 요청에 실패했습니다.';
    if (context) {
      try {
        const parsed = await context.clone().json() as { error?: string };
        if (parsed.error) message = parsed.error;
      } catch { /* 게이트웨이가 HTML을 돌려주면 기본 문구를 쓴다. */ }
      // 연결 준비 오류도 호출자에게 전달한다. 생성 화면은 입력을 유지하고 재시도한다.
      if (context.status === 404 || context.status === 503) throw new ConsentAdminUnavailableError(message);
    } else {
      throw new ConsentAdminUnavailableError('서버에 연결하지 못했습니다. 입력은 유지됩니다. 연결을 확인하고 다시 시도해 주세요.');
    }
    throw new Error(message);
  }
  return data as T;
};

export const isConsentAdminUnavailable = (error: unknown) => error instanceof ConsentAdminUnavailableError;

// 같은 계정의 동시 읽기만 합친다. 저장·제출·파기는 매번 별도로 수행한다.
const reading=new Map<string,Promise<unknown>>();
supabase?.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')reading.clear();});
export const invokeConsentAdmin=async<T>(body:Record<string,unknown>):Promise<T>=>{
 if(!supabase)throw new ConsentAdminUnavailableError('가정통신문 서버 연결 정보가 없습니다.');
 if(!['bundle','get','forms','list','detail','history','headers','responses'].includes(String(body.action)))return requestConsentAdmin<T>(body);
 const session=await supabase.auth.getSession();const key=JSON.stringify([session.data.session?.user.id ?? '',body]);
 const old=reading.get(key);if(old)return old as Promise<T>;
 const pending=requestConsentAdmin<T>(body);reading.set(key,pending);
 try{return await pending;}finally{if(reading.get(key)===pending)reading.delete(key);}
};
