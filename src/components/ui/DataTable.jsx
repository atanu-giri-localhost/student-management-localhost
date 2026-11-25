import { cn } from '@/lib/utils';

/**
 * Data table wrapper with horizontal overflow for long registers (attendance, fees).
 * Consumers add sticky header classes to TableHeader directly when needed.
 *
 * @param {{
 *   children: import('react').ReactNode,
 *   className?: string,
 * }} props
 */
export function DataTable({ children, className }) {
  return (
    <div
      className={cn(
        'w-full overflow-x-auto rounded-lg border border-slate-200 bg-white',
        className,
      )}
    >
      {children}
    </div>
  );
}
