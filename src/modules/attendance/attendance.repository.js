/**
 * Direct Cloudflare D1 (`DB_ATTENDANCE`) repository for daily registers,
 * period registers, attendance corrections, and `audit_outbox`.
 */

const ENROLLMENT_CHUNK_SIZE = 90;

function mapDailyRegisterRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    academicSessionId: row.academic_session_id,
    classId: row.class_id,
    attendanceDate: row.attendance_date,
    markedByTeacherId: row.marked_by_teacher_id ?? null,
    isLocked: row.is_locked === 1,
    createdAt: row.created_at,
  };
}

function mapDailyRecordRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    attendanceDayId: row.attendance_day_id,
    enrollmentId: row.enrollment_id,
    status: row.status,
    remarks: row.remarks ?? null,
    createdAt: row.created_at,
  };
}

function mapPeriodRegisterRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    academicSessionId: row.academic_session_id,
    classId: row.class_id,
    subjectId: row.subject_id,
    attendanceDate: row.attendance_date,
    periodNumber: row.period_number,
    markedByTeacherId: row.marked_by_teacher_id ?? null,
    isLocked: row.is_locked === 1,
    createdAt: row.created_at,
  };
}

function mapPeriodRecordRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    registerId: row.register_id,
    enrollmentId: row.enrollment_id,
    status: row.status,
    remarks: row.remarks ?? null,
    createdAt: row.created_at,
  };
}

function mapCorrectionRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    registerType: row.register_type,
    registerId: row.register_id,
    recordId: row.record_id,
    enrollmentId: row.enrollment_id,
    previousStatus: row.previous_status,
    newStatus: row.new_status,
    reason: row.reason,
    correctedByUserId: row.corrected_by_user_id,
    requestId: row.request_id ?? null,
    createdAt: row.created_at,
  };
}

function buildPlaceholders(count) {
  return Array.from({ length: count }, () => '?').join(', ');
}

function chunkIds(ids, chunkSize = ENROLLMENT_CHUNK_SIZE) {
  const chunks = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    chunks.push(ids.slice(i, i + chunkSize));
  }
  return chunks;
}

// ---------------------------------------------------------------------------
// Daily Attendance Registers & Records
// ---------------------------------------------------------------------------

/**
 * Fetch a daily attendance register by ID.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAttendance
 * @param {string} registerId
 */
export async function findDailyRegisterById(dbAttendance, registerId) {
  const row = await dbAttendance
    .prepare(
      `SELECT
         id, academic_session_id, class_id, attendance_date,
         marked_by_teacher_id, is_locked, created_at
       FROM attendance_days
       WHERE id = ?
       LIMIT 1`
    )
    .bind(registerId)
    .first();

  return mapDailyRegisterRow(row);
}

/**
 * Fetch a daily attendance register by `(academicSessionId, classId, attendanceDate)`.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAttendance
 * @param {{ academicSessionId: string, classId: string, attendanceDate: string }} scope
 */
export async function findDailyRegisterByScope(
  dbAttendance,
  { academicSessionId, classId, attendanceDate }
) {
  const row = await dbAttendance
    .prepare(
      `SELECT
         id, academic_session_id, class_id, attendance_date,
         marked_by_teacher_id, is_locked, created_at
       FROM attendance_days
       WHERE academic_session_id = ?
         AND class_id = ?
         AND attendance_date = ?
       LIMIT 1`
    )
    .bind(academicSessionId, classId, attendanceDate)
    .first();

  return mapDailyRegisterRow(row);
}

/**
 * List daily attendance registers with bounded pagination and optional filters.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAttendance
 * @param {{
 *   academicSessionId?: string,
 *   classId?: string,
 *   attendanceDate?: string,
 *   fromDate?: string,
 *   toDate?: string,
 *   isLocked?: boolean,
 *   limit: number,
 *   offset: number,
 * }} filters
 */
