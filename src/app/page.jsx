import Link from 'next/link';
import { Brand } from '@/components/layout/brand';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { buttonVariants } from '@/components/ui/button';
import { ArrowRightIcon, LockIcon, PortalIcon } from '@/components/ui/icons';
import { PORTALS } from '@/lib/portals';
import { cn } from '@/lib/utils';

export default function HomePage() {
  const currentYear = new Date().getFullYear();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-3 sm:px-4">
          <Brand />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/login" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-center">
        <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-14 lg:py-16">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
              Student Management System
            </p>
             <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-slate-100">
              Sign in to your portal
            </h1>
             <p className="mt-3 max-w-sm text-sm leading-6 text-slate-600 sm:text-base dark:text-slate-400">
              Choose the role linked to your institute account to continue.
            </p>
             <p className="mt-6 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <LockIcon className="h-3.5 w-3.5 shrink-0" />
              Secure WhatsApp OTP sign-in · No password required
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {PORTALS.map((portal) => (
              <Link
                key={portal.key}
                href={portal.href}
                 className="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-slate-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
              >
                <span
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
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
                    <ArrowRightIcon className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500 dark:text-slate-600 dark:group-hover:text-slate-400" />
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

      <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
         <div className="mx-auto flex w-full max-w-5xl flex-col gap-1 px-4 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:text-slate-400">
          <p>© {currentYear} Apex Coaching Institute</p>
          <p>Need help? Contact the institute office.</p>
        </div>
      </footer>
    </div>
  );
}
