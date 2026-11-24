import { describe, expect, it } from 'vitest';
import { getDb, getStorage, resolveWorkerEnv } from '@/lib/cloudflare/bindings';
import { createRequestId, jsonError, jsonOk, jsonPaginated } from '@/lib/http/response';
import { GET as getHealth } from '@/app/api/v1/health/route';

describe('request-scoped Cloudflare bindings', () => {
  it('returns DB and STORAGE from explicit env without global caching', () => {
    const mockDb = { prepare: () => {} };
    const mockStorage = { put: () => {} };
    expect(getDb({ DB: mockDb })).toBe(mockDb);
    expect(getStorage({ STORAGE: mockStorage })).toBe(mockStorage);
  });

  it('throws clear errors when bindings are absent', () => {
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

  it('returns 503 JSON error envelope from /api/v1/health without leaking internals when DB binding is unavailable', async () => {
    const req = new Request('http://localhost/api/v1/health', {
      headers: { 'x-request-id': 'req_health_node' },
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
      meta: { requestId: 'req_health_node' },
    });
  });
});
