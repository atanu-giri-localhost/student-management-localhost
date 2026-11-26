import { getClientIp } from '@/lib/auth/session';
import { D1_BINDINGS, getDomainDb } from '@/lib/cloudflare/bindings';
import { jsonError } from '@/lib/http/response';
import { formatZodIssues } from '@/lib/validation/common';
import { TimetableServiceError } from '@/modules/timetable/timetable.service';

/**
 * Resolve `DB_TIMETABLE` from workerEnv or return a 503 Response.
 *
 * @param {Record<string, unknown>} workerEnv
 * @param {string} requestId
 * @returns {{ ok: true, db: unknown } | { ok: false, response: Response }}
 */
export function resolveTimetableDb(workerEnv, requestId) {
  try {
    return { ok: true, db: getDomainDb(workerEnv, D1_BINDINGS.TIMETABLE) };
  } catch (err) {
    return {
      ok: false,
      response: jsonError(
        'SERVICE_UNAVAILABLE',
        err?.message || 'Timetable database binding is unavailable.',
        {
          status: 503,
          requestId,
        }
      ),
    };
  }
}

/**
 * Resolve `DB_ACADEMICS` from workerEnv or return a 503 Response.
 *
 * @param {Record<string, unknown>} workerEnv
 * @param {string} requestId
 * @returns {{ ok: true, db: unknown } | { ok: false, response: Response }}
 */
export function resolveAcademicsDb(workerEnv, requestId) {
  try {
    return { ok: true, db: getDomainDb(workerEnv, D1_BINDINGS.ACADEMICS) };
  } catch (err) {
    return {
      ok: false,
      response: jsonError(
        'SERVICE_UNAVAILABLE',
        err?.message || 'Academics database binding is unavailable.',
        {
          status: 503,
          requestId,
        }
      ),
    };
  }
}

/**
 * Resolve `DB_STUDENTS` from workerEnv or return a 503 Response.
 *
 * @param {Record<string, unknown>} workerEnv
 * @param {string} requestId
 * @returns {{ ok: true, db: unknown } | { ok: false, response: Response }}
 */
export function resolveStudentsDb(workerEnv, requestId) {
  try {
    return { ok: true, db: getDomainDb(workerEnv, D1_BINDINGS.STUDENTS) };
  } catch (err) {
    return {
      ok: false,
      response: jsonError(
        'SERVICE_UNAVAILABLE',
        err?.message || 'Students database binding is unavailable.',
        {
          status: 503,
          requestId,
        }
      ),
    };
  }
}

/**
 * Parse URL search parameters with a Zod schema.
 *
 * @template T
 * @param {Request} request
 * @param {import('zod').ZodType<T>} schema
 * @param {string} requestId
 * @returns {{ ok: true, data: T } | { ok: false, response: Response }}
 */
export function parseQueryParams(request, schema, requestId) {
  const url = new URL(request.url);
  const raw = Object.fromEntries(url.searchParams.entries());
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: jsonError('VALIDATION_ERROR', 'Invalid query parameters.', {
        status: 400,
        details: formatZodIssues(parsed.error),
        requestId,
      }),
    };
  }
  return { ok: true, data: parsed.data };
}

/**
 * Parse a dynamic route path parameter with a Zod schema.
 *
 * @template T
 * @param {Promise<Record<string, string>> | Record<string, string>} params
 * @param {string} key
 * @param {import('zod').ZodType<T>} schema
 * @param {string} requestId
 * @returns {Promise<{ ok: true, value: T } | { ok: false, response: Response }>}
 */
export async function parsePathParam(params, key, schema, requestId) {
  const resolved = await params;
  const parsed = schema.safeParse(resolved?.[key]);
  if (!parsed.success) {
    return {
      ok: false,
      response: jsonError('VALIDATION_ERROR', `Invalid route parameter '${key}'.`, {
        status: 400,
        details: formatZodIssues(parsed.error),
        requestId,
      }),
    };
  }
  return { ok: true, value: parsed.data };
}

/**
 * Build audit metadata from the incoming request.
 *
 * @param {Request} request
 * @param {string} requestId
 * @returns {{ requestId: string, clientIp: string | null, userAgent: string | null }}
 */
export function buildAuditMeta(request, requestId) {
  return {
    requestId,
    clientIp: getClientIp(request),
    userAgent: request.headers.get('user-agent') || null,
  };
}

/**
 * Map timetable service errors to standard JSON error envelopes.
 *
 * @param {unknown} err
 * @param {string} requestId
 * @returns {Response}
 */
export function handleTimetableError(err, requestId) {
  if (err instanceof TimetableServiceError) {
    return jsonError(err.code, err.message, {
      status: err.status,
      details: Array.isArray(err.details)
        ? err.details
        : err.details !== undefined
          ? [err.details]
          : [],
      requestId,
    });
  }
  console.error('Unhandled timetable route error', { requestId, message: err?.message });
  return jsonError('INTERNAL_ERROR', 'An unexpected error occurred.', {
    status: 500,
    requestId,
  });
}
