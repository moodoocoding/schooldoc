import { supabase } from '../../utils/supabaseClient';
import { isStudentResultsDemoMode } from './studentResultsConfig';
import * as local from './studentResultsStore';
import type { AuthenticatedStudentResult, PublicStudentResult, PublicStudentResultSession } from './types';

export interface StudentResultMetadata { title: string; description: string; status: 'open' | 'closed' }

const stripSecrets = (value: AuthenticatedStudentResult): PublicStudentResult => {
  const { verificationCode: _verificationCode, personalToken: _personalToken, revisions: _revisions, ...recipient } = value.recipient;
  return { event: value.event, recipient };
};

export class StudentResultApiError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = 'StudentResultApiError';
    this.code = code;
    this.status = status;
  }
}

export const studentResultAccessFailure = (error: unknown): 'closed' | 'expired' | null => {
  if (error instanceof StudentResultApiError) {
    if (error.code === 'EVENT_CLOSED') return 'closed';
    if (error.status === 401 && ['SESSION_EXPIRED', 'PERSONAL_LINK_INVALID'].includes(error.code)) return 'expired';
  }
  // Preserve recovery with older deployed functions until the new response codes are deployed.
  const message = error instanceof Error ? error.message : '';
  if (message.includes('종료')) return 'closed';
  if (/만료|세션.*유효|유효.*세션/.test(message)) return 'expired';
  return null;
};

const invoke = async <T>(body: Record<string, unknown>) => {
  if (!supabase) throw new Error('결과 안내 서버 연결 정보가 없습니다.');
  const { data, error } = await supabase.functions.invoke('student-results-public', { body });
  if (error) {
    const context = error.context as Response | undefined;
    let response: { error?: string; code?: string } = {};
    if (context) {
      try { response = await context.clone().json(); } catch { /* Non-JSON gateway errors use the safe fallback. */ }
    }
    throw new StudentResultApiError(response.error || '결과 안내 서버 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.', response.code || '', context?.status ?? 0);
  }
  return data as T;
};

// Demo sessions mirror revocation without persisting student credentials or session tokens.
const demoSessions = new Map<string, { eventId: string; recipientId: string; personalToken: string; expiresAt: number }>();
const issueDemoSession = (result: AuthenticatedStudentResult): PublicStudentResultSession => {
  const sessionToken = crypto.randomUUID();
  demoSessions.set(sessionToken, { eventId: result.event.id, recipientId: result.recipient.id, personalToken: result.recipient.personalToken, expiresAt: Date.now() + 12 * 60 * 60 * 1000 });
  return { sessionToken, result: stripSecrets(result) };
};
const requireDemoSession = (sessionToken: string, eventId: string, recipientId: string) => {
  const session = demoSessions.get(sessionToken);
  const result = local.getStudentResultEventPublicRecipient(eventId, recipientId);
  if (session && !result && local.getPublicResultEventById(eventId)?.status === 'closed') {
    demoSessions.delete(sessionToken);
    throw new StudentResultApiError('종료된 결과 안내입니다.', 'EVENT_CLOSED', 409);
  }
  if (!session || session.expiresAt <= Date.now() || session.eventId !== eventId || session.recipientId !== recipientId || !result || result.recipient.personalToken !== session.personalToken) {
    demoSessions.delete(sessionToken);
    throw new StudentResultApiError('조회가 만료되었습니다. 다시 조회해 주세요.', 'SESSION_EXPIRED', 401);
  }
  return result;
};

export const loadPublicStudentResultMetadata = async (token: string) => {
  if (isStudentResultsDemoMode) return local.getPublicResultEvent(token);
  const { event } = await invoke<{ event: StudentResultMetadata }>({ action: 'metadata', token });
  return event;
};

export const authenticatePublicStudentResult = async (token: string, name: string, verificationCode: string): Promise<PublicStudentResultSession | null> => {
  if (isStudentResultsDemoMode) {
    const result = local.authenticateStudentResult(token, name, verificationCode);
    return result ? issueDemoSession(result) : null;
  }
  return invoke<PublicStudentResultSession>({ action: 'authenticate', token, name, verificationCode });
};

export const authenticatePublicStudentResultByToken = async (token: string, personalToken: string): Promise<PublicStudentResultSession | null> => {
  if (isStudentResultsDemoMode) {
    const result = local.authenticateStudentResultByToken(token, personalToken);
    return result ? issueDemoSession(result) : null;
  }
  return invoke<PublicStudentResultSession>({ action: 'personal', token, personalToken });
};

export const confirmPublicStudentResult = async (sessionToken: string, eventId: string, recipientId: string, expectedUpdatedAt?: string): Promise<PublicStudentResultSession | null> => {
  if (isStudentResultsDemoMode) {
    requireDemoSession(sessionToken, eventId, recipientId);
    const result = expectedUpdatedAt ? local.confirmStudentResult(eventId, recipientId, expectedUpdatedAt) : null;
    return result ? { sessionToken, result: stripSecrets(result) } : null;
  }
  return invoke<PublicStudentResultSession>({ action: 'confirm', sessionToken, expectedUpdatedAt });
};

export const disputePublicStudentResult = async (sessionToken: string, eventId: string, recipientId: string, message: string): Promise<PublicStudentResultSession | null> => {
  if (isStudentResultsDemoMode) {
    requireDemoSession(sessionToken, eventId, recipientId);
    const result = local.disputeStudentResult(eventId, recipientId, message);
    return result ? { sessionToken, result: stripSecrets(result) } : null;
  }
  return invoke<PublicStudentResultSession>({ action: 'dispute', sessionToken, message });
};

export const refreshPublicStudentResult = async (sessionToken: string, eventId: string, recipientId: string, token: string, personalToken?: string | null): Promise<PublicStudentResultSession | null> => {
  if (isStudentResultsDemoMode) {
    const result = requireDemoSession(sessionToken, eventId, recipientId);
    if (result.event.publicToken !== token || (personalToken && result.recipient.personalToken !== personalToken)) {
      throw new StudentResultApiError('조회 링크가 만료되었습니다.', 'PERSONAL_LINK_INVALID', 401);
    }
    return result ? { sessionToken, result: stripSecrets(result) } : null;
  }
  return invoke<PublicStudentResultSession>({ action: 'session', sessionToken });
};

export const endPublicStudentResultSession = async (sessionToken: string) => {
  if (isStudentResultsDemoMode) { demoSessions.delete(sessionToken); return; }
  await invoke<{ ok: boolean }>({ action: 'logout', sessionToken });
};
