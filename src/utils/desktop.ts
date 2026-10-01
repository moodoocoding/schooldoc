export interface DesktopInfo {
  version: string;
  commit: string;
  dirty: boolean;
  supabaseUrl: string;
  publicAppUrl: string;
}

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      getInfo: () => Promise<DesktopInfo>;
      prepareGoogleOAuth: () => Promise<{ id: string; redirectUrl: string }>;
      completeGoogleOAuth: (id: string, url: string) => Promise<string>;
      cancelGoogleOAuth: (id: string) => Promise<void>;
    };
  }
}

export const isDesktop = () => typeof window !== 'undefined' && window.electronAPI?.isElectron === true;

/** HashRouter의 경로/검색값을 DOM 주소와 비교할 때도 보존한다. */
export function appRoute(url: URL) {
  return url.protocol === 'schooldoc:' && url.hash.startsWith('#/')
    ? new URL(url.hash.slice(1), 'https://app.invalid')
    : url;
}
