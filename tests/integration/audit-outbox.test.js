import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { POST as postReconcile } from '@/app/api/v1/admin/audit/reconcile/route';
import { hashSessionToken } from '@/lib/auth/crypto';
import { D1_BINDINGS } from '@/lib/cloudflare/bindings';
import * as bindings from '@/lib/cloudflare/bindings';
import {
  createAuditOutboxStatement,
  deliverDomainOutboxBatch,
  reconcileAuditOutboxes,
  recordBestEffortAudit,
} from '@/modules/audit/audit.service';
import { createMultiD1Proxy } from '../helpers/multi-d1-proxy';

let ctx;
let testEnv;

describe('Phase B3 Audit Outbox Delivery, Idempotency & Reconciliation Integration', () => {
  beforeAll(async () => {
    ctx = await createMultiD1Proxy({ applyMigrations: true, applySeeds: true });
    testEnv = {
      ...ctx.env,
      SESSION_SECRET: 'integration_test_session_secret_32chars',
      ENVIRONMENT: 'test',
    };
  }, 60000);

  afterAll(async () => {
    if (ctx) {
      await ctx.cleanup();
    }
  });

  it('delivers critical outbox events from all 4 domains into DB_AUDIT idempotently without duplicates', async () => {
    const outboxDomains = [
      { binding: D1_BINDINGS.IDENTITY, entityType: 'USER', action: 'CREATE' },
      { binding: D1_BINDINGS.STUDENTS, entityType: 'PARENT_STUDENT', action: 'UNLINK' },
      { binding: D1_BINDINGS.ATTENDANCE, entityType: 'DAILY_ATTENDANCE', action: 'CORRECTION' },
      { binding: D1_BINDINGS.FINANCE, entityType: 'PAYMENT', action: 'REVERSAL' },
    ];

    const eventIds = [];
    for (const item of outboxDomains) {
      const domainDb = ctx.dbs[item.binding];
      const eventId = crypto.randomUUID();
      eventIds.push(eventId);
      const stmt = createAuditOutboxStatement(domainDb, {
        id: eventId,
        actorUserId: '11000000-0000-4000-8000-000000000001',
        action: item.action,
        entityType: item.entityType,
        entityId: `ent_${item.binding}`,
        newValues: { domain: item.binding, rawToken: 'should_be_redacted' },
        ipAddress: '10.0.0.1',
        requestId: `req_${item.binding}`,
        createdAt: '2026-11-26T10:00:00.000Z',
      });
      await domainDb.batch([stmt]);
    }

    const summary = await reconcileAuditOutboxes(testEnv, { batchSize: 10 });
    expect(summary.ok).toBe(true);
    expect(summary.totalDelivered).toBe(4);
    expect(summary.totalFailed).toBe(0);

    const auditDb = ctx.dbs[D1_BINDINGS.AUDIT];
    for (let i = 0; i < eventIds.length; i++) {
      const id = eventIds[i];
      const row = await auditDb
        .prepare('SELECT id, action, entity_type, new_values FROM audit_logs WHERE id = ?')
        .bind(id)
        .first();
      expect(row?.id).toBe(id);
      expect(row?.new_values).toContain('[REDACTED]');

      const sourceRow = await ctx.dbs[outboxDomains[i].binding]
        .prepare('SELECT status, delivered_at FROM audit_outbox WHERE id = ?')
        .bind(id)
        .first();
      expect(sourceRow?.status).toBe('DELIVERED');
      expect(sourceRow?.delivered_at).toBeTruthy();
    }

    // Re-running reconciliation or re-inserting duplicate event ID never creates duplicates
    const secondRun = await reconcileAuditOutboxes(testEnv, { batchSize: 10 });
    expect(secondRun.totalDelivered).toBe(0);

    // Simulate central insert succeeded previously, but source row is still PENDING -> retry is idempotent
    const duplicateId = eventIds[0];
    await ctx.dbs[D1_BINDINGS.IDENTITY]
      .prepare("UPDATE audit_outbox SET status = 'PENDING', delivered_at = NULL WHERE id = ?")
      .bind(duplicateId)
      .run();

    const retrySummary = await deliverDomainOutboxBatch(ctx.dbs[D1_BINDINGS.IDENTITY], auditDb);
    expect(retrySummary.status).toBe('OK');
    expect(retrySummary.delivered).toBe(1);

    const countRow = await auditDb
      .prepare('SELECT COUNT(*) AS cnt FROM audit_logs WHERE id = ?')
      .bind(duplicateId)
      .first();
    expect(countRow?.cnt).toBe(1);
  });

  it('tracks retry attempts and transitions to FAILED after maxAttempts when central DB_AUDIT fails', async () => {
    const financeDb = ctx.dbs[D1_BINDINGS.FINANCE];
    const eventId = crypto.randomUUID();
    await financeDb
      .batch([
        createAuditOutboxStatement(financeDb, {
          id: eventId,
          actorUserId: '11000000-0000-4000-8000-000000000001',
          action: 'CREATE',
          entityType: 'INVOICE',
          entityId: 'inv_retry_1',
          createdAt: '2026-11-26T10:05:00.000Z',
        }),
      ]);

    const brokenAuditDb = {
      prepare: () => ({ bind: () => ({}) }),
      batch: async () => {
        throw new Error('Simulated DB_AUDIT outage');
      },
    };

    // Attempt 1 -> stays PENDING with attempts = 1
    const r1 = await deliverDomainOutboxBatch(financeDb, brokenAuditDb, { maxAttempts: 2 });
    expect(r1.status).toBe('CENTRAL_INSERT_FAILED');
    const rowAfter1 = await financeDb
      .prepare('SELECT status, attempts, last_error FROM audit_outbox WHERE id = ?')
      .bind(eventId)
      .first();
    expect(rowAfter1?.status).toBe('PENDING');
    expect(rowAfter1?.attempts).toBe(1);
    expect(rowAfter1?.last_error).toBe('CENTRAL_AUDIT_INSERT_FAILED');

    // Attempt 2 -> transitions to FAILED when attempts reaches maxAttempts (2)
    await deliverDomainOutboxBatch(financeDb, brokenAuditDb, { maxAttempts: 2 });
    const rowAfter2 = await financeDb
      .prepare('SELECT status, attempts FROM audit_outbox WHERE id = ?')
      .bind(eventId)
      .first();
    expect(rowAfter2?.status).toBe('FAILED');
    expect(rowAfter2?.attempts).toBe(2);
  });

  it('supports bounded batch processing, best-effort audit writes, and SUPER_ADMIN-only reconciliation endpoint', async () => {
    const identityDb = ctx.dbs[D1_BINDINGS.IDENTITY];

    // Insert 3 pending events and reconcile with batchSize = 2
    const ids = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
    await identityDb.batch(
      ids.map((id, idx) =>
        createAuditOutboxStatement(identityDb, {
          id,
          actorUserId: '11000000-0000-4000-8000-000000000001',
          action: 'UPDATE',
          entityType: 'USER',
          entityId: `bounded_${idx}`,
          createdAt: `2026-11-26T11:0${idx}:00.000Z`,
        })
      )
    );

    const boundedRes = await deliverDomainOutboxBatch(identityDb, ctx.dbs[D1_BINDINGS.AUDIT], {
      batchSize: 2,
    });
    expect(boundedRes.delivered).toBe(2);

    // Best-effort event lands in DB_AUDIT.audit_logs
    const beResult = await recordBestEffortAudit(testEnv, {
      actorUserId: '11000000-0000-4000-8000-000000000002',
      action: 'UPDATE',
      entityType: 'TIMETABLE_SLOT',
      entityId: 'slot_1',
      newValues: { room: 'Room 101' },
      requestId: 'req_be_int_1',
    });
    expect(beResult).toEqual({ ok: true });

    // Create SUPER_ADMIN and COACHING_ADMIN sessions to test POST /api/v1/admin/audit/reconcile
    const superToken = 'b3_super_admin_session_token_12345';
    const adminToken = 'b3_coaching_admin_session_token_12345';
    const futureExpiry = new Date(Date.now() + 86_400_000).toISOString();
    const now = new Date().toISOString();

    await identityDb.batch([
      identityDb
        .prepare(
          `INSERT INTO sessions (id, user_id, token_hash, expires_at, revoked_at, user_agent, ip_address, created_at)
           VALUES (?, ?, ?, ?, NULL, 'Vitest', '127.0.0.1', ?)`
        )
        .bind(crypto.randomUUID(), '11000000-0000-4000-8000-000000000001', await hashSessionToken(superToken), futureExpiry, now),
      identityDb
        .prepare(
          `INSERT INTO sessions (id, user_id, token_hash, expires_at, revoked_at, user_agent, ip_address, created_at)
           VALUES (?, ?, ?, ?, NULL, 'Vitest', '127.0.0.1', ?)`
        )
        .bind(crypto.randomUUID(), '11000000-0000-4000-8000-000000000002', await hashSessionToken(adminToken), futureExpiry, now),
    ]);

    const { vi } = await import('vitest');
    const spy = vi.spyOn(bindings, 'resolveWorkerEnv').mockResolvedValue(testEnv);

    try {
      // Unauthenticated -> 401
      const unauthRes = await postReconcile(
        new Request('http://localhost:3000/api/v1/admin/audit/reconcile', {
          method: 'POST',
          headers: { origin: 'http://localhost:3000' },
        })
      );
      expect(unauthRes.status).toBe(401);

      // COACHING_ADMIN -> 403 FORBIDDEN
      const forbiddenRes = await postReconcile(
        new Request('http://localhost:3000/api/v1/admin/audit/reconcile', {
          method: 'POST',
          headers: {
            origin: 'http://localhost:3000',
            cookie: `sms_session=${adminToken}`,
          },
        })
      );
      expect(forbiddenRes.status).toBe(403);

      // SUPER_ADMIN -> 200 reconciles the remaining 1 pending event
      const okRes = await postReconcile(
        new Request('http://localhost:3000/api/v1/admin/audit/reconcile', {
          method: 'POST',
          headers: {
            origin: 'http://localhost:3000',
            cookie: `sms_session=${superToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ domains: [D1_BINDINGS.IDENTITY], batchSize: 10 }),
        })
      );
      expect(okRes.status).toBe(200);
      const body = await okRes.json();
      expect(body.data.ok).toBe(true);
      expect(body.data.totalDelivered).toBe(1);
    } finally {
      spy.mockRestore();
    }
  });
});
