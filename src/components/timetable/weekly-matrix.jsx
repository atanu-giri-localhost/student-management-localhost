'use client';

import { cn } from '@/lib/utils';

/**
 * Weekly timetable grid matrix — Mon–Sat columns, 1–8 period rows.
 *
 * @param {{
 *   schedule?: Record<string, { subject: string, room?: string, teacher?: string }>,
 *   className?: string,
 * }} props
 */
export function WeeklyMatrix({ schedule = {}, className }) {
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

  const SUBJECT_COLORS = {
    Mathematics: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300',
    Physics: 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300',
    Chemistry: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300',
    Biology: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300',
    English: 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300',
    Default: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300',
  };

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <div className="min-w-[640px]">
        <div className="grid grid-cols-[auto_repeat(6,1fr)] border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
          <div className="px-2 py-2 text-center text-xs font-semibold text-slate-600 dark:text-slate-400">Period</div>
          {DAYS.map((day) => (
            <div key={day} className="border-l border-slate-200 px-2 py-2 text-center text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-400">
              {day}
            </div>
          ))}
        </div>
        {PERIODS.map((period) => (
          <div key={period} className="grid grid-cols-[auto_repeat(6,1fr)] border-b border-slate-100 last:border-b-0 dark:border-slate-700">
            <div className="bg-slate-50 px-2 py-2 text-center text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              P{period}
            </div>
            {DAYS.map((day) => {
              const slot = schedule[`${day}-${period}`];
              return (
                <div key={`${day}-${period}`} className="border-l border-slate-100 px-1 py-1 dark:border-slate-700">
                  {slot ? (
                    <div
                      className={cn(
                        'rounded-lg border px-2 py-2 text-xs transition-colors',
                        SUBJECT_COLORS[slot.subject] ?? SUBJECT_COLORS.Default,
                      )}
                    >
                      <div className="text-center font-medium">{slot.subject}</div>
                      {slot.room ? (
                        <div className="text-center text-[10px] opacity-80">{slot.room}</div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-200 px-2 py-2 text-center text-xs text-slate-400 dark:border-slate-600 dark:text-slate-500">
                      Free
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}