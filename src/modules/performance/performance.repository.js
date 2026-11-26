/**
 * Direct Cloudflare D1 (`DB_PERFORMANCE`) repository for examinations, exam subjects,
 * exam marks, performance records, and grading scales.
 */

const MAX_IN_PARAMS = 90;

function buildPlaceholders(count) {
  return Array.from({ length: count }, () => '?').join(', ');
}

function chunkArray(items, size = MAX_IN_PARAMS) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function mapExaminationRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    academicSessionId: row.academic_session_id,
    name: row.name,
    examType: row.exam_type,
    startDate: row.start_date,
    endDate: row.end_date,
    isPublished: row.is_published === 1,
    createdAt: row.created_at,
  };
}

function mapExamSubjectRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    examinationId: row.examination_id,
    classId: row.class_id,
    subjectId: row.subject_id,
    examDate: row.exam_date,
    maxMarks: Number(row.max_marks),
    passingMarks: Number(row.passing_marks),
  };
}

function mapExamMarkRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    examSubjectId: row.exam_subject_id,
    enrollmentId: row.enrollment_id,
    marksObtained: row.marks_obtained === null || row.marks_obtained === undefined ? null : Number(row.marks_obtained),
    isAbsent: row.is_absent === 1,
    remarks: row.remarks ?? null,
    enteredByTeacherId: row.entered_by_teacher_id ?? null,
    createdAt: row.created_at,
  };
}

function mapPerformanceRecordRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    enrollmentId: row.enrollment_id,
    teacherProfileId: row.teacher_profile_id,
    subjectId: row.subject_id ?? null,
    evaluationDate: row.evaluation_date,
    category: row.category,
    marksObtained: row.marks_obtained === null || row.marks_obtained === undefined ? null : Number(row.marks_obtained),
    maxMarks: row.max_marks === null || row.max_marks === undefined ? null : Number(row.max_marks),
    remarks: row.remarks,
    createdAt: row.created_at,
  };
}

function mapGradingScaleRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    academicSessionId: row.academic_session_id ?? null,
    name: row.name,
    gradeLabel: row.grade_label,
    minPercentage: Number(row.min_percentage),
    maxPercentage: Number(row.max_percentage),
    gradePoint: row.grade_point === null || row.grade_point === undefined ? null : Number(row.grade_point),
    isPassing: row.is_passing === 1,
    effectiveFrom: row.effective_from,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Examinations
// ---------------------------------------------------------------------------

/**
 * @param {import('@cloudflare/workers-types').D1Database} dbPerformance
 * @param {string} examinationId
 */
export async function findExaminationById(dbPerformance, examinationId) {
  const row = await dbPerformance
    .prepare(
      `SELECT id, academic_session_id, name, exam_type, start_date, end_date, is_published, created_at
       FROM examinations
       WHERE id = ?
       LIMIT 1`
    )
    .bind(examinationId)
    .first();
  return mapExaminationRow(row);
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} dbPerformance
 * @param {{ academicSessionId?: string, examType?: string, isPublished?: boolean, limit: number, offset: number }} filters
 */
export async function listExaminationsPaginated(dbPerformance, filters) {
  const where = [];
  const params = [];

  if (filters.academicSessionId) {
    where.push('academic_session_id = ?');
    params.push(filters.academicSessionId);
  }
  if (filters.examType) {
    where.push('exam_type = ?');
    params.push(filters.examType);
  }
  if (typeof filters.isPublished === 'boolean') {
    where.push('is_published = ?');
    params.push(filters.isPublished ? 1 : 0);
  }

  const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const [countRes, rowsRes] = await dbPerformance.batch([
    dbPerformance.prepare(`SELECT COUNT(*) AS total FROM examinations ${clause}`).bind(...params),
    dbPerformance
      .prepare(
        `SELECT id, academic_session_id, name, exam_type, start_date, end_date, is_published, created_at
         FROM examinations
         ${clause}
         ORDER BY start_date DESC, created_at DESC
         LIMIT ? OFFSET ?`
      )
      .bind(...params, filters.limit, filters.offset),
  ]);

  return {
    total: Number(countRes.results[0]?.total ?? 0),
    examinations: (rowsRes.results || []).map(mapExaminationRow),
  };
}

/**
 * List examinations for a set of academic session IDs (used for student results).
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbPerformance
 * @param {{ academicSessionIds: string[], publishedOnly: boolean, examinationId?: string }} filters
 */
