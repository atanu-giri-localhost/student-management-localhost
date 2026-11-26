'use client';

import { ErrorBanner } from '@/components/data-display/error-banner';
import { LoadingSkeleton } from '@/components/data-display/loading-skeleton';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { StatCard } from '@/components/data-display/stat-card';
import { PortalShell } from '@/components/layout/portal-shell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSession } from '@/lib/auth/use-session';

const TEACHER_QUICK_LINKS = [
  { label: 'My Classes', href: '/teacher/my-classes' },
  { label: 'Attendance', href: '/teacher/attendance' },
  { label: 'Performance', href: '/teacher/performance' },
  { label: 'Examinations', href: '/teacher/examinations' },
  { label: 'Timetable', href: '/teacher/timetable' },
  { label: 'Assigned Fees', href: '/teacher/assigned-fees' },
];

export default function TeacherDashboardPage() {
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

  const primaryRole = sessionData.roles?.[0] || 'TEACHER';

  return (
    <PortalShell
      roleName={primaryRole}
      roleLabel="Teacher"
      pageTitle="Teacher Dashboard"
      activePath="/teacher/dashboard"
      userLabel={sessionData.user.phoneNormalized}
      onLogout={handleLogout}
    >
      <div className="space-y-6">
        <SectionHeader
          title="Teacher Dashboard"
          description="View your assigned classes, attendance, and performance records."
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Phone"
            value={sessionData.user.phoneNormalized}
            subtitle="Verified via WhatsApp OTP"
          />
          <StatCard
            title="Role"
            value={primaryRole.replace(/_/g, ' ')}
            subtitle="Server-side RBAC enforced"
          />
          <StatCard
            title="Session"
            value="Active"
            subtitle="HttpOnly cookie"
          />
        </div>

        <Card className="lg:hidden">
          <CardHeader>
            <CardTitle>Quick Links</CardTitle>
            <CardDescription>
              Select a section to continue.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            {TEACHER_QUICK_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="flex flex-col items-center justify-between rounded-xl border border-slate-200 bg-white p-4 text-center transition-all duration-150 hover:-translate-y-0.5 hover:border-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-600"
              >
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
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
          <CardContent className="grid gap-4 sm:grid-cols-3 text-sm">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Teacher ID
              </span>
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {sessionData.profiles?.teacherProfileId ?? 'none'}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Student ID
              </span>
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {sessionData.profiles?.studentId ?? 'none'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </PortalShell>
  );
}