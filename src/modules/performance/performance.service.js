import { D1_BINDINGS, getDomainDb } from '@/lib/cloudflare/bindings';
import { nowIso } from '@/lib/dates/format';
import { recordBestEffortAudit } from '@/modules/audit/audit.service';
import {
  createExamination,
  createExamMark,
  createExamSubject,
  createGradingScale,
  createPerformanceRecord,
  findActiveGradingScalesForOverlapCheck,
  findExaminationById,
  findExamMarkById,
  findExamMarkBySubjectAndEnrollment,
  findExamSubjectById,
  findGradingScaleById,
  findPerformanceRecordById,
  listActiveGradingScalesForSession,
  listExaminationsForSessions,
  listExaminationsPaginated,
  listExamMarksForSubjectsAndEnrollments,
  listExamMarksPaginated,
  listExamSubjectsByExaminationAndClass,
  listExamSubjectsPaginated,
  listGradingScalesPaginated,
  listPerformanceRecordsPaginated,
  updateExamination,
  updateExamMark,
  updateExamSubject,
  updateGradingScale,
} from '@/modules/performance/performance.repository';

export class PerformanceServiceError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {number} status
   */
  constructor(code, message, status) {
    super(message);
    this.name = 'PerformanceServiceError';
    this.code = code;
    this.status = status;
  }
}

function isUniqueConstraintError(error) {
  return error instanceof Error && error.message.includes('UNIQUE constraint failed');
}

function roundPercentage(numerator, denominator) {
  if (!denominator || denominator <= 0) {
    return null;
  }
  return Math.round((numerator / denominator) * 10000) / 100;
}

function matchGradingScale(scales, percentage, referenceDate) {
  if (percentage === null || percentage === undefined || !Array.isArray(scales) || scales.length === 0) {
    return null;
  }

  const eligible = referenceDate
    ? scales.filter((s) => s.effectiveFrom <= referenceDate)
    : scales;
  const pool = eligible.length > 0 ? eligible : scales;

  // Prefer session-specific over global, and latest effectiveFrom
  const topScope = pool[0];
  const scoped = pool.filter(
    (s) =>
      s.academicSessionId === topScope.academicSessionId &&
      s.effectiveFrom === topScope.effectiveFrom &&
      s.name === topScope.name
  );

  const matched = scoped.find(
    (s) => percentage >= s.minPercentage && percentage <= s.maxPercentage
  );
  if (!matched) {
    return null;
  }

  return {
    id: matched.id,
    name: matched.name,
    gradeLabel: matched.gradeLabel,
    gradePoint: matched.gradePoint,
    isPassing: matched.isPassing,
  };
}

// ---------------------------------------------------------------------------
// Cross-D1 Reference Validators
// ---------------------------------------------------------------------------

async function assertAcademicSessionExists(workerEnv, academicSessionId) {
  const dbAcademics = getDomainDb(workerEnv, D1_BINDINGS.ACADEMICS);
  const row = await dbAcademics
    .prepare('SELECT id FROM academic_sessions WHERE id = ? LIMIT 1')
    .bind(academicSessionId)
    .first();

  if (!row) {
    throw new PerformanceServiceError(
      'VALIDATION_ERROR',
      'Referenced academic session does not exist.',
      400
    );
  }
}

async function assertClassSubjectExists(workerEnv, { academicSessionId, classId, subjectId }) {
  const dbAcademics = getDomainDb(workerEnv, D1_BINDINGS.ACADEMICS);
  const row = await dbAcademics
    .prepare(
      `SELECT id
       FROM class_subjects
       WHERE academic_session_id = ? AND class_id = ? AND subject_id = ?
       LIMIT 1`
    )
    .bind(academicSessionId, classId, subjectId)
    .first();

  if (!row) {
    throw new PerformanceServiceError(
      'VALIDATION_ERROR',
      'Subject is not mapped to this class and academic session.',
      400
    );
  }
}

async function assertActiveEnrollmentForScope(
  workerEnv,
  enrollmentId,
  { academicSessionId, classId }
) {
  const dbStudents = getDomainDb(workerEnv, D1_BINDINGS.STUDENTS);
  const row = await dbStudents
    .prepare(
      `SELECT id, student_id, academic_session_id, class_id, enrollment_status
       FROM enrollments
       WHERE id = ?
       LIMIT 1`
    )
    .bind(enrollmentId)
    .first();

  if (!row) {
    throw new PerformanceServiceError('VALIDATION_ERROR', 'Referenced enrollment does not exist.', 400);
  }
  if (row.enrollment_status !== 'ACTIVE') {
    throw new PerformanceServiceError(
      'VALIDATION_ERROR',
      'Marks can only be recorded for an ACTIVE enrollment.',
      400
    );
  }
  if (row.academic_session_id !== academicSessionId || row.class_id !== classId) {
    throw new PerformanceServiceError(
      'VALIDATION_ERROR',
      'Enrollment does not belong to the examination session and class.',
      400
    );
  }

  return row;
}

