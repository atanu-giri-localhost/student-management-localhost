import { describe, expect, it } from 'vitest';
import {
  generateOtpCode,
  generateSessionToken,
  hashOtp,
  hashSessionToken,
  timingSafeEqualHex,
} from '@/lib/auth/crypto';
import { redactAuditPayload } from '@/modules/audit/audit.service';

describe('Web Crypto OTP, session hashing, and audit redaction', () => {
  it('generates zero-padded 6-digit numeric OTP codes', () => {
    for (let i = 0; i < 40; i++) {
      const code = generateOtpCode();
      expect(code).toMatch(/^\d{6}$/);
    }
  });

  it('computes deterministic HMAC-SHA-256 OTP hashes and rejects mismatches in constant time', async () => {
    const secret = 'test_session_secret_with_at_least_32_chars';
    const hash1 = await hashOtp(secret, 'chal-1', '+919876543210', '048291');
    const hash2 = await hashOtp(secret, 'chal-1', '+919876543210', '048291');
    const wrongOtp = await hashOtp(secret, 'chal-1', '+919876543210', '048292');
    const wrongChallenge = await hashOtp(secret, 'chal-2', '+919876543210', '048291');

    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    expect(hash1).toBe(hash2);
    expect(timingSafeEqualHex(hash1, hash2)).toBe(true);
    expect(timingSafeEqualHex(hash1, wrongOtp)).toBe(false);
    expect(timingSafeEqualHex(hash1, wrongChallenge)).toBe(false);
    expect(timingSafeEqualHex(hash1, 'short')).toBe(false);
  });

  it('generates cryptographic session tokens and SHA-256 token hashes', async () => {
    const tokenA = generateSessionToken();
    const tokenB = generateSessionToken();
    expect(tokenA).not.toBe(tokenB);
    expect(tokenA.length).toBeGreaterThanOrEqual(40);

    const hashA = await hashSessionToken(tokenA);
    expect(hashA).toMatch(/^[a-f0-9]{64}$/);
    expect(await hashSessionToken(tokenA)).toBe(hashA);
  });

  it('redacts sensitive auth and credential fields from audit snapshots', () => {
    const redacted = redactAuditPayload({
      phoneNormalized: '+919876543210',
      otpCode: '123456',
      tokenHash: 'abcd',
      nested: { WHATSAPP_API_KEY: 'trn_live_secret', role: 'TEACHER' },
    });

    expect(redacted).toEqual({
      phoneNormalized: '+919876543210',
      otpCode: '[REDACTED]',
      tokenHash: '[REDACTED]',
      nested: { WHATSAPP_API_KEY: '[REDACTED]', role: 'TEACHER' },
    });
  });
});
