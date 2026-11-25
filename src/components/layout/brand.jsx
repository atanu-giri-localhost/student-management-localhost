import Link from 'next/link';
import { InstitutionIcon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

/**
 * Institute brand lockup used on public and authentication pages.
 *
 * @param {{
 *   href?: string,
 *   compact?: boolean,
 *   className?: string,
 * }} props
 */
export function Brand({ href = '/', compact = false, className }) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2',
        className
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
        <InstitutionIcon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold leading-tight text-slate-900 dark:text-slate-100">
          Apex Coaching Institute
        </span>
        {compact ? null : (
          <span className="mt-0.5 hidden truncate text-[11px] font-medium text-slate-500 sm:block dark:text-slate-400">
            Student Management System
          </span>
        )}
      </span>
    </Link>
  );
}
