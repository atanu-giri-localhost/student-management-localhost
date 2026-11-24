import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Dashboard metric summary card.
 *
 * @param {{
 *   title: string,
 *   value: string | number,
 *   subtitle?: string,
 *   badgeText?: string,
 *   badgeVariant?: 'default' | 'success' | 'danger' | 'warning' | 'info' | 'primary',
 *   className?: string,
 * }} props
 */
export function StatCard({
  title,
  value,
  subtitle,
  badgeText,
  badgeVariant = 'default',
  className,
}) {
  return (
    <div className={cn('rounded-xl border border-slate-200 bg-white p-5 shadow-xs', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-slate-500">{title}</p>
        {badgeText ? <Badge variant={badgeVariant}>{badgeText}</Badge> : null}
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
      {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
    </div>
  );
}
