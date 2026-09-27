import { supabase } from '../../utils/supabaseClient';
import {
  changeMissionStatus, generateMissionCode, hashMissionCode, missionPurgeCounts, missionToday, normalizeMissionCode,
  parseMissionRoster, publicMissionView, purgeMissionState, safeHashEqual, setMissionCheck,
  validateClassName, validateMissionInput,
  type IssuedCode, type Mission, type MissionBoard, type MissionInput,
  type PublicMissionView, type StoredMissionState,
} from '../../../supabase/functions/_shared/classMissions';
export * from '../../../supabase/functions/_shared/classMissions';

export const isMissionsDemo = import.meta.env.DEV && import.meta.env.VITE_CLASS_MISSIONS_DEMO_MODE === 'true';
const demoKey = 'schooldoc_class_missions_demo_v1';
const changedEvent = 'schooldoc:class-missions-changed';
type DemoBoard = Omit<MissionBoard, 'state'> & { state: StoredMissionState };
export type MissionMutation =
  | { action: 'renameBoard'; className: string }
  | { action: 'saveRoster'; rosterText: string }
  | { action: 'reissueCode'; studentId: string }
  | { action: 'saveMission'; missionId?: string; mission: MissionInput }
  | { action: 'setMissionStatus'; missionId: string; status: 'open' | 'closed' }
  | { action: 'purgeMission'; missionId: string; expectedTargetCount: number; expectedCheckCount: number;
      expectedEventCount: number; confirmText: '영구 파기' }
  | { action: 'setCheck'; missionId: string; studentId: string; status: 'unmarked' | 'reported' | 'pending' | 'confirmed' | 'exempt' }
  | { action: 'confirmPending'; missionId: string; expectedStudentIds: string[] }
  | { action: 'setPublic'; enabled: boolean }
  | { action: 'rotateToken' };
