import { D1_BINDINGS, getDomainDb } from '@/lib/cloudflare/bindings';
import { nowIso } from '@/lib/dates/format';
import { createAuditOutboxStatement } from '@/modules/audit/audit.service';
import {
  createStudentBatch,
  findStudentById,
  listStudentsPaginated,
  updateStudentBatch,
} from '@/modules/students/students.repository';

export class StudentsServiceError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {number} status
   */
  constructor(code, message, status) {
    super(message);
    this.name = 'StudentsServiceError';
    this.code = code;
    this.status = status;
  }
}

/**
 * List students with bounded pagination and filters.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbStudents
 * @param {{ page: number, pageSize: number, search?: string, lifecycleStatus?: string }} query
 */
export async function listStudentsService(dbStudents, query) {
  return await listStudentsPaginated(dbStudents, {
    search: query.search,
    lifecycleStatus: query.lifecycleStatus,
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  });
}

/**
 * Create a new student record in `DB_STUDENTS` with cross-D1 reference validation and `audit_outbox` persistence.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbStudents
 * @param {Record<string, unknown>} workerEnv
 * @param {{ userId: string }} actorSession
 * @param {Record<string, unknown>} input
 * @param {{ clientIp: string, requestId: string }} meta
 */
export async function createStudentService(dbStudents, workerEnv, actorSession, input, meta) {
  if (input.userId) {
    const dbIdentity = getDomainDb(workerEnv, D1_BINDINGS.IDENTITY);
    const userRow = await dbIdentity
      .prepare('SELECT id, is_active FROM users WHERE id = ? LIMIT 1')
      .bind(input.userId)
      .first();
    if (!userRow || userRow.is_active !== 1) {
      throw new StudentsServiceError(
        'VALIDATION_ERROR',
        'Referenced user account does not exist or is inactive.',
        400
      );
    }
  }

  if (input.photoFileId) {
    const fileRow = await dbStudents
      .prepare('SELECT id FROM file_objects WHERE id = ? LIMIT 1')
      .bind(input.photoFileId)
      .first();
    if (!fileRow) {
      throw new StudentsServiceError('VALIDATION_ERROR', 'Referenced photo file does not exist.', 400);
    }
  }

  const timestamp = nowIso();
  const studentId = crypto.randomUUID();
  const auditStatement = createAuditOutboxStatement(dbStudents, {
    actorUserId: actorSession.userId,
    action: 'CREATE',
    entityType: 'STUDENT',
    entityId: studentId,
    newValues: {
      admissionNumber: input.admissionNumber,
      fullName: input.fullName,
      lifecycleStatus: input.lifecycleStatus ?? 'ACTIVE',
    },
    ipAddress: meta.clientIp,
    requestId: meta.requestId,
    createdAt: timestamp,
  });

  try {
    await createStudentBatch(dbStudents, {
      student: {
        id: studentId,
        ...input,
        lifecycleStatus: input.lifecycleStatus ?? 'ACTIVE',
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      auditStatement,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      throw new StudentsServiceError(
        'CONFLICT',
        'A student with this admission number or linked user already exists.',
        409
      );
    }
    throw error;
  }

  return await findStudentById(dbStudents, studentId);
}

/**
 * Retrieve a single student by ID.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbStudents
 * @param {string} studentId
 */
export async function getStudentByIdService(dbStudents, studentId) {
  const student = await findStudentById(dbStudents, studentId);
  if (!student) {
    throw new StudentsServiceError('NOT_FOUND', 'Student not found.', 404);
  }
  return student;
}

/**
 * Update student profile fields atomically with `DB_STUDENTS.audit_outbox`.
 */
export async function updateStudentService(dbStudents, actorSession, studentId, input, meta) {
  const existing = await findStudentById(dbStudents, studentId);
  if (!existing) {
    throw new StudentsServiceError('NOT_FOUND', 'Student not found.', 404);
  }

  if (input.photoFileId) {
    const fileRow = await dbStudents
      .prepare('SELECT id FROM file_objects WHERE id = ? LIMIT 1')
      .bind(input.photoFileId)
      .first();
    if (!fileRow) {
      throw new StudentsServiceError('VALIDATION_ERROR', 'Referenced photo file does not exist.', 400);
    }
  }

  const timestamp = nowIso();
  const auditStatement = createAuditOutboxStatement(dbStudents, {
    actorUserId: actorSession.userId,
    action: 'UPDATE',
    entityType: 'STUDENT',
    entityId: studentId,
    oldValues: {
      fullName: existing.fullName,
      photoFileId: existing.photoFileId,
      lifecycleStatus: existing.lifecycleStatus,
    },
    newValues: input,
    ipAddress: meta.clientIp,
    requestId: meta.requestId,
    createdAt: timestamp,
  });

  await updateStudentBatch(dbStudents, {
    studentId,
    fields: input,
    nowIso: timestamp,
    auditStatement,
  });

  return await findStudentById(dbStudents, studentId);
}

/**
 * Update student lifecycle status (`ACTIVE`, `INACTIVE`, `ALUMNI`, `LEFT`) without deleting historical records.
 */
export async function updateStudentLifecycleService(
  dbStudents,
  actorSession,
  studentId,
  lifecycleStatus,
  meta
) {
  const existing = await findStudentById(dbStudents, studentId);
  if (!existing) {
    throw new StudentsServiceError('NOT_FOUND', 'Student not found.', 404);
  }

  const timestamp = nowIso();
  const auditStatement = createAuditOutboxStatement(dbStudents, {
    actorUserId: actorSession.userId,
    action: 'UPDATE',
    entityType: 'STUDENT_LIFECYCLE',
    entityId: studentId,
    oldValues: { lifecycleStatus: existing.lifecycleStatus },
    newValues: { lifecycleStatus },
    ipAddress: meta.clientIp,
    requestId: meta.requestId,
    createdAt: timestamp,
  });

  await updateStudentBatch(dbStudents, {
    studentId,
    fields: { lifecycleStatus },
    nowIso: timestamp,
    auditStatement,
  });

  return await findStudentById(dbStudents, studentId);
}
