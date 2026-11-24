import { cn } from '@/lib/utils';

/**
 * Accessible select control styled to match Input tokens.
 *
 * @param {{
 *   className?: string,
 *   hasError?: boolean,
 *   children?: import('react').ReactNode,
 * } & Record<string, unknown>} props
 */
export function Select({ className, hasError = false, children, ...props }) {
  return (
    <select
      aria-invalid={hasError ? 'true' : undefined}
      className={cn(
        'flex h-10 w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
        'disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-60',
        hasError
          ? 'border-rose-400 focus-visible:ring-rose-500'
          : 'border-slate-300 focus-visible:ring-indigo-600',
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