export async function listDailyRegistersPaginated(dbAttendance, filters) {
  const where = [];
  const params = [];

  if (filters.academicSessionId) {
    where.push('academic_session_id = ?');
    params.push(filters.academicSessionId);
  }
  if (filters.classId) {
    where.push('class_id = ?');
    params.push(filters.classId);
  }
  if (filters.attendanceDate) {
    where.push('attendance_date = ?');
    params.push(filters.attendanceDate);
  }
  if (filters.fromDate) {
    where.push('attendance_date >= ?');
    params.push(filters.fromDate);
  }
  if (filters.toDate) {
    where.push('attendance_date <= ?');
    params.push(filters.toDate);
  }
  if (typeof filters.isLocked === 'boolean') {
    where.push('is_locked = ?');
    params.push(filters.isLocked ? 1 : 0);
  }

  const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const [countRes, rowsRes] = await dbAttendance.batch([
    dbAttendance.prepare(`SELECT COUNT(*) AS total FROM attendance_days ${clause}`).bind(...params),
    dbAttendance
      .prepare(
        `SELECT
           id, academic_session_id, class_id, attendance_date,
           marked_by_teacher_id, is_locked, created_at
         FROM attendance_days
         ${clause}
         ORDER BY attendance_date DESC, created_at DESC
         LIMIT ? OFFSET ?`
      )
      .bind(...params, filters.limit, filters.offset),
  ]);

  return {
    total: Number(countRes.results[0]?.total ?? 0),
    registers: (rowsRes.results || []).map(mapDailyRegisterRow),
  };
}

/**
 * List all attendance records belonging to a daily register.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAttendance
 * @param {string} attendanceDayId
 */
export async function listDailyRecordsByRegisterId(dbAttendance, attendanceDayId) {
  const res = await dbAttendance
    .prepare(
      `SELECT id, attendance_day_id, enrollment_id, status, remarks, created_at
       FROM daily_attendance_records
       WHERE attendance_day_id = ?
       ORDER BY created_at ASC, enrollment_id ASC`
    )
    .bind(attendanceDayId)
    .all();

  return (res.results || []).map(mapDailyRecordRow);
}

/**
 * Fetch a single daily attendance record by ID.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAttendance
 * @param {string} recordId
 */
export async function findDailyRecordById(dbAttendance, recordId) {
  const row = await dbAttendance
    .prepare(
      `SELECT id, attendance_day_id, enrollment_id, status, remarks, created_at
       FROM daily_attendance_records
       WHERE id = ?
       LIMIT 1`
    )
    .bind(recordId)
    .first();

  return mapDailyRecordRow(row);
}

/**
 * Atomically insert a daily attendance register and its `DB_ATTENDANCE.audit_outbox` event.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAttendance
 * @param {{ register: Record<string, unknown>, auditStatement: unknown }} payload
 */
