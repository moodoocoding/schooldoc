import { parseRoleRoster, roleToday, validRoleDate } from './classroomRoles.ts';

export type MissionStatus = 'draft' | 'open' | 'closed';
export type CheckStatus = 'unmarked' | 'reported' | 'pending' | 'confirmed' | 'exempt';
export type MissionStudent = { id: string; number: number; name: string };
export type StoredMissionStudent = MissionStudent & { codeHash: string };
export type Mission = {
  id: string;
  title: string;
  description: string;
  startDate: string;
  dueDate: string;
  requiresConfirmation: boolean;
  status: MissionStatus;
  closedAt?: string;
  targets: MissionStudent[];
  createdAt: string;
  updatedAt: string;
};
export type MissionCheck = {
  missionId: string;
  studentId: string;
  status: CheckStatus;
  updatedAt: string;
};
export type MissionEvent = MissionCheck & {
  id: string;
  from: CheckStatus;
  actor: 'student' | 'teacher';
};
export type MissionState = {
  className: string;
  roster: MissionStudent[];
  missions: Mission[];
  checks: MissionCheck[];
  events: MissionEvent[];
};
export type StoredMissionState = Omit<MissionState, 'roster'> & { roster: StoredMissionStudent[] };
export type MissionBoard = {
  id: string;
  publicToken: string;
  publicEnabled: boolean;
  version: number;
  updatedAt: string;
  state: MissionState;
};
export type IssuedCode = MissionStudent & { code: string };
export type PublicMission = Pick<Mission, 'id' | 'title' | 'description' | 'startDate' | 'dueDate' | 'requiresConfirmation' | 'status'> & {
  check: CheckStatus;
  checkedAt: string | null;
};
export type PublicMissionView = { className: string; studentName: string; missions: PublicMission[] };
export type MissionInput = {
  title: string;
  description: string;
  startDate: string;
  dueDate: string;
  requiresConfirmation: boolean;
  targetStudentIds: string[];
  status: MissionStatus;
};

export const MISSION_RETENTION_DAYS = 90;
const retentionMilliseconds = MISSION_RETENTION_DAYS * 24 * 60 * 60 * 1000;
export function missionRetention(mission: Mission, now = new Date()): { eligibleAt: string; eligible: boolean } | null {
  if (mission.status !== 'closed' || !mission.closedAt) return null;
  const closedAt = Date.parse(mission.closedAt);
  if (!Number.isFinite(closedAt)) return null;
  const eligibleAt = new Date(closedAt + retentionMilliseconds).toISOString();
  return { eligibleAt, eligible: now.getTime() >= Date.parse(eligibleAt) };
}
export function missionPurgeCounts(state: MissionState, missionId: string) {
  const mission = state.missions.find((item) => item.id === missionId);
  if (!mission) throw new Error('미션을 찾지 못했습니다.');
  return {
    targetCount: mission.targets.length,
    checkCount: state.checks.filter((check) => check.missionId === missionId).length,
    eventCount: state.events.filter((event) => event.missionId === missionId).length,
    clearRoster: state.missions.length === 1,
  };
}
export function purgeMissionState<T extends MissionState>(state: T, missionId: string, now = new Date()): T {
  const mission = state.missions.find((item) => item.id === missionId);
  if (!mission || !missionRetention(mission, now)?.eligible) throw new Error('보관 기간이 끝난 종료 미션만 파기할 수 있습니다.');
  const missions = state.missions.filter((item) => item.id !== missionId);
  return { ...state, missions, checks: state.checks.filter((check) => check.missionId !== missionId),
    events: state.events.filter((event) => event.missionId !== missionId),
    roster: missions.length ? state.roster : [] };
}
export function changeMissionStatus<T extends MissionState>(state: T, missionId: string,
  status: 'open' | 'closed', now = new Date().toISOString()): T {
  const current = state.missions.find((mission) => mission.id === missionId);
  if (!current) throw new Error('미션을 찾지 못했습니다.');
  if (current.status === status) return state;
  if (current.status === 'draft' && status === 'closed') throw new Error('초안은 먼저 발행해 주세요.');
  return { ...state, missions: state.missions.map((mission) => mission.id === missionId
    ? { ...mission, status, closedAt: status === 'closed' ? now : undefined, updatedAt: now } : mission) };
}

