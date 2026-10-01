import { useCallback, useEffect, useRef, useState } from 'react';
import { getRegistry, listRegistrySummaries, subscribeRegistries } from './registryService';
import { getRegistryByToken, subscribeRegistries as subscribeLocalRegistries } from './registryStore';
import type { Registry, RegistrySummary } from './types';

interface RegistryData<T> {
  data: T;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
}

const getErrorMessage = (error: unknown) => (
  error instanceof Error ? error.message : '등록부 데이터를 불러오지 못했습니다.'
);

const EMPTY_SUMMARIES: RegistrySummary[] = [];

function useRegistryResource<T>(empty: T, load: () => Promise<T>, registryId?: string): RegistryData<T> {
  const [data, setData] = useState<T>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestVersion = useRef(0);
  const activeRequest = useRef<{ load: () => Promise<T>; again: boolean; promise: Promise<void> } | null>(null);

  const refresh = useCallback(() => {
    if (activeRequest.current?.load === load) {
      activeRequest.current.again = true;
      return activeRequest.current.promise;
    }
    const version = ++requestVersion.current;
    const request = { load, again: false, promise: Promise.resolve() };
    activeRequest.current = request;
    request.promise = (async () => {
      do {
        request.again = false;
        try {
          const loaded = await load();
          if (version === requestVersion.current) { setData(loaded); setError(''); }
        } catch (loadError) {
          if (version === requestVersion.current) setError(getErrorMessage(loadError));
        } finally {
          if (version === requestVersion.current) setLoading(false);
        }
        // 느린 요청 중 도착한 여러 이벤트는 완료 후 한 번만 다시 읽는다.
      } while (request.again && version === requestVersion.current);
    })().finally(() => { if (activeRequest.current === request) activeRequest.current = null; });
    return request.promise;
  }, [load]);

  useEffect(() => {
    setData(empty); setLoading(true); setError('');
    void refresh();
    const requests = requestVersion;
    const stop = subscribeRegistries(() => void refresh(), registryId);
    return () => { requests.current++; activeRequest.current = null; stop(); };
  }, [empty, refresh, registryId]);
  return { data, loading, error, refresh };
}

export const useRegistries = () => useRegistryResource(EMPTY_SUMMARIES, listRegistrySummaries);

export const useRegistry = (id: string | undefined) => {
  const load = useCallback(() => id ? getRegistry(id) : Promise.resolve(null), [id]);
  return useRegistryResource<Registry | null>(null, load, id);
};

export const useRegistryByToken = (token: string | undefined) => {
  const [registry, setRegistry] = useState(() => (token ? getRegistryByToken(token) : null));

  useEffect(() => {
    setRegistry(token ? getRegistryByToken(token) : null);
    return subscribeLocalRegistries(() => setRegistry(token ? getRegistryByToken(token) : null));
  }, [token]);

  return registry;
};
