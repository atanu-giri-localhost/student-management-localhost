import { requireRole } from '@/lib/auth/session';
import { jsonError } from '@/lib/http/response';
import { hasVerifiedParentLink } from '@/modules/students/students.repository';

/**
 * Restrict financial administration (components, structures, invoices, payments, allocations, adjustments)
 * to `SUPER_ADMIN` and `COACHING_ADMIN`.
 */
export function assertCanManageFinance(session, requestId) {
  return requireRole(session, ['SUPER_ADMIN', 'COACHING_ADMIN'], requestId);
}

/**
 * Restrict payment reversals strictly to `SUPER_ADMIN` (OD-01, OD-10).
 */
export function assertCanReversePayment(session, requestId) {
  return requireRole(session, ['SUPER_ADMIN'], requestId);
}

/**
 * Enforce read-only financial access rules:
 * - `STUDENT` is strictly blocked (`403 FORBIDDEN` Student Fee Wall per AGENTS.md).
 * - `TEACHER` is strictly blocked (`403 FORBIDDEN`).
 * - `SUPER_ADMIN` / `COACHING_ADMIN`: allowed.
 * - `PARENT`: allowed only for `VERIFIED` linked children in `DB_STUDENTS.parent_students`.
 * Fails closed if `dbStudents` is unavailable.
 */
export async function assertCanReadStudentFinance(dbStudents, session, studentId, requestId) {
  const roles = Array.isArray(session?.roles) ? session.roles : [];

  if (roles.includes('SUPER_ADMIN') || roles.includes('COACHING_ADMIN')) {
    return null;
  }

  if (roles.includes('PARENT') && session?.profiles?.parentProfileId && dbStudents && studentId) {
    try {
      const linked = await hasVerifiedParentLink(
        dbStudents,
        session.profiles.parentProfileId,
        studentId
      );
      if (linked) {
        return null;
      }
    } catch {
      return jsonError('DB_UNAVAILABLE', 'Unable to verify guardian authorization.', {
        status: 503,
        requestId,
      });
    }
  }

  return jsonError('FORBIDDEN', 'You do not have permission to access these financial records.', {
    status: 403,
    requestId,
  });
}
