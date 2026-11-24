import { requireRole } from '@/lib/auth/session';

/**
 * Enforce SUPER_ADMIN-only access for user and role administration (provisional OD-01).
 *
 * @param {{ roles: string[] }} session
 * @param {string} [requestId]
 * @returns {Response | null}
 */
export function assertCanManageUsers(session, requestId) {
  return requireRole(session, ['SUPER_ADMIN'], requestId);
}
