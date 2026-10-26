import type { ReactNode } from 'react';
import { useTheme } from '../theme';

export default function Header({ title, sub, children }: {
  title: string;
  sub?: ReactNode;
  children?: ReactNode;
}) {
  const { theme, toggle } = useTheme();
  return (
    <header className="header">
      <div>
        <h1>{title}</h1>
        {sub && <p className="sub">{sub}</p>}
      </div>
      <div className="header-actions">
        {children}
        <button
          className="icon-btn" onClick={toggle}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    </header>
  );
}