async function assertTeacherProfileActive(workerEnv, teacherProfileId) {
  const dbAcademics = getDomainDb(workerEnv, D1_BINDINGS.ACADEMICS);
  const row = await dbAcademics
    .prepare(
      `SELECT id
       FROM teacher_profiles
       WHERE id = ? AND employment_status = 'ACTIVE'
       LIMIT 1`
    )
    .bind(teacherProfileId)
    .first();

  if (!row) {
    throw new PerformanceServiceError(
      'VALIDATION_ERROR',
      'Active teacher profile is required to record performance.',
      400
    );
  }
}

// ---------------------------------------------------------------------------
// Examinations
// ---------------------------------------------------------------------------

/**
 * List examinations with bounded pagination.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbPerformance
 * @param {{ page: number, pageSize: number, academicSessionId?: string, examType?: string, isPublished?: boolean }} query
 */
export async function listExaminationsService(dbPerformance, query) {
  return await listExaminationsPaginated(dbPerformance, {
    academicSessionId: query.academicSessionId,
    examType: query.examType,
    isPublished: query.isPublished,
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  });
}

/**
 * Fetch a single examination by ID.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbPerformance
 * @param {string} examinationId
 */
export async function getExaminationByIdService(dbPerformance, examinationId) {
  const exam = await findExaminationById(dbPerformance, examinationId);
  if (!exam) {
    throw new PerformanceServiceError('NOT_FOUND', 'Examination not found.', 404);
  }
  return exam;
}

/**
 * Create an examination after validating `academicSessionId` in `DB_ACADEMICS`.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbPerformance
 * @param {Record<string, unknown>} workerEnv
 * @param {{ userId: string }} actorSession
 * @param {{ academicSessionId: string, name: string, examType: string, startDate: string, endDate: string, isPublished?: boolean }} input
 * @param {{ clientIp?: string | null, requestId?: string | null }} meta
 */
export async function createExaminationService(
  dbPerformance,
  workerEnv,
  actorSession,
  input,
  meta = {}
) {
  await assertAcademicSessionExists(workerEnv, input.academicSessionId);

  const id = crypto.randomUUID();
  const createdAt = nowIso();

  await createExamination(dbPerformance, {
    id,
    academicSessionId: input.academicSessionId,
    name: input.name,
    examType: input.examType,
    startDate: input.startDate,
    endDate: input.endDate,
    isPublished: input.isPublished ? 1 : 0,
    createdAt,
  });

  const created = await findExaminationById(dbPerformance, id);
  await recordBestEffortAudit(workerEnv, {
    actorUserId: actorSession?.userId ?? null,
    action: 'CREATE',
    entityType: 'examinations',
    entityId: id,
    newValues: created,
    ipAddress: meta.clientIp ?? null,
    requestId: meta.requestId ?? null,
  });

  return created;
}

/**
 * Update an examination (including `isPublished` toggle).
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbPerformance
 * @param {Record<string, unknown>} workerEnv
 * @param {{ userId: string }} actorSession
 * @param {string} examinationId
 * @param {Record<string, unknown>} input
 * @param {{ clientIp?: string | null, requestId?: string | null }} meta
 */
export async function updateExaminationService(
  dbPerformance,
  workerEnv,
  actorSession,
  examinationId,
  input,
  meta = {}
) {
  const existing = await findExaminationById(dbPerformance, examinationId);
  if (!existing) {
    throw new PerformanceServiceError('NOT_FOUND', 'Examination not found.', 404);
  }

  const nextStart = input.startDate ?? existing.startDate;
  const nextEnd = input.endDate ?? existing.endDate;
  if (nextEnd < nextStart) {
    throw new PerformanceServiceError(
      'VALIDATION_ERROR',
      'End date must be on or after start date.',
      400
    );
  }

  await updateExamination(dbPerformance, examinationId, input);
  const updated = await findExaminationById(dbPerformance, examinationId);

  await recordBestEffortAudit(workerEnv, {
    actorUserId: actorSession?.userId ?? null,
    action: 'UPDATE',
    entityType: 'examinations',
    entityId: examinationId,
    oldValues: existing,
    newValues: updated,
    ipAddress: meta.clientIp ?? null,
    requestId: meta.requestId ?? null,
  });

  return updated;
}

// ---------------------------------------------------------------------------
// Exam Subjects
// ---------------------------------------------------------------------------

/**
 * List exam subjects with bounded pagination.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbPerformance
 * @param {{ page: number, pageSize: number, examinationId?: string, classId?: string, subjectId?: string }} query
 */
export async function listExamSubjectsService(dbPerformance, query) {
  return await listExamSubjectsPaginated(dbPerformance, {
    examinationId: query.examinationId,
    classId: query.classId,
    subjectId: query.subjectId,
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  });
}

/**
 * Fetch a single exam subject by ID.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbPerformance
 * @param {string} examSubjectId
 */
export async function getExamSubjectByIdService(dbPerformance, examSubjectId) {
  const subject = await findExamSubjectById(dbPerformance, examSubjectId);
  if (!subject) {
    throw new PerformanceServiceError('NOT_FOUND', 'Exam subject not found.', 404);
  }
  return subject;
}

/**
 * Create an exam subject after validating the parent examination and `DB_ACADEMICS.class_subjects`.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbPerformance
 * @param {Record<string, unknown>} workerEnv
 * @param {{ userId: string }} actorSession
 * @param {{ examinationId: string, classId: string, subjectId: string, examDate: string, maxMarks: number, passingMarks: number }} input
 * @param {{ clientIp?: string | null, requestId?: string | null }} meta
 */
