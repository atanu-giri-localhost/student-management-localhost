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
  { label: 'Total Parents', value: '712', subtitle: 'Verified guardians' },
  { label: 'Pending Verify', value: '18', subtitle: 'Awaiting approval' },
  { label: 'Linked Children', value: '864', subtitle: 'Parent-student links' },
  { label: 'Read-only Fees', value: 'Enabled', subtitle: 'MVP access' },
];

const PARENTS = [
  { name: 'Rajesh Sharma', phone: '+919812345001', children: 'Aarav Sharma (X-A)', status: 'VERIFIED' },
  { name: 'Meena Patel', phone: '+919812345002', children: 'Diya Patel (X-B)', status: 'VERIFIED' },
  { name: 'Suresh Singh', phone: '+919812345003', children: 'Kabir Singh (IX-A)', status: 'VERIFIED' },
  { name: 'Lakshmi Roy', phone: '+919812345004', children: 'Ananya Roy (IX-B)', status: 'PENDING' },
  { name: 'Nikhil Mehta', phone: '+919812345005', children: 'Vivaan Mehta (VIII-A)', status: 'VERIFIED' },
  { name: 'Priya Nair', phone: '+919812345006', children: 'Ishita Nair (VIII-B)', status: 'PENDING' },
];

function statusVariant(status) {
  return status === 'VERIFIED' ? 'success' : 'warning';
}

export default function AdminParentsPage() {
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
      pageTitle="Parents"
      activePath="/admin/parents"
      userLabel={sessionData.user.phoneNormalized}
      onLogout={handleLogout}
    >
      <div className="space-y-6">
        <SectionHeader
          title="Parents"
          description="Manage guardian profiles, verification, and child links."
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat) => (
            <StatCard key={stat.label} title={stat.label} value={stat.value} subtitle={stat.subtitle} />
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Parent Directory</CardTitle>
            <CardDescription>Guardian accounts and their linked students.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-full border-collapse text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Child</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {PARENTS.map((p) => (
                    <tr key={p.phone} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{p.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">{p.phone}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{p.children}</td>
                      <td className="px-4 py-3"><Badge variant={statusVariant(p.status)}>{p.status}</Badge></td>
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