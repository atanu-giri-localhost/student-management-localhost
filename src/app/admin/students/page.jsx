'use client';

import { ErrorBanner } from '@/components/data-display/error-banner';
import { LoadingSkeleton } from '@/components/data-display/loading-skeleton';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { StatCard } from '@/components/data-display/stat-card';
import { PortalShell } from '@/components/layout/portal-shell';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useSession } from '@/lib/auth/use-session';

const STATS = [
  { label: 'Total Students', value: '856', subtitle: 'Active enrollments' },
  { label: 'New This Month', value: '24', subtitle: 'Fresh admissions' },
  { label: 'Inactive', value: '12', subtitle: 'Dropped / paused' },
  { label: 'Classes', value: '18', subtitle: 'Across sessions' },
];

const STUDENTS = [
  { roll: 'SMS-2026-0042', name: 'Aarav Sharma', className: 'X-A', session: '2025-26', status: 'ACTIVE' },
  { roll: 'SMS-2026-0043', name: 'Diya Patel', className: 'X-B', session: '2025-26', status: 'ACTIVE' },
  { roll: 'SMS-2026-0044', name: 'Kabir Singh', className: 'IX-A', session: '2025-26', status: 'ACTIVE' },
  { roll: 'SMS-2026-0045', name: 'Ananya Roy', className: 'IX-B', session: '2025-26', status: 'INACTIVE' },
  { roll: 'SMS-2026-0046', name: 'Vivaan Mehta', className: 'VIII-A', session: '2025-26', status: 'ACTIVE' },
  { roll: 'SMS-2026-0047', name: 'Ishita Nair', className: 'VIII-B', session: '2025-26', status: 'ACTIVE' },
];

function statusVariant(status) {
  return status === 'ACTIVE' ? 'success' : 'default';
}

export default function AdminStudentsPage() {
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
      pageTitle="Students"
      activePath="/admin/students"
      userLabel={sessionData.user.phoneNormalized}
      onLogout={handleLogout}
    >
      <div className="space-y-6">
        <SectionHeader
          title="Students"
          description="Manage student records, admissions, and enrollments."
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat) => (
            <StatCard key={stat.label} title={stat.label} value={stat.value} subtitle={stat.subtitle} />
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Students</CardTitle>
            <CardDescription>Student directory across all classes and sessions.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-full border-collapse text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Roll No</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Class</th>
                    <th className="px-4 py-3">Session</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {STUDENTS.map((s) => (
                    <tr key={s.roll} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">{s.roll}</td>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{s.name}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{s.className}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{s.session}</td>
                      <td className="px-4 py-3"><Badge variant={statusVariant(s.status)}>{s.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </PortalShell>
  );
}