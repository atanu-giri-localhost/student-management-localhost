import { cn } from '@/lib/utils';

/**
 * Consistent section header: title, optional description, optional right action.
 *
 * Replaces ad-hoc `<h1>` + `<p>` combinations across pages.
 *
 * @param {{
 *   title: string,
 *   description?: string,
 *   action?: import('react').ReactNode,
 *   className?: string,
 * }} props
 */
export function SectionHeader({ title, description, action, className }) {
  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4 border-b border-slate-100 pb-4 mb-6',
        className,
      )}
    >
      <div>
        <h2 className="text-lg font-semibold text-slate-900 tracking-tight">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-4 sm:mt-0">{action}</div> : null}
    </div>
  );
}
