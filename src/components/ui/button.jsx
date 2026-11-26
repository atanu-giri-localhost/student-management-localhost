import { cn } from '@/lib/utils';

const VARIANT_CLASSES = {
  default: 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] focus-visible:ring-blue-600',
  secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 active:scale-[0.98] focus-visible:ring-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
  outline:
    'border border-slate-300 bg-white text-slate-700 hover:border-blue-400 hover:text-blue-700 active:scale-[0.98] focus-visible:ring-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-600 dark:hover:text-blue-300',
  ghost: 'text-slate-700 hover:bg-slate-100 hover:text-blue-700 active:scale-[0.98] focus-visible:ring-blue-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-300',
  destructive: 'bg-rose-600 text-white hover:bg-rose-700 active:scale-[0.98] focus-visible:ring-rose-600',
};

const SIZE_CLASSES = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-sm',
};

/**
 * Shared button class builder so links can be styled as buttons without
 * nesting interactive elements.
 *
 * @param {{
 *   variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive',
 *   size?: 'sm' | 'md' | 'lg',
 *   className?: string,
 * }} [options]
 * @returns {string}
 */
export function buttonVariants({ variant = 'default', size = 'md', className } = {}) {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
    VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.default,
    SIZE_CLASSES[size] ?? SIZE_CLASSES.md,
    className
  );
}

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
      className={buttonVariants({ variant, size, className })}
      {...props}
    >
      {children}
    </button>
  );
}