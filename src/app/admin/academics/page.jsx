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
  { label: 'Active Session', value: '2025-26', subtitle: 'Current' },
  { label: 'Classes', value: '18', subtitle: 'Across 3 grades' },
  { label: 'Subjects', value: '8', subtitle: 'Core + electives' },
  { label: 'Terms', value: '2', subtitle: 'Half-yearly' },
];

const SESSIONS = [
  { name: '2025-26', status: 'ACTIVE', classes: 18 },
  { name: '2024-25', status: 'ARCHIVED', classes: 18 },
];

const CLASSES = [
  { name: 'VIII-A', teacher: 'Ravi Verma', students: 42, room: 'R-101' },
  { name: 'VIII-B', teacher: 'Ravi Verma', students: 40, room: 'R-102' },
  { name: 'IX-A', teacher: 'Sunita Devi', students: 44, room: 'R-201' },
  { name: 'IX-B', teacher: 'Sunita Devi', students: 41, room: 'R-202' },
  { name: 'X-A', teacher: 'Anil Kumar', students: 43, room: 'R-301' },
  { name: 'X-B', teacher: 'Anil Kumar', students: 42, room: 'R-302' },
];

function sessionVariant(status) {
  return status === 'ACTIVE' ? 'success' : 'default';
}

export default function AdminAcademicsPage() {
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
      pageTitle="Academics"
      activePath="/admin/academics"
      userLabel={sessionData.user.phoneNormalized}
      onLogout={handleLogout}
    >
      <div className="space-y-6">
        <SectionHeader
          title="Academics"
          description="Manage academic sessions, classes, subjects, and terms."
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat) => (
            <StatCard key={stat.label} title={stat.label} value={stat.value} subtitle={stat.subtitle} />
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Academic Sessions</CardTitle>
              <CardDescription>Session-scoped enrollment boundaries.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {SESSIONS.map((s) => (
                <div key={s.name} className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3 dark:border-slate-700">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{s.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{s.classes} classes</p>
                  </div>
                  <Badge variant={sessionVariant(s.status)}>{s.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Classes</CardTitle>
              <CardDescription>Class ownership and room allocation.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="w-full overflow-x-auto">
                <table className="w-full min-w-full border-collapse text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Class</th>
                      <th className="px-4 py-3">Teacher</th>
                      <th className="px-4 py-3">Students</th>
                      <th className="px-4 py-3">Room</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {CLASSES.map((c) => (
                      <tr key={c.name} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{c.name}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{c.teacher}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{c.students}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">{c.room}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PortalShell>
  );
}