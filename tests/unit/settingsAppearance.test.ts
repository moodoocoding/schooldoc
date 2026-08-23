import { describe, expect, test } from 'vitest';
import {
  APPEARANCE_STORAGE_KEY,
  DEFAULT_APPEARANCE_SETTINGS,
  SCHOOLDOC_THEMES,
  applyAppearanceSettings,
  loadAppearanceSettings,
  normalizeAppearanceSettings,
  saveAppearanceSettings,
} from '../../src/features/settings/appearanceSettings';
import {
  loadTeacherProfile,
  profileStorageKey,
  saveTeacherProfile,
} from '../../src/features/settings/profileSettings';

const memoryStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    values,
  };
};

describe('설정 화면 테마와 글자 크기', () => {
  test('서로 다른 20개 테마를 제공한다', () => {
    expect(SCHOOLDOC_THEMES).toHaveLength(20);
    expect(new Set(SCHOOLDOC_THEMES.map((theme) => theme.id))).toHaveLength(20);
    expect(new Set(SCHOOLDOC_THEMES.map((theme) => theme.name))).toHaveLength(20);
    expect(SCHOOLDOC_THEMES.filter((theme) => theme.tone === 'dark')).toHaveLength(2);
  });

  test('알 수 없는 저장값은 기본 설정으로 안전하게 되돌린다', () => {
    expect(normalizeAppearanceSettings({ themeId: 'missing', fontSize: 'huge' }))
      .toEqual(DEFAULT_APPEARANCE_SETTINGS);
    expect(normalizeAppearanceSettings({ themeId: 'ocean-teal', fontSize: 'large' }))
      .toEqual({ themeId: 'ocean-teal', fontSize: 'large' });
  });

  test('선택을 저장하고 다시 불러오며 CSS 변수로 적용한다', () => {
    const storage = memoryStorage();
    const settings = { themeId: 'deep-forest', fontSize: 'large' } as const;
    saveAppearanceSettings(settings, storage);

    expect(storage.values.has(APPEARANCE_STORAGE_KEY)).toBe(true);
    expect(loadAppearanceSettings(storage)).toEqual(settings);

    const variables = new Map<string, string>();
    const root = {
      dataset: {} as DOMStringMap,
      style: { setProperty: (name: string, value: string) => variables.set(name, value) },
    } as unknown as HTMLElement;
    applyAppearanceSettings(settings, root);

    expect(root.dataset.schooldocTheme).toBe('deep-forest');
    expect(root.dataset.schooldocFontSize).toBe('large');
    expect(variables.get('--sd-accent')).toBe('#047857');
    expect(variables.get('--sd-canvas')).toBe('#091C18');
  });
});

describe('교사 프로필 설정', () => {
  test('계정별로 NEIS 학교 코드와 프로필을 저장한다', () => {
    const storage = memoryStorage();
    const profile = {
      school: { name: '청주소로초등학교', officeCode: 'M10', schoolCode: '1234567' },
      teacherName: '김태호',
      gradeClass: '6학년 1반 담임',
    };

    saveTeacherProfile('teacher-a', profile, storage);

    expect(storage.values.has(profileStorageKey('teacher-a'))).toBe(true);
    expect(loadTeacherProfile('teacher-a', '기본 이름', storage)).toEqual(profile);
    expect(loadTeacherProfile('teacher-b', '다른 교사', storage)).toEqual({
      school: null,
      teacherName: '다른 교사',
      gradeClass: '',
    });
  });
});
