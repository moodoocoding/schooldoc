import { useEffect, useState, type ReactNode } from 'react';
import { LogIn, LogOut, ShieldCheck } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../../utils/supabaseClient';
import { isRegistryDemoMode } from './registryConfig';

const displayName = (user: User) => (
  user.user_metadata.full_name
  ?? user.user_metadata.name
  ?? user.email
  ?? '교사 계정'
);

export function RegistryAuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!isRegistryDemoMode);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isRegistryDemoMode || !supabase) {
      setLoading(false);
      return;
    }

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError) setError('로그인 상태를 확인하지 못했습니다.');
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (isRegistryDemoMode) return children;

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl border-y border-[#DCE3EA] bg-white px-6 py-16 text-center">
        <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-[#B9D9F2] border-t-[#0F6CBD]" />
        <p className="mt-4 text-sm font-semibold text-[#526174]">로그인 상태를 확인하고 있습니다.</p>
      </div>
    );
  }

  if (!isSupabaseConfigured || !supabase) {
    return (
      <div className="mx-auto max-w-3xl border-y border-[#DCE3EA] bg-white px-6 py-14 text-center">
        <ShieldCheck className="mx-auto h-8 w-8 text-[#94A3B8]" />
        <h1 className="mt-4 text-xl font-extrabold text-[#0F172A]">서버 연결 정보를 확인해 주세요</h1>
        <p className="mt-2 text-sm text-[#526174]">관리자에게 Supabase 환경 설정을 요청해 주세요.</p>
      </div>
    );
  }

  const authClient = supabase;

  if (!user) {
    const handleGoogleLogin = async () => {
      setError('');
      const { error: loginError } = await authClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/tools/registry-sign`,
          queryParams: { prompt: 'select_account' },
        },
      });
      if (loginError) setError('Google 로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    };

    return (
      <div className="mx-auto grid min-h-[620px] max-w-5xl place-items-center py-10">
        <section className="w-full max-w-md border-y border-[#DCE3EA] bg-white px-6 py-10 sm:px-8">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#EFF6FC] text-[#0F6CBD]">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <p className="mt-6 text-xs font-bold text-[#0F6CBD]">교직원 전용</p>
          <h1 className="mt-2 text-2xl font-extrabold text-[#0F172A]">등록부 서명 관리</h1>
          <p className="mt-3 text-sm leading-6 text-[#526174]">Google 계정으로 로그인해 등록부를 만들고 서명 현황을 관리하세요.</p>
          <button
            type="button"
            onClick={() => void handleGoogleLogin()}
            className="mt-7 inline-flex min-h-[48px] w-full items-center justify-center gap-3 rounded-lg border border-[#C8D0DA] bg-white px-5 text-sm font-bold text-[#0F172A] hover:bg-[#F6F8FB]"
          >
            <LogIn className="h-5 w-5 text-[#0F6CBD]" />
            Google로 로그인
          </button>
          {error ? <p role="alert" className="mt-4 text-sm font-semibold text-[#B42318]">{error}</p> : null}
        </section>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto mb-5 flex w-full max-w-7xl items-center justify-end gap-3 border-b border-[#DCE3EA] pb-3">
        <span className="min-w-0 truncate text-xs font-semibold text-[#526174]">{displayName(user)}</span>
        <button
          type="button"
          onClick={() => void authClient.auth.signOut()}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#526174] hover:bg-white hover:text-[#0F6CBD]"
          aria-label="로그아웃"
          title="로그아웃"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
      {children}
    </>
  );
}
