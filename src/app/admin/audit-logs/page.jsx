'use client';

import { ErrorBanner } from '@/components/data-display/error-banner';
import { EmptyState } from '@/components/data-display/empty-state';
import { LoadingSkeleton } from '@/components/data-display/loading-skeleton';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { StatCard } from '@/components/data-display/stat-card';
import { PortalShell } from '@/components/layout/portal-shell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useSession } from '@/lib/auth/use-session';

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
        <ErrorBanner title="Session check failed" message={errorMsg || 'Please sign in again.'} onRetry={handleRetry} />
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
        <SectionHeader title="Audit Logs" description="System activity trail across all modules (super admin only)." />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Source" value="D1" subtitle="DB_AUDIT" />
          <StatCard title="Retention" value="365d" subtitle="Policy" />
          <StatCard title="Access" value="Super Admin" subtitle="Restricted" />
          <StatCard title="Status" value="Live" subtitle="Request-scoped" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Activity Trail</CardTitle>
            <CardDescription>Recent create, update, revoke, and delete events.</CardDescription>
          </CardHeader>
          <CardContent>
            <EmptyState
              title="Audit log viewer not yet available"
              description="An audit log list endpoint has not been exposed yet. Audit events are recorded to DB_AUDIT.audit_logs and reconciled from domain audit_outbox tables."
            />
          </CardContent>
        </Card>
      </div>
    </PortalShell>
  );
}