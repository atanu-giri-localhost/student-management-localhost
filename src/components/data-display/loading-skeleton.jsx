import { cn } from '@/lib/utils';

/**
 * Reusable loading placeholder block for asynchronous cards and tables.
 *
 * @param {{ rows?: number, className?: string }} props
 */
export function LoadingSkeleton({ rows = 3, className }) {
  return (
    <div
      role="status"
      aria-label="Loading content"
      className={cn('space-y-3 rounded-xl border border-slate-200 bg-white p-5', className)}
    >
      <div className="h-4 w-1/3 animate-pulse rounded bg-slate-200" />
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-3.5 w-full animate-pulse rounded bg-slate-100" />
      ))}
    </div>
  );
}
