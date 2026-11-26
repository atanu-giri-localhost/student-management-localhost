/**
 * Direct Cloudflare D1 (`DB_STUDENTS`) repository for `students`, `enrollments`, and student links.
 */

function mapStudentRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id ?? null,
    admissionNumber: row.admission_number,
    fullName: row.full_name,
    dateOfBirth: row.date_of_birth,
    gender: row.gender,
    bloodGroup: row.blood_group ?? null,
    photoFileId: row.photo_file_id ?? null,
    contactPhone: row.contact_phone ?? null,
    residentialAddress: row.residential_address ?? null,
    emergencyContactName: row.emergency_contact_name,
    emergencyContactPhone: row.emergency_contact_phone,
    lifecycleStatus: row.lifecycle_status,
    admissionDate: row.admission_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Check whether a `VERIFIED` `parent_students` link exists between `parentProfileId` and `studentId`.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbStudents
 * @param {string} parentProfileId
 * @param {string} studentId
 * @returns {Promise<boolean>}
 */
export async function hasVerifiedParentLink(dbStudents, parentProfileId, studentId) {
  const row = await dbStudents
    .prepare(
      `SELECT 1 AS ok
       FROM parent_students
       WHERE parent_profile_id = ?
         AND student_id = ?
         AND verification_status = 'VERIFIED'
       LIMIT 1`
    )
    .bind(parentProfileId, studentId)
    .first();

  return row?.ok === 1;
}

/**
 * List students with bounded pagination, search, and lifecycle filtering.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbStudents
 * @param {{ search?: string, lifecycleStatus?: string, limit: number, offset: number }} filters
 */
export async function listStudentsPaginated(dbStudents, filters) {
  const where = [];
  const params = [];

  if (filters.lifecycleStatus) {
    where.push('lifecycle_status = ?');
    params.push(filters.lifecycleStatus);
  }
  if (filters.search) {
    where.push('(full_name LIKE ? OR admission_number LIKE ?)');
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const [countRes, rowsRes] = await dbStudents.batch([
    dbStudents.prepare(`SELECT COUNT(*) AS total FROM students ${clause}`).bind(...params),
    dbStudents
      .prepare(
        `SELECT
           id, user_id, admission_number, full_name, date_of_birth, gender,
           blood_group, photo_file_id, contact_phone, residential_address,
           emergency_contact_name, emergency_contact_phone, lifecycle_status,
           admission_date, created_at, updated_at
         FROM students
         ${clause}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`
      )
      .bind(...params, filters.limit, filters.offset),
  ]);

  return {
    total: Number(countRes.results[0]?.total ?? 0),
    students: (rowsRes.results || []).map(mapStudentRow),
  };
}

/**
 * Fetch a student by ID along with session-scoped `enrollments` and `parent_students` links.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbStudents
 * @param {string} studentId
 */
export async function findStudentById(dbStudents, studentId) {
  const [studentRow, enrollmentsRes, parentsRes] = await dbStudents.batch([
    dbStudents
      .prepare(
        `SELECT
           id, user_id, admission_number, full_name, date_of_birth, gender,
           blood_group, photo_file_id, contact_phone, residential_address,
           emergency_contact_name, emergency_contact_phone, lifecycle_status,
           admission_date, created_at, updated_at
         FROM students
         WHERE id = ?
         LIMIT 1`
      )
      .bind(studentId),
    dbStudents
      .prepare(
        `SELECT
           id, academic_session_id, class_id, roll_number,
           enrollment_status, start_date, end_date, created_at
         FROM enrollments
         WHERE student_id = ?
         ORDER BY start_date DESC`
      )
      .bind(studentId),
    dbStudents
      .prepare(
        `SELECT
           ps.id AS link_id,
           ps.parent_profile_id,
           ps.is_primary,
           ps.verification_status,
           pp.full_name,
           pp.phone_normalized,
           pp.relationship_type
         FROM parent_students ps
         INNER JOIN parent_profiles pp ON pp.id = ps.parent_profile_id
         WHERE ps.student_id = ?
         ORDER BY ps.is_primary DESC, ps.created_at ASC`
      )
      .bind(studentId),
  ]);

  const student = mapStudentRow(studentRow.results?.[0]);
  if (!student) {
    return null;
  }

  return {
    ...student,
    enrollments: (enrollmentsRes.results || []).map((e) => ({
      id: e.id,
      academicSessionId: e.academic_session_id,
      classId: e.class_id,
      rollNumber: e.roll_number ?? null,
      enrollmentStatus: e.enrollment_status,
      startDate: e.start_date,
      endDate: e.end_date ?? null,
      createdAt: e.created_at,
    })),
    guardians: (parentsRes.results || []).map((g) => ({
      linkId: g.link_id,
      parentProfileId: g.parent_profile_id,
      fullName: g.full_name,
      phoneNormalized: g.phone_normalized,
      relationshipType: g.relationship_type,
      isPrimary: g.is_primary === 1,
      verificationStatus: g.verification_status,
    })),
  };
}

/**
 * Atomically insert a student record and its `DB_STUDENTS.audit_outbox` event.
 */
export async function createStudentBatch(dbStudents, { student, auditStatement }) {
  return await dbStudents.batch([
    dbStudents
      .prepare(
        `INSERT INTO students (
          id, user_id, admission_number, full_name, date_of_birth, gender,
          blood_group, photo_file_id, contact_phone, residential_address,
          emergency_contact_name, emergency_contact_phone, lifecycle_status,
          admission_date, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        student.id,
        student.userId ?? null,
        student.admissionNumber,
        student.fullName,
        student.dateOfBirth,
        student.gender,
        student.bloodGroup ?? null,
        student.photoFileId ?? null,
        student.contactPhone ?? null,
        student.residentialAddress ?? null,
        student.emergencyContactName,
        student.emergencyContactPhone,
        student.lifecycleStatus,
        student.admissionDate,
        student.createdAt,
        student.updatedAt
      ),
    auditStatement,
  ]);
}

/**
 * Atomically update student fields and write `DB_STUDENTS.audit_outbox`.
 */
export async function updateStudentBatch(dbStudents, { studentId, fields, nowIso, auditStatement }) {
  const columnMap = {
    fullName: 'full_name',
    dateOfBirth: 'date_of_birth',
    gender: 'gender',
    bloodGroup: 'blood_group',
    photoFileId: 'photo_file_id',
    contactPhone: 'contact_phone',
    residentialAddress: 'residential_address',
    emergencyContactName: 'emergency_contact_name',
    emergencyContactPhone: 'emergency_contact_phone',
    lifecycleStatus: 'lifecycle_status',
  };

  const sets = ['updated_at = ?'];
  const params = [nowIso];

  for (const [key, col] of Object.entries(columnMap)) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) {
      sets.push(`${col} = ?`);
      params.push(fields[key] ?? null);
    }
  }
  params.push(studentId);

  return await dbStudents.batch([
    dbStudents.prepare(`UPDATE students SET ${sets.join(', ')} WHERE id = ?`).bind(...params),
    auditStatement,
  ]);
}
