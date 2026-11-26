import { requireRole } from '@/lib/auth/session';

/**
 * Restrict central audit reconciliation and audit log inspection to `SUPER_ADMIN` (OD-01).
 *
 * @param {{ roles: string[] }} session
 * @param {string} [requestId]
 * @returns {Response | null}
 */
export function assertCanAccessAudit(session, requestId) {
  return requireRole(session, ['SUPER_ADMIN'], requestId);
}
