/**
 * Shared browser-side JSON fetch helper for `/api/v1/*` endpoints.
 *
 * Always sends credentials (`HttpOnly` session cookie) and normalizes
 * standard `{ data, pagination, error, meta }` envelopes.
 */

export class ApiClientError extends Error {
  /**
   * @param {string} message
   * @param {{ status?: number, code?: string, details?: unknown[] }} [options]
   */
  constructor(message, options = {}) {
    super(message);
    this.name = 'ApiClientError';
    this.status = options.status ?? 500;
    this.code = options.code ?? 'API_ERROR';
    this.details = Array.isArray(options.details) ? options.details : [];
  }
}

/**
 * Fetch JSON from an internal `/api/v1/*` route.
 *
 * @template T
 * @param {string} url
 * @param {RequestInit} [options]
 * @returns {Promise<{ data: T, pagination?: { page: number, pageSize: number, total: number, totalPages: number }, meta?: { requestId?: string } }>}
 */
export async function apiFetch(url, options = {}) {
  const headers = new Headers(options.headers);
  if (options.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    credentials: 'include',
    ...options,
    headers,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload?.error?.message ||
      (response.status === 401
        ? 'Your session has expired. Please sign in again.'
        : response.status === 403
          ? 'You do not have permission to access this resource.'
          : `Request failed (${response.status}).`);
    throw new ApiClientError(message, {
      status: response.status,
      code: payload?.error?.code || (response.status === 401 ? 'UNAUTHORIZED' : 'API_ERROR'),
      details: payload?.error?.details,
    });
  }

  return payload ?? { data: null };
}
