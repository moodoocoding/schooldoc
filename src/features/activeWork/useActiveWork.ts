import { useCallback, useEffect, useRef, useState } from 'react';
import { activeWorkProviders } from './activeWorkProviders';
import { loadActiveWork } from './activeWorkService';
import type { ActiveWorkSnapshot } from './types';

const EMPTY_SNAPSHOT: ActiveWorkSnapshot = { groups: [], failures: [] };

export const useActiveWork = (userId: string) => {
  const [snapshot, setSnapshot] = useState<ActiveWorkSnapshot>(EMPTY_SNAPSHOT);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoaded = useRef(false);
  const requestNumber = useRef(0);

  const refresh = useCallback(async () => {
    const currentRequest = requestNumber.current + 1;
    requestNumber.current = currentRequest;
    if (hasLoaded.current) setRefreshing(true);
    else setLoading(true);
    const next = await loadActiveWork({ userId, now: new Date() });
    if (requestNumber.current === currentRequest) {
      setSnapshot(next);
      setLoading(false);
      setRefreshing(false);
      hasLoaded.current = true;
    }
  }, [userId]);

  useEffect(() => {
    hasLoaded.current = false;
    void refresh();
    const stopSubscriptions = activeWorkProviders.map((provider) => provider.subscribe?.(() => void refresh()));
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      requestNumber.current += 1;
      stopSubscriptions.forEach((stop) => stop?.());
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [refresh]);

  return { ...snapshot, loading, refreshing, refresh };
};
