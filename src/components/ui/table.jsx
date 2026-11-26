import { cn } from '@/lib/utils';

export function Table({ className, children, ...props }) {
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <table className={cn('w-full min-w-full border-collapse text-left text-sm', className)} {...props}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ className, children, ...props }) {
  return (
    <thead className={cn('border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300', className)} {...props}>
      {children}
    </thead>
  );
}

export function TableBody({ className, children, ...props }) {
  return (
    <tbody className={cn('divide-y divide-slate-100 dark:divide-slate-800', className)} {...props}>
      {children}
    </tbody>
  );
}

export function TableRow({ className, children, ...props }) {
  return (
    <tr className={cn('transition hover:bg-slate-50/70 dark:hover:bg-slate-800/50', className)} {...props}>
      {children}
    </tr>
  );
}

export function TableHead({ className, children, ...props }) {
  return (
    <th scope="col" className={cn('px-4 py-3 whitespace-nowrap', className)} {...props}>
      {children}
    </th>
  );
}

export function TableCell({ className, children, ...props }) {
  return (
    <td className={cn('px-4 py-3 text-slate-700 dark:text-slate-300', className)} {...props}>
      {children}
    </td>
  );
}
