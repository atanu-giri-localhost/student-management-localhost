import { D1_BINDINGS, getDomainDb } from '@/lib/cloudflare/bindings';
import { nowIso } from '@/lib/dates/format';
import { createAuditOutboxStatement } from '@/modules/audit/audit.service';
import {
  createAttendanceCorrectionBatch,
  createDailyRegisterBatch,
  createPeriodRegisterBatch,
  findDailyRecordById,
  findDailyRegisterById,
  findDailyRegisterByScope,
  findPeriodRecordById,
  findPeriodRegisterById,
  findPeriodRegisterByScope,
  listAttendanceCorrectionsPaginated,
  listDailyRecordsByRegisterId,
  listDailyRegistersPaginated,
  listPeriodRecordsByRegisterId,
  listPeriodRegistersPaginated,
  listStudentAttendancePaginated,
  markDailyRecordsBatch,
  markPeriodRecordsBatch,
  summarizeAttendancePaginated,
} from '@/modules/attendance/attendance.repository';

const ENROLLMENT_VALIDATION_CHUNK_SIZE = 90;

export class AttendanceServiceError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {number} status
   */
  constructor(code, message, status) {
    super(message);
    this.name = 'AttendanceServiceError';
    this.code = code;
    this.status = status;
  }
}

function isUniqueConstraintError(error) {
  return error instanceof Error && error.message.includes('UNIQUE constraint failed');
}

function buildPlaceholders(count) {
  return Array.from({ length: count }, () => '?').join(', ');
}

