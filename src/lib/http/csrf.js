import { jsonError } from '@/lib/http/response';

const SAFE_HTTP_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Extract the normalized origin (`scheme://host[:port]`) from a URL or header value.
 *
 * @param {string | null | undefined} value
 * @returns {string | null}
 */
export function parseOrigin(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'null') {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.origin.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Build the set of trusted same-origin origins for the current request and Worker env.
 *
 * @param {Request} request
 * @param {Record<string, unknown>} [workerEnv]
 * @returns {Set<string>}
 */
export function getAllowedOrigins(request, workerEnv = {}) {
  const allowed = new Set();

  const requestUrlOrigin = parseOrigin(request?.url);
  if (requestUrlOrigin) {
    allowed.add(requestUrlOrigin);
  }

  const forwardedHost = request?.headers?.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = forwardedHost || request?.headers?.get('host')?.trim();
  if (host) {
    const forwardedProto = request?.headers?.get('x-forwarded-proto')?.split(',')[0]?.trim();
    const requestProto = requestUrlOrigin?.startsWith('https://') ? 'https' : 'http';
    const proto = forwardedProto === 'https' || forwardedProto === 'http' ? forwardedProto : requestProto;
    const hostOrigin = parseOrigin(`${proto}://${host}`);
    if (hostOrigin) {
      allowed.add(hostOrigin);
    }
  }

  const configuredAppUrl =
    typeof workerEnv?.NEXT_PUBLIC_APP_URL === 'string'
      ? workerEnv.NEXT_PUBLIC_APP_URL
      : process.env.NEXT_PUBLIC_APP_URL;
  const configuredOrigin = parseOrigin(configuredAppUrl);
  if (configuredOrigin) {
    allowed.add(configuredOrigin);
  }

  return allowed;
}

/**
 * Enforce Same-Origin / CSRF validation for mutating HTTP requests (`POST`, `PUT`, `PATCH`, `DELETE`).
 * Returns `null` when allowed, or a `403 CSRF_ORIGIN_MISMATCH` Response when rejected.
 *
 * @param {Request} request
 * @param {{ workerEnv?: Record<string, unknown>, requestId?: string }} [options]
 * @returns {Response | null}
 */
export function assertSameOrigin(request, options = {}) {
  const method = (request?.method || 'GET').toUpperCase();
  if (SAFE_HTTP_METHODS.has(method)) {
    return null;
  }

  const originHeader = request?.headers?.get('origin');
  const refererHeader = request?.headers?.get('referer');

  // When Origin is explicitly supplied (even "null"), never fall back to Referer.
  const candidateOrigin =
    originHeader !== null && originHeader !== undefined
      ? parseOrigin(originHeader)
      : parseOrigin(refererHeader);

  if (!candidateOrigin) {
    return jsonError('CSRF_ORIGIN_MISMATCH', 'Cross-origin or missing Origin header is not permitted.', {
      status: 403,
      requestId: options.requestId,
    });
  }

  const allowedOrigins = getAllowedOrigins(request, options.workerEnv);
  if (!allowedOrigins.has(candidateOrigin)) {
    return jsonError('CSRF_ORIGIN_MISMATCH', 'Request origin does not match application origin.', {
      status: 403,
      requestId: options.requestId,
    });
  }

  return null;
}
