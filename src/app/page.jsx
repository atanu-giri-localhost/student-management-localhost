import Link from 'next/link';
import { Brand } from '@/components/layout/brand';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { ArrowRightIcon, LockIcon, PortalIcon } from '@/components/ui/icons';
import { PORTALS } from '@/lib/portals';
import { cn } from '@/lib/utils';

export default function HomePage() {
  const currentYear = new Date().getFullYear();

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
      <header className="shrink-0 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Brand />
          <ThemeToggle />
        </div>
      </header>

      <main className="flex flex-1 items-center overflow-y-auto">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-16">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-600">
              Apex Coaching Institute
            </p>
            <h1 className="mt-3 text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl dark:text-slate-100">
              Attendance, fees, and results in one place
            </h1>
            <p className="mt-4 max-w-md text-lg leading-8 text-slate-600 dark:text-slate-400">
              Parents track attendance and pay fees. Students check timetables and
              marks. Teachers mark attendance and enter scores.
            </p>
            <p className="mt-6 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <LockIcon className="h-4 w-4 shrink-0" />
              WhatsApp OTP sign-in. No password to remember.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {PORTALS.map((portal) => (
              <Link
                key={portal.key}
                href={portal.href}
                className="group flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-600"
              >
                <span
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105',
                    portal.accent.icon
                  )}
                >
                  <PortalIcon name={portal.icon} className="h-5 w-5" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {portal.label} portal
                    </span>
                    <ArrowRightIcon className="h-4 w-4 shrink-0 text-slate-300 transition-all duration-200 group-hover:translate-x-1 group-hover:text-blue-600 dark:text-slate-600 dark:group-hover:text-blue-400" />
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {portal.description}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </main>

      <footer className="shrink-0 border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:text-slate-400">
          <p>© {currentYear} Apex Coaching Institute</p>
          <p>Need help? Contact the institute office.</p>
        </div>
      </footer>
    </div>
  );
}