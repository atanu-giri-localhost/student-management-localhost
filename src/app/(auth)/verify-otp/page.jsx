'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { Brand } from '@/components/layout/brand';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeftIcon, LockIcon, PortalIcon } from '@/components/ui/icons';
import { ToastBanner } from '@/components/ui/toast';
import { resetClientSessionCache } from '@/lib/auth/use-session';
import { getPortalByKey } from '@/lib/portals';
import { cn } from '@/lib/utils';

function maskPhone(phone) {
  if (!phone || phone.length < 6) return phone || '';
  return `${phone.slice(0, 3)} ••••• ${phone.slice(-3)}`;
}

function VerifyOtpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phone = searchParams.get('phone') || '';
  const portal = getPortalByKey(searchParams.get('portal'));

  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [cooldown, setCooldown] = useState(60);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [statusMsg, setStatusMsg] = useState(
    'If your number is registered, a 6-digit OTP was sent to your WhatsApp.'
  );

  const inputRefs = useRef([]);
  const loginHref = portal ? `/login?portal=${portal.key}` : '/login';
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  function handleDigitChange(index, rawValue) {
    const cleaned = rawValue.replace(/\D/g, '');
    if (cleaned.length > 1) {
      const pasted = cleaned.slice(0, 6).split('');
      const next = ['', '', '', '', '', ''];
      for (let i = 0; i < pasted.length; i++) {
        next[i] = pasted[i];
      }
      setDigits(next);
      const focusIdx = Math.min(pasted.length, 5);
      inputRefs.current[focusIdx]?.focus();
      return;
    }

    const next = [...digits];
    next[index] = cleaned;
    setDigits(next);

    if (cleaned && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index, event) {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  async function handleVerify(event) {
    event.preventDefault();
    setErrorMsg('');

    if (!phone) {
      setErrorMsg('Missing phone number. Please return to login.');
      return;
    }

    const otp = digits.join('');
    if (!/^\d{6}$/.test(otp)) {
      setErrorMsg('Please enter all 6 digits of your OTP.');
      return;
    }

    setVerifying(true);
    try {
      const response = await fetch('/api/v1/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setErrorMsg(payload?.error?.message || 'Invalid or expired verification code.');
        return;
      }

      resetClientSessionCache();
      router.push('/dashboard');
    } catch {
      setErrorMsg('Network error while verifying OTP.');
    } finally {
      setVerifying(false);
    }
  }

  async function handleResend() {
    if (!phone || cooldown > 0 || resending) return;
    setErrorMsg('');
    setResending(true);

    try {
      const response = await fetch('/api/v1/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setErrorMsg(payload?.error?.message || 'Please wait before requesting another code.');
        return;
      }

      setCooldown(payload?.data?.cooldownSeconds ?? 60);
      setStatusMsg(payload?.data?.message || 'OTP request processed.');
    } catch {
      setErrorMsg('Network error while resending OTP.');
    } finally {
      setResending(false);
    }
  }

  return (
      <main className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-3 sm:px-4">
          <Brand />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href={loginHref} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              <ArrowLeftIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Back to sign in</span>
              <span className="sm:hidden">Back</span>
            </Link>
          </div>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-3xl">
           <Card className="rounded-2xl border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <CardHeader className="px-6 py-6">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                    portal?.accent.icon ?? 'bg-indigo-50 text-indigo-600'
                  )}
                >
                  <PortalIcon name={portal?.icon ?? 'admin'} className="h-5 w-5" />
                </span>
                <div>
                   <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {portal ? `${portal.label} portal` : 'Account verification'}
                  </p>
                  <CardTitle className="mt-0.5 text-xl">Enter WhatsApp OTP</CardTitle>
                </div>
              </div>
              <CardDescription className="mt-3">
                {phone
                  ? `We sent a 6-digit code to ${maskPhone(phone)} on WhatsApp.`
                  : 'Enter the 6-digit code sent to your WhatsApp.'}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5 px-6 pb-7">
              {errorMsg ? (
                <ToastBanner variant="error" title="Verification failed" message={errorMsg} />
              ) : (
                <ToastBanner variant="info" title="OTP dispatched" message={statusMsg} />
              )}

              <form onSubmit={handleVerify} className="space-y-5">
                <fieldset>
                   <legend className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    6-digit verification code
                  </legend>
                  <div className="grid grid-cols-6 gap-2">
                    {digits.map((digit, index) => (
                      <input
                        key={index}
                        ref={(el) => {
                          inputRefs.current[index] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        autoComplete={index === 0 ? 'one-time-code' : 'off'}
                        maxLength={6}
                        aria-label={`OTP digit ${index + 1}`}
                        value={digit}
                        onChange={(event) => handleDigitChange(index, event.target.value)}
                        onKeyDown={(event) => handleKeyDown(index, event)}
                         className="h-12 w-full rounded-lg border border-slate-300 bg-white text-center text-lg font-semibold text-slate-900 transition focus-visible:border-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    ))}
                  </div>
                </fieldset>

                <Button type="submit" disabled={verifying} className="w-full">
                  {verifying ? 'Verifying...' : 'Verify and sign in'}
                </Button>
              </form>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 text-sm">
                <button
                  type="button"
                  disabled={cooldown > 0 || resending || !phone}
                  onClick={handleResend}
                  className="font-medium text-indigo-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
                >
                  {cooldown > 0
                    ? `Resend code in ${cooldown}s`
                    : resending
                      ? 'Resending...'
                      : 'Resend OTP'}
                </button>

                <Link href={loginHref} className="font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
                  Use a different number
                </Link>
              </div>
            </CardContent>
          </Card>

           <p className="mt-4 flex items-start justify-center gap-2 px-4 text-center text-xs leading-5 text-slate-500 dark:text-slate-400">
            <LockIcon className="mt-0.5 h-4 w-4 shrink-0" />
            The code expires after a short time. Never share it with anyone.
          </p>
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

export default function VerifyOtpPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
          <p className="text-sm text-slate-500">Loading verification...</p>
        </main>
      }
    >
      <VerifyOtpContent />
    </Suspense>
  );
}
