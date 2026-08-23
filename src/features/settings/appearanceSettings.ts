export type FontSizeSetting = 'normal' | 'large';

export interface ThemeColors {
  accent: string;
  accentHover: string;
  accentSoft: string;
  canvas: string;
  surface: string;
  surfaceHover: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  border: string;
  borderStrong: string;
  divider: string;
  disabled: string;
}

export interface SchooldocTheme {
  id: string;
  name: string;
  description: string;
  tone: 'light' | 'dark';
  colors: ThemeColors;
}

/**
 * Color Hunt의 팔레트처럼 색 네다섯 개가 한 분위기를 이루되, 업무 화면에서 흰 글자와
 * 조합하는 강조색은 충분히 어둡게 골랐다. 상태(성공·경고·오류) 색은 테마가 덮지 않는다.
 */
export const SCHOOLDOC_THEMES = [
  {
    id: 'schooldoc-blue', name: '스쿨독 블루', description: '기본 업무 화면', tone: 'light',
    colors: { accent: '#0F6CBD', accentHover: '#0B5B9F', accentSoft: '#EFF6FC', canvas: '#F6F8FB', surface: '#FFFFFF', surfaceHover: '#F8FBFE', text: '#0F172A', textMuted: '#526174', textSubtle: '#64748B', border: '#DCE3EA', borderStrong: '#C8D0DA', divider: '#EEF1F4', disabled: '#AAB7C4' },
  },
  {
    id: 'navy-office', name: '네이비 오피스', description: '차분한 남색', tone: 'light',
    colors: { accent: '#274C77', accentHover: '#1B3657', accentSoft: '#E7EEF6', canvas: '#F4F7FA', surface: '#FFFFFF', surfaceHover: '#F0F5F9', text: '#102A43', textMuted: '#486581', textSubtle: '#627D98', border: '#D5E0EA', borderStrong: '#B8C8D8', divider: '#E9EFF4', disabled: '#9FB3C8' },
  },
  {
    id: 'ocean-teal', name: '오션 틸', description: '맑은 청록', tone: 'light',
    colors: { accent: '#0F766E', accentHover: '#115E59', accentSoft: '#CCFBF1', canvas: '#F0F7F6', surface: '#FFFFFF', surfaceHover: '#ECF7F5', text: '#133331', textMuted: '#3F625E', textSubtle: '#5F7D79', border: '#CFE1DE', borderStrong: '#ABC9C4', divider: '#E4EFED', disabled: '#91AAA6' },
  },
  {
    id: 'fresh-mint', name: '프레시 민트', description: '산뜻한 초록', tone: 'light',
    colors: { accent: '#047857', accentHover: '#065F46', accentSoft: '#D1FAE5', canvas: '#F2F8F5', surface: '#FFFFFF', surfaceHover: '#EDF8F2', text: '#17352A', textMuted: '#47695C', textSubtle: '#648175', border: '#D2E4DC', borderStrong: '#AFCDC0', divider: '#E7F0EC', disabled: '#94ADA3' },
  },
  {
    id: 'forest', name: '포레스트', description: '깊은 숲색', tone: 'light',
    colors: { accent: '#3A5A40', accentHover: '#2F4934', accentSoft: '#E2ECE3', canvas: '#F5F7F2', surface: '#FFFFFF', surfaceHover: '#F0F4ED', text: '#1E2D21', textMuted: '#4F6252', textSubtle: '#6B7C6D', border: '#D7E0D4', borderStrong: '#BCCBBB', divider: '#E9EEE7', disabled: '#9AAA9A' },
  },
  {
    id: 'sage', name: '세이지', description: '부드러운 잎색', tone: 'light',
    colors: { accent: '#5F7161', accentHover: '#4B5C4D', accentSoft: '#E8EEE6', canvas: '#F7F8F3', surface: '#FFFFFF', surfaceHover: '#F1F4ED', text: '#29302A', textMuted: '#5B675C', textSubtle: '#748075', border: '#DDE3D9', borderStrong: '#C3CDC0', divider: '#ECEFEA', disabled: '#A3ADA0' },
  },
  {
    id: 'gold', name: '골드', description: '따뜻한 금빛', tone: 'light',
    colors: { accent: '#9A6700', accentHover: '#76520E', accentSoft: '#FFF1C2', canvas: '#FFFBF0', surface: '#FFFFFF', surfaceHover: '#FFF7E0', text: '#33270F', textMuted: '#6C5A31', textSubtle: '#85734C', border: '#E8DDC2', borderStrong: '#D5C49C', divider: '#F2EBDC', disabled: '#B5A888' },
  },
  {
    id: 'amber', name: '앰버', description: '선명한 주황빛', tone: 'light',
    colors: { accent: '#B45309', accentHover: '#92400E', accentSoft: '#FFEDD5', canvas: '#FFF7ED', surface: '#FFFFFF', surfaceHover: '#FFF2E2', text: '#3B2515', textMuted: '#73543D', textSubtle: '#8A6C55', border: '#EAD6C4', borderStrong: '#D7BDA4', divider: '#F3E6DA', disabled: '#B7A08C' },
  },
  {
    id: 'coral', name: '코랄', description: '활기찬 산호색', tone: 'light',
    colors: { accent: '#C2413B', accentHover: '#A1322D', accentSoft: '#FDE8E7', canvas: '#FFF7F6', surface: '#FFFFFF', surfaceHover: '#FFF0EF', text: '#3A2020', textMuted: '#75504E', textSubtle: '#8D6967', border: '#EBCFCD', borderStrong: '#D9B1AE', divider: '#F3E3E2', disabled: '#B99B99' },
  },
  {
    id: 'rose', name: '로즈', description: '단정한 장밋빛', tone: 'light',
    colors: { accent: '#BE3455', accentHover: '#9F2744', accentSoft: '#FCE7EE', canvas: '#FFF7FA', surface: '#FFFFFF', surfaceHover: '#FFF0F4', text: '#3B1F28', textMuted: '#76505C', textSubtle: '#8F6873', border: '#EACFD7', borderStrong: '#D8AFBB', divider: '#F3E3E8', disabled: '#B99AA3' },
  },
  {
    id: 'plum', name: '플럼', description: '우아한 자주색', tone: 'light',
    colors: { accent: '#7E3F8F', accentHover: '#663073', accentSoft: '#F3E8F7', canvas: '#FBF7FC', surface: '#FFFFFF', surfaceHover: '#F7EFF9', text: '#302034', textMuted: '#655169', textSubtle: '#7D697F', border: '#E2D4E5', borderStrong: '#CAB7CF', divider: '#EEE6F0', disabled: '#A798AA' },
  },
  {
    id: 'violet', name: '바이올렛', description: '또렷한 보라색', tone: 'light',
    colors: { accent: '#6D4CC5', accentHover: '#5536A8', accentSoft: '#EEE8FC', canvas: '#F8F6FD', surface: '#FFFFFF', surfaceHover: '#F3EFFB', text: '#29223A', textMuted: '#5E5571', textSubtle: '#776E87', border: '#DDD7E9', borderStrong: '#C4B9D8', divider: '#EBE7F1', disabled: '#A39BAD' },
  },
  {
    id: 'indigo', name: '인디고', description: '집중되는 남보라', tone: 'light',
    colors: { accent: '#4338CA', accentHover: '#3730A3', accentSoft: '#E0E7FF', canvas: '#F5F6FF', surface: '#FFFFFF', surfaceHover: '#EEF0FF', text: '#20213C', textMuted: '#515674', textSubtle: '#6B708A', border: '#D5D9EA', borderStrong: '#B7BED7', divider: '#E7E9F2', disabled: '#989EB5' },
  },
  {
    id: 'sky', name: '스카이', description: '시원한 하늘색', tone: 'light',
    colors: { accent: '#0369A1', accentHover: '#075985', accentSoft: '#E0F2FE', canvas: '#F4FAFD', surface: '#FFFFFF', surfaceHover: '#ECF7FC', text: '#153143', textMuted: '#496678', textSubtle: '#648092', border: '#D0E2EB', borderStrong: '#AECBD9', divider: '#E5EFF4', disabled: '#91AAB7' },
  },
  {
    id: 'lavender', name: '라벤더', description: '편안한 연보라', tone: 'light',
    colors: { accent: '#6B5B95', accentHover: '#554779', accentSoft: '#ECE8F5', canvas: '#F8F6FB', surface: '#FFFFFF', surfaceHover: '#F2EFF8', text: '#2B2737', textMuted: '#5E586B', textSubtle: '#777181', border: '#DDD9E6', borderStrong: '#C4BDD2', divider: '#ECE9F0', disabled: '#A49DAD' },
  },
  {
    id: 'beige', name: '웜 베이지', description: '포근한 종이색', tone: 'light',
    colors: { accent: '#795548', accentHover: '#5D4037', accentSoft: '#EFEBE9', canvas: '#FAF7F2', surface: '#FFFCF7', surfaceHover: '#F7F0E8', text: '#2D2522', textMuted: '#665954', textSubtle: '#7F726D', border: '#E2D9D3', borderStrong: '#CBBDB5', divider: '#EEE8E3', disabled: '#A99D97' },
  },
  {
    id: 'vintage', name: '빈티지 브라운', description: '차분한 오래된 책', tone: 'light',
    colors: { accent: '#7A4E2D', accentHover: '#5E3B22', accentSoft: '#EFE3D1', canvas: '#F7F0E5', surface: '#FFFBF5', surfaceHover: '#F3E8D8', text: '#2F241B', textMuted: '#685747', textSubtle: '#806F5F', border: '#E0D2C1', borderStrong: '#C8B59E', divider: '#ECE3D7', disabled: '#A99A89' },
  },
  {
    id: 'slate', name: '슬레이트', description: '무채색 업무 화면', tone: 'light',
    colors: { accent: '#475569', accentHover: '#334155', accentSoft: '#E2E8F0', canvas: '#F1F5F9', surface: '#FFFFFF', surfaceHover: '#EAF0F5', text: '#0F172A', textMuted: '#475569', textSubtle: '#64748B', border: '#CBD5E1', borderStrong: '#94A3B8', divider: '#E2E8F0', disabled: '#94A3B8' },
  },
  {
    id: 'midnight', name: '미드나이트', description: '깊은 남색 야간 화면', tone: 'dark',
    colors: { accent: '#2563EB', accentHover: '#1D4ED8', accentSoft: '#172554', canvas: '#0B1220', surface: '#111827', surfaceHover: '#172033', text: '#F8FAFC', textMuted: '#CBD5E1', textSubtle: '#94A3B8', border: '#334155', borderStrong: '#475569', divider: '#1F2937', disabled: '#475569' },
  },
  {
    id: 'deep-forest', name: '딥 포레스트', description: '짙은 초록 야간 화면', tone: 'dark',
    colors: { accent: '#047857', accentHover: '#065F46', accentSoft: '#0F3D34', canvas: '#091C18', surface: '#102820', surfaceHover: '#16372D', text: '#F1F5F2', textMuted: '#C3D5CC', textSubtle: '#8EA89B', border: '#365348', borderStrong: '#4C6B5F', divider: '#243D33', disabled: '#4C6B5F' },
  },
] as const satisfies readonly SchooldocTheme[];

