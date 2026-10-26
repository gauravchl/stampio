import type { ReactNode } from 'react';

export default function Sheet({ title, onClose, children }: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="link" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}
