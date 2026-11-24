import {
  generateOtpCode,
  generateSessionToken,
  hashOtp,
  hashSessionToken,
  timingSafeEqualHex,
} from '@/lib/auth/crypto';
import { getSessionSecret, SESSION_MAX_AGE_SECONDS } from '@/lib/auth/session';
import { addDaysIso, addMinutesIso, isExpiredIso, nowIso } from '@/lib/dates/format';
import { createWhatsAppProvider, readConfigString } from '@/lib/whatsapp/provider';
import { createAuditStatement } from '@/modules/audit/audit.service';
import {
  consumeOtpAndCreateSessionBatch,
  countRecentOtpRequestsByIp,
  findActiveSessionByTokenHash,
  findLatestOtpChallengeByPhone,
  findLatestPendingOtpChallengeByPhone,
  findUserForAuthByPhone,
  incrementOtpChallengeAttempts,
  insertOtpChallenge,
  revokeAllSessionsForUserBatch,
  revokeSessionById,
  updateOtpChallengeDelivery,
} from '@/modules/auth/auth.repository';

const GENERIC_OTP_RESPONSE_MESSAGE =
  'If the phone number is registered, an OTP has been dispatched via WhatsApp.';

function parsePositiveInt(rawValue, fallback) {
  const parsed = Number.parseInt(String(rawValue ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Custom domain error carrying HTTP status and API error code.
 */
export class AuthServiceError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {number} status
   * @param {Record<string, unknown>} [extra]
   */
  constructor(code, message, status, extra = {}) {
    super(message);
    this.name = 'AuthServiceError';
    this.code = code;
    this.status = status;
    this.extra = extra;
  }
}

/**
 * Request a WhatsApp OTP challenge with D1-backed throttling and strict anti-enumeration.
 *
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {Record<string, unknown>} workerEnv
 * @param {{ phoneNormalized: string, clientIp: string, nowDate?: Date }} params
 */
export async function requestOtpService(db, workerEnv, { phoneNormalized, clientIp, nowDate = new Date() }) {
  const expiryMinutes = parsePositiveInt(readConfigString(workerEnv, 'OTP_EXPIRY_MINUTES'), 5);
  const cooldownSeconds = parsePositiveInt(readConfigString(workerEnv, 'OTP_RESEND_COOLDOWN_SECONDS'), 60);
  const maxPerHourIp = 5;

  const currentIso = nowIso(nowDate);
  const oneHourAgoIso = addMinutesIso(-60, nowDate);

  // 1. Per-IP hourly rate limit (stateless across Workers isolates via D1).
  const ipRequestCount = await countRecentOtpRequestsByIp(db, clientIp, oneHourAgoIso);
  if (ipRequestCount >= maxPerHourIp) {
    throw new AuthServiceError(
      'RATE_LIMITED',
      'Too many OTP requests from this network. Please wait before trying again.',
      429,
      { retryAfterSeconds: 3600 }
    );
  }

  // 2. Per-phone resend cooldown (60 seconds).
  const latestForPhone = await findLatestOtpChallengeByPhone(db, phoneNormalized);
  if (latestForPhone?.created_at) {
    const elapsedMs = nowDate.getTime() - Date.parse(latestForPhone.created_at);
    const cooldownMs = cooldownSeconds * 1000;
    if (Number.isFinite(elapsedMs) && elapsedMs < cooldownMs) {
      const retryAfterSeconds = Math.max(1, Math.ceil((cooldownMs - elapsedMs) / 1000));
      throw new AuthServiceError(
        'RATE_LIMITED',
        `Please wait ${retryAfterSeconds} seconds before requesting another OTP.`,
        429,
        { retryAfterSeconds }
      );
    }
  }

  // 3. Create challenge row with hashed OTP uniformly (anti-enumeration).
  const challengeId = crypto.randomUUID();
  const otpCode = generateOtpCode();
  const sessionSecret = getSessionSecret(workerEnv);
  const otpHash = await hashOtp(sessionSecret, challengeId, phoneNormalized, otpCode);
  const expiresAt = addMinutesIso(expiryMinutes, nowDate);

  await insertOtpChallenge(db, {
    id: challengeId,
    phoneNormalized,
    otpHash,
    expiresAt,
    requestIp: clientIp,
    createdAt: currentIso,
  });

  // 4. Only dispatch to external WhatsApp provider when an active user exists.
  const user = await findUserForAuthByPhone(db, phoneNormalized);
  if (user && user.is_active === 1) {
    try {
      const whatsapp = createWhatsAppProvider(workerEnv);
      const delivery = await whatsapp.sendOtp({
        phoneNormalized,
        otpCode,
        challengeId,
        expiryMinutes,
      });

      await updateOtpChallengeDelivery(
        db,
        challengeId,
        delivery.ok ? 'DELIVERED' : 'FAILED',
        delivery.providerJobId ?? null
      );
    } catch {
      await updateOtpChallengeDelivery(db, challengeId, 'FAILED', null);
    }
  } else {
    await updateOtpChallengeDelivery(db, challengeId, 'FAILED', null);
  }

  // Always return identical payload regardless of phone registration status.
  return {
    message: GENERIC_OTP_RESPONSE_MESSAGE,
    cooldownSeconds,
  };
}

/**
 * Verify a 6-digit OTP challenge and issue a D1-backed session atomically.
 *
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {Record<string, unknown>} workerEnv
 * @param {{
 *   phoneNormalized: string,
 *   otp: string,
 *   userAgent: string | null,
 *   clientIp: string,
 *   nowDate?: Date,
 * }} params
 */
export async function verifyOtpService(
  db,
  workerEnv,
  { phoneNormalized, otp, userAgent, clientIp, nowDate = new Date() }
) {
  const maxAttempts = parsePositiveInt(readConfigString(workerEnv, 'OTP_MAX_ATTEMPTS'), 3);
  const currentIso = nowIso(nowDate);

  const challenge = await findLatestPendingOtpChallengeByPhone(db, phoneNormalized);
  if (!challenge) {
    throw new AuthServiceError('INVALID_OTP', 'Invalid or expired verification code.', 401);
  }
  if (challenge.consumed_at !== null || challenge.attempts >= maxAttempts || isExpiredIso(challenge.expires_at, nowDate)) {
    throw new AuthServiceError('INVALID_OTP', 'Invalid or expired verification code.', 401);
  }

  const sessionSecret = getSessionSecret(workerEnv);
  const candidateHash = await hashOtp(sessionSecret, challenge.id, phoneNormalized, otp);
  const isMatch = timingSafeEqualHex(candidateHash, challenge.otp_hash);

  if (!isMatch) {
    await incrementOtpChallengeAttempts(db, challenge.id, maxAttempts);
    throw new AuthServiceError('INVALID_OTP', 'Invalid or expired verification code.', 401);
  }

  const user = await findUserForAuthByPhone(db, phoneNormalized);
  if (!user || user.is_active !== 1) {
    await incrementOtpChallengeAttempts(db, challenge.id, maxAttempts);
    throw new AuthServiceError('INVALID_OTP', 'Invalid or expired verification code.', 401);
  }

  const sessionId = crypto.randomUUID();
  const rawSessionToken = generateSessionToken();
  const tokenHash = await hashSessionToken(rawSessionToken);
  const sessionExpiresAt = addDaysIso(SESSION_MAX_AGE_SECONDS / 86_400, nowDate);

  const batchResults = await consumeOtpAndCreateSessionBatch(db, {
    challengeId: challenge.id,
    nowIso: currentIso,
    maxAttempts,
    session: {
      id: sessionId,
      userId: user.id,
      tokenHash,
      expiresAt: sessionExpiresAt,
      userAgent,
      ipAddress: clientIp,
    },
  });

  if (batchResults?.[0]?.meta?.changes !== 1) {
    await revokeSessionById(db, sessionId, nowIso(nowDate));
    throw new AuthServiceError('INVALID_OTP', 'Invalid or expired verification code.', 401);
  }

  const sessionContext = await findActiveSessionByTokenHash(db, tokenHash, currentIso);
  if (!sessionContext) {
    throw new AuthServiceError('UNAUTHENTICATED', 'Failed to establish active user session.', 401);
  }

  return {
    rawSessionToken,
    session: sessionContext,
  };
}

/**
 * Revoke the caller's active session on logout.
 *
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {{ sessionId: string, nowDate?: Date }} params
 */
export async function logoutService(db, { sessionId, nowDate = new Date() }) {
  await revokeSessionById(db, sessionId, nowIso(nowDate));
  return { loggedOut: true };
}

/**
 * Administratively revoke all active sessions for a target user with immutable audit log.
 *
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {{
 *   actorSession: { userId: string },
 *   targetUserId: string,
 *   clientIp: string,
 *   requestId: string,
 *   nowDate?: Date,
 * }} params
 */
export async function revokeUserSessionsService(
  db,
  { actorSession, targetUserId, clientIp, requestId, nowDate = new Date() }
) {
  const currentIso = nowIso(nowDate);
  const auditStatement = createAuditStatement(db, {
    actorUserId: actorSession.userId,
    action: 'REVOKE',
    entityType: 'SESSION',
    entityId: targetUserId,
    newValues: { revokedAllActiveSessions: true, targetUserId },
    ipAddress: clientIp,
    requestId,
    createdAt: currentIso,
  });

  const [revokeResult] = await revokeAllSessionsForUserBatch(db, {
    targetUserId,
    nowIso: currentIso,
    auditStatement,
  });

  return {
    targetUserId,
    revokedCount: Number(revokeResult?.meta?.changes ?? 0),
  };
}
