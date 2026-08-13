import { useCallback, useEffect, useState } from 'react';
import { useTeacherAuth } from '../../auth/teacherAuth';
import { getStudentResultEvent, listStudentResultEvents, subscribeStudentResults } from './studentResultsService';
import { studentResultsOwnerId } from './studentResultsConfig';
import type { StudentResultEvent } from './types';

export function useStudentResultEvents() {
  const { user } = useTeacherAuth();
  const [data, setData] = useState<StudentResultEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const ownerId = studentResultsOwnerId(user?.id);
  const refresh = useCallback(async () => {
    if (!ownerId) { setData([]); setLoading(false); return; }
    setLoading(true);
    try { setData(await listStudentResultEvents(ownerId)); setError(''); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : '결과 안내를 불러오지 못했습니다.'); }
    finally { setLoading(false); }
  }, [ownerId]);
  useEffect(() => {
    void refresh();
    return subscribeStudentResults(() => void refresh());
  }, [refresh]);
  return { data, loading, error, refresh };
}

export function useStudentResultEvent(eventId?: string) {
  const { user } = useTeacherAuth();
  const [data, setData] = useState<StudentResultEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const ownerId = studentResultsOwnerId(user?.id);
  const refresh = useCallback(async () => {
    if (!ownerId || !eventId) { setData(null); setLoading(false); return; }
    setLoading(true);
    try { setData(await getStudentResultEvent(ownerId, eventId)); setError(''); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : '결과 안내를 불러오지 못했습니다.'); }
    finally { setLoading(false); }
  }, [eventId, ownerId]);
  useEffect(() => {
    void refresh();
    return subscribeStudentResults(() => void refresh());
  }, [refresh]);
  return { data, loading, error, refresh };
}
