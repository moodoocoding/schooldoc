type Fetch = typeof globalThis.fetch;
type SessionSnapshot = { token: string; version: number };

/** 응답·토큰을 외부에 노출하지 않고 현재 세션의 서버 거절만 구독한다. */
export function createTeacherAuthRecovery(projectUrl: string, anonKey: string, fetchImpl: Fetch = (...args) => globalThis.fetch(...args)) {
  let project: URL | null = null;
  try { project = new URL(projectUrl); } catch { /* 미설정 환경에서는 관찰하지 않는다. */ }
  let token: string | null = null;
  let version = 0;
  let rejected = false;
  let checkingVersion: number | null = null;
  const listeners = new Set<() => void>();
  const isCurrent = (session: SessionSnapshot) => token === session.token && version === session.version;

  const verify = async (session: SessionSnapshot) => {
    if (!project || !isCurrent(session) || rejected || checkingVersion === session.version) return;
    checkingVersion = session.version;
    try {
      // SDK의 getUser는 세션을 제거할 수 있다. 여기서는 확인만 하고 늦은 응답을 버린다.
      const response = await fetchImpl(new URL("auth/v1/user", project.href.replace(/\/?$/, "/")), {
        headers: { apikey: anonKey, Authorization: `Bearer ${session.token}` },
      });
      if (isCurrent(session) && (response.status === 401 || response.status === 403)) {
        rejected = true;
        listeners.forEach(listener => listener());
      }
    } catch { /* 연결 실패만으로 로그인 상태를 해제하지 않는다. */ }
    finally { if (checkingVersion === session.version) checkingVersion = null; }
  };

  return {
    trackSession(accessToken: string | null) {
      if (token !== accessToken) { token = accessToken; version++; rejected = false; }
      return !rejected;
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    fetch: (async (input, init) => {
      const session = token ? { token, version } : null;
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      const requestUrl = new URL(input instanceof Request ? input.url : String(input));
      const authenticatedRequest = Boolean(project && session
        && requestUrl.origin === project.origin
        && /^\/(functions|rest|storage)\/v1\//.test(requestUrl.pathname)
        && headers.get("Authorization") === `Bearer ${session?.token}`);
      const response = await fetchImpl(input, init);
      if (authenticatedRequest && session && response.status === 401) void verify(session);
      return response;
    }) as Fetch,
  };
}

export const teacherAuthRecovery = createTeacherAuthRecovery(
  import.meta.env.VITE_SUPABASE_URL || "",
  import.meta.env.VITE_SUPABASE_ANON_KEY || "",
);
