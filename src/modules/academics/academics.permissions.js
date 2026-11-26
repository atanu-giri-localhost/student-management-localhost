import { requireRole } from '@/lib/auth/session';

const ACADEMICS_ADMIN_ROLES = ['SUPER_ADMIN', 'COACHING_ADMIN'];
const ACADEMICS_READ_ROLES = [
  'SUPER_ADMIN',
  'COACHING_ADMIN',
  'TEACHER',
  'PARENT',
  'STUDENT',
];

/**
 * Restrict academic structure mutations (sessions, classes, subjects, curriculum mappings)
 * to `SUPER_ADMIN` and `COACHING_ADMIN`.
 *
 * @param {{ roles: string[] }} session
 * @param {string} [requestId]
 * @returns {Response | null}
 */
export function assertCanManageAcademics(session, requestId) {
  return requireRole(session, ACADEMICS_ADMIN_ROLES, requestId);
}

/**
 * Allow authenticated users with a valid portal role to read academic structure metadata.
 *
 * @param {{ roles: string[] }} session
 * @param {string} [requestId]
 * @returns {Response | null}
 */
export function assertCanReadAcademics(session, requestId) {
  return requireRole(session, ACADEMICS_READ_ROLES, requestId);
}
