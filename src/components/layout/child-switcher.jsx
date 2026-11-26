'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Parent Child Switcher dropdown for switching between linked children.
 *
 * @param {{
 *   children?: { id: string, name: string, className?: string }[],
 *   activeChildId?: string,
 *   onChange?: (childId: string) => void,
 *   className?: string,
 * }} props
 */
export function ParentChildSwitcher({ children: childList = [], activeChildId, onChange, className }) {
  const [isOpen, setIsOpen] = useState(false);
  const activeChild = childList.find((c) => c.id === activeChildId) ?? childList[0];

  if (!childList.length) {
    return null;
  }

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-blue-400 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-600 dark:hover:text-blue-300"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="text-xs text-slate-500 dark:text-slate-400">Child:</span>
        <span className="text-slate-900 dark:text-slate-100">{activeChild?.name ?? 'Select'}</span>
        <svg
          className={cn('h-4 w-4 transition-transform duration-150', isOpen && 'rotate-180')}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen ? (
        <div className="absolute z-50 mt-2 w-full min-w-[180px] rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <div role="listbox" className="p-1">
            {childList.map((child) => (
              <button
                key={child.id}
                type="button"
                role="option"
                aria-selected={child.id === activeChild?.id}
                onClick={() => {
                  onChange?.(child.id);
                  setIsOpen(false);
                }}
                className={cn(
                  'w-full rounded-lg px-3 py-2 text-left text-sm transition-colors',
                  child.id === activeChild?.id
                    ? 'bg-blue-50 font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-blue-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-blue-300',
                )}
              >
                {child.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}