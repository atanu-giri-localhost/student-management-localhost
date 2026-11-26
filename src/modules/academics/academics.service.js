import { nowIso } from '@/lib/dates/format';
import { recordBestEffortAudit } from '@/modules/audit/audit.service';
import {
  createAcademicSession,
  createClass,
  createClassSubjectMapping,
  createSubject,
  deleteClassSubjectMapping,
  findAcademicSessionById,
  findClassById,
  findClassSubjectMapping,
  findSubjectById,
  listAcademicSessionsPaginated,
  listClassesPaginated,
  listClassSubjects,
  listSubjectsPaginated,
  updateAcademicSession,
  updateClass,
  updateSubject,
} from '@/modules/academics/academics.repository';

export class AcademicsServiceError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {number} status
   */
  constructor(code, message, status) {
    super(message);
    this.name = 'AcademicsServiceError';
    this.code = code;
    this.status = status;
  }
}

function isUniqueConstraintError(error) {
  return error instanceof Error && error.message.includes('UNIQUE constraint failed');
}

function isForeignKeyConstraintError(error) {
  return error instanceof Error && error.message.includes('FOREIGN KEY constraint failed');
}

// ---------------------------------------------------------------------------
// Academic Sessions
// ---------------------------------------------------------------------------

/**
 * List academic sessions with bounded pagination and optional `isActive` filter.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {{ page: number, pageSize: number, isActive?: boolean }} query
 */
export async function listAcademicSessionsService(dbAcademics, query) {
  return await listAcademicSessionsPaginated(dbAcademics, {
    isActive: query.isActive,
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  });
}

/**
 * Fetch a single academic session by ID.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {string} sessionId
 */
export async function getAcademicSessionByIdService(dbAcademics, sessionId) {
  const session = await findAcademicSessionById(dbAcademics, sessionId);
  if (!session) {
    throw new AcademicsServiceError('NOT_FOUND', 'Academic session not found.', 404);
  }
  return session;
}

/**
 * Create a new academic session. If `isActive` is true, atomically deactivates any prior
 * active session inside `DB_ACADEMICS.batch([...])`.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {Record<string, unknown>} workerEnv
 * @param {{ userId: string }} actorSession
 * @param {{ name: string, startDate: string, endDate: string, isActive?: boolean }} input
 * @param {{ clientIp: string, requestId: string }} meta
 */
export async function createAcademicSessionService(
  dbAcademics,
  workerEnv,
  actorSession,
  input,
  meta
) {
  const sessionId = crypto.randomUUID();
  const createdAt = nowIso();
  const isActive = input.isActive ? 1 : 0;

  try {
    await createAcademicSession(dbAcademics, {
      id: sessionId,
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
      isActive,
      createdAt,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AcademicsServiceError(
        'CONFLICT',
        'An academic session with this name already exists or active session conflict occurred.',
        409
      );
    }
    throw error;
  }

  const created = await findAcademicSessionById(dbAcademics, sessionId);
  await recordBestEffortAudit(workerEnv, {
    actorUserId: actorSession.userId,
    action: 'CREATE',
    entityType: 'ACADEMIC_SESSION',
    entityId: sessionId,
    newValues: created,
    ipAddress: meta.clientIp,
    requestId: meta.requestId,
    createdAt,
  });

  return created;
}

/**
 * Update an existing academic session. If `isActive` is set to true, atomically deactivates
 * any other active session inside `DB_ACADEMICS.batch([...])`.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {Record<string, unknown>} workerEnv
 * @param {{ userId: string }} actorSession
 * @param {string} sessionId
 * @param {{ name?: string, startDate?: string, endDate?: string, isActive?: boolean }} input
 * @param {{ clientIp: string, requestId: string }} meta
 */
export async function updateAcademicSessionService(
  dbAcademics,
  workerEnv,
  actorSession,
  sessionId,
  input,
  meta
) {
  const existing = await findAcademicSessionById(dbAcademics, sessionId);
  if (!existing) {
    throw new AcademicsServiceError('NOT_FOUND', 'Academic session not found.', 404);
  }

  const mergedStartDate = input.startDate ?? existing.startDate;
  const mergedEndDate = input.endDate ?? existing.endDate;
  if (mergedEndDate < mergedStartDate) {
    throw new AcademicsServiceError(
      'VALIDATION_ERROR',
      'End date must be on or after start date.',
      400
    );
  }

  const nextState = {
    name: input.name ?? existing.name,
    startDate: mergedStartDate,
    endDate: mergedEndDate,
    isActive: typeof input.isActive === 'boolean' ? (input.isActive ? 1 : 0) : existing.isActive ? 1 : 0,
  };

  try {
    await updateAcademicSession(dbAcademics, sessionId, nextState);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AcademicsServiceError(
        'CONFLICT',
        'An academic session with this name already exists or active session conflict occurred.',
        409
      );
    }
    throw error;
  }

  const updated = await findAcademicSessionById(dbAcademics, sessionId);
  await recordBestEffortAudit(workerEnv, {
    actorUserId: actorSession.userId,
    action: 'UPDATE',
    entityType: 'ACADEMIC_SESSION',
    entityId: sessionId,
    oldValues: existing,
    newValues: updated,
    ipAddress: meta.clientIp,
    requestId: meta.requestId,
  });

  return updated;
}