export type MissionMutationResult = { board: MissionBoard; issuedCodes: IssuedCode[] };
const copy = <T,>(value: T): T => structuredClone(value);
const readDemo = (): DemoBoard[] => JSON.parse(localStorage.getItem(demoKey) ?? '[]');
const writeDemo = (boards: DemoBoard[]) => {
  localStorage.setItem(demoKey, JSON.stringify(boards));
  window.dispatchEvent(new Event(changedEvent));
};
const project = (board: DemoBoard): MissionBoard => ({ ...board, state: {
  ...board.state, roster: board.state.roster.map(({ id, number, name }) => ({ id, number, name })),
} });
async function invoke<T>(endpoint: string, body: object): Promise<T> {
  if (!supabase) throw new Error('서버 연결 설정을 확인해 주세요.');
  const { data, error } = await supabase.functions.invoke(endpoint, { body });
  if (error) {
    let message = '연결하지 못했습니다. 입력을 유지한 채 다시 시도해 주세요.';
    const context = (error as { context?: Response }).context;
    if (context instanceof Response) {
      try {
        const detail = await context.clone().json();
        if (typeof detail.error === 'string') message = detail.error;
      } catch { /* safe fallback */ }
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}
export const subscribeMissions = (listener: () => void) => {
  window.addEventListener(changedEvent, listener);
  return () => window.removeEventListener(changedEvent, listener);
};
export async function listMissionBoards(): Promise<MissionBoard[]> {
  if (isMissionsDemo) return readDemo().map(project);
  const result = await invoke<{ boards: MissionBoard[] }>('class-missions-admin', { action: 'list' });
  return result.boards;
}
export async function createMissionBoard(className: string, options: { fromSettings?: boolean } = {}): Promise<MissionBoard> {
  if (!isMissionsDemo) {
    const result = await invoke<{ board: MissionBoard }>('class-missions-admin', {
      action: 'createBoard', className, fromSettings: options.fromSettings === true,
    });
    return result.board;
  }
  const boards = readDemo();
  if (boards.length >= 12) throw new Error('학급은 최대 12개까지 만들 수 있습니다.');
  const board: DemoBoard = { id: crypto.randomUUID(), publicToken: crypto.randomUUID(), publicEnabled: true,
    version: 1, updatedAt: new Date().toISOString(),
    state: { className: validateClassName(className), roster: [], missions: [], checks: [], events: [] } };
  writeDemo([...boards, board]);
  return project(board);
}
export async function mutateMissionBoard(board: MissionBoard, mutation: MissionMutation): Promise<MissionMutationResult> {
  if (!isMissionsDemo) return invoke('class-missions-admin', { ...mutation, boardId: board.id, version: board.version });
  const boards = readDemo();
  const current = boards.find((entry) => entry.id === board.id);
  if (!current || current.version !== board.version) throw new Error('다른 화면에서 변경되었습니다. 새로고침 후 다시 시도해 주세요.');
  const state = current.state;
  let next: DemoBoard = copy(current);
  const issuedCodes: IssuedCode[] = [];
  switch (mutation.action) {
    case 'renameBoard': next.state.className = validateClassName(mutation.className); break;
    case 'saveRoster': {
      const parsed = parseMissionRoster(mutation.rosterText, state.roster);
      const remaining = new Set(parsed.map((student) => student.id));
      if (state.missions.some((mission) => mission.status === 'open' && mission.targets.some((target) => !remaining.has(target.id)))) {
        throw new Error('진행 중 미션의 대상은 명단에서 지울 수 없습니다. 미션을 종료한 뒤 수정해 주세요.');
      }
      next.state.roster = [];
      for (const student of parsed) {
        const old = state.roster.find((entry) => entry.id === student.id);
        if (old) next.state.roster.push(old);
        else {
          const code = generateMissionCode();
          next.state.roster.push({ ...student, codeHash: await hashMissionCode(current.id, code) });
          issuedCodes.push({ ...student, code });
        }
      }
      break;
    }
    case 'reissueCode': {
      const student = state.roster.find((entry) => entry.id === mutation.studentId);
      if (!student) throw new Error('학생을 찾지 못했습니다.');
      const code = generateMissionCode();
      next.state.roster = state.roster.map((entry) => entry.id === student.id ? { ...entry, codeHash: '' } : entry);
      next.state.roster.find((entry) => entry.id === student.id)!.codeHash = await hashMissionCode(current.id, code);
      issuedCodes.push({ id: student.id, number: student.number, name: student.name, code });
      break;
    }
    case 'saveMission': {
      const existing = mutation.missionId ? state.missions.find((mission) => mission.id === mutation.missionId) : undefined;
      if (mutation.missionId && !existing) throw new Error('미션을 찾지 못했습니다.');
      const rosterForValidation = [...state.roster, ...(existing && existing.status !== 'draft'
        ? existing.targets.filter((target) => !state.roster.some((student) => student.id === target.id)) : [])];
      const input = validateMissionInput(mutation.mission, rosterForValidation);
      if (!existing && input.status === 'closed') throw new Error('새 미션은 초안이나 진행 중으로 만들어 주세요.');
      if (!existing && state.missions.length >= 60) throw new Error('한 학급에는 미션을 최대 60개까지 만들 수 있습니다.');
      if (existing && existing.status !== 'draft') {
        if (existing.requiresConfirmation !== input.requiresConfirmation || existing.status !== input.status ||
            existing.targets.map((student) => student.id).sort().join(',') !== [...input.targetStudentIds].sort().join(',')) {
          throw new Error('발행한 미션의 대상·확인 방식·상태는 여기서 바꿀 수 없습니다.');
        }
      }
      const timestamp = new Date().toISOString();
      const mission: Mission = { id: existing?.id ?? crypto.randomUUID(), title: input.title, description: input.description,
        startDate: input.startDate, dueDate: input.dueDate, requiresConfirmation: input.requiresConfirmation,
        status: input.status, closedAt: existing?.closedAt,
        targets: existing?.status !== 'draft' && existing ? existing.targets : input.targetStudentIds.map((id) => {
          const { number, name } = state.roster.find((student) => student.id === id)!;
          return { id, number, name };
        }), createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp };
      next.state.missions = existing ? state.missions.map((entry) => entry.id === mission.id ? mission : entry) : [...state.missions, mission];
      break;
    }
    case 'setMissionStatus': {
      const selected = state.missions.find((mission) => mission.id === mutation.missionId);
      if (!selected) throw new Error('미션을 찾지 못했습니다.');
      if (mutation.status === 'open' && selected.dueDate < missionToday()) {
        throw new Error('마감일을 연장한 뒤 다시 열어 주세요.');
      }
      next.state = changeMissionStatus(state, mutation.missionId, mutation.status);
      break;
    }
    case 'purgeMission': {
      const counts = missionPurgeCounts(state, mutation.missionId);
      if (mutation.confirmText !== '영구 파기' || mutation.expectedTargetCount !== counts.targetCount ||
          mutation.expectedCheckCount !== counts.checkCount || mutation.expectedEventCount !== counts.eventCount) {
        throw new Error('파기 대상과 건수를 다시 확인해 주세요.');
      }
      next.state = purgeMissionState(state, mutation.missionId);
      if (counts.clearRoster) { next.publicToken = crypto.randomUUID(); next.publicEnabled = false; }
      break;
    }
    case 'setCheck': next.state = setMissionCheck(next.state, mutation.missionId, mutation.studentId, mutation.status, 'teacher'); break;
    case 'confirmPending': {
      const pending = state.checks.filter((check) => check.missionId === mutation.missionId && check.status === 'pending').map((check) => check.studentId).sort();
      if ([...mutation.expectedStudentIds].sort().join(',') !== pending.join(',')) {
        throw new Error('확인 대기 명단이 변경되었습니다. 새로고침 후 다시 확인해 주세요.');
      }
      for (const studentId of pending) next.state = setMissionCheck(next.state, mutation.missionId, studentId, 'confirmed', 'teacher');
      break;
    }
    case 'setPublic': next.publicEnabled = mutation.enabled; break;
    case 'rotateToken': next.publicToken = crypto.randomUUID(); break;
  }
  next = { ...next, version: next.version + 1, updatedAt: new Date().toISOString() };
  writeDemo(boards.map((entry) => entry.id === board.id ? next : entry));
  return { board: project(next), issuedCodes };
}
export async function viewPublicMission(token: string, code: string): Promise<PublicMissionView> {
  if (!isMissionsDemo) return invoke('class-missions-public', { action: 'view', token, code });
  const board = readDemo().find((entry) => entry.publicToken === token && entry.publicEnabled);
  if (!board) throw new Error('코드 또는 링크를 확인해 주세요.');
  const hash = await hashMissionCode(board.id, code);
  const student = board.state.roster.find((entry) => safeHashEqual(entry.codeHash, hash));
  if (!student) throw new Error('코드 또는 링크를 확인해 주세요.');
  return publicMissionView(board.state, student.id);
}
export async function markPublicMission(token: string, code: string, missionId: string, status: 'reported' | 'unmarked'): Promise<PublicMissionView> {
  if (!isMissionsDemo) return invoke('class-missions-public', { action: 'mark', token, code, missionId, status });
  const boards = readDemo();
  const board = boards.find((entry) => entry.publicToken === token && entry.publicEnabled);
  if (!board) throw new Error('코드 또는 링크를 확인해 주세요.');
  const hash = await hashMissionCode(board.id, normalizeMissionCode(code));
  const student = board.state.roster.find((entry) => safeHashEqual(entry.codeHash, hash));
  if (!student) throw new Error('코드 또는 링크를 확인해 주세요.');
  const mission = board.state.missions.find((entry) => entry.id === missionId);
  if (!mission) throw new Error('미션을 찾지 못했습니다.');
  const nextStatus = status === 'unmarked' ? 'unmarked' : mission.requiresConfirmation ? 'pending' : 'reported';
  const nextState = setMissionCheck(board.state, missionId, student.id, nextStatus, 'student');
  if (nextState !== board.state) {
    const next = { ...board, state: nextState, version: board.version + 1, updatedAt: new Date().toISOString() };
    writeDemo(boards.map((entry) => entry.id === board.id ? next : entry));
    return publicMissionView(nextState, student.id);
  }
  return publicMissionView(board.state, student.id);
}
export const missionPublicUrl = (token: string) => `${window.location.origin}/s/missions/${token}`;
