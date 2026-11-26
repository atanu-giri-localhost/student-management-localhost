'use client';

import { ErrorBanner } from '@/components/data-display/error-banner';
import { LoadingSkeleton } from '@/components/data-display/loading-skeleton';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { StatCard } from '@/components/data-display/stat-card';
import { PortalShell } from '@/components/layout/portal-shell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useSession } from '@/lib/auth/use-session';

const STATS = [
  { label: 'Reports', value: '6', subtitle: 'Available' },
  { label: 'Scheduled', value: '3', subtitle: 'Automated' },
  { label: 'Last Export', value: 'Today', subtitle: '09:42 AM' },
  { label: 'Formats', value: 'CSV', subtitle: 'PDF ready' },
];

const REPORTS = [
  { name: 'Attendance Summary', desc: 'Daily & period attendance across classes', href: '#' },
  { name: 'Fee Collection', desc: 'Invoices, payments, outstanding by class', href: '#' },
  { name: 'Student Performance', desc: 'Exam marks and averages per subject', href: '#' },
  { name: 'Parent Linkage', desc: 'Verified guardians and linked students', href: '#' },
  { name: 'Teacher Assignments', desc: 'Faculty, subjects, and class ownership', href: '#' },
  { name: 'Audit Trail', desc: 'System activity and change history', href: '#' },
];

export default function AdminReportsPage() {
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
      pageTitle="Reports"
      activePath="/admin/reports"
      userLabel={sessionData.user.phoneNormalized}
      onLogout={handleLogout}
    >
      <div className="space-y-6">
        <SectionHeader
          title="Reports"
          description="Generate and export institutional analytics and data."
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat) => (
            <StatCard key={stat.label} title={stat.label} value={stat.value} subtitle={stat.subtitle} />
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {REPORTS.map((r) => (
            <Card key={r.name} className="flex flex-col">
              <CardHeader>
                <CardTitle>{r.name}</CardTitle>
                <CardDescription>{r.desc}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <a
                  href={r.href}
                  className="inline-flex h-9 items-center justify-center rounded-lg bg-blue-600 px-4 text-xs font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                >
                  Export CSV
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </PortalShell>
  );
}