export async function listExaminationsForSessions(
  dbPerformance,
  { academicSessionIds, publishedOnly, examinationId }
) {
  if (!academicSessionIds || academicSessionIds.length === 0) {
    return [];
  }

  const results = [];
  for (const chunk of chunkArray(academicSessionIds)) {
    const where = [`academic_session_id IN (${buildPlaceholders(chunk.length)})`];
    const params = [...chunk];

    if (publishedOnly) {
      where.push('is_published = 1');
    }
    if (examinationId) {
      where.push('id = ?');
      params.push(examinationId);
    }

    const res = await dbPerformance
      .prepare(
        `SELECT id, academic_session_id, name, exam_type, start_date, end_date, is_published, created_at
         FROM examinations
         WHERE ${where.join(' AND ')}
         ORDER BY start_date DESC, created_at DESC`
      )
      .bind(...params)
      .all();

    for (const row of res.results || []) {
      results.push(mapExaminationRow(row));
    }
  }

  return results;
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} dbPerformance
 * @param {{ id: string, academicSessionId: string, name: string, examType: string, startDate: string, endDate: string, isPublished: number, createdAt: string }} exam
 */
export async function createExamination(dbPerformance, exam) {
  return await dbPerformance
    .prepare(
      `INSERT INTO examinations (
        id, academic_session_id, name, exam_type, start_date, end_date, is_published, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      exam.id,
      exam.academicSessionId,
      exam.name,
      exam.examType,
      exam.startDate,
      exam.endDate,
      exam.isPublished,
      exam.createdAt
    )
    .run();
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} dbPerformance
 * @param {string} examinationId
 * @param {Record<string, unknown>} fields
 */
export async function updateExamination(dbPerformance, examinationId, fields) {
  const columnMap = {
    name: 'name',
    examType: 'exam_type',
    startDate: 'start_date',
    endDate: 'end_date',
  };

  const sets = [];
  const params = [];

  for (const [key, col] of Object.entries(columnMap)) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) {
      sets.push(`${col} = ?`);
      params.push(fields[key]);
    }
  }
  if (Object.prototype.hasOwnProperty.call(fields, 'isPublished')) {
    sets.push('is_published = ?');
    params.push(fields.isPublished ? 1 : 0);
  }

  if (sets.length === 0) {
    return null;
  }

  params.push(examinationId);
  return await dbPerformance
    .prepare(`UPDATE examinations SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...params)
    .run();
}

// ---------------------------------------------------------------------------
// Exam Subjects
// ---------------------------------------------------------------------------

/**
 * @param {import('@cloudflare/workers-types').D1Database} dbPerformance
 * @param {string} examSubjectId
 */
export async function findExamSubjectById(dbPerformance, examSubjectId) {
  const row = await dbPerformance
    .prepare(
      `SELECT id, examination_id, class_id, subject_id, exam_date, max_marks, passing_marks
       FROM exam_subjects
       WHERE id = ?
       LIMIT 1`
    )
    .bind(examSubjectId)
    .first();
  return mapExamSubjectRow(row);
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} dbPerformance
 * @param {string} examinationId
 * @param {string} classId
 */
export async function listExamSubjectsByExaminationAndClass(
  dbPerformance,
  examinationId,
  classId
) {
  const res = await dbPerformance
    .prepare(
      `SELECT id, examination_id, class_id, subject_id, exam_date, max_marks, passing_marks
       FROM exam_subjects
       WHERE examination_id = ? AND class_id = ?
       ORDER BY exam_date ASC, id ASC`
    )
    .bind(examinationId, classId)
    .all();
  return (res.results || []).map(mapExamSubjectRow);
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} dbPerformance
 * @param {{ examinationId?: string, classId?: string, subjectId?: string, limit: number, offset: number }} filters
 */
