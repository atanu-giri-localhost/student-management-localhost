/**
 * D1 repository helpers for immutable audit_logs entries.
 */

const ALLOWED_AUDIT_ACTIONS = new Set([
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
 * Build a prepared INSERT statement for `audit_logs` to execute inside a caller's `env.DB.batch([...])`.
 *
 * @param {import('@cloudflare/workers-types').D1Database} db
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
export function buildAuditInsertStatement(db, entry) {
  if (!ALLOWED_AUDIT_ACTIONS.has(entry.action)) {
    throw new RangeError(`Invalid audit action "${entry.action}".`);
  }

  return db
    .prepare(
      `INSERT INTO audit_logs (
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
