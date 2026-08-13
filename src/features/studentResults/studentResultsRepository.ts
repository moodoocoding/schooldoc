import { supabase } from '../../utils/supabaseClient';
import type { StudentResultDraft, StudentResultEvent } from './types';
import { validateStudentResultDraft } from './studentResultsUtils';

const CHANGE_EVENT = 'schooldoc-student-results-remote-change';
const client = () => {
  if (!supabase) throw new Error('Supabase 연결 정보가 없습니다.');
  return supabase;
};
const invoke = async <T>(body: Record<string, unknown>) => {
  const { data, error } = await client().functions.invoke('student-results-admin', { body });
  if (error) {
    const context = error.context as Response | undefined;
    if (context) {
      try {
        const response = await context.clone().json() as { error?: string };
        if (response.error) throw new Error(response.error);
      } catch (contextError) {
        if (contextError instanceof Error && contextError.message !== 'Unexpected end of JSON input') throw contextError;
      }
    }
    throw new Error(error.message || '학생 결과 서버 요청에 실패했습니다.');
  }
  return data as T;
};
const notify = () => window.dispatchEvent(new CustomEvent(CHANGE_EVENT));

export const listRemoteStudentResultEvents = async () => (await invoke<{ events: StudentResultEvent[] }>({ action: 'list' })).events;
export const getRemoteStudentResultEvent = async (eventId: string) => (await invoke<{ event: StudentResultEvent }>({ action: 'get', eventId })).event;
export const createRemoteStudentResultEvent = async (draft: StudentResultDraft) => {
  const validationError = validateStudentResultDraft(draft);
  if (validationError) throw new Error(validationError);
  const { event } = await invoke<{ event: StudentResultEvent }>({ action: 'create', draft });
  notify();
  return event;
};
export const deleteRemoteStudentResultEvent = async (eventId: string) => { await invoke({ action: 'delete', eventId }); notify(); };
export const setRemoteStudentResultEventStatus = async (eventId: string, status: StudentResultEvent['status']) => { await invoke({ action: 'status', eventId, status }); notify(); };
export const replyToRemoteStudentDispute = async (eventId: string, recipientId: string, reply: string) => { await invoke({ action: 'reply', eventId, recipientId, reply }); notify(); };
export const regenerateRemoteStudentResultPersonalToken = async (eventId: string, recipientId: string) => { await invoke({ action: 'regenerate', eventId, recipientId }); notify(); };

export const subscribeRemoteStudentResults = (listener: () => void) => {
  window.addEventListener(CHANGE_EVENT, listener);
  const channel = client().channel(`student-results-admin-${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'student_result_events' }, listener)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'student_result_recipients' }, listener)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'student_result_disputes' }, listener)
    .subscribe();
  return () => { window.removeEventListener(CHANGE_EVENT, listener); void client().removeChannel(channel); };
};
