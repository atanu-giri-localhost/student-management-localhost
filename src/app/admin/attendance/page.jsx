'use client';

import { ErrorBanner } from '@/components/data-display/error-banner';
import { LoadingSkeleton } from '@/components/data-display/loading-skeleton';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { StatCard } from '@/components/data-display/stat-card';
import { PortalShell } from '@/components/layout/portal-shell';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useSession } from '@/lib/auth/use-session';

const STATS = [
  { label: 'Today Present', value: '94%', subtitle: 'Across all classes' },
  { label: 'Absent', value: '6%', subtitle: 'Marked today' },
  { label: 'Registers', value: '36', subtitle: 'Daily + period' },
  { label: 'Pending Mark', value: '2', subtitle: 'Awaiting teacher' },
];

const DAILY = [
  { date: '2026-11-26', className: 'X-A', present: 41, absent: 2, total: 43 },
  { date: '2026-11-26', className: 'X-B', present: 40, absent: 2, total: 42 },
  { date: '2026-11-26', className: 'IX-A', present: 42, absent: 2, total: 44 },
  { date: '2026-11-26', className: 'IX-B', present: 39, absent: 2, total: 41 },
  { date: '2026-11-26', className: 'VIII-A', present: 41, absent: 1, total: 42 },
  { date: '2026-11-26', className: 'VIII-B', present: 38, absent: 2, total: 40 },
];

const PERIOD = [
  { period: 'P1', subject: 'Mathematics', marked: '18/18', status: 'COMPLETE' },
  { period: 'P2', subject: 'Science', marked: '18/18', status: 'COMPLETE' },
  { period: 'P3', subject: 'English', marked: '16/18', status: 'PENDING' },
  { period: 'P4', subject: 'Social Studies', marked: '17/18', status: 'PENDING' },
];

function periodVariant(status) {
  return status === 'COMPLETE' ? 'success' : 'warning';
}

export default function AdminAttendancePage() {
  const { sessionData, loading, errorMsg, handleRetry, handleLogout } = useSession();

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6">
        <LoadingSkeleton rows={4} />
      </main>
    );
  }

  if (errorMsg || !sessionData) {
    return (
      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6">
        <ErrorBanner
          title="Session check failed"
          message={errorMsg || 'Please sign in again.'}
          onRetry={handleRetry}
        />
      </main>
    );
  }

  const primaryRole = sessionData.roles?.[0] || 'SUPER_ADMIN';
  const isSuperAdmin = primaryRole === 'SUPER_ADMIN';

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
        <SectionHeader
          title="Attendance"
          description="Monitor dual attendance registers: daily and period-wise."
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat) => (
            <StatCard key={stat.label} title={stat.label} value={stat.value} subtitle={stat.subtitle} />
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Daily Register — Today</CardTitle>
            <CardDescription>Present and absent counts per class for 2026-11-26.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-full border-collapse text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Class</th>
                    <th className="px-4 py-3">Present</th>
                    <th className="px-4 py-3">Absent</th>
                    <th className="px-4 py-3">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {DAILY.map((d) => (
                    <tr key={d.className} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">{d.date}</td>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{d.className}</td>
                      <td className="px-4 py-3 text-emerald-600 dark:text-emerald-400">{d.present}</td>
                      <td className="px-4 py-3 text-rose-600 dark:text-rose-400">{d.absent}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{d.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Period Registers</CardTitle>
            <CardDescription>Period-wise attendance completion status.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-full border-collapse text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Period</th>
                    <th className="px-4 py-3">Subject</th>
                    <th className="px-4 py-3">Marked</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {PERIOD.map((p) => (
                    <tr key={p.period} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{p.period}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{p.subject}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{p.marked}</td>
                      <td className="px-4 py-3"><Badge variant={periodVariant(p.status)}>{p.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </PortalShell>
  );
}