import { getAllDomainDbs, resolveWorkerEnv } from '@/lib/cloudflare/bindings';
import { createRequestId, jsonError, jsonOk } from '@/lib/http/response';

/**
 * Health check Route Handler (`GET /api/v1/health`).
 * - `?scope=live`: Lightweight Worker liveness check (no D1 queries).
 * - Default: Readiness check executing `SELECT 1 AS ok` in parallel across all 8 D1 bindings.
 * Never exposes database IDs, raw SQL errors, or internal stack traces.
 *
 * @param {Request} request
 * @returns {Promise<Response>}
 */
export async function GET(request) {
  const requestId = createRequestId(request);
  const url = new URL(request.url);

  if (url.searchParams.get('scope') === 'live') {
    return jsonOk(
      {
        status: 'ok',
        mode: 'liveness',
      },
      { requestId }
    );
  }

  try {
    const workerEnv = await resolveWorkerEnv();
    const dbs = getAllDomainDbs(workerEnv);
    const entries = Object.entries(dbs);

    const results = await Promise.all(
      entries.map(([, db]) => db.prepare('SELECT 1 AS ok').first())
    );

    const allHealthy = results.every((result) => result && result.ok === 1);
    if (!allHealthy) {
      return jsonError('DB_UNHEALTHY', 'Database connectivity check failed.', {
        status: 503,
        requestId,
      });
    }

    return jsonOk(
      {
        status: 'ok',
        mode: 'readiness',
        databases: 'connected',
        checkedBindings: entries.length,
      },
      { requestId }
    );
  } catch {
    return jsonError('DB_UNAVAILABLE', 'Database service is unavailable.', {
      status: 503,
      requestId,
    });
  }
}
