import { D1_BINDINGS, getDomainDb } from '@/lib/cloudflare/bindings';
import { nowIso } from '@/lib/dates/format';
import { recordBestEffortAudit } from '@/modules/audit/audit.service';
import {
  deleteTeacherAssignmentById,
  findActiveAcademicSessionId,
  findTeacherAssignmentById,
  findTeacherById,
  hasActiveTeacherClassAssignment,
  insertTeacherAssignment,
  insertTeacherProfile,
  listActiveClassRosterPaginated,
  listTeacherAssignmentsPaginated,
  listTeachersPaginated,
  updateTeacherProfile,
  validateAssignmentReferencesExist,
} from '@/modules/teachers/teachers.repository';

export class TeachersServiceError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {number} status
   */
  constructor(code, message, status) {
    super(message);
    this.name = 'TeachersServiceError';
    this.code = code;
    this.status = status;
  }
}

async function assertActiveUserExists(workerEnv, userId) {
  const dbIdentity = getDomainDb(workerEnv, D1_BINDINGS.IDENTITY);
  const userRow = await dbIdentity
    .prepare('SELECT id, is_active FROM users WHERE id = ? LIMIT 1')
    .bind(userId)
    .first();

  if (!userRow || userRow.is_active !== 1) {
    throw new TeachersServiceError(
      'VALIDATION_ERROR',
      'Referenced user account does not exist or is inactive.',
      400
    );
  }
}

async function assertPhotoFileExists(workerEnv, photoFileId) {
  if (!photoFileId) return;
  const dbStudents = getDomainDb(workerEnv, D1_BINDINGS.STUDENTS);
  const fileRow = await dbStudents
    .prepare('SELECT id FROM file_objects WHERE id = ? LIMIT 1')
    .bind(photoFileId)
    .first();

  if (!fileRow) {
    throw new TeachersServiceError('VALIDATION_ERROR', 'Referenced photo file does not exist.', 400);
  }
}

/**
 * List teacher profiles with bounded pagination and filters.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {{ page: number, pageSize: number, search?: string, employmentStatus?: string }} query
 */
export async function listTeachersService(dbAcademics, query) {
  return await listTeachersPaginated(dbAcademics, {
    search: query.search,
    employmentStatus: query.employmentStatus,
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  });
}

/**
 * Create a new `teacher_profiles` record in `DB_ACADEMICS` with cross-D1 validation
 * (`DB_IDENTITY.users` and `DB_STUDENTS.file_objects`) and best-effort audit logging.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {Record<string, unknown>} workerEnv
 * @param {{ userId: string }} actorSession
 * @param {Record<string, unknown>} input
 * @param {{ clientIp: string, requestId: string }} meta
 */
