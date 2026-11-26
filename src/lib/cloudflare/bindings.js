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
 * Canonical 8-D1 domain binding names.
 */
export const D1_BINDINGS = Object.freeze({
  IDENTITY: 'DB_IDENTITY',
  STUDENTS: 'DB_STUDENTS',
  ACADEMICS: 'DB_ACADEMICS',
  ATTENDANCE: 'DB_ATTENDANCE',
  PERFORMANCE: 'DB_PERFORMANCE',
  FINANCE: 'DB_FINANCE',
  TIMETABLE: 'DB_TIMETABLE',
  AUDIT: 'DB_AUDIT',
});

const VALID_D1_BINDING_NAMES = new Set(Object.values(D1_BINDINGS));

/**
 * Return a named request-scoped Cloudflare D1 domain binding.
 * Validates that `bindingName` is one of the 8 canonical `D1_BINDINGS` and never falls back to `env.DB`.
 *
 * @param {Record<string, unknown>} env
 * @param {string} bindingName
 * @returns {import('@cloudflare/workers-types').D1Database}
 */
export function getDomainDb(env, bindingName) {
  if (typeof bindingName !== 'string' || !VALID_D1_BINDING_NAMES.has(bindingName)) {
    throw new Error(`Unsupported Cloudflare D1 binding name "${String(bindingName)}".`);
  }
  if (!env || typeof env !== 'object' || !env[bindingName]) {
    throw new Error(
      `Cloudflare D1 binding (env.${bindingName}) is unavailable in the current request context.`
    );
  }
  return /** @type {import('@cloudflare/workers-types').D1Database} */ (env[bindingName]);
}

/**
 * Resolve all 8 request-scoped Cloudflare D1 domain bindings.
 * Fails clearly if any required binding is missing and never substitutes legacy `env.DB`.
 *
 * @param {Record<string, unknown>} env
 * @returns {Record<string, import('@cloudflare/workers-types').D1Database>}
 */
export function getAllDomainDbs(env) {
  return {
    [D1_BINDINGS.IDENTITY]: getDomainDb(env, D1_BINDINGS.IDENTITY),
    [D1_BINDINGS.STUDENTS]: getDomainDb(env, D1_BINDINGS.STUDENTS),
    [D1_BINDINGS.ACADEMICS]: getDomainDb(env, D1_BINDINGS.ACADEMICS),
    [D1_BINDINGS.ATTENDANCE]: getDomainDb(env, D1_BINDINGS.ATTENDANCE),
    [D1_BINDINGS.PERFORMANCE]: getDomainDb(env, D1_BINDINGS.PERFORMANCE),
    [D1_BINDINGS.FINANCE]: getDomainDb(env, D1_BINDINGS.FINANCE),
    [D1_BINDINGS.TIMETABLE]: getDomainDb(env, D1_BINDINGS.TIMETABLE),
    [D1_BINDINGS.AUDIT]: getDomainDb(env, D1_BINDINGS.AUDIT),
  };
}

/**
 * Return the legacy single-D1 binding (`env.DB`) for pre-Phase-B callers.
 *
 * @deprecated Preserved temporarily during B1 for unmigrated Auth and Users modules.
 * Migrate callers to `getDomainDb(env, D1_BINDINGS.<DOMAIN>)` in Phase B2+.
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
