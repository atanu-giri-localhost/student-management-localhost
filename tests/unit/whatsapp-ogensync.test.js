import { describe, expect, it, vi } from 'vitest';
import {
  buildIdempotencyKey,
  buildOtpMessageText,
  createOgensyncWhatsAppProvider,
} from '@/lib/whatsapp/ogensync';
import { createWhatsAppProvider } from '@/lib/whatsapp/provider';

describe('Transport by Ogensync WhatsApp provider adapter', () => {
  it('formats Idempotency-Key and plain-text OTP message cleanly', () => {
    const key = buildIdempotencyKey('11111111-1111-4111-8111-111111111111');
    expect(key).toBe('sms-otp-11111111-1111-4111-8111-111111111111');
    expect(key).toMatch(/^[A-Za-z0-9._:-]{8,128}$/);

    const text = buildOtpMessageText({
      otpCode: '492817',
      expiryMinutes: 5,
      instituteName: 'Apex Coaching Institute',
    });
    expect(text).toContain('492817');
    expect(text).toContain('5 minutes');
  });

  it('posts POST /v1/messages with Bearer token, Idempotency-Key, and text payload', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          jobId: 'job_c927f81a301',
          status: 'queued',
          statusUrl: '/v1/messages/job_c927f81a301',
          replayed: false,
          chargePaise: 80,
          refundedPaise: 0,
          currency: 'INR',
          pricingRevision: 1,
        }),
        { status: 202, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const provider = createOgensyncWhatsAppProvider({
      apiKey: 'trn_live_test_key',
      baseUrl: 'https://transport.ogensync.com/',
      fetchFn: fetchMock,
    });

    const result = await provider.sendOtp({
      phoneNormalized: '+919876543210',
      otpCode: '492817',
      challengeId: 'chal-uuid-001',
      expiryMinutes: 5,
    });

    expect(result).toEqual({
      ok: true,
      providerJobId: 'job_c927f81a301',
      status: 'queued',
      chargePaise: 80,
      replayed: false,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://transport.ogensync.com/v1/messages');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer trn_live_test_key');
    expect(init.headers['Idempotency-Key']).toBe('sms-otp-chal-uuid-001');
    expect(JSON.parse(init.body)).toEqual({
      phone: '+919876543210',
      type: 'text',
      message: expect.stringContaining('492817'),
    });
  });

  it('retries once on 503 with the exact same Idempotency-Key and avoids retry on 402 wallet errors', async () => {
    const transientFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { code: 'WHATSAPP_NOT_READY', message: 'Not ready' } }), {
          status: 503,
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jobId: 'job_retry_ok',
            status: 'queued',
            statusUrl: '/v1/messages/job_retry_ok',
            replayed: false,
          }),
          { status: 202 }
        )
      );

    const providerRetry = createOgensyncWhatsAppProvider({
      apiKey: 'trn_live_test_key',
      fetchFn: transientFetch,
    });

    const retried = await providerRetry.sendOtp({
      phoneNormalized: '+919876543210',
      otpCode: '112233',
      challengeId: 'chal-retry-1',
      expiryMinutes: 5,
    });
    expect(retried.ok).toBe(true);
    expect(retried.providerJobId).toBe('job_retry_ok');
    expect(transientFetch).toHaveBeenCalledTimes(2);
    expect(transientFetch.mock.calls[0][1].headers['Idempotency-Key']).toBe(
      transientFetch.mock.calls[1][1].headers['Idempotency-Key']
    );

    const walletErrorFetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: { code: 'INSUFFICIENT_WALLET_BALANCE', message: 'INSUFFICIENT_WALLET_BALANCE' },
        }),
        { status: 402 }
      )
    );
    const providerNoRetry = createOgensyncWhatsAppProvider({
      apiKey: 'trn_live_test_key',
      fetchFn: walletErrorFetch,
    });
    const failed = await providerNoRetry.sendOtp({
      phoneNormalized: '+919876543210',
      otpCode: '112233',
      challengeId: 'chal-402-1',
      expiryMinutes: 5,
    });
    expect(failed.ok).toBe(false);
    expect(failed.errorCode).toBe('INSUFFICIENT_WALLET_BALANCE');
    expect(failed.httpStatus).toBe(402);
    expect(walletErrorFetch).toHaveBeenCalledTimes(1);
  });

  it('checks GET /v1/session connection status and blocks MOCK provider in production', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          assignment: { id: 'asg_1', status: 'active' },
          connection: { connected: true, state: 'open' },
          waiting: false,
        }),
        { status: 200 }
      )
    );

    const ogensync = createOgensyncWhatsAppProvider({
      apiKey: 'trn_live_test_key',
      fetchFn: fetchMock,
    });
    const session = await ogensync.checkSessionStatus();
    expect(session).toEqual({ ok: true, connected: true, state: 'open' });

    expect(() =>
      createWhatsAppProvider({ WHATSAPP_PROVIDER: 'MOCK', ENVIRONMENT: 'production' })
    ).toThrow(/forbidden in production/i);

    const mockProvider = createWhatsAppProvider({ WHATSAPP_PROVIDER: 'MOCK', ENVIRONMENT: 'test' });
    expect(mockProvider.name).toBe('MOCK');
  });
});
