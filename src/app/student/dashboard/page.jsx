'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ErrorBanner } from '@/components/data-display/error-banner';
import { LoadingSkeleton } from '@/components/data-display/loading-skeleton';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { StatCard } from '@/components/data-display/stat-card';
import { PortalShell } from '@/components/layout/portal-shell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

async function fetchSessionRequest(signal) {
  const response = await fetch('/api/v1/auth/session', { cache: 'no-store', signal });
  const payload = await response.json().catch(() => ({}));
  return { status: response.status, ok: response.ok, payload };
}

const STUDENT_QUICK_LINKS = [
  { label: 'Profile', href: '/student/profile', icon: 'user' },
  { label: 'Attendance', href: '/student/attendance', icon: 'calendar' },
  { label: 'Performance', href: '/student/performance', icon: 'bar-chart' },
  { label: 'Exam Results', href: '/student/results', icon: 'file-text' },
  { label: 'Timetable', href: '/student/timetable', icon: 'clock' },
];

export default function StudentDashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // TEMPORARY DEV BYPASS — remove before production.
  // Access: /student/dashboard?dev-bypass=1
  const devBypass = searchParams.get('dev-bypass') === '1';

  const [sessionData, setSessionData] = useState(() =>
    devBypass
      ? {
          user: { phoneNormalized: '+919999900000' },
          roles: ['STUDENT'],
          profiles: { studentId: 'STU-0001', teacherProfileId: null, parentProfileId: null },
          session: { expiresAt: '2026-12-25T00:00:00Z' },
        }
      : null,
  );
  const [loading, setLoading] = useState(!devBypass);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (devBypass) {
      return undefined;
    }

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
  }, [devBypass, router]);

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
      roleLabel="Student"
      pageTitle={devBypass ? 'Student Dashboard (Dev Bypass)' : 'Student Dashboard'}
      activePath="/student/dashboard"
      userLabel={sessionData.user.phoneNormalized}
      onLogout={handleLogout}
    >
      <div className="space-y-6">
        {devBypass ? (
          <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 p-4">
            <p className="font-semibold text-rose-800 dark:text-rose-400 text-sm">Dev bypass active</p>
            <p className="mt-0.5 text-xs text-rose-700 dark:text-rose-300">
              Authentication is skipped. Local development only — remove before production.
            </p>
          </div>
        ) : null}
        <SectionHeader
          title="Student Dashboard"
          description={devBypass ? 'Temporary local access without OTP.' : 'View your attendance, performance, exam results, and timetable.'}
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Authenticated Phone"
            value={sessionData.user.phoneNormalized}
            badgeText={devBypass ? 'Dev Bypass' : 'Verified OTP'}
            badgeVariant={devBypass ? 'warning' : 'success'}
          />
          <StatCard
            title="Primary Role"
            value={primaryRole.replace(/_/g, ' ')}
            badgeText="Student Access"
            badgeVariant="primary"
          />
          <StatCard
            title="Session Status"
            value="Active"
            badgeText={devBypass ? 'Dev Bypass' : 'HttpOnly Cookie'}
            badgeVariant={devBypass ? 'info' : 'info'}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quick Links</CardTitle>
            <CardDescription>
              Select a section to continue.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            {STUDENT_QUICK_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="flex flex-col items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 text-center transition hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
              >
                <span className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-semibold">
                  {link.label}
                </span>
              </a>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Linked Profiles</CardTitle>
            <CardDescription>
              Your institute-linked profile identifiers.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-3 text-sm">
            <div className="flex flex-col gap-1">
              <span className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-semibold">
                Student ID
              </span>
              <span className="text-slate-900 dark:text-slate-100 font-medium">
                {sessionData.profiles?.studentId ?? 'none'}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-semibold">
                Teacher ID
              </span>
              <span className="text-slate-900 dark:text-slate-100 font-medium">
                {sessionData.profiles?.teacherProfileId ?? 'none'}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-semibold">
                Parent ID
              </span>
              <span className="text-slate-900 dark:text-slate-100 font-medium">
                {sessionData.profiles?.parentProfileId ?? 'none'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </PortalShell>
  );
}
