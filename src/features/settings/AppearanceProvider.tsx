import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppearanceContext } from './appearanceContext';
import {
  APPEARANCE_STORAGE_KEY,
  applyAppearanceSettings,
  loadAppearanceSettings,
  normalizeAppearanceSettings,
  saveAppearanceSettings,
  type AppearanceSettings,
  type FontSizeSetting,
  type ThemeId,
} from './appearanceSettings';

export function AppearanceProvider({ children, initialSettings }: {
  children: ReactNode;
  initialSettings?: AppearanceSettings;
}) {
  const [settings, setSettings] = useState<AppearanceSettings>(() => initialSettings ?? loadAppearanceSettings());

  useEffect(() => {
    applyAppearanceSettings(settings);
    saveAppearanceSettings(settings);
  }, [settings]);

  useEffect(() => {
    const syncFromAnotherTab = (event: StorageEvent) => {
      if (event.key !== APPEARANCE_STORAGE_KEY) return;
      try {
        setSettings(normalizeAppearanceSettings(JSON.parse(event.newValue ?? 'null')));
      } catch {
        setSettings(normalizeAppearanceSettings(null));
      }
    };
    window.addEventListener('storage', syncFromAnotherTab);
    return () => window.removeEventListener('storage', syncFromAnotherTab);
  }, []);

  const value = useMemo(() => ({
    settings,
    setTheme: (themeId: ThemeId) => setSettings((current) => ({ ...current, themeId })),
    setFontSize: (fontSize: FontSizeSetting) => setSettings((current) => ({ ...current, fontSize })),
  }), [settings]);

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}
