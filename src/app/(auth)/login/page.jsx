'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Brand } from '@/components/layout/brand';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  ArrowLeftIcon,
  LockIcon,
  PortalIcon,
} from '@/components/ui/icons';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToastBanner } from '@/components/ui/toast';
import { getPortalByKey, PORTALS } from '@/lib/portals';
import { cn } from '@/lib/utils';
import { normalizePhoneToE164 } from '@/lib/validation/common';

function sanitizePhoneInput(rawValue) {
  const digits = rawValue.replace(/\D/g, '');

  if (digits.length > 10 && (digits.startsWith('91') || digits.startsWith('0'))) {
    return digits.slice(digits.startsWith('0') ? 1 : 2).slice(0, 10);
  }

  return digits.slice(0, 10);
}

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPortal = getPortalByKey(searchParams.get('portal'));

  const [portalKey, setPortalKey] = useState(initialPortal?.key ?? null);
  const portal = getPortalByKey(portalKey);

  const [phoneInput, setPhoneInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const currentYear = new Date().getFullYear();

  function handlePortalChange(nextPortalKey) {
    setPortalKey(nextPortalKey);
    setErrorMsg('');

    const params = new URLSearchParams(searchParams.toString());
    params.set('portal', nextPortalKey);
    router.replace(`/login?${params.toString()}`, { scroll: false });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMsg('');

    let normalizedPhone;
    try {
      normalizedPhone = normalizePhoneToE164(phoneInput);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Enter a valid 10-digit mobile number.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/v1/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalizedPhone }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setErrorMsg(payload?.error?.message || 'Unable to send WhatsApp OTP. Please try again.');
        return;
      }

      const params = new URLSearchParams({ phone: normalizedPhone });
      if (portal?.key) {
        params.set('portal', portal.key);
      }
      router.push(`/verify-otp?${params.toString()}`);
    } catch {
      setErrorMsg('Network error while requesting WhatsApp OTP. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
      <main className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-3 sm:px-4">
          <Brand />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/"
              className={buttonVariants({ variant: 'ghost', size: 'sm' })}
            >
              <ArrowLeftIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Back to home</span>
              <span className="sm:hidden">Back</span>
            </Link>
          </div>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-3xl">
          <Card className="overflow-hidden rounded-2xl border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="grid lg:grid-cols-[0.92fr_1.08fr]">
                <aside className="hidden flex-col justify-between bg-slate-900 p-8 text-white lg:flex lg:p-8">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Apex Coaching Institute
                  </p>

                  <div className="mt-8 flex items-center gap-3">
                    <span
                      className={cn(
                        'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ring-1',
                        portal?.accent.darkIcon ?? 'bg-white/10 text-white ring-white/20'
                      )}
                    >
                      <PortalIcon name={portal?.icon ?? 'admin'} className="h-5 w-5" />
                    </span>
                    <div className="min-h-[48px]">
                      <p className="text-sm text-slate-400">
                        {portal ? `${portal.label} portal` : 'Secure portal access'}
                      </p>
                      <h2 className="mt-0.5 text-lg font-semibold">
                        {portal ? `${portal.title} sign in` : 'Sign in to your portal'}
                      </h2>
                    </div>
                  </div>

                  <p className="mt-5 min-h-[60px] max-w-sm text-sm leading-6 text-slate-300 lg:min-h-[60px]">
                    {portal
                      ? portal.loginDescription
                      : 'Access your institute account with a one-time verification code sent to your registered WhatsApp number.'}
                  </p>

                  <div className="mt-10 flex items-center gap-2 border-t border-white/10 pt-5 text-xs text-slate-400">
                  <LockIcon className="h-4 w-4" />
                  Secure WhatsApp OTP · No password required
                </div>
              </div>
              </aside>

              <div className="p-6 sm:p-8 lg:p-8">
                <div
                  role="group"
                  aria-label="Choose your portal"
                  className="grid grid-cols-2 sm:grid-cols-3 gap-2"
                >
                  {PORTALS.map((item) => {
                    const isActive = item.key === portal?.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => handlePortalChange(item.key)}
                          className={cn(
                            'flex h-9 items-center justify-center gap-1.5 rounded-lg border text-xs font-medium transition',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1',
                            'last:col-span-2 sm:last:col-span-1',
                            isActive
                              ? item.accent.tabActive
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700'
                          )}
                      >
                        <PortalIcon name={item.icon} className="h-3.5 w-3.5" />
                        {item.label}
                      </button>
                    );
                  })}
                </div>

                <div className="mx-auto w-full max-w-md mt-6">
                  <div className="mt-6 min-h-[160px] sm:min-h-[140px] lg:min-h-[120px]">
                    <p
                      className={cn(
                        'text-xs font-semibold uppercase tracking-wider',
                        portal?.accent.text ?? 'text-indigo-600'
                      )}
                    >
                      {portal ? `${portal.label} portal` : 'Portal sign in'}
                    </p>
                    <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                      {portal ? `Sign in as ${portal.title}` : 'Sign in to your portal'}
                    </h1>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                      {portal
                        ? `Enter the WhatsApp number registered to your ${portal.title.toLowerCase()} account. We will send a 6-digit verification code.`
                        : 'Enter the WhatsApp number registered with the institute. We will send a 6-digit verification code.'}
                    </p>
                  </div>

                  {errorMsg ? (
                    <ToastBanner
                      variant="error"
                      title="Could not send OTP"
                      message={errorMsg}
                      className="mt-5"
                    />
                  ) : null}

                  <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="phone-input" required>
                        WhatsApp number
                      </Label>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-10 shrink-0 items-center rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          +91
                        </span>
                        <div className="min-w-0 flex-1">
                          <Input
                            id="phone-input"
                            type="tel"
                            inputMode="numeric"
                            autoComplete="tel"
                            placeholder="98765 43210"
                            value={phoneInput}
                            onChange={(event) => setPhoneInput(sanitizePhoneInput(event.target.value))}
                            hasError={Boolean(errorMsg)}
                            aria-describedby="phone-help"
                            required
                          />
                        </div>
                      </div>
                      <p id="phone-help" className="text-xs text-slate-500 dark:text-slate-400">
                        10-digit mobile number registered with the institute.
                      </p>
                    </div>

                    <Button type="submit" disabled={submitting} className="w-full">
                      {submitting ? 'Sending OTP...' : 'Send WhatsApp OTP'}
                    </Button>
                  </form>

                  <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    <LockIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      If the number is registered, you will receive an OTP on WhatsApp. Accounts
                      are created by the institute office.
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-1 px-4 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {currentYear} Apex Coaching Institute</p>
          <p>Student Management System</p>
        </div>
      </footer>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
          <p className="text-sm text-slate-500">Loading sign-in...</p>
        </main>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
