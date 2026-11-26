import { requireRole } from '@/lib/auth/session';
import { jsonError } from '@/lib/http/response';
import {
  findActiveTeacherAssignmentsForSession,
  hasActiveTeacherClassAssignment,
  hasActiveTeacherClassSubjectAssignment,
} from '@/modules/teachers/teachers.repository';

/**
 * Restrict teacher profile and assignment management to `SUPER_ADMIN` and `COACHING_ADMIN`.
 *
 * @param {{ roles: string[] }} session
 * @param {string} [requestId]
 * @returns {Response | null}
 */
export function assertCanManageTeachers(session, requestId) {
  return requireRole(session, ['SUPER_ADMIN', 'COACHING_ADMIN'], requestId);
}

/**
 * Enforce resource-level authorization for reading a teacher profile:
 * - `SUPER_ADMIN` / `COACHING_ADMIN`: allowed
 * - `TEACHER`: allowed only for own `session.profiles.teacherProfileId`
 * - Others: `403 FORBIDDEN`
 *
 * @param {{ roles: string[], profiles?: { teacherProfileId?: string | null } }} session
 * @param {string} teacherId
 * @param {string} [requestId]
 * @returns {Response | null}
 */
export function assertCanReadTeacherProfile(session, teacherId, requestId) {
  const roles = Array.isArray(session?.roles) ? session.roles : [];

  if (roles.includes('SUPER_ADMIN') || roles.includes('COACHING_ADMIN')) {
    return null;
  }

  if (roles.includes('TEACHER') && session?.profiles?.teacherProfileId === teacherId) {
    return null;
  }

  return jsonError('FORBIDDEN', 'You do not have permission to access this teacher profile.', {
    status: 403,
    requestId,
  });
}

/**
 * Return active session-scoped assignments for an `ACTIVE` teacher profile.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {string} teacherProfileId
 * @param {string} academicSessionId
 */
export async function getTeacherAssignmentsForSession(
  dbAcademics,
  teacherProfileId,
  academicSessionId
) {
  if (!teacherProfileId || !academicSessionId) {
    return [];
  }
  return await findActiveTeacherAssignmentsForSession(
    dbAcademics,
    teacherProfileId,
    academicSessionId
  );
}

/**
 * Verify that an admin or an `ACTIVE` teacher is assigned to `(academicSessionId, classId)`.
 * Returns `null` when authorized or a `403 FORBIDDEN` Response otherwise.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {{ roles: string[], profiles?: { teacherProfileId?: string | null } }} session
 * @param {{ academicSessionId: string, classId: string }} scope
 * @param {string} [requestId]
 * @returns {Promise<Response | null>}
 */
export async function assertTeacherAssignedToClass(
  dbAcademics,
  session,
  { academicSessionId, classId },
  requestId
) {
  const roles = Array.isArray(session?.roles) ? session.roles : [];

  if (roles.includes('SUPER_ADMIN') || roles.includes('COACHING_ADMIN')) {
    return null;
  }

  if (roles.includes('TEACHER') && session?.profiles?.teacherProfileId && academicSessionId && classId) {
    const assigned = await hasActiveTeacherClassAssignment(
      dbAcademics,
      session.profiles.teacherProfileId,
      academicSessionId,
      classId
    );
    if (assigned) {
      return null;
    }
  }

  return jsonError('FORBIDDEN', 'You do not have an active assignment for this class.', {
    status: 403,
    requestId,
  });
}

/**
 * Verify that an admin or an `ACTIVE` teacher is assigned to `(academicSessionId, classId, subjectId)`.
 * Returns `null` when authorized or a `403 FORBIDDEN` Response otherwise.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {{ roles: string[], profiles?: { teacherProfileId?: string | null } }} session
 * @param {{ academicSessionId: string, classId: string, subjectId: string }} scope
 * @param {string} [requestId]
 * @returns {Promise<Response | null>}
 */
export async function assertTeacherAssignedToClassSubject(
  dbAcademics,
  session,
  { academicSessionId, classId, subjectId },
  requestId
) {
  const roles = Array.isArray(session?.roles) ? session.roles : [];

  if (roles.includes('SUPER_ADMIN') || roles.includes('COACHING_ADMIN')) {
    return null;
  }

  if (
    roles.includes('TEACHER') &&
    session?.profiles?.teacherProfileId &&
    academicSessionId &&
    classId &&
    subjectId
  ) {
    const assigned = await hasActiveTeacherClassSubjectAssignment(
      dbAcademics,
      session.profiles.teacherProfileId,
      academicSessionId,
      classId,
      subjectId
    );
    if (assigned) {
      return null;
    }
  }

  return jsonError(
    'FORBIDDEN',
    'You do not have an active assignment for this class and subject.',
    {
      status: 403,
      requestId,
    }
  );
}
