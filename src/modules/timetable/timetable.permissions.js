import { requireRole } from '@/lib/auth/session';
import { jsonError } from '@/lib/http/response';
import { hasVerifiedParentLink } from '@/modules/students/students.repository';
import { assertTeacherAssignedToClass } from '@/modules/teachers/teachers.permissions';
import { findActiveAcademicSessionId } from '@/modules/teachers/teachers.repository';

/**
 * Restrict timetable, room, and academic calendar mutations to `SUPER_ADMIN` and `COACHING_ADMIN`.
 *
 * @param {{ roles: string[] }} session
 * @param {string} [requestId]
 * @returns {Response | null}
 */
export function assertCanManageTimetable(session, requestId) {
  return requireRole(session, ['SUPER_ADMIN', 'COACHING_ADMIN'], requestId);
}

/**
 * Allow any authenticated coaching role to read rooms and academic calendar entries.
 *
 * @param {{ roles: string[] }} session
 * @param {string} [requestId]
 * @returns {Response | null}
 */
export function assertCanReadTimetableReference(session, requestId) {
  return requireRole(
    session,
    ['SUPER_ADMIN', 'COACHING_ADMIN', 'TEACHER', 'STUDENT', 'PARENT'],
    requestId
  );
}

/**
 * Enforce resource-level authorization for reading a class timetable:
 * - `SUPER_ADMIN` / `COACHING_ADMIN`: allowed
 * - `TEACHER`: allowed if assigned to `(academicSessionId, classId)` in `DB_ACADEMICS`
 * - `STUDENT`: allowed if actively enrolled in `(classId[, academicSessionId])` in `DB_STUDENTS`
 * - `PARENT`: allowed if a `VERIFIED` linked child is actively enrolled in `(classId[, academicSessionId])`
 * - Others: `403 FORBIDDEN` (fail closed)
 *
 * @param {import('@cloudflare/workers-types').D1Database | null | undefined} dbAcademics
 * @param {import('@cloudflare/workers-types').D1Database | null | undefined} dbStudents
 * @param {{ roles: string[], profiles?: { teacherProfileId?: string | null, studentId?: string | null, parentProfileId?: string | null } }} session
 * @param {{ academicSessionId?: string | null, classId: string }} scope
 * @param {string} [requestId]
 * @returns {Promise<Response | null>}
 */
export async function assertCanReadClassTimetable(
  dbAcademics,
  dbStudents,
  session,
  { academicSessionId, classId },
  requestId
) {
  const roles = Array.isArray(session?.roles) ? session.roles : [];

  if (roles.includes('SUPER_ADMIN') || roles.includes('COACHING_ADMIN')) {
    return null;
  }

  let resolvedSessionId = academicSessionId || null;
  if (!resolvedSessionId && dbAcademics) {
    try {
      resolvedSessionId = await findActiveAcademicSessionId(dbAcademics);
    } catch {
      resolvedSessionId = null;
    }
  }

  if (roles.includes('TEACHER') && dbAcademics && resolvedSessionId && classId) {
    try {
      const teacherError = await assertTeacherAssignedToClass(
        dbAcademics,
        session,
        { academicSessionId: resolvedSessionId, classId },
        requestId
      );
      if (!teacherError) {
        return null;
      }
    } catch {
      // Continue checking other roles or fail closed below.
    }
  }

  if (roles.includes('STUDENT') && session?.profiles?.studentId && dbStudents && classId) {
    try {
      const row = resolvedSessionId
        ? await dbStudents
            .prepare(
              `SELECT 1 AS ok
               FROM enrollments
               WHERE student_id = ?
                 AND class_id = ?
                 AND academic_session_id = ?
                 AND enrollment_status = 'ACTIVE'
               LIMIT 1`
            )
            .bind(session.profiles.studentId, classId, resolvedSessionId)
            .first()
        : await dbStudents
            .prepare(
              `SELECT 1 AS ok
               FROM enrollments
               WHERE student_id = ?
                 AND class_id = ?
                 AND enrollment_status = 'ACTIVE'
               LIMIT 1`
            )
            .bind(session.profiles.studentId, classId)
            .first();

      if (row?.ok === 1) {
        return null;
      }
    } catch {
      // Fail closed below.
    }
  }

  if (roles.includes('PARENT') && session?.profiles?.parentProfileId && dbStudents && classId) {
    try {
      const row = resolvedSessionId
        ? await dbStudents
            .prepare(
              `SELECT 1 AS ok
               FROM parent_students ps
               INNER JOIN enrollments e
                 ON e.student_id = ps.student_id
               WHERE ps.parent_profile_id = ?
                 AND ps.verification_status = 'VERIFIED'
                 AND e.class_id = ?
                 AND e.academic_session_id = ?
                 AND e.enrollment_status = 'ACTIVE'
               LIMIT 1`
            )
            .bind(session.profiles.parentProfileId, classId, resolvedSessionId)
            .first()
        : await dbStudents
            .prepare(
              `SELECT 1 AS ok
               FROM parent_students ps
               INNER JOIN enrollments e
                 ON e.student_id = ps.student_id
               WHERE ps.parent_profile_id = ?
                 AND ps.verification_status = 'VERIFIED'
                 AND e.class_id = ?
                 AND e.enrollment_status = 'ACTIVE'
               LIMIT 1`
            )
            .bind(session.profiles.parentProfileId, classId)
            .first();

      if (row?.ok === 1) {
        return null;
      }
    } catch {
      // Fail closed below.
    }
  }

  return jsonError('FORBIDDEN', 'You do not have permission to access this class timetable.', {
    status: 403,
    requestId,
  });
}

/**
 * Enforce resource-level authorization for reading a teacher's timetable:
 * - `SUPER_ADMIN` / `COACHING_ADMIN`: allowed
 * - `TEACHER`: allowed only for own `session.profiles.teacherProfileId`
 * - Others: `403 FORBIDDEN`
 *
 * @param {{ roles: string[], profiles?: { teacherProfileId?: string | null } }} session
 * @param {string} teacherProfileId
 * @param {string} [requestId]
 * @returns {Response | null}
 */
export function assertCanReadTeacherTimetable(session, teacherProfileId, requestId) {
  const roles = Array.isArray(session?.roles) ? session.roles : [];

  if (roles.includes('SUPER_ADMIN') || roles.includes('COACHING_ADMIN')) {
    return null;
  }

  if (roles.includes('TEACHER') && session?.profiles?.teacherProfileId === teacherProfileId) {
    return null;
  }

  return jsonError('FORBIDDEN', 'You do not have permission to access this teacher timetable.', {
    status: 403,
    requestId,
  });
}

/**
 * Enforce resource-level authorization for reading a student's timetable:
 * - `SUPER_ADMIN` / `COACHING_ADMIN`: allowed
 * - `STUDENT`: allowed only for own `session.profiles.studentId`
 * - `PARENT`: allowed only for `VERIFIED` linked children in `DB_STUDENTS.parent_students`
 * - Others: `403 FORBIDDEN`
 *
 * @param {import('@cloudflare/workers-types').D1Database | null | undefined} dbStudents
 * @param {{ roles: string[], profiles?: { studentId?: string | null, parentProfileId?: string | null } }} session
 * @param {string} studentId
 * @param {string} [requestId]
 * @returns {Promise<Response | null>}
 */
export async function assertCanReadStudentTimetable(dbStudents, session, studentId, requestId) {
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

  return jsonError('FORBIDDEN', 'You do not have permission to access this student timetable.', {
    status: 403,
    requestId,
  });
}
