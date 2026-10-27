import { useEffect, useState, type ReactNode } from 'react';
import { useTheme } from '../theme';
import { MoonIcon, SunIcon } from './Icons';

/**
 * Compact iOS-style navigation bar: a left-aligned title with actions on the
 * right. It turns translucent once the page scrolls under it.
 */
export default function Header({ title, actions }: {
  title: ReactNode;
  actions?: ReactNode;
}) {
  const { theme, toggle } = useTheme();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <div className={`navbar ${scrolled ? 'compact' : ''}`}>
        <div className="navbar-inner">
          <h1 className="navbar-title">{title}</h1>
          <div className="navbar-actions">
            {actions}
            <button
              className="circle-btn" onClick={toggle}
              aria-label={theme === 'dark' ? 'Use light appearance' : 'Use dark appearance'}
            >
              {theme === 'dark' ? <SunIcon width={17} height={17} /> : <MoonIcon width={16} height={16} />}
            </button>
          </div>
        </div>
      </div>
      <div className="navbar-gap" />
    </>
  );
}
