import type { SelectedSchool } from '../specialRooms/types';
import { supabase } from '../../utils/supabaseClient';
import type { User } from '@supabase/supabase-js';

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
  user?: User | null,
  storage: Pick<Storage, 'getItem'> = window.localStorage,
): TeacherProfileSettings => {
  const fallback: TeacherProfileSettings = {
    school: (user?.user_metadata?.school && isSelectedSchool(user.user_metadata.school))
      ? user.user_metadata.school
      : null,
    teacherName: typeof user?.user_metadata?.full_name === 'string' && user.user_metadata.full_name
      ? user.user_metadata.full_name
      : (typeof user?.user_metadata?.name === 'string' && user.user_metadata.name ? user.user_metadata.name : fallbackName),
    gradeClass: typeof user?.user_metadata?.grade_class === 'string'
      ? user.user_metadata.grade_class
      : (typeof user?.user_metadata?.gradeClass === 'string' ? user.user_metadata.gradeClass : ''),
  };

  if (!userId) return fallback;

  try {
    const raw = storage.getItem(profileStorageKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<TeacherProfileSettings> | null;
      if (parsed) {
        return {
          school: isSelectedSchool(parsed.school) ? parsed.school : fallback.school,
          teacherName: typeof parsed.teacherName === 'string' && parsed.teacherName ? parsed.teacherName : fallback.teacherName,
          gradeClass: typeof parsed.gradeClass === 'string' && parsed.gradeClass ? parsed.gradeClass : fallback.gradeClass,
        };
      }
    }
    return fallback;
  } catch {
    return fallback;
  }
};

export const saveTeacherProfile = async (
  userId: string,
  profile: TeacherProfileSettings,
  storage: Pick<Storage, 'setItem'> = window.localStorage,
) => {
  if (!userId) return;

  // 1. 로컬 스토리지에 캐시
  try {
    storage.setItem(profileStorageKey(userId), JSON.stringify(profile));
  } catch {
    // ignore local storage errors
  }

  // 2. Supabase 원격 계정 메타데이터에 영구 저장 (웹과 앱 간 100% 동기화)
  if (supabase) {
    try {
      await supabase.auth.updateUser({
        data: {
          school: profile.school,
          grade_class: profile.gradeClass,
          gradeClass: profile.gradeClass,
          full_name: profile.teacherName,
          name: profile.teacherName,
        },
      });
    } catch (err) {
      console.warn('Supabase 원격 프로필 동기화 실패 (로컬 저장은 완료됨):', err);
    }
  }
};
