/**
 * Direct Cloudflare D1 repository for `DB_ACADEMICS` (`teacher_profiles`, `teacher_assignments`)
 * and scoped roster reads from `DB_STUDENTS` (`enrollments` + `students`).
 */

function mapTeacherProfileRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    employeeCode: row.employee_code,
    fullName: row.full_name,
    qualification: row.qualification ?? null,
    specialization: row.specialization ?? null,
    joiningDate: row.joining_date,
    employmentStatus: row.employment_status,
    photoFileId: row.photo_file_id ?? null,
    createdAt: row.created_at,
  };
}

function mapTeacherAssignmentRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    teacherProfileId: row.teacher_profile_id,
    academicSessionId: row.academic_session_id,
    classId: row.class_id,
    subjectId: row.subject_id,
    responsibilityCategory: row.responsibility_category,
    createdAt: row.created_at,
  };
}

function mapRosterStudentRow(row) {
  if (!row) return null;
  return {
    enrollmentId: row.enrollment_id,
    studentId: row.student_id,
    admissionNumber: row.admission_number,
    fullName: row.full_name,
    rollNumber: row.roll_number ?? null,
    enrollmentStatus: row.enrollment_status,
    lifecycleStatus: row.lifecycle_status,
    photoFileId: row.photo_file_id ?? null,
  };
}

/**
 * List teacher profiles with bounded pagination, search, and employment status filtering.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {{ search?: string, employmentStatus?: string, limit: number, offset: number }} filters
 */
