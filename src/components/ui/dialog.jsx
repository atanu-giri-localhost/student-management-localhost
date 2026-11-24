'use client';

import { useEffect } from 'react';
import { cn } from '@/lib/utils';

/**
 * Accessible modal dialog with Escape key close and backdrop dismissal.
 *
 * @param {{
 *   open: boolean,
 *   onClose?: () => void,
 *   title: string,
 *   description?: string,
 *   className?: string,
 *   children?: import('react').ReactNode,
 * }} props
 */
export function Dialog({ open, onClose, title, description, className, children }) {
  useEffect(() => {
    if (!open || !onClose) return undefined;

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close modal overlay"
        onClick={() => onClose?.()}
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-[1px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative z-10 w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl',
          className
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <span aria-hidden="true">✕</span>
            </button>
          ) : null}
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