export async function listExamSubjectsPaginated(dbPerformance, filters) {
  const where = [];
  const params = [];

  if (filters.examinationId) {
    where.push('examination_id = ?');
    params.push(filters.examinationId);
  }
  if (filters.classId) {
    where.push('class_id = ?');
    params.push(filters.classId);
  }
  if (filters.subjectId) {
    where.push('subject_id = ?');
    params.push(filters.subjectId);
  }

  const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const [countRes, rowsRes] = await dbPerformance.batch([
    dbPerformance.prepare(`SELECT COUNT(*) AS total FROM exam_subjects ${clause}`).bind(...params),
    dbPerformance
      .prepare(
        `SELECT id, examination_id, class_id, subject_id, exam_date, max_marks, passing_marks
         FROM exam_subjects
         ${clause}
         ORDER BY exam_date ASC, id ASC
         LIMIT ? OFFSET ?`
      )
      .bind(...params, filters.limit, filters.offset),
  ]);

  return {
    total: Number(countRes.results[0]?.total ?? 0),
    examSubjects: (rowsRes.results || []).map(mapExamSubjectRow),
  };
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} dbPerformance
 * @param {{ id: string, examinationId: string, classId: string, subjectId: string, examDate: string, maxMarks: number, passingMarks: number }} subject
 */
export async function createExamSubject(dbPerformance, subject) {
  return await dbPerformance
    .prepare(
      `INSERT INTO exam_subjects (
        id, examination_id, class_id, subject_id, exam_date, max_marks, passing_marks
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      subject.id,
      subject.examinationId,
      subject.classId,
      subject.subjectId,
      subject.examDate,
      subject.maxMarks,
      subject.passingMarks
    )
    .run();
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} dbPerformance
 * @param {string} examSubjectId
 * @param {Record<string, unknown>} fields
 */
export async function updateExamSubject(dbPerformance, examSubjectId, fields) {
  const columnMap = {
    examDate: 'exam_date',
    maxMarks: 'max_marks',
    passingMarks: 'passing_marks',
  };

  const sets = [];
  const params = [];

  for (const [key, col] of Object.entries(columnMap)) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) {
      sets.push(`${col} = ?`);
      params.push(fields[key]);
    }
  }

  if (sets.length === 0) {
    return null;
  }

  params.push(examSubjectId);
  return await dbPerformance
    .prepare(`UPDATE exam_subjects SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...params)
    .run();
}

// ---------------------------------------------------------------------------
// Exam Marks
// ---------------------------------------------------------------------------

/**
 * @param {import('@cloudflare/workers-types').D1Database} dbPerformance
 * @param {string} examMarkId
 */
export async function findExamMarkById(dbPerformance, examMarkId) {
  const row = await dbPerformance
    .prepare(
      `SELECT id, exam_subject_id, enrollment_id, marks_obtained, is_absent, remarks, entered_by_teacher_id, created_at
       FROM exam_marks
       WHERE id = ?
       LIMIT 1`
    )
    .bind(examMarkId)
    .first();
  return mapExamMarkRow(row);
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} dbPerformance
 * @param {string} examSubjectId
 * @param {string} enrollmentId
 */
export async function findExamMarkBySubjectAndEnrollment(
  dbPerformance,
  examSubjectId,
  enrollmentId
) {
  const row = await dbPerformance
    .prepare(
      `SELECT id, exam_subject_id, enrollment_id, marks_obtained, is_absent, remarks, entered_by_teacher_id, created_at
       FROM exam_marks
       WHERE exam_subject_id = ? AND enrollment_id = ?
       LIMIT 1`
    )
    .bind(examSubjectId, enrollmentId)
    .first();
  return mapExamMarkRow(row);
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} dbPerformance
 * @param {{ examSubjectId?: string, enrollmentId?: string, limit: number, offset: number }} filters
 */
export async function listExamMarksPaginated(dbPerformance, filters) {
  const where = [];
  const params = [];

  if (filters.examSubjectId) {
    where.push('exam_subject_id = ?');
    params.push(filters.examSubjectId);
  }
  if (filters.enrollmentId) {
    where.push('enrollment_id = ?');
    params.push(filters.enrollmentId);
  }

  const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const [countRes, rowsRes] = await dbPerformance.batch([
    dbPerformance.prepare(`SELECT COUNT(*) AS total FROM exam_marks ${clause}`).bind(...params),
    dbPerformance
      .prepare(
        `SELECT id, exam_subject_id, enrollment_id, marks_obtained, is_absent, remarks, entered_by_teacher_id, created_at
         FROM exam_marks
         ${clause}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`
      )
      .bind(...params, filters.limit, filters.offset),
  ]);

  return {
    total: Number(countRes.results[0]?.total ?? 0),
    examMarks: (rowsRes.results || []).map(mapExamMarkRow),
  };
}