export async function createTeacherService(dbAcademics, workerEnv, actorSession, input, meta) {
  await assertActiveUserExists(workerEnv, input.userId);
  await assertPhotoFileExists(workerEnv, input.photoFileId);

  const timestamp = nowIso();
  const teacherId = crypto.randomUUID();
  const employmentStatus = input.employmentStatus ?? 'ACTIVE';

  try {
    await insertTeacherProfile(dbAcademics, {
      id: teacherId,
      userId: input.userId,
      employeeCode: input.employeeCode,
      fullName: input.fullName,
      qualification: input.qualification ?? null,
      specialization: input.specialization ?? null,
      joiningDate: input.joiningDate,
      employmentStatus,
      photoFileId: input.photoFileId ?? null,
      createdAt: timestamp,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      throw new TeachersServiceError(
        'CONFLICT',
        'A teacher profile with this employee code or linked user already exists.',
        409
      );
    }
    throw error;
  }

  await recordBestEffortAudit(workerEnv, {
    actorUserId: actorSession.userId,
    action: 'CREATE',
    entityType: 'TEACHER_PROFILE',
    entityId: teacherId,
    newValues: {
      userId: input.userId,
      employeeCode: input.employeeCode,
      fullName: input.fullName,
      employmentStatus,
    },
    ipAddress: meta.clientIp,
    requestId: meta.requestId,
    createdAt: timestamp,
  });

  return await findTeacherById(dbAcademics, teacherId);
}

/**
 * Retrieve a single teacher profile by ID along with its assignments.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {string} teacherId
 */
export async function getTeacherByIdService(dbAcademics, teacherId) {
  const teacher = await findTeacherById(dbAcademics, teacherId);
  if (!teacher) {
    throw new TeachersServiceError('NOT_FOUND', 'Teacher profile not found.', 404);
  }
  return teacher;
}

/**
 * Update a `teacher_profiles` record in `DB_ACADEMICS`.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {Record<string, unknown>} workerEnv
 * @param {{ userId: string }} actorSession
 * @param {string} teacherId
 * @param {Record<string, unknown>} input
 * @param {{ clientIp: string, requestId: string }} meta
 */
export async function updateTeacherService(
  dbAcademics,
  workerEnv,
  actorSession,
  teacherId,
  input,
  meta
) {
  const existing = await findTeacherById(dbAcademics, teacherId);
  if (!existing) {
    throw new TeachersServiceError('NOT_FOUND', 'Teacher profile not found.', 404);
  }

  if (input.photoFileId) {
    await assertPhotoFileExists(workerEnv, input.photoFileId);
  }

  try {
    await updateTeacherProfile(dbAcademics, teacherId, input);
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      throw new TeachersServiceError(
        'CONFLICT',
        'A teacher profile with this employee code already exists.',
        409
      );
    }
    throw error;
  }

  await recordBestEffortAudit(workerEnv, {
    actorUserId: actorSession.userId,
    action: 'UPDATE',
    entityType: 'TEACHER_PROFILE',
    entityId: teacherId,
    oldValues: {
      employeeCode: existing.employeeCode,
      fullName: existing.fullName,
      employmentStatus: existing.employmentStatus,
    },
    newValues: input,
    ipAddress: meta.clientIp,
    requestId: meta.requestId,
    createdAt: nowIso(),
  });

  return await findTeacherById(dbAcademics, teacherId);
}

/**
 * List `teacher_assignments` with bounded pagination and filters.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {{
 *   page: number,
 *   pageSize: number,
 *   teacherProfileId?: string,
 *   academicSessionId?: string,
 *   classId?: string,
 *   subjectId?: string,
 *   responsibilityCategory?: string,
 * }} query
 */
export async function listTeacherAssignmentsService(dbAcademics, query) {
  return await listTeacherAssignmentsPaginated(dbAcademics, {
    teacherProfileId: query.teacherProfileId,
    academicSessionId: query.academicSessionId,
    classId: query.classId,
    subjectId: query.subjectId,
    responsibilityCategory: query.responsibilityCategory,
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  });
}

/**
 * Create a new `teacher_assignments` record after validating all `DB_ACADEMICS` references.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {Record<string, unknown>} workerEnv
 * @param {{ userId: string }} actorSession
 * @param {{
 *   teacherProfileId: string,
 *   academicSessionId: string,
 *   classId: string,
 *   subjectId: string,
 *   responsibilityCategory: string,
 * }} input
 * @param {{ clientIp: string, requestId: string }} meta
 */
