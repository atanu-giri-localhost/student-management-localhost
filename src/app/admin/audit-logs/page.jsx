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
  { label: 'Total Events', value: '10,482', subtitle: 'All time' },
  { label: 'Today', value: '38', subtitle: 'Logged' },
  { label: 'Admins', value: '8', subtitle: 'Active actors' },
  { label: 'Retention', value: '365d', subtitle: 'Policy' },
];

const LOGS = [
  { action: 'CREATE', entity: 'PAYMENT', entityId: '2d000000-...0001', actor: 'admin@apex', time: '2 min ago' },
  { action: 'UPDATE', entity: 'STUDENT', entityId: '14000000-...0002', actor: 'admin@apex', time: '15 min ago' },
  { action: 'CREATE', entity: 'INVOICE', entityId: '2b000000-...0003', actor: 'admin@apex', time: '1 hour ago' },
  { action: 'REVOKE', entity: 'SESSION', entityId: 'sess_...a3f2', actor: 'superadmin', time: '2 hours ago' },
  { action: 'UPDATE', entity: 'TEACHER_ASSIGNMENT', entityId: '1c000000-...0002', actor: 'admin@apex', time: '3 hours ago' },
  { action: 'DELETE', entity: 'PARENT_LINK', entityId: '1a000000-...0009', actor: 'superadmin', time: '5 hours ago' },
  { action: 'CREATE', entity: 'USER', entityId: '11000000-...0004', actor: 'superadmin', time: 'Yesterday' },
  { action: 'UPDATE', entity: 'ACADEMIC_SESSION', entityId: '10000000-...0001', actor: 'admin@apex', time: 'Yesterday' },
];

function actionVariant(action) {
  if (action === 'CREATE') return 'success';
  if (action === 'UPDATE') return 'info';
  if (action === 'REVOKE' || action === 'DELETE') return 'danger';
  return 'default';
}

export default function AdminAuditLogsPage() {
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
      pageTitle="Audit Logs"
      activePath="/admin/audit-logs"
      userLabel={sessionData.user.phoneNormalized}
      onLogout={handleLogout}
    >
      <div className="space-y-6">
        <SectionHeader
          title="Audit Logs"
          description="System activity trail across all modules (super admin only)."
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat) => (
            <StatCard key={stat.label} title={stat.label} value={stat.value} subtitle={stat.subtitle} />
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Activity Trail</CardTitle>
            <CardDescription>Recent create, update, revoke, and delete events.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-full border-collapse text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Entity</th>
                    <th className="px-4 py-3">Actor</th>
                    <th className="px-4 py-3">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {LOGS.map((log, i) => (
                    <tr key={i} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3">
                        <Badge variant={actionVariant(log.action)}>{log.action}</Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                        {log.entity}
                        <span className="block text-xs text-slate-400 dark:text-slate-500">{log.entityId}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{log.actor}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{log.time}</td>
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