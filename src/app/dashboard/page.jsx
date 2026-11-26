'use client';

import { ErrorBanner } from '@/components/data-display/error-banner';
import { LoadingSkeleton } from '@/components/data-display/loading-skeleton';
import { StatCard } from '@/components/data-display/stat-card';
import { PortalShell } from '@/components/layout/portal-shell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSession } from '@/lib/auth/use-session';

export default function AuthenticatedDashboardPage() {
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

  return (
    <PortalShell
      roleName={primaryRole}
      roleLabel={primaryRole.replace(/_/g, ' ')}
      pageTitle="Authenticated Workspace"
      activePath="/dashboard"
      userLabel={sessionData.user.phoneNormalized}
      onLogout={handleLogout}
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Authenticated Phone"
            value={sessionData.user.phoneNormalized}
            subtitle="Verified via WhatsApp OTP"
          />
          <StatCard
            title="Primary Role"
            value={primaryRole.replace(/_/g, ' ')}
            subtitle="Server-side RBAC enforced"
          />
          <StatCard
            title="Session Status"
            value="Active"
            subtitle="HttpOnly cookie"
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Authentication & RBAC Ready</CardTitle>
            <CardDescription>
              Your WhatsApp OTP session is authenticated and protected by server RBAC guards.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-600 dark:text-slate-400">
            <div className="grid gap-4 sm:grid-cols-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400">Student ID</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {sessionData.profiles?.studentId ?? 'none'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400">Teacher ID</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {sessionData.profiles?.teacherProfileId ?? 'none'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400">Parent ID</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {sessionData.profiles?.parentProfileId ?? 'none'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PortalShell>
  );
}