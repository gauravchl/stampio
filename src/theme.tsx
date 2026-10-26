import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { COLORS } from './store';

export type Theme = 'light' | 'dark';
const KEY = 'timestamp-app:theme';

// Same hues as COLORS (which are the dark-surface steps), stepped for a light surface.
const LIGHT_STEPS = [
  '#2a78d6', '#eb6834', '#1baf7a', '#eda100',
  '#e87ba4', '#008300', '#4a3aa7', '#e34948',
];

/** Activity colors are stored as the dark step; show the matching light step on light. */
export const displayColor = (hex: string, theme: Theme) => {
  if (theme === 'dark') return hex;
  const i = COLORS.indexOf(hex);
  return i >= 0 ? LIGHT_STEPS[i] : hex;
};

const Ctx = createContext<{ theme: Theme; toggle: () => void }>({ theme: 'light', toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  // index.html sets data-theme before first paint, so start from that.
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#000000' : '#f2f2f7');
    try { localStorage.setItem(KEY, theme); } catch { /* ignore */ }
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  return <Ctx.Provider value={{ theme, toggle }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
