'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ErrorBanner } from '@/components/data-display/error-banner';
import { LoadingSkeleton } from '@/components/data-display/loading-skeleton';
import { StatCard } from '@/components/data-display/stat-card';
import { PortalShell } from '@/components/layout/portal-shell';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

async function fetchSessionRequest(signal) {
  const response = await fetch('/api/v1/auth/session', { cache: 'no-store', signal });
  const payload = await response.json().catch(() => ({}));
  return { status: response.status, ok: response.ok, payload };
}

export default function AuthenticatedDashboardPage() {
  const router = useRouter();
  const [sessionData, setSessionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetchSessionRequest(controller.signal)
      .then(({ status, ok, payload }) => {
        if (controller.signal.aborted) {
          return;
        }
        if (status === 401) {
          router.replace('/login');
          return;
        }
        if (!ok) {
          setErrorMsg(payload?.error?.message || 'Unable to load active session.');
          return;
        }
        setSessionData(payload.data);
      })
      .catch((err) => {
        if (err?.name !== 'AbortError' && !controller.signal.aborted) {
          setErrorMsg('Network error while checking active session.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [router]);

  async function handleRetry() {
    setLoading(true);
    setErrorMsg('');
    try {
      const { status, ok, payload } = await fetchSessionRequest();
      if (status === 401) {
        router.replace('/login');
        return;
      }
      if (!ok) {
        setErrorMsg(payload?.error?.message || 'Unable to load active session.');
        return;
      }
      setSessionData(payload.data);
    } catch {
      setErrorMsg('Network error while checking active session.');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/v1/auth/logout', { method: 'POST' }).catch(() => null);
    router.replace('/login');
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <LoadingSkeleton rows={4} />
      </main>
    );
  }

  if (errorMsg || !sessionData) {
    return (
      <main className="mx-auto max-w-4xl p-6">
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
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            title="Authenticated Phone"
            value={sessionData.user.phoneNormalized}
            badgeText="Verified OTP"
            badgeVariant="success"
          />
          <StatCard
            title="Primary Role"
            value={primaryRole.replace(/_/g, ' ')}
            subtitle={`Active roles: ${sessionData.roles.join(', ')}`}
            badgeText="RBAC Active"
            badgeVariant="primary"
          />
          <StatCard
            title="Session Status"
            value="Active"
            subtitle={`Expires ${sessionData.session.expiresAt.slice(0, 10)}`}
            badgeText="HttpOnly Cookie"
            badgeVariant="info"
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Phase 2 Authentication & RBAC Ready</CardTitle>
            <CardDescription>
              Your WhatsApp OTP session is authenticated via Cloudflare D1 and protected by server
              RBAC guards.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <div className="flex flex-wrap gap-2">
              {sessionData.roles.map((role) => (
                <Badge key={role} variant="primary">
                  {role}
                </Badge>
              ))}
            </div>
            <p>
              Linked profiles: Student ID{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                {sessionData.profiles?.studentId ?? 'none'}
              </code>
              , Teacher ID{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                {sessionData.profiles?.teacherProfileId ?? 'none'}
              </code>
              , Parent ID{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                {sessionData.profiles?.parentProfileId ?? 'none'}
              </code>
              .
            </p>
          </CardContent>
        </Card>
      </div>
    </PortalShell>
  );
}