/**
 * Fetch exam marks for a list of `exam_subject_id`s and a list of `enrollment_id`s.
 * Uses bounded `IN (...)` chunks to respect D1 parameter limits.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbPerformance
 * @param {string[]} examSubjectIds
 * @param {string[]} enrollmentIds
 */
export async function listExamMarksForSubjectsAndEnrollments(
  dbPerformance,
  examSubjectIds,
  enrollmentIds
) {
  if (
    !examSubjectIds ||
    examSubjectIds.length === 0 ||
    !enrollmentIds ||
    enrollmentIds.length === 0
  ) {
    return [];
  }

  const marks = [];
  const subjectChunks = chunkArray(examSubjectIds, 45);
  const enrollmentChunks = chunkArray(enrollmentIds, 45);

  for (const subChunk of subjectChunks) {
    for (const enrChunk of enrollmentChunks) {
      const res = await dbPerformance
        .prepare(
          `SELECT id, exam_subject_id, enrollment_id, marks_obtained, is_absent, remarks, entered_by_teacher_id, created_at
           FROM exam_marks
           WHERE exam_subject_id IN (${buildPlaceholders(subChunk.length)})
             AND enrollment_id IN (${buildPlaceholders(enrChunk.length)})`
        )
        .bind(...subChunk, ...enrChunk)
        .all();

      for (const row of res.results || []) {
        marks.push(mapExamMarkRow(row));
      }
    }
  }

  return marks;
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} dbPerformance
 * @param {{ id: string, examSubjectId: string, enrollmentId: string, marksObtained: number | null, isAbsent: number, remarks: string | null, enteredByTeacherId: string | null, createdAt: string }} mark
 */
export async function createExamMark(dbPerformance, mark) {
  return await dbPerformance
    .prepare(
      `INSERT INTO exam_marks (
        id, exam_subject_id, enrollment_id, marks_obtained, is_absent, remarks, entered_by_teacher_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      mark.id,
      mark.examSubjectId,
      mark.enrollmentId,
      mark.marksObtained,
      mark.isAbsent,
      mark.remarks ?? null,
      mark.enteredByTeacherId ?? null,
      mark.createdAt
    )
    .run();
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} dbPerformance
 * @param {string} examMarkId
 * @param {{ marksObtained?: number | null, isAbsent?: boolean, remarks?: string | null, enteredByTeacherId?: string | null }} fields
 */
export async function updateExamMark(dbPerformance, examMarkId, fields) {
  const sets = [];
  const params = [];

  if (Object.prototype.hasOwnProperty.call(fields, 'marksObtained')) {
    sets.push('marks_obtained = ?');
    params.push(fields.marksObtained ?? null);
  }
  if (Object.prototype.hasOwnProperty.call(fields, 'isAbsent')) {
    sets.push('is_absent = ?');
    params.push(fields.isAbsent ? 1 : 0);
  }
  if (Object.prototype.hasOwnProperty.call(fields, 'remarks')) {
    sets.push('remarks = ?');
    params.push(fields.remarks ?? null);
  }
  if (Object.prototype.hasOwnProperty.call(fields, 'enteredByTeacherId')) {
    sets.push('entered_by_teacher_id = ?');
    params.push(fields.enteredByTeacherId ?? null);
  }

  if (sets.length === 0) {
    return null;
  }

  params.push(examMarkId);
  return await dbPerformance
    .prepare(`UPDATE exam_marks SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...params)
    .run();
}

// ---------------------------------------------------------------------------
// Performance Records
// ---------------------------------------------------------------------------

/**
 * @param {import('@cloudflare/workers-types').D1Database} dbPerformance
 * @param {string} recordId
 */
export async function findPerformanceRecordById(dbPerformance, recordId) {
  const row = await dbPerformance
    .prepare(
      `SELECT id, enrollment_id, teacher_profile_id, subject_id, evaluation_date, category, marks_obtained, max_marks, remarks, created_at
       FROM performance_records
       WHERE id = ?
       LIMIT 1`
    )
    .bind(recordId)
    .first();
  return mapPerformanceRecordRow(row);
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} dbPerformance
 * @param {{ enrollmentId?: string, enrollmentIds?: string[], teacherProfileId?: string, subjectId?: string, category?: string, fromDate?: string, toDate?: string, limit: number, offset: number }} filters
 */
