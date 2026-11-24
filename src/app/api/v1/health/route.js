import { getDb, resolveWorkerEnv } from '@/lib/cloudflare/bindings';
import { createRequestId, jsonError, jsonOk } from '@/lib/http/response';

/**
 * Health check Route Handler validating request-scoped D1 connectivity.
 * Executes `SELECT 1` without exposing secrets or internal error details.
 *
 * @param {Request} request
 * @returns {Promise<Response>}
 */
export async function GET(request) {
  const requestId = createRequestId(request);

  try {
    const workerEnv = await resolveWorkerEnv();
    const db = getDb(workerEnv);
    const result = await db.prepare('SELECT 1 AS ok').first();

    if (!result || result.ok !== 1) {
      return jsonError('DB_UNHEALTHY', 'Database connectivity check failed.', {
        status: 503,
        requestId,
      });
    }

    return jsonOk(
      {
        status: 'ok',
        db: 'connected',
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
