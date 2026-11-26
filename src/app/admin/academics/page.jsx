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

export default function AdminAcademicsPage() {
  const { sessionData, loading: sessionLoading, errorMsg: sessionError, handleRetry, handleLogout } = useSession();
  const sessions = useApiList('/api/v1/academic-sessions?pageSize=50');
  const classes = useApiList('/api/v1/classes?pageSize=50');

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
  const loading = sessions.loading || classes.loading;

  return (
    <PortalShell
      roleName={primaryRole}
      roleLabel={isSuperAdmin ? 'Super Administrator' : 'Administrator'}
      pageTitle="Academics"
      activePath="/admin/academics"
      userLabel={sessionData.user.phoneNormalized}
      onLogout={handleLogout}
    >
      <div className="space-y-6">
        <SectionHeader title="Academics" description="Manage academic sessions, classes, and subjects." />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Active Session" value={loading ? '—' : (sessions.data.find((s) => s.isActive)?.name ?? 'None')} subtitle="Current" />
          <StatCard title="Sessions" value={loading ? '—' : sessions.total} subtitle="Total" />
          <StatCard title="Classes" value={loading ? '—' : classes.total} subtitle="Across sessions" />
          <StatCard title="Source" value="D1" subtitle="DB_ACADEMICS" />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Academic Sessions</CardTitle>
              <CardDescription>Session-scoped enrollment boundaries.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {sessions.loading ? (
                <LoadingSkeleton rows={3} />
              ) : sessions.errorMsg ? (
                <ErrorBanner title="Could not load sessions" message={sessions.errorMsg} onRetry={sessions.reload} />
              ) : sessions.data.length === 0 ? (
                <EmptyState title="No sessions" description="Academic sessions will appear here once created." />
              ) : (
                sessions.data.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3 dark:border-slate-700">
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{s.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{s.startDate} → {s.endDate}</p>
                    </div>
                    <Badge variant={s.isActive ? 'success' : 'default'}>{s.isActive ? 'ACTIVE' : 'INACTIVE'}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Classes</CardTitle>
              <CardDescription>Class ownership and section allocation.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {classes.loading ? (
                <div className="p-4"><LoadingSkeleton rows={3} /></div>
              ) : classes.errorMsg ? (
                <div className="p-4"><ErrorBanner title="Could not load classes" message={classes.errorMsg} onRetry={classes.reload} /></div>
              ) : classes.data.length === 0 ? (
                <div className="p-4"><EmptyState title="No classes" description="Classes will appear here once created." /></div>
              ) : (
                <div className="w-full overflow-x-auto">
                  <table className="w-full min-w-full border-collapse text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Class</th>
                        <th className="px-4 py-3">Grade</th>
                        <th className="px-4 py-3">Section</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {classes.data.map((c) => (
                        <tr key={c.id} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                          <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{c.name}</td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{c.gradeLevel}</td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{c.section || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PortalShell>
  );
}