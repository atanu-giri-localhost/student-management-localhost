import { describe, expect, it } from 'vitest';
import { assertSameOrigin, getAllowedOrigins, parseOrigin } from '@/lib/http/csrf';

describe('CSRF and Same-Origin protection helpers', () => {
  it('allows safe HTTP methods without Origin or Referer headers', () => {
    const getReq = new Request('https://sms.example.com/api/v1/students', { method: 'GET' });
    const headReq = new Request('https://sms.example.com/api/v1/health', { method: 'HEAD' });
    expect(assertSameOrigin(getReq)).toBeNull();
    expect(assertSameOrigin(headReq)).toBeNull();
  });

  it('allows mutating requests with matching Origin header', () => {
    const req = new Request('http://localhost:3000/api/v1/auth/otp/request', {
      method: 'POST',
      headers: {
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
      },
    });
    expect(assertSameOrigin(req, { requestId: 'req_csrf_1' })).toBeNull();
  });

  it('allows mutating requests matching NEXT_PUBLIC_APP_URL via workerEnv', () => {
    const req = new Request('http://internal.worker/api/v1/payments', {
      method: 'POST',
      headers: {
        origin: 'https://portal.apexcoaching.in',
      },
    });
    const allowed = getAllowedOrigins(req, {
      NEXT_PUBLIC_APP_URL: 'https://portal.apexcoaching.in/login',
    });
    expect(allowed.has('https://portal.apexcoaching.in')).toBe(true);
    expect(
      assertSameOrigin(req, {
        workerEnv: { NEXT_PUBLIC_APP_URL: 'https://portal.apexcoaching.in' },
      })
    ).toBeNull();
  });

  it('falls back to Referer origin when Origin header is omitted', () => {
    const req = new Request('http://localhost:3000/api/v1/students', {
      method: 'PATCH',
      headers: {
        referer: 'http://localhost:3000/admin/students',
      },
    });
    expect(assertSameOrigin(req)).toBeNull();
  });

  it('rejects mutating requests with missing Origin and Referer headers (403)', async () => {
    const req = new Request('http://localhost:3000/api/v1/students', {
      method: 'POST',
    });
    const res = assertSameOrigin(req, { requestId: 'req_csrf_missing' });
    expect(res).not.toBeNull();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('CSRF_ORIGIN_MISMATCH');
    expect(body.meta.requestId).toBe('req_csrf_missing');
  });

  it('rejects cross-origin and null-origin mutating requests (403)', async () => {
    const evilReq = new Request('http://localhost:3000/api/v1/payments', {
      method: 'POST',
      headers: {
        origin: 'https://evil.example.org',
      },
    });
    const nullOriginReq = new Request('http://localhost:3000/api/v1/payments', {
      method: 'DELETE',
      headers: {
        origin: 'null',
        referer: 'http://localhost:3000/admin',
      },
    });

    expect(parseOrigin('null')).toBeNull();
    expect(assertSameOrigin(evilReq)?.status).toBe(403);
    expect(assertSameOrigin(nullOriginReq)?.status).toBe(403);
  });
});
