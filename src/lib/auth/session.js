import { hashSessionToken } from '@/lib/auth/crypto';
import { hydrateUserProfiles } from '@/lib/auth/profile-hydration';
import { D1_BINDINGS, getDomainDb, resolveWorkerEnv } from '@/lib/cloudflare/bindings';
import { nowIso } from '@/lib/dates/format';
import { jsonError } from '@/lib/http/response';
import { readConfigString } from '@/lib/whatsapp/provider';
import { findActiveSessionByTokenHash } from '@/modules/auth/auth.repository';

export const DEFAULT_COOKIE_NAME = 'sms_session';
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

/**
 * Resolve `SESSION_SECRET` from workerEnv or process.env.
 *
 * @param {Record<string, unknown>} [workerEnv]
 * @returns {string}
 */
export function getSessionSecret(workerEnv = {}) {
  const secret = readConfigString(workerEnv, 'SESSION_SECRET');
  if (!secret || secret.length < 16) {
    throw new Error('SESSION_SECRET is missing or too short (minimum 16 characters).');
  }
  return secret;
}

/**
 * Resolve the configured session cookie name (`sms_session`).
 *
 * @param {Record<string, unknown>} [workerEnv]
 * @returns {string}
 */
export function getSessionCookieName(workerEnv = {}) {
  return readConfigString(workerEnv, 'COOKIE_NAME', DEFAULT_COOKIE_NAME) || DEFAULT_COOKIE_NAME;
}

/**
 * Determine whether the `Secure` attribute should be set on session cookies.
 *
 * @param {Record<string, unknown>} [workerEnv]
 * @returns {boolean}
 */
export function shouldUseSecureCookie(workerEnv = {}) {
  const cookieSecure = readConfigString(workerEnv, 'COOKIE_SECURE');
  if (cookieSecure === 'true') return true;
  if (cookieSecure === 'false') return false;
  const environment = readConfigString(workerEnv, 'ENVIRONMENT', readConfigString(workerEnv, 'NODE_ENV', 'development'));
  return environment === 'production';
}

/**
 * Extract a named cookie value from the HTTP `Cookie` header.
 *
 * @param {Request} request
 * @param {string} cookieName
 * @returns {string | null}
 */
export function readCookieFromRequest(request, cookieName = DEFAULT_COOKIE_NAME) {
  const header = request?.headers?.get('cookie');
  if (!header) return null;

  const pairs = header.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const name = pair.slice(0, idx).trim();
    if (name === cookieName) {
      const val = pair.slice(idx + 1).trim();
      try {
        return decodeURIComponent(val);
      } catch {
        return val;
      }
    }
  }
  return null;
}

/**
 * Build a hardened `Set-Cookie` header value (`HttpOnly`, `SameSite=Lax`, conditional `Secure`).
 *
 * @param {string} rawToken
 * @param {{ cookieName?: string, maxAgeSeconds?: number, secure?: boolean }} [options]
 * @returns {string}
 */
export function buildSessionCookieHeader(rawToken, options = {}) {
  const {
    cookieName = DEFAULT_COOKIE_NAME,
    maxAgeSeconds = SESSION_MAX_AGE_SECONDS,
    secure = false,
  } = options;

  const directives = [
    `${cookieName}=${encodeURIComponent(rawToken)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (secure) {
    directives.push('Secure');
  }
  return directives.join('; ');
}

/**
 * Build a `Set-Cookie` header clearing the session cookie immediately (`Max-Age=0`).
 *
 * @param {{ cookieName?: string, secure?: boolean }} [options]
 * @returns {string}
 */
export function buildClearSessionCookieHeader(options = {}) {
  return buildSessionCookieHeader('', {
    cookieName: options.cookieName,
    maxAgeSeconds: 0,
    secure: options.secure,
  });
}

/**
 * Hydrate the authenticated session context from request cookies + `DB_IDENTITY` `sessions`,
 * followed by role-scoped profile hydration from `DB_STUDENTS` / `DB_ACADEMICS`.
 * Returns `{ ok: true, session, identityDb, workerEnv }` or `{ ok: false, response }`.
 *
 * @param {Request} request
 * @param {{ requestId?: string, explicitEnv?: Record<string, unknown> }} [options]
 */
export async function requireAuth(request, options = {}) {
  const { requestId, explicitEnv } = options;

  try {
    const workerEnv = await resolveWorkerEnv(explicitEnv);
    const identityDb = getDomainDb(workerEnv, D1_BINDINGS.IDENTITY);
    const cookieName = getSessionCookieName(workerEnv);
    const rawToken = readCookieFromRequest(request, cookieName);

    if (!rawToken) {
      return {
        ok: false,
        response: jsonError('UNAUTHENTICATED', 'Authentication required.', {
          status: 401,
          requestId,
        }),
      };
    }

    const tokenHash = await hashSessionToken(rawToken);
    const identitySession = await findActiveSessionByTokenHash(identityDb, tokenHash, nowIso());

    if (!identitySession) {
      return {
        ok: false,
        response: jsonError('UNAUTHENTICATED', 'Session is missing, expired, or revoked.', {
          status: 401,
          requestId,
        }),
      };
    }

    const profiles = await hydrateUserProfiles(workerEnv, {
      userId: identitySession.userId,
      roles: identitySession.roles,
    });

    return {
      ok: true,
      session: {
        ...identitySession,
        profiles,
      },
      identityDb,
      workerEnv,
    };
  } catch {
    return {
      ok: false,
      response: jsonError('DB_UNAVAILABLE', 'Authentication service is unavailable.', {
        status: 503,
        requestId,
      }),
    };
  }
}

/**
 * Verify that an authenticated session holds at least one of `allowedRoles`.
 * Returns `null` if authorized or a `403 FORBIDDEN` Response otherwise.
 *
 * @param {{ roles: string[] }} session
 * @param {string[]} allowedRoles
 * @param {string} [requestId]
 * @returns {Response | null}
 */
export function requireRole(session, allowedRoles, requestId) {
  const userRoles = Array.isArray(session?.roles) ? session.roles : [];
  const hasPermission = allowedRoles.some((role) => userRoles.includes(role));

  if (!hasPermission) {
    return jsonError('FORBIDDEN', 'You do not have permission to perform this action.', {
      status: 403,
      requestId,
    });
  }
  return null;
}

/**
 * Extract normalized client IP address from Cloudflare / reverse-proxy headers.
 *
 * @param {Request} request
 * @returns {string}
 */
export function getClientIp(request) {
  const cfIp = request?.headers?.get('cf-connecting-ip')?.trim();
  if (cfIp) return cfIp.slice(0, 64);
  const forwarded = request?.headers?.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwarded) return forwarded.slice(0, 64);
  return '127.0.0.1';
}
