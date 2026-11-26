import { requireRole } from '@/lib/auth/session';
import { jsonError } from '@/lib/http/response';
import { hasVerifiedParentLink } from '@/modules/students/students.repository';
import {
  assertTeacherAssignedToClass,
  assertTeacherAssignedToClassSubject,
} from '@/modules/teachers/teachers.permissions';

/**
 * Restrict attendance register administration to `SUPER_ADMIN` and `COACHING_ADMIN`.
 *
 * @param {{ roles: string[] }} session
 * @param {string} [requestId]
 * @returns {Response | null}
 */
export function assertCanManageAttendance(session, requestId) {
  return requireRole(session, ['SUPER_ADMIN', 'COACHING_ADMIN'], requestId);
}

/**
 * Verify that an admin or an `ACTIVE` teacher is assigned to `(academicSessionId, classId)`.
 * Fails closed with `403 FORBIDDEN` if `dbAcademics` is unavailable.
 *
 * @param {import('@cloudflare/workers-types').D1Database | null | undefined} dbAcademics
 * @param {{ roles: string[], profiles?: { teacherProfileId?: string | null } }} session
 * @param {{ academicSessionId: string, classId: string }} scope
 * @param {string} [requestId]
 * @returns {Promise<Response | null>}
 */
export async function assertCanMarkDailyAttendance(
  dbAcademics,
  session,
  { academicSessionId, classId },
  requestId
) {
  const roles = Array.isArray(session?.roles) ? session.roles : [];
  if (roles.includes('SUPER_ADMIN') || roles.includes('COACHING_ADMIN')) {
    return null;
  }

  if (!dbAcademics) {
    return jsonError('FORBIDDEN', 'You do not have an active assignment for this class.', {
      status: 403,
      requestId,
    });
  }

  try {
    return await assertTeacherAssignedToClass(
      dbAcademics,
      session,
      { academicSessionId, classId },
      requestId
    );
  } catch {
    return jsonError('FORBIDDEN', 'You do not have an active assignment for this class.', {
      status: 403,
      requestId,
    });
  }
}

/**
 * Verify that an admin or an `ACTIVE` teacher is assigned to `(academicSessionId, classId, subjectId)`.
 * Fails closed with `403 FORBIDDEN` if `dbAcademics` is unavailable.
 *
 * @param {import('@cloudflare/workers-types').D1Database | null | undefined} dbAcademics
 * @param {{ roles: string[], profiles?: { teacherProfileId?: string | null } }} session
 * @param {{ academicSessionId: string, classId: string, subjectId: string }} scope
 * @param {string} [requestId]
 * @returns {Promise<Response | null>}
 */
export async function assertCanMarkPeriodAttendance(
  dbAcademics,
  session,
  { academicSessionId, classId, subjectId },
  requestId
) {
  const roles = Array.isArray(session?.roles) ? session.roles : [];
  if (roles.includes('SUPER_ADMIN') || roles.includes('COACHING_ADMIN')) {
    return null;
  }

  if (!dbAcademics) {
    return jsonError(
      'FORBIDDEN',
      'You do not have an active assignment for this class and subject.',
      {
        status: 403,
        requestId,
      }
    );
  }

  try {
    return await assertTeacherAssignedToClassSubject(
      dbAcademics,
      session,
      { academicSessionId, classId, subjectId },
      requestId
    );
  } catch {
    return jsonError(
      'FORBIDDEN',
      'You do not have an active assignment for this class and subject.',
      {
        status: 403,
        requestId,
      }
    );
  }
}

/**
 * Restrict post-lock / audit-tracked attendance corrections to `SUPER_ADMIN` and `COACHING_ADMIN`.
 *
 * @param {{ roles: string[] }} session
 * @param {string} [requestId]
 * @returns {Response | null}
 */
export function assertCanCorrectAttendance(session, requestId) {
  return requireRole(session, ['SUPER_ADMIN', 'COACHING_ADMIN'], requestId);
}

/**
 * Enforce resource-level authorization for reading a student's attendance:
 * - `SUPER_ADMIN` / `COACHING_ADMIN`: allowed
 * - `STUDENT`: allowed only for own `session.profiles.studentId`
 * - `PARENT`: allowed only for `VERIFIED` linked children in `DB_STUDENTS.parent_students`
 * - Others: `403 FORBIDDEN` (fail closed)
 *
 * @param {import('@cloudflare/workers-types').D1Database | null | undefined} dbStudents
 * @param {{ roles: string[], profiles?: { studentId?: string | null, parentProfileId?: string | null } }} session
 * @param {string} studentId
 * @param {string} [requestId]
 * @returns {Promise<Response | null>}
 */
export async function assertCanReadStudentAttendance(dbStudents, session, studentId, requestId) {
  const roles = Array.isArray(session?.roles) ? session.roles : [];

  if (roles.includes('SUPER_ADMIN') || roles.includes('COACHING_ADMIN')) {
    return null;
  }

  if (roles.includes('STUDENT') && session?.profiles?.studentId === studentId) {
    return null;
  }

  if (roles.includes('PARENT') && session?.profiles?.parentProfileId && dbStudents && studentId) {
    try {
      const isLinked = await hasVerifiedParentLink(
        dbStudents,
        session.profiles.parentProfileId,
        studentId
      );
      if (isLinked) {
        return null;
      }
    } catch {
      // Fail closed below.
    }
  }

  return jsonError('FORBIDDEN', 'You do not have permission to access this student attendance.', {
    status: 403,
    requestId,
  });
}
