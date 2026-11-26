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

export default function AdminAttendancePage() {
  const { sessionData, loading: sessionLoading, errorMsg: sessionError, handleRetry, handleLogout } = useSession();
  const summary = useApiList('/api/v1/attendance/summary?pageSize=50');
  const registers = useApiList('/api/v1/attendance/daily/registers?pageSize=50');

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
  const loading = summary.loading || registers.loading;
  const avgPct = summary.data.length
    ? Math.round(summary.data.reduce((s, r) => s + r.attendancePercentage, 0) / summary.data.length)
    : 0;

  return (
    <PortalShell
      roleName={primaryRole}
      roleLabel={isSuperAdmin ? 'Super Administrator' : 'Administrator'}
      pageTitle="Attendance"
      activePath="/admin/attendance"
      userLabel={sessionData.user.phoneNormalized}
      onLogout={handleLogout}
    >
      <div className="space-y-6">
        <SectionHeader title="Attendance" description="Monitor dual attendance registers: daily and period-wise." />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Avg Attendance" value={loading ? '—' : `${avgPct}%`} subtitle="Across loaded records" />
          <StatCard title="Daily Registers" value={loading ? '—' : registers.total} subtitle="Total" />
          <StatCard title="Summaries" value={loading ? '—' : summary.total} subtitle="Enrollment rows" />
          <StatCard title="Source" value="D1" subtitle="DB_ATTENDANCE" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Attendance Summary</CardTitle>
            <CardDescription>Per-enrollment attendance breakdown.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {summary.loading ? (
              <div className="p-4"><LoadingSkeleton rows={4} /></div>
            ) : summary.errorMsg ? (
              <div className="p-4"><ErrorBanner title="Could not load summary" message={summary.errorMsg} onRetry={summary.reload} /></div>
            ) : summary.data.length === 0 ? (
              <div className="p-4"><EmptyState title="No attendance data" description="Attendance summaries appear once registers are marked." /></div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full min-w-full border-collapse text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Enrollment</th>
                      <th className="px-4 py-3">Present</th>
                      <th className="px-4 py-3">Absent</th>
                      <th className="px-4 py-3">Late</th>
                      <th className="px-4 py-3">Percentage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {summary.data.map((r) => (
                      <tr key={r.enrollmentId} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">{r.enrollmentId.slice(0, 8)}…</td>
                        <td className="px-4 py-3 text-emerald-600 dark:text-emerald-400">{r.presentCount}</td>
                        <td className="px-4 py-3 text-rose-600 dark:text-rose-400">{r.absentCount}</td>
                        <td className="px-4 py-3 text-amber-600 dark:text-amber-400">{r.lateCount}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">{r.attendancePercentage}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Daily Registers</CardTitle>
            <CardDescription>Daily attendance registers across classes.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {registers.loading ? (
              <div className="p-4"><LoadingSkeleton rows={3} /></div>
            ) : registers.errorMsg ? (
              <div className="p-4"><ErrorBanner title="Could not load registers" message={registers.errorMsg} onRetry={registers.reload} /></div>
            ) : registers.data.length === 0 ? (
              <div className="p-4"><EmptyState title="No daily registers" description="Daily registers appear once teachers mark attendance." /></div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full min-w-full border-collapse text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Class</th>
                      <th className="px-4 py-3">Locked</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {registers.data.map((r) => (
                      <tr key={r.id} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">{r.attendanceDate}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{r.classId?.slice(0, 8) ?? '—'}…</td>
                        <td className="px-4 py-3"><Badge variant={r.isLocked ? 'default' : 'success'}>{r.isLocked ? 'LOCKED' : 'OPEN'}</Badge></td>
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