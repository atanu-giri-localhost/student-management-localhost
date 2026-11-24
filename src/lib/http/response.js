/**
 * Standard JSON response envelope builders for `/api/v1/*` Route Handlers.
 */

const SAFE_REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

/**
 * Extract an incoming correlation ID or generate a fresh request ID.
 *
 * @param {Request} [request]
 * @returns {string}
 */
export function createRequestId(request) {
  const incoming = request?.headers?.get('x-request-id')?.trim();
  if (incoming && SAFE_REQUEST_ID_PATTERN.test(incoming)) {
    return incoming;
  }
  return `req_${crypto.randomUUID()}`;
}

/**
 * Build headers including `X-Request-Id` without mutating caller-provided headers.
 *
 * @param {string} requestId
 * @param {HeadersInit} [extraHeaders]
 * @returns {Headers}
 */
function buildHeaders(requestId, extraHeaders) {
  const headers = new Headers(extraHeaders);
  headers.set('X-Request-Id', requestId);
  return headers;
}

/**
 * Return a standard success JSON envelope: `{ data, meta: { requestId } }`.
 *
 * @template T
 * @param {T} data
 * @param {{ status?: number, requestId?: string, headers?: HeadersInit }} [options]
 * @returns {Response}
 */
export function jsonOk(data, options = {}) {
  const status = options.status ?? 200;
  const requestId = options.requestId || createRequestId();
  return Response.json(
    {
      data,
      meta: { requestId },
    },
    {
      status,
      headers: buildHeaders(requestId, options.headers),
    }
  );
}

/**
 * Return a standard paginated collection envelope:
 * `{ data, pagination: { page, pageSize, total, totalPages }, meta: { requestId } }`.
 *
 * @template T
 * @param {T[]} data
 * @param {{ page: number, pageSize: number, total: number, totalPages?: number }} pagination
 * @param {{ status?: number, requestId?: string, headers?: HeadersInit }} [options]
 * @returns {Response}
 */
export function jsonPaginated(data, pagination, options = {}) {
  const status = options.status ?? 200;
  const requestId = options.requestId || createRequestId();
  const page = Number.isInteger(pagination?.page) && pagination.page > 0 ? pagination.page : 1;
  const pageSize =
    Number.isInteger(pagination?.pageSize) && pagination.pageSize > 0 ? pagination.pageSize : 25;
  const total = Number.isInteger(pagination?.total) && pagination.total >= 0 ? pagination.total : 0;
  const totalPages =
    typeof pagination?.totalPages === 'number' && pagination.totalPages >= 0
      ? pagination.totalPages
      : Math.ceil(total / pageSize);

  return Response.json(
    {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
      meta: { requestId },
    },
    {
      status,
      headers: buildHeaders(requestId, options.headers),
    }
  );
}

/**
 * Return a standard error envelope:
 * `{ error: { code, message, details }, meta: { requestId } }`.
 *
 * @param {string | { code: string, message: string, details?: unknown[], status?: number, requestId?: string, headers?: HeadersInit }} codeOrConfig
 * @param {string} [message]
 * @param {{ status?: number, details?: unknown[], requestId?: string, headers?: HeadersInit }} [options]
 * @returns {Response}
 */
export function jsonError(codeOrConfig, message, options = {}) {
  const config =
    typeof codeOrConfig === 'object' && codeOrConfig !== null
      ? codeOrConfig
      : { code: codeOrConfig, message, ...options };

  const status = config.status ?? 500;
  const requestId = config.requestId || createRequestId();
  const details = Array.isArray(config.details) ? config.details : [];

  return Response.json(
    {
      error: {
        code: config.code || 'INTERNAL_ERROR',
        message: config.message || 'An unexpected error occurred.',
        details,
      },
      meta: { requestId },
    },
    {
      status,
      headers: buildHeaders(requestId, config.headers),
    }
  );
}
