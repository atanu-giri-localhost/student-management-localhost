import { requireRole } from '@/lib/auth/session';

/**
 * Check whether the authenticated caller may revoke another user's sessions.
 * Per provisional baseline OD-01, administrative session revocation is restricted to SUPER_ADMIN.
 *
 * @param {{ roles: string[] }} session
 * @param {string} [requestId]
 * @returns {Response | null}
 */
export function assertCanRevokeSessions(session, requestId) {
  return requireRole(session, ['SUPER_ADMIN'], requestId);
}
