import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserSettings, WeightUnit, ThemeMode } from '../types';
import { DEFAULT_SETTINGS, getUserSettings, saveUserSettings } from '../db';
import { sound } from '../utils/audio';

interface SettingsContextType {
  settings: UserSettings;
  updateSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
  isOnline: boolean;
  unit: WeightUnit;
  formatWeightValue: (weightKg: number) => string;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    async function load() {
      try {
        const s = await getUserSettings();
        setSettings(s);
        sound.setEnabled(s.soundEnabled, s.hapticsEnabled);
        applyTheme(s.theme);
      } catch (err) {
        console.error('Failed to load settings', err);
      }
    }
    load();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const applyTheme = (theme: ThemeMode) => {
    const root = document.documentElement;
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    } else if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  };

  const updateSettings = async (newSettings: Partial<UserSettings>) => {
    const updated = await saveUserSettings(newSettings);
    setSettings(updated);
    sound.setEnabled(updated.soundEnabled, updated.hapticsEnabled);
    if (newSettings.theme) {
      applyTheme(newSettings.theme);
    }
  };

  const formatWeightValue = (weightKg: number): string => {
    if (settings.units === 'lb') {
      const lb = Math.round(weightKg * 2.20462 * 10) / 10;
      return `${lb} lb`;
    }
    return `${Number.isInteger(weightKg) ? weightKg : weightKg.toFixed(1)} kg`;
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSettings,
        isOnline,
        unit: settings.units,
        formatWeightValue,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
};
