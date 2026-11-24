'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToastBanner } from '@/components/ui/toast';
import { normalizePhoneToE164 } from '@/lib/validation/common';

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const portalHint = searchParams.get('portal');

  const [phoneInput, setPhoneInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMsg('');

    let normalizedPhone;
    try {
      normalizedPhone = normalizePhoneToE164(phoneInput);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Enter a valid 10-digit or E.164 mobile number.');
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
      if (portalHint) params.set('portal', portalHint);
      router.push(`/verify-otp?${params.toString()}`);
    } catch {
      setErrorMsg('Network error while requesting WhatsApp OTP. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="px-6 py-6">
          <p className="text-xs font-semibold tracking-wider text-indigo-600 uppercase">
            Apex Coaching Institute
          </p>
          <CardTitle className="mt-1 text-2xl font-bold">Sign in with WhatsApp OTP</CardTitle>
          <CardDescription>
            Enter your registered mobile number to receive a 6-digit login verification code on
            WhatsApp.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5 px-6 pb-7">
          {errorMsg ? <ToastBanner variant="error" title="Could not send OTP" message={errorMsg} /> : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="phone-input" required>
                Registered WhatsApp Number
              </Label>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-slate-100 px-3 text-sm font-medium text-slate-600">
                  +91 / E.164
                </span>
                <Input
                  id="phone-input"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="9876543210 or +919876543210"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  hasError={Boolean(errorMsg)}
                  required
                />
              </div>
              <p className="text-xs text-slate-500">
                Accounts are provisioned by institute administration.
              </p>
            </div>

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? 'Sending OTP...' : 'Send WhatsApp OTP'}
            </Button>
          </form>

          <div className="border-t border-slate-100 pt-4 text-center text-xs text-slate-500">
            <Link href="/" className="font-medium text-indigo-600 hover:underline">
              ← Back to Portal Home
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Loading login...</div>}>
      <LoginFormContent />
    </Suspense>
  );
}
