import { cn } from '@/lib/utils';

/**
 * Dashboard metric summary card. The value is the visual anchor (large type);
 * the title is a quiet label above it, and the subtitle adds specifics below.
 *
 * @param {{
 *   title: string,
 *   value: string | number,
 *   subtitle?: string,
 *   className?: string,
 * }} props
 */
export function StatCard({ title, value, subtitle, className }) {
  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700',
        className
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-100">{value}</p>
      {subtitle ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
    </div>
  );
}