export type ThemeId = (typeof SCHOOLDOC_THEMES)[number]['id'];

export interface AppearanceSettings {
  themeId: ThemeId;
  fontSize: FontSizeSetting;
}

export const APPEARANCE_STORAGE_KEY = 'schooldoc_appearance_v1';
export const DEFAULT_APPEARANCE_SETTINGS: AppearanceSettings = { themeId: 'schooldoc-blue', fontSize: 'normal' };

const themeIds = new Set<string>(SCHOOLDOC_THEMES.map((theme) => theme.id));

export const isThemeId = (value: unknown): value is ThemeId => typeof value === 'string' && themeIds.has(value);

export const normalizeAppearanceSettings = (value: unknown): AppearanceSettings => {
  if (!value || typeof value !== 'object') return DEFAULT_APPEARANCE_SETTINGS;
  const candidate = value as Partial<AppearanceSettings>;
  return {
    themeId: isThemeId(candidate.themeId) ? candidate.themeId : DEFAULT_APPEARANCE_SETTINGS.themeId,
    fontSize: candidate.fontSize === 'large' ? 'large' : 'normal',
  };
};

export const loadAppearanceSettings = (storage: Pick<Storage, 'getItem'> = window.localStorage) => {
  try {
    return normalizeAppearanceSettings(JSON.parse(storage.getItem(APPEARANCE_STORAGE_KEY) ?? 'null'));
  } catch {
    return DEFAULT_APPEARANCE_SETTINGS;
  }
};

