import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatINR } from '@/lib/money/format';

const PORTAL_LINKS = [
  {
    role: 'Admin Portal',
    href: '/login?portal=admin',
    badge: 'Staff & Finance',
    badgeVariant: 'primary',
    description: 'Admissions, academic sessions, timetable, and integer-paise fee & mess ledger.',
  },
  {
    role: 'Teacher Portal',
    href: '/login?portal=teacher',
    badge: 'Academic Scope',
    badgeVariant: 'info',
    description: 'Daily and period attendance registers, class tests, and assigned class views.',
  },
  {
    role: 'Student Portal',
    href: '/login?portal=student',
    badge: 'Academics Only',
    badgeVariant: 'success',
    description: 'Attendance summary, daily test performance, exam results, and class timetable.',
  },
  {
    role: 'Parent Portal',
    href: '/login?portal=parent',
    badge: 'Multi-Child',
    badgeVariant: 'warning',
    description: 'Verified multi-child switcher, academic progress, and read-only fee receipts.',
  },
];

export default function HomePage() {
  const sampleFeeDisplay = formatINR(360000);

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-12">
      <Card className="overflow-hidden rounded-2xl shadow-sm">
        <CardHeader className="flex flex-col gap-4 border-b border-slate-200 px-8 py-7 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-wider text-indigo-600 uppercase">
              Apex Coaching Institute
            </p>
            <CardTitle className="mt-1 text-3xl font-bold tracking-tight">
              Student Management System
            </CardTitle>
            <CardDescription className="mt-2 max-w-2xl">
              Single-institution coaching academics, dual attendance tracking, and coaching + mess
              fee management powered by Cloudflare Workers and D1.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/login"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-indigo-600 px-5 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              Sign in with WhatsApp OTP
            </Link>
            <a
              href="/api/v1/health"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Health Check
            </a>
          </div>
        </CardHeader>

        <CardContent className="p-8">
          <div className="grid gap-4 sm:grid-cols-2">
            {PORTAL_LINKS.map((portal) => (
              <Link
                key={portal.role}
                href={portal.href}
                className="group rounded-xl border border-slate-200 bg-slate-50 p-5 transition hover:border-indigo-300 hover:bg-white"
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-slate-900 group-hover:text-indigo-600">
                    {portal.role}
                  </h2>
                  <Badge variant={portal.badgeVariant}>{portal.badge}</Badge>
                </div>
                <p className="mt-2 text-sm text-slate-600">{portal.description}</p>
              </Link>
            ))}
          </div>

          <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-5 text-xs text-slate-500">
            <span>Phase 1 Complete · Cloudflare Workers + Direct D1 + R2</span>
            <span>Sample INR ledger format: {sampleFeeDisplay}</span>
          </footer>
        </CardContent>
      </Card>
    </main>
  );
}