export async function createExamSubjectService(
  dbPerformance,
  workerEnv,
  actorSession,
  input,
  meta = {}
) {
  const examination = await findExaminationById(dbPerformance, input.examinationId);
  if (!examination) {
    throw new PerformanceServiceError('NOT_FOUND', 'Referenced examination not found.', 404);
  }

  await assertClassSubjectExists(workerEnv, {
    academicSessionId: examination.academicSessionId,
    classId: input.classId,
    subjectId: input.subjectId,
  });

  const id = crypto.randomUUID();
  try {
    await createExamSubject(dbPerformance, {
      id,
      examinationId: input.examinationId,
      classId: input.classId,
      subjectId: input.subjectId,
      examDate: input.examDate,
      maxMarks: input.maxMarks,
      passingMarks: input.passingMarks,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new PerformanceServiceError(
        'CONFLICT',
        'This subject is already scheduled for the class in this examination.',
        409
      );
    }
    throw error;
  }

  const created = await findExamSubjectById(dbPerformance, id);
  await recordBestEffortAudit(workerEnv, {
    actorUserId: actorSession?.userId ?? null,
    action: 'CREATE',
    entityType: 'exam_subjects',
    entityId: id,
    newValues: created,
    ipAddress: meta.clientIp ?? null,
    requestId: meta.requestId ?? null,
  });

  return created;
}

/**
 * Update an exam subject's date, max marks, or passing marks.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbPerformance
 * @param {Record<string, unknown>} workerEnv
 * @param {{ userId: string }} actorSession
 * @param {string} examSubjectId
 * @param {Record<string, unknown>} input
 * @param {{ clientIp?: string | null, requestId?: string | null }} meta
 */
export async function updateExamSubjectService(
  dbPerformance,
  workerEnv,
  actorSession,
  examSubjectId,
  input,
  meta = {}
) {
  const existing = await findExamSubjectById(dbPerformance, examSubjectId);
  if (!existing) {
    throw new PerformanceServiceError('NOT_FOUND', 'Exam subject not found.', 404);
  }

  const nextMax = input.maxMarks ?? existing.maxMarks;
  const nextPassing = input.passingMarks ?? existing.passingMarks;
  if (nextPassing > nextMax) {
    throw new PerformanceServiceError(
      'VALIDATION_ERROR',
      'Passing marks cannot exceed max marks.',
      400
    );
  }

  await updateExamSubject(dbPerformance, examSubjectId, input);
  const updated = await findExamSubjectById(dbPerformance, examSubjectId);

  await recordBestEffortAudit(workerEnv, {
    actorUserId: actorSession?.userId ?? null,
    action: 'UPDATE',
    entityType: 'exam_subjects',
    entityId: examSubjectId,
    oldValues: existing,
    newValues: updated,
    ipAddress: meta.clientIp ?? null,
    requestId: meta.requestId ?? null,
  });

  return updated;
}

// ---------------------------------------------------------------------------
// Exam Marks
// ---------------------------------------------------------------------------

/**
 * List exam marks with bounded pagination.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbPerformance
 * @param {{ page: number, pageSize: number, examSubjectId?: string, enrollmentId?: string }} query
 */
export async function listExamMarksService(dbPerformance, query) {
  return await listExamMarksPaginated(dbPerformance, {
    examSubjectId: query.examSubjectId,
    enrollmentId: query.enrollmentId,
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  });
}

/**
 * Fetch a single exam mark by ID.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbPerformance
 * @param {string} examMarkId
 */
export async function getExamMarkByIdService(dbPerformance, examMarkId) {
  const mark = await findExamMarkById(dbPerformance, examMarkId);
  if (!mark) {
    throw new PerformanceServiceError('NOT_FOUND', 'Exam mark not found.', 404);
  }
  return mark;
}

function validateMarkAgainstExamSubject(examSubject, { isAbsent, marksObtained }) {
  if (isAbsent) {
    if (marksObtained !== null && marksObtained !== undefined) {
      throw new PerformanceServiceError(
        'VALIDATION_ERROR',
        'Marks obtained must be null when the student is marked absent.',
        400
      );
    }
    return null;
  }

  if (marksObtained === null || marksObtained === undefined) {
    throw new PerformanceServiceError(
      'VALIDATION_ERROR',
      'Marks obtained is required when the student is present.',
      400
    );
  }
  if (marksObtained < 0 || marksObtained > examSubject.maxMarks) {
    throw new PerformanceServiceError(
      'VALIDATION_ERROR',
      `Marks obtained must be between 0 and ${examSubject.maxMarks}.`,
      400
    );
  }
  return marksObtained;
}

/**
 * Record a new exam mark (`409` on duplicate `(exam_subject_id, enrollment_id)`).
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbPerformance
 * @param {Record<string, unknown>} workerEnv
 * @param {{ userId: string, profiles?: { teacherProfileId?: string | null } }} actorSession
 * @param {{ examSubjectId: string, enrollmentId: string, isAbsent?: boolean, marksObtained?: number | null, remarks?: string | null }} input
 * @param {{ clientIp?: string | null, requestId?: string | null }} meta
 */
export async function recordExamMarkService(
  dbPerformance,
  workerEnv,
  actorSession,
  input,
  meta = {}
) {
  const examSubject = await findExamSubjectById(dbPerformance, input.examSubjectId);
  if (!examSubject) {
    throw new PerformanceServiceError('NOT_FOUND', 'Referenced exam subject not found.', 404);
  }

  const examination = await findExaminationById(dbPerformance, examSubject.examinationId);
  if (!examination) {
    throw new PerformanceServiceError('NOT_FOUND', 'Referenced examination not found.', 404);
  }

  const isAbsent = Boolean(input.isAbsent);
  const validatedMarks = validateMarkAgainstExamSubject(examSubject, {
    isAbsent,
    marksObtained: input.marksObtained ?? null,
  });

  await assertActiveEnrollmentForScope(workerEnv, input.enrollmentId, {
    academicSessionId: examination.academicSessionId,
    classId: examSubject.classId,
  });

  const id = crypto.randomUUID();
  const createdAt = nowIso();
  const enteredByTeacherId = actorSession?.profiles?.teacherProfileId ?? null;

  try {
    await createExamMark(dbPerformance, {
      id,
      examSubjectId: input.examSubjectId,
      enrollmentId: input.enrollmentId,
      marksObtained: validatedMarks,
      isAbsent: isAbsent ? 1 : 0,
      remarks: input.remarks ?? null,
      enteredByTeacherId,
      createdAt,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new PerformanceServiceError(
        'CONFLICT',
        'Exam mark has already been recorded for this student and subject.',
        409
      );
    }
    throw error;
  }

  const created = await findExamMarkById(dbPerformance, id);
  await recordBestEffortAudit(workerEnv, {
    actorUserId: actorSession?.userId ?? null,
    action: 'CREATE',
    entityType: 'exam_marks',
    entityId: id,
    newValues: created,
    ipAddress: meta.clientIp ?? null,
    requestId: meta.requestId ?? null,
  });

  return created;
}

/**
 * Upsert an exam mark for `(examSubjectId, enrollmentId)`.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbPerformance
 * @param {Record<string, unknown>} workerEnv
 * @param {{ userId: string, profiles?: { teacherProfileId?: string | null } }} actorSession
 * @param {{ examSubjectId: string, enrollmentId: string, isAbsent?: boolean, marksObtained?: number | null, remarks?: string | null }} input
 * @param {{ clientIp?: string | null, requestId?: string | null }} meta
 */
export async function upsertExamMarkService(
  dbPerformance,
  workerEnv,
  actorSession,
  input,
  meta = {}
) {
  const existing = await findExamMarkBySubjectAndEnrollment(
    dbPerformance,
    input.examSubjectId,
    input.enrollmentId
  );
  if (!existing) {
    return await recordExamMarkService(dbPerformance, workerEnv, actorSession, input, meta);
  }

  return await updateExamMarkService(
    dbPerformance,
    workerEnv,
    actorSession,
    existing.id,
    {
      isAbsent: Boolean(input.isAbsent),
      marksObtained: input.isAbsent ? null : input.marksObtained ?? null,
      remarks: input.remarks ?? null,
    },
    meta
  );
}

/**
 * Update an existing exam mark, enforcing `isAbsent` and `maxMarks` bounds.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbPerformance
 * @param {Record<string, unknown>} workerEnv
 * @param {{ userId: string, profiles?: { teacherProfileId?: string | null } }} actorSession
 * @param {string} examMarkId
 * @param {{ isAbsent?: boolean, marksObtained?: number | null, remarks?: string | null }} input
 * @param {{ clientIp?: string | null, requestId?: string | null }} meta
 */
export async function updateExamMarkService(
  dbPerformance,
  workerEnv,
  actorSession,
  examMarkId,
  input,
  meta = {}
) {
  const existing = await findExamMarkById(dbPerformance, examMarkId);
  if (!existing) {
    throw new PerformanceServiceError('NOT_FOUND', 'Exam mark not found.', 404);
  }

  const examSubject = await findExamSubjectById(dbPerformance, existing.examSubjectId);
  if (!examSubject) {
    throw new PerformanceServiceError('NOT_FOUND', 'Referenced exam subject not found.', 404);
  }

  const nextIsAbsent = input.isAbsent !== undefined ? input.isAbsent : existing.isAbsent;
  const nextMarksObtained =
    nextIsAbsent
      ? null
      : input.marksObtained !== undefined
        ? input.marksObtained
        : existing.marksObtained;

  const validatedMarks = validateMarkAgainstExamSubject(examSubject, {
    isAbsent: nextIsAbsent,
    marksObtained: nextMarksObtained,
  });

  await updateExamMark(dbPerformance, examMarkId, {
    isAbsent: nextIsAbsent,
    marksObtained: validatedMarks,
    remarks: input.remarks !== undefined ? input.remarks : existing.remarks,
    enteredByTeacherId:
      actorSession?.profiles?.teacherProfileId ?? existing.enteredByTeacherId ?? null,
  });

  const updated = await findExamMarkById(dbPerformance, examMarkId);
  await recordBestEffortAudit(workerEnv, {
    actorUserId: actorSession?.userId ?? null,
    action: 'UPDATE',
    entityType: 'exam_marks',
    entityId: examMarkId,
    oldValues: existing,
    newValues: updated,
    ipAddress: meta.clientIp ?? null,
    requestId: meta.requestId ?? null,
  });

  return updated;
}

// ---------------------------------------------------------------------------
// Grading Scales
// ---------------------------------------------------------------------------

/**
 * List grading scales with bounded pagination.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbPerformance
 * @param {{ page: number, pageSize: number, academicSessionId?: string, name?: string, isActive?: boolean }} query
 */
export async function listGradingScalesService(dbPerformance, query) {
  return await listGradingScalesPaginated(dbPerformance, {
    academicSessionId: query.academicSessionId,
    name: query.name,
    isActive: query.isActive,
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  });
}

/**
 * Fetch a single grading scale entry by ID.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbPerformance
 * @param {string} gradingScaleId
 */
export async function getGradingScaleByIdService(dbPerformance, gradingScaleId) {
  const scale = await findGradingScaleById(dbPerformance, gradingScaleId);
  if (!scale) {
    throw new PerformanceServiceError('NOT_FOUND', 'Grading scale not found.', 404);
  }
  return scale;
}

async function assertNoGradingScaleOverlap(
  dbPerformance,
  { academicSessionId, name, effectiveFrom, minPercentage, maxPercentage, excludeId }
) {
  const siblings = await findActiveGradingScalesForOverlapCheck(dbPerformance, {
    academicSessionId: academicSessionId ?? null,
    name,
    effectiveFrom,
    excludeId,
  });

  const overlapping = siblings.find(
    (s) => minPercentage <= s.maxPercentage && maxPercentage >= s.minPercentage
  );
  if (overlapping) {
    throw new PerformanceServiceError(
      'CONFLICT',
      `Percentage range [${minPercentage}, ${maxPercentage}] overlaps with existing active grade "${overlapping.gradeLabel}" [${overlapping.minPercentage}, ${overlapping.maxPercentage}].`,
      409
    );
  }
}

/**
 * Create a grading scale band, enforcing non-overlapping active percentage ranges.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbPerformance
 * @param {Record<string, unknown>} workerEnv
 * @param {{ userId: string }} actorSession
 * @param {{ academicSessionId?: string | null, name: string, gradeLabel: string, minPercentage: number, maxPercentage: number, gradePoint?: number | null, isPassing?: boolean, effectiveFrom: string, isActive?: boolean }} input
 * @param {{ clientIp?: string | null, requestId?: string | null }} meta
 */
export async function createGradingScaleService(
  dbPerformance,
  workerEnv,
  actorSession,
  input,
  meta = {}
) {
  if (input.academicSessionId) {
    await assertAcademicSessionExists(workerEnv, input.academicSessionId);
  }

  const isActive = input.isActive !== undefined ? input.isActive : true;
  if (isActive) {
    await assertNoGradingScaleOverlap(dbPerformance, {
      academicSessionId: input.academicSessionId ?? null,
      name: input.name,
      effectiveFrom: input.effectiveFrom,
      minPercentage: input.minPercentage,
      maxPercentage: input.maxPercentage,
    });
  }

  const id = crypto.randomUUID();
  const createdAt = nowIso();

  try {
    await createGradingScale(dbPerformance, {
      id,
      academicSessionId: input.academicSessionId ?? null,
      name: input.name,
      gradeLabel: input.gradeLabel,
      minPercentage: input.minPercentage,
      maxPercentage: input.maxPercentage,
      gradePoint: input.gradePoint ?? null,
      isPassing: input.isPassing === false ? 0 : 1,
      effectiveFrom: input.effectiveFrom,
      isActive: isActive ? 1 : 0,
      createdAt,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new PerformanceServiceError(
        'CONFLICT',
        'A grading scale entry with this name, grade label, and effective date already exists.',
        409
      );
    }
    throw error;
  }

  const created = await findGradingScaleById(dbPerformance, id);
  await recordBestEffortAudit(workerEnv, {
    actorUserId: actorSession?.userId ?? null,
    action: 'CREATE',
    entityType: 'grading_scales',
    entityId: id,
    newValues: created,
    ipAddress: meta.clientIp ?? null,
    requestId: meta.requestId ?? null,
  });

  return created;
}

/**
 * Update a grading scale band, enforcing non-overlapping active percentage ranges.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbPerformance
 * @param {Record<string, unknown>} workerEnv
 * @param {{ userId: string }} actorSession
 * @param {string} gradingScaleId
 * @param {Record<string, unknown>} input
 * @param {{ clientIp?: string | null, requestId?: string | null }} meta
 */
export async function updateGradingScaleService(
  dbPerformance,
  workerEnv,
  actorSession,
  gradingScaleId,
  input,
  meta = {}
) {
  const existing = await findGradingScaleById(dbPerformance, gradingScaleId);
  if (!existing) {
    throw new PerformanceServiceError('NOT_FOUND', 'Grading scale not found.', 404);
  }

  if (input.academicSessionId) {
    await assertAcademicSessionExists(workerEnv, input.academicSessionId);
  }

  const nextMin = input.minPercentage ?? existing.minPercentage;
  const nextMax = input.maxPercentage ?? existing.maxPercentage;
  if (nextMin > nextMax) {
    throw new PerformanceServiceError(
      'VALIDATION_ERROR',
      'Minimum percentage must be less than or equal to maximum percentage.',
      400
    );
  }

  const nextIsActive = input.isActive !== undefined ? input.isActive : existing.isActive;
  const nextSessionId =
    input.academicSessionId !== undefined ? input.academicSessionId : existing.academicSessionId;
  const nextName = input.name ?? existing.name;
  const nextEffectiveFrom = input.effectiveFrom ?? existing.effectiveFrom;

  if (nextIsActive) {
    await assertNoGradingScaleOverlap(dbPerformance, {
      academicSessionId: nextSessionId ?? null,
      name: nextName,
      effectiveFrom: nextEffectiveFrom,
      minPercentage: nextMin,
      maxPercentage: nextMax,
      excludeId: gradingScaleId,
    });
  }

  try {
    await updateGradingScale(dbPerformance, gradingScaleId, input);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new PerformanceServiceError(
        'CONFLICT',
        'A grading scale entry with this name, grade label, and effective date already exists.',
        409
      );
    }
    throw error;
  }

  const updated = await findGradingScaleById(dbPerformance, gradingScaleId);
  await recordBestEffortAudit(workerEnv, {
    actorUserId: actorSession?.userId ?? null,
    action: 'UPDATE',
    entityType: 'grading_scales',
    entityId: gradingScaleId,
    oldValues: existing,
    newValues: updated,
    ipAddress: meta.clientIp ?? null,
    requestId: meta.requestId ?? null,
  });

  return updated;
}

// ---------------------------------------------------------------------------
// Performance Records
// ---------------------------------------------------------------------------

/**
 * List daily performance records with bounded pagination.
 * When `studentId` is provided without `enrollmentId`, resolves enrollments from `DB_STUDENTS`.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbPerformance
 * @param {Record<string, unknown>} workerEnv
 * @param {{ page: number, pageSize: number, enrollmentId?: string, studentId?: string, teacherProfileId?: string, subjectId?: string, category?: string, fromDate?: string, toDate?: string }} query
 */
export async function listPerformanceRecordsService(dbPerformance, workerEnv, query) {
  let enrollmentIds;
  if (!query.enrollmentId && query.studentId) {
    const dbStudents = getDomainDb(workerEnv, D1_BINDINGS.STUDENTS);
    const res = await dbStudents
      .prepare(
        `SELECT id
         FROM enrollments
         WHERE student_id = ?
         ORDER BY start_date DESC
         LIMIT 90`
      )
      .bind(query.studentId)
      .all();
    enrollmentIds = (res.results || []).map((r) => r.id);
  }

  return await listPerformanceRecordsPaginated(dbPerformance, {
    enrollmentId: query.enrollmentId,
    enrollmentIds,
    teacherProfileId: query.teacherProfileId,
    subjectId: query.subjectId,
    category: query.category,
    fromDate: query.fromDate,
    toDate: query.toDate,
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  });
}

/**
 * Create a daily performance record after validating `enrollmentId`, optional `subjectId`, and active teacher profile.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbPerformance
 * @param {Record<string, unknown>} workerEnv
 * @param {{ userId: string, profiles?: { teacherProfileId?: string | null } }} actorSession
 * @param {{ enrollmentId: string, subjectId?: string | null, evaluationDate: string, category: string, marksObtained?: number | null, maxMarks?: number | null, remarks: string }} input
 * @param {{ clientIp?: string | null, requestId?: string | null }} meta
 */
export async function createPerformanceRecordService(
  dbPerformance,
  workerEnv,
  actorSession,
  input,
  meta = {}
) {
  const teacherProfileId = actorSession?.profiles?.teacherProfileId;
  if (!teacherProfileId) {
    throw new PerformanceServiceError(
      'FORBIDDEN',
      'A valid teacher profile is required to record performance evaluations.',
      403
    );
  }

  await assertTeacherProfileActive(workerEnv, teacherProfileId);

  const dbStudents = getDomainDb(workerEnv, D1_BINDINGS.STUDENTS);
  const enrollment = await dbStudents
    .prepare(
      `SELECT id, academic_session_id, class_id, enrollment_status
       FROM enrollments
       WHERE id = ?
       LIMIT 1`
    )
    .bind(input.enrollmentId)
    .first();

  if (!enrollment) {
    throw new PerformanceServiceError('VALIDATION_ERROR', 'Referenced enrollment does not exist.', 400);
  }
  if (enrollment.enrollment_status !== 'ACTIVE') {
    throw new PerformanceServiceError(
      'VALIDATION_ERROR',
      'Performance records can only be created for an ACTIVE enrollment.',
      400
    );
  }

  if (input.subjectId) {
    await assertClassSubjectExists(workerEnv, {
      academicSessionId: enrollment.academic_session_id,
      classId: enrollment.class_id,
      subjectId: input.subjectId,
    });
  }

  const id = crypto.randomUUID();
  const createdAt = nowIso();

  await createPerformanceRecord(dbPerformance, {
    id,
    enrollmentId: input.enrollmentId,
    teacherProfileId,
    subjectId: input.subjectId ?? null,
    evaluationDate: input.evaluationDate,
    category: input.category,
    marksObtained: input.marksObtained ?? null,
    maxMarks: input.maxMarks ?? null,
    remarks: input.remarks,
    createdAt,
  });

  const created = await findPerformanceRecordById(dbPerformance, id);
  await recordBestEffortAudit(workerEnv, {
    actorUserId: actorSession?.userId ?? null,
    action: 'CREATE',
    entityType: 'performance_records',
    entityId: id,
    newValues: created,
    ipAddress: meta.clientIp ?? null,
    requestId: meta.requestId ?? null,
  });

  return created;
}

// ---------------------------------------------------------------------------
// Results & Summaries
// ---------------------------------------------------------------------------

function buildExamResultSummary(examSubjects, markBySubjectId, gradingScales, referenceDate) {
  let totalMarksObtained = 0;
  let gradedMaxMarks = 0;
  let totalScheduledMaxMarks = 0;
  let incomplete = false;
  let absentCount = 0;
  let allSubjectsPassed = examSubjects.length > 0;

  const subjectResults = examSubjects.map((subject) => {
    totalScheduledMaxMarks += subject.maxMarks;
    const mark = markBySubjectId.get(subject.id) || null;

    if (!mark) {
      incomplete = true;
      allSubjectsPassed = false;
      return {
        examSubjectId: subject.id,
        subjectId: subject.subjectId,
        examDate: subject.examDate,
        maxMarks: subject.maxMarks,
        passingMarks: subject.passingMarks,
        hasMark: false,
        status: 'MISSING',
        isAbsent: false,
        marksObtained: null,
        passed: null,
        remarks: null,
      };
    }

    gradedMaxMarks += subject.maxMarks;
    if (mark.isAbsent) {
      absentCount += 1;
      allSubjectsPassed = false;
      // Per OD-09: absent counts as 0 in denominator and fails the subject
      return {
        examSubjectId: subject.id,
        subjectId: subject.subjectId,
        examDate: subject.examDate,
        maxMarks: subject.maxMarks,
        passingMarks: subject.passingMarks,
        hasMark: true,
        status: 'ABSENT',
        isAbsent: true,
        marksObtained: 0,
        passed: false,
        remarks: mark.remarks,
      };
    }

    const obtained = mark.marksObtained ?? 0;
    totalMarksObtained += obtained;
    const passed = obtained >= subject.passingMarks;
    if (!passed) {
      allSubjectsPassed = false;
    }

    return {
      examSubjectId: subject.id,
      subjectId: subject.subjectId,
      examDate: subject.examDate,
      maxMarks: subject.maxMarks,
      passingMarks: subject.passingMarks,
      hasMark: true,
      status: passed ? 'PASS' : 'FAIL',
      isAbsent: false,
      marksObtained: obtained,
      passed,
      remarks: mark.remarks,
    };
  });

  const percentage = roundPercentage(totalMarksObtained, gradedMaxMarks);
  const grade = matchGradingScale(gradingScales, percentage, referenceDate);
  const overallPassed =
    !incomplete && allSubjectsPassed && (grade === null || grade.isPassing !== false);

  return {
    totalMarksObtained,
    gradedMaxMarks,
    totalScheduledMaxMarks,
    percentage,
    grade,
    incomplete,
    absentCount,
    overallPassed,
    subjects: subjectResults,
  };
}

/**
 * Compute student exam results across matching enrollments.
 * - `STUDENT` and `PARENT` (non-admin, non-teacher) only see published examinations (`is_published = 1`).
 * - Totals & percentage (rounded to 2 decimals) are computed only over subjects with entered marks.
 * - `is_absent = 1` counts as `0` in denominator and fails per `OD-09`.
 * - Missing/unentered marks flag `incomplete: true` instead of silently counting as `0`.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbPerformance
 * @param {Record<string, unknown>} workerEnv
 * @param {{ roles?: string[] }} actorSession
 * @param {{ studentId: string, academicSessionId?: string, examinationId?: string }} query
 */
export async function getStudentExamResultsService(
  dbPerformance,
  workerEnv,
  actorSession,
  { studentId, academicSessionId, examinationId }
) {
  const roles = Array.isArray(actorSession?.roles) ? actorSession.roles : [];
  const canViewUnpublished =
    roles.includes('SUPER_ADMIN') ||
    roles.includes('COACHING_ADMIN') ||
    roles.includes('TEACHER');

  const dbStudents = getDomainDb(workerEnv, D1_BINDINGS.STUDENTS);
  const enrollmentWhere = ['student_id = ?'];
  const enrollmentParams = [studentId];
  if (academicSessionId) {
    enrollmentWhere.push('academic_session_id = ?');
    enrollmentParams.push(academicSessionId);
  }

  const enrollmentsRes = await dbStudents
    .prepare(
      `SELECT id, student_id, academic_session_id, class_id, roll_number, enrollment_status
       FROM enrollments
       WHERE ${enrollmentWhere.join(' AND ')}
       ORDER BY start_date DESC`
    )
    .bind(...enrollmentParams)
    .all();

  const enrollments = enrollmentsRes.results || [];
  if (enrollments.length === 0) {
    return { studentId, results: [] };
  }

  const enrollmentBySessionId = new Map();
  for (const enr of enrollments) {
    enrollmentBySessionId.set(enr.academic_session_id, enr);
  }

  const sessionIds = [...enrollmentBySessionId.keys()];
  const examinations = await listExaminationsForSessions(dbPerformance, {
    academicSessionIds: sessionIds,
    publishedOnly: !canViewUnpublished,
    examinationId,
  });

  if (examinationId && examinations.length === 0) {
    throw new PerformanceServiceError('NOT_FOUND', 'Examination results not found.', 404);
  }

  const scalesCache = new Map();
  const results = [];

  for (const exam of examinations) {
    const enrollment = enrollmentBySessionId.get(exam.academicSessionId);
    if (!enrollment) continue;

    const examSubjects = await listExamSubjectsByExaminationAndClass(
      dbPerformance,
      exam.id,
      enrollment.class_id
    );
    const subjectIds = examSubjects.map((s) => s.id);

    const marks = await listExamMarksForSubjectsAndEnrollments(
      dbPerformance,
      subjectIds,
      [enrollment.id]
    );
    const markBySubjectId = new Map(marks.map((m) => [m.examSubjectId, m]));

    if (!scalesCache.has(exam.academicSessionId)) {
      scalesCache.set(
        exam.academicSessionId,
        await listActiveGradingScalesForSession(dbPerformance, exam.academicSessionId)
      );
    }
    const gradingScales = scalesCache.get(exam.academicSessionId) || [];

    const summary = buildExamResultSummary(
      examSubjects,
      markBySubjectId,
      gradingScales,
      exam.startDate
    );

    results.push({
      examination: exam,
      enrollment: {
        id: enrollment.id,
        academicSessionId: enrollment.academic_session_id,
        classId: enrollment.class_id,
        rollNumber: enrollment.roll_number ?? null,
        enrollmentStatus: enrollment.enrollment_status,
      },
      ...summary,
    });
  }

  return { studentId, results };
}

/**
 * Compute paginated class-wide exam results for a given `(examinationId, classId)`.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbPerformance
 * @param {Record<string, unknown>} workerEnv
 * @param {{ examinationId: string, classId: string, page: number, pageSize: number }} query
 */
export async function getClassExamResultsService(
  dbPerformance,
  workerEnv,
  { examinationId, classId, page, pageSize }
) {
  const examination = await findExaminationById(dbPerformance, examinationId);
  if (!examination) {
    throw new PerformanceServiceError('NOT_FOUND', 'Examination not found.', 404);
  }

  const examSubjects = await listExamSubjectsByExaminationAndClass(
    dbPerformance,
    examinationId,
    classId
  );

  const dbStudents = getDomainDb(workerEnv, D1_BINDINGS.STUDENTS);
  const offset = (page - 1) * pageSize;

  const [countRes, enrollmentsRes] = await dbStudents.batch([
    dbStudents
      .prepare(
        `SELECT COUNT(*) AS total
         FROM enrollments
         WHERE academic_session_id = ? AND class_id = ? AND enrollment_status = 'ACTIVE'`
      )
      .bind(examination.academicSessionId, classId),
    dbStudents
      .prepare(
        `SELECT
           e.id AS enrollment_id,
           e.student_id,
           e.roll_number,
           s.admission_number,
           s.full_name
         FROM enrollments e
         INNER JOIN students s ON s.id = e.student_id
         WHERE e.academic_session_id = ?
           AND e.class_id = ?
           AND e.enrollment_status = 'ACTIVE'
         ORDER BY COALESCE(e.roll_number, s.admission_number) ASC, s.full_name ASC
         LIMIT ? OFFSET ?`
      )
      .bind(examination.academicSessionId, classId, pageSize, offset),
  ]);

  const total = Number(countRes.results[0]?.total ?? 0);
  const studentEnrollments = enrollmentsRes.results || [];
  const enrollmentIds = studentEnrollments.map((r) => r.enrollment_id);
  const subjectIds = examSubjects.map((s) => s.id);

  const [marks, gradingScales] = await Promise.all([
    listExamMarksForSubjectsAndEnrollments(dbPerformance, subjectIds, enrollmentIds),
    listActiveGradingScalesForSession(dbPerformance, examination.academicSessionId),
  ]);

  const marksByEnrollment = new Map();
  for (const mark of marks) {
    if (!marksByEnrollment.has(mark.enrollmentId)) {
      marksByEnrollment.set(mark.enrollmentId, new Map());
    }
    marksByEnrollment.get(mark.enrollmentId).set(mark.examSubjectId, mark);
  }

  const results = studentEnrollments.map((row) => {
    const markMap = marksByEnrollment.get(row.enrollment_id) || new Map();
    const summary = buildExamResultSummary(
      examSubjects,
      markMap,
      gradingScales,
      examination.startDate
    );

    return {
      studentId: row.student_id,
      enrollmentId: row.enrollment_id,
      admissionNumber: row.admission_number,
      fullName: row.full_name,
      rollNumber: row.roll_number ?? null,
      ...summary,
    };
  });

  return {
    examination,
    examSubjects,
    results,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}