export async function listTeachersPaginated(dbAcademics, filters) {
  const where = [];
  const params = [];

  if (filters.employmentStatus) {
    where.push('employment_status = ?');
    params.push(filters.employmentStatus);
  }
  if (filters.search) {
    where.push('(full_name LIKE ? OR employee_code LIKE ?)');
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const [countRes, rowsRes] = await dbAcademics.batch([
    dbAcademics.prepare(`SELECT COUNT(*) AS total FROM teacher_profiles ${clause}`).bind(...params),
    dbAcademics
      .prepare(
        `SELECT
           id, user_id, employee_code, full_name, qualification, specialization,
           joining_date, employment_status, photo_file_id, created_at
         FROM teacher_profiles
         ${clause}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`
      )
      .bind(...params, filters.limit, filters.offset),
  ]);

  return {
    total: Number(countRes.results[0]?.total ?? 0),
    teachers: (rowsRes.results || []).map(mapTeacherProfileRow),
  };
}

/**
 * Fetch a teacher profile by ID along with its `teacher_assignments`.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {string} teacherId
 */
export async function findTeacherById(dbAcademics, teacherId) {
  const [profileRes, assignmentsRes] = await dbAcademics.batch([
    dbAcademics
      .prepare(
        `SELECT
           id, user_id, employee_code, full_name, qualification, specialization,
           joining_date, employment_status, photo_file_id, created_at
         FROM teacher_profiles
         WHERE id = ?
         LIMIT 1`
      )
      .bind(teacherId),
    dbAcademics
      .prepare(
        `SELECT
           id, teacher_profile_id, academic_session_id, class_id, subject_id,
           responsibility_category, created_at
         FROM teacher_assignments
         WHERE teacher_profile_id = ?
         ORDER BY created_at DESC`
      )
      .bind(teacherId),
  ]);

  const profileRow = profileRes.results?.[0];
  if (!profileRow) return null;

  return {
    ...mapTeacherProfileRow(profileRow),
    assignments: (assignmentsRes.results || []).map(mapTeacherAssignmentRow),
  };
}

/**
 * Insert a new `teacher_profiles` row in `DB_ACADEMICS`.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {{
 *   id: string,
 *   userId: string,
 *   employeeCode: string,
 *   fullName: string,
 *   qualification?: string | null,
 *   specialization?: string | null,
 *   joiningDate: string,
 *   employmentStatus: string,
 *   photoFileId?: string | null,
 *   createdAt: string,
 * }} teacher
 */
export async function insertTeacherProfile(dbAcademics, teacher) {
  await dbAcademics
    .prepare(
      `INSERT INTO teacher_profiles (
         id, user_id, employee_code, full_name, qualification, specialization,
         joining_date, employment_status, photo_file_id, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      teacher.id,
      teacher.userId,
      teacher.employeeCode,
      teacher.fullName,
      teacher.qualification ?? null,
      teacher.specialization ?? null,
      teacher.joiningDate,
      teacher.employmentStatus,
      teacher.photoFileId ?? null,
      teacher.createdAt
    )
    .run();
}

const TEACHER_UPDATE_COLUMNS = Object.freeze({
  employeeCode: 'employee_code',
  fullName: 'full_name',
  qualification: 'qualification',
  specialization: 'specialization',
  joiningDate: 'joining_date',
  employmentStatus: 'employment_status',
  photoFileId: 'photo_file_id',
});

/**
 * Update allowlisted fields on a `teacher_profiles` row in `DB_ACADEMICS`.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {string} teacherId
 * @param {Record<string, unknown>} fields
 */
export async function updateTeacherProfile(dbAcademics, teacherId, fields) {
  const assignments = [];
  const params = [];

  for (const [key, column] of Object.entries(TEACHER_UPDATE_COLUMNS)) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) {
      assignments.push(`${column} = ?`);
      params.push(fields[key] ?? null);
    }
  }

  if (assignments.length === 0) {
    return;
  }

  await dbAcademics
    .prepare(`UPDATE teacher_profiles SET ${assignments.join(', ')} WHERE id = ?`)
    .bind(...params, teacherId)
    .run();
}

/**
 * List `teacher_assignments` with bounded pagination and optional filters.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {{
 *   teacherProfileId?: string,
 *   academicSessionId?: string,
 *   classId?: string,
 *   subjectId?: string,
 *   responsibilityCategory?: string,
 *   limit: number,
 *   offset: number,
 * }} filters
 */
export async function listTeacherAssignmentsPaginated(dbAcademics, filters) {
  const where = [];
  const params = [];

  if (filters.teacherProfileId) {
    where.push('teacher_profile_id = ?');
    params.push(filters.teacherProfileId);
  }
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
  if (filters.responsibilityCategory) {
    where.push('responsibility_category = ?');
    params.push(filters.responsibilityCategory);
  }

  const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const [countRes, rowsRes] = await dbAcademics.batch([
    dbAcademics.prepare(`SELECT COUNT(*) AS total FROM teacher_assignments ${clause}`).bind(...params),
    dbAcademics
      .prepare(
        `SELECT
           id, teacher_profile_id, academic_session_id, class_id, subject_id,
           responsibility_category, created_at
         FROM teacher_assignments
         ${clause}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`
      )
      .bind(...params, filters.limit, filters.offset),
  ]);

  return {
    total: Number(countRes.results[0]?.total ?? 0),
    assignments: (rowsRes.results || []).map(mapTeacherAssignmentRow),
  };
}

/**
 * Fetch a single `teacher_assignments` row by ID.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {string} assignmentId
 */
export async function findTeacherAssignmentById(dbAcademics, assignmentId) {
  const row = await dbAcademics
    .prepare(
      `SELECT
         id, teacher_profile_id, academic_session_id, class_id, subject_id,
         responsibility_category, created_at
       FROM teacher_assignments
       WHERE id = ?
       LIMIT 1`
    )
    .bind(assignmentId)
    .first();

  return mapTeacherAssignmentRow(row);
}

/**
 * Verify that `teacher_profiles`, `academic_sessions`, `classes`, and `subjects` rows exist in `DB_ACADEMICS`.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {{ teacherProfileId: string, academicSessionId: string, classId: string, subjectId: string }} refs
 */
export async function validateAssignmentReferencesExist(dbAcademics, refs) {
  const [teacherRes, sessionRes, classRes, subjectRes] = await dbAcademics.batch([
    dbAcademics
      .prepare('SELECT id, employment_status FROM teacher_profiles WHERE id = ? LIMIT 1')
      .bind(refs.teacherProfileId),
    dbAcademics
      .prepare('SELECT id FROM academic_sessions WHERE id = ? LIMIT 1')
      .bind(refs.academicSessionId),
    dbAcademics.prepare('SELECT id FROM classes WHERE id = ? LIMIT 1').bind(refs.classId),
    dbAcademics.prepare('SELECT id FROM subjects WHERE id = ? LIMIT 1').bind(refs.subjectId),
  ]);

  return {
    teacher: teacherRes.results?.[0] ?? null,
    academicSession: sessionRes.results?.[0] ?? null,
    classRow: classRes.results?.[0] ?? null,
    subject: subjectRes.results?.[0] ?? null,
  };
}

/**
 * Insert a new `teacher_assignments` row in `DB_ACADEMICS`.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {{
 *   id: string,
 *   teacherProfileId: string,
 *   academicSessionId: string,
 *   classId: string,
 *   subjectId: string,
 *   responsibilityCategory: string,
 *   createdAt: string,
 * }} assignment
 */
export async function insertTeacherAssignment(dbAcademics, assignment) {
  await dbAcademics
    .prepare(
      `INSERT INTO teacher_assignments (
         id, teacher_profile_id, academic_session_id, class_id, subject_id,
         responsibility_category, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      assignment.id,
      assignment.teacherProfileId,
      assignment.academicSessionId,
      assignment.classId,
      assignment.subjectId,
      assignment.responsibilityCategory,
      assignment.createdAt
    )
    .run();
}

/**
 * Delete a `teacher_assignments` row by ID.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {string} assignmentId
 */
export async function deleteTeacherAssignmentById(dbAcademics, assignmentId) {
  await dbAcademics
    .prepare('DELETE FROM teacher_assignments WHERE id = ?')
    .bind(assignmentId)
    .run();
}

/**
 * List active session-scoped assignments for an `ACTIVE` teacher profile.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {string} teacherProfileId
 * @param {string} academicSessionId
 */
export async function findActiveTeacherAssignmentsForSession(
  dbAcademics,
  teacherProfileId,
  academicSessionId
) {
  const res = await dbAcademics
    .prepare(
      `SELECT
         ta.id, ta.teacher_profile_id, ta.academic_session_id, ta.class_id,
         ta.subject_id, ta.responsibility_category, ta.created_at
       FROM teacher_assignments ta
       INNER JOIN teacher_profiles tp ON tp.id = ta.teacher_profile_id
       WHERE ta.teacher_profile_id = ?
         AND ta.academic_session_id = ?
         AND tp.employment_status = 'ACTIVE'
       ORDER BY ta.created_at ASC`
    )
    .bind(teacherProfileId, academicSessionId)
    .all();

  return (res.results || []).map(mapTeacherAssignmentRow);
}

/**
 * Check if an `ACTIVE` teacher has at least one assignment for `(academicSessionId, classId)`.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {string} teacherProfileId
 * @param {string} academicSessionId
 * @param {string} classId
 * @returns {Promise<boolean>}
 */
export async function hasActiveTeacherClassAssignment(
  dbAcademics,
  teacherProfileId,
  academicSessionId,
  classId
) {
  const row = await dbAcademics
    .prepare(
      `SELECT 1 AS ok
       FROM teacher_assignments ta
       INNER JOIN teacher_profiles tp ON tp.id = ta.teacher_profile_id
       WHERE ta.teacher_profile_id = ?
         AND ta.academic_session_id = ?
         AND ta.class_id = ?
         AND tp.employment_status = 'ACTIVE'
       LIMIT 1`
    )
    .bind(teacherProfileId, academicSessionId, classId)
    .first();

  return row?.ok === 1;
}

/**
 * Check if an `ACTIVE` teacher has an assignment for `(academicSessionId, classId, subjectId)`.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {string} teacherProfileId
 * @param {string} academicSessionId
 * @param {string} classId
 * @param {string} subjectId
 * @returns {Promise<boolean>}
 */
export async function hasActiveTeacherClassSubjectAssignment(
  dbAcademics,
  teacherProfileId,
  academicSessionId,
  classId,
  subjectId
) {
  const row = await dbAcademics
    .prepare(
      `SELECT 1 AS ok
       FROM teacher_assignments ta
       INNER JOIN teacher_profiles tp ON tp.id = ta.teacher_profile_id
       WHERE ta.teacher_profile_id = ?
         AND ta.academic_session_id = ?
         AND ta.class_id = ?
         AND ta.subject_id = ?
         AND tp.employment_status = 'ACTIVE'
       LIMIT 1`
    )
    .bind(teacherProfileId, academicSessionId, classId, subjectId)
    .first();

  return row?.ok === 1;
}

/**
 * Return the currently active `academic_sessions.id` from `DB_ACADEMICS`, or `null` if none is active.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @returns {Promise<string | null>}
 */
export async function findActiveAcademicSessionId(dbAcademics) {
  const row = await dbAcademics
    .prepare('SELECT id FROM academic_sessions WHERE is_active = 1 LIMIT 1')
    .first();
  return row?.id ?? null;
}

/**
 * Query `DB_STUDENTS` for the active enrolled class roster with bounded pagination.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbStudents
 * @param {{ academicSessionId: string, classId: string, limit: number, offset: number }} params
 */
export async function listActiveClassRosterPaginated(
  dbStudents,
  { academicSessionId, classId, limit, offset }
) {
  const [countRes, rowsRes] = await dbStudents.batch([
    dbStudents
      .prepare(
        `SELECT COUNT(*) AS total
         FROM enrollments e
         INNER JOIN students s ON s.id = e.student_id
         WHERE e.academic_session_id = ?
           AND e.class_id = ?
           AND e.enrollment_status = 'ACTIVE'`
      )
      .bind(academicSessionId, classId),
    dbStudents
      .prepare(
        `SELECT
           e.id AS enrollment_id,
           s.id AS student_id,
           s.admission_number,
           s.full_name,
           e.roll_number,
           e.enrollment_status,
           s.lifecycle_status,
           s.photo_file_id
         FROM enrollments e
         INNER JOIN students s ON s.id = e.student_id
         WHERE e.academic_session_id = ?
           AND e.class_id = ?
           AND e.enrollment_status = 'ACTIVE'
         ORDER BY e.roll_number ASC, s.full_name ASC
         LIMIT ? OFFSET ?`
      )
      .bind(academicSessionId, classId, limit, offset),
  ]);

  return {
    total: Number(countRes.results[0]?.total ?? 0),
    roster: (rowsRes.results || []).map(mapRosterStudentRow),
  };
}
