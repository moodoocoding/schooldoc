import type { SelectedSchool } from '../specialRooms/types';

export interface TeacherProfileSettings {
  school: SelectedSchool | null;
  teacherName: string;
  gradeClass: string;
}

const PROFILE_STORAGE_PREFIX = 'schooldoc_teacher_profile_v1:';

const isSelectedSchool = (value: unknown): value is SelectedSchool => {
  if (!value || typeof value !== 'object') return false;
  const school = value as Partial<SelectedSchool>;
  return typeof school.name === 'string'
    && typeof school.officeCode === 'string'
    && typeof school.schoolCode === 'string';
};

export const profileStorageKey = (userId: string) => `${PROFILE_STORAGE_PREFIX}${userId}`;

export const loadTeacherProfile = (
  userId: string,
  fallbackName: string,
  storage: Pick<Storage, 'getItem'> = window.localStorage,
): TeacherProfileSettings => {
  const fallback: TeacherProfileSettings = { school: null, teacherName: fallbackName, gradeClass: '' };
  if (!userId) return fallback;
  try {
    const parsed = JSON.parse(storage.getItem(profileStorageKey(userId)) ?? 'null') as Partial<TeacherProfileSettings> | null;
    if (!parsed) return fallback;
    return {
      school: isSelectedSchool(parsed.school) ? parsed.school : null,
      teacherName: typeof parsed.teacherName === 'string' ? parsed.teacherName : fallbackName,
      gradeClass: typeof parsed.gradeClass === 'string' ? parsed.gradeClass : '',
    };
  } catch {
    return fallback;
  }
};

export const saveTeacherProfile = (
  userId: string,
  profile: TeacherProfileSettings,
  storage: Pick<Storage, 'setItem'> = window.localStorage,
) => {
  if (!userId) return;
  try {
    storage.setItem(profileStorageKey(userId), JSON.stringify(profile));
  } catch {
    // 브라우저 저장 공간이 막혀도 입력 화면 자체는 계속 쓸 수 있어야 한다.
  }
};
