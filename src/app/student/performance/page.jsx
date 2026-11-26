'use client';

import { ErrorBanner } from '@/components/data-display/error-banner';
import { LoadingSkeleton } from '@/components/data-display/loading-skeleton';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { StatCard } from '@/components/data-display/stat-card';
import { PortalShell } from '@/components/layout/portal-shell';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSession } from '@/lib/auth/use-session';
import { TrendUpIcon, TrendDownIcon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

const PERFORMANCE = [
  { subject: 'Mathematics', score: 92, grade: 'A', color: 'bg-blue-500 dark:bg-blue-700', teacher: 'Mr. A. Sharma', trend: 'up', delta: 4 },
  { subject: 'Physics', score: 88, grade: 'B+', color: 'bg-blue-500 dark:bg-blue-700', teacher: 'Mrs. P. Sen', trend: 'up', delta: 2 },
  { subject: 'Chemistry', score: 85, grade: 'B+', color: 'bg-blue-500 dark:bg-blue-700', teacher: 'Dr. K. Mehta', trend: 'down', delta: 3 },
  { subject: 'Biology', score: 95, grade: 'A+', color: 'bg-blue-500 dark:bg-blue-700', teacher: 'Mrs. R. Iyer', trend: 'up', delta: 5 },
  { subject: 'English', score: 78, grade: 'B', color: 'bg-blue-500 dark:bg-blue-700', teacher: 'Mr. D. Roy', trend: 'down', delta: 2 },
];

const EXAM_TREND = [
  { exam: 'Unit 1', score: 72, color: 'bg-blue-500 dark:bg-blue-700' },
  { exam: 'Unit 2', score: 78, color: 'bg-blue-500 dark:bg-blue-700' },
  { exam: 'Mid-Term', score: 85, color: 'bg-blue-500 dark:bg-blue-700' },
  { exam: 'Unit 3', score: 88, color: 'bg-blue-500 dark:bg-blue-700' },
  { exam: 'Final', score: 92, color: 'bg-blue-500 dark:bg-blue-700' },
];

const GRADE_DISTRIBUTION = [
  { grade: 'A+', count: 1, pct: 20, color: 'bg-blue-500 dark:bg-blue-700' },
  { grade: 'A', count: 1, pct: 20, color: 'bg-blue-500 dark:bg-blue-700' },
  { grade: 'B+', count: 2, pct: 40, color: 'bg-blue-500 dark:bg-blue-700' },
  { grade: 'B', count: 1, pct: 20, color: 'bg-blue-500 dark:bg-blue-700' },
];

const TEACHER_REMARKS = [
  { subject: 'Mathematics', remark: 'Excellent problem-solving skills. Keep it up.', teacher: 'Mr. A. Sharma' },
  { subject: 'Chemistry', remark: 'Needs more practice with organic reactions.', teacher: 'Dr. K. Mehta' },
  { subject: 'Biology', remark: 'Outstanding grasp of concepts and diagrams.', teacher: 'Mrs. R. Iyer' },
];

export default function StudentPerformancePage() {
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
  const avgScore = (PERFORMANCE.reduce((s, r) => s + r.score, 0) / PERFORMANCE.length).toFixed(1);
  const bestSubject = PERFORMANCE.reduce((a, b) => (a.score > b.score ? a : b));

  return (
    <PortalShell
      roleName={primaryRole}
      roleLabel="Student"
      pageTitle="Student Performance"
      activePath="/student/performance"
      userLabel={sessionData.user.phoneNormalized}
      onLogout={handleLogout}
    >
      <div className="space-y-6">
        <SectionHeader
          title="Performance"
          description="Subject-wise scores, trends, and teacher feedback."
        />

        {/* Quick Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Avg Score" value={avgScore} subtitle="Across 5 subjects" />
          <StatCard title="Best Subject" value={bestSubject.subject} subtitle={`${bestSubject.score} out of 100`} />
          <StatCard title="Highest Grade" value="A+" subtitle="Biology" />
          <StatCard title="Subjects" value="5" subtitle="Enrolled this session" />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Subject Score Bars */}
          <Card>
            <CardHeader>
              <CardTitle>Subject Scores</CardTitle>
              <CardDescription>Current scores out of 100.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {PERFORMANCE.map((item) => (
                <div key={item.subject} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{item.subject}</span>
                    <div className="flex items-center gap-2">
                      <span className={cn('flex items-center gap-1 text-xs font-bold', item.trend === 'up' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                        {item.trend === 'up' ? <TrendUpIcon className="h-3 w-3" /> : <TrendDownIcon className="h-3 w-3" />}
                        {item.delta}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">{item.score}</span>
                    </div>
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

          {/* Grade Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Grade Distribution</CardTitle>
              <CardDescription>Breakdown of grades across subjects.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {GRADE_DISTRIBUTION.map((item) => (
                <div key={item.grade} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{item.grade}</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{item.count} subject(s)</span>
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
        </div>

        {/* Exam Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Score Trend</CardTitle>
            <CardDescription>Performance progression across exams.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-40 items-end justify-between gap-2 sm:gap-4">
              {EXAM_TREND.map((point) => (
                <div key={point.exam} className="flex flex-1 flex-col items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{point.score}</span>
                  <div
                    className={cn('w-full max-w-12 rounded-t-lg transition-all', point.color)}
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

        {/* Detailed Performance Table */}
        <Card>
          <CardHeader>
            <CardTitle>Detailed Performance</CardTitle>
            <CardDescription>Subject-wise scores, grades, and teachers.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-full border-collapse text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Subject</th>
                    <th className="px-4 py-3">Score</th>
                    <th className="px-4 py-3">Grade</th>
                    <th className="px-4 py-3">Trend</th>
                    <th className="px-4 py-3">Teacher</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {PERFORMANCE.map((row) => (
                    <tr key={row.subject} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">{row.subject}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{row.score}</td>
                      <td className="px-4 py-3">
                        <Badge variant={row.grade.startsWith('A') ? 'success' : 'primary'}>{row.grade}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('flex items-center gap-1 text-xs font-bold', row.trend === 'up' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                          {row.trend === 'up' ? <TrendUpIcon className="h-4 w-4" /> : <TrendDownIcon className="h-4 w-4" />}
                          {row.delta}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{row.teacher}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Teacher Remarks */}
        <Card>
          <CardHeader>
            <CardTitle>Teacher Remarks</CardTitle>
            <CardDescription>Feedback from subject teachers.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TEACHER_REMARKS.map((item) => (
              <div
                key={item.subject}
                className="rounded-lg border border-slate-100 dark:border-slate-700 p-4 space-y-2"
              >
                <Badge variant="info">{item.subject}</Badge>
                <p className="text-sm text-slate-700 dark:text-slate-300 italic">&quot;{item.remark}&quot;</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">— {item.teacher}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </PortalShell>
  );
}