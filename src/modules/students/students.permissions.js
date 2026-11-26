import { requireRole } from '@/lib/auth/session';
import { jsonError } from '@/lib/http/response';
import { hasVerifiedParentLink } from '@/modules/students/students.repository';

/**
 * Restrict student creation, listing, updates, and lifecycle changes to `SUPER_ADMIN` and `COACHING_ADMIN`.
 *
 * @param {{ roles: string[] }} session
 * @param {string} [requestId]
 * @returns {Response | null}
 */
export function assertCanManageStudents(session, requestId) {
  return requireRole(session, ['SUPER_ADMIN', 'COACHING_ADMIN'], requestId);
}

/**
 * Enforce strict resource-level authorization for reading a single student record:
 * - `SUPER_ADMIN` / `COACHING_ADMIN`: allowed
 * - `STUDENT`: allowed only for own `session.profiles.studentId`
 * - `PARENT`: allowed only for `VERIFIED` linked children in `DB_STUDENTS.parent_students`
 * - `TEACHER` / others: `403 FORBIDDEN` in Phase B4 (teacher scoping belongs to B5/B6)
 *
 * @param {{ roles: string[], profiles?: { studentId?: string | null, parentProfileId?: string | null } }} session
 * @param {string} studentId
 * @param {import('@cloudflare/workers-types').D1Database} dbStudents
 * @param {string} [requestId]
 * @returns {Promise<Response | null>}
 */
export async function assertCanReadStudent(session, studentId, dbStudents, requestId) {
  const roles = Array.isArray(session?.roles) ? session.roles : [];

  if (roles.includes('SUPER_ADMIN') || roles.includes('COACHING_ADMIN')) {
    return null;
  }

  if (roles.includes('STUDENT') && session?.profiles?.studentId === studentId) {
    return null;
  }

  if (roles.includes('PARENT') && session?.profiles?.parentProfileId) {
    const isLinked = await hasVerifiedParentLink(
      dbStudents,
      session.profiles.parentProfileId,
      studentId
    );
    if (isLinked) {
      return null;
    }
  }

  return jsonError('FORBIDDEN', 'You do not have permission to access this student record.', {
    status: 403,
    requestId,
  });
}