export async function listPerformanceRecordsPaginated(dbPerformance, filters) {
  const where = [];
  const params = [];

  if (filters.enrollmentId) {
    where.push('enrollment_id = ?');
    params.push(filters.enrollmentId);
  } else if (Array.isArray(filters.enrollmentIds)) {
    if (filters.enrollmentIds.length === 0) {
      return { total: 0, records: [] };
    }
    const boundedIds = filters.enrollmentIds.slice(0, MAX_IN_PARAMS);
    where.push(`enrollment_id IN (${buildPlaceholders(boundedIds.length)})`);
    params.push(...boundedIds);
  }

  if (filters.teacherProfileId) {
    where.push('teacher_profile_id = ?');
    params.push(filters.teacherProfileId);
  }
  if (filters.subjectId) {
    where.push('subject_id = ?');
    params.push(filters.subjectId);
  }
  if (filters.category) {
    where.push('category = ?');
    params.push(filters.category);
  }
  if (filters.fromDate) {
    where.push('evaluation_date >= ?');
    params.push(filters.fromDate);
  }
  if (filters.toDate) {
    where.push('evaluation_date <= ?');
    params.push(filters.toDate);
  }

  const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const [countRes, rowsRes] = await dbPerformance.batch([
    dbPerformance
      .prepare(`SELECT COUNT(*) AS total FROM performance_records ${clause}`)
      .bind(...params),
    dbPerformance
      .prepare(
        `SELECT id, enrollment_id, teacher_profile_id, subject_id, evaluation_date, category, marks_obtained, max_marks, remarks, created_at
         FROM performance_records
         ${clause}
         ORDER BY evaluation_date DESC, created_at DESC
         LIMIT ? OFFSET ?`
      )
      .bind(...params, filters.limit, filters.offset),
  ]);

  return {
    total: Number(countRes.results[0]?.total ?? 0),
    records: (rowsRes.results || []).map(mapPerformanceRecordRow),
  };
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} dbPerformance
 * @param {{ id: string, enrollmentId: string, teacherProfileId: string, subjectId: string | null, evaluationDate: string, category: string, marksObtained: number | null, maxMarks: number | null, remarks: string, createdAt: string }} record
 */
