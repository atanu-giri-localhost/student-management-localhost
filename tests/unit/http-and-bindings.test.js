import { afterEach, describe, expect, it, vi } from 'vitest';
import * as bindings from '@/lib/cloudflare/bindings';
import {
  D1_BINDINGS,
  getAllDomainDbs,
  getDb,
  getDomainDb,
  getStorage,
  resolveWorkerEnv,
} from '@/lib/cloudflare/bindings';
import { createRequestId, jsonError, jsonOk, jsonPaginated } from '@/lib/http/response';
import { GET as getHealth } from '@/app/api/v1/health/route';

function makeMockEnv(overrides = {}) {
  const env = {};
  for (const bindingName of Object.values(D1_BINDINGS)) {
    env[bindingName] = {
      name: bindingName,
      prepare: () => ({
        first: async () => ({ ok: 1 }),
      }),
    };
  }
  return { ...env, ...overrides };
}

describe('request-scoped Cloudflare bindings', () => {
  it('defines all 8 canonical D1_BINDINGS without duplicates', () => {
    const entries = Object.entries(D1_BINDINGS);
    expect(entries).toHaveLength(8);
    expect(D1_BINDINGS).toEqual({
      IDENTITY: 'DB_IDENTITY',
      STUDENTS: 'DB_STUDENTS',
      ACADEMICS: 'DB_ACADEMICS',
      ATTENDANCE: 'DB_ATTENDANCE',
      PERFORMANCE: 'DB_PERFORMANCE',
      FINANCE: 'DB_FINANCE',
      TIMETABLE: 'DB_TIMETABLE',
      AUDIT: 'DB_AUDIT',
    });
    expect(new Set(Object.values(D1_BINDINGS)).size).toBe(8);
  });

  it('resolves each of the 8 bindings via getDomainDb without cross-domain substitution', () => {
    const mockEnv = makeMockEnv({ DB: { name: 'LEGACY_DB' } });
    for (const bindingName of Object.values(D1_BINDINGS)) {
      const resolved = getDomainDb(mockEnv, bindingName);
      expect(resolved).toBe(mockEnv[bindingName]);
      expect(resolved.name).toBe(bindingName);
    }
  });

  it('rejects unsupported binding names and missing bindings without falling back to env.DB', () => {
    const envWithOnlyLegacyDb = { DB: { name: 'LEGACY_DB' } };
    expect(() => getDomainDb(envWithOnlyLegacyDb, D1_BINDINGS.IDENTITY)).toThrow('env.DB_IDENTITY');
    expect(() => getDomainDb(envWithOnlyLegacyDb, 'DB')).toThrow('Unsupported Cloudflare D1 binding name');
    expect(() => getDomainDb(envWithOnlyLegacyDb, 'UNKNOWN_DB')).toThrow('Unsupported Cloudflare D1 binding name');
    expect(() => getDomainDb(envWithOnlyLegacyDb, '')).toThrow('Unsupported Cloudflare D1 binding name');
    expect(() => getDomainDb(null, D1_BINDINGS.FINANCE)).toThrow('env.DB_FINANCE');
  });

  it('resolves all 8 bindings via getAllDomainDbs and fails clearly if any is missing', () => {
    const mockEnv = makeMockEnv();
    const dbs = getAllDomainDbs(mockEnv);
    expect(Object.keys(dbs)).toEqual(Object.values(D1_BINDINGS));
    for (const bindingName of Object.values(D1_BINDINGS)) {
      expect(dbs[bindingName]).toBe(mockEnv[bindingName]);
    }

    const partialEnv = makeMockEnv({ DB_AUDIT: undefined, DB: { name: 'LEGACY_DB' } });
    expect(() => getAllDomainDbs(partialEnv)).toThrow('env.DB_AUDIT');
  });

  it('preserves legacy getDb and getStorage compatibility helpers', () => {
    const mockDb = { prepare: () => {} };
    const mockStorage = { put: () => {} };
    expect(getDb({ DB: mockDb })).toBe(mockDb);
    expect(getStorage({ STORAGE: mockStorage })).toBe(mockStorage);
    expect(() => getDb({})).toThrow('env.DB');
    expect(() => getDb(null)).toThrow('env.DB');
    expect(() => getStorage({})).toThrow('env.STORAGE');
    expect(() => getStorage(undefined)).toThrow('env.STORAGE');
  });

  it('falls back gracefully outside Workers when cloudflare:workers is absent', async () => {
    const resolved = await resolveWorkerEnv();
    expect(resolved).toEqual({});
    const explicit = { DB: { ok: true } };
    expect(await resolveWorkerEnv(explicit)).toBe(explicit);
  });
});

