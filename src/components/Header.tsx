import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTheme } from '../theme';
import { MoonIcon, SunIcon } from './Icons';

/**
 * iOS-style navigation bar: a large title that scrolls away, after which a
 * compact centered title fades in over a translucent bar.
 */
export default function Header({ title, sub, actions }: {
  title: string;
  sub?: ReactNode;
  actions?: ReactNode;
}) {
  const { theme, toggle } = useTheme();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setCompact(!e.isIntersecting), {
      rootMargin: '-52px 0px 0px 0px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <div className={`navbar ${compact ? 'compact' : ''}`}>
        <div className="navbar-inner">
          <span className="navbar-title">{title}</span>
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
      <div className="large-title">
        {sub && <p className="eyebrow">{sub}</p>}
        <h1 ref={titleRef}>{title}</h1>
      </div>
    </>
  );
}
