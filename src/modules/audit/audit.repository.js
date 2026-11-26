/**
 * D1 repository helpers for central `DB_AUDIT.audit_logs` and domain-local `audit_outbox` tables.
 */

export const ALLOWED_AUDIT_ACTIONS = new Set([
  'CREATE',
  'UPDATE',
  'DELETE',
  'CORRECTION',
  'ALLOCATION',
  'REVERSAL',
  'REVOKE',
  'UNLINK',
]);

/**
 * Build an idempotent prepared INSERT statement for `DB_AUDIT.audit_logs`.
 * Uses `INSERT OR IGNORE` keyed on stable `audit_logs.id` so retries never create duplicates.
 *
 * @param {import('@cloudflare/workers-types').D1Database} auditDb
 * @param {{
 *   id: string,
 *   actorUserId?: string | null,
 *   action: string,
 *   entityType: string,
 *   entityId: string,
 *   oldValues?: string | null,
 *   newValues?: string | null,
 *   ipAddress?: string | null,
 *   requestId?: string | null,
 *   createdAt: string,
 * }} entry
 */
export function buildAuditInsertStatement(auditDb, entry) {
  if (!ALLOWED_AUDIT_ACTIONS.has(entry.action)) {
    throw new RangeError(`Invalid audit action "${entry.action}".`);
  }

  return auditDb
    .prepare(
      `INSERT OR IGNORE INTO audit_logs (
        id, actor_user_id, action, entity_type, entity_id,
        old_values, new_values, ip_address, request_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      entry.id,
      entry.actorUserId ?? null,
      entry.action,
      entry.entityType,
      entry.entityId,
      entry.oldValues ?? null,
      entry.newValues ?? null,
      entry.ipAddress ?? null,
      entry.requestId ?? null,
      entry.createdAt
    );
}

/**
 * Build a prepared INSERT statement for a domain-local `audit_outbox` table
 * (`DB_IDENTITY`, `DB_STUDENTS`, `DB_ATTENDANCE`, `DB_FINANCE`) inside a domain `batch([...])`.
 *
 * @param {import('@cloudflare/workers-types').D1Database} domainDb
 * @param {{
 *   id: string,
 *   actorUserId?: string | null,
 *   action: string,
 *   entityType: string,
 *   entityId: string,
 *   oldValues?: string | null,
 *   newValues?: string | null,
 *   ipAddress?: string | null,
 *   requestId?: string | null,
 *   createdAt: string,
 * }} entry
 */
export function buildAuditOutboxInsertStatement(domainDb, entry) {
  if (!ALLOWED_AUDIT_ACTIONS.has(entry.action)) {
    throw new RangeError(`Invalid audit action "${entry.action}".`);
  }

  return domainDb
    .prepare(
      `INSERT INTO audit_outbox (
        id, actor_user_id, action, entity_type, entity_id,
        old_values, new_values, ip_address, request_id,
        status, attempts, last_error, created_at, delivered_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 0, NULL, ?, NULL)`
    )
    .bind(
      entry.id,
      entry.actorUserId ?? null,
      entry.action,
      entry.entityType,
      entry.entityId,
      entry.oldValues ?? null,
      entry.newValues ?? null,
      entry.ipAddress ?? null,
      entry.requestId ?? null,
      entry.createdAt
    );
}

/**
 * Insert a bounded batch of normalized audit entries idempotently into `DB_AUDIT.audit_logs`.
 *
 * @param {import('@cloudflare/workers-types').D1Database} auditDb
 * @param {Array<Parameters<typeof buildAuditInsertStatement>[1]>} entries
 */
export async function insertAuditLogsIdempotentBatch(auditDb, entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return [];
  }
  const statements = entries.map((entry) => buildAuditInsertStatement(auditDb, entry));
  return await auditDb.batch(statements);
}

/**
 * Read a bounded batch of `PENDING` events from a domain `audit_outbox` table.
 *
 * @param {import('@cloudflare/workers-types').D1Database} domainDb
 * @param {number} limit
 */
export async function listPendingOutboxEvents(domainDb, limit = 25) {
  const safeLimit = Math.min(50, Math.max(1, Number.parseInt(String(limit), 10) || 25));
  const { results } = await domainDb
    .prepare(
      `SELECT
         id, actor_user_id, action, entity_type, entity_id,
         old_values, new_values, ip_address, request_id,
         status, attempts, last_error, created_at, delivered_at
       FROM audit_outbox
       WHERE status = 'PENDING'
       ORDER BY created_at ASC
       LIMIT ?`
    )
    .bind(safeLimit)
    .all();

  return results || [];
}

/**
 * Mark delivered outbox events as `DELIVERED` in the source domain D1.
 *
 * @param {import('@cloudflare/workers-types').D1Database} domainDb
 * @param {string[]} eventIds
 * @param {string} deliveredAt
 */
export async function markOutboxEventsDeliveredBatch(domainDb, eventIds, deliveredAt) {
  if (!Array.isArray(eventIds) || eventIds.length === 0) {
    return [];
  }
  const statements = eventIds.map((id) =>
    domainDb
      .prepare(
        `UPDATE audit_outbox
         SET status = 'DELIVERED',
             delivered_at = ?,
             last_error = NULL
         WHERE id = ?
           AND status = 'PENDING'`
      )
      .bind(deliveredAt, id)
  );
  return await domainDb.batch(statements);
}

/**
 * Increment retry attempts and record sanitized error metadata on failed outbox deliveries.
 * Marks `FAILED` only when `attempts + 1 >= maxAttempts`.
 *
 * @param {import('@cloudflare/workers-types').D1Database} domainDb
 * @param {string[]} eventIds
 * @param {string} errorMessage
 * @param {number} maxAttempts
 */
export async function recordOutboxDeliveryFailureBatch(domainDb, eventIds, errorMessage, maxAttempts = 5) {
  if (!Array.isArray(eventIds) || eventIds.length === 0) {
    return [];
  }
  const safeError = String(errorMessage || 'Audit delivery failed').slice(0, 500);
  const safeMax = Math.max(1, Number.parseInt(String(maxAttempts), 10) || 5);
  const statements = eventIds.map((id) =>
    domainDb
      .prepare(
        `UPDATE audit_outbox
         SET attempts = attempts + 1,
             last_error = ?,
             status = CASE WHEN attempts + 1 >= ? THEN 'FAILED' ELSE 'PENDING' END
         WHERE id = ?
           AND status = 'PENDING'`
      )
      .bind(safeError, safeMax, id)
  );
  return await domainDb.batch(statements);
}
