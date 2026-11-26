'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/data-display/empty-state';
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

const PARENT_QUICK_LINKS = [
  { label: 'Child Profile', href: '/parent/profile' },
  { label: 'Attendance', href: '/parent/attendance' },
  { label: 'Performance', href: '/parent/performance' },
  { label: 'Exam Results', href: '/parent/exam-results' },
  { label: 'Timetable', href: '/parent/timetable' },
  { label: 'Fee Status', href: '/parent/fees' },
];

export default function ParentDashboardPage() {
  const { sessionData, loading, errorMsg, handleRetry, handleLogout } = useSession();
  const [children, setChildren] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState('');

  const isAuthorized = hasAnyRole(sessionData, ['PARENT', 'SUPER_ADMIN', 'COACHING_ADMIN']);
  const isParentRole = hasAnyRole(sessionData, ['PARENT']);

  useEffect(() => {
    if (!sessionData || !isParentRole) return;

    let cancelled = false;
    async function loadChildren() {
      setDataLoading(true);
      setDataError('');
      try {
        const res = await apiFetch('/api/v1/parents/my-children');
        if (!cancelled) {
          setChildren(Array.isArray(res?.data) ? res.data : []);
        }
      } catch (err) {
        if (!cancelled) {
          setDataError(err?.message || 'Unable to load linked children.');
        }
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    }

    loadChildren();
    return () => {
      cancelled = true;
    };
  }, [sessionData, isParentRole]);

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

  const primaryRole = sessionData.roles?.[0] || 'PARENT';

  if (!isAuthorized) {
    return (
      <PortalShell
        roleName={primaryRole}
        roleLabel={primaryRole.replace(/_/g, ' ')}
        pageTitle="Parent Dashboard"
        activePath="/parent/dashboard"
        userLabel={sessionData.user.phoneNormalized}
        onLogout={handleLogout}
      >
        <ErrorBanner
          title="Access restricted"
          message="Parent privileges are required to view this portal."
        />
      </PortalShell>
    );
  }

  return (
    <PortalShell
      roleName={primaryRole}
      roleLabel="Parent"
      pageTitle="Parent Dashboard"
      activePath="/parent/dashboard"
      userLabel={sessionData.user.phoneNormalized}
      onLogout={handleLogout}
    >
      <div className="space-y-6">
        <SectionHeader
          title="Parent Dashboard"
          description="View your verified linked children’s attendance, performance, exam results, timetable, and fee status."
        />

        {dataError ? <ErrorBanner title="Unable to load children" message={dataError} /> : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Phone"
            value={sessionData.user.phoneNormalized}
            subtitle="Verified via WhatsApp OTP"
          />
          <StatCard
            title="Linked Children"
            value={dataLoading ? '...' : String(children.length)}
            subtitle="Verified guardian links"
          />
          <StatCard
            title="Role"
            value={primaryRole.replace(/_/g, ' ')}
            subtitle="Read-only guardian access"
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Verified Children</CardTitle>
            <CardDescription>Loaded from GET /api/v1/parents/my-children</CardDescription>
          </CardHeader>
          <CardContent>
            {dataLoading ? (
              <LoadingSkeleton rows={2} />
            ) : children.length === 0 ? (
              <EmptyState
                title="No verified children linked"
                description="Contact the coaching administration to link and verify your child's profile."
              />
            ) : (
              <div className="space-y-2">
                {children.map((child) => (
                  <div
                    key={child.studentId || child.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
                  >
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {child.fullName || child.studentName || child.studentId}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {child.admissionNumber || child.relationship || 'Verified student'}
                      </p>
                    </div>
                    <Badge variant="success">{child.verificationStatus || 'VERIFIED'}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:hidden">
          <CardHeader>
            <CardTitle>Quick Links</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {PARENT_QUICK_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {item.label}
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </PortalShell>
  );
}
