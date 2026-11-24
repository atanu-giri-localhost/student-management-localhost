import { cn } from '@/lib/utils';

/**
 * Accessible form field label.
 *
 * @param {{
 *   htmlFor?: string,
 *   required?: boolean,
 *   className?: string,
 *   children?: import('react').ReactNode,
 * } & Record<string, unknown>} props
 */
export function Label({ htmlFor, required = false, className, children, ...props }) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn('block text-xs font-medium text-slate-700', className)}
      {...props}
    >
      {children}
      {required ? <span className="ml-0.5 text-rose-600" aria-hidden="true">*</span> : null}
    </label>
  );
}
