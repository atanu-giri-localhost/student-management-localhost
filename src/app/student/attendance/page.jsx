'use client';

import { ErrorBanner } from '@/components/data-display/error-banner';
import { LoadingSkeleton } from '@/components/data-display/loading-skeleton';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { StatCard } from '@/components/data-display/stat-card';
import { PortalShell } from '@/components/layout/portal-shell';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSession } from '@/lib/auth/use-session';
import { cn } from '@/lib/utils';

const ATTENDANCE_STATS = [
  { label: 'Present', count: 42, pct: 84, color: 'bg-emerald-500 dark:bg-emerald-700' },
  { label: 'Absent', count: 5, pct: 10, color: 'bg-rose-500 dark:bg-rose-700' },
  { label: 'Late', count: 3, pct: 6, color: 'bg-amber-500 dark:bg-amber-700' },
];

const MONTHLY_ATTENDANCE = [
  { date: '2026-11-18', day: 'Monday', status: 'PRESENT', checkIn: '08:55', checkOut: '16:00', subject: 'All' },
  { date: '2026-11-19', day: 'Tuesday', status: 'PRESENT', checkIn: '08:50', checkOut: '16:05', subject: 'All' },
  { date: '2026-11-20', day: 'Wednesday', status: 'PRESENT', checkIn: '09:00', checkOut: '16:00', subject: 'All' },
  { date: '2026-11-21', day: 'Thursday', status: 'PRESENT', checkIn: '08:55', checkOut: '16:10', subject: 'All' },
  { date: '2026-11-22', day: 'Friday', status: 'PRESENT', checkIn: '08:45', checkOut: '16:00', subject: 'All' },
  { date: '2026-11-23', day: 'Saturday', status: 'ABSENT', checkIn: '—', checkOut: '—', subject: 'All' },
  { date: '2026-11-24', day: 'Monday', status: 'ABSENT', checkIn: '—', checkOut: '—', subject: 'All' },
  { date: '2026-11-25', day: 'Tuesday', status: 'PRESENT', checkIn: '08:55', checkOut: '16:00', subject: 'All' },
  { date: '2026-11-26', day: 'Wednesday', status: 'LATE', checkIn: '09:10', checkOut: '—', subject: 'All' },
];

const PERIOD_ATTENDANCE = [
  { period: 1, subject: 'Mathematics', status: 'PRESENT' },
  { period: 2, subject: 'Physics', status: 'PRESENT' },
  { period: 3, subject: 'Chemistry', status: 'ABSENT' },
  { period: 4, subject: 'Biology', status: 'PRESENT' },
  { period: 5, subject: 'English', status: 'PRESENT' },
  { period: 6, subject: 'Mathematics', status: 'PRESENT' },
  { period: 7, subject: 'Physics', status: 'PRESENT' },
  { period: 8, subject: 'Chemistry', status: 'LATE' },
];

const SUBJECT_ATTENDANCE = [
  { subject: 'Mathematics', attended: 28, total: 30, pct: 93 },
  { subject: 'Physics', attended: 26, total: 30, pct: 87 },
  { subject: 'Chemistry', attended: 24, total: 30, pct: 80 },
  { subject: 'Biology', attended: 29, total: 30, pct: 97 },
  { subject: 'English', attended: 25, total: 30, pct: 83 },
];

function statusBadgeVariant(status) {
  if (status === 'PRESENT') return 'success';
  if (status === 'ABSENT') return 'danger';
  if (status === 'LATE') return 'warning';
  return 'default';
}

export default function StudentAttendancePage() {
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

  const primaryRole = sessionData.roles?.[0] || 'STUDENT';

  return (
    <PortalShell
      roleName={primaryRole}
      roleLabel="Student"
      pageTitle="Student Attendance"
      activePath="/student/attendance"
      userLabel={sessionData.user.phoneNormalized}
      onLogout={handleLogout}
    >
      <div className="space-y-6">
        <SectionHeader
          title="Attendance"
          description="Track your daily and subject-wise attendance."
        />

        {/* Quick Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Overall" value="84%" subtitle="42 of 50 days" />
          <StatCard title="Present" value="42" subtitle="Days this month" />
          <StatCard title="Absent" value="5" subtitle="Days this month" />
          <StatCard title="Late" value="3" subtitle="Days this month" />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Attendance Breakdown Bar */}
          <Card>
            <CardHeader>
              <CardTitle>Attendance Breakdown</CardTitle>
              <CardDescription>Percentage split this month.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {ATTENDANCE_STATS.map((item) => (
                <div key={item.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{item.label}</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{item.pct}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className={cn('h-full rounded-full transition-all', item.color)}
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Subject-wise Attendance */}
          <Card>
            <CardHeader>
              <CardTitle>Subject-wise Attendance</CardTitle>
              <CardDescription>Attendance rate per subject.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {SUBJECT_ATTENDANCE.map((item) => (
                <div key={item.subject} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{item.subject}</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{item.pct}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-blue-500 dark:bg-blue-700 transition-all"
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    {item.attended}/{item.total} classes
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Daily Attendance Table */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Attendance</CardTitle>
            <CardDescription>Recent daily check-in and check-out records.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-full border-collapse text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Day</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Check-in</th>
                    <th className="px-4 py-3">Check-out</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {MONTHLY_ATTENDANCE.map((row) => (
                    <tr key={row.date} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{row.date}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{row.day}</td>
                      <td className="px-4 py-3">
                        <Badge variant={statusBadgeVariant(row.status)}>{row.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{row.checkIn}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{row.checkOut}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Today&apos;s Period Attendance */}
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s Period Attendance</CardTitle>
            <CardDescription>Period-by-period attendance for today.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-full border-collapse text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Period</th>
                    <th className="px-4 py-3">Subject</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {PERIOD_ATTENDANCE.map((row) => (
                    <tr key={row.period} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">P{row.period}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{row.subject}</td>
                      <td className="px-4 py-3">
                        <Badge variant={statusBadgeVariant(row.status)}>{row.status}</Badge>
                      </td>
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