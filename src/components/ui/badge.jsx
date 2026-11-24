import { cn } from '@/lib/utils';

const BADGE_VARIANTS = {
  default: 'border-slate-200 bg-slate-100 text-slate-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  danger: 'border-rose-200 bg-rose-50 text-rose-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  info: 'border-purple-200 bg-purple-50 text-purple-700',
  primary: 'border-indigo-200 bg-indigo-50 text-indigo-700',
};

/**
 * Status badge matching FRONTEND_AND_UI_SPEC status accents.
 *
 * @param {{
 *   variant?: 'default' | 'success' | 'danger' | 'warning' | 'info' | 'primary',
 *   className?: string,
 *   children?: import('react').ReactNode,
 * } & Record<string, unknown>} props
 */
export function Badge({ variant = 'default', className, children, ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        BADGE_VARIANTS[variant] ?? BADGE_VARIANTS.default,
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
