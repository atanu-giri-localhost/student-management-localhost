'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ErrorBanner } from '@/components/data-display/error-banner';
import { LoadingSkeleton } from '@/components/data-display/loading-skeleton';
import { StatCard } from '@/components/data-display/stat-card';
import { PortalShell } from '@/components/layout/portal-shell';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSession } from '@/lib/auth/use-session';
import { apiFetch } from '@/lib/http/api-client';
import { hasAnyRole } from '@/lib/portals';

const QUICK_LINKS = [
  { label: 'Students', href: '/admin/students', desc: 'Manage student records' },
  { label: 'Parents', href: '/admin/parents', desc: 'Guardian profiles' },
  { label: 'Teachers', href: '/admin/teachers', desc: 'Faculty & assignments' },
  { label: 'Academics', href: '/admin/academics', desc: 'Sessions & classes' },
  { label: 'Attendance', href: '/admin/attendance', desc: 'Daily & period registers' },
  { label: 'Examinations', href: '/admin/examinations', desc: 'Exams & marks' },
  { label: 'Timetable', href: '/admin/timetable', desc: 'Weekly schedule' },
  { label: 'Finance', href: '/admin/finance', desc: 'Invoices & payments' },
  { label: 'Reports', href: '/admin/reports', desc: 'Analytics & exports' },
  { label: 'Audit Logs', href: '/admin/audit-logs', desc: 'System activity trail' },
];

export default function AdminDashboardPage() {
  const { sessionData, loading, errorMsg, handleRetry, handleLogout } = useSession();
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState('');
  const [counts, setCounts] = useState({ users: null, students: null, teachers: null, parents: null });
  const [health, setHealth] = useState(null);

  const isAuthorized = hasAnyRole(sessionData, ['SUPER_ADMIN', 'COACHING_ADMIN']);

  useEffect(() => {
    if (!sessionData || !isAuthorized) return;

    let cancelled = false;
    async function loadDashboard() {
      setMetricsLoading(true);
      setMetricsError('');
      const [healthRes, usersRes, studentsRes, teachersRes, parentsRes] = await Promise.allSettled([
        apiFetch('/api/v1/health'),
        apiFetch('/api/v1/users?page=1&pageSize=1'),
        apiFetch('/api/v1/students?page=1&pageSize=1'),
        apiFetch('/api/v1/teachers?page=1&pageSize=1'),
        apiFetch('/api/v1/parents?page=1&pageSize=1'),
      ]);

      if (cancelled) return;

      if (healthRes.status === 'fulfilled') {
        setHealth(healthRes.value?.data ?? null);
      }
      setCounts({
        users: usersRes.status === 'fulfilled' ? usersRes.value?.pagination?.total ?? 0 : null,
        students: studentsRes.status === 'fulfilled' ? studentsRes.value?.pagination?.total ?? 0 : null,
        teachers: teachersRes.status === 'fulfilled' ? teachersRes.value?.pagination?.total ?? 0 : null,
        parents: parentsRes.status === 'fulfilled' ? parentsRes.value?.pagination?.total ?? 0 : null,
      });

      const allFailed = [healthRes, usersRes, studentsRes, teachersRes, parentsRes].every(
        (res) => res.status === 'rejected'
      );
      if (allFailed) {
        setMetricsError('Unable to load live institutional metrics.');
      }
      setMetricsLoading(false);
    }

    loadDashboard();
    return () => {
      cancelled = true;
    };
  }, [sessionData, isAuthorized]);

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

  const primaryRole = sessionData.roles?.[0] || 'COACHING_ADMIN';

  if (!isAuthorized) {
    return (
      <PortalShell
        roleName={primaryRole}
        roleLabel={primaryRole.replace(/_/g, ' ')}
        pageTitle="Admin Dashboard"
        activePath="/admin/dashboard"
        userLabel={sessionData.user.phoneNormalized}
        onLogout={handleLogout}
      >
        <ErrorBanner
          title="Access restricted"
          message="Administrator privileges are required to view the Admin Dashboard."
        />
      </PortalShell>
    );
  }

  return (
    <PortalShell
      roleName={primaryRole}
      roleLabel={primaryRole.replace(/_/g, ' ')}
      pageTitle="Admin Dashboard"
      activePath="/admin/dashboard"
      userLabel={sessionData.user.phoneNormalized}
      onLogout={handleLogout}
    >
      <div className="space-y-6">
        <SectionHeader
          title="Admin Dashboard"
          description="Live institutional overview backed by the 8-D1 domain APIs."
        />

        {metricsError ? <ErrorBanner title="Metrics unavailable" message={metricsError} /> : null}

        {metricsLoading ? (
          <LoadingSkeleton rows={2} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total Users"
              value={counts.users !== null ? String(counts.users) : '—'}
              subtitle="DB_IDENTITY users"
            />
            <StatCard
              title="Students"
              value={counts.students !== null ? String(counts.students) : '—'}
              subtitle="DB_STUDENTS records"
            />
            <StatCard
              title="Teachers"
              value={counts.teachers !== null ? String(counts.teachers) : '—'}
              subtitle="DB_ACADEMICS faculty"
            />
            <StatCard
              title="Parents"
              value={counts.parents !== null ? String(counts.parents) : '—'}
              subtitle="DB_STUDENTS guardians"
            />
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Runtime Health</CardTitle>
              <CardDescription>Live D1 readiness from GET /api/v1/health</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {health ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant={health.status === 'ok' ? 'success' : 'danger'}>
                    {health.status === 'ok' ? 'Healthy' : 'Degraded'}
                  </Badge>
                  <span className="text-slate-600 dark:text-slate-400">
                    Mode: {health.mode || 'readiness'}
                    {Array.isArray(health.databases) ? ` • ${health.databases.length} D1 bindings verified` : ''}
                  </span>
                </div>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Health telemetry unavailable.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Session Context</CardTitle>
              <CardDescription>Authenticated administrator identity</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <div>Phone: <span className="font-medium text-slate-900 dark:text-slate-100">{sessionData.user.phoneNormalized}</span></div>
              <div>Role: <span className="font-medium text-slate-900 dark:text-slate-100">{primaryRole.replace(/_/g, ' ')}</span></div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quick Links</CardTitle>
            <CardDescription>Jump to any institutional module</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {QUICK_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-3 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                >
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{item.label}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{item.desc}</p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </PortalShell>
  );
}
