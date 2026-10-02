import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { teacherAuthRecovery } from './teacherAuthRecovery';
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

    let active = true;
    let revision = 0;
    const applySession = (session: { access_token?: string; user: User } | null) => {
      const accepted = teacherAuthRecovery.trackSession(session?.access_token ?? null);
      setUser(accepted ? session?.user ?? null : null);
      if (accepted && session?.user) setError('');
      setLoading(false);
    };
    const stopRecovery = teacherAuthRecovery.subscribe(() => {
      if (!active) return;
      revision++;
      setUser(null);
      setLoading(false);
      setError('로그인 연결이 만료되었습니다. Google로 다시 로그인해 주세요.');
    });
    const initialRevision = revision;
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active || revision !== initialRevision) return;
      applySession(data.session);
      if (sessionError) setError('로그인 상태를 확인하지 못했습니다.');
    }).catch(() => {
      if (!active || revision !== initialRevision) return;
      setError('로그인 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      revision++;
      applySession(session);
    });
    return () => { active = false; stopRecovery(); listener.subscription.unsubscribe(); };
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
