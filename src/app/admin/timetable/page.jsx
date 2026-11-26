'use client';

import { ErrorBanner } from '@/components/data-display/error-banner';
import { EmptyState } from '@/components/data-display/empty-state';
import { LoadingSkeleton } from '@/components/data-display/loading-skeleton';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { StatCard } from '@/components/data-display/stat-card';
import { PortalShell } from '@/components/layout/portal-shell';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useSession } from '@/lib/auth/use-session';
import { useApiList } from '@/lib/auth/use-api-list';

export default function AdminTimetablePage() {
  const { sessionData, loading: sessionLoading, errorMsg: sessionError, handleRetry, handleLogout } = useSession();
  const { data: calendar, total, loading, errorMsg, reload } = useApiList('/api/v1/timetable/calendar?pageSize=50');

  if (sessionLoading) {
    return (
      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6">
        <LoadingSkeleton rows={4} />
      </main>
    );
  }

  if (sessionError || !sessionData) {
    return (
      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6">
        <ErrorBanner title="Session check failed" message={sessionError || 'Please sign in again.'} onRetry={handleRetry} />
      </main>
    );
  }

  const primaryRole = sessionData.roles?.[0] || 'SUPER_ADMIN';
  const isSuperAdmin = primaryRole === 'SUPER_ADMIN';

  return (
    <PortalShell
      roleName={primaryRole}
      roleLabel={isSuperAdmin ? 'Super Administrator' : 'Administrator'}
      pageTitle="Timetable"
      activePath="/admin/timetable"
      userLabel={sessionData.user.phoneNormalized}
      onLogout={handleLogout}
    >
      <div className="space-y-6">
        <SectionHeader title="Timetable" description="Academic calendar, rooms, and schedule configuration." />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Calendar Entries" value={loading ? '—' : total} subtitle="Academic calendar" />
          <StatCard title="Loaded" value={loading ? '—' : calendar.length} subtitle="On this page" />
          <StatCard title="Source" value="D1" subtitle="DB_TIMETABLE" />
          <StatCard title="Mode" value="Live" subtitle="Request-scoped" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Academic Calendar</CardTitle>
            <CardDescription>Calendar entries (holidays, events, exam days).</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4"><LoadingSkeleton rows={4} /></div>
            ) : errorMsg ? (
              <div className="p-4"><ErrorBanner title="Could not load calendar" message={errorMsg} onRetry={reload} /></div>
            ) : calendar.length === 0 ? (
              <div className="p-4"><EmptyState title="No calendar entries" description="Academic calendar entries will appear here once added." /></div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full min-w-full border-collapse text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Day Type</th>
                      <th className="px-4 py-3">Title</th>
                      <th className="px-4 py-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {calendar.map((c) => (
                      <tr key={c.id} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">{c.calendarDate}</td>
                        <td className="px-4 py-3"><Badge variant={c.dayType === 'HOLIDAY' ? 'warning' : 'info'}>{c.dayType}</Badge></td>
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{c.title || '—'}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{c.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PortalShell>
  );
}