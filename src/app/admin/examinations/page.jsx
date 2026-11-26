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
  { label: 'Upcoming Exams', value: '4', subtitle: 'This term' },
  { label: 'Marks Entered', value: '82%', subtitle: 'Across classes' },
  { label: 'Pending Entry', value: '3', subtitle: 'Awaiting teachers' },
  { label: 'Published', value: '2', subtitle: 'Results visible' },
];

const EXAMS = [
  { name: 'Half-Yearly 2025-26', classes: 'VIII–X', date: '2026-09-15', status: 'PUBLISHED' },
  { name: 'Unit Test 3', classes: 'VIII–X', date: '2026-11-10', status: 'PUBLISHED' },
  { name: 'Pre-Board', classes: 'X', date: '2026-12-05', status: 'UPCOMING' },
  { name: 'Annual 2025-26', classes: 'VIII–X', date: '2027-02-20', status: 'UPCOMING' },
];

const MARKS = [
  { exam: 'Unit Test 3', subject: 'Mathematics', entered: '43/43', avg: '78%' },
  { exam: 'Unit Test 3', subject: 'Science', entered: '43/43', avg: '72%' },
  { exam: 'Unit Test 3', subject: 'English', entered: '40/43', avg: '80%' },
  { exam: 'Unit Test 3', subject: 'Social Studies', entered: '38/43', avg: '75%' },
];

function examVariant(status) {
  if (status === 'PUBLISHED') return 'success';
  if (status === 'UPCOMING') return 'info';
  return 'default';
}

export default function AdminExaminationsPage() {
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
      pageTitle="Examinations"
      activePath="/admin/examinations"
      userLabel={sessionData.user.phoneNormalized}
      onLogout={handleLogout}
    >
      <div className="space-y-6">
        <SectionHeader
          title="Examinations"
          description="Manage exams, marks entry, and result publication."
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat) => (
            <StatCard key={stat.label} title={stat.label} value={stat.value} subtitle={stat.subtitle} />
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Exams</CardTitle>
            <CardDescription>Exam schedule and publication status.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-full border-collapse text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Exam</th>
                    <th className="px-4 py-3">Classes</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {EXAMS.map((e) => (
                    <tr key={e.name} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{e.name}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{e.classes}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">{e.date}</td>
                      <td className="px-4 py-3"><Badge variant={examVariant(e.status)}>{e.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Marks Entry — Unit Test 3</CardTitle>
            <CardDescription>Subject-wise marks entry progress and averages.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-full border-collapse text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Exam</th>
                    <th className="px-4 py-3">Subject</th>
                    <th className="px-4 py-3">Entered</th>
                    <th className="px-4 py-3">Average</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {MARKS.map((m) => (
                    <tr key={m.subject} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{m.exam}</td>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{m.subject}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{m.entered}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">{m.avg}</td>
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