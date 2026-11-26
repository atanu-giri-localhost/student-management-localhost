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
  { label: 'Total Teachers', value: '42', subtitle: 'Assigned faculty' },
  { label: 'Class Teachers', value: '18', subtitle: 'Regular + class' },
  { label: 'Pending Assign', value: '3', subtitle: 'Awaiting classes' },
  { label: 'Sessions', value: '2025-26', subtitle: 'Active' },
];

const TEACHERS = [
  { name: 'Anil Kumar', phone: '+919811100001', subjects: 'Mathematics', classes: 'X-A, X-B', type: 'CLASS_TEACHER' },
  { name: 'Sunita Devi', phone: '+919811100002', subjects: 'Science', classes: 'IX-A, IX-B', type: 'REGULAR_TEACHER' },
  { name: 'Ravi Verma', phone: '+919811100003', subjects: 'English', classes: 'VIII-A, VIII-B', type: 'REGULAR_TEACHER' },
  { name: 'Kavita Rao', phone: '+919811100004', subjects: 'Social Studies', classes: 'X-A', type: 'CLASS_TEACHER' },
  { name: 'Deepak Joshi', phone: '+919811100005', subjects: 'Hindi', classes: 'IX-A', type: 'REGULAR_TEACHER' },
  { name: 'Mona Das', phone: '+919811100006', subjects: 'Computer', classes: 'VIII-A', type: 'REGULAR_TEACHER' },
];

function typeVariant(type) {
  return type === 'CLASS_TEACHER' ? 'info' : 'default';
}

export default function AdminTeachersPage() {
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
      pageTitle="Teachers"
      activePath="/admin/teachers"
      userLabel={sessionData.user.phoneNormalized}
      onLogout={handleLogout}
    >
      <div className="space-y-6">
        <SectionHeader
          title="Teachers"
          description="Manage faculty, subject assignments, and class ownership."
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat) => (
            <StatCard key={stat.label} title={stat.label} value={stat.value} subtitle={stat.subtitle} />
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Faculty Directory</CardTitle>
            <CardDescription>Teachers and their current session assignments.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-full border-collapse text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Subjects</th>
                    <th className="px-4 py-3">Classes</th>
                    <th className="px-4 py-3">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {TEACHERS.map((t) => (
                    <tr key={t.phone} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{t.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">{t.phone}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{t.subjects}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{t.classes}</td>
                      <td className="px-4 py-3"><Badge variant={typeVariant(t.type)}>{t.type}</Badge></td>
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