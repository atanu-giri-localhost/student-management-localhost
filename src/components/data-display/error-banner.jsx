import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Accessible error state alert banner with optional retry button.
 *
 * @param {{
 *   title?: string,
 *   message: string,
 *   requestId?: string,
 *   onRetry?: () => void,
 *   className?: string,
 * }} props
 */
export function ErrorBanner({
  title = 'Something went wrong',
  message,
  requestId,
  onRetry,
  className,
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 sm:flex-row sm:items-center',
        className
      )}
    >
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 text-rose-800">{message}</p>
        {requestId ? (
          <p className="mt-1 font-mono text-xs text-rose-700">Reference ID: {requestId}</p>
        ) : null}
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry} className="shrink-0 bg-white">
          Try again
        </Button>
      ) : null}
    </div>
  );
}