// ---------------------------------------------------------------------------
// Classes & Class-Subject Curriculum Mapping
// ---------------------------------------------------------------------------

/**
 * List classes with bounded pagination and optional grade-level or search filters.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {{ page: number, pageSize: number, gradeLevel?: number, search?: string }} query
 */
export async function listClassesService(dbAcademics, query) {
  return await listClassesPaginated(dbAcademics, {
    gradeLevel: query.gradeLevel,
    search: query.search,
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  });
}

/**
 * Fetch a single class by ID.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {string} classId
 */
export async function getClassByIdService(dbAcademics, classId) {
  const cls = await findClassById(dbAcademics, classId);
  if (!cls) {
    throw new AcademicsServiceError('NOT_FOUND', 'Class not found.', 404);
  }
  return cls;
}

/**
 * Create a new class record.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {Record<string, unknown>} workerEnv
 * @param {{ userId: string }} actorSession
 * @param {{ name: string, gradeLevel: number, section?: string | null }} input
 * @param {{ clientIp: string, requestId: string }} meta
 */
export async function createClassService(dbAcademics, workerEnv, actorSession, input, meta) {
  const classId = crypto.randomUUID();

  try {
    await createClass(dbAcademics, {
      id: classId,
      name: input.name,
      gradeLevel: input.gradeLevel,
      section: input.section ?? null,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AcademicsServiceError(
        'CONFLICT',
        'A class with this name and section already exists.',
        409
      );
    }
    throw error;
  }

  const created = await findClassById(dbAcademics, classId);
  await recordBestEffortAudit(workerEnv, {
    actorUserId: actorSession.userId,
    action: 'CREATE',
    entityType: 'CLASS',
    entityId: classId,
    newValues: created,
    ipAddress: meta.clientIp,
    requestId: meta.requestId,
  });

  return created;
}

/**
 * Update an existing class record.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {Record<string, unknown>} workerEnv
 * @param {{ userId: string }} actorSession
 * @param {string} classId
 * @param {{ name?: string, gradeLevel?: number, section?: string | null }} input
 * @param {{ clientIp: string, requestId: string }} meta
 */
export async function updateClassService(
  dbAcademics,
  workerEnv,
  actorSession,
  classId,
  input,
  meta
) {
  const existing = await findClassById(dbAcademics, classId);
  if (!existing) {
    throw new AcademicsServiceError('NOT_FOUND', 'Class not found.', 404);
  }

  const nextState = {
    name: input.name ?? existing.name,
    gradeLevel: input.gradeLevel ?? existing.gradeLevel,
    section: input.section !== undefined ? input.section : existing.section,
  };

  try {
    await updateClass(dbAcademics, classId, nextState);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AcademicsServiceError(
        'CONFLICT',
        'A class with this name and section already exists.',
        409
      );
    }
    throw error;
  }

  const updated = await findClassById(dbAcademics, classId);
  await recordBestEffortAudit(workerEnv, {
    actorUserId: actorSession.userId,
    action: 'UPDATE',
    entityType: 'CLASS',
    entityId: classId,
    oldValues: existing,
    newValues: updated,
    ipAddress: meta.clientIp,
    requestId: meta.requestId,
  });

  return updated;
}

