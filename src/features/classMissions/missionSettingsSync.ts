import { loadTeacherProfile } from '../settings/profileSettings';
import { isRolesDemo, loadRoleBoard, type RoleStudent } from '../classroomRoles/roleApi';
import {
  createMissionBoard, isMissionsDemo, listMissionBoards, mutateMissionBoard,
  type IssuedCode, type MissionBoard, type MissionStudent,
} from './missionApi';

const DEFAULT_CLASS_NAME = '우리 반';
export const MISSIONS_DEMO_PROFILE_ID = 'local-demo-teacher';

export function settingsMissionClassName(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, ' ').replace(/\s+담임(?:교사)?$/, '');
  const gradeAndClass = trimmed.match(/^(\d{1,2})\s*학년\s*(\d{1,2})\s*반$/)
    ?? trimmed.match(/^(\d{1,2})\s*[-/]\s*(\d{1,2})(?:\s*반)?$/);
  if (gradeAndClass) return `${Number(gradeAndClass[1])}학년 ${Number(gradeAndClass[2])}반`;
  return /반$|학급$/.test(trimmed) ? trimmed : '';
}

const classKey = (name: string) => (settingsMissionClassName(name) || name).replace(/\s+/g, '').toLowerCase();

export function rosterWithSettingsStudents(current: MissionStudent[], configured: RoleStudent[]) {
  const existingByNumber = new Map(current.map((student) => [student.number, student]));
  const conflicts = configured.filter((student) => {
    const existing = existingByNumber.get(student.number);
    return existing && existing.name !== student.name;
  });
  if (conflicts.length) throw new Error(`설정 명단과 학급 미션 명단의 번호·이름이 ${conflicts.length}명 다릅니다. 학급 명단을 확인해 주세요.`);
  const additions = configured.filter((student) => !existingByNumber.has(student.number));
  if (!additions.length) return null;
  if (current.length + additions.length > 60) throw new Error('설정 학생을 더하면 학급 미션의 60명 제한을 넘습니다. 명단을 확인해 주세요.');
  const students = [...current, ...additions].sort((a, b) => a.number - b.number);
  return {
    rosterText: students.map((student) => `${student.number} ${student.name}`).join('\n'),
    addedCount: additions.length,
  };
}

export interface MissionSettingsSyncResult {
  boards: MissionBoard[];
  selectedBoardId: string;
  issuedCodes: IssuedCode[];
  notice: string;
  warning: string;
}

async function applyMissionSettings(userId: string, displayName: string): Promise<MissionSettingsSyncResult> {
  if (isMissionsDemo !== isRolesDemo) {
    return {
      boards: await listMissionBoards(), selectedBoardId: '', issuedCodes: [], notice: '',
      warning: '설정 명단과 학급 미션의 저장 모드가 달라 자동 등록하지 않았습니다. 개발용 데모 설정을 확인해 주세요.',
    };
  }
  const className = settingsMissionClassName(loadTeacherProfile(userId, displayName).gradeClass);
  const [boardsResult, rosterResult] = await Promise.allSettled([
    listMissionBoards(),
    loadRoleBoard().then((board) => board.state.roster),
  ]);
  if (boardsResult.status === 'rejected') throw boardsResult.reason;
  let boards = boardsResult.value;
  const configuredRoster = rosterResult.status === 'fulfilled' ? rosterResult.value : [];
  const rosterLoadFailed = rosterResult.status === 'rejected';

  const matchingBoards = className ? boards.filter((board) => classKey(board.state.className) === classKey(className)) : [];
  if (matchingBoards.length > 1) {
    return {
      boards, selectedBoardId: '', issuedCodes: [], notice: '',
      warning: '설정 학급과 이름이 같은 학급이 여러 개라 학생을 자동 등록하지 않았습니다. 학급을 확인해 주세요.',
    };
  }
  let target = matchingBoards[0];
  let created = false;
  if (className && !target) {
    target = await createMissionBoard(className, { fromSettings: true });
    boards = [...boards, target];
    created = true;
  } else if (!className && configuredRoster.length) {
    if (boards.length === 1) target = boards[0];
    else if (boards.length === 0) {
      target = await createMissionBoard(DEFAULT_CLASS_NAME, { fromSettings: true });
      boards = [target];
      created = true;
    }
  }

  const base: MissionSettingsSyncResult = {
    boards, selectedBoardId: target?.id ?? '', issuedCodes: [],
    notice: created ? `설정 정보를 바탕으로 ${target?.state.className} 학급을 만들었습니다.` : '',
    warning: rosterLoadFailed ? '설정 학생 명단을 불러오지 못했습니다. 새로고침으로 다시 시도해 주세요.'
      : !className && configuredRoster.length && boards.length > 1
        ? '설정 학생을 등록할 학급을 정할 수 없습니다. 환경 설정의 담당 학급을 입력해 주세요.' : '',
  };
  if (!target || !configuredRoster.length) return base;
  if (!target.publicEnabled && !target.state.roster.length && !target.state.missions.length) {
    return { ...base, warning: '학생 링크가 중지된 빈 학급에는 설정 명단을 다시 등록하지 않습니다. 새로 시작하려면 공개 링크를 켜고 새로고침해 주세요.' };
  }
  try {
    const update = rosterWithSettingsStudents(target.state.roster, configuredRoster);
    if (!update) return base;
    const saved = await mutateMissionBoard(target, { action: 'saveRoster', rosterText: update.rosterText });
    boards = boards.map((board) => board.id === target.id ? saved.board : board);
    return {
      ...base, boards, issuedCodes: saved.issuedCodes,
      notice: `설정 명단의 새 학생 ${update.addedCount}명을 ${target.state.className}에 등록했습니다. 발급된 개인 코드를 전달해 주세요. 기존 미션 대상은 바뀌지 않습니다.`,
    };
  } catch (error) {
    return { ...base, warning: error instanceof Error ? error.message : '설정 명단을 반영하지 못했습니다. 다시 시도해 주세요.' };
  }
}

const inFlight = new Map<string, Promise<MissionSettingsSyncResult>>();
export function syncMissionSettings(userId: string, displayName: string): Promise<MissionSettingsSyncResult> {
  const key = `schooldoc:class-missions-settings:${userId}`;
  if (navigator.locks?.request) {
    return navigator.locks.request(key, () => applyMissionSettings(userId, displayName));
  }
  const pending = inFlight.get(key);
  if (pending) return pending;
  const work = applyMissionSettings(userId, displayName);
  inFlight.set(key, work);
  const clear = () => { if (inFlight.get(key) === work) inFlight.delete(key); };
  void work.then(clear, clear);
  return work;
}
