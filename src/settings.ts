import { useEffect, useState } from 'react';

export interface Settings {
  /** Hour of day (0–23) each Trends chart day starts at. Logs before it count toward the previous day. */
  dayStartHour: number;
}

const SETTINGS_KEY = 'timestamp-app:settings';
const DEFAULTS: Settings = { dayStartHour: 4 };

export function loadSettings(): Settings {
  try {
    const v = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') } as Settings;
    if (Number.isInteger(v.dayStartHour) && v.dayStartHour >= 0 && v.dayStartHour < 24) return v;
  } catch {
    // ignore
  }
  return DEFAULTS;
}

export function useSettings() {
  const [settings, setSettings] = useState(loadSettings);
  useEffect(() => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
  }, [settings]);
  const update = (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch }));
  return [settings, update] as const;
}
