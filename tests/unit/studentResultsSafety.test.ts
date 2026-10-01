import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../src/features/studentResults/studentResultsConfig', () => ({ isStudentResultsDemoMode: true }));
vi.mock('../../src/utils/supabaseClient', () => ({ supabase: null }));
import * as store from '../../src/features/studentResults/studentResultsStore';
import * as api from '../../src/features/studentResults/studentResultsPublicApi';
import { clearStudentResultTabDraft, readStudentResultTabDraft, saveStudentResultTabDraft } from '../../src/features/studentResults/studentResultsDraft';
import type { StudentResultDraft } from '../../src/features/studentResults/types';
import type { StudentResultTabDraft } from '../../src/features/studentResults/studentResultsDraft';

const memory = new Map<string, string>();
const draft: StudentResultDraft = {
  title: '가상 평가', description: '가상 안내', allowConfirmation: true, allowDispute: true,
  columns: [{ id: 'score', label: '수학', maxScore: 100, description: '', kind: 'score' }],
  recipients: [{ studentKey: '1', name: '가상학생', verificationCode: '가4821', values: { score: 92 }, feedback: '' }],
};
beforeEach(() => {
  memory.clear();
  vi.stubGlobal('localStorage', { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value) });
  vi.stubGlobal('window', new EventTarget());
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('내용 변경과 확인 버전', () => {
  it.each(['title', 'description', 'label', 'maxScore', 'columnDescription', 'kind'])('%s 변경은 이전 화면 확인을 거부하고 재확인을 요청한다', (field) => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-01T00:00:00Z'));
    const event = store.createStudentResultEvent('teacher', draft);
    const confirmed = store.confirmStudentResult(event.id, event.recipients[0].id)!;
    const current = store.getStudentResultEvent('teacher', event.id)!;
    const settings = { title: current.title, description: current.description, columns: structuredClone(current.columns), allowConfirmation: true, allowDispute: true };
    if (field === 'title') settings.title = '새 가상 평가';
    if (field === 'description') settings.description = '새 가상 안내';
    if (field === 'label') settings.columns[0].label = '국어';
    if (field === 'maxScore') settings.columns[0].maxScore = 120;
    if (field === 'columnDescription') settings.columns[0].description = '새 채점 설명';
    if (field === 'kind') settings.columns[0].kind = 'total';
    const updated = store.updateStudentResultSettings('teacher', event.id, current.updatedAt, settings)!;
    expect(updated.recipients[0].status).toBe('reconfirm');
    expect(updated.recipients[0].confirmedAt).toBeUndefined();
    expect(updated.recipients[0].updatedAt).not.toBe(confirmed.recipient.updatedAt);
    expect(store.confirmStudentResult(event.id, confirmed.recipient.id, confirmed.recipient.updatedAt)).toBeNull();
    expect(store.confirmStudentResult(event.id, confirmed.recipient.id, updated.recipients[0].updatedAt)?.recipient.status).toBe('confirmed');
  });
  it('같은 내용 저장은 확인을 유지하고 확인받기 비활성의 새 내용은 조회 상태로 되돌린다', () => {
    const event = store.createStudentResultEvent('teacher', draft);
    store.confirmStudentResult(event.id, event.recipients[0].id);
    let current = store.getStudentResultEvent('teacher', event.id)!;
    const settings = { title: current.title, description: current.description, columns: current.columns, allowConfirmation: true, allowDispute: true };
    current = store.updateStudentResultSettings('teacher', event.id, current.updatedAt, settings)!;
    expect(current.recipients[0].status).toBe('confirmed');
    const changed = store.updateStudentResultSettings('teacher', event.id, current.updatedAt, { ...settings, description: '새 안내', allowConfirmation: false })!;
    expect(changed.recipients[0].status).toBe('viewed');
    expect(changed.recipients[0].confirmedAt).toBeUndefined();
  });
});