describe('HTTP response envelopes', () => {
  it('shapes jsonOk with data and meta.requestId', async () => {
    const res = jsonOk({ status: 'ok' }, { requestId: 'req_test_123' });
    expect(res.status).toBe(200);
    expect(res.headers.get('x-request-id')).toBe('req_test_123');
    expect(await res.json()).toEqual({
      data: { status: 'ok' },
      meta: { requestId: 'req_test_123' },
    });
  });

  it('shapes jsonPaginated with totalPages and meta.requestId', async () => {
    const res = jsonPaginated([{ id: '1' }], { page: 2, pageSize: 25, total: 51 });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toEqual([{ id: '1' }]);
    expect(body.pagination).toEqual({
      page: 2,
      pageSize: 25,
      total: 51,
      totalPages: 3,
    });
    expect(body.meta.requestId).toMatch(/^req_/);
  });

  it('shapes jsonError with error object and meta.requestId', async () => {
    const res = jsonError('VALIDATION_ERROR', 'Invalid payload', {
      status: 400,
      details: [{ field: 'amountPaidPaise', message: 'Must be positive integer' }],
      requestId: 'req_err_1',
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid payload',
        details: [{ field: 'amountPaidPaise', message: 'Must be positive integer' }],
      },
      meta: { requestId: 'req_err_1' },
    });
  });

  it('sanitizes unsafe x-request-id headers and generates valid req_ IDs', () => {
    const badReq = new Request('http://localhost/api/v1/health', {
      headers: { 'x-request-id': 'bad header\r\n' },
    });
    const goodReq = new Request('http://localhost/api/v1/health', {
      headers: { 'x-request-id': 'req_valid-01.abc' },
    });
    expect(createRequestId(badReq)).toMatch(/^req_/);
    expect(createRequestId(goodReq)).toBe('req_valid-01.abc');
  });
});

describe('GET /api/v1/health (8-D1 liveness and readiness)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 200 liveness response for ?scope=live without querying D1', async () => {
    const req = new Request('http://localhost/api/v1/health?scope=live', {
      headers: { 'x-request-id': 'req_health_live' },
    });
    const res = await getHealth(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      data: {
        status: 'ok',
        mode: 'liveness',
      },
      meta: { requestId: 'req_health_live' },
    });
  });

  it('returns 200 readiness response when all 8 D1 bindings respond healthy', async () => {
    const mockEnv = makeMockEnv();
    vi.spyOn(bindings, 'resolveWorkerEnv').mockResolvedValue(mockEnv);

    const req = new Request('http://localhost/api/v1/health', {
      headers: { 'x-request-id': 'req_health_ready' },
    });
    const res = await getHealth(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      data: {
        status: 'ok',
        mode: 'readiness',
        databases: 'connected',
        checkedBindings: 8,
      },
      meta: { requestId: 'req_health_ready' },
    });
  });

  it('returns 503 DB_UNAVAILABLE without leaking internals when any D1 binding is missing', async () => {
    const partialEnv = makeMockEnv({ DB_FINANCE: undefined });
    vi.spyOn(bindings, 'resolveWorkerEnv').mockResolvedValue(partialEnv);

    const req = new Request('http://localhost/api/v1/health', {
      headers: { 'x-request-id': 'req_health_missing' },
    });
    const res = await getHealth(req);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({
      error: {
        code: 'DB_UNAVAILABLE',
        message: 'Database service is unavailable.',
        details: [],
      },
      meta: { requestId: 'req_health_missing' },
    });
    expect(JSON.stringify(body)).not.toContain('DB_FINANCE');
  });

  it('returns 503 DB_UNAVAILABLE without leaking SQL error details when a query throws', async () => {
    const failingEnv = makeMockEnv({
      DB_AUDIT: {
        prepare: () => ({
          first: async () => {
            throw new Error('SQLITE_ERROR: secret_internal_detail');
          },
        }),
      },
    });
    vi.spyOn(bindings, 'resolveWorkerEnv').mockResolvedValue(failingEnv);

    const req = new Request('http://localhost/api/v1/health', {
      headers: { 'x-request-id': 'req_health_err' },
    });
    const res = await getHealth(req);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe('DB_UNAVAILABLE');
    expect(JSON.stringify(body)).not.toContain('SQLITE_ERROR');
    expect(JSON.stringify(body)).not.toContain('secret_internal_detail');
  });

  it('returns 503 DB_UNHEALTHY when a D1 readiness query returns unexpected output', async () => {
    const unhealthyEnv = makeMockEnv({
      DB_IDENTITY: {
        prepare: () => ({
          first: async () => ({ ok: 0 }),
        }),
      },
    });
    vi.spyOn(bindings, 'resolveWorkerEnv').mockResolvedValue(unhealthyEnv);

    const req = new Request('http://localhost/api/v1/health', {
      headers: { 'x-request-id': 'req_health_unhealthy' },
    });
    const res = await getHealth(req);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      error: {
        code: 'DB_UNHEALTHY',
        message: 'Database connectivity check failed.',
        details: [],
      },
      meta: { requestId: 'req_health_unhealthy' },
    });
  });
});
