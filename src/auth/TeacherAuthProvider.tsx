import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../utils/supabaseClient';
import {
  TeacherAuthContext,
  teacherAuthRedirectUrl,
  teacherDisplayName,
  type TeacherAuthValue,
} from './teacherAuth';

export function TeacherAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supabase) {
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

  const value = useMemo<TeacherAuthValue>(() => ({
    user,
    loading,
    error,
    configured: isSupabaseConfigured,
    displayName: teacherDisplayName(user),
    signIn: async (redirectPath = window.location.pathname) => {
      setError('');
      if (!supabase) {
        setError('로그인 서버 연결 정보가 없습니다.');
        return;
      }
      if (window.electronAPI?.isElectron) {
        const desktop = window.electronAPI;
        let attemptId: string | undefined;
        try {
          const attempt = await desktop.prepareGoogleOAuth();
          attemptId = attempt.id;
          const { data, error: loginError } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: attempt.redirectUrl, skipBrowserRedirect: true,
              queryParams: { prompt: 'select_account' } },
          });
          if (loginError || !data.url) throw new Error('LOGIN_FAILED');
          const code = await desktop.completeGoogleOAuth(attempt.id, data.url);
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw new Error('LOGIN_FAILED');
        } catch {
          setError('Google 로그인을 완료하지 못했습니다. 브라우저와 인터넷 연결을 확인하고 다시 시도해 주세요.');
        } finally {
          if (attemptId) await desktop.cancelGoogleOAuth(attemptId).catch(() => {});
        }
        return;
      }
      const { error: loginError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: teacherAuthRedirectUrl(window.location.origin, redirectPath),
          queryParams: { prompt: 'select_account' },
        },
      });
      if (loginError) setError('Google 로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    },
    signOut: async () => {
      setError('');
      if (!supabase) return;
      const { error: logoutError } = await supabase.auth.signOut();
      if (logoutError) setError('로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    },
  }), [error, loading, user]);

  return <TeacherAuthContext.Provider value={value}>{children}</TeacherAuthContext.Provider>;
}