/**
 * List subjects mapped to a class (optionally scoped by `academicSessionId`).
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {string} classId
 * @param {{ academicSessionId?: string }} [query]
 */
export async function listClassSubjectsService(dbAcademics, classId, query = {}) {
  const cls = await findClassById(dbAcademics, classId);
  if (!cls) {
    throw new AcademicsServiceError('NOT_FOUND', 'Class not found.', 404);
  }
  return await listClassSubjects(dbAcademics, classId, query);
}

/**
 * Assign a subject to a class for a specific academic session.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {Record<string, unknown>} workerEnv
 * @param {{ userId: string }} actorSession
 * @param {string} classId
 * @param {{ academicSessionId: string, subjectId: string }} input
 * @param {{ clientIp: string, requestId: string }} meta
 */
export async function assignClassSubjectService(
  dbAcademics,
  workerEnv,
  actorSession,
  classId,
  input,
  meta
) {
  const [cls, academicSession, subject] = await Promise.all([
    findClassById(dbAcademics, classId),
    findAcademicSessionById(dbAcademics, input.academicSessionId),
    findSubjectById(dbAcademics, input.subjectId),
  ]);

  if (!cls) {
    throw new AcademicsServiceError('NOT_FOUND', 'Class not found.', 404);
  }
  if (!academicSession) {
    throw new AcademicsServiceError('NOT_FOUND', 'Academic session not found.', 404);
  }
  if (!subject) {
    throw new AcademicsServiceError('NOT_FOUND', 'Subject not found.', 404);
  }

  const mappingId = crypto.randomUUID();
  try {
    await createClassSubjectMapping(dbAcademics, {
      id: mappingId,
      academicSessionId: input.academicSessionId,
      classId,
      subjectId: input.subjectId,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AcademicsServiceError(
        'CONFLICT',
        'This subject is already assigned to the class for the selected academic session.',
        409
      );
    }
    throw error;
  }

  const created = await findClassSubjectMapping(dbAcademics, {
    academicSessionId: input.academicSessionId,
    classId,
    subjectId: input.subjectId,
  });

  await recordBestEffortAudit(workerEnv, {
    actorUserId: actorSession.userId,
    action: 'CREATE',
    entityType: 'CLASS_SUBJECT',
    entityId: mappingId,
    newValues: created,
    ipAddress: meta.clientIp,
    requestId: meta.requestId,
  });

  return created;
}

/**
 * Remove a subject assignment from a class for a specific academic session.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {Record<string, unknown>} workerEnv
 * @param {{ userId: string }} actorSession
 * @param {{ classId: string, subjectId: string, academicSessionId: string }} keys
 * @param {{ clientIp: string, requestId: string }} meta
 */
export async function removeClassSubjectService(
  dbAcademics,
  workerEnv,
  actorSession,
  keys,
  meta
) {
  const existing = await findClassSubjectMapping(dbAcademics, keys);
  if (!existing) {
    throw new AcademicsServiceError(
      'NOT_FOUND',
      'Class-subject mapping not found for the specified session.',
      404
    );
  }

  try {
    const changes = await deleteClassSubjectMapping(dbAcademics, keys);
    if (changes === 0) {
      throw new AcademicsServiceError(
        'NOT_FOUND',
        'Class-subject mapping not found for the specified session.',
        404
      );
    }
  } catch (error) {
    if (isForeignKeyConstraintError(error)) {
      throw new AcademicsServiceError(
        'CONFLICT',
        'Cannot remove class-subject mapping because dependent academic records exist.',
        409
      );
    }
    throw error;
  }

  await recordBestEffortAudit(workerEnv, {
    actorUserId: actorSession.userId,
    action: 'DELETE',
    entityType: 'CLASS_SUBJECT',
    entityId: existing.id,
    oldValues: existing,
    ipAddress: meta.clientIp,
    requestId: meta.requestId,
  });

  return { removed: true, id: existing.id };
}

// ---------------------------------------------------------------------------
// Subjects
// ---------------------------------------------------------------------------

/**
 * List subjects with bounded pagination and optional search.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {{ page: number, pageSize: number, search?: string }} query
 */
export async function listSubjectsService(dbAcademics, query) {
  return await listSubjectsPaginated(dbAcademics, {
    search: query.search,
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  });
}

/**
 * Fetch a single subject by ID.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {string} subjectId
 */
export async function getSubjectByIdService(dbAcademics, subjectId) {
  const subject = await findSubjectById(dbAcademics, subjectId);
  if (!subject) {
    throw new AcademicsServiceError('NOT_FOUND', 'Subject not found.', 404);
  }
  return subject;
}

/**
 * Create a new master subject.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {Record<string, unknown>} workerEnv
 * @param {{ userId: string }} actorSession
 * @param {{ name: string, code: string }} input
 * @param {{ clientIp: string, requestId: string }} meta
 */
export async function createSubjectService(dbAcademics, workerEnv, actorSession, input, meta) {
  const subjectId = crypto.randomUUID();
  const createdAt = nowIso();

  try {
    await createSubject(dbAcademics, {
      id: subjectId,
      name: input.name,
      code: input.code,
      createdAt,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AcademicsServiceError('CONFLICT', 'A subject with this code already exists.', 409);
    }
    throw error;
  }

  const created = await findSubjectById(dbAcademics, subjectId);
  await recordBestEffortAudit(workerEnv, {
    actorUserId: actorSession.userId,
    action: 'CREATE',
    entityType: 'SUBJECT',
    entityId: subjectId,
    newValues: created,
    ipAddress: meta.clientIp,
    requestId: meta.requestId,
    createdAt,
  });

  return created;
}

/**
 * Update an existing master subject.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {Record<string, unknown>} workerEnv
 * @param {{ userId: string }} actorSession
 * @param {string} subjectId
 * @param {{ name?: string, code?: string }} input
 * @param {{ clientIp: string, requestId: string }} meta
 */
export async function updateSubjectService(
  dbAcademics,
  workerEnv,
  actorSession,
  subjectId,
  input,
  meta
) {
  const existing = await findSubjectById(dbAcademics, subjectId);
  if (!existing) {
    throw new AcademicsServiceError('NOT_FOUND', 'Subject not found.', 404);
  }

  const nextState = {
    name: input.name ?? existing.name,
    code: input.code ?? existing.code,
  };

  try {
    await updateSubject(dbAcademics, subjectId, nextState);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AcademicsServiceError('CONFLICT', 'A subject with this code already exists.', 409);
    }
    throw error;
  }

  const updated = await findSubjectById(dbAcademics, subjectId);
  await recordBestEffortAudit(workerEnv, {
    actorUserId: actorSession.userId,
    action: 'UPDATE',
    entityType: 'SUBJECT',
    entityId: subjectId,
    oldValues: existing,
    newValues: updated,
    ipAddress: meta.clientIp,
    requestId: meta.requestId,
  });

  return updated;
}