export const saveAppearanceSettings = (
  settings: AppearanceSettings,
  storage: Pick<Storage, 'setItem'> = window.localStorage,
) => {
  try {
    storage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // 개인정보가 아닌 편의 설정이다. 저장 공간이 막혀도 현재 화면 적용은 유지한다.
  }
};

export const getTheme = (themeId: ThemeId) => (
  SCHOOLDOC_THEMES.find((theme) => theme.id === themeId) ?? SCHOOLDOC_THEMES[0]
);

const colorVariables: Record<keyof ThemeColors, string> = {
  accent: '--sd-accent',
  accentHover: '--sd-accent-hover',
  accentSoft: '--sd-accent-soft',
  canvas: '--sd-canvas',
  surface: '--sd-surface',
  surfaceHover: '--sd-surface-hover',
  text: '--sd-text',
  textMuted: '--sd-text-muted',
  textSubtle: '--sd-text-subtle',
  border: '--sd-border',
  borderStrong: '--sd-border-strong',
  divider: '--sd-divider',
  disabled: '--sd-disabled',
};

export const applyAppearanceSettings = (
  settings: AppearanceSettings,
  root: Pick<HTMLElement, 'dataset' | 'style'> = document.documentElement,
) => {
  const theme = getTheme(settings.themeId);
  root.dataset.schooldocTheme = theme.id;
  root.dataset.schooldocFontSize = settings.fontSize;
  (Object.keys(theme.colors) as Array<keyof ThemeColors>).forEach((key) => {
    root.style.setProperty(colorVariables[key], theme.colors[key]);
  });
};