describe('데모 세션도 조회 종료·재발급·종료를 반영한다', () => {
  it('공용·개인 로그인 세션을 모두 폐기하고 새 확인번호 로그인만 허용한다', async () => {
    const event = store.createStudentResultEvent('teacher', draft);
    const recipient = event.recipients[0];
    const common = (await api.authenticatePublicStudentResult(event.publicToken, recipient.name, recipient.verificationCode))!;
    const personal = (await api.authenticatePublicStudentResultByToken(event.publicToken, recipient.personalToken))!;
    expect(common.sessionToken).not.toBe(personal.sessionToken);
    store.regenerateStudentResultPersonalToken('teacher', event.id, recipient.id);
    await expect(api.refreshPublicStudentResult(common.sessionToken, event.id, recipient.id, event.publicToken)).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
    await expect(api.disputePublicStudentResult(personal.sessionToken, event.id, recipient.id, '가상 이의')).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
    expect(await api.authenticatePublicStudentResultByToken(event.publicToken, recipient.personalToken)).toBeNull();
    expect(await api.authenticatePublicStudentResult(event.publicToken, recipient.name, recipient.verificationCode)).not.toBeNull();
  });
  it('조회 종료 뒤 확인 요청은 거부하고 마감된 안내는 EVENT_CLOSED로 응답한다', async () => {
    const event = store.createStudentResultEvent('teacher', draft);
    const recipient = event.recipients[0];
    const session = (await api.authenticatePublicStudentResult(event.publicToken, recipient.name, recipient.verificationCode))!;
    await api.endPublicStudentResultSession(session.sessionToken);
    await expect(api.confirmPublicStudentResult(session.sessionToken, event.id, recipient.id, recipient.updatedAt)).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
    const next = (await api.authenticatePublicStudentResult(event.publicToken, recipient.name, recipient.verificationCode))!;
    store.setStudentResultEventStatus('teacher', event.id, 'closed');
    await expect(api.refreshPublicStudentResult(next.sessionToken, event.id, recipient.id, event.publicToken)).rejects.toMatchObject({ code: 'EVENT_CLOSED' });
  });
  it('만료 시 재조회 오류를 반환하며 잘못된 인증은 만료로 분류하지 않는다', async () => {
    vi.useFakeTimers();
    const event = store.createStudentResultEvent('teacher', draft);
    const session = (await api.authenticatePublicStudentResult(event.publicToken, '가상학생', '가4821'))!;
    vi.advanceTimersByTime(13 * 60 * 60 * 1000);
    await expect(api.refreshPublicStudentResult(session.sessionToken, event.id, event.recipients[0].id, event.publicToken)).rejects.toMatchObject({ status: 401, code: 'SESSION_EXPIRED' });
    expect(api.studentResultAccessFailure(new api.StudentResultApiError('정보가 일치하지 않습니다.', 'AUTH_INVALID', 401))).toBeNull();
    expect(api.studentResultAccessFailure(new api.StudentResultApiError('만료', 'SESSION_EXPIRED', 401))).toBe('expired');
  });
});

it('탭 초안은 복제하여 복원하고 다른 교사·명시적 폐기에는 남기지 않는다', () => {
  const value: StudentResultTabDraft = {
    form: { ...draft, importedFileName: '가상.csv', importAnalysis: null },
    history: [], pendingImport: null, pendingImportFileName: '',
  };
  saveStudentResultTabDraft('teacher-a', value);
  value.form.title = '나중 변경';
  expect(readStudentResultTabDraft('teacher-a')?.form.title).toBe('가상 평가');
  const restored = readStudentResultTabDraft('teacher-a')!;
  restored.form.title = '복원본 변경';
  expect(readStudentResultTabDraft('teacher-a')?.form.title).toBe('가상 평가');
  expect(readStudentResultTabDraft('teacher-b')).toBeNull();
  expect(readStudentResultTabDraft('teacher-a')).toBeNull();
  saveStudentResultTabDraft('teacher-a', value);
  clearStudentResultTabDraft('teacher-a');
  expect(readStudentResultTabDraft('teacher-a')).toBeNull();
});
