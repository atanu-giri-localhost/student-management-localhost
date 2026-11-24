/**
 * Request-scoped Cloudflare Workers binding helpers.
 * Never store env, env.DB, or env.STORAGE in module-level singletons.
 */

/**
 * Resolve the request-scoped Cloudflare Worker `env` object.
 * Falls back gracefully when executed outside the Cloudflare Workers runtime.
 *
 * @param {Record<string, unknown>} [explicitEnv]
 * @returns {Promise<Record<string, unknown>>}
 */
export async function resolveWorkerEnv(explicitEnv) {
  if (explicitEnv && typeof explicitEnv === 'object') {
    return explicitEnv;
  }
  try {
    const cloudflareWorkers = await import('cloudflare:workers');
    return cloudflareWorkers?.env ?? {};
  } catch {
    return {};
  }
}

/**
 * Return the request-scoped Cloudflare D1 database binding (`env.DB`).
 *
 * @param {{ DB?: import('@cloudflare/workers-types').D1Database } | Record<string, unknown>} env
 * @returns {import('@cloudflare/workers-types').D1Database}
 */
export function getDb(env) {
  if (!env || typeof env !== 'object' || !env.DB) {
    throw new Error('Cloudflare D1 binding (env.DB) is unavailable in the current request context.');
  }
  return env.DB;
}

/**
 * Return the request-scoped Cloudflare R2 bucket binding (`env.STORAGE`).
 *
 * @param {{ STORAGE?: import('@cloudflare/workers-types').R2Bucket } | Record<string, unknown>} env
 * @returns {import('@cloudflare/workers-types').R2Bucket}
 */
export function getStorage(env) {
  if (!env || typeof env !== 'object' || !env.STORAGE) {
    throw new Error('Cloudflare R2 binding (env.STORAGE) is unavailable in the current request context.');
  }
  return env.STORAGE;
}
