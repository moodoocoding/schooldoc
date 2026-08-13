import { supabase } from '../../utils/supabaseClient';
import { isStudentResultsDemoMode } from './studentResultsConfig';
import * as local from './studentResultsStore';
import type { AuthenticatedStudentResult, PublicStudentResult, PublicStudentResultSession } from './types';

export interface StudentResultMetadata { title: string; description: string; status: 'open' | 'closed' }

const stripSecrets = (value: AuthenticatedStudentResult): PublicStudentResult => {
  const { verificationCode: _verificationCode, personalToken: _personalToken, ...recipient } = value.recipient;
  return { event: value.event, recipient };
};

const invoke = async <T>(body: Record<string, unknown>) => {
  if (!supabase) throw new Error('결과 안내 서버 연결 정보가 없습니다.');
  const { data, error } = await supabase.functions.invoke('student-results-public', { body });
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
    throw new Error(error.message || '결과 안내 서버 요청에 실패했습니다.');
  }
  return data as T;
};

export const loadPublicStudentResultMetadata = async (token: string) => {
  if (isStudentResultsDemoMode) return local.getPublicResultEvent(token);
  const { event } = await invoke<{ event: StudentResultMetadata }>({ action: 'metadata', token });
  return event;
};

export const authenticatePublicStudentResult = async (token: string, name: string, verificationCode: string): Promise<PublicStudentResultSession | null> => {
  if (isStudentResultsDemoMode) {
    const result = local.authenticateStudentResult(token, name, verificationCode);
    return result ? { sessionToken: 'local-demo-session', result: stripSecrets(result) } : null;
  }
  return invoke<PublicStudentResultSession>({ action: 'authenticate', token, name, verificationCode });
};

export const authenticatePublicStudentResultByToken = async (token: string, personalToken: string): Promise<PublicStudentResultSession | null> => {
  if (isStudentResultsDemoMode) {
    const result = local.authenticateStudentResultByToken(token, personalToken);
    return result ? { sessionToken: 'local-demo-session', result: stripSecrets(result) } : null;
  }
  return invoke<PublicStudentResultSession>({ action: 'personal', token, personalToken });
};

export const confirmPublicStudentResult = async (sessionToken: string, eventId: string, recipientId: string): Promise<PublicStudentResultSession | null> => {
  if (isStudentResultsDemoMode) {
    const result = local.confirmStudentResult(eventId, recipientId);
    return result ? { sessionToken, result: stripSecrets(result) } : null;
  }
  return invoke<PublicStudentResultSession>({ action: 'confirm', sessionToken });
};

export const disputePublicStudentResult = async (sessionToken: string, eventId: string, recipientId: string, message: string): Promise<PublicStudentResultSession | null> => {
  if (isStudentResultsDemoMode) {
    const result = local.disputeStudentResult(eventId, recipientId, message);
    return result ? { sessionToken, result: stripSecrets(result) } : null;
  }
  return invoke<PublicStudentResultSession>({ action: 'dispute', sessionToken, message });
};
