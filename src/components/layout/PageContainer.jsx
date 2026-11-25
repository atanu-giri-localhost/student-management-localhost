import { cn } from '@/lib/utils';

/**
 * Standardized page container.
 *
 * Centers content within a consistent max-width scale and applies uniform
 * horizontal padding so pages stop hand-rolling `mx-auto max-w-* px-*`.
 *
 * @param {{
 *   children: import('react').ReactNode,
 *   className?: string,
 *   size?: 'compact' | 'standard' | 'wide',
 *   padding?: 'default' | 'none' | 'loose',
 * }} props
 */
export function PageContainer({
  children,
  className,
  size = 'standard',
  padding = 'default',
}) {
  const MAX_W = {
    compact: 'max-w-3xl',
    standard: 'max-w-5xl',
    wide: 'max-w-7xl',
  };

  const PADDING = {
    default: 'px-4 sm:px-6 py-6',
    none: 'px-4 sm:px-6',
    loose: 'px-4 sm:px-6 py-10',
  };

  return (
    <div
      className={cn(
        'mx-auto w-full',
        MAX_W[size],
        PADDING[padding],
        className,
      )}
    >
      {children}
    </div>
  );
}
