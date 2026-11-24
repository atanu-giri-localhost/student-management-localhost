/**
 * Transport by Ogensync (RelayWA API v1.2.0) WhatsApp OTP delivery adapter.
 * Docs / OpenAPI verified against https://transport.ogensync.com/downloads/openapi.json.
 *
 * Security & Billing Invariants:
 * - Always sends Idempotency-Key: sms-otp-<challengeId> (8-128 chars, ^[A-Za-z0-9._:-]+$).
 * - Never creates a new Idempotency-Key when retrying network/429/503 failures.
 * - Never logs bearer API keys or plaintext OTP codes.
 */

const DEFAULT_OGENSYNC_BASE_URL = 'https://transport.ogensync.com';
const SAFE_IDEMPOTENCY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Format the plain-text WhatsApp OTP message body.
 *
 * @param {{ otpCode: string, expiryMinutes: number, instituteName?: string }} params
 * @returns {string}
 */
export function buildOtpMessageText({ otpCode, expiryMinutes, instituteName = 'Apex Coaching Institute' }) {
  return `Your ${instituteName} login OTP is ${otpCode}. Valid for ${expiryMinutes} minutes. Do not share this code with anyone.`;
}

/**
 * Derive an Ogensync-compliant Idempotency-Key (`8..128` chars matching `^[A-Za-z0-9._:-]+$`).
 *
 * @param {string} challengeId
 * @returns {string}
 */
export function buildIdempotencyKey(challengeId) {
  const sanitized = String(challengeId).replace(/[^A-Za-z0-9._:-]/g, '');
  const key = `sms-otp-${sanitized}`.slice(0, 128);
  if (!SAFE_IDEMPOTENCY_PATTERN.test(key)) {
    throw new RangeError('Unable to derive valid Idempotency-Key from challengeId.');
  }
  return key;
}

/**
 * Create a Transport by Ogensync WhatsApp provider instance.
 *
 * @param {{
 *   apiKey: string,
 *   baseUrl?: string,
 *   instituteName?: string,
 *   fetchFn?: typeof fetch,
 * }} config
 */
export function createOgensyncWhatsAppProvider(config) {
  if (!config?.apiKey || typeof config.apiKey !== 'string' || !config.apiKey.trim()) {
    throw new Error('Ogensync WhatsApp provider requires WHATSAPP_API_KEY.');
  }

  const baseUrl = (config.baseUrl || DEFAULT_OGENSYNC_BASE_URL).replace(/\/+$/, '');
  const apiKey = config.apiKey.trim();
  const instituteName = config.instituteName || 'Apex Coaching Institute';
  const fetchFn = config.fetchFn || fetch;

  /**
   * Execute a single POST /v1/messages call with fixed Idempotency-Key.
   * Retries at most once on transient 429/503/network error using the exact same key.
   *
   * @param {{ phoneNormalized: string, otpCode: string, challengeId: string, expiryMinutes: number }} params
   * @returns {Promise<{ ok: boolean, providerJobId: string | null, status: string, chargePaise?: number, errorCode?: string, httpStatus?: number }>}
   */
  async function sendOtp({ phoneNormalized, otpCode, challengeId, expiryMinutes }) {
    const idempotencyKey = buildIdempotencyKey(challengeId);
    const payload = JSON.stringify({
      phone: phoneNormalized,
      type: 'text',
      message: buildOtpMessageText({ otpCode, expiryMinutes, instituteName }),
    });

    const maxAttempts = 2;
    let lastResult = {
      ok: false,
      providerJobId: null,
      status: 'failed',
      errorCode: 'PROVIDER_REQUEST_FAILED',
    };

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetchFn(`${baseUrl}/v1/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey,
          },
          body: payload,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });

        let parsedBody = null;
        try {
          parsedBody = await response.json();
        } catch {
          parsedBody = null;
        }

        if (response.status === 202 || response.ok) {
          return {
            ok: true,
            providerJobId: parsedBody?.jobId ?? null,
            status: parsedBody?.status ?? 'queued',
            chargePaise: typeof parsedBody?.chargePaise === 'number' ? parsedBody.chargePaise : undefined,
            replayed: Boolean(parsedBody?.replayed),
          };
        }

        const errorCode = parsedBody?.error?.code || `HTTP_${response.status}`;
        lastResult = {
          ok: false,
          providerJobId: null,
          status: 'failed',
          errorCode,
          httpStatus: response.status,
        };

        // Retry once ONLY on transient 429 or 503 with the exact same Idempotency-Key.
        const isTransient = response.status === 429 || response.status === 503;
        if (!isTransient || attempt === maxAttempts) {
          return lastResult;
        }
      } catch {
        lastResult = {
          ok: false,
          providerJobId: null,
          status: 'unknown',
          errorCode: 'NETWORK_OR_TIMEOUT_ERROR',
        };
        if (attempt === maxAttempts) {
          return lastResult;
        }
      }
    }

    return lastResult;
  }

  /**
   * Query Ogensync WhatsApp connection state (`GET /v1/session`, requires `session:read` scope).
   */
  async function checkSessionStatus() {
    try {
      const response = await fetchFn(`${baseUrl}/v1/session`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const parsedBody = await response.json().catch(() => null);
      if (!response.ok) {
        return {
          ok: false,
          connected: false,
          state: parsedBody?.error?.code || `HTTP_${response.status}`,
        };
      }
      return {
        ok: true,
        connected: Boolean(parsedBody?.connection?.connected),
        state: parsedBody?.connection?.state || 'unknown',
      };
    } catch {
      return {
        ok: false,
        connected: false,
        state: 'UNREACHABLE',
      };
    }
  }

  return {
    name: 'OGENSYNC',
    sendOtp,
    checkSessionStatus,
  };
}
