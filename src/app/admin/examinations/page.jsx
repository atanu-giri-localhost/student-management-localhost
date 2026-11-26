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

export default function AdminExaminationsPage() {
  const { sessionData, loading: sessionLoading, errorMsg: sessionError, handleRetry, handleLogout } = useSession();
  const { data: exams, total, loading, errorMsg, reload } = useApiList('/api/v1/examinations?pageSize=50');

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
  const published = exams.filter((e) => e.isPublished).length;

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
        <SectionHeader title="Examinations" description="Manage exams, marks entry, and result publication." />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total Exams" value={loading ? '—' : total} subtitle="All types" />
          <StatCard title="Published" value={loading ? '—' : published} subtitle="Results visible" />
          <StatCard title="Unpublished" value={loading ? '—' : exams.length - published} subtitle="Draft" />
          <StatCard title="Source" value="D1" subtitle="DB_PERFORMANCE" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Exams</CardTitle>
            <CardDescription>Exam schedule and publication status.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4"><LoadingSkeleton rows={4} /></div>
            ) : errorMsg ? (
              <div className="p-4"><ErrorBanner title="Could not load examinations" message={errorMsg} onRetry={reload} /></div>
            ) : exams.length === 0 ? (
              <div className="p-4"><EmptyState title="No examinations" description="Examinations will appear here once they are created." /></div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full min-w-full border-collapse text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Exam</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Start</th>
                      <th className="px-4 py-3">End</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {exams.map((e) => (
                      <tr key={e.id} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{e.name}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{e.examType}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">{e.startDate || '—'}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">{e.endDate || '—'}</td>
                        <td className="px-4 py-3"><Badge variant={e.isPublished ? 'success' : 'warning'}>{e.isPublished ? 'PUBLISHED' : 'DRAFT'}</Badge></td>
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