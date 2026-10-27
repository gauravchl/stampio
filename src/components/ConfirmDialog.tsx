import { useEffect, useRef, type ReactNode } from 'react';

/** iOS-style alert: title, message, and Cancel / destructive action side by side. */
export default function ConfirmDialog({ title, message, confirmLabel = 'Delete', onConfirm, onCancel }: {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const cancel = useRef(onCancel);
  cancel.current = onCancel;

  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cancelRef.current?.focus();
    // Capture phase, so Escape closes only this dialog and not a sheet underneath.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      cancel.current();
    };
    addEventListener('keydown', onKey, true);
    return () => {
      document.body.style.overflow = prevOverflow;
      removeEventListener('keydown', onKey, true);
      prevFocus?.focus?.();
    };
  }, []);

  return (
    <div className="alert-backdrop">
      <div className="alert" role="alertdialog" aria-modal="true" aria-labelledby="alert-title" aria-describedby={message ? 'alert-message' : undefined}>
        <div className="alert-text">
          <h2 id="alert-title">{title}</h2>
          {message && <p id="alert-message">{message}</p>}
        </div>
        <div className="alert-actions">
          <button ref={cancelRef} onClick={onCancel}>Cancel</button>
          <button className="destructive" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
