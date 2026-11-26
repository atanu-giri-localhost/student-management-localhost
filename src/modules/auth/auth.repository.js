/**
 * Direct Cloudflare D1 (`DB_IDENTITY`) repository for WhatsApp OTP challenges and sessions.
 */

/**
 * Count OTP requests from `requestIp` created at or after `sinceIso`.
 *
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {string} requestIp
 * @param {string} sinceIso
 * @returns {Promise<number>}
 */
export async function countRecentOtpRequestsByIp(db, requestIp, sinceIso) {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS recent_count
       FROM otp_challenges
       WHERE request_ip = ?
         AND created_at >= ?`
    )
    .bind(requestIp, sinceIso)
    .first();

  return Number(row?.recent_count ?? 0);
}

/**
 * Return the most recent OTP challenge created for `phoneNormalized` (for cooldown checks).
 *
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {string} phoneNormalized
 */
export async function findLatestOtpChallengeByPhone(db, phoneNormalized) {
  return await db
    .prepare(
      `SELECT id, created_at
       FROM otp_challenges
       WHERE phone_normalized = ?
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .bind(phoneNormalized)
    .first();
}

/**
 * Return the most recent unconsumed OTP challenge for `phoneNormalized`.
 *
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {string} phoneNormalized
 */
export async function findLatestPendingOtpChallengeByPhone(db, phoneNormalized) {
  return await db
    .prepare(
      `SELECT id, phone_normalized, otp_hash, expires_at, attempts, consumed_at, delivery_status, created_at
       FROM otp_challenges
       WHERE phone_normalized = ?
         AND consumed_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .bind(phoneNormalized)
    .first();
}

/**
 * Persist a newly created OTP challenge with hashed OTP (`otp_hash`).
 *
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {{
 *   id: string,
 *   phoneNormalized: string,
 *   otpHash: string,
 *   expiresAt: string,
 *   requestIp: string,
 *   createdAt: string,
 * }} challenge
 */
export async function insertOtpChallenge(db, challenge) {
  return await db
    .prepare(
      `INSERT INTO otp_challenges (
        id, phone_normalized, otp_hash, expires_at, attempts, consumed_at,
        delivery_status, request_ip, provider_job_id, created_at
      ) VALUES (?, ?, ?, ?, 0, NULL, 'PENDING', ?, NULL, ?)`
    )
    .bind(
      challenge.id,
      challenge.phoneNormalized,
      challenge.otpHash,
      challenge.expiresAt,
      challenge.requestIp,
      challenge.createdAt
    )
    .run();
}

/**
 * Update OTP challenge delivery outcome and optional provider job identifier.
 *
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {string} challengeId
 * @param {'PENDING' | 'DELIVERED' | 'FAILED'} deliveryStatus
 * @param {string | null} providerJobId
 */
export async function updateOtpChallengeDelivery(db, challengeId, deliveryStatus, providerJobId) {
  return await db
    .prepare(
      `UPDATE otp_challenges
       SET delivery_status = ?, provider_job_id = ?
       WHERE id = ?`
    )
    .bind(deliveryStatus, providerJobId ?? null, challengeId)
    .run();
}

/**
 * Increment failed attempt counter on an OTP challenge (`attempts < maxAttempts`).
 *
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {string} challengeId
 * @param {number} maxAttempts
 */
export async function incrementOtpChallengeAttempts(db, challengeId, maxAttempts) {
  return await db
    .prepare(
      `UPDATE otp_challenges
       SET attempts = attempts + 1
       WHERE id = ?
         AND attempts < ?`
    )
    .bind(challengeId, maxAttempts)
    .run();
}

/**
 * Lookup user account status by normalized E.164 phone.
 *
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {string} phoneNormalized
 */
export async function findUserForAuthByPhone(db, phoneNormalized) {
  return await db
    .prepare(
      `SELECT id, phone_normalized, email, is_active
       FROM users
       WHERE phone_normalized = ?
       LIMIT 1`
    )
    .bind(phoneNormalized)
    .first();
}

/**
 * Atomically mark the OTP challenge as consumed and create a new active session.
 * Guards against race-condition replays via `WHERE consumed_at IS NULL AND attempts < ? AND expires_at > ?`.
 *
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {{
 *   challengeId: string,
 *   nowIso: string,
 *   maxAttempts: number,
 *   session: {
 *     id: string,
 *     userId: string,
 *     tokenHash: string,
 *     expiresAt: string,
 *     userAgent: string | null,
 *     ipAddress: string | null,
 *   }
 * }} params
 */
export async function consumeOtpAndCreateSessionBatch(db, { challengeId, nowIso, maxAttempts, session }) {
  return await db.batch([
    db
      .prepare(
        `UPDATE otp_challenges
         SET consumed_at = ?
         WHERE id = ?
           AND consumed_at IS NULL
           AND attempts < ?
           AND expires_at > ?`
      )
      .bind(nowIso, challengeId, maxAttempts, nowIso),
    db
      .prepare(
        `INSERT INTO sessions (
          id, user_id, token_hash, expires_at, revoked_at, user_agent, ip_address, created_at
        ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?)`
      )
      .bind(
        session.id,
        session.userId,
        session.tokenHash,
        session.expiresAt,
        session.userAgent ?? null,
        session.ipAddress ?? null,
        nowIso
      ),
  ]);
}

/**
 * Hydrate an active, unrevoked, unexpired identity session context with roles from `DB_IDENTITY`.
 * Linked domain profile IDs are hydrated separately via `hydrateUserProfiles`.
 *
 * @param {import('@cloudflare/workers-types').D1Database} identityDb
 * @param {string} tokenHash
 * @param {string} nowIso
 */
export async function findActiveSessionByTokenHash(identityDb, tokenHash, nowIso) {
  const row = await identityDb
    .prepare(
      `SELECT
         s.id AS session_id,
         s.user_id,
         s.expires_at,
         u.phone_normalized,
         u.email,
         u.is_active,
         GROUP_CONCAT(r.name) AS role_names
       FROM sessions s
       INNER JOIN users u ON u.id = s.user_id
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       WHERE s.token_hash = ?
         AND s.revoked_at IS NULL
         AND s.expires_at > ?
         AND u.is_active = 1
       GROUP BY s.id`
    )
    .bind(tokenHash, nowIso)
    .first();

  if (!row) {
    return null;
  }

  const roles =
    typeof row.role_names === 'string' && row.role_names.length > 0
      ? Array.from(new Set(row.role_names.split(',').filter(Boolean)))
      : [];

  return {
    sessionId: row.session_id,
    userId: row.user_id,
    expiresAt: row.expires_at,
    phoneNormalized: row.phone_normalized,
    email: row.email ?? null,
    isActive: row.is_active === 1,
    roles,
  };
}

/**
 * Revoke a single session by ID (`logout` or rollback compensation).
 *
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {string} sessionId
 * @param {string} nowIso
 */
export async function revokeSessionById(db, sessionId, nowIso) {
  return await db
    .prepare(
      `UPDATE sessions
       SET revoked_at = ?
       WHERE id = ?
         AND revoked_at IS NULL`
    )
    .bind(nowIso, sessionId)
    .run();
}

/**
 * Atomically revoke all active sessions for a user and write an audit log statement.
 *
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {{ targetUserId: string, nowIso: string, auditStatement: unknown }} params
 */
export async function revokeAllSessionsForUserBatch(db, { targetUserId, nowIso, auditStatement }) {
  return await db.batch([
    db
      .prepare(
        `UPDATE sessions
         SET revoked_at = ?
         WHERE user_id = ?
           AND revoked_at IS NULL`
      )
      .bind(nowIso, targetUserId),
    auditStatement,
  ]);
}