export async function createTeacherAssignmentService(
  dbAcademics,
  workerEnv,
  actorSession,
  input,
  meta
) {
  const refs = await validateAssignmentReferencesExist(dbAcademics, input);
  if (!refs.teacher) {
    throw new TeachersServiceError('VALIDATION_ERROR', 'Referenced teacher profile does not exist.', 400);
  }
  if (!refs.academicSession) {
    throw new TeachersServiceError('VALIDATION_ERROR', 'Referenced academic session does not exist.', 400);
  }
  if (!refs.classRow) {
    throw new TeachersServiceError('VALIDATION_ERROR', 'Referenced class does not exist.', 400);
  }
  if (!refs.subject) {
    throw new TeachersServiceError('VALIDATION_ERROR', 'Referenced subject does not exist.', 400);
  }

  const timestamp = nowIso();
  const assignmentId = crypto.randomUUID();

  try {
    await insertTeacherAssignment(dbAcademics, {
      id: assignmentId,
      teacherProfileId: input.teacherProfileId,
      academicSessionId: input.academicSessionId,
      classId: input.classId,
      subjectId: input.subjectId,
      responsibilityCategory: input.responsibilityCategory,
      createdAt: timestamp,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      throw new TeachersServiceError(
        'CONFLICT',
        'This teacher assignment already exists for the specified session, class, subject, and role.',
        409
      );
    }
    throw error;
  }

  await recordBestEffortAudit(workerEnv, {
    actorUserId: actorSession.userId,
    action: 'CREATE',
    entityType: 'TEACHER_ASSIGNMENT',
    entityId: assignmentId,
    newValues: input,
    ipAddress: meta.clientIp,
    requestId: meta.requestId,
    createdAt: timestamp,
  });

  return await findTeacherAssignmentById(dbAcademics, assignmentId);
}

/**
 * Delete a `teacher_assignments` record by ID.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {Record<string, unknown>} workerEnv
 * @param {{ userId: string }} actorSession
 * @param {string} assignmentId
 * @param {{ clientIp: string, requestId: string }} meta
 */
export async function deleteTeacherAssignmentService(
  dbAcademics,
  workerEnv,
  actorSession,
  assignmentId,
  meta
) {
  const existing = await findTeacherAssignmentById(dbAcademics, assignmentId);
  if (!existing) {
    throw new TeachersServiceError('NOT_FOUND', 'Teacher assignment not found.', 404);
  }

  await deleteTeacherAssignmentById(dbAcademics, assignmentId);

  await recordBestEffortAudit(workerEnv, {
    actorUserId: actorSession.userId,
    action: 'DELETE',
    entityType: 'TEACHER_ASSIGNMENT',
    entityId: assignmentId,
    oldValues: existing,
    ipAddress: meta.clientIp,
    requestId: meta.requestId,
    createdAt: nowIso(),
  });

  return { deleted: true, id: assignmentId };
}

/**
 * Return the narrowly scoped active class roster for an assigned teacher.
 * Verifies the teacher's active assignment in `DB_ACADEMICS` before querying `DB_STUDENTS`.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {import('@cloudflare/workers-types').D1Database} dbStudents
 * @param {{ roles: string[], profiles?: { teacherProfileId?: string | null } }} session
 * @param {{ classId: string, academicSessionId?: string, page: number, pageSize: number }} params
 */
export async function getTeacherClassRosterService(
  dbAcademics,
  dbStudents,
  session,
  { classId, academicSessionId, page, pageSize }
) {
  const teacherProfileId = session?.profiles?.teacherProfileId;
  if (!teacherProfileId) {
    throw new TeachersServiceError(
      'FORBIDDEN',
      'An active teacher profile is required to access a class roster.',
      403
    );
  }

  const targetSessionId = academicSessionId || (await findActiveAcademicSessionId(dbAcademics));
  if (!targetSessionId) {
    throw new TeachersServiceError(
      'VALIDATION_ERROR',
      'No active academic session found. Provide an academicSessionId.',
      400
    );
  }

  const assigned = await hasActiveTeacherClassAssignment(
    dbAcademics,
    teacherProfileId,
    targetSessionId,
    classId
  );
  if (!assigned) {
    throw new TeachersServiceError(
      'FORBIDDEN',
      'You do not have an active assignment for this class in the selected academic session.',
      403
    );
  }

  const { total, roster } = await listActiveClassRosterPaginated(dbStudents, {
    academicSessionId: targetSessionId,
    classId,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  return {
    academicSessionId: targetSessionId,
    classId,
    roster,
    total,
  };
}
