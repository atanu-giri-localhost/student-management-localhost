/**
 * Web Crypto API cryptographic helpers for Cloudflare Workers (no native Node C++ addons).
 * Handles 6-digit OTP generation, keyed HMAC-SHA-256 OTP hashing,
 * SHA-256 session token hashing, and constant-time hex comparison.
 */

const textEncoder = new TextEncoder();

/**
 * Convert an ArrayBuffer / Uint8Array to lowercase hexadecimal.
 *
 * @param {ArrayBuffer | Uint8Array} bytes
 * @returns {string}
 */
export function bytesToHex(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let hex = '';
  for (let i = 0; i < arr.length; i++) {
    hex += arr[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Generate a cryptographically random 6-digit OTP using rejection sampling
 * (`< 4294000000` eliminates modulo bias across `000000..999999`).
 *
 * @returns {string}
 */
export function generateOtpCode() {
  const buf = new Uint32Array(1);
  // 4294000000 is an exact multiple of 1_000_000 under 2^32 (4294967296).
  const limit = 4_294_000_000;
  let value = limit;
  while (value >= limit) {
    crypto.getRandomValues(buf);
    value = buf[0];
  }
  return String(value % 1_000_000).padStart(6, '0');
}

/**
 * Compute keyed HMAC-SHA-256 hex digest over `${challengeId}:${phoneNormalized}:${otpCode}`.
 * Only this hash is stored in `otp_challenges.otp_hash`.
 *
 * @param {string} secret
 * @param {string} challengeId
 * @param {string} phoneNormalized
 * @param {string} otpCode
 * @returns {Promise<string>}
 */
export async function hashOtp(secret, challengeId, phoneNormalized, otpCode) {
  if (!secret || typeof secret !== 'string' || secret.length < 16) {
    throw new Error('SESSION_SECRET must be configured with at least 16 characters.');
  }

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const payload = `${challengeId}:${phoneNormalized}:${otpCode}`;
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, textEncoder.encode(payload));
  return bytesToHex(signature);
}

/**
 * Compare two equal-length hex digests in constant time using XOR accumulation.
 *
 * @param {string} leftHex
 * @param {string} rightHex
 * @returns {boolean}
 */
export function timingSafeEqualHex(leftHex, rightHex) {
  if (typeof leftHex !== 'string' || typeof rightHex !== 'string') {
    return false;
  }
  const a = leftHex.toLowerCase();
  const b = rightHex.toLowerCase();
  if (a.length === 0 || a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Generate a 32-byte cryptographically random URL-safe session token.
 *
 * @returns {string}
 */
export function generateSessionToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/**
 * Hash a raw session token with SHA-256 for persistence in `sessions.token_hash`.
 *
 * @param {string} rawToken
 * @returns {Promise<string>}
 */
export async function hashSessionToken(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') {
    throw new TypeError('Session token must be a non-empty string.');
  }
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(rawToken));
  return bytesToHex(digest);
}