const nonControl = (value: string) => [...value].every((character) => {
  const code = character.charCodeAt(0);
  return code >= 32 && code !== 127;
});
export const missionToday = roleToday;
export function validateClassName(value: unknown): string {
  if (typeof value !== 'string') throw new Error('학급 이름을 입력해 주세요.');
  const name = value.trim();
  if (!name || name.length > 60 || !nonControl(name)) throw new Error('학급 이름은 1~60자로 입력해 주세요.');
  return name;
}
export function parseMissionRoster(text: string, previous: MissionStudent[] = []): MissionStudent[] {
  return parseRoleRoster(text, previous);
}
export function validateMissionInput(value: unknown, roster: MissionStudent[]): MissionInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('미션 내용을 확인해 주세요.');
  const input = value as Record<string, unknown>;
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const description = typeof input.description === 'string' ? input.description.trim() : '';
  if (!title || title.length > 100 || !nonControl(title)) throw new Error('미션 제목은 1~100자로 입력해 주세요.');
  if (description.length > 1000 || !nonControl(description.replace(/\r?\n/g, ''))) throw new Error('미션 안내는 1000자 이하로 입력해 주세요.');
  if (!validRoleDate(input.startDate) || !validRoleDate(input.dueDate) || input.startDate > input.dueDate) {
    throw new Error('시작일과 마감일을 확인해 주세요.');
  }
  if (typeof input.requiresConfirmation !== 'boolean') throw new Error('교사 확인 설정을 확인해 주세요.');
  if (input.status !== 'draft' && input.status !== 'open' && input.status !== 'closed') throw new Error('미션 상태를 확인해 주세요.');
  if (!Array.isArray(input.targetStudentIds) || !input.targetStudentIds.length || input.targetStudentIds.length > 60) {
    throw new Error('대상 학생을 선택해 주세요.');
  }
  const targets = input.targetStudentIds;
  if (targets.some((id) => typeof id !== 'string') || new Set(targets).size !== targets.length ||
      targets.some((id) => !roster.some((student) => student.id === id))) {
    throw new Error('대상 학생을 다시 선택해 주세요.');
  }
  return { title, description, startDate: input.startDate, dueDate: input.dueDate,
    requiresConfirmation: input.requiresConfirmation, targetStudentIds: targets, status: input.status };
}
export function missionCanReport(mission: Mission, today = missionToday()): boolean {
  return mission.status === 'open' && mission.startDate <= today && today <= mission.dueDate;
}
export function checkFor(state: MissionState, missionId: string, studentId: string): MissionCheck | undefined {
  return state.checks.find((check) => check.missionId === missionId && check.studentId === studentId);
}
export function missionCounts(state: MissionState, mission: Mission) {
  const counts: Record<CheckStatus, number> = { unmarked: 0, reported: 0, pending: 0, confirmed: 0, exempt: 0 };
  for (const target of mission.targets) counts[checkFor(state, mission.id, target.id)?.status ?? 'unmarked'] += 1;
  return counts;
}
export function publicMissionView(state: MissionState, studentId: string): PublicMissionView {
  const student = state.roster.find((entry) => entry.id === studentId);
  if (!student) throw new Error('코드 또는 링크를 확인해 주세요.');
  return {
    className: state.className,
    studentName: student.name,
    missions: state.missions.filter((mission) => mission.status !== 'draft' && mission.targets.some((target) => target.id === studentId))
      .map((mission) => {
        const check = checkFor(state, mission.id, studentId);
        return { id: mission.id, title: mission.title, description: mission.description,
          startDate: mission.startDate, dueDate: mission.dueDate, requiresConfirmation: mission.requiresConfirmation,
          status: mission.status, check: check?.status ?? 'unmarked', checkedAt: check?.updatedAt ?? null };
      }),
  };
}
export function setMissionCheck(state: StoredMissionState, missionId: string, studentId: string, next: CheckStatus,
  actor: 'teacher' | 'student', now = new Date().toISOString(), today = missionToday()): StoredMissionState {
  const mission = state.missions.find((item) => item.id === missionId);
  if (!mission || !mission.targets.some((target) => target.id === studentId)) throw new Error('미션 대상을 찾지 못했습니다.');
  const previous = checkFor(state, missionId, studentId)?.status ?? 'unmarked';
  if (actor === 'student') {
    if (!missionCanReport(mission, today)) throw new Error('지금은 완료를 표시할 수 없습니다.');
    if (next === 'unmarked' && previous !== 'reported' && previous !== 'pending' && previous !== 'unmarked') {
      throw new Error('교사 확인 후에는 직접 취소할 수 없습니다.');
    }
    if (next !== 'unmarked' && next !== (mission.requiresConfirmation ? 'pending' : 'reported')) {
      throw new Error('완료 상태를 확인해 주세요.');
    }
    if (previous === 'confirmed' || previous === 'exempt') throw new Error('교사에게 수정을 요청해 주세요.');
  } else if (!['unmarked', 'reported', 'pending', 'confirmed', 'exempt'].includes(next)) {
    throw new Error('상태를 확인해 주세요.');
  }
  if (previous === next) return state;
  return {
    ...state,
    checks: [...state.checks.filter((check) => check.missionId !== missionId || check.studentId !== studentId),
      ...(next === 'unmarked' ? [] : [{ missionId, studentId, status: next, updatedAt: now }])],
    events: [...state.events, { id: crypto.randomUUID(), missionId, studentId, from: previous, status: next, actor, updatedAt: now }],
  };
}

export function normalizeMissionCode(code: string): string { return code.toUpperCase().replace(/[\s-]/g, ''); }
export function generateMissionCode(): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return [...bytes].map((byte) => alphabet[byte & 31]).join('');
}
export async function hashMissionCode(boardId: string, code: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${boardId}:${normalizeMissionCode(code)}`));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
export function safeHashEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return result === 0;
}
