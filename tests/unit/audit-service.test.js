import { describe, expect, it, vi } from 'vitest';
import { D1_BINDINGS } from '@/lib/cloudflare/bindings';
import { assertCanAccessAudit } from '@/modules/audit/audit.permissions';
import {
  deliverDomainOutboxBatch,
  normalizeOutboxEvent,
  reconcileAuditOutboxes,
  recordBestEffortAudit,
  redactAuditPayload,
} from '@/modules/audit/audit.service';

describe('audit payload redaction, normalization, RBAC, and best-effort delivery', () => {
  it('redacts sensitive credentials recursively without mutating safe fields', () => {
    const redacted = redactAuditPayload({
      userId: 'u_1',
      otp: '123456',
      rawToken: 'tok_abc',
      password: 'secret',
      accessToken: 'acc_1',
      authorization: 'Bearer xyz',
      nested: { cookie: 'sms_session=1', role: 'SUPER_ADMIN' },
    });

    expect(redacted).toEqual({
      userId: 'u_1',
      otp: '[REDACTED]',
      rawToken: '[REDACTED]',
      password: '[REDACTED]',
      accessToken: '[REDACTED]',
      authorization: '[REDACTED]',
      nested: { cookie: '[REDACTED]', role: 'SUPER_ADMIN' },
    });
  });

  it('normalizes valid outbox rows and rejects malformed ones', () => {
    const valid = normalizeOutboxEvent({
      id: 'evt_1',
      actor_user_id: 'u_1',
      action: 'CREATE',
      entity_type: 'USER',
      entity_id: 'u_2',
      old_values: null,
      new_values: '{"ok":true}',
      ip_address: '127.0.0.1',
      request_id: 'req_1',
      created_at: '2026-11-26T00:00:00.000Z',
    });
    expect(valid.ok).toBe(true);
    expect(valid.entry.id).toBe('evt_1');

    expect(normalizeOutboxEvent(null).ok).toBe(false);
    expect(normalizeOutboxEvent({ id: 'evt_2', action: 'INVALID', entity_type: 'USER', entity_id: '1', created_at: '2026-11-26T00:00:00.000Z' }).ok).toBe(false);
    expect(normalizeOutboxEvent({ id: 'evt_3', action: 'CREATE', entity_type: '   ', entity_id: '1', created_at: '2026-11-26T00:00:00.000Z' }).ok).toBe(false);
  });

  it('enforces SUPER_ADMIN-only access on audit reconciliation', () => {
    expect(assertCanAccessAudit({ roles: ['SUPER_ADMIN'] })).toBeNull();
    expect(assertCanAccessAudit({ roles: ['COACHING_ADMIN'] })?.status).toBe(403);
    expect(assertCanAccessAudit({ roles: ['TEACHER'] })?.status).toBe(403);
    expect(assertCanAccessAudit({ roles: ['STUDENT'] })?.status).toBe(403);
  });

  it('recordBestEffortAudit never throws when DB_AUDIT is missing or fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const missingResult = await recordBestEffortAudit(
      {},
      {
        action: 'UPDATE',
        entityType: 'TIMETABLE',
        entityId: 'tt_1',
        requestId: 'req_be_1',
      }
    );
    expect(missingResult).toEqual({ ok: false });

    const failingDb = {
      prepare: () => ({
        bind: () => ({
          run: async () => {
            throw new Error('DB_AUDIT down');
          },
        }),
      }),
    };
    const failResult = await recordBestEffortAudit(
      { [D1_BINDINGS.AUDIT]: failingDb },
      {
        action: 'UPDATE',
        entityType: 'TIMETABLE',
        entityId: 'tt_1',
        requestId: 'req_be_2',
      }
    );
    expect(failResult).toEqual({ ok: false });
    expect(warnSpy).toHaveBeenCalledTimes(2);
    warnSpy.mockRestore();
  });

  it('reconcileAuditOutboxes handles missing DB_AUDIT and partial missing domain bindings safely', async () => {
    const noAudit = await reconcileAuditOutboxes({});
    expect(noAudit.ok).toBe(false);
    expect(noAudit.error).toBe('AUDIT_DB_UNAVAILABLE');

    const emptyDomainDb = {
      prepare: () => ({
        bind: () => ({
          all: async () => ({ results: [] }),
        }),
      }),
    };
    const partial = await reconcileAuditOutboxes({
      [D1_BINDINGS.AUDIT]: emptyDomainDb,
      [D1_BINDINGS.IDENTITY]: emptyDomainDb,
      // DB_STUDENTS, DB_ATTENDANCE, DB_FINANCE intentionally missing
    });

    expect(partial.ok).toBe(false);
    expect(partial.domains[D1_BINDINGS.IDENTITY].status).toBe('OK');
    expect(partial.domains[D1_BINDINGS.STUDENTS].status).toBe('BINDING_UNAVAILABLE');
    expect(partial.domains[D1_BINDINGS.ATTENDANCE].status).toBe('BINDING_UNAVAILABLE');
    expect(partial.domains[D1_BINDINGS.FINANCE].status).toBe('BINDING_UNAVAILABLE');
  });

  it('handles central insert failure and source mark-delivered failure safely', async () => {
    const pendingRow = {
      id: 'evt_fail_1',
      actor_user_id: 'u_1',
      action: 'CREATE',
      entity_type: 'PAYMENT',
      entity_id: 'pay_1',
      old_values: null,
      new_values: '{"amountPaise":1000}',
      ip_address: '127.0.0.1',
      request_id: 'req_1',
      status: 'PENDING',
      attempts: 0,
      last_error: null,
      created_at: '2026-11-26T00:00:00.000Z',
      delivered_at: null,
    };

    const batchMock = vi.fn(async () => []);
    const domainDb = {
      prepare: () => ({
        bind: () => ({
          all: async () => ({ results: [pendingRow] }),
        }),
      }),
      batch: batchMock,
    };
    const failingAuditDb = {
      prepare: () => ({
        bind: () => ({}),
      }),
      batch: async () => {
        throw new Error('DB_AUDIT write failed');
      },
    };

    const res1 = await deliverDomainOutboxBatch(domainDb, failingAuditDb, { maxAttempts: 3 });
    expect(res1.status).toBe('CENTRAL_INSERT_FAILED');
    expect(res1.delivered).toBe(0);
    expect(res1.failed).toBe(1);
    expect(batchMock).toHaveBeenCalledTimes(1);

    const healthyAuditDb = {
      prepare: () => ({ bind: () => ({}) }),
      batch: async () => [],
    };
    const failMarkDomainDb = {
      prepare: () => ({
        bind: () => ({
          all: async () => ({ results: [pendingRow] }),
        }),
      }),
      batch: async () => {
        throw new Error('Source mark failed');
      },
    };
    const res2 = await deliverDomainOutboxBatch(failMarkDomainDb, healthyAuditDb);
    expect(res2.status).toBe('SOURCE_MARK_FAILED');
    expect(res2.delivered).toBe(1);
  });
});
