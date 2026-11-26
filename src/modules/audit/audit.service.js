import { D1_BINDINGS, getDomainDb } from '@/lib/cloudflare/bindings';
import { nowIso } from '@/lib/dates/format';
import {
  ALLOWED_AUDIT_ACTIONS,
  buildAuditInsertStatement,
  buildAuditOutboxInsertStatement,
  insertAuditLogsIdempotentBatch,
  listPendingOutboxEvents,
  markOutboxEventsDeliveredBatch,
  recordOutboxDeliveryFailureBatch,
} from '@/modules/audit/audit.repository';
import { AUDIT_OUTBOX_DOMAINS } from '@/modules/audit/audit.schemas';

const SENSITIVE_KEYS = new Set([
  'otp',
  'otpCode',
  'otp_hash',
  'otpHash',
  'token',
  'rawToken',
  'token_hash',
  'tokenHash',
  'accessToken',
  'refreshToken',
  'password',
  'passwordHash',
  'secret',
  'SESSION_SECRET',
  'WHATSAPP_API_KEY',
  'apiKey',
  'authorization',
  'cookie',
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

function serializeRedacted(value) {
  return value !== undefined && value !== null
    ? JSON.stringify(redactAuditPayload(value))
    : null;
}

/**
 * Serialize redacted old/new payloads and build an idempotent `DB_AUDIT.audit_logs` statement.
 *
 * @param {import('@cloudflare/workers-types').D1Database} auditDb
 * @param {{
 *   id?: string,
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
export function createAuditStatement(auditDb, params) {
  return buildAuditInsertStatement(auditDb, {
    id: params.id || crypto.randomUUID(),
    actorUserId: params.actorUserId ?? null,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    oldValues: serializeRedacted(params.oldValues),
    newValues: serializeRedacted(params.newValues),
    ipAddress: params.ipAddress ?? null,
    requestId: params.requestId ?? null,
    createdAt: params.createdAt || nowIso(),
  });
}

/**
 * Serialize redacted old/new payloads and build a prepared `audit_outbox` statement
 * for atomic insertion inside a domain D1 `batch([...])`.
 *
 * @param {import('@cloudflare/workers-types').D1Database} domainDb
 * @param {{
 *   id?: string,
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
export function createAuditOutboxStatement(domainDb, params) {
  return buildAuditOutboxInsertStatement(domainDb, {
    id: params.id || crypto.randomUUID(),
    actorUserId: params.actorUserId ?? null,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    oldValues: serializeRedacted(params.oldValues),
    newValues: serializeRedacted(params.newValues),
    ipAddress: params.ipAddress ?? null,
    requestId: params.requestId ?? null,
    createdAt: params.createdAt || nowIso(),
  });
}

/**
 * Validate and normalize a raw `audit_outbox` row for central `DB_AUDIT.audit_logs` delivery.
 *
 * @param {Record<string, unknown>} row
 */
export function normalizeOutboxEvent(row) {
  if (!row || typeof row !== 'object') {
    return { ok: false, reason: 'Outbox row is not an object.' };
  }
  const id = typeof row.id === 'string' ? row.id.trim() : '';
  const action = typeof row.action === 'string' ? row.action.trim() : '';
  const entityType = typeof row.entity_type === 'string' ? row.entity_type.trim() : '';
  const entityId = typeof row.entity_id === 'string' ? row.entity_id.trim() : '';
  const createdAt = typeof row.created_at === 'string' ? row.created_at.trim() : '';

  if (!id || !ALLOWED_AUDIT_ACTIONS.has(action) || !entityType || !entityId || !createdAt) {
    return { ok: false, reason: 'Malformed outbox event fields.' };
  }

  return {
    ok: true,
    entry: {
      id,
      actorUserId: typeof row.actor_user_id === 'string' ? row.actor_user_id : null,
      action,
      entityType,
      entityId,
      oldValues: typeof row.old_values === 'string' ? row.old_values : null,
      newValues: typeof row.new_values === 'string' ? row.new_values : null,
      ipAddress: typeof row.ip_address === 'string' ? row.ip_address : null,
      requestId: typeof row.request_id === 'string' ? row.request_id : null,
      createdAt,
    },
  };
}

/**
 * Deliver a bounded batch of `PENDING` outbox events from one domain D1 into `DB_AUDIT.audit_logs`.
 * Central `INSERT OR IGNORE` runs before marking source events `DELIVERED`.
 *
 * @param {import('@cloudflare/workers-types').D1Database} domainDb
 * @param {import('@cloudflare/workers-types').D1Database} auditDb
 * @param {{ batchSize?: number, maxAttempts?: number, deliveredAt?: string }} [options]
 */
export async function deliverDomainOutboxBatch(domainDb, auditDb, options = {}) {
  const batchSize = Math.min(50, Math.max(1, Number(options.batchSize) || 25));
  const maxAttempts = Math.min(20, Math.max(1, Number(options.maxAttempts) || 5));
  const deliveredAt = options.deliveredAt || nowIso();

  let pendingRows;
  try {
    pendingRows = await listPendingOutboxEvents(domainDb, batchSize);
  } catch {
    return {
      status: 'SOURCE_READ_FAILED',
      attempted: 0,
      delivered: 0,
      failed: 0,
    };
  }

  if (pendingRows.length === 0) {
    return {
      status: 'OK',
      attempted: 0,
      delivered: 0,
      failed: 0,
    };
  }

  const validEntries = [];
  const malformedIds = [];

  for (const row of pendingRows) {
    const normalized = normalizeOutboxEvent(row);
    if (normalized.ok) {
      validEntries.push(normalized.entry);
    } else if (typeof row?.id === 'string' && row.id.trim()) {
      malformedIds.push(row.id.trim());
    }
  }

  if (malformedIds.length > 0) {
    try {
      await recordOutboxDeliveryFailureBatch(domainDb, malformedIds, 'MALFORMED_OUTBOX_EVENT', 1);
    } catch {
      // Best-effort failure marking for malformed records.
    }
  }

  if (validEntries.length === 0) {
    return {
      status: 'MALFORMED_ONLY',
      attempted: pendingRows.length,
      delivered: 0,
      failed: malformedIds.length,
    };
  }

  const validIds = validEntries.map((e) => e.id);

  try {
    await insertAuditLogsIdempotentBatch(auditDb, validEntries);
  } catch {
    try {
      await recordOutboxDeliveryFailureBatch(
        domainDb,
        validIds,
        'CENTRAL_AUDIT_INSERT_FAILED',
        maxAttempts
      );
    } catch {
      // Preserve pending rows if source D1 also fails.
    }
    return {
      status: 'CENTRAL_INSERT_FAILED',
      attempted: pendingRows.length,
      delivered: 0,
      failed: validIds.length + malformedIds.length,
    };
  }

  try {
    await markOutboxEventsDeliveredBatch(domainDb, validIds, deliveredAt);
  } catch {
    return {
      status: 'SOURCE_MARK_FAILED',
      attempted: pendingRows.length,
      delivered: validIds.length,
      failed: malformedIds.length,
    };
  }

  return {
    status: 'OK',
    attempted: pendingRows.length,
    delivered: validIds.length,
    failed: malformedIds.length,
  };
}

/**
 * Record a routine, non-critical audit event directly to `DB_AUDIT.audit_logs`.
 * Failures are logged safely and never fail the caller's business operation.
 * Critical security/financial/attendance-correction mutations MUST use `createAuditOutboxStatement` instead.
 *
 * @param {Record<string, unknown>} workerEnv
 * @param {Parameters<typeof createAuditStatement>[1]} params
 */
export async function recordBestEffortAudit(workerEnv, params) {
  try {
    const auditDb = getDomainDb(workerEnv, D1_BINDINGS.AUDIT);
    const stmt = createAuditStatement(auditDb, params);
    await stmt.run();
    return { ok: true };
  } catch {
    console.warn(
      JSON.stringify({
        level: 'WARN',
        event: 'BEST_EFFORT_AUDIT_FAILED',
        action: params?.action ?? null,
        entityType: params?.entityType ?? null,
        requestId: params?.requestId ?? null,
      })
    );
    return { ok: false };
  }
}

/**
 * Reconcile pending critical `audit_outbox` events across designated domain D1s into `DB_AUDIT.audit_logs`.
 * Processes each domain independently with bounded batches.
 *
 * @param {Record<string, unknown>} workerEnv
 * @param {{ domains?: string[], batchSize?: number, maxAttempts?: number }} [options]
 */
export async function reconcileAuditOutboxes(workerEnv, options = {}) {
  const targetDomains =
    Array.isArray(options.domains) && options.domains.length > 0
      ? options.domains
      : AUDIT_OUTBOX_DOMAINS;

  let auditDb;
  try {
    auditDb = getDomainDb(workerEnv, D1_BINDINGS.AUDIT);
  } catch {
    return {
      ok: false,
      error: 'AUDIT_DB_UNAVAILABLE',
      totalAttempted: 0,
      totalDelivered: 0,
      totalFailed: 0,
      domains: {},
    };
  }

  const results = {};
  let totalAttempted = 0;
  let totalDelivered = 0;
  let totalFailed = 0;
  let allOk = true;

  for (const domainBinding of targetDomains) {
    let domainDb;
    try {
      domainDb = getDomainDb(workerEnv, domainBinding);
    } catch {
      allOk = false;
      results[domainBinding] = {
        status: 'BINDING_UNAVAILABLE',
        attempted: 0,
        delivered: 0,
        failed: 0,
      };
      continue;
    }

    const summary = await deliverDomainOutboxBatch(domainDb, auditDb, {
      batchSize: options.batchSize,
      maxAttempts: options.maxAttempts,
    });
    if (summary.status !== 'OK') {
      allOk = false;
    }
    totalAttempted += summary.attempted;
    totalDelivered += summary.delivered;
    totalFailed += summary.failed;
    results[domainBinding] = summary;
  }

  return {
    ok: allOk,
    totalAttempted,
    totalDelivered,
    totalFailed,
    domains: results,
  };
}
