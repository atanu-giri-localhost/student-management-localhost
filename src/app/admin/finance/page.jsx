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
  { label: 'Collected', value: '₹12,84,500', subtitle: 'This month' },
  { label: 'Outstanding', value: '₹1,42,000', subtitle: 'Due' },
  { label: 'Overdue', value: '₹38,500', subtitle: 'Past due' },
  { label: 'Invoices', value: '864', subtitle: 'Generated' },
];

const INVOICES = [
  { number: 'INV-2026-0881', student: 'Aarav Sharma', amount: '₹1,500', status: 'PAID' },
  { number: 'INV-2026-0882', student: 'Diya Patel', amount: '₹1,500', status: 'PAID' },
  { number: 'INV-2026-0883', student: 'Kabir Singh', amount: '₹1,500', status: 'DUE' },
  { number: 'INV-2026-0884', student: 'Ananya Roy', amount: '₹1,500', status: 'OVERDUE' },
  { number: 'INV-2026-0885', student: 'Vivaan Mehta', amount: '₹1,500', status: 'PAID' },
  { number: 'INV-2026-0886', student: 'Ishita Nair', amount: '₹1,500', status: 'DUE' },
];

const PAYMENTS = [
  { receipt: 'RCPT-2026-0441', student: 'Aarav Sharma', amount: '₹1,500', method: 'UPI' },
  { receipt: 'RCPT-2026-0442', student: 'Diya Patel', amount: '₹1,500', method: 'Cash' },
  { receipt: 'RCPT-2026-0443', student: 'Vivaan Mehta', amount: '₹1,500', method: 'Card' },
];

function invoiceVariant(status) {
  if (status === 'PAID') return 'success';
  if (status === 'DUE') return 'warning';
  if (status === 'OVERDUE') return 'danger';
  return 'default';
}

export default function AdminFinancePage() {
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
      pageTitle="Finance & Mess Fees"
      activePath="/admin/finance"
      userLabel={sessionData.user.phoneNormalized}
      onLogout={handleLogout}
    >
      <div className="space-y-6">
        <SectionHeader
          title="Finance & Mess Fees"
          description="Invoices, payments, allocations, and receipts (integer paise ledger)."
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat) => (
            <StatCard key={stat.label} title={stat.label} value={stat.value} subtitle={stat.subtitle} />
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Invoices</CardTitle>
            <CardDescription>Recent invoices and their collection status.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-full border-collapse text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Invoice</th>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {INVOICES.map((inv) => (
                    <tr key={inv.number} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">{inv.number}</td>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{inv.student}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">{inv.amount}</td>
                      <td className="px-4 py-3"><Badge variant={invoiceVariant(inv.status)}>{inv.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payments & Receipts</CardTitle>
            <CardDescription>Recorded payments with receipt numbers.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-full border-collapse text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Receipt</th>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Method</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {PAYMENTS.map((p) => (
                    <tr key={p.receipt} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">{p.receipt}</td>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{p.student}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">{p.amount}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{p.method}</td>
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