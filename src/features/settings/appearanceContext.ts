import { createContext, useContext } from 'react';
import type { AppearanceSettings, FontSizeSetting, ThemeId } from './appearanceSettings';

export interface AppearanceContextValue {
  settings: AppearanceSettings;
  setTheme: (themeId: ThemeId) => void;
  setFontSize: (fontSize: FontSizeSetting) => void;
}

export const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export const useAppearanceSettings = () => {
  const value = useContext(AppearanceContext);
  if (!value) throw new Error('useAppearanceSettings must be used within AppearanceProvider.');
  return value;
};
