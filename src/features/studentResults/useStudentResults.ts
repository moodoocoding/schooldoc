import { useCallback, useEffect, useRef, useState } from 'react';
import { useTeacherAuth } from '../../auth/teacherAuth';
import { getStudentResultEvent, listStudentResultEvents, subscribeStudentResults } from './studentResultsService';
import { studentResultsOwnerId } from './studentResultsConfig';
import { beginLoad, endLoad } from './studentResultsLoadState';
import type { StudentResultEvent } from './types';

/**
 * 처음 불러오는 것과 이후 갱신을 구분한다.
 *
 * 학생이 결과를 열거나 확인·이의를 낼 때마다 Realtime이 갱신을 부른다. 예전에는 그때마다
 * loading이 참이 되어 교사가 보던 표가 사라졌다 돌아왔다. 조회가 몰리는 시간대에는 화면이
 * 계속 깜빡였고, 인쇄를 준비하던 중에도 페이지가 통째로 날아갔다.
 *
 * 갱신 중에는 이미 받아 둔 자료를 그대로 두고 refreshing으로만 알린다.
 */
const useRemoteResource = <T>(
  load: (() => Promise<T>) | null,
  empty: T,
  failureMessage: string,
) => {
  const [data, setData] = useState<T>(empty);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const hasLoaded = useRef(false);

  const refresh = useCallback(async () => {
    if (!load) {
      hasLoaded.current = false;
      setData(empty);
      setLoading(false);
      return;
    }
    const begun = beginLoad(hasLoaded.current);
    setLoading(begun.loading);
    setRefreshing(begun.refreshing);
    try {
      setData(await load());
      setError('');
      hasLoaded.current = true;
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : failureMessage);
    } finally {
      const ended = endLoad();
      setLoading(ended.loading);
      setRefreshing(ended.refreshing);
    }
    // load는 호출한 쪽에서 useCallback으로 고정한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  useEffect(() => {
    // 대상이 바뀌면 다시 처음 불러오는 것이다. 이전 자료를 보여준 채로 두면 안 된다.
    hasLoaded.current = false;
    void refresh();
    return subscribeStudentResults(() => void refresh());
  }, [refresh]);

  return { data, loading, refreshing, error, refresh };
};

export function useStudentResultEvents() {
  const { user } = useTeacherAuth();
  const ownerId = studentResultsOwnerId(user?.id);
  const load = useCallback(
    () => ownerId ? listStudentResultEvents(ownerId) : Promise.resolve([]),
    [ownerId],
  );
  return useRemoteResource<StudentResultEvent[]>(
    ownerId ? load : null,
    [],
    '결과 안내를 불러오지 못했습니다.',
  );
}

export function useStudentResultEvent(eventId?: string) {
  const { user } = useTeacherAuth();
  const ownerId = studentResultsOwnerId(user?.id);
  const load = useCallback(
    () => ownerId && eventId ? getStudentResultEvent(ownerId, eventId) : Promise.resolve(null),
    [eventId, ownerId],
  );
  return useRemoteResource<StudentResultEvent | null>(
    ownerId && eventId ? load : null,
    null,
    '결과 안내를 불러오지 못했습니다.',
  );
}
