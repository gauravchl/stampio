// Small line icons drawn to sit alongside SF Symbols.
import type { SVGProps } from 'react';

const base = (p: SVGProps<SVGSVGElement>) => ({
  width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  'aria-hidden': true, ...p,
});

export const TodayIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} stroke="none" fill="currentColor">
    <rect x="3" y="3" width="8" height="8" rx="2.2" />
    <rect x="13" y="3" width="8" height="8" rx="2.2" />
    <rect x="3" y="13" width="8" height="8" rx="2.2" />
    <rect x="13" y="13" width="8" height="8" rx="2.2" />
  </svg>
);

export const TrendsIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3.5 3.5v17h17" />
    <path d="M7 15.5l4-5 3.5 3L20 6.5" />
  </svg>
);

export const HistoryIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.2 2" />
  </svg>
);

export const PlusIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} strokeWidth={2.4}><path d="M12 5v14M5 12h14" /></svg>
);

export const CheckIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} strokeWidth={3}><path d="M5.5 12.5l4.2 4.2L18.5 8" /></svg>
);

export const ChevronRight = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} strokeWidth={2.4}><path d="M9.5 6l6 6-6 6" /></svg>
);

export const ChevronUpDown = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} strokeWidth={2.2}><path d="M8 9.5l4-4 4 4M8 14.5l4 4 4-4" /></svg>
);

export const ShareIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 3.5v11M8 7.5l4-4 4 4" />
    <path d="M7 10.5H6a1.5 1.5 0 0 0-1.5 1.5v7A1.5 1.5 0 0 0 6 20.5h12a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5h-1" />
  </svg>
);

export const ImportIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 3.5v11M8 10.5l4 4 4-4" />
    <path d="M4.5 15.5v3A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5v-3" />
  </svg>
);

export const MoonIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} stroke="none" fill="currentColor">
    <path d="M20.2 14.6A8.5 8.5 0 0 1 9.4 3.8a.6.6 0 0 0-.8-.7A9 9 0 1 0 20.9 15.4a.6.6 0 0 0-.7-.8z" />
  </svg>
);

export const SunIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="4" fill="currentColor" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
  </svg>
);
