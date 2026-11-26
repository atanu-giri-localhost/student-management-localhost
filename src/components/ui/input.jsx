import { cn } from '@/lib/utils';

/**
 * Accessible text input field.
 *
 * @param {{
 *   className?: string,
 *   type?: string,
 *   hasError?: boolean,
 * } & Record<string, unknown>} props
 */
export function Input({ className, type = 'text', hasError = false, ...props }) {
  return (
    <input
      type={type}
      aria-invalid={hasError ? 'true' : undefined}
      className={cn(
        'flex h-10 w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-colors dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
        'disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-60 dark:disabled:bg-slate-800',
        hasError
          ? 'border-rose-400 focus-visible:ring-rose-500'
          : 'border-slate-300 hover:border-slate-400 focus-visible:border-blue-500 focus-visible:ring-blue-600 dark:border-slate-700 dark:hover:border-slate-600',
        className
      )}
      {...props}
    />
  );
}