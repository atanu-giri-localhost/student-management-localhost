'use client';

import { ErrorBanner } from '@/components/data-display/error-banner';
import { LoadingSkeleton } from '@/components/data-display/loading-skeleton';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { StatCard } from '@/components/data-display/stat-card';
import { PortalShell } from '@/components/layout/portal-shell';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSession } from '@/lib/auth/use-session';
import { TrendUpIcon } from '@/components/ui/icons';


const RESULTS = [
  { exam: 'Mid-Term 2026', date: '2026-10-15', obtained: 438, total: 500, grade: 'A', rank: 5, classSize: 42, status: 'PASSED' },
  { exam: 'Unit Test 3', date: '2026-11-10', obtained: 182, total: 200, grade: 'A+', rank: 2, classSize: 42, status: 'PASSED' },
  { exam: 'Final 2025', date: '2026-03-20', obtained: 412, total: 500, grade: 'B+', rank: 12, classSize: 42, status: 'PASSED' },
];

const SUBJECT_MARKS = [
  { exam: 'Mid-Term 2026', subject: 'Mathematics', obtained: 94, total: 100, grade: 'A+' },
  { exam: 'Mid-Term 2026', subject: 'Physics', obtained: 82, total: 100, grade: 'A' },
  { exam: 'Mid-Term 2026', subject: 'Chemistry', obtained: 85, total: 100, grade: 'A' },
  { exam: 'Mid-Term 2026', subject: 'Biology', obtained: 97, total: 100, grade: 'A+' },
  { exam: 'Mid-Term 2026', subject: 'English', obtained: 80, total: 100, grade: 'B+' },
];

const SCORE_TREND = [
  { exam: 'Unit 1', score: 72, pct: 72 },
  { exam: 'Unit 2', score: 78, pct: 78 },
  { exam: 'Mid-Term', score: 85, pct: 85 },
  { exam: 'Unit 3', score: 88, pct: 88 },
  { exam: 'Final', score: 92, pct: 92 },
];

function pct(obtained, total) {
  return ((obtained / total) * 100).toFixed(1);
}

export default function StudentResultsPage() {
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
  const latestResult = RESULTS[0];
  const latestPct = pct(latestResult.obtained, latestResult.total);

  return (
    <PortalShell
      roleName={primaryRole}
      roleLabel="Student"
      pageTitle="Student Exam Results"
      activePath="/student/results"
      userLabel={sessionData.user.phoneNormalized}
      onLogout={handleLogout}
    >
      <div className="space-y-6">
        <SectionHeader
          title="Exam Results"
          description="View exam results, subject marks, and performance trends."
        />

        {/* Quick Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Latest Result" value={`${latestPct}%`} subtitle={`Grade ${latestResult.grade}`} />
          <StatCard title="Class Rank" value={`#${latestResult.rank}`} subtitle={`of ${latestResult.classSize} students`} />
          <StatCard title="Exams Taken" value={RESULTS.length.toString()} subtitle="This academic year" />
          <StatCard title="Overall Grade" value="A" subtitle="Across all exams" />
        </div>

        {/* Exam Summary Table */}
        <Card>
          <CardHeader>
            <CardTitle>Exam Summary</CardTitle>
            <CardDescription>All completed exams with percentages and ranks.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-full border-collapse text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Exam</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Obtained</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">%</th>
                    <th className="px-4 py-3">Grade</th>
                    <th className="px-4 py-3">Rank</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {RESULTS.map((row) => (
                    <tr key={row.exam} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">{row.exam}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{row.date}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{row.obtained}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{row.total}</td>
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">{pct(row.obtained, row.total)}%</td>
                      <td className="px-4 py-3">
                        <Badge variant={row.grade.startsWith('A') ? 'success' : 'primary'}>{row.grade}</Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">#{row.rank}</td>
                      <td className="px-4 py-3">
                        <Badge variant="success">{row.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Score Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Score Trend</CardTitle>
            <CardDescription>Percentage progression across exams.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-40 items-end justify-between gap-2 sm:gap-4">
              {SCORE_TREND.map((point) => (
                <div key={point.exam} className="flex flex-1 flex-col items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{point.pct}%</span>
                  <div
                    className="w-full max-w-12 rounded-t-lg bg-blue-500 dark:bg-blue-700 transition-all"
                    style={{ height: `${point.pct * 1.2}px` }}
                  />
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 text-center leading-tight">
                    {point.exam}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Subject-wise Marks for Latest Exam */}
        <Card>
          <CardHeader>
            <CardTitle>Subject Marks — {latestResult.exam}</CardTitle>
            <CardDescription>Detailed subject-wise marks for the most recent exam.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-full border-collapse text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Subject</th>
                    <th className="px-4 py-3">Obtained</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">%</th>
                    <th className="px-4 py-3">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {SUBJECT_MARKS.map((row) => (
                    <tr key={row.subject} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">{row.subject}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{row.obtained}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{row.total}</td>
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">{pct(row.obtained, row.total)}%</td>
                      <td className="px-4 py-3">
                        <Badge variant={row.grade.startsWith('A') ? 'success' : 'primary'}>{row.grade}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Result Analysis */}
        <Card>
          <CardHeader>
            <CardTitle>Result Analysis</CardTitle>
            <CardDescription>Key insights from your latest results.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 p-4 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Best Subject</p>
              <p className="font-semibold text-slate-900 dark:text-slate-100">Biology</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">97/100, grade A+</p>
            </div>
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 p-4 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">Needs Focus</p>
              <p className="font-semibold text-slate-900 dark:text-slate-100">English</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">80/100, grade B+</p>
            </div>
            <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/50 p-4 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">Overall Trend</p>
              <p className="flex items-center gap-1 font-semibold text-slate-900 dark:text-slate-100">
                <TrendUpIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Improving
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">Up 20% since Unit 1</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </PortalShell>
  );
}