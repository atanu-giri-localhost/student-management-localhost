import { cn } from '@/lib/utils';

/**
 * Standard empty-state card for tables, rosters, and report lists.
 *
 * @param {{
 *   title: string,
 *   description?: string,
 *   action?: import('react').ReactNode,
 *   className?: string,
 * }} props
 */
export function EmptyState({ title, description, action, className }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-900',
        className
      )}
    >
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {description ? <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
