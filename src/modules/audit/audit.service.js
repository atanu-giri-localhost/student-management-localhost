import { nowIso } from '@/lib/dates/format';
import { buildAuditInsertStatement } from '@/modules/audit/audit.repository';

const SENSITIVE_KEYS = new Set([
  'otp',
  'otpCode',
  'otp_hash',
  'otpHash',
  'token',
  'rawToken',
  'token_hash',
  'tokenHash',
  'password',
  'passwordHash',
  'SESSION_SECRET',
  'WHATSAPP_API_KEY',
  'apiKey',
]);

/**
 * Recursively strip sensitive fields from audit snapshots before JSON serialization.
 *
 * @param {unknown} value
 * @returns {unknown}
 */
export function redactAuditPayload(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactAuditPayload(item));
  }
  if (typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (SENSITIVE_KEYS.has(key)) {
        out[key] = '[REDACTED]';
      } else {
        out[key] = redactAuditPayload(val);
      }
    }
    return out;
  }
  return value;
}

/**
 * Serialize redacted old/new payloads and build a prepared `audit_logs` statement.
 *
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {{
 *   actorUserId?: string | null,
 *   action: 'CREATE' | 'UPDATE' | 'DELETE' | 'CORRECTION' | 'ALLOCATION' | 'REVERSAL' | 'REVOKE' | 'UNLINK',
 *   entityType: string,
 *   entityId: string,
 *   oldValues?: unknown,
 *   newValues?: unknown,
 *   ipAddress?: string | null,
 *   requestId?: string | null,
 *   createdAt?: string,
 * }} params
 */
export function createAuditStatement(db, params) {
  const oldJson =
    params.oldValues !== undefined && params.oldValues !== null
      ? JSON.stringify(redactAuditPayload(params.oldValues))
      : null;
  const newJson =
    params.newValues !== undefined && params.newValues !== null
      ? JSON.stringify(redactAuditPayload(params.newValues))
      : null;

  return buildAuditInsertStatement(db, {
    id: crypto.randomUUID(),
    actorUserId: params.actorUserId ?? null,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    oldValues: oldJson,
    newValues: newJson,
    ipAddress: params.ipAddress ?? null,
    requestId: params.requestId ?? null,
    createdAt: params.createdAt || nowIso(),
  });
}
