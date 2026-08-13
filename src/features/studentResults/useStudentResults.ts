import { useCallback, useEffect, useState } from 'react';
import { useTeacherAuth } from '../../auth/teacherAuth';
import { getStudentResultEvent, listStudentResultEvents, subscribeStudentResults } from './studentResultsStore';
import { studentResultsOwnerId } from './studentResultsConfig';
import type { StudentResultEvent } from './types';

export function useStudentResultEvents() {
  const { user } = useTeacherAuth();
  const [data, setData] = useState<StudentResultEvent[]>([]);
  const ownerId = studentResultsOwnerId(user?.id);
  const refresh = useCallback(() => setData(ownerId ? listStudentResultEvents(ownerId) : []), [ownerId]);
  useEffect(() => {
    refresh();
    return subscribeStudentResults(refresh);
  }, [refresh]);
  return { data, refresh };
}

export function useStudentResultEvent(eventId?: string) {
  const { user } = useTeacherAuth();
  const [data, setData] = useState<StudentResultEvent | null>(null);
  const ownerId = studentResultsOwnerId(user?.id);
  const refresh = useCallback(() => setData(ownerId && eventId ? getStudentResultEvent(ownerId, eventId) : null), [eventId, ownerId]);
  useEffect(() => {
    refresh();
    return subscribeStudentResults(refresh);
  }, [refresh]);
  return { data, refresh };
}
