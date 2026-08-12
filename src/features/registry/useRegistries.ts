import { useCallback, useEffect, useState } from 'react';
import { getRegistry, listRegistries, subscribeRegistries } from './registryService';
import { getRegistryByToken, subscribeRegistries as subscribeLocalRegistries } from './registryStore';
import type { Registry } from './types';

interface RegistryData<T> {
  data: T;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
}

const getErrorMessage = (error: unknown) => (
  error instanceof Error ? error.message : '등록부 데이터를 불러오지 못했습니다.'
);

export const useRegistries = (): RegistryData<Registry[]> => {
  const [data, setData] = useState<Registry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      setData(await listRegistries());
      setError('');
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    return subscribeRegistries(() => void refresh());
  }, [refresh]);

  return { data, loading, error, refresh };
};

export const useRegistry = (id: string | undefined): RegistryData<Registry | null> => {
  const [data, setData] = useState<Registry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!id) {
      setData(null);
      setLoading(false);
      return;
    }
    try {
      setData(await getRegistry(id));
      setError('');
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    void refresh();
    return subscribeRegistries(() => void refresh());
  }, [refresh]);

  return { data, loading, error, refresh };
};

export const useRegistryByToken = (token: string | undefined) => {
  const [registry, setRegistry] = useState(() => (token ? getRegistryByToken(token) : null));

  useEffect(() => {
    setRegistry(token ? getRegistryByToken(token) : null);
    return subscribeLocalRegistries(() => setRegistry(token ? getRegistryByToken(token) : null));
  }, [token]);

  return registry;
};
