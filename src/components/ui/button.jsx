import { cn } from '@/lib/utils';

const VARIANT_CLASSES = {
  default: 'bg-indigo-600 text-white hover:bg-indigo-700 focus-visible:ring-indigo-600',
  secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 focus-visible:ring-slate-500',
  outline:
    'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-slate-500',
  ghost: 'text-slate-700 hover:bg-slate-100 focus-visible:ring-slate-500',
  destructive: 'bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-600',
};

const SIZE_CLASSES = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-6 text-sm',
};

/**
 * Accessible button component following Tailwind CSS v4 + shadcn/ui style tokens.
 *
 * @param {{
 *   variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive',
 *   size?: 'sm' | 'md' | 'lg',
 *   className?: string,
 *   type?: 'button' | 'submit' | 'reset',
 *   disabled?: boolean,
 *   children?: import('react').ReactNode
 * } & Record<string, unknown>} props
 */
export function Button({
  variant = 'default',
  size = 'md',
  className,
  type = 'button',
  disabled = false,
  children,
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.default,
        SIZE_CLASSES[size] ?? SIZE_CLASSES.md,
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
