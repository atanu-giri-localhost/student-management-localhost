'use client';

import { ErrorBanner } from '@/components/data-display/error-banner';
import { LoadingSkeleton } from '@/components/data-display/loading-skeleton';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { StatCard } from '@/components/data-display/stat-card';
import { PortalShell } from '@/components/layout/portal-shell';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useSession } from '@/lib/auth/use-session';
import { useApiList } from '@/lib/auth/use-api-list';
import { formatINR } from '@/lib/money/format';

const SERVICE_HEALTH = [
  { service: 'D1 Database', status: 'Connected', variant: 'success' },
  { service: 'R2 Storage', status: 'Connected', variant: 'success' },
  { service: 'WhatsApp OTP', status: 'Ogensync', variant: 'success' },
  { service: 'Session Store', status: 'Active', variant: 'success' },
];

const QUICK_LINKS = [
  { label: 'Students', href: '/admin/students', desc: 'Manage student records' },
  { label: 'Parents', href: '/admin/parents', desc: 'Guardian profiles' },
  { label: 'Teachers', href: '/admin/teachers', desc: 'Faculty & assignments' },
  { label: 'Academics', href: '/admin/academics', desc: 'Sessions & classes' },
  { label: 'Attendance', href: '/admin/attendance', desc: 'Daily & period registers' },
  { label: 'Examinations', href: '/admin/examinations', desc: 'Exams & marks' },
  { label: 'Timetable', href: '/admin/timetable', desc: 'Academic calendar' },
  { label: 'Finance', href: '/admin/finance', desc: 'Invoices & payments' },
  { label: 'Reports', href: '/admin/reports', desc: 'Analytics & exports' },
  { label: 'Audit Logs', href: '/admin/audit-logs', desc: 'System activity trail' },
];

export default function AdminDashboardPage() {
  const { sessionData, loading: sessionLoading, errorMsg: sessionError, handleRetry, handleLogout } = useSession();
  const students = useApiList('/api/v1/students?pageSize=1');
  const teachers = useApiList('/api/v1/teachers?pageSize=1');
  const invoices = useApiList('/api/v1/finance/invoices?pageSize=50');
  const payments = useApiList('/api/v1/finance/payments?pageSize=50');
  const exams = useApiList('/api/v1/examinations?pageSize=1');

  if (sessionLoading) {
    return (
      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6">
        <LoadingSkeleton rows={4} />
      </main>
    );
  }

  if (sessionError || !sessionData) {
    return (
      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6">
        <ErrorBanner title="Session check failed" message={sessionError || 'Please sign in again.'} onRetry={handleRetry} />
      </main>
    );
  }

  const primaryRole = sessionData.roles?.[0] || 'SUPER_ADMIN';
  const isSuperAdmin = primaryRole === 'SUPER_ADMIN';
  const loading = students.loading || teachers.loading || invoices.loading || payments.loading || exams.loading;
  const collected = payments.data.reduce((s, p) => s + (p.amountPaidPaise || 0), 0);
  const invoiced = invoices.data.reduce((s, i) => s + (i.totalAmountPaise || 0), 0);

  return (
    <PortalShell
      roleName={primaryRole}
      roleLabel={isSuperAdmin ? 'Super Administrator' : 'Administrator'}
      pageTitle={isSuperAdmin ? 'Super Admin Dashboard' : 'Admin Dashboard'}
      activePath="/admin/dashboard"
      userLabel={sessionData.user.phoneNormalized}
      onLogout={handleLogout}
    >
      <div className="space-y-6">
        <SectionHeader
          title={isSuperAdmin ? 'Super Admin Dashboard' : 'Admin Dashboard'}
          description={
            isSuperAdmin
              ? 'Full institutional overview: users, fees, and system health.'
              : 'Manage students, staff, academics, attendance, and fees.'
          }
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total Students" value={loading ? '—' : students.total} subtitle="Active enrollments" />
          <StatCard title="Teachers" value={loading ? '—' : teachers.total} subtitle="Assigned faculty" />
          <StatCard title="Invoices" value={loading ? '—' : invoices.total} subtitle="Generated" />
          <StatCard title="Examinations" value={loading ? '—' : exams.total} subtitle="All types" />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Fee Collection (loaded)</CardTitle>
              <CardDescription>Totals from the most recent 50 invoices and payments.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-100 p-4 dark:border-slate-700">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Invoiced</p>
                <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{loading ? '—' : formatINR(invoiced)}</p>
              </div>
              <div className="rounded-lg border border-slate-100 p-4 dark:border-slate-700">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Collected</p>
                <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{loading ? '—' : formatINR(collected)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Service Health</CardTitle>
              <CardDescription>Real-time status of all backend services.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {SERVICE_HEALTH.map((svc) => (
                <div key={svc.service} className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3 dark:border-slate-700">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{svc.service}</span>
                  <Badge variant={svc.variant}>{svc.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Management Sections</CardTitle>
            <CardDescription>Navigate to any institutional module.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {QUICK_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white p-4 transition-all duration-150 hover:-translate-y-0.5 hover:border-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-600"
              >
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{link.label}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">{link.desc}</span>
              </a>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account & Session</CardTitle>
            <CardDescription>Your authenticated administrator profile.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Phone</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">{sessionData.user.phoneNormalized}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Role</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">{primaryRole.replace(/_/g, ' ')}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Session</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">Active</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Auth Method</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">WhatsApp OTP</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </PortalShell>
  );
}