export async function createDailyRegisterBatch(dbAttendance, { register, auditStatement }) {
  return await dbAttendance.batch([
    dbAttendance
      .prepare(
        `INSERT INTO attendance_days (
           id, academic_session_id, class_id, attendance_date,
           marked_by_teacher_id, is_locked, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        register.id,
        register.academicSessionId,
        register.classId,
        register.attendanceDate,
        register.markedByTeacherId ?? null,
        register.isLocked ? 1 : 0,
        register.createdAt
      ),
    auditStatement,
  ]);
}

/**
 * Atomically upsert daily attendance records and write `DB_ATTENDANCE.audit_outbox`.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAttendance
 * @param {{
 *   attendanceDayId: string,
 *   records: Array<{ id: string, enrollmentId: string, status: string, remarks: string | null, createdAt: string }>,
 *   auditStatement: unknown,
 * }} payload
 */
export async function markDailyRecordsBatch(
  dbAttendance,
  { attendanceDayId, records, auditStatement }
) {
  const statements = records.map((record) =>
    dbAttendance
      .prepare(
        `INSERT INTO daily_attendance_records (
           id, attendance_day_id, enrollment_id, status, remarks, created_at
         ) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (attendance_day_id, enrollment_id) DO UPDATE SET
           status = excluded.status,
           remarks = excluded.remarks`
      )
      .bind(
        record.id,
        attendanceDayId,
        record.enrollmentId,
        record.status,
        record.remarks ?? null,
        record.createdAt
      )
  );

  statements.push(auditStatement);
  return await dbAttendance.batch(statements);
}

// ---------------------------------------------------------------------------
// Period Attendance Registers & Records
// ---------------------------------------------------------------------------

/**
 * Fetch a period attendance register by ID.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAttendance
 * @param {string} registerId
 */
export async function findPeriodRegisterById(dbAttendance, registerId) {
  const row = await dbAttendance
    .prepare(
      `SELECT
         id, academic_session_id, class_id, subject_id, attendance_date,
         period_number, marked_by_teacher_id, is_locked, created_at
       FROM period_attendance_registers
       WHERE id = ?
       LIMIT 1`
    )
    .bind(registerId)
    .first();

  return mapPeriodRegisterRow(row);
}

/**
 * Fetch a period attendance register by unique scope.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAttendance
 * @param {{ academicSessionId: string, classId: string, subjectId: string, attendanceDate: string, periodNumber: number }} scope
 */
export async function findPeriodRegisterByScope(
  dbAttendance,
  { academicSessionId, classId, subjectId, attendanceDate, periodNumber }
) {
  const row = await dbAttendance
    .prepare(
      `SELECT
         id, academic_session_id, class_id, subject_id, attendance_date,
         period_number, marked_by_teacher_id, is_locked, created_at
       FROM period_attendance_registers
       WHERE academic_session_id = ?
         AND class_id = ?
         AND subject_id = ?
         AND attendance_date = ?
         AND period_number = ?
       LIMIT 1`
    )
    .bind(academicSessionId, classId, subjectId, attendanceDate, periodNumber)
    .first();

  return mapPeriodRegisterRow(row);
}

/**
 * List period attendance registers with bounded pagination and optional filters.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAttendance
 * @param {{
 *   academicSessionId?: string,
 *   classId?: string,
 *   subjectId?: string,
 *   attendanceDate?: string,
 *   fromDate?: string,
 *   toDate?: string,
 *   periodNumber?: number,
 *   isLocked?: boolean,
 *   limit: number,
 *   offset: number,
 * }} filters
 */
export async function listPeriodRegistersPaginated(dbAttendance, filters) {
  const where = [];
  const params = [];

  if (filters.academicSessionId) {
    where.push('academic_session_id = ?');
    params.push(filters.academicSessionId);
  }
  if (filters.classId) {
    where.push('class_id = ?');
    params.push(filters.classId);
  }
  if (filters.subjectId) {
    where.push('subject_id = ?');
    params.push(filters.subjectId);
  }
  if (filters.attendanceDate) {
    where.push('attendance_date = ?');
    params.push(filters.attendanceDate);
  }
  if (filters.fromDate) {
    where.push('attendance_date >= ?');
    params.push(filters.fromDate);
  }
  if (filters.toDate) {
    where.push('attendance_date <= ?');
    params.push(filters.toDate);
  }
  if (typeof filters.periodNumber === 'number') {
    where.push('period_number = ?');
    params.push(filters.periodNumber);
  }
  if (typeof filters.isLocked === 'boolean') {
    where.push('is_locked = ?');
    params.push(filters.isLocked ? 1 : 0);
  }

  const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const [countRes, rowsRes] = await dbAttendance.batch([
    dbAttendance
      .prepare(`SELECT COUNT(*) AS total FROM period_attendance_registers ${clause}`)
      .bind(...params),
    dbAttendance
      .prepare(
        `SELECT
           id, academic_session_id, class_id, subject_id, attendance_date,
           period_number, marked_by_teacher_id, is_locked, created_at
         FROM period_attendance_registers
         ${clause}
         ORDER BY attendance_date DESC, period_number ASC, created_at DESC
         LIMIT ? OFFSET ?`
      )
      .bind(...params, filters.limit, filters.offset),
  ]);

  return {
    total: Number(countRes.results[0]?.total ?? 0),
    registers: (rowsRes.results || []).map(mapPeriodRegisterRow),
  };
}

/**
 * List all attendance records belonging to a period register.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAttendance
 * @param {string} registerId
 */
export async function listPeriodRecordsByRegisterId(dbAttendance, registerId) {
  const res = await dbAttendance
    .prepare(
      `SELECT id, register_id, enrollment_id, status, remarks, created_at
       FROM period_attendance_records
       WHERE register_id = ?
       ORDER BY created_at ASC, enrollment_id ASC`
    )
    .bind(registerId)
    .all();

  return (res.results || []).map(mapPeriodRecordRow);
}

/**
 * Fetch a single period attendance record by ID.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAttendance
 * @param {string} recordId
 */
export async function findPeriodRecordById(dbAttendance, recordId) {
  const row = await dbAttendance
    .prepare(
      `SELECT id, register_id, enrollment_id, status, remarks, created_at
       FROM period_attendance_records
       WHERE id = ?
       LIMIT 1`
    )
    .bind(recordId)
    .first();

  return mapPeriodRecordRow(row);
}

/**
 * Atomically insert a period attendance register and its `DB_ATTENDANCE.audit_outbox` event.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAttendance
 * @param {{ register: Record<string, unknown>, auditStatement: unknown }} payload
 */
export async function createPeriodRegisterBatch(dbAttendance, { register, auditStatement }) {
  return await dbAttendance.batch([
    dbAttendance
      .prepare(
        `INSERT INTO period_attendance_registers (
           id, academic_session_id, class_id, subject_id, attendance_date,
           period_number, marked_by_teacher_id, is_locked, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        register.id,
        register.academicSessionId,
        register.classId,
        register.subjectId,
        register.attendanceDate,
        register.periodNumber,
        register.markedByTeacherId ?? null,
        register.isLocked ? 1 : 0,
        register.createdAt
      ),
    auditStatement,
  ]);
}

/**
 * Atomically upsert period attendance records and write `DB_ATTENDANCE.audit_outbox`.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAttendance
 * @param {{
 *   registerId: string,
 *   records: Array<{ id: string, enrollmentId: string, status: string, remarks: string | null, createdAt: string }>,
 *   auditStatement: unknown,
 * }} payload
 */
export async function markPeriodRecordsBatch(
  dbAttendance,
  { registerId, records, auditStatement }
) {
  const statements = records.map((record) =>
    dbAttendance
      .prepare(
        `INSERT INTO period_attendance_records (
           id, register_id, enrollment_id, status, remarks, created_at
         ) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (register_id, enrollment_id) DO UPDATE SET
           status = excluded.status,
           remarks = excluded.remarks`
      )
      .bind(
        record.id,
        registerId,
        record.enrollmentId,
        record.status,
        record.remarks ?? null,
        record.createdAt
      )
  );

  statements.push(auditStatement);
  return await dbAttendance.batch(statements);
}

// ---------------------------------------------------------------------------
// Attendance Corrections
// ---------------------------------------------------------------------------

/**
 * Atomically update the target daily or period attendance record, insert an
 * `attendance_corrections` row, and insert an `audit_outbox` (`CORRECTION`) row.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAttendance
 * @param {{
 *   correction: {
 *     id: string,
 *     registerType: 'DAILY' | 'PERIOD',
 *     registerId: string,
 *     recordId: string,
 *     enrollmentId: string,
 *     previousStatus: string,
 *     newStatus: string,
 *     reason: string,
 *     correctedByUserId: string,
 *     requestId: string | null,
 *     createdAt: string,
 *   },
 *   auditStatement: unknown,
 * }} payload
 */
export async function createAttendanceCorrectionBatch(
  dbAttendance,
  { correction, auditStatement }
) {
  const updateRecordStmt =
    correction.registerType === 'DAILY'
      ? dbAttendance
          .prepare(
            `UPDATE daily_attendance_records
             SET status = ?
             WHERE id = ? AND attendance_day_id = ?`
          )
          .bind(correction.newStatus, correction.recordId, correction.registerId)
      : dbAttendance
          .prepare(
            `UPDATE period_attendance_records
             SET status = ?
             WHERE id = ? AND register_id = ?`
          )
          .bind(correction.newStatus, correction.recordId, correction.registerId);

  const insertCorrectionStmt = dbAttendance
    .prepare(
      `INSERT INTO attendance_corrections (
         id, register_type, register_id, record_id, enrollment_id,
         previous_status, new_status, reason, corrected_by_user_id,
         request_id, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      correction.id,
      correction.registerType,
      correction.registerId,
      correction.recordId,
      correction.enrollmentId,
      correction.previousStatus,
      correction.newStatus,
      correction.reason,
      correction.correctedByUserId,
      correction.requestId ?? null,
      correction.createdAt
    );

  return await dbAttendance.batch([updateRecordStmt, insertCorrectionStmt, auditStatement]);
}

/**
 * List attendance corrections with bounded pagination.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAttendance
 * @param {{
 *   registerType?: string,
 *   registerId?: string,
 *   recordId?: string,
 *   enrollmentId?: string,
 *   limit: number,
 *   offset: number,
 * }} filters
 */
export async function listAttendanceCorrectionsPaginated(dbAttendance, filters) {
  const where = [];
  const params = [];

  if (filters.registerType) {
    where.push('register_type = ?');
    params.push(filters.registerType);
  }
  if (filters.registerId) {
    where.push('register_id = ?');
    params.push(filters.registerId);
  }
  if (filters.recordId) {
    where.push('record_id = ?');
    params.push(filters.recordId);
  }
  if (filters.enrollmentId) {
    where.push('enrollment_id = ?');
    params.push(filters.enrollmentId);
  }

  const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const [countRes, rowsRes] = await dbAttendance.batch([
    dbAttendance
      .prepare(`SELECT COUNT(*) AS total FROM attendance_corrections ${clause}`)
      .bind(...params),
    dbAttendance
      .prepare(
        `SELECT
           id, register_type, register_id, record_id, enrollment_id,
           previous_status, new_status, reason, corrected_by_user_id,
           request_id, created_at
         FROM attendance_corrections
         ${clause}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`
      )
      .bind(...params, filters.limit, filters.offset),
  ]);

  return {
    total: Number(countRes.results[0]?.total ?? 0),
    corrections: (rowsRes.results || []).map(mapCorrectionRow),
  };
}

// ---------------------------------------------------------------------------
// Student Attendance & Summaries
// ---------------------------------------------------------------------------

/**
 * List daily or period attendance records for a set of `enrollmentIds` (chunked <= 100 bind params).
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAttendance
 * @param {{
 *   enrollmentIds: string[],
 *   registerType: 'DAILY' | 'PERIOD',
 *   fromDate?: string,
 *   toDate?: string,
 *   limit: number,
 *   offset: number,
 * }} filters
 */
export async function listStudentAttendancePaginated(dbAttendance, filters) {
  const uniqueIds = [...new Set(filters.enrollmentIds)].filter(Boolean);
  if (uniqueIds.length === 0) {
    return { total: 0, records: [] };
  }

  // Bound single-query IN clause to <= 90 enrollmentIds to remain well within D1's 100 bind param limit.
  const boundedIds = chunkIds(uniqueIds, ENROLLMENT_CHUNK_SIZE)[0];
  const placeholders = buildPlaceholders(boundedIds.length);
  const isDaily = filters.registerType === 'DAILY';
  const dateCol = isDaily ? 'ad.attendance_date' : 'par.attendance_date';

  const where = [
    isDaily
      ? `dar.enrollment_id IN (${placeholders})`
      : `pdr.enrollment_id IN (${placeholders})`,
  ];
  const params = [...boundedIds];

  if (filters.fromDate) {
    where.push(`${dateCol} >= ?`);
    params.push(filters.fromDate);
  }
  if (filters.toDate) {
    where.push(`${dateCol} <= ?`);
    params.push(filters.toDate);
  }

  const clause = `WHERE ${where.join(' AND ')}`;

  if (isDaily) {
    const [countRes, rowsRes] = await dbAttendance.batch([
      dbAttendance
        .prepare(
          `SELECT COUNT(*) AS total
           FROM daily_attendance_records dar
           INNER JOIN attendance_days ad ON ad.id = dar.attendance_day_id
           ${clause}`
        )
        .bind(...params),
      dbAttendance
        .prepare(
          `SELECT
             dar.id AS record_id,
             dar.attendance_day_id AS register_id,
             dar.enrollment_id,
             dar.status,
             dar.remarks,
             dar.created_at,
             ad.academic_session_id,
             ad.class_id,
             ad.attendance_date,
             ad.is_locked
           FROM daily_attendance_records dar
           INNER JOIN attendance_days ad ON ad.id = dar.attendance_day_id
           ${clause}
           ORDER BY ad.attendance_date DESC, dar.created_at DESC
           LIMIT ? OFFSET ?`
        )
        .bind(...params, filters.limit, filters.offset),
    ]);

    return {
      total: Number(countRes.results[0]?.total ?? 0),
      records: (rowsRes.results || []).map((row) => ({
        id: row.record_id,
        registerType: 'DAILY',
        registerId: row.register_id,
        enrollmentId: row.enrollment_id,
        academicSessionId: row.academic_session_id,
        classId: row.class_id,
        attendanceDate: row.attendance_date,
        status: row.status,
        remarks: row.remarks ?? null,
        isLocked: row.is_locked === 1,
        createdAt: row.created_at,
      })),
    };
  }

  const [countRes, rowsRes] = await dbAttendance.batch([
    dbAttendance
      .prepare(
        `SELECT COUNT(*) AS total
         FROM period_attendance_records pdr
         INNER JOIN period_attendance_registers par ON par.id = pdr.register_id
         ${clause}`
      )
      .bind(...params),
    dbAttendance
      .prepare(
        `SELECT
           pdr.id AS record_id,
           pdr.register_id,
           pdr.enrollment_id,
           pdr.status,
           pdr.remarks,
           pdr.created_at,
           par.academic_session_id,
           par.class_id,
           par.subject_id,
           par.attendance_date,
           par.period_number,
           par.is_locked
         FROM period_attendance_records pdr
         INNER JOIN period_attendance_registers par ON par.id = pdr.register_id
         ${clause}
         ORDER BY par.attendance_date DESC, par.period_number ASC, pdr.created_at DESC
         LIMIT ? OFFSET ?`
      )
      .bind(...params, filters.limit, filters.offset),
  ]);

  return {
    total: Number(countRes.results[0]?.total ?? 0),
    records: (rowsRes.results || []).map((row) => ({
      id: row.record_id,
      registerType: 'PERIOD',
      registerId: row.register_id,
      enrollmentId: row.enrollment_id,
      academicSessionId: row.academic_session_id,
      classId: row.class_id,
      subjectId: row.subject_id,
      attendanceDate: row.attendance_date,
      periodNumber: row.period_number,
      status: row.status,
      remarks: row.remarks ?? null,
      isLocked: row.is_locked === 1,
      createdAt: row.created_at,
    })),
  };
}

/**
 * Aggregate attendance counts by `enrollment_id` for a session/class/date range.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAttendance
 * @param {{
 *   academicSessionId: string,
 *   classId?: string,
 *   subjectId?: string,
 *   registerType: 'DAILY' | 'PERIOD',
 *   fromDate?: string,
 *   toDate?: string,
 *   limit: number,
 *   offset: number,
 * }} filters
 */
export async function summarizeAttendancePaginated(dbAttendance, filters) {
  const isDaily = filters.registerType === 'DAILY';
  const where = [isDaily ? 'ad.academic_session_id = ?' : 'par.academic_session_id = ?'];
  const params = [filters.academicSessionId];

  if (filters.classId) {
    where.push(isDaily ? 'ad.class_id = ?' : 'par.class_id = ?');
    params.push(filters.classId);
  }
  if (!isDaily && filters.subjectId) {
    where.push('par.subject_id = ?');
    params.push(filters.subjectId);
  }
  if (filters.fromDate) {
    where.push(isDaily ? 'ad.attendance_date >= ?' : 'par.attendance_date >= ?');
    params.push(filters.fromDate);
  }
  if (filters.toDate) {
    where.push(isDaily ? 'ad.attendance_date <= ?' : 'par.attendance_date <= ?');
    params.push(filters.toDate);
  }

  const clause = `WHERE ${where.join(' AND ')}`;
  const fromJoin = isDaily
    ? `FROM daily_attendance_records r
       INNER JOIN attendance_days ad ON ad.id = r.attendance_day_id`
    : `FROM period_attendance_records r
       INNER JOIN period_attendance_registers par ON par.id = r.register_id`;

  const [countRes, rowsRes] = await dbAttendance.batch([
    dbAttendance
      .prepare(`SELECT COUNT(DISTINCT r.enrollment_id) AS total ${fromJoin} ${clause}`)
      .bind(...params),
    dbAttendance
      .prepare(
        `SELECT
           r.enrollment_id,
           COUNT(*) AS total_records,
           SUM(CASE WHEN r.status = 'PRESENT' THEN 1 ELSE 0 END) AS present_count,
           SUM(CASE WHEN r.status = 'ABSENT' THEN 1 ELSE 0 END) AS absent_count,
           SUM(CASE WHEN r.status = 'LATE' THEN 1 ELSE 0 END) AS late_count,
           SUM(CASE WHEN r.status = 'LEAVE' THEN 1 ELSE 0 END) AS leave_count
         ${fromJoin}
         ${clause}
         GROUP BY r.enrollment_id
         ORDER BY r.enrollment_id ASC
         LIMIT ? OFFSET ?`
      )
      .bind(...params, filters.limit, filters.offset),
  ]);

  return {
    total: Number(countRes.results[0]?.total ?? 0),
    summaries: (rowsRes.results || []).map((row) => {
      const totalRecords = Number(row.total_records ?? 0);
      const presentCount = Number(row.present_count ?? 0);
      const lateCount = Number(row.late_count ?? 0);
      const absentCount = Number(row.absent_count ?? 0);
      const leaveCount = Number(row.leave_count ?? 0);
      const attendedCount = presentCount + lateCount;
      const attendancePercentage =
        totalRecords > 0 ? Math.round((attendedCount / totalRecords) * 10000) / 100 : 0;

      return {
        enrollmentId: row.enrollment_id,
        totalRecords,
        presentCount,
        absentCount,
        lateCount,
        leaveCount,
        attendancePercentage,
      };
    }),
  };
}
