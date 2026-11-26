'use client';

import { ErrorBanner } from '@/components/data-display/error-banner';
import { LoadingSkeleton } from '@/components/data-display/loading-skeleton';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { StatCard } from '@/components/data-display/stat-card';
import { PortalShell } from '@/components/layout/portal-shell';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSession } from '@/lib/auth/use-session';
import { cn } from '@/lib/utils';

const SYSTEM_STATS = [
  { label: 'Total Users', value: '1,284', subtitle: 'Across all roles' },
  { label: 'Students', value: '856', subtitle: 'Active enrollments' },
  { label: 'Teachers', value: '42', subtitle: 'Assigned faculty' },
  { label: 'Parents', value: '712', subtitle: 'Verified guardians' },
];

const ROLE_DISTRIBUTION = [
  { role: 'Students', count: 856, pct: 67, color: 'bg-blue-500 dark:bg-blue-700' },
  { role: 'Parents', count: 712, pct: 55, color: 'bg-blue-400 dark:bg-blue-600' },
  { role: 'Teachers', count: 42, pct: 3, color: 'bg-blue-300 dark:bg-blue-500' },
  { role: 'Admins', count: 8, pct: 1, color: 'bg-blue-200 dark:bg-blue-400' },
];

const FEE_SUMMARY = [
  { label: 'Collected', amount: '₹12,84,500', status: 'PAID', variant: 'success' },
  { label: 'Outstanding', amount: '₹1,42,000', status: 'DUE', variant: 'warning' },
  { label: 'Overdue', amount: '₹38,500', status: 'OVERDUE', variant: 'danger' },
];

const RECENT_AUDIT_LOGS = [
  { action: 'CREATE', entity: 'PAYMENT', entityId: '2d000000-...0001', actor: 'admin@apex', time: '2 min ago' },
  { action: 'UPDATE', entity: 'STUDENT', entityId: '14000000-...0002', actor: 'admin@apex', time: '15 min ago' },
  { action: 'CREATE', entity: 'INVOICE', entityId: '2b000000-...0003', actor: 'admin@apex', time: '1 hour ago' },
  { action: 'REVOKE', entity: 'SESSION', entityId: 'sess_...a3f2', actor: 'superadmin', time: '2 hours ago' },
  { action: 'UPDATE', entity: 'TEACHER_ASSIGNMENT', entityId: '1c000000-...0002', actor: 'admin@apex', time: '3 hours ago' },
];

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
  { label: 'Timetable', href: '/admin/timetable', desc: 'Weekly schedule' },
  { label: 'Finance', href: '/admin/finance', desc: 'Invoices & payments' },
  { label: 'Reports', href: '/admin/reports', desc: 'Analytics & exports' },
  { label: 'Audit Logs', href: '/admin/audit-logs', desc: 'System activity trail' },
];

const SESSION_TREND = [
  { label: 'Mon', value: 142 },
  { label: 'Tue', value: 168 },
  { label: 'Wed', value: 155 },
  { label: 'Thu', value: 182 },
  { label: 'Fri', value: 175 },
  { label: 'Sat', value: 98 },
];

function auditActionVariant(action) {
  if (action === 'CREATE') return 'success';
  if (action === 'UPDATE') return 'info';
  if (action === 'REVOKE') return 'danger';
  return 'default';
}

export default function AdminDashboardPage() {
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
              ? 'Full institutional overview: users, fees, audit logs, and system health.'
              : 'Manage students, staff, academics, attendance, and fees.'
          }
        />

        {/* System Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SYSTEM_STATS.map((stat) => (
            <StatCard
              key={stat.label}
              title={stat.label}
              value={stat.value}
              subtitle={stat.subtitle}
            />
          ))}
        </div>

        {/* Role Distribution + Session Trend */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>User Distribution</CardTitle>
              <CardDescription>Breakdown by role across the institution.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {ROLE_DISTRIBUTION.map((item) => (
                <div key={item.role} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{item.role}</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{item.count}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className={cn('h-full rounded-full transition-all', item.color)}
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Active Sessions</CardTitle>
              <CardDescription>Daily logged-in users this week.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex h-40 items-end justify-between gap-2 sm:gap-4">
                {SESSION_TREND.map((point) => (
                  <div key={point.label} className="flex flex-1 flex-col items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{point.value}</span>
                    <div
                      className="w-full max-w-12 rounded-t-lg bg-blue-500 dark:bg-blue-700 transition-all"
                      style={{ height: `${point.value * 0.8}px` }}
                    />
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{point.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Fee Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Fee Collection Summary</CardTitle>
            <CardDescription>Current month invoice status across all classes.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            {FEE_SUMMARY.map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-slate-100 dark:border-slate-700 p-4 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {item.label}
                  </p>
                  <Badge variant={item.variant}>{item.status}</Badge>
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{item.amount}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Audit Logs + Service Health */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Audit Logs</CardTitle>
              <CardDescription>Latest system activity across all modules.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="w-full overflow-x-auto">
                <table className="w-full min-w-full border-collapse text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3">Entity</th>
                      <th className="px-4 py-3">Actor</th>
                      <th className="px-4 py-3">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {RECENT_AUDIT_LOGS.map((log, i) => (
                      <tr key={i} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3">
                          <Badge variant={auditActionVariant(log.action)}>{log.action}</Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                          {log.entity}
                          <span className="block text-xs text-slate-400 dark:text-slate-500">{log.entityId}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{log.actor}</td>
                        <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{log.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                <div
                  key={svc.service}
                  className="flex items-center justify-between rounded-lg border border-slate-100 dark:border-slate-700 px-4 py-3"
                >
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{svc.service}</span>
                  <Badge variant={svc.variant}>{svc.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Quick Links */}
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

        {/* Account Info */}
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