import { useEffect, type ReactNode } from 'react';

/** iOS page sheet: grabber, Cancel on the left, title, and a bold confirm action on the right. */
export default function Sheet({ title, onClose, confirmLabel, confirmDisabled, formId, children }: {
  title: string;
  onClose: () => void;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  /** Id of the form the confirm button submits. */
  formId?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <div className="grabber" />
        <div className="sheet-nav">
          <button className="nav-btn" onClick={onClose}>Cancel</button>
          <h2>{title}</h2>
          {confirmLabel ? (
            <button className="nav-btn strong" type="submit" form={formId} disabled={confirmDisabled}>
              {confirmLabel}
            </button>
          ) : <span />}
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
