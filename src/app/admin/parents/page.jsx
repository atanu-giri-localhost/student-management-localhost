'use client';

import { ErrorBanner } from '@/components/data-display/error-banner';
import { EmptyState } from '@/components/data-display/empty-state';
import { LoadingSkeleton } from '@/components/data-display/loading-skeleton';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { StatCard } from '@/components/data-display/stat-card';
import { PortalShell } from '@/components/layout/portal-shell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useSession } from '@/lib/auth/use-session';

export default function AdminParentsPage() {
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
      pageTitle="Parents"
      activePath="/admin/parents"
      userLabel={sessionData.user.phoneNormalized}
      onLogout={handleLogout}
    >
      <div className="space-y-6">
        <SectionHeader title="Parents" description="Manage guardian profiles, verification, and child links." />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Source" value="D1" subtitle="DB_STUDENTS" />
          <StatCard title="Access" value="Read-only" subtitle="MVP parent scope" />
          <StatCard title="Linkage" value="Verified" subtitle="parent_students" />
          <StatCard title="Status" value="Live" subtitle="Request-scoped" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Parent Directory</CardTitle>
            <CardDescription>Guardian accounts and their linked students.</CardDescription>
          </CardHeader>
          <CardContent>
            <EmptyState
              title="Parent directory not yet available"
              description="A parent list endpoint has not been exposed for administrators yet. Parent profiles are created and verified through the students module."
            />
          </CardContent>
        </Card>
      </div>
    </PortalShell>
  );
}