'use client';

import { useCallback, useState } from 'react';
import { cn } from '@/lib/utils';

const TOAST_STYLES = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  error: 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200',
  warning: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200',
  info: 'border-indigo-200 bg-indigo-50 text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-200',
};

/**
 * Accessible status/alert notification banner.
 *
 * @param {{
 *   variant?: 'success' | 'error' | 'warning' | 'info',
 *   title: string,
 *   message?: string,
 *   onDismiss?: () => void,
 *   className?: string,
 * }} props
 */
export function ToastBanner({ variant = 'info', title, message, onDismiss, className }) {
  const isAlert = variant === 'error' || variant === 'warning';

  return (
    <div
      role={isAlert ? 'alert' : 'status'}
      aria-live={isAlert ? 'assertive' : 'polite'}
      className={cn(
        'flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm shadow-xs',
        TOAST_STYLES[variant] ?? TOAST_STYLES.info,
        className
      )}
    >
      <div>
        <p className="font-semibold">{title}</p>
        {message ? <p className="mt-0.5 opacity-90">{message}</p> : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="rounded-md px-1.5 py-0.5 text-xs font-medium opacity-70 transition hover:opacity-100"
        >
          ✕
        </button>
      ) : null}
    </div>
  );
}

/**
 * Lightweight local toast state hook for forms and interactive sheets.
 */
export function useToastState() {
  const [toast, setToast] = useState(null);

  const showToast = useCallback((nextToast) => {
    setToast(nextToast);
  }, []);

  const clearToast = useCallback(() => {
    setToast(null);
  }, []);

  return { toast, showToast, clearToast };
}
