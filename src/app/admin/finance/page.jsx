'use client';

import { ErrorBanner } from '@/components/data-display/error-banner';
import { EmptyState } from '@/components/data-display/empty-state';
import { LoadingSkeleton } from '@/components/data-display/loading-skeleton';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { StatCard } from '@/components/data-display/stat-card';
import { PortalShell } from '@/components/layout/portal-shell';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useSession } from '@/lib/auth/use-session';
import { useApiList } from '@/lib/auth/use-api-list';
import { formatINR } from '@/lib/money/format';

function invoiceVariant(status) {
  if (status === 'PAID') return 'success';
  if (status === 'DUE') return 'warning';
  if (status === 'OVERDUE') return 'danger';
  return 'default';
}

export default function AdminFinancePage() {
  const { sessionData, loading: sessionLoading, errorMsg: sessionError, handleRetry, handleLogout } = useSession();
  const invoices = useApiList('/api/v1/finance/invoices?pageSize=50');
  const payments = useApiList('/api/v1/finance/payments?pageSize=50');

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
  const loading = invoices.loading || payments.loading;
  const collected = payments.data.reduce((s, p) => s + (p.amountPaidPaise || 0), 0);

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
        <SectionHeader title="Finance & Mess Fees" description="Invoices, payments, allocations, and receipts (integer paise ledger)." />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Invoices" value={loading ? '—' : invoices.total} subtitle="Total generated" />
          <StatCard title="Payments" value={loading ? '—' : payments.total} subtitle="Recorded" />
          <StatCard title="Collected (loaded)" value={loading ? '—' : formatINR(collected)} subtitle="This page" />
          <StatCard title="Source" value="D1" subtitle="DB_FINANCE" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Invoices</CardTitle>
            <CardDescription>Recent invoices and their collection status.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {invoices.loading ? (
              <div className="p-4"><LoadingSkeleton rows={4} /></div>
            ) : invoices.errorMsg ? (
              <div className="p-4"><ErrorBanner title="Could not load invoices" message={invoices.errorMsg} onRetry={invoices.reload} /></div>
            ) : invoices.data.length === 0 ? (
              <div className="p-4"><EmptyState title="No invoices" description="Invoices will appear here once they are generated." /></div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full min-w-full border-collapse text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Invoice</th>
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Due Date</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {invoices.data.map((inv) => (
                      <tr key={inv.id} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">{inv.invoiceNumber}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">{inv.studentId?.slice(0, 8) ?? '—'}…</td>
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">{formatINR(inv.totalAmountPaise)}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">{inv.dueDate || '—'}</td>
                        <td className="px-4 py-3"><Badge variant={invoiceVariant(inv.status)}>{inv.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payments</CardTitle>
            <CardDescription>Recorded payments and their methods.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {payments.loading ? (
              <div className="p-4"><LoadingSkeleton rows={3} /></div>
            ) : payments.errorMsg ? (
              <div className="p-4"><ErrorBanner title="Could not load payments" message={payments.errorMsg} onRetry={payments.reload} /></div>
            ) : payments.data.length === 0 ? (
              <div className="p-4"><EmptyState title="No payments" description="Payments will appear here once they are recorded." /></div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full min-w-full border-collapse text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Method</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {payments.data.map((p) => (
                      <tr key={p.id} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">{p.studentId?.slice(0, 8) ?? '—'}…</td>
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">{formatINR(p.amountPaidPaise)}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{p.paymentMethod}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">{p.paymentDate || '—'}</td>
                        <td className="px-4 py-3"><Badge variant={p.status === 'POSTED' ? 'success' : 'default'}>{p.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PortalShell>
  );
}