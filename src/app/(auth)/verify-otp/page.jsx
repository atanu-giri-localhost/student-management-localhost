'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ToastBanner } from '@/components/ui/toast';

function maskPhone(phone) {
  if (!phone || phone.length < 6) return phone || '';
  return `${phone.slice(0, 3)} ••••• ${phone.slice(-3)}`;
}

function VerifyOtpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phone = searchParams.get('phone') || '';

  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [cooldown, setCooldown] = useState(60);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [statusMsg, setStatusMsg] = useState(
    'If your number is registered, a 6-digit OTP was sent to your WhatsApp.'
  );

  const inputRefs = useRef([]);

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
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="px-6 py-6">
          <p className="text-xs font-semibold tracking-wider text-indigo-600 uppercase">
            Verification Required
          </p>
          <CardTitle className="mt-1 text-2xl font-bold">Enter WhatsApp OTP</CardTitle>
          <CardDescription>
            {phone ? `Code sent for ${maskPhone(phone)}` : 'Enter your 6-digit login verification code.'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5 px-6 pb-7">
          {errorMsg ? (
            <ToastBanner variant="error" title="Verification failed" message={errorMsg} />
          ) : (
            <ToastBanner variant="info" title="OTP Dispatched" message={statusMsg} />
          )}

          <form onSubmit={handleVerify} className="space-y-5">
            <fieldset>
              <legend className="mb-2 block text-xs font-medium text-slate-700">
                6-Digit Verification Code
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
                    onChange={(e) => handleDigitChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className="h-12 w-full rounded-lg border border-slate-300 bg-white text-center text-lg font-bold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                  />
                ))}
              </div>
            </fieldset>

            <Button type="submit" disabled={verifying} className="w-full">
              {verifying ? 'Verifying...' : 'Verify & Sign In'}
            </Button>
          </form>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 text-xs">
            <button
              type="button"
              disabled={cooldown > 0 || resending || !phone}
              onClick={handleResend}
              className="font-medium text-indigo-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
            >
              {cooldown > 0 ? `Resend code in ${cooldown}s` : resending ? 'Resending...' : 'Resend OTP'}
            </button>

            <Link href="/login" className="font-medium text-slate-600 hover:underline">
              Use different number
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Loading verification...</div>}>
      <VerifyOtpContent />
    </Suspense>
  );
}