export async function createPerformanceRecord(dbPerformance, record) {
  return await dbPerformance
    .prepare(
      `INSERT INTO performance_records (
        id, enrollment_id, teacher_profile_id, subject_id, evaluation_date, category, marks_obtained, max_marks, remarks, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      record.id,
      record.enrollmentId,
      record.teacherProfileId,
      record.subjectId ?? null,
      record.evaluationDate,
      record.category,
      record.marksObtained ?? null,
      record.maxMarks ?? null,
      record.remarks,
      record.createdAt
    )
    .run();
}

// ---------------------------------------------------------------------------
// Grading Scales
// ---------------------------------------------------------------------------

/**
 * @param {import('@cloudflare/workers-types').D1Database} dbPerformance
 * @param {string} gradingScaleId
 */
export async function findGradingScaleById(dbPerformance, gradingScaleId) {
  const row = await dbPerformance
    .prepare(
      `SELECT id, academic_session_id, name, grade_label, min_percentage, max_percentage, grade_point, is_passing, effective_from, is_active, created_at
       FROM grading_scales
       WHERE id = ?
       LIMIT 1`
    )
    .bind(gradingScaleId)
    .first();
  return mapGradingScaleRow(row);
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} dbPerformance
 * @param {{ academicSessionId?: string, name?: string, isActive?: boolean, limit: number, offset: number }} filters
 */
export async function listGradingScalesPaginated(dbPerformance, filters) {
  const where = [];
  const params = [];

  if (filters.academicSessionId) {
    where.push('academic_session_id = ?');
    params.push(filters.academicSessionId);
  }
  if (filters.name) {
    where.push('name = ?');
    params.push(filters.name);
  }
  if (typeof filters.isActive === 'boolean') {
    where.push('is_active = ?');
    params.push(filters.isActive ? 1 : 0);
  }

  const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const [countRes, rowsRes] = await dbPerformance.batch([
    dbPerformance.prepare(`SELECT COUNT(*) AS total FROM grading_scales ${clause}`).bind(...params),
    dbPerformance
      .prepare(
        `SELECT id, academic_session_id, name, grade_label, min_percentage, max_percentage, grade_point, is_passing, effective_from, is_active, created_at
         FROM grading_scales
         ${clause}
         ORDER BY effective_from DESC, max_percentage DESC
         LIMIT ? OFFSET ?`
      )
      .bind(...params, filters.limit, filters.offset),
  ]);

  return {
    total: Number(countRes.results[0]?.total ?? 0),
    gradingScales: (rowsRes.results || []).map(mapGradingScaleRow),
  };
}

/**
 * Fetch active grading scales sharing `(academic_session_id, name, effective_from)` for overlap validation.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbPerformance
 * @param {{ academicSessionId: string | null, name: string, effectiveFrom: string, excludeId?: string }} scope
 */
export async function findActiveGradingScalesForOverlapCheck(
  dbPerformance,
  { academicSessionId, name, effectiveFrom, excludeId }
) {
  const where = ['is_active = 1', 'name = ?', 'effective_from = ?'];
  const params = [name, effectiveFrom];

  if (academicSessionId === null || academicSessionId === undefined) {
    where.push('academic_session_id IS NULL');
  } else {
    where.push('academic_session_id = ?');
    params.push(academicSessionId);
  }

  if (excludeId) {
    where.push('id != ?');
    params.push(excludeId);
  }

  const res = await dbPerformance
    .prepare(
      `SELECT id, academic_session_id, name, grade_label, min_percentage, max_percentage, grade_point, is_passing, effective_from, is_active, created_at
       FROM grading_scales
       WHERE ${where.join(' AND ')}
       ORDER BY min_percentage ASC`
    )
    .bind(...params)
    .all();

  return (res.results || []).map(mapGradingScaleRow);
}

/**
 * Fetch active grading scales applicable to `academicSessionId` (session-specific or global `NULL`).
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbPerformance
 * @param {string} academicSessionId
 */
export async function listActiveGradingScalesForSession(dbPerformance, academicSessionId) {
  const res = await dbPerformance
    .prepare(
      `SELECT id, academic_session_id, name, grade_label, min_percentage, max_percentage, grade_point, is_passing, effective_from, is_active, created_at
       FROM grading_scales
       WHERE is_active = 1
         AND (academic_session_id = ? OR academic_session_id IS NULL)
       ORDER BY
         CASE WHEN academic_session_id = ? THEN 0 ELSE 1 END ASC,
         effective_from DESC,
         min_percentage DESC`
    )
    .bind(academicSessionId, academicSessionId)
    .all();

  return (res.results || []).map(mapGradingScaleRow);
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} dbPerformance
 * @param {{ id: string, academicSessionId: string | null, name: string, gradeLabel: string, minPercentage: number, maxPercentage: number, gradePoint: number | null, isPassing: number, effectiveFrom: string, isActive: number, createdAt: string }} scale
 */
export async function createGradingScale(dbPerformance, scale) {
  return await dbPerformance
    .prepare(
      `INSERT INTO grading_scales (
        id, academic_session_id, name, grade_label, min_percentage, max_percentage, grade_point, is_passing, effective_from, is_active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      scale.id,
      scale.academicSessionId ?? null,
      scale.name,
      scale.gradeLabel,
      scale.minPercentage,
      scale.maxPercentage,
      scale.gradePoint ?? null,
      scale.isPassing,
      scale.effectiveFrom,
      scale.isActive,
      scale.createdAt
    )
    .run();
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} dbPerformance
 * @param {string} gradingScaleId
 * @param {Record<string, unknown>} fields
 */
export async function updateGradingScale(dbPerformance, gradingScaleId, fields) {
  const columnMap = {
    academicSessionId: 'academic_session_id',
    name: 'name',
    gradeLabel: 'grade_label',
    minPercentage: 'min_percentage',
    maxPercentage: 'max_percentage',
    gradePoint: 'grade_point',
    effectiveFrom: 'effective_from',
  };

  const sets = [];
  const params = [];

  for (const [key, col] of Object.entries(columnMap)) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) {
      sets.push(`${col} = ?`);
      params.push(fields[key] ?? null);
    }
  }
  if (Object.prototype.hasOwnProperty.call(fields, 'isPassing')) {
    sets.push('is_passing = ?');
    params.push(fields.isPassing ? 1 : 0);
  }
  if (Object.prototype.hasOwnProperty.call(fields, 'isActive')) {
    sets.push('is_active = ?');
    params.push(fields.isActive ? 1 : 0);
  }

  if (sets.length === 0) {
    return null;
  }

  params.push(gradingScaleId);
  return await dbPerformance
    .prepare(`UPDATE grading_scales SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...params)
    .run();
}
