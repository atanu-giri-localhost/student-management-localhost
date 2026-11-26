'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Rapid attendance entry sheet optimized for mobile/tablet roll call.
 *
 * @param {{
 *   students?: { id: string, roll: number, name: string, photoUrl?: string }[],
 *   onSave?: (records: Record<string, 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE'>) => void,
 *   className?: string,
 * }} props
 */
export function DailyRegister({ students = [], onSave, className }) {
  const [statuses, setStatuses] = useState({});
  const [hasChanges, setHasChanges] = useState(false);

  function setStatus(studentId, status) {
    setStatuses((prev) => ({ ...prev, [studentId]: status }));
    setHasChanges(true);
  }

  function markAll(status) {
    const next = {};
    for (const s of students) {
      next[s.id] = status;
    }
    setStatuses(next);
    setHasChanges(true);
  }

  function handleSave() {
    onSave?.(statuses);
    setHasChanges(false);
  }

  if (!students.length) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
        No students in this class.
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => markAll('PRESENT')}
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 dark:hover:bg-emerald-900"
          >
            Mark All Present
          </button>
          <button
            type="button"
            onClick={() => markAll('ABSENT')}
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300 dark:hover:bg-rose-900"
          >
            Mark All Absent
          </button>
        </div>
        <button
          type="button"
          disabled={!hasChanges}
          onClick={handleSave}
          className={cn(
            'rounded-lg px-4 py-2 text-xs font-medium transition-all duration-150',
            hasChanges
              ? 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]'
              : 'cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800',
          )}
        >
          Save Changes
        </button>
      </div>

      <div className="w-full overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <table className="w-full min-w-full border-collapse text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
            <tr>
              <th className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400">Roll</th>
              <th className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400">Student</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 dark:text-slate-400">P</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 dark:text-slate-400">A</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 dark:text-slate-400">L</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 dark:text-slate-400">Lv</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {students.map((student) => (
              <tr key={student.id} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{student.roll}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      {student.name.charAt(0)}
                    </div>
                    <span className="text-slate-700 dark:text-slate-300">{student.name}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-center">
                  <StatusButton
                    label="P"
                    active={statuses[student.id] === 'PRESENT'}
                    variant="success"
                    onClick={() => setStatus(student.id, 'PRESENT')}
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  <StatusButton
                    label="A"
                    active={statuses[student.id] === 'ABSENT'}
                    variant="danger"
                    onClick={() => setStatus(student.id, 'ABSENT')}
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  <StatusButton
                    label="L"
                    active={statuses[student.id] === 'LATE'}
                    variant="warning"
                    onClick={() => setStatus(student.id, 'LATE')}
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  <StatusButton
                    label="Lv"
                    active={statuses[student.id] === 'LEAVE'}
                    variant="primary"
                    onClick={() => setStatus(student.id, 'LEAVE')}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusButton({ label, active, variant, onClick }) {
  const VARIANTS = {
    success: active ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-200 text-slate-600 hover:border-emerald-400 hover:bg-emerald-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-emerald-950',
    danger: active ? 'border-rose-500 bg-rose-500 text-white' : 'border-slate-200 text-slate-600 hover:border-rose-400 hover:bg-rose-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-rose-950',
    warning: active ? 'border-amber-500 bg-amber-500 text-white' : 'border-slate-200 text-slate-600 hover:border-amber-400 hover:bg-amber-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-amber-950',
    primary: active ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-200 text-slate-600 hover:border-blue-400 hover:bg-blue-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-blue-950',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded-md border text-xs font-semibold transition-all duration-150 active:scale-90',
        VARIANTS[variant],
      )}
    >
      {label}
    </button>
  );
}