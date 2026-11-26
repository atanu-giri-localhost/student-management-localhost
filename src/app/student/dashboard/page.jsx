'use client';

import { ErrorBanner } from '@/components/data-display/error-banner';
import { LoadingSkeleton } from '@/components/data-display/loading-skeleton';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { StatCard } from '@/components/data-display/stat-card';
import { PortalShell } from '@/components/layout/portal-shell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSession } from '@/lib/auth/use-session';
import { cn } from '@/lib/utils';

const SUBJECT_SCORES = [
  { subject: 'Mathematics', score: 92, color: 'bg-blue-500 dark:bg-blue-700' },
  { subject: 'Physics', score: 88, color: 'bg-blue-500 dark:bg-blue-700' },
  { subject: 'Chemistry', score: 85, color: 'bg-blue-500 dark:bg-blue-700' },
  { subject: 'Biology', score: 95, color: 'bg-blue-500 dark:bg-blue-700' },
  { subject: 'English', score: 78, color: 'bg-blue-500 dark:bg-blue-700' },
];

const ATTENDANCE_DATA = [
  { label: 'Present', count: 42, color: 'bg-emerald-500 dark:bg-emerald-700', pct: 84 },
  { label: 'Absent', count: 5, color: 'bg-rose-500 dark:bg-rose-700', pct: 10 },
  { label: 'Late', count: 3, color: 'bg-amber-500 dark:bg-amber-700', pct: 6 },
];

const SCORE_TREND = [
  { exam: 'Unit 1', score: 72 },
  { exam: 'Unit 2', score: 78 },
  { exam: 'Mid-Term', score: 85 },
  { exam: 'Unit 3', score: 88 },
  { exam: 'Final', score: 92 },
];

export default function StudentDashboardPage() {
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
  const totalAttendance = ATTENDANCE_DATA.reduce((s, d) => s + d.count, 0);

  return (
    <PortalShell
      roleName={primaryRole}
      roleLabel="Student"
      pageTitle="Student Dashboard"
      activePath="/student/dashboard"
      userLabel={sessionData.user.phoneNormalized}
      onLogout={handleLogout}
    >
      <div className="space-y-6">
        <SectionHeader
          title="Student Dashboard"
          description="View your attendance, performance, exam results, and timetable."
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Subject Performance</CardTitle>
              <CardDescription>
                Scores across all subjects (out of 100).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {SUBJECT_SCORES.map((item) => (
                <div key={item.subject} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{item.subject}</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{item.score}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className={cn('h-full rounded-full transition-all', item.color)}
                      style={{ width: `${item.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Attendance Donut Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Attendance Overview</CardTitle>
              <CardDescription>
                {totalAttendance} total days recorded.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4 sm:flex-row sm:justify-around">
              <div className="relative h-32 w-32 shrink-0">
                <div
                  className="h-32 w-32 rounded-full"
                  style={{
                    background: `conic-gradient(#059669 0% ${ATTENDANCE_DATA[0].pct}%, #e11d48 ${ATTENDANCE_DATA[0].pct}% ${ATTENDANCE_DATA[0].pct + ATTENDANCE_DATA[1].pct}%, #d97706 ${ATTENDANCE_DATA[0].pct + ATTENDANCE_DATA[1].pct}% 100%)`,
                  }}
                />
                <div className="absolute inset-3 flex flex-col items-center justify-center rounded-full bg-white dark:bg-slate-900">
                  <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {Math.round((ATTENDANCE_DATA[0].count / totalAttendance) * 100)}%
                  </span>
                  <span className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Present
                  </span>
                </div>
              </div>
              <div className="w-full space-y-2 sm:w-auto">
                {ATTENDANCE_DATA.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-4 text-xs sm:gap-8">
                    <div className="flex items-center gap-2">
                      <span className={cn('h-2 w-2 rounded-full', item.color)} />
                      <span className="text-slate-600 dark:text-slate-400">{item.label}</span>
                    </div>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{item.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Score Trend Line Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Score Trend</CardTitle>
            <CardDescription>
              Performance progression across exams.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-40 items-end justify-between gap-2 sm:gap-4">
              {SCORE_TREND.map((point) => (
                <div key={point.exam} className="flex flex-1 flex-col items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{point.score}</span>
                  <div
                    className="w-full max-w-12 rounded-t-lg bg-blue-500 dark:bg-blue-700 transition-all"
                    style={{ height: `${point.score * 1.2}px` }}
                  />
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 text-center leading-tight">
                    {point.exam}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats Row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Subjects" value="5" subtitle="Enrolled this session" />
          <StatCard title="Attendance" value="84%" subtitle="42 of 50 days present" />
          <StatCard title="Avg Score" value="87.6" subtitle="Across 5 subjects" />
          <StatCard title="Exams Taken" value="5" subtitle="This academic year" />
        </div>
      </div>
    </PortalShell>
  );
}