function chunkIds(ids, chunkSize = ENROLLMENT_VALIDATION_CHUNK_SIZE) {
  const chunks = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    chunks.push(ids.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Cross-D1 validation against `DB_ACADEMICS` (`academic_sessions`, `classes`, and optional `class_subjects`).
 *
 * @param {Record<string, unknown>} workerEnv
 * @param {{ academicSessionId: string, classId: string, subjectId?: string, markedByTeacherId?: string | null }} scope
 */
async function assertAcademicsReferencesExist(
  workerEnv,
  { academicSessionId, classId, subjectId, markedByTeacherId }
) {
  const dbAcademics = getDomainDb(workerEnv, D1_BINDINGS.ACADEMICS);

  const statements = [
    dbAcademics
      .prepare('SELECT id FROM academic_sessions WHERE id = ? LIMIT 1')
      .bind(academicSessionId),
    dbAcademics.prepare('SELECT id FROM classes WHERE id = ? LIMIT 1').bind(classId),
  ];

  if (subjectId) {
    statements.push(
      dbAcademics
        .prepare(
          `SELECT id
           FROM class_subjects
           WHERE academic_session_id = ? AND class_id = ? AND subject_id = ?
           LIMIT 1`
        )
        .bind(academicSessionId, classId, subjectId)
    );
  }

  if (markedByTeacherId) {
    statements.push(
      dbAcademics
        .prepare(
          `SELECT id
           FROM teacher_profiles
           WHERE id = ? AND employment_status = 'ACTIVE'
           LIMIT 1`
        )
        .bind(markedByTeacherId)
    );
  }

  const results = await dbAcademics.batch(statements);
  let idx = 0;
  if (!results[idx++]?.results?.[0]) {
    throw new AttendanceServiceError(
      'VALIDATION_ERROR',
      'Referenced academic session does not exist.',
      400
    );
  }
  if (!results[idx++]?.results?.[0]) {
    throw new AttendanceServiceError('VALIDATION_ERROR', 'Referenced class does not exist.', 400);
  }
  if (subjectId && !results[idx++]?.results?.[0]) {
    throw new AttendanceServiceError(
      'VALIDATION_ERROR',
      'Subject is not mapped to this class and academic session.',
      400
    );
  }
  if (markedByTeacherId && !results[idx++]?.results?.[0]) {
    throw new AttendanceServiceError(
      'VALIDATION_ERROR',
      'Referenced teacher profile does not exist or is inactive.',
      400
    );
  }
}

/**
 * Cross-D1 validation against `DB_STUDENTS.enrollments` (`ACTIVE` enrollments in `(academicSessionId, classId)`).
 * Chunks `IN (...)` to <= 100 bind parameters per query.
 *
 * @param {Record<string, unknown>} workerEnv
 * @param {{ academicSessionId: string, classId: string, enrollmentIds: string[] }} scope
 */
async function assertActiveEnrollmentsBelongToClassSession(
  workerEnv,
  { academicSessionId, classId, enrollmentIds }
) {
  const uniqueIds = [...new Set(enrollmentIds)];
  if (uniqueIds.length === 0) {
    throw new AttendanceServiceError(
      'VALIDATION_ERROR',
      'At least one enrollmentId is required.',
      400
    );
  }

  const dbStudents = getDomainDb(workerEnv, D1_BINDINGS.STUDENTS);
  const matched = new Set();

  for (const chunk of chunkIds(uniqueIds, ENROLLMENT_VALIDATION_CHUNK_SIZE)) {
    const placeholders = buildPlaceholders(chunk.length);
    const res = await dbStudents
      .prepare(
        `SELECT id
         FROM enrollments
         WHERE academic_session_id = ?
           AND class_id = ?
           AND enrollment_status = 'ACTIVE'
           AND id IN (${placeholders})`
      )
      .bind(academicSessionId, classId, ...chunk)
      .all();

    for (const row of res.results || []) {
      matched.add(row.id);
    }
  }

  if (matched.size !== uniqueIds.length) {
    throw new AttendanceServiceError(
      'VALIDATION_ERROR',
      'One or more enrollments are invalid, inactive, or do not belong to this class and session.',
      400
    );
  }
}

function assertNoDuplicateEnrollmentIds(records) {
  const seen = new Set();
  for (const record of records) {
    if (seen.has(record.enrollmentId)) {
      throw new AttendanceServiceError(
        'VALIDATION_ERROR',
        'Duplicate enrollmentId in attendance records payload.',
        400
      );
    }
    seen.add(record.enrollmentId);
  }
}

// ---------------------------------------------------------------------------
// Daily Attendance Services
// ---------------------------------------------------------------------------

/**
 * List daily attendance registers with bounded pagination.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAttendance
 * @param {Record<string, unknown>} query
 */
export async function listDailyRegistersService(dbAttendance, query) {
  return await listDailyRegistersPaginated(dbAttendance, {
    academicSessionId: query.academicSessionId,
    classId: query.classId,
    attendanceDate: query.attendanceDate,
    fromDate: query.fromDate,
    toDate: query.toDate,
    isLocked: query.isLocked,
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  });
}

/**
 * Fetch a daily attendance register by ID along with its records.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAttendance
 * @param {string} registerId
 */
export async function getDailyRegisterByIdService(dbAttendance, registerId) {
  const register = await findDailyRegisterById(dbAttendance, registerId);
  if (!register) {
    throw new AttendanceServiceError('NOT_FOUND', 'Daily attendance register not found.', 404);
  }
  const records = await listDailyRecordsByRegisterId(dbAttendance, registerId);
  return { ...register, records };
}

/**
 * Fetch a daily attendance register by `(academicSessionId, classId, attendanceDate)` with its records.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAttendance
 * @param {{ academicSessionId: string, classId: string, attendanceDate: string }} scope
 */
export async function getDailyRegisterByScopeService(dbAttendance, scope) {
  const register = await findDailyRegisterByScope(dbAttendance, scope);
  if (!register) {
    throw new AttendanceServiceError('NOT_FOUND', 'Daily attendance register not found.', 404);
  }
  const records = await listDailyRecordsByRegisterId(dbAttendance, register.id);
  return { ...register, records };
}

/**
 * Create a daily attendance register with cross-D1 `DB_ACADEMICS` validation
 * and atomic `DB_ATTENDANCE.audit_outbox` persistence.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAttendance
 * @param {Record<string, unknown>} workerEnv
 * @param {{ userId: string, profiles?: { teacherProfileId?: string | null } }} actorSession
 * @param {{ academicSessionId: string, classId: string, attendanceDate: string, markedByTeacherId?: string | null, isLocked?: boolean }} input
 * @param {{ clientIp: string, requestId: string }} meta
 */
export async function createDailyRegisterService(
  dbAttendance,
  workerEnv,
  actorSession,
  input,
  meta
) {
  const markedByTeacherId =
    input.markedByTeacherId !== undefined
      ? input.markedByTeacherId
      : (actorSession?.profiles?.teacherProfileId ?? null);

  await assertAcademicsReferencesExist(workerEnv, {
    academicSessionId: input.academicSessionId,
    classId: input.classId,
    markedByTeacherId,
  });

  const existing = await findDailyRegisterByScope(dbAttendance, {
    academicSessionId: input.academicSessionId,
    classId: input.classId,
    attendanceDate: input.attendanceDate,
  });
  if (existing) {
    throw new AttendanceServiceError(
      'CONFLICT',
      'A daily attendance register already exists for this class and date.',
      409
    );
  }

  const registerId = crypto.randomUUID();
  const createdAt = nowIso();
  const auditStatement = createAuditOutboxStatement(dbAttendance, {
    actorUserId: actorSession.userId,
    action: 'CREATE',
    entityType: 'DAILY_ATTENDANCE_REGISTER',
    entityId: registerId,
    newValues: {
      academicSessionId: input.academicSessionId,
      classId: input.classId,
      attendanceDate: input.attendanceDate,
      markedByTeacherId,
      isLocked: Boolean(input.isLocked),
    },
    ipAddress: meta.clientIp,
    requestId: meta.requestId,
    createdAt,
  });

  try {
    await createDailyRegisterBatch(dbAttendance, {
      register: {
        id: registerId,
        academicSessionId: input.academicSessionId,
        classId: input.classId,
        attendanceDate: input.attendanceDate,
        markedByTeacherId,
        isLocked: Boolean(input.isLocked),
        createdAt,
      },
      auditStatement,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AttendanceServiceError(
        'CONFLICT',
        'A daily attendance register already exists for this class and date.',
        409
      );
    }
    throw error;
  }

  return await getDailyRegisterByIdService(dbAttendance, registerId);
}

/**
 * Mark or update daily attendance records for an unlocked register.
 * Rejects locked registers with `409 REGISTER_LOCKED`.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAttendance
 * @param {Record<string, unknown>} workerEnv
 * @param {{ userId: string }} actorSession
 * @param {string} registerId
 * @param {{ records: Array<{ enrollmentId: string, status: string, remarks?: string | null }> }} input
 * @param {{ clientIp: string, requestId: string }} meta
 */
export async function markDailyAttendanceRecordsService(
  dbAttendance,
  workerEnv,
  actorSession,
  registerId,
  input,
  meta
) {
  const register = await findDailyRegisterById(dbAttendance, registerId);
  if (!register) {
    throw new AttendanceServiceError('NOT_FOUND', 'Daily attendance register not found.', 404);
  }
  if (register.isLocked) {
    throw new AttendanceServiceError(
      'REGISTER_LOCKED',
      'This daily attendance register is locked. Use attendance corrections to modify records.',
      409
    );
  }

  assertNoDuplicateEnrollmentIds(input.records);

  await assertActiveEnrollmentsBelongToClassSession(workerEnv, {
    academicSessionId: register.academicSessionId,
    classId: register.classId,
    enrollmentIds: input.records.map((r) => r.enrollmentId),
  });

  const existingRecords = await listDailyRecordsByRegisterId(dbAttendance, registerId);
  const existingByEnrollment = new Map(existingRecords.map((r) => [r.enrollmentId, r]));
  const timestamp = nowIso();

  const preparedRecords = input.records.map((record) => ({
    id: existingByEnrollment.get(record.enrollmentId)?.id ?? crypto.randomUUID(),
    enrollmentId: record.enrollmentId,
    status: record.status,
    remarks: record.remarks ?? null,
    createdAt: timestamp,
  }));

  const action = existingRecords.length > 0 ? 'UPDATE' : 'CREATE';
  const auditStatement = createAuditOutboxStatement(dbAttendance, {
    actorUserId: actorSession.userId,
    action,
    entityType: 'DAILY_ATTENDANCE_RECORDS',
    entityId: registerId,
    newValues: {
      registerId,
      recordCount: preparedRecords.length,
    },
    ipAddress: meta.clientIp,
    requestId: meta.requestId,
    createdAt: timestamp,
  });

  await markDailyRecordsBatch(dbAttendance, {
    attendanceDayId: registerId,
    records: preparedRecords,
    auditStatement,
  });

  return await getDailyRegisterByIdService(dbAttendance, registerId);
}

// ---------------------------------------------------------------------------
// Period Attendance Services
// ---------------------------------------------------------------------------

/**
 * List period attendance registers with bounded pagination.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAttendance
 * @param {Record<string, unknown>} query
 */
export async function listPeriodRegistersService(dbAttendance, query) {
  return await listPeriodRegistersPaginated(dbAttendance, {
    academicSessionId: query.academicSessionId,
    classId: query.classId,
    subjectId: query.subjectId,
    attendanceDate: query.attendanceDate,
    fromDate: query.fromDate,
    toDate: query.toDate,
    periodNumber: query.periodNumber,
    isLocked: query.isLocked,
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  });
}

/**
 * Fetch a period attendance register by ID along with its records.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAttendance
 * @param {string} registerId
 */
export async function getPeriodRegisterByIdService(dbAttendance, registerId) {
  const register = await findPeriodRegisterById(dbAttendance, registerId);
  if (!register) {
    throw new AttendanceServiceError('NOT_FOUND', 'Period attendance register not found.', 404);
  }
  const records = await listPeriodRecordsByRegisterId(dbAttendance, registerId);
  return { ...register, records };
}

/**
 * Create a period attendance register with cross-D1 `DB_ACADEMICS` validation
 * and atomic `DB_ATTENDANCE.audit_outbox` persistence.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAttendance
 * @param {Record<string, unknown>} workerEnv
 * @param {{ userId: string, profiles?: { teacherProfileId?: string | null } }} actorSession
 * @param {{
 *   academicSessionId: string,
 *   classId: string,
 *   subjectId: string,
 *   attendanceDate: string,
 *   periodNumber: number,
 *   markedByTeacherId?: string | null,
 *   isLocked?: boolean,
 * }} input
 * @param {{ clientIp: string, requestId: string }} meta
 */
export async function createPeriodRegisterService(
  dbAttendance,
  workerEnv,
  actorSession,
  input,
  meta
) {
  const markedByTeacherId =
    input.markedByTeacherId !== undefined
      ? input.markedByTeacherId
      : (actorSession?.profiles?.teacherProfileId ?? null);

  await assertAcademicsReferencesExist(workerEnv, {
    academicSessionId: input.academicSessionId,
    classId: input.classId,
    subjectId: input.subjectId,
    markedByTeacherId,
  });

  const existing = await findPeriodRegisterByScope(dbAttendance, {
    academicSessionId: input.academicSessionId,
    classId: input.classId,
    subjectId: input.subjectId,
    attendanceDate: input.attendanceDate,
    periodNumber: input.periodNumber,
  });
  if (existing) {
    throw new AttendanceServiceError(
      'CONFLICT',
      'A period attendance register already exists for this class, subject, date, and period.',
      409
    );
  }

  const registerId = crypto.randomUUID();
  const createdAt = nowIso();
  const auditStatement = createAuditOutboxStatement(dbAttendance, {
    actorUserId: actorSession.userId,
    action: 'CREATE',
    entityType: 'PERIOD_ATTENDANCE_REGISTER',
    entityId: registerId,
    newValues: {
      academicSessionId: input.academicSessionId,
      classId: input.classId,
      subjectId: input.subjectId,
      attendanceDate: input.attendanceDate,
      periodNumber: input.periodNumber,
      markedByTeacherId,
      isLocked: Boolean(input.isLocked),
    },
    ipAddress: meta.clientIp,
    requestId: meta.requestId,
    createdAt,
  });

  try {
    await createPeriodRegisterBatch(dbAttendance, {
      register: {
        id: registerId,
        academicSessionId: input.academicSessionId,
        classId: input.classId,
        subjectId: input.subjectId,
        attendanceDate: input.attendanceDate,
        periodNumber: input.periodNumber,
        markedByTeacherId,
        isLocked: Boolean(input.isLocked),
        createdAt,
      },
      auditStatement,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AttendanceServiceError(
        'CONFLICT',
        'A period attendance register already exists for this class, subject, date, and period.',
        409
      );
    }
    throw error;
  }

  return await getPeriodRegisterByIdService(dbAttendance, registerId);
}

/**
 * Mark or update period attendance records for an unlocked register.
 * Rejects locked registers with `409 REGISTER_LOCKED`.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAttendance
 * @param {Record<string, unknown>} workerEnv
 * @param {{ userId: string }} actorSession
 * @param {string} registerId
 * @param {{ records: Array<{ enrollmentId: string, status: string, remarks?: string | null }> }} input
 * @param {{ clientIp: string, requestId: string }} meta
 */
export async function markPeriodAttendanceRecordsService(
  dbAttendance,
  workerEnv,
  actorSession,
  registerId,
  input,
  meta
) {
  const register = await findPeriodRegisterById(dbAttendance, registerId);
  if (!register) {
    throw new AttendanceServiceError('NOT_FOUND', 'Period attendance register not found.', 404);
  }
  if (register.isLocked) {
    throw new AttendanceServiceError(
      'REGISTER_LOCKED',
      'This period attendance register is locked. Use attendance corrections to modify records.',
      409
    );
  }

  assertNoDuplicateEnrollmentIds(input.records);

  await assertActiveEnrollmentsBelongToClassSession(workerEnv, {
    academicSessionId: register.academicSessionId,
    classId: register.classId,
    enrollmentIds: input.records.map((r) => r.enrollmentId),
  });

  const existingRecords = await listPeriodRecordsByRegisterId(dbAttendance, registerId);
  const existingByEnrollment = new Map(existingRecords.map((r) => [r.enrollmentId, r]));
  const timestamp = nowIso();

  const preparedRecords = input.records.map((record) => ({
    id: existingByEnrollment.get(record.enrollmentId)?.id ?? crypto.randomUUID(),
    enrollmentId: record.enrollmentId,
    status: record.status,
    remarks: record.remarks ?? null,
    createdAt: timestamp,
  }));

  const action = existingRecords.length > 0 ? 'UPDATE' : 'CREATE';
  const auditStatement = createAuditOutboxStatement(dbAttendance, {
    actorUserId: actorSession.userId,
    action,
    entityType: 'PERIOD_ATTENDANCE_RECORDS',
    entityId: registerId,
    newValues: {
      registerId,
      recordCount: preparedRecords.length,
    },
    ipAddress: meta.clientIp,
    requestId: meta.requestId,
    createdAt: timestamp,
  });

  await markPeriodRecordsBatch(dbAttendance, {
    registerId,
    records: preparedRecords,
    auditStatement,
  });

  return await getPeriodRegisterByIdService(dbAttendance, registerId);
}

// ---------------------------------------------------------------------------
// Attendance Corrections
// ---------------------------------------------------------------------------

/**
 * List attendance corrections with bounded pagination.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAttendance
 * @param {Record<string, unknown>} query
 */
export async function listAttendanceCorrectionsService(dbAttendance, query) {
  return await listAttendanceCorrectionsPaginated(dbAttendance, {
    registerType: query.registerType,
    registerId: query.registerId,
    recordId: query.recordId,
    enrollmentId: query.enrollmentId,
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  });
}

/**
 * Atomically apply an attendance correction:
 * 1. Update `daily_attendance_records` or `period_attendance_records`
 * 2. Insert into `attendance_corrections`
 * 3. Insert into `DB_ATTENDANCE.audit_outbox` (`CORRECTION`)
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAttendance
 * @param {{ userId: string }} actorSession
 * @param {{
 *   registerType: 'DAILY' | 'PERIOD',
 *   registerId: string,
 *   recordId: string,
 *   newStatus: string,
 *   reason: string,
 * }} input
 * @param {{ clientIp: string, requestId: string }} meta
 */
export async function createAttendanceCorrectionService(dbAttendance, actorSession, input, meta) {
  const isDaily = input.registerType === 'DAILY';
  const register = isDaily
    ? await findDailyRegisterById(dbAttendance, input.registerId)
    : await findPeriodRegisterById(dbAttendance, input.registerId);

  if (!register) {
    throw new AttendanceServiceError('NOT_FOUND', 'Target attendance register not found.', 404);
  }

  const record = isDaily
    ? await findDailyRecordById(dbAttendance, input.recordId)
    : await findPeriodRecordById(dbAttendance, input.recordId);

  const recordRegisterId = isDaily ? record?.attendanceDayId : record?.registerId;
  if (!record || recordRegisterId !== input.registerId) {
    throw new AttendanceServiceError(
      'NOT_FOUND',
      'Attendance record not found in the specified register.',
      404
    );
  }

  if (input.newStatus === record.status) {
    throw new AttendanceServiceError(
      'VALIDATION_ERROR',
      'newStatus must be different from the current attendance status.',
      400
    );
  }

  const correctionId = crypto.randomUUID();
  const createdAt = nowIso();
  const correction = {
    id: correctionId,
    registerType: input.registerType,
    registerId: input.registerId,
    recordId: input.recordId,
    enrollmentId: record.enrollmentId,
    previousStatus: record.status,
    newStatus: input.newStatus,
    reason: input.reason,
    correctedByUserId: actorSession.userId,
    requestId: meta.requestId ?? null,
    createdAt,
  };

  const auditStatement = createAuditOutboxStatement(dbAttendance, {
    actorUserId: actorSession.userId,
    action: 'CORRECTION',
    entityType: 'ATTENDANCE_CORRECTION',
    entityId: correctionId,
    oldValues: {
      registerType: input.registerType,
      registerId: input.registerId,
      recordId: input.recordId,
      enrollmentId: record.enrollmentId,
      status: record.status,
    },
    newValues: {
      registerType: input.registerType,
      registerId: input.registerId,
      recordId: input.recordId,
      enrollmentId: record.enrollmentId,
      status: input.newStatus,
      reason: input.reason,
    },
    ipAddress: meta.clientIp,
    requestId: meta.requestId,
    createdAt,
  });

  await createAttendanceCorrectionBatch(dbAttendance, {
    correction,
    auditStatement,
  });

  return correction;
}

// ---------------------------------------------------------------------------
// Student Attendance & Summaries
// ---------------------------------------------------------------------------

/**
 * Fetch bounded attendance records for a student across their `DB_STUDENTS.enrollments`.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAttendance
 * @param {Record<string, unknown>} workerEnv
 * @param {string} studentId
 * @param {{
 *   page: number,
 *   pageSize: number,
 *   academicSessionId?: string,
 *   registerType: 'DAILY' | 'PERIOD',
 *   fromDate?: string,
 *   toDate?: string,
 * }} query
 */
export async function getStudentAttendanceService(dbAttendance, workerEnv, studentId, query) {
  const dbStudents = getDomainDb(workerEnv, D1_BINDINGS.STUDENTS);

  const studentRow = await dbStudents
    .prepare('SELECT id FROM students WHERE id = ? LIMIT 1')
    .bind(studentId)
    .first();
  if (!studentRow) {
    throw new AttendanceServiceError('NOT_FOUND', 'Student not found.', 404);
  }

  const enrollmentRes = query.academicSessionId
    ? await dbStudents
        .prepare(
          `SELECT id
           FROM enrollments
           WHERE student_id = ? AND academic_session_id = ?
           ORDER BY start_date DESC`
        )
        .bind(studentId, query.academicSessionId)
        .all()
    : await dbStudents
        .prepare(
          `SELECT id
           FROM enrollments
           WHERE student_id = ?
           ORDER BY start_date DESC`
        )
        .bind(studentId)
        .all();

  const enrollmentIds = (enrollmentRes.results || []).map((r) => r.id);
  if (enrollmentIds.length === 0) {
    return { total: 0, records: [] };
  }

  return await listStudentAttendancePaginated(dbAttendance, {
    enrollmentIds,
    registerType: query.registerType,
    fromDate: query.fromDate,
    toDate: query.toDate,
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  });
}

/**
 * Fetch bounded attendance summary aggregates by enrollment for a session/class/date range.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAttendance
 * @param {{
 *   page: number,
 *   pageSize: number,
 *   academicSessionId: string,
 *   classId?: string,
 *   subjectId?: string,
 *   registerType: 'DAILY' | 'PERIOD',
 *   fromDate?: string,
 *   toDate?: string,
 * }} query
 */
export async function getAttendanceSummaryService(dbAttendance, query) {
  return await summarizeAttendancePaginated(dbAttendance, {
    academicSessionId: query.academicSessionId,
    classId: query.classId,
    subjectId: query.subjectId,
    registerType: query.registerType,
    fromDate: query.fromDate,
    toDate: query.toDate,
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  });
}
